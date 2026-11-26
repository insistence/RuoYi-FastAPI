import asyncio
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from config.env import UploadConfig
from module_admin.dao.file_info_dao import FileInfoDao
from module_admin.entity.do.file_do import SysFileInfo
from module_admin.entity.vo.file_vo import FileInfoModel
from scripts.migrate_legacy_files import calculate_file_hash, collect_legacy_files, migrate_legacy_files

EXPECTED_VALIDATION_LOOKUP_COUNT = 2
EXPECTED_BATCH_FILE_COUNT = 3
EXPECTED_BATCH_COMMIT_COUNT = 2


class AsyncSessionContext:
    """
    测试用异步数据库会话上下文。

    :ivar session: 当前操作共用的会话
    """

    def __init__(self, session: SimpleNamespace) -> None:
        """
        初始化测试夹具的 ``session``。

        :param session: 当前操作共用的会话
        """
        self.session = session

    async def __aenter__(self) -> SimpleNamespace:
        """
        向调用方返回 ``self.session``。

        :return: 当前测试上下文持有的数据库会话
        """
        return self.session

    async def __aexit__(self, exc_type: type | None, exc_value: BaseException | None, traceback: object) -> None:
        """
        完成无需返回值的回调。

        :param exc_type: 退出上下文时的异常类型
        :param exc_value: 退出上下文时的异常实例
        :param traceback: 异常的调用栈
        """
        return


def make_database_registry(session: SimpleNamespace) -> SimpleNamespace:
    """
    构造使用测试会话的数据库注册表。

    :param session: 当前操作共用的会话
    :return: 使用测试会话的数据库注册表
    """
    return SimpleNamespace(session=lambda: AsyncSessionContext(session))


def test_collect_legacy_files_filters_disallowed_extensions(tmp_path: Path) -> None:
    """收集旧文件时过滤未许可扩展名。"""
    allowed_file = tmp_path / 'upload' / 'report.txt'
    allowed_file.parent.mkdir()
    allowed_file.write_bytes(b'report-content')
    (tmp_path / 'danger.exe').write_bytes(b'danger-content')

    with patch.object(UploadConfig, 'UPLOAD_PATH', str(tmp_path)):
        legacy_files, skipped_count = collect_legacy_files()

    assert skipped_count == 1
    assert len(legacy_files) == 1
    assert legacy_files[0].storage_key == 'upload/report.txt'
    assert legacy_files[0].file_size == len(b'report-content')
    assert asyncio.run(calculate_file_hash(allowed_file, legacy_files[0].signature)) == (
        '362636f5a34836946783f440c823fd9b5604a42a3deebe7b9bb97dfc1084f6ed'
    )


def test_collect_legacy_files_filters_oversized_files(tmp_path: Path) -> None:
    """收集旧文件时排除超大文件。"""
    (tmp_path / 'small.txt').write_bytes(b'ok')
    (tmp_path / 'large.txt').write_bytes(b'too-large')

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(tmp_path)),
        patch.object(UploadConfig, 'MAX_FILE_SIZE', 2),
    ):
        legacy_files, skipped_count = collect_legacy_files()

    assert [legacy_file.filename for legacy_file in legacy_files] == ['small.txt']
    assert skipped_count == 1


def test_calculate_file_hash_rejects_changed_file(tmp_path: Path) -> None:
    """计算哈希时拒绝内容已变化的文件。"""
    filepath = tmp_path / 'report.txt'
    filepath.write_bytes(b'old-content')
    with patch.object(UploadConfig, 'UPLOAD_PATH', str(tmp_path)):
        legacy_files, skipped_count = collect_legacy_files()
    filepath.write_bytes(b'new-content-with-different-size')

    with pytest.raises(ValueError, match='文件在扫描后发生变化'):
        asyncio.run(calculate_file_hash(filepath, legacy_files[0].signature))

    assert skipped_count == 0


def test_migrate_legacy_files_dry_run_performs_full_validation_without_commit(tmp_path: Path) -> None:
    """旧文件迁移预演完成全部校验且无需提交事务。"""
    (tmp_path / 'report.txt').write_bytes(b'report-content')
    session = SimpleNamespace(commit=AsyncMock())

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(tmp_path)),
        patch('scripts.migrate_legacy_files.DataSourceRegistry', make_database_registry(session)),
        patch.object(FileInfoDao, 'get_file_info_by_storage_key', new=AsyncMock(return_value=None)) as get_file_info,
        patch.object(FileInfoDao, 'add_file_info_dao', new_callable=AsyncMock) as add_file_info,
    ):
        result = asyncio.run(migrate_legacy_files(dry_run=True))

    assert result == (1, 0)
    assert get_file_info.await_count == EXPECTED_VALIDATION_LOOKUP_COUNT
    add_file_info.assert_not_awaited()
    session.commit.assert_not_awaited()


def test_migrate_legacy_files_writes_file_info_model_and_commits(tmp_path: Path) -> None:
    """旧文件迁移写入文件信息并提交。"""
    (tmp_path / 'report.txt').write_bytes(b'report-content')
    session = SimpleNamespace(commit=AsyncMock())

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(tmp_path)),
        patch('scripts.migrate_legacy_files.DataSourceRegistry', make_database_registry(session)),
        patch.object(FileInfoDao, 'get_file_info_by_storage_key', new=AsyncMock(return_value=None)),
        patch.object(FileInfoDao, 'add_file_info_dao', new_callable=AsyncMock) as add_file_info,
    ):
        result = asyncio.run(migrate_legacy_files(batch_size=1, maintenance_confirmed=True))

    assert result == (1, 0)
    assert add_file_info.await_args is not None
    file_info = add_file_info.await_args.args[1]
    assert isinstance(file_info, FileInfoModel)
    assert file_info.storage_type == 'local'
    assert file_info.access_type == 'public'
    assert file_info.upload_user_id is None
    assert file_info.owner_user_id is None
    assert file_info.dept_id is None
    assert file_info.file_hash == '362636f5a34836946783f440c823fd9b5604a42a3deebe7b9bb97dfc1084f6ed'
    assert SysFileInfo(**file_info.model_dump()).storage_key == 'report.txt'
    session.commit.assert_awaited_once()


def test_migrate_legacy_files_skips_existing_storage_location(tmp_path: Path) -> None:
    """旧文件迁移跳过已有存储位置。"""
    (tmp_path / 'report.txt').write_bytes(b'report-content')
    session = SimpleNamespace(commit=AsyncMock())

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(tmp_path)),
        patch('scripts.migrate_legacy_files.DataSourceRegistry', make_database_registry(session)),
        patch.object(
            FileInfoDao,
            'get_file_info_by_storage_key',
            new=AsyncMock(return_value=SimpleNamespace(file_id='existing')),
        ),
        patch.object(FileInfoDao, 'add_file_info_dao', new_callable=AsyncMock) as add_file_info,
    ):
        result = asyncio.run(migrate_legacy_files(maintenance_confirmed=True))

    assert result == (0, 1)
    add_file_info.assert_not_awaited()
    session.commit.assert_not_awaited()


def test_migrate_legacy_files_commits_by_batch(tmp_path: Path) -> None:
    """旧文件迁移按批次提交。"""
    for index in range(3):
        (tmp_path / f'report-{index}.txt').write_bytes(f'content-{index}'.encode())
    session = SimpleNamespace(commit=AsyncMock())

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(tmp_path)),
        patch('scripts.migrate_legacy_files.DataSourceRegistry', make_database_registry(session)),
        patch.object(FileInfoDao, 'get_file_info_by_storage_key', new=AsyncMock(return_value=None)),
        patch.object(FileInfoDao, 'add_file_info_dao', new_callable=AsyncMock) as add_file_info,
    ):
        result = asyncio.run(migrate_legacy_files(batch_size=2, maintenance_confirmed=True))

    assert result == (3, 0)
    assert add_file_info.await_count == EXPECTED_BATCH_FILE_COUNT
    assert session.commit.await_count == EXPECTED_BATCH_COMMIT_COUNT


def test_migrate_legacy_files_requires_valid_execution_options() -> None:
    """旧文件迁移要求有效的执行选项。"""
    with pytest.raises(ValueError, match='每批提交数量必须大于0'):
        asyncio.run(migrate_legacy_files(dry_run=True, batch_size=0))
    with pytest.raises(ValueError, match='必须停止公开文件上传'):
        asyncio.run(migrate_legacy_files())
