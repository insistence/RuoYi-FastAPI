from .naming import PluginScaffoldNaming


class PluginFrontendApiScaffoldTemplateBuilder:
    """各宿主框架共用的请求封装模板。"""

    @staticmethod
    def build_api(plugin_id: str) -> str:
        """
        构建前端 API 模板内容。

        :param plugin_id: 插件ID
        :return: 前端 API 模板内容
        """
        return f"""import request from '@/utils/request'

export function ping{PluginScaffoldNaming.to_class_name(plugin_id)}() {{
  return request({{
    url: '/{plugin_id}/ping',
    method: 'get'
  }})
}}
"""

    @staticmethod
    def build_crud_api(plugin_id: str) -> str:
        """
        构建前端 CRUD API 模板内容。

        :param plugin_id: 插件ID
        :return: 前端 CRUD API 模板内容
        """
        class_name = PluginScaffoldNaming.to_class_name(plugin_id)
        return f"""import request from '@/utils/request'

export function ping{class_name}() {{
  return request({{
    url: '/{plugin_id}/ping',
    method: 'get'
  }})
}}

export function list{class_name}Items(query) {{
  return request({{
    url: '/{plugin_id}/items',
    method: 'get',
    params: query
  }})
}}

export function add{class_name}Item(data) {{
  return request({{
    url: '/{plugin_id}/items',
    method: 'post',
    data
  }})
}}

export function update{class_name}Item(itemId, data) {{
  return request({{
    url: '/{plugin_id}/items/' + itemId,
    method: 'put',
    data
  }})
}}

export function del{class_name}Item(itemId) {{
  return request({{
    url: '/{plugin_id}/items/' + itemId,
    method: 'delete'
  }})
}}
"""
