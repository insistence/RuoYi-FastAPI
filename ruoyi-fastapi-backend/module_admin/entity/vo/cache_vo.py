from typing import Any

from pydantic import Field

from common.vo import CamelModel


class CacheMonitorModel(CamelModel):
    """缓存监控信息对应pydantic模型。"""

    command_stats: list[dict[str, str]] | None = Field(default=[], description='命令统计')
    db_size: int | None = Field(default=None, description='Key数量')
    info: dict[str, object] | None = Field(default={}, description='Redis信息')


class CacheInfoModel(CamelModel):
    """缓存监控对象对应pydantic模型。"""

    cache_key: str | None = Field(default=None, description='缓存键名')
    cache_name: str | None = Field(default=None, description='缓存名称')
    cache_value: Any | None = Field(default=None, description='缓存内容')
    remark: str | None = Field(default=None, description='备注')
