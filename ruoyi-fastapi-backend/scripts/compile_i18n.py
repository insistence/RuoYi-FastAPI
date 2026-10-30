import sys
from pathlib import Path

from babel.messages.mofile import write_mo
from babel.messages.pofile import read_po

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from i18n.registry import LOCALES  # noqa: E402


def compile_catalogs() -> None:
    """
    校验已注册词库的复数项和审校状态，并生成 MO 文件
    """
    for code in LOCALES:
        path = ROOT / 'i18n' / 'catalogs' / code / 'LC_MESSAGES' / 'core.po'
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
        with path.with_suffix('.mo').open('wb') as output:
            write_mo(output, catalog, use_fuzzy=False)
        print(f'Compiled {code}: {len(catalog)} messages')


if __name__ == '__main__':
    compile_catalogs()
