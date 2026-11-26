from pydantic import Field

from common.types import ApiUtcDateTime
from common.vo import CamelModel


class CpuInfo(CamelModel):
    """描述处理器的核心数量和使用情况。"""

    cpu_num: int | None = Field(default=None, description='核心数')
    used: float | None = Field(default=None, description='CPU用户使用率')
    sys: float | None = Field(default=None, description='CPU系统使用率')
    free: float | None = Field(default=None, description='CPU当前空闲率')


class MemoryInfo(CamelModel):
    """描述服务器内存的容量和占用情况。"""

    total: str | None = Field(default=None, description='内存总量')
    used: str | None = Field(default=None, description='已用内存')
    free: str | None = Field(default=None, description='剩余内存')
    usage: float | None = Field(default=None, description='使用率')


class SysInfo(CamelModel):
    """描述服务器主机及操作系统信息。"""

    computer_ip: str | None = Field(default=None, description='服务器IP')
    computer_name: str | None = Field(default=None, description='服务器名称')
    os_arch: str | None = Field(default=None, description='系统架构')
    os_name: str | None = Field(default=None, description='操作系统')
    user_dir: str | None = Field(default=None, description='项目路径')


class PyInfo(MemoryInfo):
    """描述 Python 运行环境及进程信息。"""

    name: str | None = Field(default=None, description='Python名称')
    version: str | None = Field(default=None, description='Python版本')
    start_time: ApiUtcDateTime | None = Field(default=None, description='启动时间')
    run_time: str | None = Field(default=None, description='运行时长')
    home: str | None = Field(default=None, description='安装路径')


class SysFiles(CamelModel):
    """描述文件系统挂载点及磁盘空间用量。"""

    dir_name: str | None = Field(default=None, description='盘符路径')
    sys_type_name: str | None = Field(default=None, description='盘符类型')
    type_name: str | None = Field(default=None, description='文件类型')
    total: str | None = Field(default=None, description='总大小')
    used: str | None = Field(default=None, description='已经使用量')
    free: str | None = Field(default=None, description='剩余大小')
    usage: str | None = Field(default=None, description='资源的使用率')


class ServerMonitorModel(CamelModel):
    """服务监控对应pydantic模型。"""

    cpu: CpuInfo | None = Field(description='CPU相关信息')
    py: PyInfo | None = Field(description='Python相关信息')
    mem: MemoryInfo | None = Field(description='內存相关信息')
    sys: SysInfo | None = Field(description='服务器相关信息')
    sys_files: list[SysFiles] | None = Field(description='磁盘相关信息')
