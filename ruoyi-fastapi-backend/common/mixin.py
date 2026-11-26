from datetime import date, datetime
from typing import TYPE_CHECKING, Any, ClassVar, cast

from pydantic import field_validator, model_validator
from sqlalchemy.orm import Mapped, declared_attr, mapped_column

from common.types import DbUtcDateTime
from utils.time_util import TimezoneUtil


class CreateTimeMixin:
    """
    创建时间字段混入类。

    :cvar __create_time_nullable__: 创建时间列是否允许空值
    :cvar __create_time_comment__: 创建时间列的数据库注释
    """

    __create_time_nullable__ = True
    __create_time_comment__ = '创建时间'

    @declared_attr
    def create_time(cls) -> Mapped[datetime | None]:  # noqa: N805
        """
        声明记录创建时间的 ORM 字段。

        :return: 创建时间的映射列
        """
        return cast(
            'Mapped[datetime | None]',
            mapped_column(
                DbUtcDateTime(),
                nullable=cls.__create_time_nullable__,
                default=TimezoneUtil.utc_now,
                comment=cls.__create_time_comment__,
            ),
        )


class UpdateTimeMixin:
    """
    更新时间字段混入类。

    :cvar __update_time_nullable__: 更新时间列是否允许空值
    :cvar __update_time_insert_default__: 新增记录时是否填充默认更新时间
    :cvar __update_time_comment__: 更新时间列的数据库注释
    """

    __update_time_nullable__ = True
    __update_time_insert_default__ = True
    __update_time_comment__ = '更新时间'

    @declared_attr
    def update_time(cls) -> Mapped[datetime | None]:  # noqa: N805
        """
        声明记录更新时间的 ORM 字段。

        :return: 更新时间的映射列
        """
        return cast(
            'Mapped[datetime | None]',
            mapped_column(
                DbUtcDateTime(),
                nullable=cls.__update_time_nullable__,
                default=TimezoneUtil.utc_now if cls.__update_time_insert_default__ else None,
                onupdate=TimezoneUtil.utc_now,
                comment=cls.__update_time_comment__,
            ),
        )


class AuditTimeMixin(CreateTimeMixin, UpdateTimeMixin):
    """创建和更新时间字段混入类。"""


class DateRangeQueryMixin:
    """
    业务时区日期范围查询混入类。

    :ivar begin_time: 查询起始日期
    :ivar end_time: 查询结束日期
    """

    if TYPE_CHECKING:
        begin_time: str | None
        end_time: str | None

    @field_validator('begin_time', 'end_time', mode='before', check_fields=False)
    @classmethod
    def validate_date_boundary(cls, value: Any) -> str | None:
        """
        校验日期查询边界并保留纯日期字符串协议。

        :param value: 待校验的输入值
        :return: YYYY-MM-DD字符串，空值返回None
        """
        if value is None or value == '':
            return None
        return TimezoneUtil.parse_business_date(value).isoformat()

    @model_validator(mode='after')
    def validate_date_range(self) -> 'DateRangeQueryMixin':
        """
        校验业务日期范围顺序和结束日期上限。

        :return: 校验通过的查询模型
        :raises ValueError: 结束日期不能早于开始日期；结束日期必须早于9999-12-31
        """
        begin, end = self.begin_time, self.end_time
        if begin and end and end < begin:
            raise ValueError('结束日期不能早于开始日期')
        if end == date.max.isoformat():
            raise ValueError('结束日期必须早于9999-12-31')
        return self


class InstantRangeQueryMixin:
    """
    RFC 3339 时刻范围查询混入类。

    :ivar begin_time: 带时区的查询起始时刻
    :ivar end_time: 带时区的查询结束时刻
    """

    if TYPE_CHECKING:
        begin_time: str | None
        end_time: str | None

    @field_validator('begin_time', 'end_time', mode='before', check_fields=False)
    @classmethod
    def validate_instant_boundary(cls, value: Any) -> str | None:
        """
        校验精确时刻查询边界并归一化为UTC。

        :param value: 待校验的输入值
        :return: 携带UTC偏移的毫秒精度字符串，空值返回None
        """
        if value is None or value == '':
            return None
        return TimezoneUtil.parse_rfc3339(value).isoformat(timespec='milliseconds')

    @model_validator(mode='after')
    def validate_instant_range(self) -> 'InstantRangeQueryMixin':
        """
        按真实时刻校验查询范围顺序。

        :return: 校验通过的查询模型
        :raises ValueError: 结束时间不能早于开始时间
        """
        begin, end = self.begin_time, self.end_time
        if begin and end and TimezoneUtil.parse_rfc3339(end) < TimezoneUtil.parse_rfc3339(begin):
            raise ValueError('结束时间不能早于开始时间')
        return self


class GeneratedTimeRangeQueryMixin:
    """
    代码生成器命名时间范围查询混入类。

    :cvar time_range_fields: 参与区间查询的字段及其时间语义
    """

    time_range_fields: ClassVar[dict[str, str]] = {}

    @model_validator(mode='after')
    def validate_generated_time_ranges(self) -> 'GeneratedTimeRangeQueryMixin':
        """
        校验生成模型中的命名时间范围。

        :return: 校验通过的查询模型
        :raises ValueError: 结束值早于开始值，或结束日期无法转换为开区间上界
        """
        for name, kind in self.time_range_fields.items():
            begin, end = getattr(self, f'begin_{name}'), getattr(self, f'end_{name}')
            if begin is not None and end is not None and end < begin:
                raise ValueError(f'{name}: 结束值不能早于开始值')
            if kind == 'instant' and end == date.max:
                raise ValueError(f'{name}: 结束日期必须早于9999-12-31')
        return self
