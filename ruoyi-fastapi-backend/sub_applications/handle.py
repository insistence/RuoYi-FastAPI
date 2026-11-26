from fastapi import FastAPI

from sub_applications.staticfiles import mount_staticfiles


def handle_sub_applications(app: FastAPI) -> None:
    """
    全局处理子应用挂载。

    :param app: 正在配置或处理请求的 ASGI 应用
    """
    # 挂载静态文件
    mount_staticfiles(app)
