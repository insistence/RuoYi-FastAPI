from uuid import uuid4

from fastapi import Response

from utils.log_util import logger
from utils.response_util import ResponseUtil


class ExceptionUtil:
    """
    未知异常的安全响应与诊断工具类。
    """

    @staticmethod
    def handle_unexpected_exception(exc: Exception) -> Response:
        """
        记录脱敏诊断并返回不包含内部异常信息的统一响应。

        :param exc: 未知异常对象
        :return: 包含错误关联标识的安全响应
        """
        error_id = uuid4().hex
        logger.bind(error_id=error_id).opt(exception=exc).error('请求处理失败，错误标识：{}', error_id)
        return ResponseUtil.error(
            msg='服务暂时不可用，请稍后重试',
            msg_key='common.unavailable',
            data={'errorId': error_id},
            headers={'X-Error-Id': error_id},
        )
