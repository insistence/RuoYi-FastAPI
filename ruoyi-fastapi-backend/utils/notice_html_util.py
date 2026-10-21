import re
from urllib.parse import urlsplit

import nh3

# 公告只允许文档型富文本；仅保留文本样式，不接受表单或可执行内容，视频嵌入强制使用沙箱。
NOTICE_TAGS = {
    'p',
    'br',
    'div',
    'span',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'strike',
    'sub',
    'sup',
    'blockquote',
    'pre',
    'code',
    'ul',
    'ol',
    'li',
    'hr',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'a',
    'img',
    'iframe',
}
NOTICE_ATTRIBUTES = {
    '*': {'class', 'title', 'style'},
    'a': {'href'},
    'img': {'src', 'alt', 'width', 'height'},
    'iframe': {'src', 'width', 'height', 'frameborder', 'allowfullscreen'},
    'th': {'colspan', 'rowspan'},
    'td': {'colspan', 'rowspan'},
    'ol': {'start'},
}


def _filter_notice_attribute(tag: str, attribute: str, value: str) -> str | None:
    """
    限制富文本样式表达式和嵌入视频地址。

    :param tag: 标签名称
    :param attribute: 属性名称
    :param value: 已解析的属性值
    :return: 允许的属性值，不安全时返回 None
    """
    if attribute == 'style':
        # 不允许 CSS 转义、动态表达式及外部资源，仅保留静态文本格式。
        normalized = re.sub(r'/\*.*?\*/', '', value, flags=re.DOTALL)
        if re.search(r'(?:expression|url|var)\s*\(|[\\@]', normalized, re.IGNORECASE):
            return None
    if tag == 'iframe' and attribute == 'src':
        try:
            parsed = urlsplit(value)
            if parsed.scheme.lower() not in {'http', 'https'} or not parsed.netloc:
                return None
        except ValueError:
            return None
    return value


def sanitize_notice_html(content: str | bytes | None) -> str | None:
    """
    按公告富文本白名单清洗写入内容及历史数据。

    :param content: 原始公告正文，兼容数据库二进制内容
    :return: 清洗后的 HTML，未提供正文时返回 None
    """
    if content is None:
        return None
    if isinstance(content, bytes):
        content = content.decode('utf-8', errors='replace')
    return nh3.clean(
        content,
        tags=NOTICE_TAGS,
        attributes=NOTICE_ATTRIBUTES,
        attribute_filter=_filter_notice_attribute,
        set_tag_attribute_values={
            'iframe': {'sandbox': 'allow-scripts allow-presentation', 'referrerpolicy': 'no-referrer'},
        },
        filter_style_properties={'color', 'background-color', 'font-size', 'font-family', 'text-align'},
        url_schemes={'http', 'https', 'mailto'},
        clean_content_tags={'script', 'style', 'object', 'embed', 'svg', 'math'},
    )
