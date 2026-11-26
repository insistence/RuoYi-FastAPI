from typing import Annotated

import httpx
import pytest
from fastapi import Depends, FastAPI, status
from pydantic import BaseModel, Field

from common.annotation.pydantic_annotation import as_form, as_query


@as_query
@as_form
class RequestFields(BaseModel):
    """校验装饰器生成的查询和表单依赖。"""

    name: str = Field(description='必填名称')
    item_id: int = Field(alias='item-id', description='条目标识')
    display_name: str = Field(default='', alias='label', description='展示名称')
    label: str = Field(default='', alias='alternateName', description='备用名称')
    tags: list[str] = Field(default_factory=list, description='附加标签')


@pytest.mark.asyncio
@pytest.mark.parametrize('source', ['query', 'form'])
async def test_fastapi_model_dependency_parses_aliases_and_defaults(source: str) -> None:
    """查询和表单依赖均应解析外部别名、检查必填项，并应用默认工厂。"""
    app = FastAPI()
    dependency = getattr(RequestFields, f'as_{source}')

    @app.post('/items', summary='校验模型参数', description='返回校验后的查询或表单参数。')
    async def read_fields(fields: Annotated[RequestFields, Depends(dependency)]) -> RequestFields:
        return fields

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        values = {'name': '测试', 'item-id': '7', 'label': '名称', 'alternateName': '别名'}
        if source == 'query':
            response = await client.post('/items', params=values)
        else:
            response = await client.post('/items', data=values)
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == {**values, 'item-id': 7, 'tags': []}
        assert (await client.post('/items')).status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
