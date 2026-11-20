import argparse
import io
import sys
from pathlib import Path

from babel.messages.mofile import write_mo
from babel.messages.pofile import read_po

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from i18n.catalogs import CatalogRegistry, CatalogSpec  # noqa: E402


def compile_catalogs(extra_specs: tuple[CatalogSpec, ...] = ()) -> None:
    """
    校验已注册词库的复数项和审校状态，并生成 MO 文件

    :param extra_specs: 本次编译额外提供的受信词库配置
    :return: None
    """
    specs = {spec.domain: spec for spec in (*CatalogRegistry.specs(), *extra_specs)}
    compiled = []
    for spec in specs.values():
        for code in spec.locales:
            path = spec.path(code, '.po')
            with path.open('rb') as source:
                catalog = read_po(source, locale=code.replace('-', '_'))
            failures = list(catalog.check())
            for message in catalog:
                if not message.id:
                    continue
                values = message.string if isinstance(message.string, (list, tuple)) else (message.string,)
                if message.fuzzy or not all(values):
                    failures.append((message, ['Unreviewed or empty translation']))
            if failures:
                raise ValueError(f'{path}: {failures}')
            output = io.BytesIO()
            write_mo(output, catalog, use_fuzzy=False)
            compiled.append((spec.path(code, '.mo'), output.getvalue()))
            print(f'Compiled {spec.domain}/{code}: {len(catalog)} messages')
    # 全部源资源校验通过后原子替换 MO 文件，避免读取未写完的资源。
    for path, payload in compiled:
        temporary = path.with_suffix('.mo.tmp')
        temporary.write_bytes(payload)
        temporary.replace(path)
    for spec in specs.values():
        CatalogRegistry.install(CatalogRegistry.load(spec))


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
