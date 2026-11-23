import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from plugins.core.manifest.menu_tree import PluginMenuTree
from plugins.core.manifest.schema import (
    CORE_FRONTEND_COMPONENTS,
    HOOK_PATTERN,
    VERSION_CONSTRAINT_PATTERN,
    BackendManifest,
    CompatibilityManifest,
    FrontendDeliveryManifest,
    FrontendManifest,
    PluginJobManifest,
    PluginManifest,
    RouterManifest,
)

MODULE_PATTERN = re.compile(r'^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$')
SAFE_PATH_PATTERN = re.compile(r'^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*$')


def validate_relative_resource(value: str) -> str:
    """
    只允许可移植的相对资源路径；真实路径边界在读取前再次检查。

    :param value: 清单声明的相对资源路径
    :return: 通过格式校验的相对资源路径
    :raises ValueError: 资源必须使用安全相对路径，不能包含绝对路径、反斜杠或点目录
    """
    if not SAFE_PATH_PATTERN.fullmatch(value) or any(part in {'.', '..'} for part in value.split('/')):
        raise ValueError('资源必须使用安全相对路径，不能包含绝对路径、反斜杠或点目录')
    return value


class NativeManifest(BaseModel):
    """已经离线安装到插件目录的原生发行包声明。"""

    model_config = ConfigDict(populate_by_name=True, extra='forbid')

    distribution: str = Field(
        pattern=r'^[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?$', description='已安装的原生发行包名称'
    )
    module_root: str = Field(default='native', alias='moduleRoot', description='原生模块在插件目录下的相对路径')

    _validate_module_root = field_validator('module_root')(validate_relative_resource)


class AsgiManifest(BaseModel):
    """子应用挂载与生命周期声明。"""

    model_config = ConfigDict(populate_by_name=True, extra='forbid')

    mount_path: str | None = Field(default=None, alias='mountPath', description='ASGI 子应用的挂载路径')
    lifespan: Literal['managed', 'none'] = Field(default='managed', description='子应用生命周期管理方式')


class PluginJobManifestV2(PluginJobManifest):
    """在宿主事件循环中分发，禁止把原生对象发送至进程池。"""

    executor: Literal['default'] = Field(default='default', description='调度任务使用的执行器')
    timeout_seconds: float = Field(
        default=30.0,
        gt=0,
        le=86400,
        allow_inf_nan=False,
        alias='timeoutSeconds',
        description='等待任务完成的超时时间（秒）',
    )


class BackendManifestV2(BackendManifest):
    """交付运行时和 Web 接入方式彼此独立。"""

    runtime: Literal['python', 'native'] = Field(default='python', description='插件后端运行时类型')
    integration: Literal['router', 'asgi'] = Field(default='router', description='插件接入宿主的方式')
    entrypoint: str = Field(description='创建插件后端的入口函数路径')
    routers: RouterManifest = Field(
        default_factory=lambda: RouterManifest(autoScan=False), description='插件的路由注册配置'
    )
    native: NativeManifest | None = Field(default=None, description='原生后端的发行包配置')
    asgi: AsgiManifest | None = Field(default=None, description='ASGI 子应用配置')
    jobs: list[PluginJobManifestV2] = Field(default_factory=list, description='插件声明的调度任务')

    @field_validator('entrypoint')
    @classmethod
    def validate_entrypoint(cls, value: str) -> str:
        """
        入口必须是显式模块及顶层 callable。

        :param value: 清单声明的显式入口路径
        :return: 通过格式校验的入口路径
        :raises ValueError: backend.entrypoint 必须使用 <module_path>:<callable_name> 格式
        """
        if not HOOK_PATTERN.fullmatch(value):
            raise ValueError('backend.entrypoint 必须使用 <module_path>:<callable_name> 格式')
        return value

    @model_validator(mode='after')
    def validate_delivery(self) -> 'BackendManifestV2':
        """
        拒绝含糊或冲突的加载方式。

        :return: 通过运行时及接入方式一致性校验的后端声明
        :raises ValueError: 后端模块、原生运行时、回调或生命周期配置与声明的接入方式不符
        """
        if not MODULE_PATTERN.fullmatch(self.module):
            raise ValueError('backend.module 必须是合法 Python 模块名')
        entry_module = self.entrypoint.split(':', 1)[0]
        if entry_module != self.module and not entry_module.startswith(f'{self.module}.'):
            raise ValueError('backend.entrypoint 必须位于当前插件模块内')
        if self.routers.auto_scan:
            raise ValueError('v2 使用显式入口，backend.routers.autoScan 必须为 false')
        if (self.runtime == 'native') != (self.native is not None):
            raise ValueError('仅 native 运行时必须声明 backend.native')
        callbacks = [value for value in self.hooks.model_dump().values() if value is not None]
        if self.health.checker:
            callbacks.append(self.health.checker)
        for callback in callbacks:
            callback_module = callback.split(':', 1)[0]
            if callback_module != self.module and not callback_module.startswith(f'{self.module}.'):
                raise ValueError('v2 Hook 和健康检查必须使用当前插件内的完整模块路径')
        if self.integration == 'asgi':
            self.asgi = self.asgi or AsgiManifest()
            if self.hooks.on_startup or self.hooks.on_shutdown:
                raise ValueError('ASGI 的启动和关闭必须使用 lifespan，不能重复声明运行时 Hook')
        elif self.asgi is not None:
            raise ValueError('仅 ASGI 接入方式允许 backend.asgi')
        return self


class FrontendDeliveryManifestV2(FrontendDeliveryManifest):
    """独立构建产物不参与宿主前端构建。"""

    type: Literal['none', 'source', 'bundle'] = Field(default='none', description='前端交付类型')


class FrontendBundleManifest(BaseModel):
    """插件内的静态构建资源。"""

    model_config = ConfigDict(populate_by_name=True, extra='forbid')

    directory: str = Field(default='web/dist', description='前端资源包目录')
    entry: str = Field(default='index.html', description='前端资源包的入口文件')
    spa_fallback: bool = Field(default=True, alias='spaFallback', description='是否将页面导航回退到单页应用入口')

    _validate_paths = field_validator('directory', 'entry')(validate_relative_resource)

    @field_validator('entry')
    @classmethod
    def validate_html_entry(cls, value: str) -> str:
        """
        入口为 HTML，避免把任意资源作为页面声明。

        :param value: 前端构建产物的入口文件路径
        :return: 通过 HTML 后缀校验的入口文件路径
        :raises ValueError: bundle.entry 必须是 HTML 文件
        """
        if not value.endswith('.html'):
            raise ValueError('bundle.entry 必须是 HTML 文件')
        return value


class FrontendManifestV2(FrontendManifest):
    """兼容源码页面并增加构建产物声明。"""

    delivery: FrontendDeliveryManifestV2 = Field(
        default_factory=FrontendDeliveryManifestV2, description='前端资源的交付配置'
    )
    bundle: FrontendBundleManifest | None = Field(default=None, description='预构建前端资源包的配置')


class CompatibilityManifestV2(CompatibilityManifest):
    """宿主插件 API 与应用版本分别约束。"""

    host_api_version: str = Field(default='^1.0.0', alias='hostApiVersion', description='插件兼容的宿主接口版本')

    @field_validator('host_api_version')
    @classmethod
    def validate_host_api_version(cls, value: str) -> str:
        """
        沿用平台现有版本约束语法。

        :param value: 宿主插件 API 版本约束表达式
        :return: 通过语法校验的版本约束表达式
        :raises ValueError: compatibility.hostApiVersion 必须是版本号或带操作符的版本约束
        """
        if not VERSION_CONSTRAINT_PATTERN.fullmatch(value):
            raise ValueError('compatibility.hostApiVersion 必须是版本号或带操作符的版本约束')
        return value


class PluginManifestV2(PluginManifest):
    """继承通用权限、菜单、配置及依赖规则，替换交付相关约束。"""

    manifest_version: Literal[2] = Field(default=2, alias='manifestVersion', description='插件清单格式版本')
    backend: BackendManifestV2 = Field(description='插件后端声明')
    frontend: FrontendManifestV2 = Field(default_factory=FrontendManifestV2, description='插件前端声明')
    compatibility: CompatibilityManifestV2 = Field(
        default_factory=CompatibilityManifestV2, description='插件的宿主兼容性要求'
    )

    def _validate_backend_module(self) -> None:
        """
        校验后端模块命名空间，并补全固定的 ASGI 挂载路径。

        :raises ValueError: 后端模块或 ASGI 挂载路径与当前插件的命名不符
        """
        expected = f'ruoyi_plugin_{self.id}' if self.backend.runtime == 'native' else f'plugins.{self.id}'
        if self.backend.module != expected:
            raise ValueError(f'backend.module 必须为 {expected}')
        if self.backend.asgi is not None:
            expected_mount = f'/apps/{self.id}'
            if self.backend.asgi.mount_path not in (None, expected_mount):
                raise ValueError(f'backend.asgi.mountPath 必须为 {expected_mount}')
            self.backend.asgi.mount_path = expected_mount

    def _fill_frontend_delivery_defaults(self) -> None:
        """
        补全前端交付默认值并校验独立构建产物的交付约束。

        :raises ValueError: 仅 bundle 交付允许 frontend.bundle；bundle 前端需要 ASGI 接入方式；bundle 交付必须声明 frontend.bundle；bundle 不参与宿主构建，buildRequired 必须为 false；bundle 的 npm 构建依赖由插件独立管理，不能安装到宿主
        """
        if self.frontend.delivery.type != 'bundle':
            if self.frontend.bundle is not None:
                raise ValueError('仅 bundle 交付允许 frontend.bundle')
            super()._fill_frontend_delivery_defaults()
            return
        if self.backend.integration != 'asgi':
            raise ValueError('bundle 前端需要 ASGI 接入方式')
        if self.frontend.bundle is None:
            raise ValueError('bundle 交付必须声明 frontend.bundle')
        if self.frontend.delivery.build_required:
            raise ValueError('bundle 不参与宿主构建，buildRequired 必须为 false')
        if self.dependencies.has_frontend_dependencies:
            raise ValueError('bundle 的 npm 构建依赖由插件独立管理，不能安装到宿主')

    def _validate_menu_components(self) -> None:
        """
        校验独立构建产物菜单仅使用插件框架或核心布局组件。

        :raises ValueError: bundle 菜单仅允许 PluginFrame 或核心布局组件
        """
        if self.frontend.delivery.type != 'bundle':
            super()._validate_menu_components()
            return
        for menu in PluginMenuTree.flatten(self.frontend.menus):
            if menu.type == 'F':
                continue
            if menu.component not in CORE_FRONTEND_COMPONENTS | {'PluginFrame'}:
                raise ValueError('bundle 菜单仅允许 PluginFrame 或核心布局组件')

    def _validate_job_callable_prefixes(self) -> None:
        """
        校验任务回调位于当前插件后端模块命名空间内。

        :raises ValueError: 任务回调路径没有使用当前插件前缀
        """
        expected_prefix = f'{self.backend.module}.'
        if any(not job.callable.startswith(expected_prefix) for job in self.backend.jobs):
            raise ValueError(f'插件任务 callable 必须使用 {expected_prefix} 前缀')
