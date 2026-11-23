import asyncio
import hashlib
import os
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from common.vo import PageModel
from module_admin.dao.file_info_dao import FileInfoDao
from module_admin.entity.vo.file_vo import (
    FileReconcileHandleModel,
    FileReconcileIssuePageQueryModel,
    FileReconcileRunPageQueryModel,
)
from module_admin.service.file_service import FileReconcileService
from utils.file_util import FileReconcileScanResult, FileReconcileUtil

FILE_ID = '11111111-1111-4111-8111-111111111111'
STORED_NAME = 'report_20260725120000A001.txt'
STORAGE_KEY = f'2026/07/25/{STORED_NAME}'


def make_roots(tmp_path: Path) -> dict[str, Path]:
    """
    准备测试用的文件存储目录。

    :param tmp_path: pytest 为当前用例创建的临时目录
    :return: 需要检查的文件存储根目录集合
    """
    roots = {
        'public': tmp_path / 'public',
        'private': tmp_path / 'private',
        'trash': tmp_path / 'trash',
        'quarantine': tmp_path / 'quarantine',
    }
    for root in roots.values():
        root.mkdir()
    return roots


def make_file_info(content: bytes, **overrides: object) -> dict[str, object]:
    """
    构造文件信息记录。

    :param content: 需要读取或写入的内容
    :param overrides: 调用方按名称传入的附加选项
    :return: 文件信息记录
    """
    file_info: dict[str, object] = {
        'file_id': FILE_ID,
        'storage_type': 'local',
        'access_type': 'public',
        'storage_key': STORAGE_KEY,
        'stored_name': STORED_NAME,
        'file_size': len(content),
        'file_hash': hashlib.sha256(content).hexdigest(),
        'status': 'active',
        'del_flag': '0',
    }
    file_info.update(overrides)
    return file_info


def write_file(root: Path, relative_key: str, content: bytes) -> Path:
    """
    在指定存储根目录下创建测试文件。

    :param root: 路径解析的基准目录
    :param relative_key: 相对路径
    :param content: 需要读取或写入的内容
    :return: 本次操作的目标
    """
    target = root / Path(relative_key)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    return target


def scan(
    roots: dict[str, Path],
    file_infos: list[dict[str, object]],
    check_hash: bool = False,
) -> FileReconcileScanResult:
    """
    在指定存储目录中进行文件对账扫描。

    :param roots: 需要检查的文件存储根目录集合
    :param file_infos: 文件信息列表
    :param check_hash: 是否验证内容哈希
    :return: 本次文件对账扫描发现的问题
    """
    with patch.object(FileReconcileUtil, 'get_storage_roots', return_value=roots):
        return FileReconcileUtil.scan_storage(file_infos, check_hash)


def test_reconcile_scan_reports_normal_storage_without_findings(tmp_path: Path) -> None:
    """存储正常时核对扫描不报告问题。"""
    roots = make_roots(tmp_path)
    content = b'normal file'
    write_file(roots['public'], STORAGE_KEY, content)

    result = scan(roots, [make_file_info(content)], check_hash=True)

    assert result.scanned_file_count == 1
    assert result.scanned_storage_count == 1
    assert result.findings == []


def test_reconcile_scan_detects_unexpected_trash_and_orphan_file(tmp_path: Path) -> None:
    """核对扫描识别意外的回收内容和孤立文件。"""
    roots = make_roots(tmp_path)
    content = b'trash file'
    write_file(roots['trash'], f'{FILE_ID}/{STORED_NAME}', content)
    orphan_path = write_file(roots['private'], 'orphan/orphan.txt', b'orphan')
    old_time = orphan_path.stat().st_mtime - FileReconcileUtil.ORPHAN_GRACE_SECONDS - 1
    os.utime(orphan_path, (old_time, old_time))

    result = scan(roots, [make_file_info(content)])
    finding_types = {finding.issue_type for finding in result.findings}

    assert finding_types == {'unexpected_trash', 'orphan_file'}


def test_reconcile_scan_detects_wrong_root_without_duplicate_orphan(tmp_path: Path) -> None:
    """核对扫描识别根目录错位且不重复报告孤立文件。"""
    roots = make_roots(tmp_path)
    content = b'wrong root'
    write_file(roots['private'], STORAGE_KEY, content)

    result = scan(roots, [make_file_info(content)])

    assert [finding.issue_type for finding in result.findings] == ['wrong_storage_root']
    assert result.findings[0].actual_root == 'private'
    assert result.findings[0].expected_root == 'public'


def test_reconcile_scan_ignores_recent_orphan_during_upload_window(tmp_path: Path) -> None:
    """核对扫描在上传窗口内跳过新出现的孤立文件。"""
    roots = make_roots(tmp_path)
    write_file(roots['public'], 'uploading.txt', b'uploading')

    result = scan(roots, [])

    assert result.scanned_storage_count == 1
    assert result.findings == []


def test_reconcile_scan_detects_size_and_hash_mismatch(tmp_path: Path) -> None:
    """核对扫描识别大小和哈希不匹配。"""
    roots = make_roots(tmp_path)
    actual_content = b'changed content'
    write_file(roots['public'], STORAGE_KEY, actual_content)
    file_info = make_file_info(b'old')

    result = scan(roots, [file_info], check_hash=True)

    assert {finding.issue_type for finding in result.findings} == {
        'size_mismatch',
        'hash_mismatch',
    }


def test_reconcile_scan_rejects_unsafe_metadata_path(tmp_path: Path) -> None:
    """核对扫描拒绝不安全的元数据路径。"""
    roots = make_roots(tmp_path)

    result = scan(roots, [make_file_info(b'', storage_key='../outside.txt')])

    assert len(result.findings) == 1
    assert result.findings[0].issue_type == 'invalid_metadata'


def test_reconcile_available_actions_follow_issue_status() -> None:
    """核对问题的状态决定可用操作。"""
    open_orphan = SimpleNamespace(
        status='open',
        issue_type='orphan_file',
        actual_root='public',
        quarantine_key=None,
    )
    quarantined = SimpleNamespace(
        status='quarantined',
        issue_type='orphan_file',
        actual_root='public',
        quarantine_key='1/public/orphan.txt',
    )

    assert FileReconcileService._get_available_actions(open_orphan) == [
        'ignore',
        'quarantine_file',
        'register_orphan',
    ]
    assert FileReconcileService._get_available_actions(quarantined) == [
        'restore_quarantine',
        'delete_quarantine',
    ]


def test_reconcile_move_rejects_existing_target(tmp_path: Path) -> None:
    """核对移动操作拒绝已存在的目标。"""
    roots = make_roots(tmp_path)
    write_file(roots['public'], 'source.txt', b'source')
    write_file(roots['private'], 'target.txt', b'target')

    with (
        patch.object(FileReconcileUtil, 'get_storage_roots', return_value=roots),
        pytest.raises(FileExistsError),
    ):
        FileReconcileUtil.move_regular_file('public', 'source.txt', 'private', 'target.txt')


def test_reconcile_start_creates_manual_run_with_boolean_hash_flag() -> None:
    """手动核对任务使用布尔值控制哈希检查。"""
    query_db = SimpleNamespace(commit=AsyncMock(), rollback=AsyncMock())
    current_user = SimpleNamespace(user=SimpleNamespace(admin=True, user_name='admin'))

    with (
        patch.object(FileInfoDao, 'release_stale_runs', new=AsyncMock()),
        patch.object(FileInfoDao, 'add_reconcile_run', new=AsyncMock()) as add_run,
    ):
        reconcile_run = asyncio.run(
            FileReconcileService.start_reconcile_run_services(
                query_db,
                check_hash=True,
                current_user=current_user,
            )
        )

    assert reconcile_run.check_hash is True
    assert reconcile_run.trigger_type == 'manual'
    assert reconcile_run.started_by == 'admin'
    assert add_run.await_args.args[1].check_hash == '1'
    query_db.commit.assert_awaited_once()


def test_reconcile_run_page_converts_database_field_names() -> None:
    """核对任务分页转换数据库字段名。"""
    current_user = SimpleNamespace(user=SimpleNamespace(admin=True, user_name='admin'))
    run_page = PageModel.model_validate(
        {
            'rows': [
                {
                    'run_id': FILE_ID,
                    'trigger_type': 'manual',
                    'status': 'completed',
                    'check_hash': '0',
                    'started_time': '2026-07-25T12:00:00.000Z',
                }
            ],
            'page_num': 1,
            'page_size': 10,
            'total': 1,
            'has_next': False,
        },
        by_name=True,
    )

    with patch.object(
        FileInfoDao,
        'get_reconcile_run_list',
        new=AsyncMock(return_value=run_page),
    ):
        result = asyncio.run(
            FileReconcileService.get_reconcile_run_list_services(
                SimpleNamespace(),
                current_user,
                FileReconcileRunPageQueryModel(),
            )
        )

    assert isinstance(result, PageModel)
    assert result.rows[0].run_id == FILE_ID
    assert result.rows[0].check_hash is False


def test_reconcile_issue_page_calculates_actions_from_camel_case_rows() -> None:
    """核对问题分页根据驼峰字段推导可用操作。"""
    current_user = SimpleNamespace(user=SimpleNamespace(admin=True, user_name='admin'))
    current_time = datetime(2026, 7, 26, 12, 0, 0, tzinfo=UTC)
    issue_page = PageModel(
        rows=[
            {
                'issueId': 1,
                'issueKey': 'orphan:public:orphan.txt',
                'lastRunId': FILE_ID,
                'issueType': 'orphan_file',
                'severity': 'warning',
                'actualRoot': 'public',
                'actualKey': 'orphan.txt',
                'status': 'open',
                'firstSeenTime': current_time,
                'lastSeenTime': current_time,
            }
        ],
        pageNum=1,
        pageSize=10,
        total=1,
        hasNext=False,
    )

    with patch.object(
        FileInfoDao,
        'get_reconcile_issue_list',
        new=AsyncMock(return_value=issue_page),
    ):
        result = asyncio.run(
            FileReconcileService.get_reconcile_issue_list_services(
                SimpleNamespace(),
                current_user,
                FileReconcileIssuePageQueryModel(),
            )
        )

    assert isinstance(result, PageModel)
    assert result.rows[0].available_actions == [
        'ignore',
        'quarantine_file',
        'register_orphan',
    ]


def test_reconcile_move_is_compensated_when_database_commit_fails(tmp_path: Path) -> None:
    """提交失败时撤回核对过程中的文件移动。"""
    roots = make_roots(tmp_path)
    trash_key = f'{FILE_ID}/{STORED_NAME}'
    source = write_file(roots['trash'], trash_key, b'content')
    target = roots['public'] / Path(STORAGE_KEY)
    issue = SimpleNamespace(
        issue_id=1,
        file_id=FILE_ID,
        issue_type='unexpected_trash',
        status='open',
        actual_root='trash',
        actual_key=trash_key,
        expected_root='public',
        expected_key=STORAGE_KEY,
        quarantine_key=None,
        handle_action=None,
        handle_reason=None,
        handled_by=None,
        handled_time=None,
    )
    query_db = SimpleNamespace(
        commit=AsyncMock(side_effect=RuntimeError('commit failed')),
        rollback=AsyncMock(),
    )
    current_user = SimpleNamespace(user=SimpleNamespace(admin=True, user_name='admin', user_id=1, dept_id=100))
    handle = FileReconcileHandleModel(action='restore_source', reason='恢复事务中断文件')

    with (
        patch.object(FileReconcileUtil, 'get_storage_roots', return_value=roots),
        patch.object(
            FileInfoDao,
            'has_running_reconcile_run',
            new=AsyncMock(return_value=False),
        ),
        patch.object(
            FileInfoDao,
            'get_reconcile_issue_for_update',
            new=AsyncMock(return_value=issue),
        ),
        pytest.raises(RuntimeError, match='commit failed'),
    ):
        asyncio.run(
            FileReconcileService.handle_reconcile_issue_services(
                query_db,
                current_user,
                issue.issue_id,
                handle,
            )
        )

    assert source.is_file()
    assert not target.exists()
    query_db.rollback.assert_awaited_once()
