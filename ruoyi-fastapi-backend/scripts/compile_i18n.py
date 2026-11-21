import argparse
import io
import sys
from pathlib import Path
from uuid import uuid4

from babel.messages.catalog import Catalog
from babel.messages.mofile import write_mo
from babel.messages.pofile import PoFileError, read_po

if __name__ == '__main__':
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from i18n.catalogs import CatalogRegistry, CatalogSpec
from plugins.core.discovery.scanner import PluginScanner
from plugins.core.environment import PLUGIN_RUNTIME_ENVIRONMENT

SOURCE_PLUGINS = Path(PLUGIN_RUNTIME_ENVIRONMENT.get_backend_plugins_dir()).resolve()
CoreModuleKeys = dict[str, set[tuple[str | None, str | tuple[str, str]]]]


def _read_catalog(path: Path, code: str) -> Catalog:
    """读取 PO 源文件，拒绝未审校、缺失和格式错误的译文。"""
    try:
        with path.open('rb') as source:
            catalog = read_po(source, locale=code.replace('-', '_'), abort_invalid=True)
    except PoFileError as exc:
        raise ValueError(f'{path}: {exc}') from exc
    failures = list(catalog.check())
    for message in catalog:
        if message.id:
            values = message.string if isinstance(message.string, (list, tuple)) else (message.string,)
            if message.fuzzy or not all(values):
                failures.append((message, ['Unreviewed or empty translation']))
    if failures:
        raise ValueError(f'{path}: {failures}')
    return catalog


def _read_core_modules(spec: CatalogSpec, code: str) -> tuple[Catalog, CoreModuleKeys]:
    """按文件名合并核心词库，并记录各模块的消息标识、上下文和复数标识。"""
    directory = (spec.root / code / 'LC_MESSAGES' / 'core').resolve()
    if not directory.is_relative_to(spec.root):
        raise ValueError(f'Core catalog directory escapes its root: {directory}')
    merged = None
    modules: CoreModuleKeys = {}
    for path in sorted(directory.glob('*.po')):
        if not path.resolve().is_relative_to(directory):
            raise ValueError(f'Core catalog source escapes its directory: {path}')
        catalog = _read_catalog(path, code)
        if catalog.locale_identifier != code.replace('-', '_'):
            raise ValueError(f'{path}: expected language {code}, found {catalog.locale_identifier}')
        if merged is not None and catalog.plural_forms != merged.plural_forms:
            raise ValueError(f'{path}: inconsistent Plural-Forms for {code}')
        keys = set()
        for message in catalog:
            if not message.id:
                continue
            keys.add((message.context, message.id))
            if merged is not None:
                if merged.get(message.id, message.context) is not None:
                    raise ValueError(f'{path}: duplicate core msgid {message.id!r} (context {message.context!r})')
                merged[message.id] = message
        modules[path.name] = keys
        if merged is None:
            merged = catalog
    if merged is None:
        raise ValueError(f'No core PO modules found in {directory}')
    return merged, modules


def _compile_specs(specs: tuple[CatalogSpec, ...]) -> None:
    """
    校验已注册词库的复数项和审校状态，并生成 MO 文件

    :param specs: 本次编译的受信词库配置
    :return: None
    """
    compiled = []
    for spec in specs:
        source_modules = None
        for code in spec.locales:
            if spec.domain == 'core':
                catalog, modules = _read_core_modules(spec, code)
                if source_modules is None:
                    source_modules = modules
                if missing := sorted(source_modules.keys() ^ modules.keys()):
                    raise ValueError(
                        f'Inconsistent core modules for {spec.locales[0]} and {code}: {", ".join(missing)}'
                    )
                for name, keys in modules.items():
                    if difference := keys ^ source_modules[name]:
                        raise ValueError(f'{code}/{name}: inconsistent core msgids: {difference!r}')
            else:
                catalog = _read_catalog(spec.path(code, '.po'), code)
            output = io.BytesIO()
            write_mo(output, catalog, use_fuzzy=False)
            compiled.append((spec.path(code, '.mo'), output.getvalue()))
            print(f'Compiled {spec.domain}/{code}: {len(catalog)} messages')
    # 全部源资源校验通过后原子替换 MO 文件，避免读取未写完的资源。
    for path, payload in compiled:
        if path.is_file() and path.read_bytes() == payload:
            continue
        temporary = path.with_suffix(f'.{uuid4().hex}.tmp')
        try:
            temporary.write_bytes(payload)
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)


def compile_catalogs(extra_specs: tuple[CatalogSpec, ...] = (), *, isolate_plugin_errors: bool = False) -> None:
    """
    编译核心与源码插件词库，插件域由启停流程注册

    :param extra_specs: 构建时显式指定的受信词库配置
    :param isolate_plugin_errors: 应用启动时单独报告源码插件错误，仍可启动宿主
    :return: None
    """
    active = CatalogRegistry.specs()
    specs = {spec.domain: spec for spec in (*active, *extra_specs)}
    _compile_specs(tuple(specs.values()))
    for spec in active:
        CatalogRegistry.install(CatalogRegistry.load(spec))
    scanner = PluginScanner(SOURCE_PLUGINS)
    plugins = scanner.discover_with_errors().plugins if isolate_plugin_errors else scanner.discover()
    for plugin in plugins:
        plugin_id = plugin.manifest.id
        if CatalogRegistry.plugin_domain(plugin_id) in specs:
            continue
        try:
            if not plugin.backend_path.resolve().is_relative_to(SOURCE_PLUGINS):
                raise ValueError('Plugin source escapes the project plugins directory')
            spec = CatalogRegistry.plugin_spec(plugin_id, plugin.backend_path)
            if spec is not None:
                if any(spec.path(code, '.po').is_file() for code in spec.locales):
                    _compile_specs((spec,))
                else:
                    # 插件可能只随包交付 MO，此时只校验资源，启用时再注册。
                    CatalogRegistry.load(spec)
        except (OSError, ValueError, TypeError, KeyError) as exc:
            if not isolate_plugin_errors:
                raise
            print(f'Unable to compile catalogs for plugin {plugin_id}: {exc}', file=sys.stderr)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compile registered gettext domains')
    parser.add_argument(
        '--plugin', action='append', default=[], metavar='ID=ROOT', help='Trusted plugin build directory'
    )
    args = parser.parse_args()
    plugin_specs = []
    for declaration in args.plugin:
        plugin_id, separator, root = declaration.partition('=')
        if not separator:
            parser.error('--plugin requires ID=ROOT')
        spec = CatalogRegistry.plugin_spec(plugin_id, Path(root))
        if spec is None:
            parser.error(f'Plugin {plugin_id} does not declare catalogs')
        plugin_specs.append(spec)
    compile_catalogs(tuple(plugin_specs))
