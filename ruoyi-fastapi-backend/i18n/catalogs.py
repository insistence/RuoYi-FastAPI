import gettext
import hashlib
import io
import json
import re
import struct
from dataclasses import dataclass
from pathlib import Path
from threading import RLock

from config.env import I18nConfig
from i18n.registry import CATALOG_ROOT, LANGUAGE_FALLBACKS, LOCALES, LocaleRegistry


@dataclass(frozen=True)
class CatalogSpec:
    """
    已注册词库的资源目录和回退配置

    :param domain: 核心或插件独占的 gettext 域名
    :param root: 已校验的词库根目录
    :param default_locale: 请求语言无法匹配时使用的默认语言
    :param fallbacks: 各已发布语言及其回退语言列表
    :param policy: 计算发布指纹时使用的额外配置
    """

    domain: str
    root: Path
    default_locale: str
    fallbacks: tuple[tuple[str, tuple[str, ...]], ...]
    policy: str = ''

    @property
    def locales(self) -> tuple[str, ...]:
        """
        获取当前词库域已交付的语言

        :return: 已交付的语言标识
        """
        return tuple(code for code, _ in self.fallbacks)

    def path(self, code: str, suffix: str) -> Path:
        """
        从受信配置构造资源路径，拒绝越界符号链接

        :param code: 已注册的语言标识
        :param suffix: 词库文件扩展名，仅支持 .po 和 .mo
        :return: 校验后的词库资源路径
        """
        if code not in self.locales or suffix not in ('.po', '.mo'):
            raise ValueError('Unregistered catalog resource')
        path = (self.root / code / 'LC_MESSAGES' / f'{self.domain}{suffix}').resolve()
        if not path.is_relative_to(self.root):
            raise ValueError('Catalog resource escapes its registered root')
        return path

    def chain(self, locale: str) -> tuple[str, ...]:
        """
        按当前词库域解析语言回退链，插件词库不回退到核心域

        :param locale: 请求的语言标识
        :return: 按优先级排列的语言回退链
        """
        result: list[str] = []
        fallbacks = dict(self.fallbacks)

        def visit(code: str, stack: tuple[str, ...] = ()) -> None:
            if code in stack or code not in fallbacks:
                raise ValueError('Invalid domain locale fallback')
            if code not in result:
                result.append(code)
                for fallback in fallbacks[code]:
                    visit(fallback, (*stack, code))

        if locale in fallbacks:
            visit(locale)
        if self.domain != 'core' or locale not in fallbacks:
            visit(self.default_locale)
        return tuple(result)


@dataclass(frozen=True)
class CatalogSnapshot:
    """
    同一发布版本的词库配置、译文和指纹

    :param spec: 加载本版本时使用的配置
    :param translations: 按语言保存的 gettext 词库实例
    :param fingerprint: 根据配置和编译产物内容计算的发布指纹
    """

    spec: CatalogSpec
    translations: dict[str, gettext.GNUTranslations]
    fingerprint: str


class CatalogRegistry:
    """
    进程内受信词库注册表，在启动或生命周期操作中计算内容指纹
    """

    _snapshots: dict[str, CatalogSnapshot] = {}
    _fingerprint: str | None = None
    _lock = RLock()

    @staticmethod
    def core_spec() -> CatalogSpec:
        """
        使用项目固定目录和后端语言配置构造核心词库配置

        :return: 核心词库配置
        """
        return CatalogSpec(
            'core',
            CATALOG_ROOT.resolve(),
            I18nConfig.i18n_default_locale,
            tuple((code, LocaleRegistry.fallback_chain(code)[1:]) for code in LocaleRegistry.enabled_locales()),
            json.dumps(
                {'locales': LOCALES, 'source': I18nConfig.SOURCE_LOCALE, 'languageFallbacks': LANGUAGE_FALLBACKS},
                sort_keys=True,
                ensure_ascii=True,
            ),
        )

    @staticmethod
    def plugin_domain(plugin_id: str) -> str:
        """
        校验插件标识并生成独立的插件词库域

        :param plugin_id: 插件标识
        :return: plugin.<id> 格式的词库域
        """
        if not isinstance(plugin_id, str) or not re.fullmatch(r'[a-z][a-z0-9_-]{0,63}', plugin_id):
            raise ValueError('Invalid plugin catalog owner')
        return f'plugin.{plugin_id}'

    @classmethod
    def plugin_spec(cls, plugin_id: str, plugin_root: Path) -> CatalogSpec | None:
        """
        读取已验证插件目录中的 i18n/locale-meta.json 声明

        :param plugin_id: 插件标识
        :param plugin_root: 已验证的插件根目录
        :return: 插件词库配置，未提供词库资源时返回 None
        """
        domain = cls.plugin_domain(plugin_id)
        trusted_root = Path(plugin_root).resolve()
        metadata = trusted_root / 'i18n' / 'locale-meta.json'
        root = (trusted_root / 'i18n' / 'catalogs').resolve()
        if not metadata.exists() and not root.exists():
            return None
        if not root.is_relative_to(trusted_root) or not metadata.resolve().is_relative_to(trusted_root):
            raise ValueError('Plugin catalogs escape the verified plugin root')
        meta = json.loads(metadata.read_text(encoding='utf-8'))
        entries = meta['locales']
        default = meta['defaultLocale']
        fallbacks = tuple((entry['code'], tuple(entry.get('fallback', ()))) for entry in entries)
        spec = CatalogSpec(domain, root, default, fallbacks)
        if not fallbacks or len(set(spec.locales)) != len(spec.locales):
            raise ValueError('Empty or duplicate plugin catalog locales')
        for code in spec.locales:
            if LocaleRegistry.normalize_locale(code) != code:
                raise ValueError('Noncanonical plugin catalog locale')
            spec.chain(code)
        return spec

    @staticmethod
    def load(spec: CatalogSpec) -> CatalogSnapshot:
        """
        校验并加载 MO 资源，不使用 gettext 的全局路径缓存

        :param spec: 受信词库配置
        :return: 已加载的词库快照
        """
        digest = hashlib.sha256()
        digest.update(
            json.dumps([spec.domain, spec.default_locale, spec.fallbacks, spec.policy], ensure_ascii=True).encode()
        )
        translations = {}
        for code in spec.locales:
            payload = spec.path(code, '.mo').read_bytes()
            translations[code] = CatalogRegistry.parse(payload)
            digest.update(code.encode())
            digest.update(hashlib.sha256(payload).digest())
        return CatalogSnapshot(spec, translations, digest.hexdigest())

    @staticmethod
    def parse(payload: bytes) -> gettext.GNUTranslations:
        """
        解析 MO 资源，将二进制或复数规则异常统一转换为词库错误

        :param payload: MO 资源内容
        :return: gettext 翻译对象
        """
        try:
            return gettext.GNUTranslations(io.BytesIO(payload))
        except (OSError, ValueError, struct.error) as exc:
            raise ValueError('Invalid compiled gettext catalog') from exc

    @classmethod
    def install(cls, snapshot: CatalogSnapshot) -> None:
        """
        提交已验证的快照，整体替换当前词库域

        :param snapshot: 已验证的词库快照
        :return: None
        """
        with cls._lock:
            cls._snapshots = {**cls._snapshots, snapshot.spec.domain: snapshot}
            cls._fingerprint = None

    @classmethod
    def register_plugin(cls, plugin_id: str, plugin_root: Path) -> None:
        """
        加载插件发布资源，无声明时清除上一版本遗留的词库域

        :param plugin_id: 插件标识
        :param plugin_root: 已验证的插件根目录
        :return: None
        """
        cls.commit_plugin(plugin_id, cls.prepare_plugin(plugin_id, plugin_root))

    @classmethod
    def prepare_plugin(cls, plugin_id: str, plugin_root: Path) -> CatalogSnapshot | None:
        """
        在安装写入前验证新资源，保留当前已激活版本

        :param plugin_id: 插件标识
        :param plugin_root: 已验证的插件根目录
        :return: 待提交的词库快照，无词库资源时返回 None
        """
        spec = cls.plugin_spec(plugin_id, plugin_root)
        return None if spec is None else cls.load(spec)

    @classmethod
    def commit_plugin(cls, plugin_id: str, snapshot: CatalogSnapshot | None, *, enabled: bool = True) -> None:
        """
        生命周期持久化成功后提交资源，禁用或无资源时清除旧词库域

        :param plugin_id: 插件标识
        :param snapshot: 待提交的词库快照
        :param enabled: 插件是否启用
        :return: None
        """
        if snapshot is None or not enabled:
            cls.unregister_plugin(plugin_id)
        else:
            if snapshot.spec.domain != cls.plugin_domain(plugin_id):
                raise ValueError('Plugin catalog ownership mismatch')
            cls.install(snapshot)

    @classmethod
    def unregister_plugin(cls, plugin_id: str) -> None:
        """
        移除当前插件的词库资源并清除发布指纹缓存

        :param plugin_id: 插件标识
        :return: None
        """
        domain = cls.plugin_domain(plugin_id)
        with cls._lock:
            cls._snapshots = {key: value for key, value in cls._snapshots.items() if key != domain}
            cls._fingerprint = None

    @classmethod
    def refresh(cls, domain: str | None = None) -> None:
        """
        重新加载发布产物，失败时保留旧快照和指纹

        :param domain: 需要刷新的词库域，未指定时刷新全部已注册域
        :return: None
        """
        with cls._lock:
            specs = {key: snapshot.spec for key, snapshot in cls._snapshots.items()}
            specs['core'] = cls.core_spec()
            if domain is not None:
                specs = {domain: specs[domain]}
            replacements = {key: cls.load(spec) for key, spec in specs.items()}
            cls._snapshots = {**cls._snapshots, **replacements}
            cls._fingerprint = None

    @classmethod
    def snapshot(cls, domain: str = 'core') -> CatalogSnapshot:
        """
        获取已注册词库域的快照

        :param domain: 已注册的词库域
        :return: 当前词库快照
        """
        with cls._lock:
            if domain == 'core' and domain not in cls._snapshots:
                cls.refresh('core')
            return cls._snapshots[domain]

    @classmethod
    def specs(cls) -> tuple[CatalogSpec, ...]:
        """
        获取核心域和已注册插件域的词库配置

        :return: 供编译工具使用的词库配置
        """
        with cls._lock:
            return (cls.core_spec(), *(value.spec for key, value in cls._snapshots.items() if key != 'core'))

    @classmethod
    def fingerprint(cls) -> str:
        """
        从内存获取词库内容和域配置的发布指纹

        :return: 用于响应缓存隔离的词库指纹
        """
        with cls._lock:
            cls.snapshot('core')
            if cls._fingerprint is None:
                material = sorted((key, value.fingerprint) for key, value in cls._snapshots.items())
                cls._fingerprint = hashlib.sha256(json.dumps(material).encode()).hexdigest()
            return cls._fingerprint
