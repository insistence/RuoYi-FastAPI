import asyncio
import hashlib
import uuid
from dataclasses import dataclass
from typing import Any

import anyio
from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine

from module_admin.entity.vo.user_vo import CurrentUserModel
from utils.log_util import logger


@dataclass(frozen=True, slots=True)
class CurrentUserCacheTicket:
    """
    当前用户查询开始时的缓存版本和固定有效期
    """

    global_epoch: str
    user_epoch: str
    created_at_ms: int
    deadline_ms: int


class CurrentUserCacheUtil:
    """
    当前用户快照缓存工具类

    数据库提交后主动失效，硬过期限制失效遗漏时的缓存复用时间。
    """

    _OPERATION_TIMEOUT_SECONDS = 1
    _READ_RESULT_SIZE = 5
    # 用户版本在停止访问后自动回收，快照仍按查询开始时的固定期限过期
    _USER_EPOCH_TTL_SECONDS = 3600

    _READ_SCRIPT = """
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local global_epoch = redis.call('GET', KEYS[1])
local user_epoch = redis.call('GET', KEYS[2])
if not global_epoch then
    global_epoch = ARGV[1]
    redis.call('SET', KEYS[1], global_epoch)
end
if not user_epoch then
    user_epoch = ARGV[2]
    redis.call('SET', KEYS[2], user_epoch)
end
redis.call('EXPIRE', KEYS[2], ARGV[4])
local value = redis.call('HMGET', KEYS[3], 'global_epoch', 'user_epoch', 'created_at', 'deadline', 'payload')
local created_at = tonumber(value[3])
local deadline = tonumber(value[4])
if value[1] == global_epoch and value[2] == user_epoch
    and created_at and deadline and created_at <= now and deadline > now
    and created_at + tonumber(ARGV[3]) > now and value[5] then
    return {global_epoch, user_epoch, tostring(now), tostring(now + tonumber(ARGV[3])), value[5]}
end
return {global_epoch, user_epoch, tostring(now), tostring(now + tonumber(ARGV[3])), ''}
"""
    _WRITE_SCRIPT = """
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
if tonumber(ARGV[3]) > now or tonumber(ARGV[4]) <= now
    or redis.call('GET', KEYS[1]) ~= ARGV[1]
    or redis.call('GET', KEYS[2]) ~= ARGV[2] then
    return 0
end
local previous = redis.call('HMGET', KEYS[3], 'global_epoch', 'user_epoch', 'created_at')
if previous[1] == ARGV[1] and previous[2] == ARGV[2]
    and tonumber(previous[3]) and tonumber(previous[3]) > tonumber(ARGV[3]) then
    return 0
end
redis.call('HSET', KEYS[3], 'global_epoch', ARGV[1], 'user_epoch', ARGV[2],
    'created_at', ARGV[3], 'deadline', ARGV[4], 'payload', ARGV[5])
redis.call('PEXPIREAT', KEYS[3], ARGV[4])
return 1
"""
    _INVALIDATE_SCRIPT = """
for index, key in ipairs(KEYS) do
    redis.call('SET', key, ARGV[index])
    if tonumber(ARGV[#KEYS + 1]) > 0 then
        redis.call('EXPIRE', key, ARGV[#KEYS + 1])
    end
end
return #KEYS
"""

    @staticmethod
    def namespace_for_bind(bind: object) -> str | None:
        """
        根据数据库连接目标生成缓存命名空间，不访问数据库

        :param bind: 数据库引擎或连接
        :return: 隐藏密码后的连接目标摘要，未知绑定返回None
        """
        if isinstance(bind, (Connection, AsyncConnection)):
            bind = bind.engine
        if not isinstance(bind, (Engine, AsyncEngine)):
            return None
        return hashlib.sha256(bind.url.render_as_string(hide_password=True).encode()).hexdigest()

    @staticmethod
    def _keys(namespace: str, user_id: int) -> tuple[str, str, str]:
        """
        获取同一数据源下的版本和用户快照键

        :param namespace: 数据源缓存命名空间
        :param user_id: 用户id
        :return: 全局版本、用户版本和快照键
        """
        digest = hashlib.sha256(namespace.encode()).hexdigest()
        prefix = f'current_user_cache:v1:{{{digest}}}'
        return f'{prefix}:global', f'{prefix}:user:{user_id}', f'{prefix}:snapshot:{user_id}'

    @classmethod
    async def read(
        cls, redis: Redis, namespace: str, user_id: int, ttl_seconds: int
    ) -> tuple[CurrentUserModel | None, CurrentUserCacheTicket | None]:
        """
        原子读取用户快照，未命中时返回用于安全回填的查询凭据

        :param redis: Redis连接对象
        :param namespace: 数据源缓存命名空间
        :param user_id: 用户id
        :param ttl_seconds: 快照最大有效期，单位秒
        :return: 用户快照和查询凭据，缓存故障时均为None
        """
        if ttl_seconds <= 0:
            return None, None
        try:
            result = await cls._eval(
                redis,
                cls._READ_SCRIPT,
                3,
                *cls._keys(namespace, user_id),
                uuid.uuid4().hex,
                uuid.uuid4().hex,
                ttl_seconds * 1000,
                cls._USER_EPOCH_TTL_SECONDS,
            )
            if not isinstance(result, (list, tuple)) or len(result) != cls._READ_RESULT_SIZE:
                raise ValueError('用户缓存响应格式无效')
            ticket = CurrentUserCacheTicket(
                global_epoch=cls._text(result[0]),
                user_epoch=cls._text(result[1]),
                created_at_ms=int(result[2]),
                deadline_ms=int(result[3]),
            )
        except (RedisError, TimeoutError, ValueError, TypeError, IndexError):
            logger.warning('当前用户缓存读取失败，回源数据库')
            return None, None
        if not result[4]:
            return None, ticket
        try:
            current_user = CurrentUserModel.model_validate_json(result[4])
            if (
                current_user.user is None
                or current_user.user.user_id != user_id
                or current_user.user.password is not None
                or current_user.user.status not in (None, '0')
                or current_user.user.del_flag not in (None, '0')
            ):
                raise ValueError('用户快照无效')
        except Exception:
            logger.warning('当前用户缓存内容无效，回源数据库')
            return None, ticket
        return current_user, None

    @classmethod
    async def write(
        cls,
        redis: Redis,
        namespace: str,
        user_id: int,
        current_user: CurrentUserModel,
        ticket: CurrentUserCacheTicket,
    ) -> bool:
        """
        版本未变化时回填用户快照，不延长查询开始时的有效期

        :param redis: Redis连接对象
        :param namespace: 数据源缓存命名空间
        :param user_id: 用户id
        :param current_user: 数据库查询得到的当前用户
        :param ticket: 查询开始前取得的版本和有效期
        :return: 是否写入成功
        """
        if current_user.user is None or current_user.user.user_id != user_id:
            return False
        try:
            payload = current_user.model_dump_json(
                by_alias=True,
                include={'permissions', 'roles', 'user'},
                exclude={'user': {'password'}},
            )
            return (
                await cls._eval(
                    redis,
                    cls._WRITE_SCRIPT,
                    3,
                    *cls._keys(namespace, user_id),
                    ticket.global_epoch,
                    ticket.user_epoch,
                    ticket.created_at_ms,
                    ticket.deadline_ms,
                    payload,
                )
                == 1
            )
        except (RedisError, TimeoutError, ValueError, TypeError):
            logger.warning('当前用户缓存写入失败，本次使用数据库查询结果')
            return False

    @classmethod
    async def invalidate(cls, redis: Redis, namespace: str, user_ids: set[int] | None = None) -> bool:
        """
        轮换用户或共享信息版本，使已有快照和并发查询凭据失效

        :param redis: Redis连接对象
        :param namespace: 数据源缓存命名空间
        :param user_ids: 受影响的用户id，为None时失效全部用户快照
        :return: 是否失效成功
        """
        if user_ids is not None and not user_ids:
            return True
        keys = (
            [cls._keys(namespace, 0)[0]]
            if user_ids is None
            else [cls._keys(namespace, user_id)[1] for user_id in sorted(user_ids)]
        )
        try:
            return await cls._eval(
                redis,
                cls._INVALIDATE_SCRIPT,
                len(keys),
                *keys,
                *(uuid.uuid4().hex for _ in keys),
                cls._USER_EPOCH_TTL_SECONDS if user_ids is not None else 0,
            ) == len(keys)
        except (RedisError, TimeoutError):
            logger.warning('当前用户缓存失效失败，等待快照硬过期')
            return False

    @classmethod
    async def _eval(cls, redis: Redis, script: str, key_count: int, *args: object) -> Any:
        """
        限时执行Redis脚本，取消后等待连接归还

        :param redis: Redis连接对象
        :param script: Lua脚本
        :param key_count: 脚本键数量
        :param args: 脚本键和参数
        :return: Redis响应值
        """
        task = asyncio.ensure_future(redis.eval(script, key_count, *args))
        try:
            with anyio.fail_after(cls._OPERATION_TIMEOUT_SECONDS):
                return await asyncio.shield(task)
        finally:
            if not task.done():
                # 隔离AnyIO的重复取消，避免中断redis-py归还共享连接。
                task.cancel()
                settled = asyncio.gather(task, return_exceptions=True)
                cancelled = False
                with anyio.CancelScope(shield=True):
                    while not settled.done():
                        try:
                            await asyncio.shield(settled)
                        except asyncio.CancelledError:  # noqa: PERF203
                            cancelled = True
                if cancelled:
                    raise asyncio.CancelledError
            elif not task.cancelled():
                task.exception()
            # 连接清理可能超过命令超时，清理期间的取消仍需向调用方传播。
            await anyio.lowlevel.checkpoint_if_cancelled()

    @staticmethod
    def _text(value: str | bytes) -> str:
        """
        兼容Redis字符串和字节响应

        :param value: Redis响应值
        :return: 字符串
        """
        return value.decode() if isinstance(value, bytes) else value
