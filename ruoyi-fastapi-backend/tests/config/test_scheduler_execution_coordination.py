import asyncio
import json
import os
from concurrent.futures import ProcessPoolExecutor
from datetime import timedelta
from pathlib import Path
from uuid import uuid4

import pytest
from apscheduler.events import EVENT_JOB_MAX_INSTANCES
from sqlalchemy import select, update

import module_task.scheduler_test as task_module
from config.scheduler.events import JobSnapshot
from config.scheduler.executors import TimedProcessPoolExecutor, run_timed_job
from config.scheduler.job_execution import JobExecutionStore
from config.scheduler.manager import SchedulerManager
from module_admin.dao.job_runtime_dao import JobRuntimeDao
from module_admin.entity.do.job_runtime_do import SysJobExecution
from module_admin.entity.vo.job_vo import DeleteJobModel, EditJobModel
from module_admin.service.job_service import JobService
from tests.scheduler_helpers import (
    CALLS,
    Runtime,
    claim_in_process,
    held_process_job,
    init_execution_process,
    job_info,
)
from utils.time_util import TimezoneUtil


@pytest.mark.asyncio
async def test_two_processes_atomically_enforce_logical_job_limit(runtime: Runtime) -> None:
    """两个进程以原子方式执行逻辑任务并发限制。"""
    job = await runtime.save()
    snapshot = job.model_dump(mode='json', by_alias=True)
    with ProcessPoolExecutor(
        max_workers=2, initializer=init_execution_process, initargs=(str(runtime.engine.url),)
    ) as pool:
        loop = asyncio.get_running_loop()
        results = await asyncio.gather(
            *[loop.run_in_executor(pool, claim_in_process, uuid4().hex, snapshot) for _ in range(2)]
        )
    assert sorted(results) == [False, True]
    async with runtime.sessions() as db:
        rows = (await db.scalars(select(SysJobExecution))).all()
        assert sorted(row.status for row in rows) == ['rejected', 'running']


async def wait_for_process_file(path: Path, executor: TimedProcessPoolExecutor) -> dict:
    """
    等待真实进程进入业务函数。

    :param path: 进程启动标记文件路径
    :param executor: 提供超时诊断的真实进程执行器
    :return: 进程启动信息
    :raises TimeoutError: 等待操作超过时限时
    """
    startup_wait_seconds = 45
    last_error = None
    try:
        async with asyncio.timeout(startup_wait_seconds):
            while True:
                try:
                    return json.loads(await asyncio.to_thread(path.read_text, encoding='utf-8'))
                except (FileNotFoundError, json.JSONDecodeError) as exc:
                    last_error = type(exc).__name__
                await asyncio.sleep(0.02)
    except TimeoutError as exc:
        processes = getattr(executor._pool, '_processes', None) or {}
        states = [
            {'pid': process.pid, 'alive': process.is_alive(), 'exitcode': process.exitcode}
            for process in processes.values()
        ]
        raise TimeoutError(
            f'process did not enter the task within {startup_wait_seconds}s; marker={path}; '
            f'processes={states}; broken={getattr(executor._pool, "_broken", None)}; last_read={last_error}'
        ) from exc


@pytest.mark.asyncio
async def test_running_process_blocks_new_executor_and_can_finish_after_delete(
    runtime: Runtime,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """运行中的进程阻止新执行器，并能在任务删除后结束。"""
    started, release = tmp_path / 'started.json', tmp_path / 'release'
    monkeypatch.setattr(task_module, 'runtime_process', held_process_job, raising=False)
    executor = TimedProcessPoolExecutor(
        1,
        manage_executions=True,
        pool_kwargs={'initializer': init_execution_process, 'initargs': (str(runtime.engine.url),)},
    )
    runtime.scheduler.add_executor(executor, alias='processpool')
    job = await runtime.save(
        job_info(
            invokeTarget='module_task.scheduler_test.runtime_process',
            jobExecutor='processpool',
            jobArgs=[str(tmp_path)],
        )
    )
    async with runtime.sessions() as db:
        response = await JobService.execute_job_once_services(db, job)
        assert isinstance(response.result, dict)
    execution_id = response.result['executionId']
    runtime.scheduler.resume()
    try:
        assert (await wait_for_process_file(started, executor))['pid'] != os.getpid()
        assert (await runtime.execution(execution_id))['status'] == 'running'
        async with runtime.sessions() as db:
            await JobService.edit_job_services(
                db,
                EditJobModel(
                    job_id=42,
                    job_executor='default',
                    invoke_target='module_task.scheduler_test.runtime_harmless',
                    job_args=[],
                ),
            )
        cron = runtime.scheduler.get_job('42')
        event = await asyncio.to_thread(
            run_timed_job,
            cron,
            [TimezoneUtil.utc_now()],
            JobSnapshot.from_job(cron, managed=True),
            'test',
        )
        assert event[0].code == EVENT_JOB_MAX_INSTANCES
        assert event[0].start_time is None
        assert CALLS == []
        # Leader 离任和恢复不释放仍在运行的进程占用。
        monkeypatch.setattr(SchedulerManager, '_is_leader', False)
        await SchedulerManager._drain_execution_requests()
        monkeypatch.setattr(SchedulerManager, '_is_leader', True)
        async with runtime.sessions() as db:
            await JobService.delete_job_services(db, DeleteJobModel(job_ids='42'))
        assert (await runtime.execution(execution_id))['status'] == 'running'
    finally:
        release.touch()
    finished = await runtime.wait_execution(execution_id, {'success'})
    assert finished['runDurationMs'] >= 0


@pytest.mark.asyncio
async def test_expired_dispatch_token_cannot_run_reclaimed_request(runtime: Runtime) -> None:
    """过期的调度令牌不能执行已回收的请求。"""
    job = await runtime.save()
    async with runtime.sessions() as db:
        request = await JobRuntimeDao.create_request(db, job, None)
        await db.commit()
        assert job.job_id is not None
        old = await JobRuntimeDao.claim_request(db, request.execution_id, job.job_id)
        assert old is not None and old.owner_token is not None
        old_token = old.owner_token
        await db.commit()
        await db.execute(
            update(SysJobExecution)
            .where(SysJobExecution.execution_id == request.execution_id)
            .values(lease_until=TimezoneUtil.utc_now() - timedelta(seconds=1))
        )
        await db.commit()
    await SchedulerManager._drain_execution_requests()
    claim = await asyncio.to_thread(
        JobExecutionStore.claim,
        request.execution_id,
        job.job_id,
        job.model_dump(mode='json', by_alias=True),
        TimezoneUtil.utc_now(),
        dispatch_token=old_token,
    )
    assert claim.accepted is False
    assert (await runtime.execution(request.execution_id))['status'] == 'submitted'
    runtime.scheduler.resume()
    await runtime.wait_execution(request.execution_id, {'success'})
    assert CALLS == ['done']


@pytest.mark.asyncio
async def test_only_original_owner_can_finish_unknown_execution(runtime: Runtime) -> None:
    """只有原所有者可以结束状态未知的执行。"""
    job = await runtime.save()
    execution_id = uuid4().hex
    now = TimezoneUtil.utc_now()
    assert job.job_id is not None
    claim = await asyncio.to_thread(
        JobExecutionStore.claim, execution_id, job.job_id, job.model_dump(mode='json', by_alias=True), now
    )
    assert claim.accepted and claim.token is not None
    async with runtime.sessions() as db:
        await db.execute(
            update(SysJobExecution)
            .where(SysJobExecution.execution_id == execution_id)
            .values(lease_until=now - timedelta(seconds=1))
        )
        await JobRuntimeDao.recover_expired(db)
        await db.commit()
    assert (await runtime.execution(execution_id))['status'] == 'unknown'
    result = {'failed': False, 'message': None, 'start_time': now, 'end_time': now, 'run_duration_ms': 0}
    await asyncio.to_thread(JobExecutionStore.finish, execution_id, 'wrong-owner', **result)
    assert (await runtime.execution(execution_id))['status'] == 'unknown'
    await asyncio.to_thread(JobExecutionStore.finish, execution_id, claim.token, **result)
    assert (await runtime.execution(execution_id))['status'] == 'success'
