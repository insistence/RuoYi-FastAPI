from collections.abc import Sequence
from typing import Any

from sqlalchemy import and_, delete, func, select, true, update
from sqlalchemy.ext.asyncio import AsyncSession

from common.vo import PageModel
from i18n.translation import TranslationUtil
from module_admin.entity.do.dict_do import SysDictData, SysDictType
from module_admin.entity.vo.dict_vo import DictDataModel, DictDataPageQueryModel, DictTypeModel, DictTypePageQueryModel
from utils.page_util import PageUtil
from utils.time_util import TimezoneUtil


class DictTypeDao:
    """字典类型管理模块数据库操作层。"""

    @classmethod
    async def get_dict_type_detail_by_id(cls, db: AsyncSession, dict_id: int) -> SysDictType | None:
        """
        根据字典类型id获取字典类型详细信息。

        :param db: orm对象
        :param dict_id: 字典类型id
        :return: 字典类型信息对象
        """
        dict_type_info = (await db.execute(select(SysDictType).where(SysDictType.dict_id == dict_id))).scalars().first()

        return dict_type_info

    @classmethod
    async def get_dict_type_detail_by_info(cls, db: AsyncSession, dict_type: DictTypeModel) -> SysDictType | None:
        """
        根据字典类型参数获取字典类型信息。

        :param db: orm对象
        :param dict_type: 字典类型参数对象
        :return: 字典类型信息对象
        """
        dict_type_info = (
            (
                await db.execute(
                    select(SysDictType).where(
                        SysDictType.dict_type == dict_type.dict_type if dict_type.dict_type else true(),
                        SysDictType.dict_name == dict_type.dict_name if dict_type.dict_name else true(),
                    )
                )
            )
            .scalars()
            .first()
        )

        return dict_type_info

    @classmethod
    async def get_all_dict_type(cls, db: AsyncSession) -> list[Any]:
        """
        获取所有的字典类型信息。

        :param db: orm对象
        :return: 字典类型信息列表对象
        """
        dict_type_info = (await db.execute(select(SysDictType))).scalars().all()

        return list(dict_type_info)

    @classmethod
    async def get_dict_type_list(
        cls, db: AsyncSession, query_object: DictTypePageQueryModel, is_page: bool = False
    ) -> PageModel[dict[str, Any]] | list[dict[str, Any]]:
        """
        根据查询参数获取字典类型列表信息。

        :param db: orm对象
        :param query_object: 查询参数对象
        :param is_page: 是否开启分页
        :return: 字典类型列表信息对象
        """
        time_range = TimezoneUtil.local_date_strings_to_utc(
            query_object.begin_time, query_object.end_time, timezone_name=TimezoneUtil.get_request_timezone()
        )
        query = (
            select(SysDictType)
            .where(
                SysDictType.dict_name.like(f'%{query_object.dict_name}%') if query_object.dict_name else true(),
                SysDictType.dict_type.like(f'%{query_object.dict_type}%') if query_object.dict_type else true(),
                SysDictType.status == query_object.status if query_object.status else true(),
                SysDictType.create_time >= time_range[0] if time_range and time_range[0] is not None else true(),
                SysDictType.create_time < time_range[1] if time_range and time_range[1] is not None else true(),
            )
            .order_by(SysDictType.dict_id)
            .distinct()
        )
        dict_type_list: PageModel[dict[str, Any]] | list[dict[str, Any]] = await PageUtil.paginate(
            db, query, query_object.page_num, query_object.page_size, is_page
        )

        return dict_type_list

    @classmethod
    async def add_dict_type_dao(cls, db: AsyncSession, dict_type: DictTypeModel) -> SysDictType:
        """
        新增字典类型数据库操作。

        :param db: orm对象
        :param dict_type: 字典类型对象
        :return: 新增的字典类型记录
        """
        db_dict_type = SysDictType(**dict_type.model_dump(exclude={'create_time', 'update_time'}))
        db_dict_type.dict_name_i18n = TranslationUtil.merge(None, dict_type.dict_name_i18n)
        db.add(db_dict_type)
        await db.flush()

        return db_dict_type

    @classmethod
    async def edit_dict_type_dao(cls, db: AsyncSession, dict_type: dict[str, Any]) -> None:
        """
        编辑字典类型数据库操作。

        :param db: orm对象
        :param dict_type: 需要更新的字典类型字典
        """
        if 'dict_name_i18n' in dict_type:
            current = await db.scalar(
                select(SysDictType.dict_name_i18n).where(SysDictType.dict_id == dict_type['dict_id']).with_for_update()
            )
            dict_type = {**dict_type, 'dict_name_i18n': TranslationUtil.merge(current, dict_type['dict_name_i18n'])}
        await db.execute(
            update(SysDictType),
            [{key: value for key, value in dict_type.items() if key not in {'create_time', 'update_time'}}],
        )

    @classmethod
    async def delete_dict_type_dao(cls, db: AsyncSession, dict_type: DictTypeModel) -> None:
        """
        删除字典类型数据库操作。

        :param db: orm对象
        :param dict_type: 字典类型对象
        """
        await db.execute(delete(SysDictType).where(SysDictType.dict_id.in_([dict_type.dict_id])))


class DictDataDao:
    """字典数据管理模块数据库操作层。"""

    @classmethod
    async def get_dict_data_detail_by_id(cls, db: AsyncSession, dict_code: int) -> SysDictData | None:
        """
        根据字典数据id获取字典数据详细信息。

        :param db: orm对象
        :param dict_code: 字典数据id
        :return: 字典数据信息对象
        """
        dict_data_info = (
            (await db.execute(select(SysDictData).where(SysDictData.dict_code == dict_code))).scalars().first()
        )

        return dict_data_info

    @classmethod
    async def get_dict_data_detail_by_info(cls, db: AsyncSession, dict_data: DictDataModel) -> SysDictData | None:
        """
        根据字典数据参数获取字典数据信息。

        :param db: orm对象
        :param dict_data: 字典数据参数对象
        :return: 字典数据信息对象
        """
        dict_data_info = (
            (
                await db.execute(
                    select(SysDictData).where(
                        SysDictData.dict_type == dict_data.dict_type,
                        SysDictData.dict_label == dict_data.dict_label,
                        SysDictData.dict_value == dict_data.dict_value,
                    )
                )
            )
            .scalars()
            .first()
        )

        return dict_data_info

    @classmethod
    async def get_dict_data_list(
        cls, db: AsyncSession, query_object: DictDataPageQueryModel, is_page: bool = False
    ) -> PageModel[dict[str, Any]] | list[dict[str, Any]]:
        """
        根据查询参数获取字典数据列表信息。

        :param db: orm对象
        :param query_object: 查询参数对象
        :param is_page: 是否开启分页
        :return: 字典数据列表信息对象
        """
        query = (
            select(SysDictData)
            .where(
                SysDictData.dict_type == query_object.dict_type if query_object.dict_type else true(),
                SysDictData.dict_label.like(f'%{query_object.dict_label}%') if query_object.dict_label else true(),
                SysDictData.status == query_object.status if query_object.status else true(),
            )
            .order_by(SysDictData.dict_sort)
            .distinct()
        )
        dict_data_list: PageModel[dict[str, Any]] | list[dict[str, Any]] = await PageUtil.paginate(
            db, query, query_object.page_num, query_object.page_size, is_page
        )

        return dict_data_list

    @classmethod
    async def query_dict_data_list(cls, db: AsyncSession, dict_type: str) -> Sequence[SysDictData | None]:
        """
        查询启用字典类型及其启用的数据项。

        :param db: orm对象
        :param dict_type: 字典类型
        :return: 按排序值排列的数据项，启用类型无数据项时返回 [None]，未匹配类型时返回空列表
        """
        dict_data_list = (
            (
                await db.execute(
                    select(SysDictData)
                    .select_from(SysDictType)
                    .where(SysDictType.dict_type == dict_type if dict_type else true(), SysDictType.status == '0')
                    .join(
                        SysDictData,
                        and_(SysDictType.dict_type == SysDictData.dict_type, SysDictData.status == '0'),
                        isouter=True,
                    )
                    .order_by(SysDictData.dict_sort)
                    .distinct()
                )
            )
            .scalars()
            .all()
        )

        return dict_data_list

    @classmethod
    async def add_dict_data_dao(cls, db: AsyncSession, dict_data: DictDataModel) -> SysDictData:
        """
        新增字典数据数据库操作。

        :param db: orm对象
        :param dict_data: 字典数据对象
        :return: 新增的字典数据记录
        """
        db_data_type = SysDictData(**dict_data.model_dump(exclude={'create_time', 'update_time'}))
        db_data_type.dict_label_i18n = TranslationUtil.merge(None, dict_data.dict_label_i18n)
        db.add(db_data_type)
        await db.flush()

        return db_data_type

    @classmethod
    async def edit_dict_data_dao(cls, db: AsyncSession, dict_data: dict[str, Any]) -> None:
        """
        编辑字典数据数据库操作。

        :param db: orm对象
        :param dict_data: 需要更新的字典数据字典
        """
        if 'dict_label_i18n' in dict_data:
            current = await db.scalar(
                select(SysDictData.dict_label_i18n)
                .where(SysDictData.dict_code == dict_data['dict_code'])
                .with_for_update()
            )
            dict_data = {**dict_data, 'dict_label_i18n': TranslationUtil.merge(current, dict_data['dict_label_i18n'])}
        await db.execute(
            update(SysDictData),
            [{key: value for key, value in dict_data.items() if key not in {'create_time', 'update_time'}}],
        )

    @classmethod
    async def delete_dict_data_dao(cls, db: AsyncSession, dict_data: DictDataModel) -> None:
        """
        删除字典数据数据库操作。

        :param db: orm对象
        :param dict_data: 字典数据对象
        """
        await db.execute(delete(SysDictData).where(SysDictData.dict_code.in_([dict_data.dict_code])))

    @classmethod
    async def count_dict_data_dao(cls, db: AsyncSession, dict_type: str) -> int:
        """
        根据字典类型查询字典类型关联的字典数据数量。

        :param db: orm对象
        :param dict_type: 字典类型
        :return: 字典类型关联的字典数据数量
        """
        dict_data_count = (
            await db.execute(select(func.count('*')).select_from(SysDictData).where(SysDictData.dict_type == dict_type))
        ).scalar_one()

        return dict_data_count
