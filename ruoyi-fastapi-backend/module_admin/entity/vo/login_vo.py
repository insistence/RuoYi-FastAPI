import re

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

from exceptions.exception import ModelValidatorException
from module_admin.entity.vo.menu_vo import MenuModel


class UserLogin(BaseModel):
    """用户登录所需的凭据和验证信息。"""

    model_config = ConfigDict(alias_generator=to_camel)

    user_name: str = Field(description='用户名称')
    password: str = Field(description='用户密码')
    code: str | None = Field(default=None, description='验证码')
    uuid: str | None = Field(default=None, description='会话编号')
    login_info: dict | None = Field(default=None, description='登录信息，前端无需传递')
    captcha_enabled: bool | None = Field(default=None, description='是否启用验证码，前端无需传递')


class UnlockScreenModel(BaseModel):
    """用于验证锁屏解锁请求的凭据。"""

    model_config = ConfigDict(alias_generator=to_camel)

    password: str | None = Field(default=None, description='用户密码')


class UserRegister(BaseModel):
    """注册新用户时提交的账户资料。"""

    model_config = ConfigDict(alias_generator=to_camel)

    username: str = Field(description='用户名称')
    password: str = Field(description='用户密码')
    confirm_password: str = Field(description='用户二次确认密码')
    code: str | None = Field(default=None, description='验证码')
    uuid: str | None = Field(default=None, description='会话编号')

    @model_validator(mode='after')
    def check_password(self) -> 'UserRegister':
        """
        校验密码中是否包含禁止使用的字符。

        :return: 当前实例
        :raises ModelValidatorException: 密码中含有禁止使用的字符
        """
        pattern = r"""^[^<>"'|\\]+$"""
        if self.password is None or re.match(pattern, self.password):
            return self
        raise ModelValidatorException(message='密码不能包含非法字符：< > " \' \\ |', msg_key='auth.passwordCharacters')


class Token(BaseModel):
    """OAuth 登录令牌响应。"""

    access_token: str = Field(description='token信息')
    token_type: str = Field(description='token类型')


class LoginToken(BaseModel):
    """用户登录成功后签发的令牌。"""

    model_config = ConfigDict(alias_generator=to_camel)

    token: str = Field(description='token信息')


class CaptchaCode(BaseModel):
    """图形验证码响应。"""

    model_config = ConfigDict(alias_generator=to_camel)

    captcha_enabled: bool = Field(description='是否启用验证码')
    register_enabled: bool = Field(description='是否启用注册')
    img: str = Field(description='验证码图片')
    uuid: str = Field(description='会话编号')


class SmsCode(BaseModel):
    """短信验证码及其发送结果。"""

    is_success: bool | None = Field(default=None, description='操作是否成功')
    sms_code: str = Field(description='短信验证码')
    session_id: str = Field(description='会话编号')
    message: str | None = Field(default=None, description='响应信息')


class MenuTreeModel(MenuModel):
    """表示菜单树中的可选节点。"""

    children: list['MenuTreeModel'] | None | None = Field(default=None, description='子菜单')


class MetaModel(BaseModel):
    """描述前端路由的展示及缓存选项。"""

    model_config = ConfigDict(alias_generator=to_camel)

    title: str | None = Field(default=None, description='设置路由在侧边栏和面包屑中展示的名字')
    title_i18n: dict[str, str] = Field(default_factory=dict, alias='titleI18n', description='路由标题译文')
    icon: str | None = Field(default=None, description='设置路由的图标')
    no_cache: bool | None = Field(default=None, description='设置为true，则不会被 <keep-alive>缓存')
    link: str | None = Field(default=None, description='内链地址（http(s)://开头）')
    plugin_id: str | None = Field(default=None, description='由平台菜单归属确定的插件ID')


class RouterModel(BaseModel):
    """描述用户可访问的前端路由及其子路由。"""

    model_config = ConfigDict(alias_generator=to_camel)

    name: str | None = Field(default=None, description='路由名称')
    path: str | None = Field(default=None, description='路由地址')
    hidden: bool | None = Field(default=None, description='是否隐藏路由，当设置 true 的时候该路由不会再侧边栏出现')
    redirect: str | None = Field(
        default=None, description='重定向地址，当设置 noRedirect 的时候该路由在面包屑导航中不可被点击'
    )
    component: str | None = Field(default=None, description='组件地址')
    query: str | None = Field(default=None, description='路由参数：如 {"id": 1, "name": "ry"}')
    always_show: bool | None = Field(
        default=None, description='当你一个路由下面的children声明的路由大于1个时，自动会变成嵌套的模式--如组件页面'
    )
    meta: MetaModel | None = Field(default=None, description='其他元素')
    children: list['RouterModel'] | None | None = Field(default=None, description='子路由')
