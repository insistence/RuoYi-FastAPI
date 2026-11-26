import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient

from module_admin.entity.vo.user_vo import UpdateUserProfileModel


@pytest.mark.parametrize('field', ['nick_name', 'nickName'])
def test_profile_accepts_both_input_names_and_returns_camel_case(field: str) -> None:
    """资料请求接受两种字段名，响应和接口文档统一使用驼峰别名。"""
    app = FastAPI()

    @app.post('/profile', summary='更新资料', description='校验并返回提交的用户资料。')
    async def profile(body: UpdateUserProfileModel) -> UpdateUserProfileModel:
        return body

    profile_model = UpdateUserProfileModel(nick_name='小王')
    with TestClient(app) as client:
        response = client.post('/profile', json={field: '小王'})
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == profile_model.model_dump(by_alias=True)
    assert response.json()['nickName'] == '小王'
    schema = app.openapi()['components']['schemas']['UpdateUserProfileModel']
    assert 'nickName' in schema['properties']
    assert 'nick_name' not in schema['properties']
