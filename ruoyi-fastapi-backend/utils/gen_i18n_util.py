import io
import json
import re
from pathlib import Path

from babel import Locale, UnknownLocaleError
from babel.messages.catalog import Catalog
from babel.messages.mofile import write_mo
from babel.messages.pofile import PoFileError, read_po, write_po

from config.env import I18nConfig
from exceptions.exception import ServiceWarning
from i18n.registry import LocaleRegistry
from module_generator.entity.vo.gen_vo import GenTableColumnModel, GenTableModel


class GenI18nUtil:
    """
    生成模块的独立语言资源与增量合并工具
    """

    PROJECT_ROOT = Path(__file__).resolve().parents[2]
    FRAMEWORKS = {'element-ui': 'vue2', 'element-plus': 'vue3', 'react-antd': 'react'}
    KEY_PATTERN = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$')
    PO_LINE_PATTERN = re.compile(r'^(?:msg(?:ctxt|id(?:_plural)?|str(?:\[\d+\])?)\s+)?"(?:[^"\\]|\\.)*"$')

    def __init__(self, table: GenTableModel) -> None:
        """
        从目标应用配置确定语言，保留表注释作为基准文案

        :param table: 本次生成使用的业务表副本
        """
        self.framework = self.FRAMEWORKS.get(table.tpl_web_type, 'vue2')
        self.app_root = self.PROJECT_ROOT / 'ruoyi-fastapi-frontend' / self.framework / 'web'
        meta = json.loads((self.app_root / 'src/i18n/locale-meta.json').read_text(encoding='utf-8'))
        options = json.loads(table.options or '{}')
        self.source_locale = meta['sourceLocale']
        requested_source = options.get('i18nSourceLocale') or self.source_locale
        if requested_source != self.source_locale or self.source_locale != I18nConfig.SOURCE_LOCALE:
            raise ServiceWarning(
                message=f'生成基准语言必须与目标应用及后端一致：{self.source_locale}',
                msg_key='generator.i18nSourceLocaleMismatch',
                msg_params={'locale': self.source_locale},
            )
        enabled = [item['code'] for item in meta['locales'] if item.get('enabled')]
        selected = options.get('i18nLocales')
        if selected is not None and (not isinstance(selected, list) or not selected):
            self.invalid_configuration()
        try:
            self.locales = list(
                dict.fromkeys(
                    LocaleRegistry.normalize_locale(code) for code in [self.source_locale, *(selected or enabled)]
                )
            )
        except (TypeError, ValueError):
            self.invalid_configuration()
        self.translations = options.get('i18nTranslations') or {}
        if not isinstance(self.translations, dict) or any(
            locale not in self.locales
            or not isinstance(entries, dict)
            or any(not isinstance(key, str) or not isinstance(value, str) for key, value in entries.items())
            for locale, entries in self.translations.items()
        ):
            self.invalid_configuration()
        self.namespace = f'generated.{table.module_name}.{table.business_name}'
        if not self.KEY_PATTERN.fullmatch(self.namespace):
            self.invalid_configuration()
        self.frontend = {locale: {} for locale in self.locales}
        self.backend = {locale: {} for locale in self.locales}
        self.field_prefixes = {id(column): 'fields' for column in table.columns or []}
        if table.sub_table:
            self.field_prefixes.update(
                {id(column): f'subfields.{table.sub_table.business_name}' for column in table.sub_table.columns or []}
            )
        name = table.function_name or table.business_name
        for suffix, source in {
            'title': name,
            'createTitle': f'添加{name}',
            'editTitle': f'修改{name}',
            'detailTitle': f'{name}详情',
            'deleteConfirm': f'是否确认删除{name}编号为“{{{{ids}}}}”的数据项？',
        }.items():
            self.text(suffix, source)

    @staticmethod
    def invalid_configuration() -> None:
        """
        拒绝无法安全注册或插值的生成参数
        """
        raise ServiceWarning(
            message='国际化生成配置无效，请检查语言列表与译文占位符',
            msg_key='generator.i18nInvalidConfiguration',
        )

    def key(self, suffix: str) -> str:
        """
        生成可由静态扫描识别的完整前端消息标识

        :param suffix: 模块内稳定语义路径
        :return: 完整命名空间和消息标识
        """
        if not self.KEY_PATTERN.fullmatch(suffix):
            self.invalid_configuration()
        return f'{self.namespace}:{suffix}'

    def text(self, suffix: str, source: str, english: str | None = None) -> str:
        """
        登记模板文案，未提供的目标语言译文保持为空

        :param suffix: 模块内稳定语义路径
        :param source: 基准文案
        :param english: 已知且无需推断业务含义的英文译文
        :return: 完整前端消息标识
        """
        key = self.key(suffix)
        placeholders = set(re.findall(r'\{\{([^{}]+)\}\}', source))
        for locale in self.locales:
            value = source if locale == self.source_locale else english if locale == 'en-US' and english else ''
            if locale != self.source_locale:
                value = self.translations.get(locale, {}).get(suffix, value)
            if value and set(re.findall(r'\{\{([^{}]+)\}\}', value)) != placeholders:
                self.invalid_configuration()
            self.frontend[locale][suffix] = value
        return key

    def field_key(self, column: GenTableColumnModel, suffix: str = 'label') -> str:
        """
        根据代码字段生成标签、占位符或必填提示

        :param column: 主表或子表字段
        :param suffix: label、input、select 或 required
        :return: 完整前端字段消息标识
        """
        label = (column.column_comment or column.column_name).split('（')[0]
        source = {'label': label, 'input': f'请输入{label}', 'select': f'请选择{label}', 'required': f'{label}不能为空'}
        if suffix not in source:
            self.invalid_configuration()
        prefix = self.field_prefixes.get(id(column), 'fields')
        return self.text(f'{prefix}.{column.python_field}.{suffix}', source[suffix])

    def backend_text(self, suffix: str, source: str, english: str | None = None) -> str:
        """
        登记后端 gettext 消息，使用与前端独立的语义路径

        :param suffix: 模块内稳定消息路径
        :param source: 基准文案，插值使用命名百分号形式
        :param english: 已知英文译文
        :return: 完整后端消息标识
        """
        self.key(suffix)
        key = f'{self.namespace}.{suffix}'
        placeholders = set(re.findall(r'%\(([^)]+)\)[sdf]', source))
        for locale in self.locales:
            value = source if locale == self.source_locale else english if locale == 'en-US' and english else ''
            if locale != self.source_locale:
                value = self.translations.get(locale, {}).get(f'backend.{suffix}', value)
            if value and set(re.findall(r'%\(([^)]+)\)[sdf]', value)) != placeholders:
                self.invalid_configuration()
            self.backend[locale][key] = re.sub(r'%(?!\([A-Za-z_][A-Za-z0-9_]*\)[sdf])', '%%', value)
        return key

    def backend_field_key(self, column: GenTableColumnModel, suffix: str = 'label') -> str:
        """
        生成后端校验与导出字段消息

        :param column: 主表或子表字段
        :param suffix: label 或 required
        :return: 完整后端字段消息标识
        """
        label = (column.column_comment or column.column_name).split('（')[0]
        if suffix not in {'label', 'required'}:
            self.invalid_configuration()
        prefix = self.field_prefixes.get(id(column), 'fields')
        source = label if suffix == 'label' else f'{label}不能为空'
        return self.backend_text(f'{prefix}.{column.python_field}.{suffix}', source)

    @staticmethod
    def nest(values: dict[str, str]) -> dict:
        """
        将稳定点路径转换为独立命名空间内的嵌套字典

        :param values: 点路径及文案
        :return: 嵌套资源字典
        """
        result = {}
        for key, value in values.items():
            target = result
            parts = key.split('.')
            for part in parts[:-1]:
                target = target.setdefault(part, {})
            target[parts[-1]] = value
        return result

    @classmethod
    def merge_json(cls, existing: dict, generated: dict) -> dict:
        """
        只补充缺失键，不覆盖已有人工文案或删除旧键

        :param existing: 已有语言资源
        :param generated: 本次生成资源
        :return: 合并后的资源
        """
        result = dict(existing)
        for key, value in generated.items():
            if key not in result:
                result[key] = value
            elif isinstance(value, dict) and isinstance(result[key], dict):
                result[key] = cls.merge_json(result[key], value)
        return result

    @staticmethod
    def po_content(entries: dict[str, str], locale: str) -> str:
        """
        生成可合并到 core 域的 gettext 文本

        :param entries: 稳定消息标识和译文
        :param locale: 目标语言
        :return: PO 文件内容
        """
        try:
            catalog = Catalog(locale=Locale.parse(locale, sep='-'), domain='core')
        except (ValueError, UnknownLocaleError):
            catalog = Catalog(domain='core')
        for key, value in entries.items():
            catalog.add(key, value)
        output = io.BytesIO()
        write_po(output, catalog, width=120, sort_output=True, omit_header=False)
        return output.getvalue().decode('utf-8')

    @classmethod
    def read_catalog(cls, content: str) -> Catalog:
        """
        严格解析词库，避免宽松解析器静默截断未加引号的人工译文

        :param content: PO 文件内容
        :return: 已校验的词库
        """
        for raw_line in content.lstrip('\ufeff').splitlines():
            line = raw_line.strip()
            if line and not line.startswith('#') and not cls.PO_LINE_PATTERN.fullmatch(line):
                raise ValueError('Invalid PO statement')
        return read_po(io.StringIO(content), abort_invalid=True)

    @classmethod
    def merge_po(cls, existing: str, generated: str) -> str:
        """
        合并模块消息，保留已有 gettext 译文和消息标志

        :param existing: 目标目录已有 PO 内容
        :param generated: 新增模块 PO 内容
        :return: 合并后的完整 PO 内容
        """
        catalog = cls.read_catalog(existing)
        additions = cls.read_catalog(generated)
        for message in additions:
            if message.id and message.id not in catalog:
                catalog.add(message.id, message.string, flags=message.flags)
        output = io.BytesIO()
        write_po(output, catalog, width=120, sort_output=True)
        return output.getvalue().decode('utf-8')

    @classmethod
    def compile_po(cls, content: str) -> bytes:
        """
        为合并后的词库生成可加载的编译产物

        :param content: 完整 PO 内容
        :return: MO 编译产物
        """
        output = io.BytesIO()
        write_mo(output, cls.read_catalog(content))
        return output.getvalue()

    @classmethod
    def merge_content(cls, relative_path: str, existing: str, generated: str) -> str:
        """
        按资源类型保留已有人工翻译

        :param relative_path: 生成包内相对路径
        :param existing: 已有内容
        :param generated: 本次生成内容
        :return: 合并后的内容，非词库文件按原有规则更新
        """
        try:
            if relative_path.startswith('frontend/src/i18n/locales/') and relative_path.endswith('.json'):
                old = json.loads(existing)
                new = json.loads(generated)
                if not isinstance(old, dict) or not isinstance(new, dict):
                    raise ValueError('Locale resources must be objects')
                return json.dumps(cls.merge_json(old, new), ensure_ascii=False, indent=2) + '\n'
            if relative_path.startswith('backend/i18n/catalogs/') and relative_path.endswith('.po'):
                return cls.merge_po(existing, generated)
        except (ValueError, TypeError, PoFileError) as exc:
            raise ServiceWarning(
                message='已有语言资源格式无效，生成已停止以保留原文件',
                msg_key='generator.i18nCatalogInvalid',
            ) from exc
        return generated

    def refresh_pending(self, artifacts: dict[str, str]) -> None:
        """
        按合并后的实际词库更新待补译清单

        :param artifacts: 已渲染并完成增量合并的生成文件
        """
        pending = {}
        for locale in self.locales:
            frontend = json.loads(artifacts[f'frontend/src/i18n/locales/{locale}/{self.namespace}.json'])
            backend = read_po(io.StringIO(artifacts[f'backend/i18n/catalogs/{locale}/LC_MESSAGES/core.po']))
            missing_frontend = []
            for suffix in self.frontend[locale]:
                value = frontend
                for part in suffix.split('.'):
                    value = value.get(part) if isinstance(value, dict) else None
                if not isinstance(value, str) or not value.strip():
                    missing_frontend.append(self.key(suffix))
            pending[locale] = {
                'frontend': missing_frontend,
                'backend': [
                    key
                    for key in self.backend[locale]
                    if key not in backend or not backend[key].string or backend[key].fuzzy
                ],
            }
        artifacts[f'i18n/{self.namespace}.pending.json'] = json.dumps(pending, ensure_ascii=False, indent=2) + '\n'

    def artifacts(self) -> dict[str, str]:
        """
        生成独立语言资源、待补译清单和接入说明

        :return: 生成包内相对路径和文本内容
        """
        result = {}
        pending = {}
        for locale in self.locales:
            values = self.frontend[locale]
            path = f'frontend/src/i18n/locales/{locale}/{self.namespace}.json'
            result[path] = json.dumps(self.nest(values), ensure_ascii=False, indent=2) + '\n'
            backend_path = f'backend/i18n/catalogs/{locale}/LC_MESSAGES/core.po'
            result[backend_path] = self.po_content(self.backend[locale], locale)
            pending[locale] = {
                'frontend': [self.key(key) for key, value in values.items() if not value.strip()],
                'backend': [key for key, value in self.backend[locale].items() if not value.strip()],
            }
        result[f'i18n/{self.namespace}.pending.json'] = json.dumps(pending, ensure_ascii=False, indent=2) + '\n'
        result[f'i18n/{self.namespace}.README.md'] = (
            f'# {self.namespace}\n\n'
            f'目标应用：{self.framework}/web；基准语言：{self.source_locale}；生成语言：{", ".join(self.locales)}。\n\n'
            '本目录是独立生成包。将 frontend/src 下的代码与语言资源合并到目标应用 src，'
            '不要复制到其他端或建立跨端资源引用。已有 generated.* 命名空间由目标应用构建期注册，'
            '新语言还须先配置目标应用 locale-meta.json；语言列表来自该配置或 i18nLocales 参数。\n\n'
            '字段和表注释是基准文案。未知译文保留空字符串，pending.json 列出待补译键，'
            '不能将空译文当成正式完成；使用目标应用固定版本 x18n apply/set 补译后运行 i18n:check。'
            'i18nTranslations 可按语言提供稳定模块内路径的译文；后端词条使用 backend. 前缀。\n\n'
            'backend/i18n/catalogs 下的 core.po 是模块增量片段，合入后端现有 core.po 时只补新 msgid，'
            '不能整文件覆盖现有词库。落盘生成会增量合并输出目录已有 JSON/PO，并重新编译 MO；'
            'ZIP 与预览提供可审查的片段。完成后端登记语言、词库完整性检查及编译后才可发布。\n\n'
            '重新生成不覆盖已有语言键，也不删除旧文件；页面代码仍按生成器原有规则更新。'
            'genPath 表示独立生成包根目录，不应直接选择应用根目录或 src 目录。\n'
        )
        return result
