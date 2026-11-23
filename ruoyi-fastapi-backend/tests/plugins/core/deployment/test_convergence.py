import asyncio
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest

from plugins.core.deployment import convergence
from plugins.core.deployment.state import aggregate_release

PLUGIN_ID = 'demo'
DIGEST = 'a' * 64
GENERATION = 'b' * 32
NOW = datetime(2026, 10, 8, tzinfo=UTC)
WORKER = 'c' * 32
OTHER = 'd' * 32
EXTRA = 'e' * 32
EXPECTED_WORKERS = 2


def worker(worker_id: str, plugin_id: str = '__runtime__', **changes: object) -> dict:
    """
    创建与数据库只读 status 一致的宿主或插件报告。

    :param worker_id: 工作进程的标识
    :param plugin_id: 插件清单中的唯一标识
    :param changes: 调用方按名称传入的附加选项
    :return: 与数据库只读 status 一致的宿主或插件报告
    """
    return {
        'workerId': worker_id,
        'pluginId': plugin_id,
        'state': 'ready',
        'heartbeatTime': NOW.isoformat(),
        'digest': DIGEST if plugin_id == PLUGIN_ID else None,
        'generation': GENERATION if plugin_id == PLUGIN_ID else None,
        'version': '1.0.0' if plugin_id == PLUGIN_ID else None,
        'error': None,
        **changes,
    }


def ready(*worker_ids: str) -> list[dict]:
    """
    生成指定 worker 的宿主与插件配对就绪报告。

    :param worker_ids: 调用方传入的其余位置参数
    :return: 指定 worker 的宿主与插件配对就绪报告
    """
    return [worker(worker_id, plugin_id) for worker_id in worker_ids for plugin_id in ('__runtime__', PLUGIN_ID)]


def payload(
    reports: list[dict] | None = None,
    *,
    digest: str | None = DIGEST,
    generation: str = GENERATION,
    expected: int = 2,
    enabled: bool = True,
) -> dict:
    """
    使用既有聚合器生成读取时刻的摘要，后续测试单独推进返回时刻。

    :param reports: 保存各工作进程报告的集合
    :param digest: 用于验证内容完整性的摘要
    :param generation: 当前发布或部署的代次
    :param expected: 断言使用的预期结果
    :param enabled: 是否启用该项功能
    :return: 包含 ``ok``、``releases``、``workers`` 的数据
    """
    reports = reports or []
    summary = aggregate_release(
        {
            'plugin_id': PLUGIN_ID,
            'target_digest': digest,
            'generation': generation,
            'expected_workers': expected,
            'prepare_status': 'prepared',
        },
        [
            {
                'worker_id': item['workerId'],
                'plugin_id': item['pluginId'],
                'state': item['state'],
                'heartbeat_time': datetime.fromisoformat(item['heartbeatTime']),
                'artifact_digest': item['digest'],
                'generation': item['generation'],
            }
            for item in reports
        ],
        now=NOW,
        enabled=enabled,
    ).to_payload()
    summary['enabled'] = enabled
    return {'ok': True, 'releases': [summary], 'workers': deepcopy(reports)}


class Clock:
    """
    推进轮询时钟而不执行真实等待，不替换 asyncio 事件循环自身时钟。

    :ivar now: 当前场景使用的基准时间
    :ivar delays: 延迟执行时记录的等待时间
    """

    def __init__(self) -> None:
        """初始化测试夹具的 ``now``, ``delays``。"""
        self.now = 0.0
        self.delays: list[float] = []

    def monotonic(self) -> float:
        """
        向调用方返回 ``self.now``。

        :return: 测试时钟记录的当前时刻
        """
        return self.now

    async def sleep(self, delay: float) -> None:
        """
        在事务关闭后记录重试等待时间。

        :param delay: 延迟时长
        """
        self.delays.append(delay)
        self.now += delay


@pytest.fixture(autouse=True)
def clock(monkeypatch: pytest.MonkeyPatch) -> Clock:
    """
    隔离单调时钟与返回时刻，确保超时测试不消耗真实秒数。

    :param monkeypatch: 用于临时替换环境变量、模块或对象属性的 pytest 夹具
    :return: 待处理的输入值
    """
    value = Clock()
    monkeypatch.setattr(convergence, 'monotonic', value.monotonic)
    monkeypatch.setattr(convergence, 'sleep', value.sleep)
    monkeypatch.setattr(convergence.TimezoneUtil, 'utc_now', lambda: NOW)
    return value


async def wait(reader: object, **changes: object) -> dict:
    """
    使用固定身份调用被测等待器，同时允许单项参数边界覆盖。

    :param reader: 读取输入内容的对象
    :param changes: 调用方按名称传入的附加选项
    :return: 目标发布的收敛状态
    """
    options = {
        'plugin_id': PLUGIN_ID,
        'digest': DIGEST,
        'expected_generation': GENERATION,
        'expected_workers': 2,
        'worker_ttl_seconds': 60,
        'timeout_seconds': 10,
        'poll_interval_seconds': 2,
        **changes,
    }
    return await convergence.wait_for_release(reader, **options)


@pytest.mark.asyncio
async def test_assertion_accepts_every_live_worker_and_capacity_lower_bound_without_writing(clock: Clock) -> None:
    """只读验收全部在线工作进程及最低容量。"""
    state = payload(ready(WORKER, OTHER, EXTRA))
    state['releases'][0].update(prepareStatus='failed', preparedDigest='f' * 64, lastError='private-password')
    state['workers'][0]['error'] = 'private-worker-error'
    reader = AsyncMock(return_value=state)

    result = await wait(reader, timeout_seconds=0)

    assert result['ok'] is True and result['reason'] == 'converged'
    assert result['target'] == {'pluginId': PLUGIN_ID, 'digest': DIGEST, 'generation': GENERATION, 'expectedWorkers': 2}
    assert result['operation'] == 'release_wait' and result['attempts'] == 1
    assert result['lastObserved']['liveWorkers'] > result['target']['expectedWorkers']
    assert result['lastObserved']['prepareStatus'] == 'failed'
    assert 'private-' not in str(result) and 'lastError' not in result['lastObserved']
    assert set(result) == {
        'ok',
        'operation',
        'reason',
        'message',
        'target',
        'lastObserved',
        'attempts',
        'elapsedSeconds',
        'timeoutSeconds',
        'intervalSeconds',
    }
    reader.assert_awaited_once_with(PLUGIN_ID)
    assert clock.delays == []


@pytest.mark.asyncio
async def test_wait_reads_new_snapshots_until_all_workers_converge(clock: Clock) -> None:
    """持续读取新快照直到全部工作进程收敛。"""
    reader = AsyncMock(side_effect=[payload(), payload(ready(WORKER)), payload(ready(WORKER, OTHER))])
    result = await wait(reader)
    expected_attempts = 3
    expected_elapsed = 4
    assert result['reason'] == 'converged' and result['attempts'] == expected_attempts
    assert result['elapsedSeconds'] == expected_elapsed
    assert clock.delays == [2, 2]
    assert all(call.args == (PLUGIN_ID,) for call in reader.await_args_list)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'reports',
    [
        ready(WORKER),
        [worker(WORKER, PLUGIN_ID), worker(OTHER, PLUGIN_ID)],
        [*ready(WORKER, OTHER), worker(EXTRA), worker(EXTRA, PLUGIN_ID, generation='f' * 32)],
    ],
)
async def test_assertion_rejects_short_capacity_orphans_and_extra_mismatched_live_worker(reports: list[dict]) -> None:
    """验收拒绝容量不足、孤立进程及不匹配的额外进程。"""
    result = await wait(AsyncMock(return_value=payload(reports)), timeout_seconds=0)
    assert result['reason'] == 'not_converged' and result['ok'] is False


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'changes',
    [
        {'digest': 'f' * 64},
        {'generation': 'f' * 32},
        {'expected': 3},
    ],
)
async def test_changed_target_generation_or_recorded_capacity_is_never_followed(changes: dict, clock: Clock) -> None:
    """目标代次或记录容量改变时不追随新值。"""
    reader = AsyncMock(side_effect=[payload(**changes), payload(ready(WORKER, OTHER))])
    result = await wait(reader)
    assert result['reason'] == 'target_changed' and result['ok'] is False
    assert result['target']['digest'] == DIGEST and result['target']['generation'] == GENERATION
    assert result['target']['expectedWorkers'] == EXPECTED_WORKERS
    assert reader.await_count == 1 and not clock.delays


@pytest.mark.asyncio
@pytest.mark.parametrize('state', [{'ok': True, 'releases': [], 'workers': []}, payload(digest=None)])
async def test_missing_release_or_target_stops_immediately(state: dict) -> None:
    """发布或目标缺失时立即停止。"""
    result = await wait(AsyncMock(return_value=state))
    assert result['reason'] == 'target_missing' and result['attempts'] == 1


@pytest.mark.asyncio
async def test_disabled_target_cannot_pass_active_acceptance() -> None:
    """已停用的目标无法通过启用状态验收。"""
    reports = ready(WORKER, OTHER)
    for row in reports:
        if row['pluginId'] == PLUGIN_ID:
            row['state'] = 'stopped'
    result = await wait(AsyncMock(return_value=payload(reports, enabled=False)))
    assert result['reason'] == 'target_disabled'
    assert result['lastObserved']['status'] == 'disabled'


@pytest.mark.asyncio
@pytest.mark.parametrize('failed_plugin_id', ['__runtime__', PLUGIN_ID])
async def test_any_live_worker_failure_stops_even_when_summary_is_partial(failed_plugin_id: str) -> None:
    """即使摘要不完整也会因在线进程失败而停止。"""
    reports = ready(WORKER, OTHER)
    next(row for row in reports if row['workerId'] == OTHER and row['pluginId'] == failed_plugin_id)['state'] = 'failed'
    result = await wait(AsyncMock(return_value=payload(reports)))
    assert result['reason'] == 'worker_failed'
    assert result['lastObserved']['status'] == 'partial'


@pytest.mark.asyncio
async def test_historical_stale_and_stopped_hosts_do_not_block_replaced_cluster() -> None:
    """已替换集群不受过期或已停止的历史主机阻塞。"""
    reports = [
        *ready(WORKER, OTHER),
        worker(EXTRA, heartbeatTime=(NOW - timedelta(seconds=61)).isoformat()),
        worker(EXTRA, PLUGIN_ID),
    ]
    result = await wait(AsyncMock(return_value=payload(reports)), timeout_seconds=0)
    assert result['reason'] == 'converged' and result['lastObserved']['staleWorkers'] == 1


@pytest.mark.asyncio
async def test_status_that_expires_before_return_cannot_pass(monkeypatch: pytest.MonkeyPatch) -> None:
    """返回前已过期的状态无法通过验收。"""
    reports = ready(WORKER, OTHER)
    for row in reports:
        row['heartbeatTime'] = (NOW - timedelta(seconds=59)).isoformat()
    state = payload(reports)
    assert state['releases'][0]['status'] == 'active'
    monkeypatch.setattr(convergence.TimezoneUtil, 'utc_now', lambda: NOW + timedelta(seconds=2))
    result = await wait(AsyncMock(return_value=state), timeout_seconds=0)
    assert result['reason'] == 'not_converged'
    assert result['lastObserved']['healthyWorkers'] == 0
    assert result['lastObserved']['missingWorkers'] == EXPECTED_WORKERS
    assert result['lastObserved']['status'] == 'pending_restart'


@pytest.mark.asyncio
async def test_future_heartbeat_is_excluded_from_ready_capacity() -> None:
    """未来心跳不计入就绪容量。"""
    reports = ready(WORKER, OTHER)
    for row in reports:
        row['heartbeatTime'] = (NOW + timedelta(seconds=1)).isoformat()
    result = await wait(AsyncMock(return_value=payload(reports)), timeout_seconds=0)
    assert result['reason'] == 'not_converged'
    assert result['lastObserved']['healthyWorkers'] == 0


@pytest.mark.asyncio
async def test_database_failure_stops_with_last_observation_without_private_exception() -> None:
    """数据库失败时返回最后观测且不泄露内部异常。"""
    reader = AsyncMock(side_effect=[payload(ready(WORKER)), ConnectionError('private-db-password')])
    result = await wait(reader)
    assert result['reason'] == 'unavailable' and result['attempts'] == len(reader.await_args_list)
    assert result['lastObserved']['status'] == 'partial'
    assert 'private-db-password' not in str(result)


@pytest.mark.asyncio
async def test_polling_stops_on_total_deadline_and_sleep_never_overshoots(clock: Clock) -> None:
    """轮询遵守总截止时间且休眠不超过剩余时间。"""
    result = await wait(AsyncMock(return_value=payload()), timeout_seconds=5)
    expected_attempts = 3
    expected_elapsed = 5
    assert result['reason'] == 'timeout' and result['attempts'] == expected_attempts
    assert result['elapsedSeconds'] == expected_elapsed
    assert clock.delays == [2, 2, 1]


@pytest.mark.asyncio
async def test_active_result_returned_after_deadline_is_still_timeout(clock: Clock) -> None:
    """超过截止时间才返回的启用结果仍视为超时。"""

    async def reader(plugin_id: str) -> dict:
        """
        推进测试时钟并返回工作进程状态。

        :param plugin_id: 插件清单中的唯一标识
        :return: 工作进程状态
        """
        clock.now = 6
        return payload(ready(WORKER, OTHER))

    result = await wait(reader, timeout_seconds=5)
    assert result['reason'] == 'timeout' and result['ok'] is False
    assert result['lastObserved']['status'] == 'active'


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('total_seconds', 'read_timeout', 'reason'), [(0, 10, 'unavailable'), (4, 4, 'timeout'), (20, 10, 'unavailable')]
)
async def test_read_timeout_is_bounded_and_classified_by_budget_source(
    monkeypatch: pytest.MonkeyPatch,
    clock: Clock,
    total_seconds: float,
    read_timeout: float,
    reason: str,
) -> None:
    """按预算来源限制并归类读取超时。"""

    def time_out(tasks: set, *, timeout: float) -> tuple[set, set]:
        """
        推进测试时钟以模拟读取超时。

        :param tasks: 当前场景中正在跟踪的任务
        :param timeout: 等待操作完成的超时限制
        :return: 空的已完成集合及仍待处理的任务
        """
        assert timeout == read_timeout
        clock.now += timeout
        return set(), tasks

    monkeypatch.setattr(convergence, 'wait', AsyncMock(side_effect=time_out))
    result = await wait(AsyncMock(return_value=payload()), timeout_seconds=total_seconds)
    assert result['reason'] == reason and result['attempts'] == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('swallow_cancel', [False, True])
async def test_timer_before_monotonic_deadline_cannot_become_unavailable_or_late_success(
    clock: Clock, swallow_cancel: bool
) -> None:
    """单调时钟截止前触发计时器不会误报不可用或迟到成功。"""
    cleaned = asyncio.Event()

    async def reader(plugin_id: str) -> dict:
        """
        推进测试时钟并返回工作进程状态。

        :param plugin_id: 插件清单中的唯一标识
        :return: 工作进程状态
        :raises asyncio.CancelledError: 异步操作被取消时
        """
        try:
            await asyncio.Future()
        except asyncio.CancelledError:
            if swallow_cancel:
                return payload(ready(WORKER, OTHER))
            raise
        finally:
            cleaned.set()

    result = await wait(reader, timeout_seconds=0.01)
    assert result['reason'] == 'timeout' and result['ok'] is False
    assert result['lastObserved'] is None and cleaned.is_set()
    # 模拟 Windows 定时器已触发但粗粒度 monotonic 尚未更新的时刻。
    assert clock.now == 0


@pytest.mark.asyncio
async def test_reader_own_timeout_is_unavailable_even_when_total_budget_limits_read() -> None:
    """即使总预算限制读取也将读取器自身超时记为不可用。"""
    reader = AsyncMock(side_effect=TimeoutError('private-query-timeout'))
    result = await wait(reader, timeout_seconds=0.01)
    assert result['reason'] == 'unavailable' and result['ok'] is False
    assert 'private-query-timeout' not in str(result)


@pytest.mark.asyncio
@pytest.mark.parametrize('phase', ['read', 'sleep'])
async def test_cancellation_propagates_and_does_not_continue_polling(
    monkeypatch: pytest.MonkeyPatch, phase: str
) -> None:
    """取消信号向上传播并终止轮询。"""
    entered = asyncio.Event()
    finished = asyncio.Event()

    async def blocked(value: object) -> dict:
        """
        将调用保持在等待状态以验证取消行为。

        :param value: 待处理的输入值
        """
        entered.set()
        try:
            await asyncio.Future()
        finally:
            finished.set()

    reader = blocked if phase == 'read' else AsyncMock(return_value=payload())
    if phase == 'sleep':
        monkeypatch.setattr(convergence, 'sleep', blocked)
    task = asyncio.create_task(wait(reader))
    await entered.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert finished.is_set()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'changes',
    [
        {'plugin_id': '../demo'},
        {'digest': 'A' * 64},
        {'expected_generation': 'bad'},
        {'expected_workers': 0},
        {'expected_workers': True},
        {'expected_workers': 1.5},
        {'timeout_seconds': -1},
        {'timeout_seconds': float('nan')},
        {'timeout_seconds': float('inf')},
        {'timeout_seconds': True},
        {'poll_interval_seconds': 0},
        {'poll_interval_seconds': float('inf')},
    ],
)
async def test_invalid_pins_or_time_limits_do_not_query(changes: dict) -> None:
    """无效的固定目标或时间限制不会触发查询。"""
    reader = AsyncMock()
    with pytest.raises(ValueError):
        await wait(reader, **changes)
    reader.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'changes',
    [
        {'status': []},
        {'prepareStatus': []},
        {'healthyWorkers': True},
        {'healthyWorkers': 3},
        {'restartRequired': True},
        {'status': 'no_target'},
        {'status': 'failed'},
        {'status': 'pending_restart', 'restartRequired': True},
        {'missingWorkers': 1},
        {'status': 'partial', 'restartRequired': True, 'healthyWorkers': 1, 'missingWorkers': 0},
        {'expectedWorkers': False},
    ],
)
async def test_contradictory_or_malformed_summary_never_becomes_success(changes: dict) -> None:
    """矛盾或格式错误的摘要无法通过验收。"""
    state = payload(ready(WORKER, OTHER))
    state['releases'][0].update(changes)
    result = await wait(AsyncMock(return_value=state))
    assert result['reason'] == 'invalid_observation' and result['ok'] is False


@pytest.mark.asyncio
@pytest.mark.parametrize('field', ['targetDigest', 'generation', 'liveWorkers', 'enabled'])
async def test_missing_summary_field_returns_structured_failure(field: str) -> None:
    """缺少摘要字段时返回结构化错误。"""
    state = payload(ready(WORKER, OTHER))
    state['releases'][0].pop(field)
    result = await wait(AsyncMock(return_value=state))
    assert result['reason'] == 'invalid_observation'


@pytest.mark.asyncio
@pytest.mark.parametrize('collection', ['releases', 'workers'])
async def test_duplicate_summary_or_worker_rows_are_rejected(collection: str) -> None:
    """拒绝重复摘要或工作进程记录。"""
    state = payload(ready(WORKER, OTHER))
    state[collection].append(deepcopy(state[collection][0]))
    result = await wait(AsyncMock(return_value=state))
    assert result['reason'] == 'invalid_observation'


@pytest.mark.asyncio
@pytest.mark.parametrize('field', ['digest', 'generation', 'version', 'heartbeatTime', 'state', 'workerId'])
async def test_missing_raw_worker_fields_cannot_pass_via_summary(field: str) -> None:
    """缺少进程原始字段时不能仅凭摘要通过。"""
    state = payload(ready(WORKER, OTHER))
    state['workers'][0].pop(field)
    result = await wait(AsyncMock(return_value=state))
    assert result['reason'] == 'invalid_observation'


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'changes',
    [
        {'state': []},
        {'heartbeatTime': 'not-a-time'},
        {'heartbeatTime': NOW.replace(tzinfo=None).isoformat()},
        {'digest': DIGEST},
        {'pluginId': 'other_demo'},
    ],
)
async def test_invalid_worker_state_identity_or_naive_time_is_fail_closed(changes: dict) -> None:
    """无效进程状态、身份或无时区时刻导致验收失败。"""
    state = payload(ready(WORKER, OTHER))
    state['workers'][0].update(changes)
    result = await wait(AsyncMock(return_value=state))
    assert result['reason'] == 'invalid_observation'


@pytest.mark.asyncio
async def test_target_change_after_pending_observation_keeps_original_pin() -> None:
    """待定观测后的目标变更保留原固定目标。"""
    reader = AsyncMock(side_effect=[payload(), payload(generation='f' * 32), payload(ready(WORKER, OTHER))])
    result = await wait(reader)
    expected_attempts = 2
    assert result['reason'] == 'target_changed' and result['attempts'] == expected_attempts
    assert result['target']['generation'] == GENERATION
    assert result['lastObserved']['generation'] == 'f' * 32


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ('state', 'reason'),
    [
        (None, 'invalid_observation'),
        ({'ok': False, 'message': 'private-error'}, 'unavailable'),
        ({'ok': True, 'releases': 'private-error'}, 'invalid_observation'),
    ],
)
async def test_unavailable_or_malformed_payload_is_structured_and_redacted(state: object, reason: str) -> None:
    """不可用或格式错误的响应返回脱敏的结构化信息。"""
    result = await wait(AsyncMock(return_value=state))
    assert result['reason'] == reason and result['lastObserved'] is None
    assert 'private-error' not in str(result)
