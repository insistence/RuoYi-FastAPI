import json
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from common.vo import CrudResponseModel, PageModel
from i18n.message import I18nMessage
from i18n.translation import TranslationUtil
from module_admin.dao.job_log_dao import JobLogDao
from module_admin.entity.vo.job_vo import DeleteJobLogModel, JobLogModel, JobLogPageQueryModel
from module_admin.service.dict_service import DictDataService
from utils.excel_util import ExcelUtil


class JobLogService:
    """
    定时任务日志管理模块服务层
    """

    @classmethod
    async def get_job_log_list_services(
        cls, query_db: AsyncSession, query_object: JobLogPageQueryModel, is_page: bool = False
    ) -> PageModel | list[dict[str, Any]]:
        """
        获取定时任务日志列表信息service

        :param query_db: orm对象
        :param query_object: 查询参数对象
        :param is_page: 是否开启分页
        :return: 定时任务日志列表信息对象
        """
        job_log_list_result = await JobLogDao.get_job_log_list(query_db, query_object, is_page)

        return job_log_list_result

    @classmethod
    def add_job_log_services(cls, query_db: Session, page_object: JobLogModel) -> CrudResponseModel:
        """
        新增定时任务日志信息service

        :param query_db: orm对象
        :param page_object: 新增定时任务日志对象
        :return: 新增定时任务日志校验结果
        """
        try:
            JobLogDao.add_job_log_dao(query_db, page_object)
            query_db.commit()
            result = {'is_success': True, 'message': '新增成功', 'msg_key': 'common.added'}
        except Exception as e:
            query_db.rollback()
            result = {'is_success': False, 'message': str(e)}

        return CrudResponseModel(**result)

    @classmethod
    async def delete_job_log_services(cls, query_db: AsyncSession, page_object: DeleteJobLogModel) -> CrudResponseModel:
        """
        删除定时任务日志信息service

        :param query_db: orm对象
        :param page_object: 删除定时任务日志对象
        :return: 删除定时任务日志校验结果
        """
        if page_object.job_log_ids:
            job_log_id_list = page_object.job_log_ids.split(',')
            try:
                for job_log_id in job_log_id_list:
                    await JobLogDao.delete_job_log_dao(query_db, JobLogModel(jobLogId=job_log_id))
                await query_db.commit()
                result = {'is_success': True, 'message': '删除成功', 'msg_key': 'common.deleted'}
            except Exception as e:
                await query_db.rollback()
                raise e
        else:
            result = {'is_success': False, 'message': '传入定时任务日志id为空'}
        return CrudResponseModel(**result)

    @classmethod
    async def clear_job_log_services(cls, query_db: AsyncSession) -> CrudResponseModel:
        """
        清除定时任务日志信息service

        :param query_db: orm对象
        :return: 清除定时任务日志校验结果
        """
        try:
            await JobLogDao.clear_job_log_dao(query_db)
            await query_db.commit()
            result = {'is_success': True, 'message': '清除成功', 'msg_key': 'common.cleared'}
        except Exception as e:
            await query_db.rollback()
            raise e

        return CrudResponseModel(**result)

    @staticmethod
    async def export_job_log_list_services(request: Request, job_log_list: list) -> bytes:
        """
        导出定时任务日志信息service

        :param request: Request对象
        :param job_log_list: 定时任务日志信息列表
        :return: 定时任务日志信息对应excel的二进制数据
        """
        # 创建一个映射字典，将英文键映射到中文键
        mapping_dict = {
            'jobLogId': I18nMessage('任务日志编码', msg_key='export.jobLogId'),
            'jobId': I18nMessage('任务ID', msg_key='export.jobId'),
            'executionId': I18nMessage('执行ID', msg_key='export.executionId'),
            'jobName': I18nMessage('任务名称', msg_key='export.jobName'),
            'jobGroup': I18nMessage('任务组名', msg_key='export.jobGroup'),
            'jobStore': I18nMessage('调度存储', msg_key='export.jobStore'),
            'jobExecutor': I18nMessage('任务执行器', msg_key='export.executor'),
            'invokeTarget': I18nMessage('调用目标字符串', msg_key='export.invokeTarget'),
            'jobArgs': I18nMessage('位置参数', msg_key='export.args'),
            'jobKwargs': I18nMessage('关键字参数', msg_key='export.kwargs'),
            'jobTrigger': I18nMessage('任务触发器', msg_key='export.trigger'),
            'jobMessage': I18nMessage('日志信息', msg_key='export.logMessage'),
            'status': I18nMessage('执行状态', msg_key='export.executionStatus'),
            'exceptionInfo': I18nMessage('异常信息', msg_key='export.exception'),
            'scheduledTime': I18nMessage('计划执行时刻', msg_key='export.scheduledAt'),
            'runDurationMs': I18nMessage('执行耗时（毫秒）', msg_key='export.executionDuration'),
            'timeZone': I18nMessage('任务时区', msg_key='export.jobTimezone'),
            'startTime': I18nMessage('执行开始时间', msg_key='export.startedAt'),
            'endTime': I18nMessage('执行结束时间', msg_key='export.finishedAt'),
            'createTime': I18nMessage('创建时间', msg_key='export.createdAt'),
        }

        job_executor_list = await DictDataService.query_dict_data_list_from_cache_services(
            request.app.state.redis, dict_type='sys_job_executor'
        )
        job_executor_option = [
            {
                'label': TranslationUtil.resolve(item.get('dictLabel'), item.get('dictLabelI18n')),
                'value': item.get('dictValue'),
            }
            for item in job_executor_list
        ]
        job_executor_option_dict = {item.get('value'): item for item in job_executor_option}

        for item in job_log_list:
            item['jobArgs'] = json.dumps(item.get('jobArgs'), ensure_ascii=False)
            item['jobKwargs'] = json.dumps(item.get('jobKwargs'), ensure_ascii=False)
            if item.get('status') == '0':
                item['status'] = I18nMessage('正常', msg_key='export.active')
            else:
                item['status'] = I18nMessage('失败', msg_key='export.failure')
            if str(item.get('jobExecutor')) in job_executor_option_dict:
                item['jobExecutor'] = job_executor_option_dict.get(str(item.get('jobExecutor'))).get('label')
        binary_data = ExcelUtil.export_list2excel(job_log_list, mapping_dict)

        return binary_data
