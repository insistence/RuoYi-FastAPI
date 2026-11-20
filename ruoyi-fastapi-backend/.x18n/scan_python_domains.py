"""
使用标准库 AST 为 x18n 扫描消息调用，不导入或执行应用代码
"""

import ast
import json
import sys


def scan(source: dict) -> dict:
    """
    提取静态消息标识和显式 domain，位置使用 JavaScript UTF-16 偏移

    :param source: 包含源码路径和文本的扫描输入
    :return: 源码路径及消息调用信息
    """
    text = source['text']
    tree = ast.parse(text, filename=source['path'])
    constants = {
        node.targets[0].id: node.value.value
        for node in tree.body
        if isinstance(node, ast.Assign)
        and len(node.targets) == 1
        and isinstance(node.targets[0], ast.Name)
        and isinstance(node.value, ast.Constant)
        and isinstance(node.value.value, str)
    }
    lines = text.splitlines(keepends=True)
    offsets = []
    total = 0
    for line in lines:
        offsets.append(total)
        total += len(line.encode('utf-16-le')) // 2

    def position(line: int, column: int) -> int:
        """
        将 Python AST 的 UTF-8 字节位置转换为 JavaScript UTF-16 偏移

        :param line: 从 1 开始的源码行号
        :param column: 从 0 开始的 UTF-8 字节列偏移
        :return: 从源码开头计算的 UTF-16 偏移
        """
        prefix = lines[line - 1].encode('utf-8')[:column].decode('utf-8')
        return offsets[line - 1] + len(prefix.encode('utf-16-le')) // 2

    usages = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        options = {option.arg: option.value for option in node.keywords if option.arg is not None}
        direct = isinstance(node.func, ast.Name) and node.func.id in ('t', '_', 'gettext', 'ngettext')
        translate = (
            isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == 'I18nUtil'
            and node.func.attr == 'translate'
        )
        key = options.get('msg_key')
        if key is None and (direct or translate) and node.args:
            key = node.args[0]
        if not isinstance(key, ast.Constant) or not isinstance(key.value, str):
            continue
        domain = options.get('domain', ast.Constant(value='core'))
        if isinstance(domain, ast.Name) and domain.id in constants:
            domain = ast.Constant(value=constants[domain.id])
        if not isinstance(domain, ast.Constant) or not isinstance(domain.value, str):
            raise ValueError(
                f'{source["path"]}:{node.lineno}: static message requires a literal or module constant domain'
            )
        usages.append(
            {
                'domain': domain.value,
                'raw': key.value,
                'range': {
                    'start': position(key.lineno, key.col_offset),
                    'end': position(key.end_lineno, key.end_col_offset),
                },
                'kind': 'call',
                'dynamic': False,
            }
        )
    return {'path': source['path'], 'usages': usages}


if __name__ == '__main__':
    print(
        json.dumps([scan(source) for source in json.loads(sys.stdin.buffer.read().decode('utf-8'))], ensure_ascii=True)
    )
