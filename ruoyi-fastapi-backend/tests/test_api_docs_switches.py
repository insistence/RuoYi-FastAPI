import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient

from config.env import AppConfig
from utils.server_util import APIDocsUtil


@pytest.mark.parametrize('disable_swagger', [False, True])
@pytest.mark.parametrize('disable_redoc', [False, True])
def test_custom_schema_respects_docs_switches(
    monkeypatch: pytest.MonkeyPatch, disable_swagger: bool, disable_redoc: bool
) -> None:
    monkeypatch.setattr(AppConfig, 'app_disable_swagger', disable_swagger)
    monkeypatch.setattr(AppConfig, 'app_disable_redoc', disable_redoc)
    app = FastAPI(openapi_url=None)
    APIDocsUtil.custom_api_docs_router(app)
    response = TestClient(app).get('/openapi.json')
    assert response.status_code == (404 if disable_swagger and disable_redoc else 200)
    if response.status_code == status.HTTP_200_OK:
        assert 'openapi' in response.json()


@pytest.mark.parametrize('disable_swagger', [False, True])
@pytest.mark.parametrize('disable_redoc', [False, True])
def test_proxy_schema_and_enabled_ui_are_available(
    monkeypatch: pytest.MonkeyPatch, disable_swagger: bool, disable_redoc: bool
) -> None:
    monkeypatch.setattr(AppConfig, 'app_disable_swagger', disable_swagger)
    monkeypatch.setattr(AppConfig, 'app_disable_redoc', disable_redoc)
    app = FastAPI(
        openapi_url=APIDocsUtil.proxy_openapi_url(),
        docs_url=APIDocsUtil.proxy_docs_url(),
        redoc_url=APIDocsUtil.proxy_redoc_url(),
    )
    APIDocsUtil.custom_api_docs_router(app)
    client = TestClient(app)
    assert client.get('/proxy-openapi.json').status_code == (404 if disable_swagger and disable_redoc else 200)
    for path, disabled in [('/proxy-docs', disable_swagger), ('/proxy-redoc', disable_redoc)]:
        response = client.get(path)
        assert response.status_code == status.HTTP_200_OK
        if not disabled:
            assert '/proxy-openapi.json' in response.text
        else:
            assert 'has been disabled' in response.text
