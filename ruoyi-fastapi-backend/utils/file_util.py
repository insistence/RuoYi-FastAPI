import hashlib
import os
import re
import shutil
import time
import uuid
from collections.abc import AsyncGenerator, Iterator, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from config.env import UploadConfig
from exceptions.exception import FileRangeNotSatisfiableException, ServiceException
from utils.log_util import logger
from utils.upload_util import FilePathUtil, UploadUtil


class FileStorageInfo(Protocol):
    """
    文件存储信息协议。

    :ivar file_id: 文件ID
    :ivar storage_type: 文件存储类型
    :ivar access_type: 文件访问类型
    :ivar storage_key: 存储相对路径
    :ivar stored_name: 存储文件名
    """

    file_id: str
    storage_type: str
    access_type: str
    storage_key: str
    stored_name: str


@dataclass(frozen=True)
class FileByteRange:
    """
    文件字节范围。

    :ivar start: 响应包含的第一个字节偏移
    :ivar end: 响应包含的最后一个字节偏移
    :ivar file_size: 文件总大小
    :ivar is_partial: 是否按客户端请求只返回部分字节
    """

    start: int
    end: int
    file_size: int
    is_partial: bool

    @property
    def length(self) -> int:
        """
        获取范围字节数。

        :return: 范围字节数
        """
        return max(self.end - self.start + 1, 0)


@dataclass(frozen=True)
class FileDownloadResult:
    """
    文件下载结果。

    :ivar data: 要写入下载响应的文件内容
    :ivar filename: 浏览器下载时使用的文件名
    :ivar byte_range: 文件字节范围
    :ivar accept_ranges: 是否支持Range请求
    """

    data: AsyncGenerator[bytes, None]
    filename: str
    byte_range: FileByteRange
    accept_ranges: bool = True


@dataclass(frozen=True)
class StagedFile:
    """
    待删除文件暂存信息。

    :ivar source_path: 操作前文件所在的路径
    :ivar trash_path: 文件移入回收区后的路径
    """

    source_path: Path
    trash_path: Path


@dataclass(frozen=True)
class FileReconcileFinding:
    """
    文件存储对账异常。

    :ivar issue_key: 异常唯一标识
    :ivar issue_type: 异常类型
    :ivar severity: 问题的严重程度
    :ivar detail: 用于说明当前结果的详细信息
    :ivar file_id: 文件ID
    :ivar storage_type: 文件存储类型
    :ivar access_type: 文件访问类型
    :ivar expected_root: 记录声明的存储根目录
    :ivar expected_key: 记录声明的存储对象键
    :ivar actual_root: 实际存储根目录
    :ivar actual_key: 扫描到的存储对象键
    :ivar expected_size: 预期文件大小
    :ivar actual_size: 实际文件大小
    :ivar expected_hash: 预期SHA-256
    :ivar actual_hash: 实际SHA-256
    """

    issue_key: str
    issue_type: str
    severity: str
    detail: str
    file_id: str | None = None
    storage_type: str | None = None
    access_type: str | None = None
    expected_root: str | None = None
    expected_key: str | None = None
    actual_root: str | None = None
    actual_key: str | None = None
    expected_size: int | None = None
    actual_size: int | None = None
    expected_hash: str | None = None
    actual_hash: str | None = None


@dataclass(frozen=True)
class FileReconcileScanResult:
    """
    文件存储对账扫描结果。

    :ivar findings: 本次扫描发现的对账问题
    :ivar scanned_file_count: 已检查的文件记录数量
    :ivar scanned_storage_count: 已扫描的存储对象数量
    """

    findings: list[FileReconcileFinding]
    scanned_file_count: int
    scanned_storage_count: int


@dataclass(frozen=True)
class _FileReconcileContext:
    """
    文件存储对账内部上下文。

    :ivar file_info: 文件信息
    :ivar source_root: 来源存储区域
    :ivar source_key: 来源相对路径
    :ivar source_path: 操作前文件所在的路径
    :ivar trash_key: 文件在回收区中的存储键
    :ivar trash_path: 文件移入回收区后的路径
    """

    file_info: dict[str, Any]
    source_root: str
    source_key: str
    source_path: Path
    trash_key: str
    trash_path: Path


class FileUtil:
    """
    文件工具类。

    :cvar FILE_RANGE_PATTERN: 解析 HTTP 字节范围请求头的正则表达式
    """

    FILE_RANGE_PATTERN = re.compile(r'^bytes=(\d*)-(\d*)$', re.IGNORECASE)

    @classmethod
    def parse_byte_range(cls, range_header: str | None, file_size: int) -> FileByteRange:
        """
        解析HTTP单区间Range请求头。

        :param range_header: Range请求头
        :param file_size: 文件总大小
        :return: 文件字节范围
        :raises ValueError: 文件大小不能小于0
        :raises FileRangeNotSatisfiableException: 字节范围格式无效、包含多段或无法满足
        """
        if file_size < 0:
            raise ValueError('文件大小不能小于0')
        if not range_header:
            return FileByteRange(
                start=0,
                end=file_size - 1,
                file_size=file_size,
                is_partial=False,
            )

        range_match = cls.FILE_RANGE_PATTERN.fullmatch(range_header.strip())
        if range_match is None or file_size == 0:
            raise FileRangeNotSatisfiableException(file_size)

        start_text, end_text = range_match.groups()
        if not start_text and not end_text:
            raise FileRangeNotSatisfiableException(file_size)

        if not start_text:
            suffix_length = int(end_text)
            if suffix_length <= 0:
                raise FileRangeNotSatisfiableException(file_size)
            start = max(file_size - suffix_length, 0)
            end = file_size - 1
        else:
            start = int(start_text)
            if start >= file_size:
                raise FileRangeNotSatisfiableException(file_size)
            end = file_size - 1 if not end_text else min(int(end_text), file_size - 1)
            if end < start:
                raise FileRangeNotSatisfiableException(file_size)

        return FileByteRange(
            start=start,
            end=end,
            file_size=file_size,
            is_partial=True,
        )

    @classmethod
    def parse_file_ids(cls, file_ids: str) -> list[str]:
        """
        解析并校验文件ID。

        :param file_ids: 文件ID字符串
        :return: 文件ID列表
        :raises ServiceException: 文件ID不能为空；文件ID格式不正确
        """
        if not file_ids:
            raise ServiceException(message='文件ID不能为空', msg_key='file.idRequired')
        try:
            parsed_file_ids = list(
                dict.fromkeys(str(uuid.UUID(item.strip())) for item in file_ids.split(',') if item.strip())
            )
        except ValueError as exc:
            raise ServiceException(message='文件ID格式不正确', msg_key='file.invalidId') from exc
        if not parsed_file_ids:
            raise ServiceException(message='文件ID不能为空', msg_key='file.idRequired')
        return parsed_file_ids

    @classmethod
    def enrich_storage_status(cls, file_rows: list[dict[str, Any]]) -> None:
        """
        补充文件物理存储状态。

        :param file_rows: 文件信息列表
        """
        for file_row in file_rows:
            file_row['storageStatus'] = cls.get_storage_status(file_row)

    @classmethod
    def get_storage_status(cls, file_info: dict[str, Any]) -> str:
        """
        获取文件物理存储状态。

        :param file_info: 文件信息
        :return: 文件物理存储状态
        """

        def get_value(snake_name: str, camel_name: str) -> Any:
            """
            兼容蛇形和驼峰字段名读取文件状态。

            :param snake_name: 字段的下划线形式
            :param camel_name: 字段的驼峰形式
            :return: 从蛇形或驼峰字段读取的值
            """
            return file_info.get(snake_name) if snake_name in file_info else file_info.get(camel_name)

        try:
            file_id = get_value('file_id', 'fileId')
            storage_type = get_value('storage_type', 'storageType')
            access_type = get_value('access_type', 'accessType')
            storage_key = get_value('storage_key', 'storageKey')
            stored_name = get_value('stored_name', 'storedName')
            status = get_value('status', 'status')
            if storage_type != 'local' or access_type not in {'public', 'private'}:
                return 'invalid'
            storage_root = UploadConfig.UPLOAD_PATH if access_type == 'public' else UploadConfig.PRIVATE_UPLOAD_PATH
            source_path = FilePathUtil.resolve_path_within_root(storage_root, storage_key)
            trash_path = FilePathUtil.resolve_path_within_root(
                UploadConfig.FILE_TRASH_PATH,
                f'{file_id}/{stored_name}',
            )
            source_exists = source_path.exists()
            trash_exists = trash_path.exists()
            if source_exists and not source_path.is_file():
                return 'invalid'
            if trash_exists and not trash_path.is_file():
                return 'invalid'
            if status in {'deleted', 'purging'}:
                if trash_exists and not source_exists:
                    return 'quarantined'
                return 'invalid' if source_exists else 'missing'
            if source_exists and not trash_exists:
                return 'normal'
            if trash_exists and not source_exists:
                return 'quarantined'
            return 'invalid' if source_exists and trash_exists else 'missing'
        except (AttributeError, OSError, TypeError, ValueError):
            return 'invalid'

    @classmethod
    def stage_file_deletions(cls, file_infos: Sequence[FileStorageInfo]) -> list[StagedFile]:
        """
        将待删除文件移入回收区。

        :param file_infos: 文件信息列表
        :return: 暂存文件列表
        :raises Exception: 底层操作失败时向调用方传播异常
        """
        staged_files = []
        try:
            for file_info in file_infos:
                staged_file = cls._get_staged_file_paths(file_info)
                if not staged_file.source_path.exists():
                    if staged_file.trash_path.exists():
                        if not staged_file.trash_path.is_file():
                            raise ValueError('回收区路径不是普通文件')
                        staged_files.append(staged_file)
                    continue
                if not staged_file.source_path.is_file():
                    raise ValueError('待删除路径不是普通文件')
                if staged_file.trash_path.exists():
                    raise FileExistsError('回收区目标文件已存在')
                UploadUtil.move_file(staged_file.source_path, staged_file.trash_path)
                staged_files.append(staged_file)
        except Exception:
            cls.restore_staged_files(staged_files)
            raise
        return staged_files

    @classmethod
    def _get_staged_file_paths(cls, file_info: FileStorageInfo) -> StagedFile:
        """
        获取文件原路径和回收区路径。

        :param file_info: 文件信息
        :return: 文件暂存信息
        :raises ValueError: 文件存储类型或访问类型异常
        """
        if file_info.storage_type != 'local' or file_info.access_type not in {'public', 'private'}:
            raise ValueError('文件存储类型或访问类型异常')
        storage_root = (
            UploadConfig.UPLOAD_PATH if file_info.access_type == 'public' else UploadConfig.PRIVATE_UPLOAD_PATH
        )
        source_path = FilePathUtil.resolve_path_within_root(storage_root, file_info.storage_key)
        trash_path = FilePathUtil.resolve_path_within_root(
            UploadConfig.FILE_TRASH_PATH,
            f'{file_info.file_id}/{file_info.stored_name}',
        )
        return StagedFile(source_path=source_path, trash_path=trash_path)

    @classmethod
    def restore_staged_files(cls, staged_files: list[StagedFile]) -> None:
        """
        将隔离区文件恢复到原路径。

        :param staged_files: 暂存文件列表
        """
        for staged_file in reversed(staged_files):
            try:
                if staged_file.trash_path.exists():
                    if staged_file.source_path.exists():
                        logger.error(f'文件删除回滚失败，原路径已存在: {staged_file.source_path}')
                        continue
                    UploadUtil.move_file(staged_file.trash_path, staged_file.source_path)
                    UploadUtil.remove_empty_directory(staged_file.trash_path.parent)
            except OSError as exc:
                logger.error(f'文件删除回滚失败: {exc}')

    @classmethod
    def prepare_deleted_files_for_restore(cls, file_infos: Sequence[FileStorageInfo]) -> list[StagedFile]:
        """
        校验待恢复文件并生成暂存信息。

        :param file_infos: 文件信息列表
        :return: 暂存文件列表
        :raises FileNotFoundError: 回收区文件不存在
        :raises FileExistsError: 文件原路径已存在
        """
        staged_files = []
        for file_info in file_infos:
            staged_file = cls._get_staged_file_paths(file_info)
            if not staged_file.trash_path.exists() or not staged_file.trash_path.is_file():
                raise FileNotFoundError('回收区文件不存在')
            if staged_file.source_path.exists():
                raise FileExistsError('文件原路径已存在')
            staged_files.append(staged_file)
        return staged_files

    @classmethod
    def prepare_deleted_files_for_purge(cls, file_infos: Sequence[FileStorageInfo]) -> list[StagedFile]:
        """
        校验待永久清理文件并生成暂存信息。

        :param file_infos: 文件信息列表
        :return: 暂存文件列表
        :raises FileExistsError: 待清理文件仍存在于正式存储目录
        :raises ValueError: 回收区路径不是普通文件
        """
        staged_files = []
        for file_info in file_infos:
            staged_file = cls._get_staged_file_paths(file_info)
            if staged_file.source_path.exists():
                raise FileExistsError('待清理文件仍存在于正式存储目录')
            if staged_file.trash_path.exists() and not staged_file.trash_path.is_file():
                raise ValueError('回收区路径不是普通文件')
            staged_files.append(staged_file)
        return staged_files

    @classmethod
    def purge_deleted_files(cls, staged_files: list[StagedFile]) -> None:
        """
        永久删除回收区文件。

        :param staged_files: 暂存文件列表
        :raises FileExistsError: 待清理文件仍存在于正式存储目录
        :raises ValueError: 回收区路径不是普通文件
        """
        for staged_file in staged_files:
            if staged_file.source_path.exists():
                raise FileExistsError('待清理文件仍存在于正式存储目录')
            if staged_file.trash_path.exists():
                if not staged_file.trash_path.is_file():
                    raise ValueError('回收区路径不是普通文件')
                staged_file.trash_path.unlink()
            UploadUtil.remove_empty_directory(staged_file.trash_path.parent)

    @classmethod
    def restore_deleted_files(cls, staged_files: list[StagedFile]) -> None:
        """
        将已删除文件从回收区恢复到原路径。

        :param staged_files: 暂存文件列表
        :raises Exception: 底层操作失败时向调用方传播异常
        """
        restored_files = []
        try:
            for staged_file in staged_files:
                if not staged_file.trash_path.exists() or not staged_file.trash_path.is_file():
                    raise FileNotFoundError('回收区文件不存在')
                if staged_file.source_path.exists():
                    raise FileExistsError('文件原路径已存在')
                UploadUtil.move_file(staged_file.trash_path, staged_file.source_path)
                restored_files.append(staged_file)
        except Exception:
            cls._restage_restored_files(restored_files)
            raise

    @classmethod
    def _restage_restored_files(cls, staged_files: list[StagedFile]) -> None:
        """
        将恢复失败的文件重新移入回收区。

        :param staged_files: 暂存文件列表
        """
        for staged_file in reversed(staged_files):
            try:
                if staged_file.source_path.exists():
                    if staged_file.trash_path.exists():
                        logger.error(f'文件恢复回滚失败，回收区路径已存在: {staged_file.trash_path}')
                        continue
                    UploadUtil.move_file(staged_file.source_path, staged_file.trash_path)
            except OSError as exc:
                logger.error(f'文件恢复回滚失败: {exc}')

    @classmethod
    def cleanup_trash_directories(cls, staged_files: list[StagedFile]) -> None:
        """
        清理恢复后留下的空回收区目录。

        :param staged_files: 暂存文件列表
        """
        for staged_file in staged_files:
            UploadUtil.remove_empty_directory(staged_file.trash_path.parent)


class FileReconcileUtil:
    """
    文件存储对账工具类。

    :cvar MAX_SCAN_ENTRIES: 单次对账允许遍历的最大条目数
    :cvar HASH_CHUNK_SIZE: 计算文件哈希时每次读取的字节数
    :cvar ORPHAN_GRACE_SECONDS: 将未引用文件判定为孤立文件前等待的秒数
    """

    MAX_SCAN_ENTRIES = 1_000_000
    HASH_CHUNK_SIZE = 1024 * 1024
    ORPHAN_GRACE_SECONDS = 300

    @classmethod
    def scan_storage(cls, file_infos: list[dict[str, Any]], check_hash: bool = False) -> FileReconcileScanResult:
        """
        执行数据库和本地文件系统双向对账。

        :param file_infos: 文件信息列表
        :param check_hash: 是否校验文件SHA-256
        :return: 对账扫描结果
        :raises RuntimeError: 被扫描的物理文件数超过上限
        """
        roots = cls.get_storage_roots()
        cls._validate_storage_roots(roots)
        findings: list[FileReconcileFinding] = []
        contexts: list[_FileReconcileContext] = []
        expected_locations: set[tuple[str, str]] = set()

        for file_info in file_infos:
            try:
                context = cls._build_file_context(file_info, roots)
            except (AttributeError, OSError, TypeError, ValueError) as exc:
                findings.append(
                    cls.build_finding(
                        issue_type='invalid_metadata',
                        severity='critical',
                        detail=f'文件存储元数据不合法：{exc}',
                        file_id=cls._get_text_value(file_info, 'file_id'),
                        storage_type=cls._get_text_value(file_info, 'storage_type'),
                        access_type=cls._get_text_value(file_info, 'access_type'),
                        expected_key=cls._get_text_value(file_info, 'storage_key'),
                    )
                )
                continue
            contexts.append(context)
            expected_locations.add((context.source_root, context.source_key))
            expected_locations.add(('trash', context.trash_key))

        claimed_unexpected_locations: set[tuple[str, str]] = set()
        for context in contexts:
            context_findings, claimed_locations = cls._inspect_file_context(
                context,
                roots,
                expected_locations,
                check_hash,
            )
            findings.extend(context_findings)
            claimed_unexpected_locations.update(claimed_locations)

        scanned_storage_count = 0
        for root_name in ('public', 'private', 'trash'):
            root_path = roots[root_name]
            for relative_key, physical_path, is_unsafe in cls._iter_storage_entries(root_path):
                scanned_storage_count += 1
                if scanned_storage_count > cls.MAX_SCAN_ENTRIES:
                    raise RuntimeError(f'物理文件数量超过扫描上限{cls.MAX_SCAN_ENTRIES}')
                location = (root_name, relative_key)
                if is_unsafe:
                    findings.append(
                        cls.build_finding(
                            issue_type='unsafe_entry',
                            severity='critical',
                            detail='存储目录中存在符号链接或非普通文件条目',
                            actual_root=root_name,
                            actual_key=relative_key,
                        )
                    )
                elif location not in expected_locations and location not in claimed_unexpected_locations:
                    try:
                        physical_stat = physical_path.stat()
                    except FileNotFoundError:
                        continue
                    if time.time() - physical_stat.st_mtime < cls.ORPHAN_GRACE_SECONDS:
                        continue
                    findings.append(
                        cls.build_finding(
                            issue_type='orphan_file',
                            severity='warning',
                            detail='物理文件未登记到文件信息表',
                            actual_root=root_name,
                            actual_key=relative_key,
                            actual_size=physical_stat.st_size,
                            access_type=root_name if root_name in {'public', 'private'} else None,
                            storage_type='local',
                        )
                    )

        unique_findings = {finding.issue_key: finding for finding in findings}
        return FileReconcileScanResult(
            findings=list(unique_findings.values()),
            scanned_file_count=len(file_infos),
            scanned_storage_count=scanned_storage_count,
        )

    @classmethod
    def get_storage_roots(cls) -> dict[str, Path]:
        """
        获取对账使用的本地存储根目录。

        :return: 存储区域和绝对根目录映射
        """
        return {
            'public': Path(UploadConfig.UPLOAD_PATH).resolve(),
            'private': Path(UploadConfig.PRIVATE_UPLOAD_PATH).resolve(),
            'trash': Path(UploadConfig.FILE_TRASH_PATH).resolve(),
            'quarantine': Path(UploadConfig.FILE_RECONCILE_QUARANTINE_PATH).resolve(),
        }

    @classmethod
    def resolve_location(cls, root_name: str, relative_key: str) -> Path:
        """
        安全解析指定存储区域内的相对路径。

        :param root_name: 存储区域
        :param relative_key: 相对路径
        :return: 安全文件路径
        :raises ValueError: 存储区域不合法
        """
        roots = cls.get_storage_roots()
        if root_name not in roots:
            raise ValueError('存储区域不合法')
        cls._validate_storage_roots(roots)
        return cls._resolve_lexical_path(roots[root_name], relative_key)

    @classmethod
    def calculate_file_hash(cls, filepath: Path) -> str:
        """
        计算普通文件SHA-256。

        :param filepath: 文件路径
        :return: 内容的 SHA-256 摘要
        """
        return cls.calculate_file_integrity(filepath)[1]

    @classmethod
    def calculate_file_integrity(cls, filepath: Path) -> tuple[int, str]:
        """
        稳定计算普通文件大小和SHA-256。

        :param filepath: 文件路径
        :return: 文件大小和SHA-256
        :raises ValueError: 目标路径不是普通文件；文件在摘要计算期间发生变化
        """
        if filepath.is_symlink() or not filepath.is_file():
            raise ValueError('目标路径不是普通文件')
        before_stat = filepath.stat()
        file_hasher = hashlib.sha256()
        with filepath.open('rb') as file:
            while chunk := file.read(cls.HASH_CHUNK_SIZE):
                file_hasher.update(chunk)
        after_stat = filepath.stat()
        before_signature = (
            before_stat.st_dev,
            before_stat.st_ino,
            before_stat.st_size,
            before_stat.st_mtime_ns,
        )
        after_signature = (
            after_stat.st_dev,
            after_stat.st_ino,
            after_stat.st_size,
            after_stat.st_mtime_ns,
        )
        if before_signature != after_signature:
            raise ValueError('文件在摘要计算期间发生变化')
        return before_stat.st_size, file_hasher.hexdigest()

    @classmethod
    def move_regular_file(
        cls,
        source_root: str,
        source_key: str,
        target_root: str,
        target_key: str,
    ) -> tuple[Path, Path]:
        """
        在受控存储区域之间移动普通文件。

        :param source_root: 来源存储区域
        :param source_key: 来源相对路径
        :param target_root: 目标存储区域
        :param target_key: 目标相对路径
        :return: 来源和目标文件路径
        :raises ValueError: 来源路径不是普通文件
        :raises FileExistsError: 目标路径已存在
        :raises OSError: 文件移动结果校验失败
        """
        source_path = cls.resolve_location(source_root, source_key)
        target_path = cls.resolve_location(target_root, target_key)
        if source_path.is_symlink() or not source_path.is_file():
            raise ValueError('来源路径不是普通文件')
        if target_path.exists() or target_path.is_symlink():
            raise FileExistsError('目标路径已存在')
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source_path), str(target_path))
        if not target_path.is_file() or target_path.is_symlink():
            raise OSError('文件移动结果校验失败')
        UploadUtil.remove_empty_directory(source_path.parent)
        return source_path, target_path

    @classmethod
    def delete_quarantine_file(cls, quarantine_key: str) -> Path:
        """
        永久删除隔离区普通文件。

        :param quarantine_key: 隔离区相对路径
        :return: 已删除文件路径
        :raises ValueError: 隔离区目标不是普通文件
        """
        quarantine_path = cls.resolve_location('quarantine', quarantine_key)
        if quarantine_path.is_symlink() or not quarantine_path.is_file():
            raise ValueError('隔离区目标不是普通文件')
        quarantine_path.unlink()
        UploadUtil.remove_empty_directory(quarantine_path.parent)
        return quarantine_path

    @classmethod
    def build_finding(
        cls,
        issue_type: str,
        severity: str,
        detail: str,
        **metadata: Any,
    ) -> FileReconcileFinding:
        """
        构造包含稳定唯一标识的对账异常。

        :param issue_type: 异常类型
        :param severity: 问题的严重程度
        :param detail: 用于说明当前结果的详细信息
        :param metadata: 调用方按名称传入的附加选项
        :return: 对账异常
        """
        identity = '|'.join(
            [
                issue_type,
                metadata.get('file_id') or '',
                metadata.get('expected_root') or '',
                metadata.get('expected_key') or '',
                metadata.get('actual_root') or '',
                metadata.get('actual_key') or '',
            ]
        )
        return FileReconcileFinding(
            issue_key=hashlib.sha256(identity.encode('utf-8')).hexdigest(),
            issue_type=issue_type,
            severity=severity,
            detail=detail,
            file_id=metadata.get('file_id'),
            storage_type=metadata.get('storage_type'),
            access_type=metadata.get('access_type'),
            expected_root=metadata.get('expected_root'),
            expected_key=metadata.get('expected_key'),
            actual_root=metadata.get('actual_root'),
            actual_key=metadata.get('actual_key'),
            expected_size=metadata.get('expected_size'),
            actual_size=metadata.get('actual_size'),
            expected_hash=metadata.get('expected_hash'),
            actual_hash=metadata.get('actual_hash'),
        )

    @classmethod
    def _build_file_context(
        cls,
        file_info: dict[str, Any],
        roots: dict[str, Path],
    ) -> _FileReconcileContext:
        """
        构建对账检查使用的文件信息及路径上下文。

        :param file_info: 文件信息
        :param roots: 需要检查的文件存储根目录集合
        :raises ValueError: 文件ID为空；暂不支持非本地存储类型；访问类型不合法；存储路径或存储文件名为空；存储文件名包含路径信息；存储路径和存储文件名不一致；文件状态和删除标志不一致；文件状态不合法
        :return: 对账检查使用的文件信息及路径上下文
        """
        file_id = cls._get_text_value(file_info, 'file_id')
        storage_type = cls._get_text_value(file_info, 'storage_type')
        access_type = cls._get_text_value(file_info, 'access_type')
        storage_key = cls._get_text_value(file_info, 'storage_key')
        stored_name = cls._get_text_value(file_info, 'stored_name')
        status = cls._get_text_value(file_info, 'status')
        del_flag = cls._get_text_value(file_info, 'del_flag')
        if not file_id:
            raise ValueError('文件ID为空')
        uuid.UUID(file_id)
        if storage_type != 'local':
            raise ValueError('暂不支持非本地存储类型')
        if access_type not in {'public', 'private'}:
            raise ValueError('访问类型不合法')
        if not storage_key or not stored_name:
            raise ValueError('存储路径或存储文件名为空')
        if UploadUtil.get_original_filename(stored_name) != stored_name:
            raise ValueError('存储文件名包含路径信息')
        if storage_key.replace('\\', '/').rsplit('/', 1)[-1] != stored_name:
            raise ValueError('存储路径和存储文件名不一致')
        if (status == 'active' and del_flag != '0') or (status in {'deleted', 'purging'} and del_flag != '1'):
            raise ValueError('文件状态和删除标志不一致')
        if status not in {'active', 'deleted', 'purging'}:
            raise ValueError('文件状态不合法')

        source_path = cls._resolve_lexical_path(roots[access_type], storage_key)
        trash_key = f'{file_id}/{stored_name}'
        trash_path = cls._resolve_lexical_path(roots['trash'], trash_key)
        return _FileReconcileContext(
            file_info=file_info,
            source_root=access_type,
            source_key=storage_key.replace('\\', '/'),
            source_path=source_path,
            trash_key=trash_key,
            trash_path=trash_path,
        )

    @classmethod
    def _inspect_file_context(
        cls,
        context: _FileReconcileContext,
        roots: dict[str, Path],
        expected_locations: set[tuple[str, str]],
        check_hash: bool,
    ) -> tuple[list[FileReconcileFinding], set[tuple[str, str]]]:
        """
        检查文件记录与磁盘文件状态的一致性。

        :param context: 文件存储对账内部上下文
        :param roots: 需要检查的文件存储根目录集合
        :param expected_locations: 记录声明的存储位置
        :param check_hash: 是否校验文件SHA-256
        :return: 发现的问题与已识别的存储位置
        """
        file_info = context.file_info
        file_id = cls._get_text_value(file_info, 'file_id')
        storage_type = cls._get_text_value(file_info, 'storage_type')
        access_type = cls._get_text_value(file_info, 'access_type')
        status = cls._get_text_value(file_info, 'status')
        expected_size = cls._get_int_value(file_info, 'file_size')
        expected_hash = cls._get_text_value(file_info, 'file_hash')
        source_state = cls._get_path_state(context.source_path)
        trash_state = cls._get_path_state(context.trash_path)
        findings: list[FileReconcileFinding] = []
        claimed_locations: set[tuple[str, str]] = set()
        expected_root = context.source_root if status == 'active' else 'trash'
        expected_key = context.source_key if status == 'active' else context.trash_key

        for root_name, relative_key, path_state in (
            (context.source_root, context.source_key, source_state),
            ('trash', context.trash_key, trash_state),
        ):
            if path_state == 'unsafe':
                findings.append(
                    cls.build_finding(
                        issue_type='unsafe_entry',
                        severity='critical',
                        detail='文件记录指向符号链接或非普通文件条目',
                        file_id=file_id,
                        storage_type=storage_type,
                        access_type=access_type,
                        expected_root=expected_root,
                        expected_key=expected_key,
                        actual_root=root_name,
                        actual_key=relative_key,
                    )
                )
        if 'unsafe' in {source_state, trash_state}:
            return findings, claimed_locations

        if source_state == 'file' and trash_state == 'file':
            findings.append(
                cls.build_finding(
                    issue_type='duplicate_file',
                    severity='critical',
                    detail='正式存储目录和回收区同时存在文件副本',
                    file_id=file_id,
                    storage_type=storage_type,
                    access_type=access_type,
                    expected_root=expected_root,
                    expected_key=expected_key,
                    actual_root='trash' if status == 'active' else context.source_root,
                    actual_key=context.trash_key if status == 'active' else context.source_key,
                    expected_size=expected_size,
                    expected_hash=expected_hash,
                )
            )
            return findings, claimed_locations

        actual_path: Path | None = None
        actual_root: str | None = None
        actual_key: str | None = None
        if status == 'active':
            if source_state == 'file':
                actual_path = context.source_path
                actual_root = context.source_root
                actual_key = context.source_key
            elif trash_state == 'file':
                findings.append(
                    cls.build_finding(
                        issue_type='unexpected_trash',
                        severity='critical',
                        detail='有效文件仅存在于回收区，可能由未完成的删除事务导致',
                        file_id=file_id,
                        storage_type=storage_type,
                        access_type=access_type,
                        expected_root=context.source_root,
                        expected_key=context.source_key,
                        actual_root='trash',
                        actual_key=context.trash_key,
                        expected_size=expected_size,
                        actual_size=context.trash_path.stat().st_size,
                        expected_hash=expected_hash,
                    )
                )
                return findings, claimed_locations
        elif trash_state == 'file':
            actual_path = context.trash_path
            actual_root = 'trash'
            actual_key = context.trash_key
        elif source_state == 'file':
            findings.append(
                cls.build_finding(
                    issue_type='unexpected_source',
                    severity='warning',
                    detail='回收站文件仍位于正式存储目录，可能由未完成的恢复事务导致',
                    file_id=file_id,
                    storage_type=storage_type,
                    access_type=access_type,
                    expected_root='trash',
                    expected_key=context.trash_key,
                    actual_root=context.source_root,
                    actual_key=context.source_key,
                    expected_size=expected_size,
                    actual_size=context.source_path.stat().st_size,
                    expected_hash=expected_hash,
                )
            )
            return findings, claimed_locations

        if actual_path is None:
            opposite_root = 'private' if context.source_root == 'public' else 'public'
            opposite_path = cls._resolve_lexical_path(roots[opposite_root], context.source_key)
            opposite_location = (opposite_root, context.source_key)
            if cls._get_path_state(opposite_path) == 'file' and opposite_location not in expected_locations:
                claimed_locations.add(opposite_location)
                findings.append(
                    cls.build_finding(
                        issue_type='wrong_storage_root',
                        severity='critical',
                        detail='文件位于与访问类型不一致的存储区域',
                        file_id=file_id,
                        storage_type=storage_type,
                        access_type=access_type,
                        expected_root=expected_root,
                        expected_key=expected_key,
                        actual_root=opposite_root,
                        actual_key=context.source_key,
                        expected_size=expected_size,
                        actual_size=opposite_path.stat().st_size,
                        expected_hash=expected_hash,
                    )
                )
                return findings, claimed_locations
            findings.append(
                cls.build_finding(
                    issue_type='missing_file',
                    severity='critical' if status == 'active' else 'warning',
                    detail='文件信息存在，但正式存储目录和回收区均未找到物理文件',
                    file_id=file_id,
                    storage_type=storage_type,
                    access_type=access_type,
                    expected_root=expected_root,
                    expected_key=expected_key,
                    expected_size=expected_size,
                    expected_hash=expected_hash,
                )
            )
            return findings, claimed_locations

        findings.extend(
            cls._build_integrity_findings(
                file_info,
                actual_path,
                actual_root,
                actual_key,
                expected_root,
                expected_key,
                check_hash,
            )
        )
        return findings, claimed_locations

    @classmethod
    def _build_integrity_findings(
        cls,
        file_info: dict[str, Any],
        actual_path: Path,
        actual_root: str | None,
        actual_key: str | None,
        expected_root: str,
        expected_key: str,
        check_hash: bool,
    ) -> list[FileReconcileFinding]:
        """
        构造文件大小和摘要一致性异常。

        :param file_info: 文件信息
        :param actual_path: 扫描到的文件路径
        :param actual_root: 实际存储根目录
        :param actual_key: 扫描到的存储对象键
        :param expected_root: 记录声明的存储根目录
        :param expected_key: 记录声明的存储对象键
        :param check_hash: 是否校验文件SHA-256
        :return: 文件大小和摘要一致性异常
        """
        file_id = cls._get_text_value(file_info, 'file_id')
        storage_type = cls._get_text_value(file_info, 'storage_type')
        access_type = cls._get_text_value(file_info, 'access_type')
        expected_size = cls._get_int_value(file_info, 'file_size')
        expected_hash = cls._get_text_value(file_info, 'file_hash')
        actual_size = actual_path.stat().st_size
        findings: list[FileReconcileFinding] = []
        if expected_size is not None and actual_size != expected_size:
            findings.append(
                cls.build_finding(
                    issue_type='size_mismatch',
                    severity='critical',
                    detail='物理文件大小与文件信息表记录不一致',
                    file_id=file_id,
                    storage_type=storage_type,
                    access_type=access_type,
                    expected_root=expected_root,
                    expected_key=expected_key,
                    actual_root=actual_root,
                    actual_key=actual_key,
                    expected_size=expected_size,
                    actual_size=actual_size,
                    expected_hash=expected_hash,
                )
            )
        if check_hash and expected_hash:
            actual_hash = cls.calculate_file_hash(actual_path)
            if actual_hash != expected_hash:
                findings.append(
                    cls.build_finding(
                        issue_type='hash_mismatch',
                        severity='critical',
                        detail='物理文件SHA-256与文件信息表记录不一致',
                        file_id=file_id,
                        storage_type=storage_type,
                        access_type=access_type,
                        expected_root=expected_root,
                        expected_key=expected_key,
                        actual_root=actual_root,
                        actual_key=actual_key,
                        expected_size=expected_size,
                        actual_size=actual_size,
                        expected_hash=expected_hash,
                        actual_hash=actual_hash,
                    )
                )
        return findings

    @classmethod
    def _iter_storage_entries(cls, root: Path) -> Iterator[tuple[str, Path, bool]]:
        """
        逐项遍历存储目录，避免大目录扫描时一次性占用过多内存。

        :param root: 路径解析的基准目录
        :yield: 相对存储键、磁盘路径及条目状态标志
        """
        stack = [root]
        while stack:
            directory = stack.pop()
            with os.scandir(directory) as iterator:
                for entry in iterator:
                    entry_path = Path(entry.path)
                    relative_key = entry_path.relative_to(root).as_posix()
                    if entry.is_symlink():
                        yield relative_key, entry_path, True
                    elif entry.is_dir(follow_symlinks=False):
                        stack.append(entry_path)
                    elif entry.is_file(follow_symlinks=False):
                        yield relative_key, entry_path, False
                    else:
                        yield relative_key, entry_path, True

    @classmethod
    def _resolve_lexical_path(cls, root: Path, relative_key: str) -> Path:
        """
        解析路径的词法位置。

        :param root: 路径解析的基准目录
        :param relative_key: 相对路径
        :raises ValueError: 存储路径包含符号链接
        :return: 供调用方使用的 ``candidate_path``
        """
        FilePathUtil.resolve_path_within_root(root, relative_key)
        normalized_key = relative_key.replace('\\', '/')
        candidate_path = root.joinpath(*normalized_key.split('/'))
        current_path = root
        for part in normalized_key.split('/'):
            current_path = current_path / part
            if current_path.is_symlink():
                raise ValueError('存储路径包含符号链接')
        return candidate_path

    @classmethod
    def _validate_storage_roots(cls, roots: dict[str, Path]) -> None:
        """
        校验对账可访问的存储根目录。

        :param roots: 需要检查的文件存储根目录集合
        :raises ValueError: 存储根目录重合或互相嵌套
        """
        root_items = list(roots.items())
        for index, (root_name, root_path) in enumerate(root_items):
            root_path.mkdir(parents=True, exist_ok=True)
            for other_name, other_path in root_items[index + 1 :]:
                if (
                    root_path == other_path
                    or cls._is_relative_to(root_path, other_path)
                    or cls._is_relative_to(other_path, root_path)
                ):
                    raise ValueError(f'存储区域{root_name}和{other_name}不能相同或相互嵌套')

    @staticmethod
    def _is_relative_to(path: Path, parent: Path) -> bool:
        """
        判断候选路径是否位于指定目录之下。

        :param path: 要读取或处理的路径
        :param parent: 用于判断路径从属关系的父目录
        :return: 是否候选路径是否位于指定目录之下
        """
        try:
            path.relative_to(parent)
            return True
        except ValueError:
            return False

    @staticmethod
    def _get_path_state(path: Path) -> str:
        """
        读取对账路径的文件系统状态。

        :param path: 要读取或处理的路径
        :return: 对账路径的文件系统状态
        """
        if path.is_symlink():
            return 'unsafe'
        if not path.exists():
            return 'missing'
        return 'file' if path.is_file() else 'unsafe'

    @staticmethod
    def _get_text_value(file_info: dict[str, Any], field_name: str) -> str | None:
        """
        从文件记录中提取文本字段。

        :param file_info: 文件信息
        :param field_name: 需要读取或校验的字段名
        :return: 文本字段值，缺失时为空值
        """
        value = file_info.get(field_name)
        return str(value) if value is not None else None

    @staticmethod
    def _get_int_value(file_info: dict[str, Any], field_name: str) -> int | None:
        """
        从文件记录中提取整数字段。

        :param file_info: 文件信息
        :param field_name: 需要读取或校验的字段名
        :return: 整数字段值，缺失时为空值
        """
        value = file_info.get(field_name)
        return int(value) if value is not None else None
