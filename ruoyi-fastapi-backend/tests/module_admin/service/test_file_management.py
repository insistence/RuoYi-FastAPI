import asyncio
from collections.abc import Generator
from pathlib import Path
from types import SimpleNamespace
from typing import Literal
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import false, true

from common.aspect.data_scope import GetDataScope
from config.env import UploadConfig
from exceptions.exception import ServiceException
from module_admin.dao.file_business_dao import FileReferenceDao
from module_admin.dao.file_info_dao import FileInfoDao
from module_admin.entity.do.file_do import SysFileInfo
from module_admin.entity.vo.file_vo import DeleteFileModel, TransferFileModel
from module_admin.entity.vo.role_vo import RoleModel
from module_admin.service.file_access_service import FileAuditService
from module_admin.service.file_service import FileLifecycleService, FileQueryService, FileTransferService
from tests.module_admin.service.file_helpers import make_file_request
from tests.module_admin.service.helpers import make_current_user, make_query_db
from utils.file_util import FileUtil
from utils.upload_util import UploadUtil

PUBLIC_FILE_ID = '11111111-1111-4111-8111-111111111111'
PRIVATE_FILE_ID = '22222222-2222-4222-8222-222222222222'
TARGET_USER_ID = 20
TARGET_DEPT_ID = 110
BATCH_FILE_COUNT = 2


def make_file_info(
    file_id: str,
    access_type: str,
    storage_key: str,
    stored_name: str,
    business_type: str | None = None,
    business_id: str | None = None,
) -> SimpleNamespace:
    """
    创建测试使用的 ``SimpleNamespace`` 实例。

    :param file_id: 文件ID
    :param access_type: 文件访问类型
    :param storage_key: 存储相对路径
    :param stored_name: 存储文件名
    :param business_type: 业务类型
    :param business_id: 业务ID
    :return: 测试使用的 ``SimpleNamespace`` 实例
    """
    return SimpleNamespace(
        file_id=file_id,
        original_name=stored_name,
        storage_type='local',
        access_type=access_type,
        storage_key=storage_key,
        stored_name=stored_name,
        business_type=business_type,
        business_id=business_id,
    )


def expire_model_attributes(*models: SimpleNamespace) -> None:
    """
    模拟SQLAlchemy事务结束后ORM属性过期。

    :param models: 调用方传入的其余位置参数
    """
    for model in models:
        model.__dict__.clear()


@pytest.fixture(autouse=True)
def mock_file_reference_count() -> Generator[None, None, None]:
    """
    默认模拟文件不存在业务引用。

    :yield: 上下文就绪后将控制权交给调用方
    """
    with patch.object(FileReferenceDao, 'get_file_reference_count_map', new=AsyncMock(return_value={})):
        yield


@pytest.mark.parametrize('data_scope', [GetDataScope.DATA_SCOPE_DEPT, GetDataScope.DATA_SCOPE_DEPT_AND_CHILD])
def test_file_data_scope_does_not_match_unowned_files_when_user_has_no_department(
    data_scope: Literal['3', '4'],
) -> None:
    """无所属部门的用户不能匹配无所有者文件。"""
    current_user = make_current_user(20)
    current_user.user.role = [RoleModel(role_id=2, data_scope=data_scope, status='0', del_flag='0')]

    with (
        patch('common.aspect.data_scope.DependencyUtil.check_exclude_routes'),
        patch('common.aspect.data_scope.RequestContext.get_current_user', return_value=current_user),
    ):
        file_data_scope_sql = GetDataScope(
            SysFileInfo,
            user_alias='owner_user_id',
            dept_alias='dept_id',
        )(make_file_request())

    assert str(file_data_scope_sql).lower() == 'false'


def test_file_detail_reads_sqlalchemy_attributes_and_outputs_camel_case() -> None:
    """文件详情读取 SQLAlchemy 属性并使用驼峰字段输出。"""
    file_info = SysFileInfo(
        file_id=PUBLIC_FILE_ID,
        original_name='report.pdf',
        stored_name='report_20260720120000A001.pdf',
        storage_key='upload/2026/07/20/report_20260720120000A001.pdf',
        storage_type='local',
        access_type='public',
        acl_version=0,
        extension='pdf',
        file_size=7,
        file_hash='a' * 64,
        status='active',
        del_flag='0',
    )

    file_info_dict = {key: value for key, value in file_info.__dict__.items() if key != '_sa_instance_state'}
    with patch.object(
        FileInfoDao,
        'get_file_management_detail_by_id',
        new=AsyncMock(return_value=file_info_dict),
    ):
        result = asyncio.run(FileQueryService.file_detail_services(make_query_db(), PUBLIC_FILE_ID, true()))

    assert result.file_id == PUBLIC_FILE_ID
    assert result.model_dump(by_alias=True)['originalName'] == 'report.pdf'
    assert result.model_dump(by_alias=True)['uploaderAccessEnabled'] == '1'


def test_file_storage_status_distinguishes_normal_quarantined_and_missing(tmp_path: Path) -> None:
    """存储状态区分正常、隔离及缺失文件。"""
    public_root = tmp_path / 'public'
    trash_root = tmp_path / 'trash'
    source_file = public_root / 'upload' / 'public.txt'
    trash_file = trash_root / PUBLIC_FILE_ID / 'public.txt'
    source_file.parent.mkdir(parents=True)
    trash_file.parent.mkdir(parents=True)
    source_file.write_bytes(b'content')
    file_info = {
        'fileId': PUBLIC_FILE_ID,
        'storageType': 'local',
        'accessType': 'public',
        'storageKey': 'upload/public.txt',
        'storedName': 'public.txt',
        'status': 'active',
    }

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(public_root)),
        patch.object(UploadConfig, 'FILE_TRASH_PATH', str(trash_root)),
    ):
        assert FileUtil.get_storage_status(file_info) == 'normal'
        source_file.replace(trash_file)
        file_info['status'] = 'deleted'
        assert FileUtil.get_storage_status(file_info) == 'quarantined'
        trash_file.unlink()
        assert FileUtil.get_storage_status(file_info) == 'missing'


def test_file_storage_status_marks_invalid_paths() -> None:
    """存储状态标记无效路径。"""
    file_info = {
        'fileId': PUBLIC_FILE_ID,
        'storageType': 'local',
        'accessType': 'public',
        'storageKey': '../outside.txt',
        'storedName': 'outside.txt',
        'status': 'active',
    }

    assert FileUtil.get_storage_status(file_info) == 'invalid'


def test_transfer_file_updates_owner_and_department_with_data_scope() -> None:
    """移交文件时按数据范围更新所有者和部门。"""
    query_db = make_query_db()
    transfer_model = TransferFileModel(
        owner_user_id=TARGET_USER_ID,
        dept_id=TARGET_DEPT_ID,
        retain_uploader_access=False,
        reason='岗位调整',
    )
    target_user = SimpleNamespace(user_id=TARGET_USER_ID, user_name='target-user', dept_id=TARGET_DEPT_ID)
    target_dept = SimpleNamespace(dept_id=TARGET_DEPT_ID)
    source_files = [
        SimpleNamespace(
            file_id=PUBLIC_FILE_ID,
            owner_user_id=10,
            dept_id=100,
            uploader_access_enabled='1',
        )
    ]
    query_db.commit.side_effect = lambda: expire_model_attributes(target_user, target_dept, *source_files)

    with (
        patch.object(FileInfoDao, 'get_transfer_user_by_id', new=AsyncMock(return_value=target_user)) as get_user,
        patch.object(FileInfoDao, 'get_transfer_dept_by_id', new=AsyncMock(return_value=target_dept)) as get_dept,
        patch.object(
            FileInfoDao,
            'get_file_infos_by_ids_for_update',
            new=AsyncMock(return_value=source_files),
        ) as get_files,
        patch.object(FileInfoDao, 'transfer_file_infos', new_callable=AsyncMock) as transfer_files,
        patch.object(FileAuditService, 'enqueue_file_audit', new_callable=AsyncMock) as enqueue_file_audit,
    ):
        result = asyncio.run(
            FileTransferService.transfer_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                PUBLIC_FILE_ID,
                transfer_model,
                true(),
                true(),
                true(),
            )
        )

    assert result.is_success is True
    assert get_user.await_args_list[-1].args[1] == TARGET_USER_ID
    assert get_dept.await_args_list[-1].args[1] == TARGET_DEPT_ID
    assert get_files.await_args_list[-1].args[2].compare(true())
    assert transfer_files.await_args_list[-1].args[1:5] == ([PUBLIC_FILE_ID], TARGET_USER_ID, TARGET_DEPT_ID, False)
    query_db.commit.assert_awaited_once()
    enqueue_file_audit.assert_awaited_once()
    assert enqueue_file_audit.await_args_list[-1].args[2:5] == (PUBLIC_FILE_ID, 'transfer', 'completed')
    assert enqueue_file_audit.await_args_list[-1].kwargs['operation_detail']['reason'] == '岗位调整'
    assert enqueue_file_audit.await_args_list[-1].kwargs['operation_detail']['previousUploaderAccessEnabled'] is True
    assert enqueue_file_audit.await_args_list[-1].kwargs['operation_detail']['newUploaderAccessEnabled'] is False


def test_transfer_file_model_retains_uploader_access_by_default() -> None:
    """移交文件默认保留上传者访问权。"""
    transfer_model = TransferFileModel(owner_user_id=TARGET_USER_ID, dept_id=TARGET_DEPT_ID, reason='岗位调整')

    assert transfer_model.retain_uploader_access is True


def test_transfer_file_rejects_target_outside_data_scope() -> None:
    """拒绝向数据范围外的目标移交文件。"""
    query_db = make_query_db()
    transfer_model = TransferFileModel(owner_user_id=TARGET_USER_ID, dept_id=TARGET_DEPT_ID, reason='岗位调整')
    user_data_scope_sql = false()

    with (
        patch.object(FileInfoDao, 'get_transfer_user_by_id', new=AsyncMock(return_value=None)) as get_user,
        patch.object(
            FileInfoDao,
            'get_transfer_dept_by_id',
            new=AsyncMock(return_value=SimpleNamespace(dept_id=TARGET_DEPT_ID)),
        ),
        patch.object(FileInfoDao, 'transfer_file_infos', new_callable=AsyncMock) as transfer_files,
        pytest.raises(ServiceException) as scope_error,
    ):
        asyncio.run(
            FileTransferService.transfer_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                PUBLIC_FILE_ID,
                transfer_model,
                true(),
                user_data_scope_sql,
                true(),
            )
        )

    assert get_user.await_args_list[-1].args[2] is user_data_scope_sql
    assert scope_error.value.message == '目标用户或部门不存在、已停用或超出数据权限'
    transfer_files.assert_not_awaited()
    query_db.rollback.assert_awaited_once()


def test_transfer_file_rejects_owner_department_mismatch() -> None:
    """移交文件时拒绝所有者与部门不匹配的请求。"""
    query_db = make_query_db()
    transfer_model = TransferFileModel(owner_user_id=TARGET_USER_ID, dept_id=TARGET_DEPT_ID, reason='岗位调整')

    with (
        patch.object(
            FileInfoDao,
            'get_transfer_user_by_id',
            new=AsyncMock(return_value=SimpleNamespace(user_id=TARGET_USER_ID, dept_id=120)),
        ),
        patch.object(
            FileInfoDao,
            'get_transfer_dept_by_id',
            new=AsyncMock(return_value=SimpleNamespace(dept_id=TARGET_DEPT_ID)),
        ),
        patch.object(FileInfoDao, 'transfer_file_infos', new_callable=AsyncMock) as transfer_files,
        pytest.raises(ServiceException) as mismatch_error,
    ):
        asyncio.run(
            FileTransferService.transfer_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                PUBLIC_FILE_ID,
                transfer_model,
                true(),
                true(),
                true(),
            )
        )

    assert mismatch_error.value.message == '目标用户不属于所选部门'
    transfer_files.assert_not_awaited()
    query_db.rollback.assert_awaited_once()


def test_transfer_file_rejects_source_outside_data_scope() -> None:
    """拒绝移交数据范围外的源文件。"""
    query_db = make_query_db()
    transfer_model = TransferFileModel(owner_user_id=TARGET_USER_ID, dept_id=TARGET_DEPT_ID, reason='岗位调整')
    file_data_scope_sql = false()

    with (
        patch.object(
            FileInfoDao,
            'get_transfer_user_by_id',
            new=AsyncMock(return_value=SimpleNamespace(user_id=TARGET_USER_ID, dept_id=TARGET_DEPT_ID)),
        ),
        patch.object(
            FileInfoDao,
            'get_transfer_dept_by_id',
            new=AsyncMock(return_value=SimpleNamespace(dept_id=TARGET_DEPT_ID)),
        ),
        patch.object(FileInfoDao, 'get_file_infos_by_ids_for_update', new=AsyncMock(return_value=[])) as get_files,
        patch.object(FileInfoDao, 'transfer_file_infos', new_callable=AsyncMock) as transfer_files,
        pytest.raises(ServiceException) as scope_error,
    ):
        asyncio.run(
            FileTransferService.transfer_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                PUBLIC_FILE_ID,
                transfer_model,
                file_data_scope_sql,
                true(),
                true(),
            )
        )

    assert get_files.await_args_list[-1].args[2] is file_data_scope_sql
    assert scope_error.value.message == '部分文件不存在、已删除或超出数据权限'
    transfer_files.assert_not_awaited()
    query_db.rollback.assert_awaited_once()


def test_delete_file_moves_both_storage_types_to_recycle_bin(tmp_path: Path) -> None:
    """删除两种存储类型的文件时均移入回收站。"""
    public_root = tmp_path / 'public'
    private_root = tmp_path / 'private'
    trash_root = tmp_path / 'trash'
    public_file = public_root / 'upload' / 'public.txt'
    private_file = private_root / 'upload' / 'private.txt'
    public_file.parent.mkdir(parents=True)
    private_file.parent.mkdir(parents=True)
    public_file.write_bytes(b'public-content')
    private_file.write_bytes(b'private-content')
    file_infos = [
        make_file_info(PUBLIC_FILE_ID, 'public', 'upload/public.txt', 'public.txt'),
        make_file_info(PRIVATE_FILE_ID, 'private', 'upload/private.txt', 'private.txt'),
    ]
    query_db = make_query_db()
    query_db.commit.side_effect = lambda: expire_model_attributes(*file_infos)

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(public_root)),
        patch.object(UploadConfig, 'PRIVATE_UPLOAD_PATH', str(private_root)),
        patch.object(UploadConfig, 'FILE_TRASH_PATH', str(trash_root)),
        patch.object(FileInfoDao, 'get_file_infos_by_ids_for_update', new=AsyncMock(return_value=file_infos)),
        patch.object(FileInfoDao, 'soft_delete_file_infos', new_callable=AsyncMock) as soft_delete_file_infos,
        patch.object(FileAuditService, 'enqueue_file_audit', new_callable=AsyncMock) as enqueue_file_audit,
    ):
        result = asyncio.run(
            FileLifecycleService.delete_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                DeleteFileModel(file_ids=f'{PUBLIC_FILE_ID},{PRIVATE_FILE_ID}'),
                true(),
            )
        )

    assert result.is_success is True
    assert not public_file.exists()
    assert not private_file.exists()
    assert (trash_root / PUBLIC_FILE_ID / 'public.txt').read_bytes() == b'public-content'
    assert (trash_root / PRIVATE_FILE_ID / 'private.txt').read_bytes() == b'private-content'
    assert soft_delete_file_infos.await_args_list[-1].args[1] == [PUBLIC_FILE_ID, PRIVATE_FILE_ID]
    query_db.commit.assert_awaited_once()
    assert enqueue_file_audit.await_count == BATCH_FILE_COUNT
    assert [item.args[2:5] for item in enqueue_file_audit.await_args_list] == [
        (PUBLIC_FILE_ID, 'delete', 'completed'),
        (PRIVATE_FILE_ID, 'delete', 'completed'),
    ]


def test_delete_file_rejects_business_reference_before_moving_file(tmp_path: Path) -> None:
    """删除文件前检查业务引用。"""
    public_root = tmp_path / 'public'
    public_file = public_root / 'upload' / 'public.txt'
    public_file.parent.mkdir(parents=True)
    public_file.write_bytes(b'public-content')
    file_infos = [make_file_info(PUBLIC_FILE_ID, 'public', 'upload/public.txt', 'public.txt')]
    query_db = make_query_db()

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(public_root)),
        patch.object(FileInfoDao, 'get_file_infos_by_ids_for_update', new=AsyncMock(return_value=file_infos)),
        patch.object(
            FileReferenceDao,
            'get_file_reference_count_map',
            new=AsyncMock(return_value={PUBLIC_FILE_ID: 1}),
        ),
        patch.object(FileInfoDao, 'soft_delete_file_infos', new_callable=AsyncMock) as soft_delete_file_infos,
        patch.object(FileAuditService, 'enqueue_file_audit', new_callable=AsyncMock) as enqueue_file_audit,
        pytest.raises(ServiceException) as reference_error,
    ):
        asyncio.run(
            FileLifecycleService.delete_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                DeleteFileModel(file_ids=PUBLIC_FILE_ID),
                true(),
            )
        )

    assert reference_error.value.message == '文件“public.txt”仍被业务引用，请先解除引用后再删除'
    assert public_file.read_bytes() == b'public-content'
    soft_delete_file_infos.assert_not_awaited()
    query_db.rollback.assert_awaited_once()
    assert enqueue_file_audit.await_args_list[-1].args[2:5] == (PUBLIC_FILE_ID, 'delete', 'denied')
    assert enqueue_file_audit.await_args_list[-1].kwargs['operation_detail']['referenceCount'] == 1


def test_delete_file_rejects_legacy_business_reference(tmp_path: Path) -> None:
    """旧版业务引用仍阻止删除文件。"""
    public_root = tmp_path / 'public'
    public_file = public_root / 'upload' / 'public.txt'
    public_file.parent.mkdir(parents=True)
    public_file.write_bytes(b'public-content')
    file_infos = [
        make_file_info(
            PUBLIC_FILE_ID,
            'public',
            'upload/public.txt',
            'public.txt',
            business_type='notice',
            business_id='1',
        )
    ]
    query_db = make_query_db()

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(public_root)),
        patch.object(FileInfoDao, 'get_file_infos_by_ids_for_update', new=AsyncMock(return_value=file_infos)),
        patch.object(FileInfoDao, 'soft_delete_file_infos', new_callable=AsyncMock) as soft_delete_file_infos,
        patch.object(FileAuditService, 'enqueue_file_audit', new_callable=AsyncMock),
        pytest.raises(ServiceException),
    ):
        asyncio.run(
            FileLifecycleService.delete_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                DeleteFileModel(file_ids=PUBLIC_FILE_ID),
                true(),
            )
        )

    assert public_file.read_bytes() == b'public-content'
    soft_delete_file_infos.assert_not_awaited()
    query_db.rollback.assert_awaited_once()


def test_delete_file_restores_physical_file_when_database_commit_fails(tmp_path: Path) -> None:
    """删除事务提交失败时恢复物理文件。"""
    public_root = tmp_path / 'public'
    trash_root = tmp_path / 'trash'
    public_file = public_root / 'upload' / 'public.txt'
    public_file.parent.mkdir(parents=True)
    public_file.write_bytes(b'public-content')
    file_infos = [make_file_info(PUBLIC_FILE_ID, 'public', 'upload/public.txt', 'public.txt')]
    query_db = make_query_db(commit_error=RuntimeError('commit failed'))

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(public_root)),
        patch.object(UploadConfig, 'FILE_TRASH_PATH', str(trash_root)),
        patch.object(FileInfoDao, 'get_file_infos_by_ids_for_update', new=AsyncMock(return_value=file_infos)),
        patch.object(FileInfoDao, 'soft_delete_file_infos', new_callable=AsyncMock),
        pytest.raises(RuntimeError),
    ):
        asyncio.run(
            FileLifecycleService.delete_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                DeleteFileModel(file_ids=PUBLIC_FILE_ID),
                true(),
            )
        )

    assert public_file.read_bytes() == b'public-content'
    assert [path for path in trash_root.rglob('*') if path.is_file()] == []
    query_db.rollback.assert_awaited_once()


def test_delete_file_rejects_storage_path_escape(tmp_path: Path) -> None:
    """删除文件时拒绝越界的存储路径。"""
    public_root = tmp_path / 'public'
    public_root.mkdir()
    outside_file = tmp_path / 'outside.txt'
    outside_file.write_bytes(b'outside-content')
    file_infos = [make_file_info(PUBLIC_FILE_ID, 'public', '../outside.txt', 'outside.txt')]
    query_db = make_query_db()

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(public_root)),
        patch.object(FileInfoDao, 'get_file_infos_by_ids_for_update', new=AsyncMock(return_value=file_infos)),
        patch.object(FileInfoDao, 'soft_delete_file_infos', new_callable=AsyncMock) as soft_delete_file_infos,
        pytest.raises(ServiceException),
    ):
        asyncio.run(
            FileLifecycleService.delete_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                DeleteFileModel(file_ids=PUBLIC_FILE_ID),
                true(),
            )
        )

    assert outside_file.read_bytes() == b'outside-content'
    soft_delete_file_infos.assert_not_awaited()
    query_db.rollback.assert_awaited_once()


def test_delete_file_does_not_overwrite_existing_recycle_bin_file(tmp_path: Path) -> None:
    """删除时保留回收站内的同名文件。"""
    public_root = tmp_path / 'public'
    trash_root = tmp_path / 'trash'
    public_file = public_root / 'upload' / 'public.txt'
    trash_file = trash_root / PUBLIC_FILE_ID / 'public.txt'
    public_file.parent.mkdir(parents=True)
    trash_file.parent.mkdir(parents=True)
    public_file.write_bytes(b'current-content')
    trash_file.write_bytes(b'existing-content')
    file_infos = [make_file_info(PUBLIC_FILE_ID, 'public', 'upload/public.txt', 'public.txt')]
    query_db = make_query_db()

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(public_root)),
        patch.object(UploadConfig, 'FILE_TRASH_PATH', str(trash_root)),
        patch.object(FileInfoDao, 'get_file_infos_by_ids_for_update', new=AsyncMock(return_value=file_infos)),
        patch.object(FileInfoDao, 'soft_delete_file_infos', new_callable=AsyncMock) as soft_delete_file_infos,
        pytest.raises(ServiceException),
    ):
        asyncio.run(
            FileLifecycleService.delete_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                DeleteFileModel(file_ids=PUBLIC_FILE_ID),
                true(),
            )
        )

    assert public_file.read_bytes() == b'current-content'
    assert trash_file.read_bytes() == b'existing-content'
    soft_delete_file_infos.assert_not_awaited()
    query_db.rollback.assert_awaited_once()


def test_delete_file_restores_already_staged_files_when_later_path_is_invalid(tmp_path: Path) -> None:
    """后续路径无效时恢复先前已移入回收站的文件。"""
    public_root = tmp_path / 'public'
    valid_file = public_root / 'upload' / 'public.txt'
    valid_file.parent.mkdir(parents=True)
    valid_file.write_bytes(b'public-content')
    outside_file = tmp_path / 'outside.txt'
    outside_file.write_bytes(b'outside-content')
    file_infos = [
        make_file_info(PUBLIC_FILE_ID, 'public', 'upload/public.txt', 'public.txt'),
        make_file_info(PRIVATE_FILE_ID, 'public', '../outside.txt', 'outside.txt'),
    ]
    query_db = make_query_db()

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(public_root)),
        patch.object(FileInfoDao, 'get_file_infos_by_ids_for_update', new=AsyncMock(return_value=file_infos)),
        patch.object(FileInfoDao, 'soft_delete_file_infos', new_callable=AsyncMock) as soft_delete_file_infos,
        pytest.raises(ServiceException),
    ):
        asyncio.run(
            FileLifecycleService.delete_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                DeleteFileModel(file_ids=f'{PUBLIC_FILE_ID},{PRIVATE_FILE_ID}'),
                true(),
            )
        )

    assert valid_file.read_bytes() == b'public-content'
    assert outside_file.read_bytes() == b'outside-content'
    soft_delete_file_infos.assert_not_awaited()
    query_db.rollback.assert_awaited_once()


def test_delete_file_allows_missing_physical_file_to_close_metadata(tmp_path: Path) -> None:
    """物理文件缺失时允许关闭元数据记录。"""
    public_root = tmp_path / 'public'
    public_root.mkdir()
    file_infos = [make_file_info(PUBLIC_FILE_ID, 'public', 'upload/missing.txt', 'missing.txt')]
    query_db = make_query_db()

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(public_root)),
        patch.object(FileInfoDao, 'get_file_infos_by_ids_for_update', new=AsyncMock(return_value=file_infos)),
        patch.object(FileInfoDao, 'soft_delete_file_infos', new_callable=AsyncMock) as soft_delete_file_infos,
    ):
        result = asyncio.run(
            FileLifecycleService.delete_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                DeleteFileModel(file_ids=PUBLIC_FILE_ID),
                true(),
            )
        )

    assert result.is_success is True
    soft_delete_file_infos.assert_awaited_once()
    query_db.commit.assert_awaited_once()


def test_delete_file_rejects_invalid_or_missing_file_ids() -> None:
    """删除时拒绝无效或缺失的文件标识。"""
    with pytest.raises(ServiceException):
        FileUtil.parse_file_ids('invalid-id')

    query_db = make_query_db()
    with (
        patch.object(FileInfoDao, 'get_file_infos_by_ids_for_update', new=AsyncMock(return_value=[])),
        pytest.raises(ServiceException),
    ):
        asyncio.run(
            FileLifecycleService.delete_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                DeleteFileModel(file_ids=PUBLIC_FILE_ID),
                true(),
            )
        )

    query_db.rollback.assert_awaited_once()


def test_delete_file_rejects_file_outside_data_scope() -> None:
    """拒绝删除数据范围外的文件。"""
    query_db = make_query_db()
    file_data_scope_sql = false()

    with (
        patch.object(
            FileInfoDao,
            'get_file_infos_by_ids_for_update',
            new=AsyncMock(return_value=[]),
        ) as get_file_infos,
        patch.object(FileInfoDao, 'soft_delete_file_infos', new_callable=AsyncMock) as soft_delete_file_infos,
        pytest.raises(ServiceException) as scope_error,
    ):
        asyncio.run(
            FileLifecycleService.delete_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                DeleteFileModel(file_ids=PUBLIC_FILE_ID),
                file_data_scope_sql,
            )
        )

    assert get_file_infos.await_args_list[-1].args[2] is file_data_scope_sql
    assert scope_error.value.message == '部分文件不存在、已删除或超出数据权限'
    soft_delete_file_infos.assert_not_awaited()
    query_db.rollback.assert_awaited_once()


def test_restore_file_moves_both_storage_types_out_of_recycle_bin(tmp_path: Path) -> None:
    """两种存储类型的文件均可从回收站恢复。"""
    public_root = tmp_path / 'public'
    private_root = tmp_path / 'private'
    trash_root = tmp_path / 'trash'
    public_trash_file = trash_root / PUBLIC_FILE_ID / 'public.txt'
    private_trash_file = trash_root / PRIVATE_FILE_ID / 'private.txt'
    public_trash_file.parent.mkdir(parents=True)
    private_trash_file.parent.mkdir(parents=True)
    public_trash_file.write_bytes(b'public-content')
    private_trash_file.write_bytes(b'private-content')
    file_infos = [
        make_file_info(PUBLIC_FILE_ID, 'public', 'upload/public.txt', 'public.txt'),
        make_file_info(PRIVATE_FILE_ID, 'private', 'upload/private.txt', 'private.txt'),
    ]
    query_db = make_query_db()
    query_db.commit.side_effect = lambda: expire_model_attributes(*file_infos)
    move_file = UploadUtil.move_file

    def move_file_after_database_commit(source: Path, target: Path) -> None:
        """
        确认数据库已提交后移动文件。

        :param source: 本次文件操作的源路径
        :param target: 本次操作的目标
        """
        query_db.commit.assert_awaited_once()
        move_file(source, target)

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(public_root)),
        patch.object(UploadConfig, 'PRIVATE_UPLOAD_PATH', str(private_root)),
        patch.object(UploadConfig, 'FILE_TRASH_PATH', str(trash_root)),
        patch.object(
            FileInfoDao,
            'get_deleted_file_infos_by_ids_for_update',
            new=AsyncMock(return_value=file_infos),
        ),
        patch.object(FileInfoDao, 'restore_file_infos', new_callable=AsyncMock) as restore_file_infos,
        patch.object(UploadUtil, 'move_file', side_effect=move_file_after_database_commit),
        patch.object(FileAuditService, 'enqueue_file_audit', new_callable=AsyncMock) as enqueue_file_audit,
    ):
        result = asyncio.run(
            FileLifecycleService.restore_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                f'{PUBLIC_FILE_ID},{PRIVATE_FILE_ID}',
                true(),
            )
        )

    assert result.is_success is True
    assert (public_root / 'upload' / 'public.txt').read_bytes() == b'public-content'
    assert (private_root / 'upload' / 'private.txt').read_bytes() == b'private-content'
    assert not public_trash_file.exists()
    assert not private_trash_file.exists()
    assert restore_file_infos.await_args_list[-1].args[1] == [PUBLIC_FILE_ID, PRIVATE_FILE_ID]
    query_db.commit.assert_awaited_once()
    assert enqueue_file_audit.await_count == BATCH_FILE_COUNT
    assert [item.args[2:5] for item in enqueue_file_audit.await_args_list] == [
        (PUBLIC_FILE_ID, 'restore', 'completed'),
        (PRIVATE_FILE_ID, 'restore', 'completed'),
    ]


def test_restore_file_returns_physical_file_to_recycle_bin_when_database_commit_fails(tmp_path: Path) -> None:
    """恢复事务提交失败时将物理文件移回回收站。"""
    public_root = tmp_path / 'public'
    trash_root = tmp_path / 'trash'
    trash_file = trash_root / PUBLIC_FILE_ID / 'public.txt'
    trash_file.parent.mkdir(parents=True)
    trash_file.write_bytes(b'public-content')
    file_infos = [make_file_info(PUBLIC_FILE_ID, 'public', 'upload/public.txt', 'public.txt')]
    query_db = make_query_db(commit_error=RuntimeError('commit failed'))

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(public_root)),
        patch.object(UploadConfig, 'FILE_TRASH_PATH', str(trash_root)),
        patch.object(
            FileInfoDao,
            'get_deleted_file_infos_by_ids_for_update',
            new=AsyncMock(return_value=file_infos),
        ),
        patch.object(FileInfoDao, 'restore_file_infos', new_callable=AsyncMock),
        pytest.raises(RuntimeError),
    ):
        asyncio.run(
            FileLifecycleService.restore_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                PUBLIC_FILE_ID,
                true(),
            )
        )

    assert trash_file.read_bytes() == b'public-content'
    assert not (public_root / 'upload' / 'public.txt').exists()
    query_db.rollback.assert_awaited_once()


def test_restore_file_compensates_metadata_when_file_move_fails(tmp_path: Path) -> None:
    """移动文件失败时补偿恢复操作的元数据。"""
    public_root = tmp_path / 'public'
    private_root = tmp_path / 'private'
    trash_root = tmp_path / 'trash'
    public_trash_file = trash_root / PUBLIC_FILE_ID / 'public.txt'
    private_trash_file = trash_root / PRIVATE_FILE_ID / 'private.txt'
    public_trash_file.parent.mkdir(parents=True)
    private_trash_file.parent.mkdir(parents=True)
    public_trash_file.write_bytes(b'public-content')
    private_trash_file.write_bytes(b'private-content')
    file_infos = [
        make_file_info(PUBLIC_FILE_ID, 'public', 'upload/public.txt', 'public.txt'),
        make_file_info(PRIVATE_FILE_ID, 'private', 'upload/private.txt', 'private.txt'),
    ]
    query_db = make_query_db()
    move_file = UploadUtil.move_file
    move_count = 0
    failed_move_number = 2
    expected_commit_count = 2

    def fail_second_move(source: Path, target: Path) -> None:
        """
        在第二次文件移动时注入故障。

        :param source: 本次文件操作的源路径
        :param target: 本次操作的目标
        :raises OSError: 模拟移动第二个文件失败
        """
        nonlocal move_count
        move_count += 1
        if move_count == failed_move_number:
            raise OSError('move failed')
        move_file(source, target)

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(public_root)),
        patch.object(UploadConfig, 'PRIVATE_UPLOAD_PATH', str(private_root)),
        patch.object(UploadConfig, 'FILE_TRASH_PATH', str(trash_root)),
        patch.object(
            FileInfoDao,
            'get_deleted_file_infos_by_ids_for_update',
            new=AsyncMock(return_value=file_infos),
        ),
        patch.object(FileInfoDao, 'restore_file_infos', new_callable=AsyncMock),
        patch.object(FileInfoDao, 'soft_delete_file_infos', new_callable=AsyncMock) as soft_delete_file_infos,
        patch.object(UploadUtil, 'move_file', side_effect=fail_second_move),
        pytest.raises(ServiceException) as restore_error,
    ):
        asyncio.run(
            FileLifecycleService.restore_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                f'{PUBLIC_FILE_ID},{PRIVATE_FILE_ID}',
                true(),
            )
        )

    assert restore_error.value.message == '文件从回收区恢复失败'
    assert public_trash_file.read_bytes() == b'public-content'
    assert private_trash_file.read_bytes() == b'private-content'
    assert not (public_root / 'upload' / 'public.txt').exists()
    assert not (private_root / 'upload' / 'private.txt').exists()
    soft_delete_file_infos.assert_awaited_once()
    assert query_db.commit.await_count == expected_commit_count


def test_restore_file_rejects_existing_original_path(tmp_path: Path) -> None:
    """原路径已存在时拒绝恢复。"""
    public_root = tmp_path / 'public'
    trash_root = tmp_path / 'trash'
    public_file = public_root / 'upload' / 'public.txt'
    trash_file = trash_root / PUBLIC_FILE_ID / 'public.txt'
    public_file.parent.mkdir(parents=True)
    trash_file.parent.mkdir(parents=True)
    public_file.write_bytes(b'current-content')
    trash_file.write_bytes(b'deleted-content')
    file_infos = [make_file_info(PUBLIC_FILE_ID, 'public', 'upload/public.txt', 'public.txt')]
    query_db = make_query_db()

    with (
        patch.object(UploadConfig, 'UPLOAD_PATH', str(public_root)),
        patch.object(UploadConfig, 'FILE_TRASH_PATH', str(trash_root)),
        patch.object(
            FileInfoDao,
            'get_deleted_file_infos_by_ids_for_update',
            new=AsyncMock(return_value=file_infos),
        ),
        patch.object(FileInfoDao, 'restore_file_infos', new_callable=AsyncMock) as restore_file_infos,
        pytest.raises(ServiceException) as restore_error,
    ):
        asyncio.run(
            FileLifecycleService.restore_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                PUBLIC_FILE_ID,
                true(),
            )
        )

    assert restore_error.value.message == '文件从回收区恢复失败'
    assert public_file.read_bytes() == b'current-content'
    assert trash_file.read_bytes() == b'deleted-content'
    restore_file_infos.assert_not_awaited()
    query_db.rollback.assert_awaited_once()


def test_restore_file_rejects_file_outside_data_scope() -> None:
    """拒绝恢复数据范围外的文件。"""
    query_db = make_query_db()
    file_data_scope_sql = false()

    with (
        patch.object(
            FileInfoDao,
            'get_deleted_file_infos_by_ids_for_update',
            new=AsyncMock(return_value=[]),
        ) as get_file_infos,
        patch.object(FileInfoDao, 'restore_file_infos', new_callable=AsyncMock) as restore_file_infos,
        pytest.raises(ServiceException) as scope_error,
    ):
        asyncio.run(
            FileLifecycleService.restore_file_services(
                query_db,
                make_current_user(1, user_name='admin', admin=True),
                PUBLIC_FILE_ID,
                file_data_scope_sql,
            )
        )

    assert get_file_infos.await_args_list[-1].args[2] is file_data_scope_sql
    assert scope_error.value.message == '部分文件不存在、未删除或超出数据权限'
    restore_file_infos.assert_not_awaited()
    query_db.rollback.assert_awaited_once()
