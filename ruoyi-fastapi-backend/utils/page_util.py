import math
from typing import Any, Literal, TypeVar, overload

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from common.vo import PageModel
from config.database import Base
from utils.common_util import CamelCaseUtil

_Item = TypeVar('_Item')
_Entity = TypeVar('_Entity', bound=Base)
_JoinedEntity = TypeVar('_JoinedEntity', bound=Base)
_EntityPairs = list[list[dict[str, Any] | None]]
_Rows = list[dict[str, Any] | list[dict[Any, Any]]] | list[dict[str, Any]] | _EntityPairs


class PageUtil:
    """分页工具类。"""

    @classmethod
    def get_page_obj(cls, data_list: list[_Item], page_num: int, page_size: int) -> PageModel[_Item]:
        """
        输入数据列表data_list和分页信息，返回分页数据列表结果。

        :param data_list: 原始数据列表
        :param page_num: 当前页码
        :param page_size: 当前页面数据量
        :return: 分页数据对象
        """
        # 计算起始索引和结束索引
        start = (page_num - 1) * page_size
        end = page_num * page_size

        # 根据计算得到的起始索引和结束索引对数据列表进行切片
        paginated_data = data_list[start:end]
        has_next = math.ceil(len(data_list) / page_size) > page_num

        result: PageModel[_Item] = PageModel(
            rows=paginated_data, page_num=page_num, page_size=page_size, total=len(data_list), has_next=has_next
        )

        return result

    @classmethod
    @overload
    async def paginate(
        cls,
        db: AsyncSession,
        query: Select[*tuple[Any, ...]],
        page_num: int,
        page_size: int,
        is_page: Literal[True],
        *,
        as_mappings: Literal[True],
    ) -> PageModel[dict[str, Any]]: ...

    @classmethod
    @overload
    async def paginate(
        cls,
        db: AsyncSession,
        query: Select[_Entity, _JoinedEntity],
        page_num: int,
        page_size: int,
        is_page: Literal[True],
        *,
        as_mappings: Literal[False] = False,
    ) -> PageModel[list[dict[str, Any] | None]]: ...

    @classmethod
    @overload
    async def paginate(
        cls,
        db: AsyncSession,
        query: Select[_Entity],
        page_num: int,
        page_size: int,
        is_page: Literal[True],
        *,
        as_mappings: Literal[False] = False,
    ) -> PageModel[dict[str, Any]]: ...

    @classmethod
    @overload
    async def paginate(
        cls,
        db: AsyncSession,
        query: Select[*tuple[Any, ...]],
        page_num: int,
        page_size: int,
        is_page: Literal[True],
        *,
        as_mappings: bool = False,
    ) -> PageModel[Any]: ...

    @classmethod
    @overload
    async def paginate(
        cls,
        db: AsyncSession,
        query: Select[*tuple[Any, ...]],
        page_num: int,
        page_size: int,
        is_page: bool = False,
        *,
        as_mappings: Literal[True],
    ) -> PageModel[dict[str, Any]] | list[dict[str, Any]]: ...

    @classmethod
    @overload
    async def paginate(
        cls,
        db: AsyncSession,
        query: Select[_Entity, _JoinedEntity],
        page_num: int,
        page_size: int,
        is_page: bool = False,
    ) -> PageModel[list[dict[str, Any] | None]] | _EntityPairs: ...

    @classmethod
    @overload
    async def paginate(
        cls, db: AsyncSession, query: Select[_Entity], page_num: int, page_size: int, is_page: bool = False
    ) -> PageModel[dict[str, Any]] | list[dict[str, Any]]: ...

    @classmethod
    @overload
    async def paginate(
        cls, db: AsyncSession, query: Select[*tuple[Any, ...]], page_num: int, page_size: int, is_page: bool = False
    ) -> PageModel[Any] | _Rows: ...

    @classmethod
    async def paginate(
        cls,
        db: AsyncSession,
        query: Select[*tuple[Any, ...]],
        page_num: int,
        page_size: int,
        is_page: bool = False,
        *,
        as_mappings: bool = False,
    ) -> PageModel[Any] | _Rows:
        """
        输入查询语句和分页信息，返回分页数据列表结果。

        :param db: orm对象
        :param query: sqlalchemy查询语句
        :param page_num: 当前页码
        :param page_size: 当前页面数据量
        :param is_page: 是否开启分页
        :param as_mappings: 按投影列名返回字典，并将列名转换为小驼峰格式
        :return: 分页对象，关闭分页时返回全部结果行
        """
        if is_page:
            total = (await db.execute(select(func.count('*')).select_from(query.subquery()))).scalar_one()
            query = query.offset((page_num - 1) * page_size).limit(page_size)
        else:
            total = None
        result = await db.execute(query)
        if as_mappings:
            rows = [CamelCaseUtil.transform_result(dict(row)) for row in result.mappings()]
        else:
            rows = [CamelCaseUtil.transform_result(row[0] if len(row) == 1 else row) for row in result]
        if total is None:
            return rows
        return PageModel[Any](
            rows=rows,
            page_num=page_num,
            page_size=page_size,
            total=total,
            has_next=math.ceil(total / page_size) > page_num,
        )


def get_page_obj(data_list: list[_Item], page_num: int, page_size: int) -> PageModel[_Item]:
    """
    输入数据列表data_list和分页信息，返回分页数据列表结果。

    :param data_list: 原始数据列表
    :param page_num: 当前页码
    :param page_size: 当前页面数据量
    :return: 分页数据对象
    """
    return PageUtil.get_page_obj(data_list, page_num, page_size)
