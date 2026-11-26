from typing import Annotated, Any

import httpx
import pytest
from fastapi import FastAPI, Query, status
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field, field_validator

from common.context import LocaleContext, RequestContext
from exceptions.handle import handle_exception
from i18n.validation import ValidationMessageUtil
from middlewares.locale_middleware import add_locale_middleware
from scripts.compile_i18n import compile_catalogs


@pytest.fixture(autouse=True, scope='module')
def catalogs() -> None:
    """编译原生参数校验错误使用的核心词库。"""
    compile_catalogs()


@pytest.mark.parametrize(
    ('error', 'key', 'params', 'text'),
    [
        ({'type': 'int_parsing'}, 'validation.integer', {}, 'Enter an integer'),
        (
            {'type': 'string_too_short', 'ctx': {'min_length': 3}},
            'validation.stringTooShort',
            {'min_length': 3},
            'Use at least 3 characters',
        ),
        (
            {'type': 'greater_than_equal', 'ctx': {'ge': 1}},
            'validation.greaterThanEqual',
            {'ge': 1},
            'The value must be greater than or equal to 1',
        ),
        (
            {'type': 'literal_error', 'ctx': {'expected': "'on' or 'off'"}},
            'validation.expected',
            {'expected': "'on' or 'off'"},
            "Allowed values: 'on' or 'off'",
        ),
        ({'type': 'string_too_long'}, 'validation.invalid', {}, 'Invalid input'),
        (
            {'type': 'value_error', 'ctx': {'error': ValueError('private/path')}},
            'validation.invalid',
            {},
            'Invalid input',
        ),
    ],
)
def test_explicit_type_messages_preserve_only_public_constraints(
    error: dict[str, Any], key: str, params: dict[str, object], text: str
) -> None:
    """验证错误类型映射仅公开该类型声明的约束参数。"""
    token = RequestContext.set_current_locale(LocaleContext('en-US'))
    try:
        result = ValidationMessageUtil.localize({**error, 'loc': ('body', 'value'), 'input': b'private-password'})
    finally:
        RequestContext.reset_current_locale(token)
    assert result['loc'] == ('body', 'value')
    assert result['type'] == error['type']
    assert result['msg'] == text
    assert result['msgKey'] == key
    assert result['msgParams'] == params
    assert result.get('ctx', {}) == params
    assert 'input' not in result


class ValidationBody(BaseModel):
    """通过字段长度和校验器触发请求体验证。"""

    name: str = Field(min_length=3, description='待校验的名称')

    @field_validator('name')
    @classmethod
    def validate_name(cls, value: str) -> str:
        """
        构造含内部错误详情的校验失败，用于验证响应脱敏。

        :param value: 待处理的输入值
        :raises ValueError: 模拟数据校验产生内部数据库错误
        :return: 待处理的输入值
        """
        if value == 'invalid':
            raise ValueError('private database detail')
        return value


@pytest.mark.asyncio
async def test_real_422_handles_json_and_custom_validation_without_echoing_input() -> None:
    """验证原生 422 错误保留定位字段，且不回显输入和异常详情。"""
    app = FastAPI()
    handle_exception(app)
    add_locale_middleware(app)

    @app.post('/validate', summary='校验请求字段', description='校验请求体中的名称和查询参数中的数量，并返回有效值。')
    async def validate(body: ValidationBody, count: Annotated[int, Query(ge=1)]) -> dict[str, object]:
        return {'name': body.name, 'count': count}

    @app.get(
        '/non-json-input',
        summary='模拟不可序列化的校验输入',
        description='构造含特殊输入值的校验异常，验证错误响应的字段和脱敏行为。',
    )
    async def non_json_input() -> None:
        raise RequestValidationError(
            [
                {
                    'type': 'value_error',
                    'loc': ('body', 'password'),
                    'input': object(),
                    'ctx': {'error': ValueError('secret')},
                }
            ]
        )

    headers = {'Accept-Language': 'en-US'}
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        cases = [
            await client.post('/validate?count=0', json={'name': 'valid'}, headers=headers),
            await client.post(
                '/validate?count=1', content=b'{"password":', headers={**headers, 'Content-Type': 'application/json'}
            ),
            await client.post('/validate?count=1', json={'name': 'invalid'}, headers=headers),
            await client.get('/non-json-input', headers=headers),
        ]
        default = await client.post('/validate?count=0', json={'name': 'valid'})
    for response in cases:
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
        assert response.headers['content-language'] == 'en-US'
        assert all('input' not in error for error in response.json()['detail'])
        assert 'private database detail' not in response.text
    assert cases[0].json()['detail'][0]['msgParams'] == {'ge': 1}
    assert cases[1].json()['detail'][0]['msgKey'] == 'validation.json'
    assert default.headers['content-language'] == 'zh-CN'
    error = default.json()['detail'][0]
    assert error['msgKey'] == 'validation.greaterThanEqual'
    assert error['msg'] == '数值必须大于或等于 1'
    assert error['ctx'] == error['msgParams'] == {'ge': 1}
    assert 'input' not in error
