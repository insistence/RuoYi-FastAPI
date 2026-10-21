from dataclasses import dataclass
from typing import Annotated, Literal

import typer

from cli.completion.providers import COMPLETION_PROVIDER_GATEWAY


@dataclass
class CliContext:
    """
    CLI 运行上下文。

    env: 当前加载的配置文件选择名
    app_env: 已加载配置声明的实际应用环境
    output: 结果输出格式
    operator: 操作者标识，后续用于审计
    allow_prod: 是否显式允许生产环境执行危险命令
    yes: 是否跳过二次确认
    dry_run: 是否执行演练模式
    """

    env: str = 'dev'
    output: Literal['text', 'json'] = 'text'
    operator: str | None = None
    allow_prod: bool = False
    yes: bool = False
    dry_run: bool = False
    app_env: str | None = None


class CliContextBuilder:
    """
    CLI 上下文构建器。

    该对象负责将命令层显式参数收口为统一的 `CliContext` 数据对象，
    供上下文工厂与测试场景复用。
    """

    @staticmethod
    def build(
        env: str,
        output: Literal['text', 'json'],
        allow_prod: bool,
        yes: bool,
        dry_run: bool,
    ) -> CliContext:
        """
        构建命令执行上下文。

        :param env: 当前命令环境
        :param output: 输出格式
        :param allow_prod: 是否允许生产环境危险命令
        :param yes: 是否跳过二次确认
        :param dry_run: 是否执行演练模式
        :return: 构建完成的 CLI 上下文
        """
        # 必须与实际资源配置使用同一来源，命令参数默认值不能覆盖已加载的环境。
        from config.env import AppConfig, get_config  # noqa: PLC0415 - 保留 CLI 启动时的惰性配置加载

        return CliContext(
            env=get_config.run_env,
            app_env=AppConfig.app_env,
            output=output,
            allow_prod=allow_prod,
            yes=yes,
            dry_run=dry_run,
        )


CLI_CONTEXT_BUILDER = CliContextBuilder()

EnvOption = Annotated[
    str,
    typer.Option(
        '--env',
        envvar='APP_ENV',
        help='运行环境配置名称',
        autocompletion=COMPLETION_PROVIDER_GATEWAY.complete_env_values,
    ),
]
OutputOption = Annotated[Literal['text', 'json'], typer.Option('--output', help='输出格式，支持 text 或 json')]
AllowProdOption = Annotated[bool, typer.Option('--allow-prod', help='允许在生产环境中执行危险命令')]
YesOption = Annotated[bool, typer.Option('--yes', help='跳过危险命令确认')]
DryRunOption = Annotated[bool, typer.Option('--dry-run', help='仅执行预演，不落地实际变更')]
