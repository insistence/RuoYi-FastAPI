class I18nMessage(str):
    """
    保存原文和消息标识，在响应阶段按请求语言翻译
    """

    msg_key: str
    msg_params: dict | None

    def __new__(cls, message: str, *, msg_key: str, msg_params: dict | None = None) -> 'I18nMessage':
        """
        构造带国际化元数据的原文，不在模块加载时读取语言上下文

        :param message: 旧客户端和日志使用的原文
        :param msg_key: 完整消息标识
        :param msg_params: 消息插值参数
        :return: 带国际化元数据的字符串
        """
        instance = super().__new__(cls, message)
        instance.msg_key = msg_key
        instance.msg_params = dict(msg_params) if msg_params is not None else None
        return instance

    def __getnewargs_ex__(self) -> tuple[tuple[str], dict]:
        """
        复制或序列化时保留消息元数据

        :return: 重建消息所需的构造参数
        """
        return (str(self),), {'msg_key': self.msg_key, 'msg_params': self.msg_params}
