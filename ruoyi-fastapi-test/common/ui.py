import re


def button_name(label: str) -> re.Pattern[str]:
    """保留 Vue 字体图标前缀，同时兼容 Ant Design 双字按钮插入的空格。"""
    text = r'\s*'.join(re.escape(character) for character in label)
    return re.compile(rf'{text}\s*$')
