import pytest

from cli.exit_codes import RUNTIME_ERROR
from cli.runtime.config import ConfigRuntimeService
from cli.runtime.config.gateway import ConfigInfrastructureGateway
from cli.runtime.config.support import ConfigDomainSupport

MISSING_CONFIG_KEY = 'sys.demo.key'


def test_config_domain_support_builds_missing_config_result() -> None:
    """校验参数配置领域支持对象会生成统一的缺失结果。"""
    support = ConfigDomainSupport(ConfigInfrastructureGateway())

    payload = support.build_missing_config_result(MISSING_CONFIG_KEY, 'cache')

    assert payload == {
        'ok': False,
        'message': f'参数缓存不存在：{MISSING_CONFIG_KEY}',
        'source': 'cache',
        'exit_code': RUNTIME_ERROR,
    }


def test_config_domain_support_serializes_cache_payload_with_sanitizer() -> None:
    """校验参数配置领域支持对象会对缓存配置做脱敏序列化。"""

    class FakeSanitizer:
        """模拟脱敏工具。"""

        @staticmethod
        def sanitize_data(payload: dict[str, str]) -> dict[str, str]:
            """
            返回带标记的脱敏结果。

            :param payload: 原始载荷
            :return: 脱敏结果
            """
            return {**payload, 'sanitized': 'yes'}

    gateway = ConfigInfrastructureGateway()
    support = ConfigDomainSupport(gateway)

    def _fake_get_log_sanitizer() -> FakeSanitizer:
        """
        创建测试使用的 ``FakeSanitizer`` 实例。

        :return: 测试使用的 ``FakeSanitizer`` 实例
        """
        return FakeSanitizer()

    object.__setattr__(gateway, 'get_log_sanitizer', _fake_get_log_sanitizer)

    payload = support.serialize_cache_payload(MISSING_CONFIG_KEY, 'demo-value')

    assert payload == {
        'configKey': MISSING_CONFIG_KEY,
        'configValue': 'demo-value',
        'sanitized': 'yes',
    }


def test_config_runtime_service_builds_cli_config_model_from_orm_record() -> None:
    """校验 CLI 会将 ORM 配置记录显式映射为可序列化的配置模型。"""

    class FakeOrmConfigRecord:
        """
        模拟 ORM 配置记录。

        :cvar config_id: 参数配置id
        :cvar config_name: 参数名称
        :cvar config_key: 用于查找配置项的键
        :cvar config_value: 参数键值
        :cvar config_type: 当前配置的类型
        :cvar create_by: 创建者
        :cvar create_time: 创建时间
        :cvar update_by: 更新者
        :cvar update_time: 更新时间
        :cvar remark: 供用户阅读的补充说明
        """

        config_id = 2
        config_name = '用户管理-账号初始密码'
        config_key = 'sys.user.initPassword'
        config_value = '123456'
        config_type = 'Y'
        create_by = 'admin'
        create_time = None
        update_by = ''
        update_time = None
        remark = '初始化密码 123456'

    class FakeConfigModel:
        """
        模拟 VO 配置模型。

        :ivar kwargs: 传给被调用对象的关键字参数
        """

        def __init__(self, **kwargs: object) -> None:
            """
            初始化测试夹具的 ``kwargs``。

            :param kwargs: 传给被调用对象的关键字参数
            """
            self.kwargs = kwargs

    class FakeConfigVoModule:
        """
        模拟配置 VO 模块。

        :cvar ConfigModel: 测试暴露的配置模型
        """

        ConfigModel = FakeConfigModel

    model = ConfigRuntimeService.build_cli_config_model(FakeConfigVoModule, FakeOrmConfigRecord())

    assert isinstance(model, FakeConfigModel)
    assert model.kwargs == {
        'configId': 2,
        'configName': '用户管理-账号初始密码',
        'configKey': 'sys.user.initPassword',
        'configValue': '123456',
        'configType': 'Y',
        'createBy': 'admin',
        'createTime': None,
        'updateBy': '',
        'updateTime': None,
        'remark': '初始化密码 123456',
    }


@pytest.mark.asyncio
async def test_config_runtime_service_returns_missing_db_config_result() -> None:
    """校验参数配置运行时在数据库中未找到配置时会返回统一结果。"""

    class FakeSession:
        """模拟异步会话。"""

        async def __aenter__(self) -> 'FakeSession':
            """
            向调用方返回 ``self``。

            :return: 当前测试对象
            """
            return self

        async def __aexit__(
            self,
            exc_type: type[BaseException] | None,
            exc: BaseException | None,
            tb: object,
        ) -> None:
            """
            结束测试资源的异步上下文。

            :param exc_type: 退出上下文时的异常类型
            :param exc: 捕获到的异常实例
            :param tb: 异常发生时的回溯信息
            """
            del exc_type, exc, tb

    class FakeSessionFactory:
        """模拟异步会话工厂。"""

        def __call__(self) -> FakeSession:
            """
            创建测试使用的 ``FakeSession`` 实例。

            :return: 测试使用的 ``FakeSession`` 实例
            """
            return FakeSession()

    class FakeConfigModel:
        """
        模拟配置模型。

        :ivar kwargs: 传给被调用对象的关键字参数
        """

        def __init__(self, **kwargs: str) -> None:
            """
            初始化测试夹具的 ``kwargs``。

            :param kwargs: 传给被调用对象的关键字参数
            """
            self.kwargs = kwargs

    class FakeConfigVoModule:
        """
        模拟配置 VO 模块。

        :cvar ConfigModel: 测试暴露的配置模型
        """

        ConfigModel = FakeConfigModel

    class FakeConfigDao:
        """模拟配置 DAO。"""

        @staticmethod
        async def get_config_detail_by_info(session: FakeSession, config_model: FakeConfigModel) -> None:
            """
            返回空结果。

            :param session: 数据库会话
            :param config_model: 配置模型
            """
            assert isinstance(session, FakeSession)
            assert config_model.kwargs == {'configKey': MISSING_CONFIG_KEY}

    gateway = ConfigInfrastructureGateway()
    service = ConfigRuntimeService(infrastructure_gateway=gateway)

    def _fake_get_async_session_local() -> FakeSessionFactory:
        """
        创建测试使用的 ``FakeSessionFactory`` 实例。

        :return: 测试使用的 ``FakeSessionFactory`` 实例
        """
        return FakeSessionFactory()

    def _fake_get_config_dao() -> FakeConfigDao:
        """
        创建测试使用的 ``FakeConfigDao`` 实例。

        :return: 测试使用的 ``FakeConfigDao`` 实例
        """
        return FakeConfigDao()

    def _fake_get_config_vo_module() -> FakeConfigVoModule:
        """
        创建测试使用的 ``FakeConfigVoModule`` 实例。

        :return: 测试使用的 ``FakeConfigVoModule`` 实例
        """
        return FakeConfigVoModule()

    object.__setattr__(gateway, 'get_async_session_local', _fake_get_async_session_local)
    object.__setattr__(gateway, 'get_config_dao', _fake_get_config_dao)
    object.__setattr__(gateway, 'get_config_vo_module', _fake_get_config_vo_module)

    payload = await service.get_config(MISSING_CONFIG_KEY, source='db')

    assert payload == {
        'ok': False,
        'message': f'参数配置不存在：{MISSING_CONFIG_KEY}',
        'source': 'db',
        'exit_code': RUNTIME_ERROR,
    }
