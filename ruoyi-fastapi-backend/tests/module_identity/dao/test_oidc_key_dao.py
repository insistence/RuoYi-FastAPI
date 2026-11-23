from datetime import UTC, datetime
from typing import Any

import pytest
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession

from module_identity.dao.oidc_key_dao import OidcKeyDao
from module_identity.entity.do.oidc_key_do import SysOidcSigningKey


def _key(kid: str, status: str = 'pending') -> SysOidcSigningKey:
    """
    构造带引用私钥材料的测试密钥。

    :param kid: 用于定位签名密钥的标识
    :param status: 操作或记录所处的状态
    :return: 带引用私钥材料的测试密钥
    """
    now = datetime.now(UTC)
    return SysOidcSigningKey(
        kid=kid,
        alg='RS256',
        public_jwk={'kty': 'RSA', 'kid': kid},
        private_key_ref=f'kms://{kid}',
        status=status,
        publish_at=now,
        create_by='test',
    )


@pytest.mark.asyncio
async def test_activate_serializes_by_algorithm_when_no_active_key_exists(data_session: AsyncSession) -> None:
    """验证无 Active Key 时先执行算法范围写锁，再激活唯一目标。"""
    data_session.add_all([_key('pending-a'), _key('pending-b')])
    await data_session.flush()
    statements: list[str] = []

    def capture(
        _connection: Any,
        _cursor: Any,
        statement: str,
        _parameters: Any,
        _context: Any,
        _executemany: bool,
    ) -> None:
        """
        保存调用参数供断言使用。

        :param _connection: SQLAlchemy 事件传入的数据库连接
        :param _cursor: SQLAlchemy 事件传入的游标
        :param statement: 即将执行的数据库语句
        :param _parameters: SQL 执行时绑定的参数
        :param _context: 执行当前语句的上下文
        :param _executemany: 是否执行批量 SQL
        """
        if statement.lstrip().upper().startswith(('UPDATE', 'SELECT')):
            statements.append(statement.upper())

    event.listen(data_session.bind.sync_engine, 'before_cursor_execute', capture)
    try:
        assert await OidcKeyDao.activate(data_session, 'pending-a', 'RS256')
        await data_session.flush()
    finally:
        event.remove(data_session.bind.sync_engine, 'before_cursor_execute', capture)

    rows = (await data_session.execute(select(SysOidcSigningKey))).scalars().all()
    assert [row.status for row in rows].count('active') == 1
    assert statements and statements[0].startswith('SELECT SYS_OIDC_SIGNING_KEY')
    assert 'WHERE SYS_OIDC_SIGNING_KEY.ALG' in statements[0]
