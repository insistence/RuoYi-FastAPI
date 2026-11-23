import os


class Config:
    """
    保存端到端测试使用的环境配置。

    :cvar frontend_url: 被测前端服务的根地址
    :cvar backend_url: 被测后端服务的根地址
    :cvar browser_channel: 启动浏览器时使用的发行通道
    :cvar swagger_disabled: 是否停用了 Swagger UI
    :cvar frontend_framework: 用于生成或构建前端的框架
    """

    frontend_url = os.environ.get('TEST_FRONTEND_URL', 'http://localhost:80')
    backend_url = os.environ.get('TEST_BACKEND_URL', 'http://localhost:9099')
    browser_channel = os.environ.get('TEST_BROWSER_CHANNEL') or None
    swagger_disabled = os.environ.get('TEST_SWAGGER_DISABLED', 'true').lower() == 'true'
    frontend_framework = os.environ.get('TEST_FRONTEND_FRAMEWORK', os.environ.get('FRONTEND_FRAMEWORK', 'vue3'))
