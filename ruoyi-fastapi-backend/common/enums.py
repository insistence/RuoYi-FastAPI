from enum import Enum, StrEnum


class HttpMethod(StrEnum):
    """
    HTTP请求方法枚举。

    :cvar GET: 获取资源
    :cvar POST: 创建资源
    :cvar PUT: 整体更新资源
    :cvar DELETE: 删除资源
    :cvar PATCH: 局部更新资源
    :cvar HEAD: 获取响应头
    :cvar OPTIONS: 获取允许的方法信息
    :cvar TRACE: 回显诊断请求
    :cvar CONNECT: 建立隧道连接
    """

    GET = 'GET'
    POST = 'POST'
    PUT = 'PUT'
    DELETE = 'DELETE'
    PATCH = 'PATCH'
    HEAD = 'HEAD'
    OPTIONS = 'OPTIONS'
    TRACE = 'TRACE'
    CONNECT = 'CONNECT'


class BusinessType(Enum):
    """
    业务操作类型。

    :cvar OTHER: 其它
    :cvar INSERT: 新增
    :cvar UPDATE: 修改
    :cvar DELETE: 删除
    :cvar GRANT: 授权
    :cvar EXPORT: 导出
    :cvar IMPORT: 导入
    :cvar FORCE: 强退
    :cvar GENCODE: 生成代码
    :cvar CLEAN: 清空数据
    """

    OTHER = 0
    INSERT = 1
    UPDATE = 2
    DELETE = 3
    GRANT = 4
    EXPORT = 5
    IMPORT = 6
    FORCE = 7
    GENCODE = 8
    CLEAN = 9


class PasswordCharacterType(Enum):
    """
    密码字符范围类型。

    :cvar DEFAULT: 密码不能包含非法字符：< > " ' / |
    :cvar NUMBER: 密码只能为数字（0-9）
    :cvar LETTER: 密码只能为英文字母（a-z、A-Z）
    :cvar LETTER_NUMBER: 密码必须同时包含字母和数字
    :cvar LETTER_NUMBER_SPECIAL: 密码必须同时包含字母、数字和特殊字符（~!@#$%^&*()-=_+）
    :ivar code: 密码字符范围配置值
    :ivar pattern: 用于验证输入的正则表达式
    :ivar message: 与当前结果一起返回的说明
    """

    def __init__(self, code: str, pattern: str, message: str) -> None:
        """
        保存密码字符类别的编码、匹配表达式和提示。

        :param code: 密码字符范围配置值
        :param pattern: 用于验证输入的正则表达式
        :param message: 与当前结果一起返回的说明
        """
        self.code = code
        self.pattern = pattern
        self.message = message

    @classmethod
    def from_code(cls, code: str | bytes | None) -> 'PasswordCharacterType':
        """
        根据配置值获取密码字符范围类型。

        :param code: 密码字符范围配置值
        :return: 密码字符范围类型
        """
        if isinstance(code, bytes):
            code = code.decode()

        return next((item for item in cls if item.code == code), cls.DEFAULT)

    DEFAULT = ('0', r"""^[^<>"'|\\]+$""", '密码不能包含非法字符：< > " \' \\ |')
    NUMBER = ('1', r'^[0-9]+$', '密码只能为数字（0-9）')
    LETTER = ('2', r'^[a-zA-Z]+$', '密码只能为英文字母（a-z、A-Z）')
    LETTER_NUMBER = ('3', r'^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9]+$', '密码必须同时包含字母和数字')
    LETTER_NUMBER_SPECIAL = (
        '4',
        r'^(?=.*[A-Za-z])(?=.*\d)(?=.*[~!@#$%^&*()\-=_+])[A-Za-z\d~!@#$%^&*()\-=_+]+$',
        '密码必须同时包含字母、数字和特殊字符（~!@#$%^&*()-=_+）',
    )


class RedisInitKeyConfig(Enum):
    """
    系统内置Redis键名。

    :cvar ACCESS_TOKEN: 登录令牌信息
    :cvar SYS_DICT: 数据字典
    :cvar SYS_CONFIG: 配置信息
    :cvar API_CACHE: 接口响应缓存
    :cvar API_RATE_LIMIT: 接口限流
    :cvar CAPTCHA_CODES: 图片验证码
    :cvar ACCOUNT_LOCK: 用户锁定
    :cvar PASSWORD_ERROR_COUNT: 密码错误次数
    :cvar SMS_CODE: 短信验证码
    """

    @property
    def key(self) -> str | None:
        """
        返回初始化配置对应的 Redis 键。

        :return: 初始化配置对应的 Redis 键
        """
        return self.value.get('key')

    @property
    def remark(self) -> str | None:
        """
        返回 Redis 初始化配置的用途说明。

        :return: Redis 初始化配置的用途说明
        """
        return self.value.get('remark')

    ACCESS_TOKEN = {'key': 'access_token', 'remark': '登录令牌信息'}
    SYS_DICT = {'key': 'sys_dict', 'remark': '数据字典'}
    SYS_CONFIG = {'key': 'sys_config', 'remark': '配置信息'}
    API_CACHE = {'key': 'api_cache', 'remark': '接口响应缓存'}
    API_RATE_LIMIT = {'key': 'api_rate_limit', 'remark': '接口限流'}
    CAPTCHA_CODES = {'key': 'captcha_codes', 'remark': '图片验证码'}
    ACCOUNT_LOCK = {'key': 'account_lock', 'remark': '用户锁定'}
    PASSWORD_ERROR_COUNT = {'key': 'password_error_count', 'remark': '密码错误次数'}
    SMS_CODE = {'key': 'sms_code', 'remark': '短信验证码'}
