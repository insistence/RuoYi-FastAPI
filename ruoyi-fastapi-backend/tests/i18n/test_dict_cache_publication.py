import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from redis.asyncio import Redis
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from module_admin.dao.dict_dao import DictDataDao, DictTypeDao
from module_admin.entity.do.dict_do import SysDictData, SysDictType
from module_admin.entity.vo.dict_vo import DeleteDictDataModel, DeleteDictTypeModel, DictDataModel, DictTypeModel
from module_admin.service.dict_service import DictDataService, DictTypeService
from tests.module_admin.service.helpers import make_redis_request
from tests.utils.test_current_user_cache_util import cache_redis, redis_socket  # noqa: F401

PUBLICATION_READS_WITH_ONE_CONFLICT = 3


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'latest',
    [
        [{'dictLabel': '红', 'dictLabelI18n': {'en-US': 'Red', 'fr-FR': 'Rouge'}}],
        [None],  # 类型已启用但没有有效条目
        [],  # 类型已删除或停用
    ],
)
async def test_late_dict_refresh_cannot_overwrite_a_newer_publication(
    cache_redis: Redis,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
    latest: list[dict[str, object] | None],
) -> None:
    """在旧查询读完后发布新值，确认重试使用新的数据库会话。"""
    rows: list[dict[str, object] | None] = [{'dictLabel': '红', 'dictLabelI18n': {'en-US': 'Red'}}]
    old_read = asyncio.Event()
    resume_refresh = asyncio.Event()
    read_sessions: list[AsyncSession] = []

    async def query(db: AsyncSession, name: str) -> list[dict[str, object] | None]:
        """
        模拟读取数据库快照并记录查询状态。

        :param db: 当前操作使用的数据库会话
        :param name: 用于查找或标识当前对象的名称
        :return: 用于比较状态的快照
        """
        assert name == 'colors'
        snapshot = rows.copy()
        read_sessions.append(db)
        if len(read_sessions) == 1:
            old_read.set()
            await resume_refresh.wait()
        return snapshot

    monkeypatch.setattr(DictDataDao, 'query_dict_data_list', query)
    monkeypatch.setattr(DictTypeDao, 'get_all_dict_type', AsyncMock(return_value=[SimpleNamespace(dict_type='colors')]))
    async with AsyncSession() as db:
        refresh = asyncio.create_task(DictDataService.init_cache_sys_dict_services(db, cache_redis))
        try:
            await asyncio.wait_for(old_read.wait(), timeout=3)
            rows = latest.copy()
            await DictDataService.publish_dict_cache(db, cache_redis, 'colors')
        finally:
            resume_refresh.set()
            await asyncio.wait_for(refresh, timeout=3)
    assert len(set(read_sessions)) == PUBLICATION_READS_WITH_ONE_CONFLICT
    assert await DictDataService.query_dict_data_list_from_cache_services(cache_redis, 'colors') == [
        row for row in latest if row
    ]
    assert bool(await cache_redis.exists('sys_dict:colors')) == bool(latest)


@pytest.mark.asyncio
async def test_cache_tracks_type_and_data_crud(cache_redis: Redis) -> None:  # noqa: F811
    """缓存跟踪字典类型和字典数据的增删改查。"""
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    request = make_redis_request(cache_redis)
    read = DictDataService.query_dict_data_list_from_cache_services
    try:
        async with engine.begin() as conn:
            await conn.run_sync(SysDictType.get_table().create)
            await conn.run_sync(SysDictData.get_table().create)
        async with AsyncSession(bind=engine, expire_on_commit=False) as db:
            await DictTypeService.add_dict_type_services(
                request, db, DictTypeModel(dict_id=1, dict_type='colors', dict_name='颜色', status='0')
            )
            await DictDataService.add_dict_data_services(
                request, db, DictDataModel(dict_code=1, dict_type='colors', dict_value='R', dict_label='红', status='0')
            )
            # 迁移后未补译的数据在数据库中可以为空，发布到缓存时统一使用空映射。
            await db.execute(update(SysDictData).where(SysDictData.dict_code == 1).values(dict_label_i18n=None))
            await db.commit()
            await DictDataService.publish_dict_cache(db, cache_redis, 'colors')
            snapshot = await cache_redis.get('sys_dict:colors')
            assert snapshot is not None
            cached = json.loads(snapshot)[0]
            assert cached['dictLabel'] == '红'
            assert cached['dictLabelI18n'] == {}
            await DictDataService.edit_dict_data_services(
                request,
                db,
                DictDataModel(
                    dict_code=1, dict_type='colors', dict_value='R', dict_label='红', dict_label_i18n={'en-US': 'Red'}
                ),
            )
            assert (await read(cache_redis, 'colors'))[0]['dictLabelI18n'] == {'en-US': 'Red'}
            await DictTypeService.edit_dict_type_services(
                request, db, DictTypeModel(dict_id=1, dict_type='palette', dict_name='调色板', status='0')
            )
            assert not await cache_redis.exists('sys_dict:colors')
            assert (await read(cache_redis, 'palette'))[0]['dictType'] == 'palette'
            await DictDataService.delete_dict_data_services(request, db, DeleteDictDataModel(dict_codes='1'))
            assert await read(cache_redis, 'palette') == []
            assert await cache_redis.exists('sys_dict:palette')
            await DictTypeService.delete_dict_type_services(request, db, DeleteDictTypeModel(dict_ids='1'))
            assert not await cache_redis.exists('sys_dict:palette')
    finally:
        await engine.dispose()
