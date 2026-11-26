from sqlalchemy.ext.asyncio import AsyncSession


class RecordingSession(AsyncSession):
    """
    记录事务边界的测试会话。

    :ivar commits: 提交次数
    :ivar rollbacks: 回滚次数
    """

    def __init__(self) -> None:
        """创建无绑定的会话并初始化事务计数。"""
        super().__init__()
        self.commits = 0
        self.rollbacks = 0

    async def commit(self) -> None:
        """记录一次提交。"""
        self.commits += 1

    async def rollback(self) -> None:
        """记录一次回滚。"""
        self.rollbacks += 1
