from datetime import UTC, datetime
from typing import Annotated, Any
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI, Query, status
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import Select
from sqlalchemy.ext.asyncio import AsyncSession

from module_admin.dao.config_dao import ConfigDao
from module_admin.entity.vo.config_vo import ConfigPageQueryModel
from module_admin.entity.vo.file_vo import FileInfoQueryModel
from module_admin.entity.vo.job_vo import JobModel
from plugins.core.manifest.schema import PluginJobManifest
from utils.page_util import PageUtil
from utils.time_util import TimezoneUtil


@pytest.mark.parametrize('zone', ['', 'Invalid/Zone', '/etc/localtime', '../UTC', 'UTC+08:00'])
def test_invalid_timezone_is_a_model_validation_error(zone: str) -> None:
    """无效时区触发模型校验错误。"""
    with pytest.raises(ValidationError, match='IANA'):
        JobModel(time_zone=zone)
    with pytest.raises(ValidationError, match='IANA'):
        PluginJobManifest(
            id='daily', callable='module_task.scheduler_test.job', cron_expression='0 0 9 * * ?', time_zone=zone
        )


def test_http_boundaries_return_validation_errors() -> None:
    """HTTP 入口返回校验错误。"""
    app = FastAPI()

    @app.get(
        '/query', summary='校验日期查询参数', description='返回通过校验的日期查询条件，错误参数触发 HTTP 校验响应。'
    )
    def date_query(query: Annotated[ConfigPageQueryModel, Query()]) -> dict[str, Any]:
        return query.model_dump()

    with TestClient(app, raise_server_exceptions=False) as client:
        assert (
            client.get('/query', params={'beginTime': '2026-02-30'}).status_code
            == status.HTTP_422_UNPROCESSABLE_CONTENT
        )
        assert (
            client.get('/query', params={'beginTime': '2026-08-29', 'endTime': '2026-08-28'}).status_code
            == status.HTTP_422_UNPROCESSABLE_CONTENT
        )
        assert client.get('/query', params={'endTime': '2026-08-28'}).status_code == status.HTTP_200_OK


def test_instant_query_compares_instants_instead_of_offset_strings() -> None:
    """时间点查询按实际时刻比较。"""
    query = FileInfoQueryModel(begin_time='2026-08-28T10:00:00+08:00', end_time='2026-08-28T03:00:00Z')
    assert TimezoneUtil.rfc3339_range_to_utc(query.begin_time, query.end_time) == (
        datetime(2026, 8, 28, 2, tzinfo=UTC),
        datetime(2026, 8, 28, 3, tzinfo=UTC),
    )
    with pytest.raises(ValidationError):
        FileInfoQueryModel(begin_time='2026-08-28T03:00:00Z', end_time='2026-08-28T10:00:00+08:00')


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('boundaries', 'expected_times'),
    [
        ({'beginTime': '2026-08-28'}, [datetime(2026, 8, 27, 16, tzinfo=UTC)]),
        ({'endTime': '2026-08-28'}, [datetime(2026, 8, 28, 16, tzinfo=UTC)]),
        ({}, []),
    ],
    ids=['lower-only', 'upper-only', 'unbounded'],
)
async def test_date_query_filters_only_provided_boundaries_in_business_timezone(
    monkeypatch: pytest.MonkeyPatch, boundaries: dict[str, str], expected_times: list[datetime]
) -> None:
    """日期查询按业务时区仅过滤指定的边界。"""
    paginate = AsyncMock(return_value=[])
    monkeypatch.setattr(PageUtil, 'paginate', paginate)
    monkeypatch.setattr(TimezoneUtil, 'get_request_timezone', lambda: 'Asia/Shanghai')
    await ConfigDao.get_config_list(AsyncSession(), ConfigPageQueryModel.model_validate(boundaries))
    paginate.assert_awaited_once()
    assert paginate.await_args is not None
    query = paginate.await_args.args[1]
    assert isinstance(query, Select)
    sql = str(query)
    assert ('sys_config.create_time >=' in sql) == ('beginTime' in boundaries)
    assert ('sys_config.create_time <' in sql) == ('endTime' in boundaries)
    assert [value for value in query.compile().params.values() if isinstance(value, datetime)] == expected_times
