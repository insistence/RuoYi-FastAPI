from fastapi import FastAPI, status
from fastapi.testclient import TestClient

from module_admin.controller.job_controller import preview_system_job


def test_preview_endpoint_validates_fields_and_distinguishes_no_future_dates() -> None:
    """预览端点校验字段并区分没有未来执行日期的情况。"""
    app = FastAPI()
    app.post('/preview', summary='预览任务执行时间', description='按 Cron 表达式、时区和起始时刻计算后续执行时间。')(
        preview_system_job
    )
    client = TestClient(app)
    base = {'cronExpression': '0 0 0 1 1 ? 2020', 'timeZone': 'UTC', 'startTime': '2026-01-01T00:00:00Z'}
    response = client.post('/preview', json=base)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()['data'] == {'timeZone': 'UTC', 'startTime': '2026-01-01T00:00:00.000Z', 'nextRunTimes': []}
    for change in (
        {'timeZone': 'Bogus/Zone'},
        {'cronExpression': '0 0 99 * * ?'},
        {'count': 21},
        {'startTime': '2026-01-01'},
    ):
        assert client.post('/preview', json={**base, **change}).status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
