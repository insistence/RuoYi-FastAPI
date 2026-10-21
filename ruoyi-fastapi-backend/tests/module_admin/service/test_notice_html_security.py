from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from module_admin.dao.notice_dao import NoticeDao
from module_admin.entity.do.notice_do import SysNotice
from module_admin.entity.vo.notice_vo import NoticeModel, NoticePageQueryModel
from module_admin.service.notice_service import NoticeService

PAYLOAD = '<p>正文<strong>重点</strong><img src="/safe.png" onerror="alert(1)"></p><script>alert(1)</script><a href="javascript:alert(1)">链接</a>'


def assert_safe(content: str) -> None:
    assert '<strong>重点</strong>' in content
    assert 'src="/safe.png"' in content
    assert 'onerror' not in content
    assert '<script' not in content
    assert 'javascript:' not in content


def test_direct_api_input_is_cleaned_before_persistence() -> None:
    app = FastAPI()

    @app.post('/notice')
    def notice(payload: NoticeModel) -> NoticeModel:
        assert_safe(payload.notice_content.decode())
        return payload

    response = TestClient(app).post('/notice', json={'noticeTitle': '测试', 'noticeContent': PAYLOAD})
    assert_safe(response.json()['noticeContent'])


@pytest.mark.asyncio
async def test_legacy_notice_detail_and_list_are_sanitized(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        NoticeDao,
        'get_notice_detail_by_id',
        AsyncMock(
            return_value=SysNotice(
                notice_id=2,
                notice_title='历史公告',
                notice_content=PAYLOAD.encode(),
            )
        ),
    )
    monkeypatch.setattr(NoticeDao, 'get_notice_list', AsyncMock(return_value=[{'noticeContent': PAYLOAD}]))
    result = await NoticeService.notice_detail_services(AsyncMock(), 2)
    assert_safe(result.notice_content.decode())
    rows = await NoticeService.get_notice_list_services(AsyncMock(), NoticePageQueryModel(), False)
    assert_safe(rows[0]['noticeContent'])


@pytest.mark.parametrize('url', ['javascript:alert(1)', 'jav&#x61;script:alert(1)', 'data:text/html,x', 'vbscript:x'])
def test_rejects_dangerous_urls_and_embedded_content(url: str) -> None:
    result = NoticeModel(noticeContent=f'<a href="{url}">x</a><img src="{url}"><svg onload="alert(1)"></svg>')
    content = result.notice_content.decode()
    assert 'href=' not in content
    assert 'src=' not in content
    assert '<svg' not in content


def test_legal_rich_text_and_partial_updates_are_preserved() -> None:
    content = '<h2>标题</h2><ul><li><em>正文</em></li></ul><table><tr><td colspan="2">表格</td></tr></table>'
    result = NoticeModel(noticeContent=content).notice_content.decode()
    assert '<h2>标题</h2>' in result and '<em>正文</em>' in result and 'colspan="2"' in result
    assert 'notice_content' not in NoticeModel(status='1').model_dump(exclude_unset=True)


def test_quill_text_styles_are_preserved_without_layout_styles() -> None:
    content = NoticeModel(
        noticeContent='<p class="ql-align-center"><span style="color: red; background-color: yellow; position: fixed">正文</span></p>'
    ).notice_content.decode()
    assert 'ql-align-center' in content
    assert 'color:red' in content and 'background-color:yellow' in content
    assert 'position' not in content


def test_quill_video_is_sandboxed_and_cannot_embed_inline_script() -> None:
    content = NoticeModel(
        noticeContent='<iframe class="ql-video" src="https://video.example/embed/1" sandbox="allow-same-origin" srcdoc="<script>alert(1)</script>"></iframe>'
    ).notice_content.decode()
    assert 'src="https://video.example/embed/1"' in content
    assert 'sandbox="allow-scripts allow-presentation"' in content
    assert 'srcdoc' not in content and 'allow-same-origin' not in content
    content = NoticeModel(noticeContent='<span style="color: expression(alert(1))">正文</span>').notice_content.decode()
    assert 'expression' not in content
