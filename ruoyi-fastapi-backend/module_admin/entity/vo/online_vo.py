from pydantic import Field

from common.mixin import DateRangeQueryMixin
from common.types import ApiUtcDateTime
from common.vo import CamelModel


class OnlineModel(CamelModel):
    """在线用户对应pydantic模型。"""

    token_id: str | None = Field(default=None, description='会话编号')
    user_name: str | None = Field(default=None, description='登录名称')
    dept_name: str | None = Field(default=None, description='所属部门')
    ipaddr: str | None = Field(default=None, description='主机')
    login_location: str | None = Field(default=None, description='登录地点')
    browser: str | None = Field(default=None, description='浏览器类型')
    os: str | None = Field(default=None, description='操作系统')
    login_time: ApiUtcDateTime | None = Field(default=None, description='登录时间')


class OnlineQueryModel(DateRangeQueryMixin, OnlineModel):
    """岗位管理不分页查询模型。"""

    begin_time: str | None = Field(default=None, description='开始时间')
    end_time: str | None = Field(default=None, description='结束时间')


class OnlinePageResponseModel(CamelModel):
    """在线用户分页响应模型。"""

    rows: list[OnlineModel] = Field(description='在线用户记录列表')
    total: int = Field(description='总记录数')


class DeleteOnlineModel(CamelModel):
    """强退在线用户模型。"""

    token_ids: str = Field(description='需要强退的会话编号')
