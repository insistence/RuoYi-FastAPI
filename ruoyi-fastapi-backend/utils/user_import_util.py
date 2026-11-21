from numbers import Real

from exceptions.exception import ServiceException


class UserImportUtil:
    """
    用户导入格式注册与归一化工具类
    """

    # 已发布模板的别名独立于当前启用语言，新增语言时追加别名，保留旧模板兼容性。
    HEADER_ALIASES = {
        'dept_id': ('部门编号', 'Department ID'),
        'user_name': ('登录名称', 'Login name', 'Username'),
        'nick_name': ('用户名称', 'Display name'),
        'email': ('用户邮箱', 'User email', 'Email address'),
        'phonenumber': ('手机号码', 'Phone number'),
        'sex': ('用户性别', 'User gender', 'Gender'),
        'status': ('帐号状态', 'Account status', 'Status'),
    }
    VALUE_ALIASES = {
        'sex': {'0': ('男', 'Male'), '1': ('女', 'Female'), '2': ('未知', 'Unknown')},
        'status': {'0': ('正常', 'Active', 'Enabled', 'Normal'), '1': ('停用', 'Disabled')},
    }

    @classmethod
    def normalize_headers(cls, headers: list[object]) -> list[str]:
        """
        独立于界面语言识别已发布模板，拒绝歧义或缺失的必需列

        :param headers: 表格原始表头
        :return: 对应的稳定字段名，额外列保留原名
        """
        aliases = {}
        for field, names in cls.HEADER_ALIASES.items():
            for name in names:
                alias = name.strip().casefold()
                if alias in aliases and aliases[alias] != field:
                    raise ValueError(f'Ambiguous import header alias: {name}')
                aliases[alias] = field
        result = []
        seen = set()
        for header in headers:
            original = str(header).strip()
            field = aliases.get(original.casefold(), original)
            if field in seen:
                raise ServiceException(
                    message=f'导入文件存在重复列：{original}',
                    msg_key='import.duplicateColumn',
                    msg_params={'column': original},
                )
            seen.add(field)
            result.append(field)
        missing = cls.HEADER_ALIASES.keys() - seen
        if missing:
            columns = ', '.join(sorted(missing))
            raise ServiceException(
                message=f'导入文件缺少必需列：{columns}',
                msg_key='import.missingColumns',
                msg_params={'columns': columns},
            )
        return result

    @classmethod
    def normalize_value(cls, field: str, value: object) -> str:
        """
        将模板固定枚举名称或原始码值映射回稳定码值

        :param field: 导入字段名
        :param value: 单元格内容
        :return: 稳定码值
        """
        if isinstance(value, Real) and not isinstance(value, bool) and float(value).is_integer():
            value = int(value)
        normalized = str(value).strip().casefold()
        for code, aliases in cls.VALUE_ALIASES[field].items():
            if normalized in {code, *(alias.casefold() for alias in aliases)}:
                return code
        raise ServiceException(
            message=f'导入字段{field}的值无效：{value}',
            msg_key='import.invalidValue',
            msg_params={'field': field, 'value': str(value)},
        )
