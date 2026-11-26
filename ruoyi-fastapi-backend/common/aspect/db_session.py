from collections.abc import AsyncIterator
from functools import cache

from fastapi import params
from sqlalchemy.ext.asyncio import AsyncSession

from config.database import DataSourceRegistry


class DBSessionProvider:
    """
    数据库会话依赖提供者。

    :ivar source_name: 数据源名称
    """

    def __init__(self, source_name: str | None = None) -> None:
        """
        绑定请求会话使用的数据源名称。

        :param source_name: 数据源名称
        """
        self.source_name = source_name

    async def __call__(self) -> AsyncIterator[AsyncSession]:
        """
        创建指定数据源的数据库会话。

        :yield: 异步数据库会话
        """
        async with DataSourceRegistry.session(self.source_name) as session:
            yield session


@cache
def get_db_session_provider(source_name: str | None) -> DBSessionProvider:
    """
    获取指定数据源的数据库会话依赖提供者。

    :param source_name: 数据源名称
    :return: 数据库会话依赖提供者
    """
    return DBSessionProvider(source_name)


def DBSessionDependency(source_name: str | None = None) -> params.Depends:  # noqa: N802
    """
    数据库会话依赖。

    :param source_name: 数据源名称，为空时使用默认数据源
    :return: 数据库会话依赖
    """
    return params.Depends(get_db_session_provider(source_name))
