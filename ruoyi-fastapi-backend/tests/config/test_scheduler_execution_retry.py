import asyncio
from collections.abc import Sequence
from datetime import timedelta
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from apscheduler.events import EVENT_JOB_EXECUTED
from sqlalchemy import event
from sqlalchemy.engine import Result
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.orm import ORMExecuteState, Session

from config.scheduler import job_execution
from config.scheduler.events import JobSnapshot
from config.scheduler.executors import run_timed_job
from config.scheduler.job_execution import JobExecutionStore
from config.scheduler.manager import SchedulerManager
from module_admin.entity.do.job_runtime_do import SysJobExecution
from tests.scheduler_helpers import CALLS, Runtime
from utils.time_util import TimezoneUtil


def database_error(code: int | str, *, attribute: str = 'sqlstate', invalidated: bool = False) -> DBAPIError:
    """
    构造带有指定错误码的数据库异常。

    :param code: 与当前结果对应的编码
    :param attribute: 要读取或替换的属性名
    :param invalidated: 本次失效操作影响的记录
    :return: 带有指定错误码的数据库异常
    """
    original = RuntimeError(code, 'injected database failure')
    if isinstance(code, str):
        setattr(original, attribute, code)
    return OperationalError('UPDATE sys_job_execution', {}, original, connection_invalidated=invalidated)


def inject_finish_failures(
    runtime: Runtime,
    monkeypatch: pytest.MonkeyPatch,
    failures: Sequence[DBAPIError | None],
    stage: str,
) -> tuple[list[Session], list[str], list[float]]:
    """
    在真实 SQLite 事务执行更新后或提交前注入错误。

    :param runtime: 隔离测试运行环境
    :param monkeypatch: 测试替换对象
    :param failures: 每次事务注入的错误，None 表示成功
    :param stage: 错误注入阶段
    :return: 创建的会话、回滚与关闭记录及重试间隔
    """
    sessions: list[Session] = []
    lifecycle: list[str] = []
    delays: list[float] = []

    def factory() -> Session:
        """
        为当前测试步骤创建受控资源。

        :return: 当前操作使用的数据库会话
        """
        if sessions:
            assert lifecycle[-1] == 'close'
            assert not sessions[-1].in_transaction()
        failure = failures[len(sessions)]
        db = Session(runtime.engine, expire_on_commit=False)
        sessions.append(db)
        original_close = db.close

        def execute(state: ORMExecuteState) -> Result[Any]:
            """
            按测试场景处理数据库查询并提供结果。

            :param state: 当前流程的状态
            :raises Exception: 执行测试注入的数据库故障
            :return: 执行当前操作得到的结果
            """
            result = state.invoke_statement()
            if stage == 'execute' and failure is not None:
                raise failure
            return result

        def before_commit(_db: Session) -> None:
            """
            在事务提交前触发配置的测试行为。

            :param _db: 回调签名接收的数据库会话
            :raises Exception: 执行提交前注入的故障
            """
            if stage == 'commit' and failure is not None:
                raise failure

        def after_rollback(_db: Session) -> None:
            """
            记录事务回滚后的回调顺序。

            :param _db: 回调签名接收的数据库会话
            """
            lifecycle.append('rollback')

        def close() -> None:
            """记录测试资源的关闭过程。"""
            original_close()
            lifecycle.append('close')

        event.listen(db, 'do_orm_execute', execute, retval=True)
        event.listen(db, 'before_commit', before_commit)
        event.listen(db, 'after_rollback', after_rollback)
        monkeypatch.setattr(db, 'close', close)
        return db

    def sleep(delay: float) -> None:
        """
        在事务关闭后记录重试等待时间。

        :param delay: 延迟时长
        """
        assert lifecycle[-1] == 'close'
        assert not sessions[-1].in_transaction()
        delays.append(delay)

    monkeypatch.setattr(JobExecutionStore, 'session', staticmethod(factory))
    monkeypatch.setattr(job_execution, 'time', SimpleNamespace(sleep=sleep))
    return sessions, lifecycle, delays


async def claimed_execution(runtime: Runtime) -> tuple[str, str, dict[str, Any]]:
    """
    准备已认领的任务执行记录。

    :param runtime: 隔离测试运行环境
    :return: 已认领的执行标识、所有者令牌及预期结果
    """
    job = await runtime.save()
    execution_id = uuid4().hex
    start = TimezoneUtil.utc_now()
    assert job.job_id is not None
    claim = await asyncio.to_thread(
        JobExecutionStore.claim, execution_id, job.job_id, job.model_dump(mode='json', by_alias=True), start
    )
    assert claim.accepted and claim.token is not None
    return (
        execution_id,
        claim.token,
        {
            'failed': False,
            'message': 'result remains unchanged',
            'start_time': start,
            'end_time': start + timedelta(milliseconds=125),
            'run_duration_ms': 125,
        },
    )


@pytest.mark.asyncio
@pytest.mark.parametrize('stage', ['execute', 'commit'])
@pytest.mark.parametrize('code,attribute', [(1213, 'sqlstate'), ('40001', 'sqlstate'), ('40P01', 'pgcode')])
@pytest.mark.parametrize('failed', [False, True])
async def test_finish_retries_rolled_back_transaction_in_a_new_session(
    runtime: Runtime, monkeypatch: pytest.MonkeyPatch, stage: str, code: int | str, attribute: str, failed: bool
) -> None:
    """结束任务时使用新会话重试已回滚的事务。"""
    execution_id, token, result = await claimed_execution(runtime)
    result['failed'] = failed
    failures = [database_error(code, attribute=attribute), None]
    sessions, lifecycle, delays = inject_finish_failures(runtime, monkeypatch, failures, stage)

    await asyncio.to_thread(JobExecutionStore.finish, execution_id, token, **result)

    assert len(sessions) == len(failures)
    assert lifecycle == ['rollback', 'close', 'close']
    assert delays == [0.05]
    with Session(runtime.engine) as db:
        saved = db.get(SysJobExecution, execution_id)
        assert saved is not None
        assert saved.status == ('failed' if failed else 'success')
        assert saved.owner_token == token
        assert saved.message == result['message']
        assert saved.start_time == TimezoneUtil.to_utc_milliseconds(result['start_time'])
        assert saved.end_time == TimezoneUtil.to_utc_milliseconds(result['end_time'])
        assert saved.run_duration_ms == result['run_duration_ms']
        assert saved.lease_until is None


@pytest.mark.asyncio
@pytest.mark.parametrize('stage', ['execute', 'commit'])
@pytest.mark.parametrize(
    'error',
    [database_error(2006), database_error(1064), database_error('42501'), database_error(1213, invalidated=True)],
)
async def test_finish_does_not_retry_unrelated_or_invalidated_errors(
    runtime: Runtime, monkeypatch: pytest.MonkeyPatch, stage: str, error: DBAPIError
) -> None:
    """结束任务时不重试无关错误或连接失效错误。"""
    execution_id, token, result = await claimed_execution(runtime)
    sessions, lifecycle, delays = inject_finish_failures(runtime, monkeypatch, [error], stage)
    with pytest.raises(DBAPIError) as captured:
        await asyncio.to_thread(JobExecutionStore.finish, execution_id, token, **result)
    assert captured.value is error
    assert len(sessions) == 1
    assert lifecycle == ['rollback', 'close']
    assert delays == []
    assert (await runtime.execution(execution_id))['status'] == 'running'


@pytest.mark.asyncio
@pytest.mark.parametrize('stage', ['execute', 'commit'])
async def test_finish_stops_after_three_failed_transactions(
    runtime: Runtime, monkeypatch: pytest.MonkeyPatch, stage: str
) -> None:
    """结束任务的事务连续失败三次后停止重试。"""
    execution_id, token, result = await claimed_execution(runtime)
    failures = [database_error(1213) for _ in range(3)]
    sessions, lifecycle, delays = inject_finish_failures(runtime, monkeypatch, failures, stage)
    with pytest.raises(DBAPIError) as captured:
        await asyncio.to_thread(JobExecutionStore.finish, execution_id, token, **result)
    assert captured.value is failures[-1]
    assert len(sessions) == len(failures)
    assert lifecycle == ['rollback', 'close'] * len(failures)
    assert delays == [0.05, 0.1]
    assert (await runtime.execution(execution_id))['status'] == 'running'


@pytest.mark.asyncio
async def test_finish_retry_keeps_owner_guard_and_does_not_overwrite_completed_result(
    runtime: Runtime, monkeypatch: pytest.MonkeyPatch
) -> None:
    """结束任务的重试校验所有者并保留已有结果。"""
    execution_id, token, result = await claimed_execution(runtime)
    inject_finish_failures(runtime, monkeypatch, [database_error(1213), None, None, None], 'commit')
    await asyncio.to_thread(JobExecutionStore.finish, execution_id, 'wrong-owner', **result)
    assert (await runtime.execution(execution_id))['status'] == 'running'
    await asyncio.to_thread(JobExecutionStore.finish, execution_id, token, **result)
    result['failed'] = True
    await asyncio.to_thread(JobExecutionStore.finish, execution_id, token, **result)
    assert (await runtime.execution(execution_id))['status'] == 'success'


@pytest.mark.asyncio
async def test_result_retry_does_not_repeat_the_user_job(runtime: Runtime, monkeypatch: pytest.MonkeyPatch) -> None:
    """重试写入结果时不重复执行用户任务。"""
    await runtime.save()
    await SchedulerManager._sync_jobs_from_database()
    job = runtime.scheduler.get_job('42')
    snapshot = JobSnapshot.from_job(job, managed=True)
    original_claim = JobExecutionStore.claim

    def claim_then_inject(*args, **kwargs) -> job_execution.ExecutionClaim:
        """
        在取得任务执行权后注入后续故障。

        :param args: 传给被调用对象的位置参数
        :param kwargs: 传给被调用对象的关键字参数
        :return: 当前执行的认领信息
        """
        claim = original_claim(*args, **kwargs)
        inject_finish_failures(runtime, monkeypatch, [database_error(1213), None], 'commit')
        return claim

    monkeypatch.setattr(JobExecutionStore, 'claim', claim_then_inject)
    events = await asyncio.to_thread(run_timed_job, job, [TimezoneUtil.utc_now()], snapshot, 'test')
    assert CALLS == ['done']
    assert len(events) == 1
    assert events[0].code == EVENT_JOB_EXECUTED
    assert events[0].retval == 'done'
    assert (await runtime.execution(events[0].execution_id))['status'] == 'success'
