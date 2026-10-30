import json
from pathlib import Path
from typing import ClassVar


class PluginLocaleScaffoldBuilder:
    """
    生成插件独立词库与宿主注册示例。
    """

    MESSAGES: ClassVar[dict[str, dict[str, str]]] = {
        'zh-CN': {
            'ready': '{{pluginId}} 插件',
            'name': '名称',
            'namePlaceholder': '请输入名称',
            'nameRequired': '名称不能为空',
            'search': '搜索',
            'reset': '重置',
            'add': '新增',
            'id': 'ID',
            'status': '状态',
            'enabled': '正常',
            'disabled': '停用',
            'remark': '备注',
            'actions': '操作',
            'edit': '修改',
            'delete': '删除',
            'confirm': '确定',
            'cancel': '取消',
            'saved': '保存成功',
            'deleted': '删除成功',
            'addTitle': '新增 {{pluginId}}',
            'editTitle': '修改 {{pluginId}}',
            'deleteConfirm': '确认删除数据“{{name}}”吗？',
        },
        'en-US': {
            'ready': '{{pluginId}} plugin',
            'name': 'Name',
            'namePlaceholder': 'Enter a name',
            'nameRequired': 'Name is required',
            'search': 'Search',
            'reset': 'Reset',
            'add': 'Add',
            'id': 'ID',
            'status': 'Status',
            'enabled': 'Active',
            'disabled': 'Disabled',
            'remark': 'Remarks',
            'actions': 'Actions',
            'edit': 'Edit',
            'delete': 'Delete',
            'confirm': 'Confirm',
            'cancel': 'Cancel',
            'saved': 'Saved successfully',
            'deleted': 'Deleted successfully',
            'addTitle': 'Add {{pluginId}}',
            'editTitle': 'Edit {{pluginId}}',
            'deleteConfirm': 'Delete “{{name}}”?',
        },
    }

    @classmethod
    def build_files(cls, plugin_id: str, plugin_root: Path, frontend_root: Path) -> list[tuple[Path, str]]:
        """
        按目标宿主的语言注册表生成独立词库，不访问其他应用。

        :param plugin_id: 插件标识
        :param plugin_root: 插件输出目录
        :param frontend_root: 目标宿主目录
        :return: 词库、注册模块和接入说明
        """
        meta = cls.load_metadata(frontend_root)
        codes = list(dict.fromkeys([meta['sourceLocale'], *(entry['code'] for entry in meta['locales'])]))
        imports = []
        bundles = []
        files = []
        for index, code in enumerate(codes):
            if not code or any(part in code for part in ('/', '\\', '..')):
                raise ValueError('语言标识不能包含路径分隔符')
            messages = cls.MESSAGES.get(code, dict.fromkeys(cls.MESSAGES['zh-CN'], ''))
            files.append(
                (plugin_root / 'locales' / f'{code}.json', json.dumps(messages, ensure_ascii=False, indent=2) + '\n')
            )
            imports.append(f"import locale{index} from './locales/{code}.json'")
            bundles.append(f'  [{json.dumps(code)}, locale{index}]')
        module = "import { i18n } from '@/i18n'\n" + '\n'.join(imports)
        module += f"\n\nconst namespace = 'plugin.{plugin_id}'\nconst bundles = [\n" + ',\n'.join(bundles) + '\n]\n'
        module += """
export function registerPluginLocales() {
  for (const [locale, messages] of bundles) {
    i18n.engine.removeResourceBundle(locale, namespace)
    i18n.engine.addResourceBundle(locale, namespace, messages)
  }
}

export function removePluginLocales() {
  for (const [locale] of bundles) i18n.engine.removeResourceBundle(locale, namespace)
}

registerPluginLocales()
"""
        files.append((plugin_root / 'i18n.js', module))
        files.append(
            (
                plugin_root / 'I18N.md',
                f"""# {plugin_id} 国际化

词库只属于本插件：`locales/<locale>.json`，namespace 为 `plugin.{plugin_id}`。
页面首次加载会导入 `i18n.js` 并注册词库；源码升级重新加载模块时替换本插件的旧资源。
若宿主在同一会话内实现插件卸载，调用 `removePluginLocales()`；再次启用调用 `registerPluginLocales()`。
这两个操作只处理本插件的 namespace，不修改宿主或其他插件的消息。

目标语言从本应用 `src/i18n/locale-meta.json` 读取。新增语言后补充对应文件与 `i18n.js` 导入；
第三语言的空字符串是待翻译标记，必须补译并通过目标应用的 `pnpm exec x18n check` 后发布。
维护词库使用目标应用安装的 x18n CLI（`set`、`apply`、`check`）；不要覆盖人工译文。
宿主的 `x18n.config.mjs` 增加 finder 规则
`{{ pattern: 'plugins/{plugin_id}/locales/{{locale}}.json', namespace: 'plugin.{plugin_id}' }}`，
并把 `plugins/{plugin_id}/**/*.{{js,jsx,vue}}` 加入 `usage.include`，使提取和检查覆盖本插件。
保持宿主已有的 x18n 项目插件，以正确处理固定 namespace 的新词条路径。
插件目录可整体迁移到匹配框架的宿主，不依赖其他应用的 locale 目录。
""",
            )
        )
        return files

    @classmethod
    def load_metadata(cls, frontend_root: Path) -> dict:
        """
        读取目标应用语言配置，独立测试目录使用模板默认配置。

        :param frontend_root: 目标宿主目录
        :return: 可独立复制的语言注册表
        """
        meta_path = frontend_root / 'src' / 'i18n' / 'locale-meta.json'
        if meta_path.is_file():
            return json.loads(meta_path.read_text(encoding='utf-8'))
        source = 'zh-CN'
        return {
            'sourceLocale': source,
            'defaultLocale': source,
            'locales': [
                {
                    'code': code,
                    'nativeName': code,
                    'enabled': True,
                    'direction': 'ltr',
                    'aliases': [code.split('-')[0]],
                    'fallback': [] if code == source else [source],
                }
                for code in cls.MESSAGES
            ],
        }

    @classmethod
    def build_bundle_files(cls, root: Path, frontend_root: Path) -> list[tuple[Path, str]]:
        """
        生成独立 bundle 的注册表和词库，未知语言保持可检查的待翻译状态。

        :param root: 独立前端工程目录
        :param frontend_root: 目标宿主目录
        :return: 独立 bundle 的国际化文件
        """
        meta = cls.load_metadata(frontend_root)
        messages = {
            'zh-CN': {
                'application': '插件应用',
                'refresh': '刷新状态',
                'connecting': '正在连接管理平台…',
                'pluginId': '插件标识',
                'serverTime': '服务端时间',
                'waiting': '等待连接',
                'ready': '连接正常，已获取最新状态。',
                'retry': '获取插件状态失败，可点击“刷新状态”重试。',
                'ended': '会话已结束',
                'loggedOut': '登录已结束，请重新登录管理平台。',
                'openFromHost': '请从管理平台打开插件页面。',
            },
            'en-US': {
                'application': 'Plugin application',
                'refresh': 'Refresh status',
                'connecting': 'Connecting to the admin platform…',
                'pluginId': 'Plugin ID',
                'serverTime': 'Server time',
                'waiting': 'Waiting for connection',
                'ready': 'Connected. Status is up to date.',
                'retry': 'Unable to refresh the plugin status. Select “Refresh status” to try again.',
                'ended': 'Session ended',
                'loggedOut': 'Your session has ended. Sign in to the admin platform again.',
                'openFromHost': 'Open this plugin from the admin platform.',
            },
        }
        files = [(root / 'src' / 'locale-meta.json', json.dumps(meta, ensure_ascii=False, indent=2) + '\n')]
        for entry in meta['locales']:
            code = entry['code']
            if not code or any(part in code for part in ('/', '\\', '..')):
                raise ValueError('语言标识不能包含路径分隔符')
            values = messages.get(code, dict.fromkeys(messages['zh-CN'], ''))
            files.append((root / 'locales' / f'{code}.json', json.dumps(values, ensure_ascii=False, indent=2) + '\n'))
        return files
