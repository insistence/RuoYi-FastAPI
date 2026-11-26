import asyncio
import json
import time
from typing import Any
from unittest.mock import Mock

from redis.asyncio import Redis


class FakeRedis:
    """
    实现本轮服务所用 SET NX、TTL、GET/DEL 和 Lua 等效语义的 FakeRedis。

    :ivar client: 供被测服务调用的异步 Redis 客户端替身
    :ivar values: 当前处理的值集合
    :ivar lists: 模拟 Redis 保存的列表数据
    :ivar lock: 用于串行访问共享资源的锁
    :ivar set_calls: 记录 ``set`` 的调用情况
    :ivar eval_calls: 记录 ``eval`` 的调用情况
    """

    def __init__(self) -> None:
        """初始化测试夹具的 ``values``, ``lists``, ``lock``, ``set_calls``。"""
        self.client: Redis = Mock(spec_set=Redis, wraps=self)
        self.values: dict[str, tuple[str, float | None]] = {}
        self.lists: dict[str, list[str | bytes]] = {}
        self.lock = asyncio.Lock()
        self.set_calls: list[tuple[str, dict[str, Any]]] = []
        self.eval_calls: list[tuple[str, tuple[Any, ...]]] = []

    def _purge(self, key: str) -> None:
        """
        清除到期的测试缓存值。

        :param key: 查找数据时使用的键
        """
        item = self.values.get(key)
        if item is not None and item[1] is not None and item[1] <= time.monotonic():
            self.values.pop(key, None)

    async def set(self, key: str, value: str, ex: int | None = None, nx: bool = False, **kwargs: Any) -> bool:
        """
        写入测试缓存键并设置过期时间。

        :param key: 查找数据时使用的键
        :param value: 待处理的输入值
        :param ex: 捕获到的异常实例
        :param nx: 是否只在键尚不存在时写入
        :param kwargs: 传给被调用对象的关键字参数
        :return: 是否写入测试缓存键并设置过期时间
        """
        async with self.lock:
            self._purge(key)
            self.set_calls.append((key, {'ex': ex, 'nx': nx, **kwargs}))
            if nx and key in self.values:
                return False
            self.values[key] = (value, time.monotonic() + ex if ex is not None else None)
            return True

    async def get(self, key: str) -> str | None:
        """
        读取测试存储中的指定键。

        :param key: 查找数据时使用的键
        :return: 测试存储中的指定键
        """
        async with self.lock:
            self._purge(key)
            value = self.values.get(key)
            return value[0] if value else None

    async def exists(self, key: str) -> int:
        """
        按 Redis EXISTS 语义返回键数量。

        :param key: 查找数据时使用的键
        :return: 键存在时为一，否则为零
        """
        async with self.lock:
            self._purge(key)
            return int(key in self.values)

    async def delete(self, key: str) -> int:
        """
        删除测试缓存项及其过期状态。

        :param key: 查找数据时使用的键
        :return: 实际删除的键数
        """
        async with self.lock:
            self._purge(key)
            return int(self.values.pop(key, None) is not None)

    async def rpush(self, key: str, value: str | bytes) -> int:
        """
        追加队列元素。

        :param key: 查找数据时使用的键
        :param value: 待处理的输入值
        :return: 追加后的队列长度
        """
        async with self.lock:
            self.lists.setdefault(key, []).append(value)
            return len(self.lists[key])

    async def lpop(self, key: str) -> str | bytes | None:
        """
        原子弹出队首元素。

        :param key: 查找数据时使用的键
        :return: 队首元素，队列为空时返回空值
        """
        async with self.lock:
            values = self.lists.get(key, [])
            return values.pop(0) if values else None

    async def ltrim(self, key: str, start: int, end: int) -> bool:
        """
        按 Redis 负索引语义裁剪列表。

        :param key: 查找数据时使用的键
        :param start: 选取范围的起始位置
        :param end: 选取范围的结束位置
        :return: 此分支的固定值 ``True``
        """
        async with self.lock:
            values = self.lists.get(key, [])
            size = len(values)
            first = start if start >= 0 else max(0, size + start)
            last = end if end >= 0 else size + end
            self.lists[key] = values[first : last + 1] if first <= last else []
            return True

    async def ttl(self, key: str) -> int:
        """
        查询测试缓存键的剩余生存时间。

        :param key: 查找数据时使用的键
        :return: 测试缓存键的剩余生存时间
        """
        async with self.lock:
            self._purge(key)
            value = self.values.get(key)
            if value is None or value[1] is None:
                return -1
            return max(0, int(value[1] - time.monotonic()))

    async def eval(self, script: str, numkeys: int, *args: Any) -> Any:  # noqa: PLR0911, PLR0912
        """
        按测试约定模拟 Redis 脚本的执行。

        :param script: 需要运行的脚本
        :param numkeys: 传给 Redis 脚本的键数量
        :param args: 传给被调用对象的位置参数
        :return: 对应脚本分支的记录、有效期或状态码
        """
        async with self.lock:
            self.eval_calls.append((script, args))
            key = args[0]
            self._purge(key)
            if 'INCR' in script and 'EXPIRE' in script:
                current = int(self.values.get(key, ('0', None))[0]) + 1
                ttl = int(args[1])
                expiry = time.monotonic() + ttl
                self.values[key] = (str(current), expiry)
                return [current, ttl]
            if 'codeHash' in script and 'KEYS[3]' in script:
                value = self.values.get(key)
                tombstone_key = args[1]
                payload_key = args[2]
                if value is None:
                    self._purge(tombstone_key)
                    consumed = self.values.get(payload_key)
                    if consumed is not None:
                        try:
                            consumed_payload = json.loads(consumed[0])
                        except json.JSONDecodeError:
                            consumed_payload = None
                        if isinstance(consumed_payload, dict) and consumed_payload.get('codeHash') != args[3]:
                            return -3
                    return -4 if tombstone_key in self.values else None
                try:
                    payload = json.loads(value[0])
                except json.JSONDecodeError:
                    return -2
                if str(payload.get('version')) != str(args[4]) or payload.get('codeHash') != args[3]:
                    return -3
                self.values.pop(key, None)
                self.values[tombstone_key] = (str(args[5]), time.monotonic() + int(args[6]))
                self.values[payload_key] = (value[0], time.monotonic() + int(args[6]))
                return value[0]
            if 'codeHash' in script:
                value = self.values.get(key)
                if value is None:
                    return None
                try:
                    payload = json.loads(value[0])
                except json.JSONDecodeError:
                    return -2
                if str(payload.get('version')) != str(args[2]) or payload.get('codeHash') != args[1]:
                    return -3
                self.values.pop(key, None)
                return value[0]
            value = self.values.get(key)
            if value is None:
                return -1
            current = json.loads(value[0])
            expected = json.loads(args[2])
            if value[1] is None or value[1] <= time.monotonic():
                self.values.pop(key, None)
                return -5
            if str(current.get('version')) != str(args[1]):
                return -2
            if current.get('status') not in expected:
                return -3
            self.values[key] = (args[3], value[1])
            return 1
