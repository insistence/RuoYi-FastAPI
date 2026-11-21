def validate_plural(count: int | None, plural_key: str | None) -> None:
    """
    校验复数数量与消息标识成对提供，且数量为非负整数

    :param count: 复数消息数量
    :param plural_key: 复数消息标识
    :return: None
    """
    if (count is None) != (plural_key is None):
        raise ValueError('count and plural_key must be provided together')
    if count is not None and (type(count) is not int or count < 0 or not isinstance(plural_key, str) or not plural_key):
        raise ValueError('Plural messages require a nonnegative integer count and a plural_key')


class I18nMessage(str):
    """
    保存原文和消息标识，在响应阶段按请求语言翻译
    """

    msg_key: str
    msg_params: dict | None
    domain: str
    count: int | None
    plural_key: str | None

    def __new__(
        cls,
        message: str,
        *,
        msg_key: str,
        msg_params: dict | None = None,
        domain: str = 'core',
        count: int | None = None,
        plural_key: str | None = None,
    ) -> 'I18nMessage':
        """
        构造带国际化元数据的原文，不在模块加载时读取语言上下文

        :param message: 写入日志或异常的消息原文
        :param msg_key: 完整消息标识
        :param msg_params: 消息插值参数
        :param domain: 已注册的词库域
        :param count: 与 plural_key 成对提供的非负整数
        :param plural_key: 复数消息标识
        :return: 带国际化元数据的字符串
        """
        validate_plural(count, plural_key)
        instance = super().__new__(cls, message)
        instance.msg_key = msg_key
        instance.msg_params = dict(msg_params) if msg_params is not None else None
        instance.domain = domain
        instance.count = count
        instance.plural_key = plural_key
        return instance

    def __getnewargs_ex__(self) -> tuple[tuple[str], dict]:
        """
        复制或序列化时保留消息元数据

        :return: 重建消息所需的构造参数
        """
        return (str(self),), {
            'msg_key': self.msg_key,
            'msg_params': self.msg_params,
            'domain': self.domain,
            'count': self.count,
            'plural_key': self.plural_key,
        }
