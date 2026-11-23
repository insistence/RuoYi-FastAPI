class FakeSession:
    """
    测试用异步数据库会话。

    :ivar committed: 是否已经提交事务
    :ivar rolled_back: 是否已经回滚事务
    :ivar executed_statements: 测试替身收到的 SQL 语句
    """

    def __init__(self) -> None:
        """初始化测试用异步数据库会话。"""
        self.committed = False
        self.rolled_back = False
        self.executed_statements = []

    async def __aenter__(self) -> 'FakeSession':
        """
        进入异步上下文。

        :return: 当前实例
        """
        return self

    async def __aexit__(self, exc_type: object, exc: object, traceback: object) -> None:
        """
        退出异步上下文。

        :param exc_type: 退出上下文时的异常类型
        :param exc: 捕获到的异常实例
        :param traceback: 异常的调用栈
        """

    async def commit(self) -> None:
        """记录提交动作。"""
        self.committed = True

    async def rollback(self) -> None:
        """记录回滚动作。"""
        self.rolled_back = True

    async def execute(self, statement: object) -> None:
        """
        记录 SQL 执行动作。

        :param statement: 即将执行的数据库语句
        """
        self.executed_statements.append(str(statement))


class FakeSessionLocal:
    """
    测试用异步数据库会话工厂。

    :ivar last_session: 最近一次创建或使用的会话
    :ivar sessions: 测试创建的数据库会话或会话工厂
    """

    def __init__(self) -> None:
        """初始化测试用异步数据库会话工厂。"""
        self.last_session: FakeSession | None = None
        self.sessions: list[FakeSession] = []

    def __call__(self) -> FakeSession:
        """
        创建测试会话。

        :return: 测试会话
        """
        self.last_session = FakeSession()
        self.sessions.append(self.last_session)
        return self.last_session

    @property
    def audit_session(self) -> FakeSession | None:
        """
        获取最后一个审计会话。

        :return: 最后一个审计会话
        """
        return self.sessions[-1] if self.sessions else None

    @property
    def committed_session(self) -> FakeSession | None:
        """
        获取最后一个已提交会话。

        :return: 最后一个已提交会话
        """
        committed_sessions = [session for session in self.sessions if session.committed]
        return committed_sessions[-1] if committed_sessions else None

    @property
    def executed_session(self) -> FakeSession | None:
        """
        获取最后一个执行过 SQL 的会话。

        :return: 最后一个执行过 SQL 的会话
        """
        executed_sessions = [session for session in self.sessions if session.executed_statements]
        return executed_sessions[-1] if executed_sessions else None
