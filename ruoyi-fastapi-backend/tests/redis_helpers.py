"""
供测试使用的独立 Redis 进程和跨版本到期时间查询
"""

import os
import secrets
import shutil
import socket
import subprocess
import tempfile
import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from redis import Redis as SyncRedis
from redis.asyncio import Redis
from redis.exceptions import RedisError

STARTUP_TIMEOUT_SECONDS = 5
DEFAULT_REDIS_PORT = 6379
ABSOLUTE_EXPIRY_SCRIPT = """
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then return ttl end
local clock = redis.call('TIME')
return tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000) + ttl
"""


@dataclass(frozen=True)
class IsolatedRedisServer:
    """
    保存测试子进程和 Redis 标识，防止清空其他实例
    """

    process: subprocess.Popen
    connection: dict[str, Any]
    run_id: str

    async def reset_database(self, client: Redis) -> None:
        """
        确认测试子进程存活且实例标识一致后清空测试库

        :param client: 测试实例的 Redis 客户端
        :return: None
        """
        if self.process.poll() is not None:
            raise RuntimeError('Isolated Redis process has exited; refusing to clear a database')
        info = await client.info('server')
        if info.get('run_id') != self.run_id:
            raise RuntimeError('Redis instance changed; refusing to clear a database')
        await client.flushdb()


def redis_server_executable() -> str | None:
    """
    查找显式指定或 PATH 中的测试 Redis 程序，不读取应用配置

    :return: Redis 程序路径，未找到时返回 None
    """
    configured = os.environ.get('RUOYI_TEST_REDIS_SERVER')
    executable = shutil.which(configured or 'redis-server')
    if configured and executable is None:
        raise ValueError('RUOYI_TEST_REDIS_SERVER does not identify an executable')
    return executable


def available_loopback_port() -> int:
    """
    由操作系统分配空闲 TCP 端口，排除 Redis 默认端口

    :return: 可用于回环连接的端口
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    if port == DEFAULT_REDIS_PORT:
        raise RuntimeError('Refusing to use the default Redis port for an isolated test')
    return port


def stop_redis_process(process: subprocess.Popen) -> None:
    """
    回收测试子进程，超时后强制结束并等待退出

    :param process: 本次测试创建的子进程
    :return: None
    """
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


@contextmanager
def isolated_redis_server(executable: str) -> Iterator[IsolatedRedisServer]:
    """
    启动隔离 Redis，Linux 使用临时套接字，Windows 使用动态回环端口

    :param executable: Redis 程序路径
    :return: 使用随机密码的测试实例
    """
    windows = os.name == 'nt'
    with tempfile.TemporaryDirectory(prefix='user-cache-', dir=None if windows else '/tmp') as directory:
        password = secrets.token_hex(32)
        connection: dict[str, Any] = {
            'password': password,
            'decode_responses': True,
            'socket_timeout': 1,
            'socket_connect_timeout': 1,
        }
        if windows:
            port = available_loopback_port()
            connection.update(host='127.0.0.1', port=port)
            address = ['--bind', '127.0.0.1', '--port', str(port)]
        else:
            socket_path = str(Path(directory) / 'redis.sock')
            connection['unix_socket_path'] = socket_path
            address = ['--port', '0', '--unixsocket', socket_path]
        process = subprocess.Popen(
            [
                executable,
                *address,
                '--save',
                '',
                '--appendonly',
                'no',
                '--dir',
                directory,
                '--requirepass',
                password,
                '--daemonize',
                'no',
            ],
            cwd=directory,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if windows else 0,
        )
        try:
            deadline = time.monotonic() + STARTUP_TIMEOUT_SECONDS
            with SyncRedis(**connection) as client:
                while time.monotonic() < deadline:
                    if process.poll() is not None:
                        raise RuntimeError('Isolated Redis process failed to start')
                    try:
                        # 随机密码防止动态端口释放后的竞争误连；启动阶段只执行只读命令。
                        info = client.info('server')
                    except RedisError:
                        time.sleep(0.02)
                        continue
                    run_id = info.get('run_id')
                    if not run_id:
                        raise RuntimeError('Isolated Redis did not provide a server identity')
                    break
                else:
                    raise RuntimeError('Isolated Redis did not become ready')
            yield IsolatedRedisServer(process, connection, run_id)
        finally:
            stop_redis_process(process)


async def absolute_expiry_ms(client: Redis, key: str) -> int:
    """
    原子读取绝对到期时刻，兼容 Redis 6.2

    :param client: Redis 客户端
    :param key: 待查询的缓存键
    :return: 毫秒到期时刻，无到期时间或键不存在时保留 Redis 负值语义
    """
    return int(await client.eval(ABSOLUTE_EXPIRY_SCRIPT, 1, key))
