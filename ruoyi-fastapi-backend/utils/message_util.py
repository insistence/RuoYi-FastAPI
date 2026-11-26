from utils.log_util import logger


def message_service(sms_code: str) -> None:
    """
    将短信验证码写入日志。

    :param sms_code: 短信验证码
    """
    logger.info(f'短信验证码为{sms_code}')
