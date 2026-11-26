import json
from inspect import isawaitable

import pytest
from fastapi import FastAPI, Request, status

from common.constant import HttpStatusConstant
from exceptions.exception import (
    DataSourceInitializationException,
    DataSourceNotFoundException,
    DataSourceUnavailableException,
    ServiceException,
)
from exceptions.handle import handle_exception


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'exception',
    [
        DataSourceUnavailableException('reporting'),
        DataSourceInitializationException('reporting'),
        DataSourceNotFoundException('reporting'),
    ],
)
async def test_data_source_exceptions_use_service_exception_handler(exception: Exception) -> None:
    """数据源异常由服务异常处理器处理。"""
    app = FastAPI()
    handle_exception(app)

    handler = app.exception_handlers[ServiceException]
    result = handler(Request({'type': 'http', 'headers': []}), exception)
    response = await result if isawaitable(result) else result
    payload = json.loads(bytes(response.body))

    assert response.status_code == status.HTTP_200_OK
    assert payload['code'] == HttpStatusConstant.ERROR
    assert payload['success'] is False
    assert 'reporting' in payload['msg']
    assert '://' not in payload['msg']
