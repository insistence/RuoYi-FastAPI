import json
from types import SimpleNamespace

import pytest

from config import database
from module_generator.entity.vo.gen_vo import GenTableColumnModel, GenTableModel, GenTableParamsModel
from module_generator.service.gen_service import GenTableService
from utils.template_util import TemplateInitializer, TemplateUtils

MAX_GENERATED_LINE_LENGTH = 120


def _gen_table(
    *,
    gen_view: bool,
    tpl_web_type: str = 'element-ui',
    tpl_category: str = 'crud',
) -> GenTableModel:
    """
    构造含主键及样例字段的生成表。

    :param gen_view: 是否生成详情页
    :param tpl_web_type: 前端模板类型（element-ui、element-plus、react-antd）
    :param tpl_category: 使用的模板（crud单表操作 tree树表操作）
    :return: 含主键及样例字段的生成表
    """
    columns = [
        GenTableColumnModel(
            column_name='item_id',
            column_comment='编号',
            column_type='bigint',
            python_type='int',
            python_field='itemId',
            is_pk='1',
            is_list='1',
            html_type='input',
        ),
        GenTableColumnModel(
            column_name='item_name',
            column_comment='名称（展示名称）',
            column_type='varchar(100)',
            python_type='str',
            python_field='itemName',
            is_list='1',
            html_type='input',
        ),
        GenTableColumnModel(
            column_name='status',
            column_comment='状态',
            column_type='char(1)',
            python_type='str',
            python_field='status',
            is_list='1',
            html_type='select',
            dict_type='sys_normal_disable',
        ),
    ]
    return GenTableModel(
        table_name='gen_item',
        table_comment='生成测试',
        class_name='GenItem',
        tpl_category=tpl_category,
        tpl_web_type=tpl_web_type,
        package_name='module_test',
        module_name='test',
        business_name='item',
        function_name='测试项',
        function_author='RuoYi',
        form_col_num=2,
        options=json.dumps(
            {
                'genView': gen_view,
                'parentMenuId': 3,
                'treeCode': 'item_id',
                'treeParentCode': 'parent_id',
                'treeName': 'item_name',
            }
        ),
        columns=columns,
        pk_column=columns[0],
    )


@pytest.mark.parametrize(
    ('value', 'expected'),
    [
        (True, True),
        (False, False),
        (1, True),
        (0, False),
        ('1', True),
        ('0', False),
        ('true', True),
        ('false', False),
        (None, False),
    ],
)
def test_get_gen_view_supports_stored_option_formats(value: object, expected: bool) -> None:
    """生成视图设置支持已存储的选项格式。"""
    params = {'genView': value} if value is not None else None

    assert TemplateUtils.get_gen_view(params) is expected


@pytest.mark.parametrize(('value', 'expected'), [('1', True), ('0', False)])
def test_gen_table_params_accepts_frontend_string_switch(value: str, expected: bool) -> None:
    """生成表参数接受前端字符串开关。"""
    assert GenTableParamsModel(gen_view=value).gen_view is expected


@pytest.mark.parametrize(
    ('tpl_web_type', 'view_template'),
    [
        ('element-ui', 'vue/view.vue.jinja2'),
        ('element-plus', 'vue/v3/view.vue.jinja2'),
    ],
)
def test_template_list_and_context_include_optional_view(tpl_web_type: str, view_template: str) -> None:
    """模板清单和上下文包含可选视图。"""
    gen_table = _gen_table(gen_view=True, tpl_web_type=tpl_web_type)

    templates = TemplateUtils.get_template_list(gen_table)
    context = TemplateUtils.prepare_context(gen_table)

    assert view_template in templates
    assert context['genView'] is True
    assert TemplateUtils.get_file_name(view_template, gen_table) == 'frontend/src/views/test/item/view.vue'


def test_template_list_omits_view_when_disabled() -> None:
    """关闭视图后模板清单省略该项。"""
    gen_table = _gen_table(gen_view=False)

    templates = TemplateUtils.get_template_list(gen_table)
    context = TemplateUtils.prepare_context(gen_table)

    assert 'vue/view.vue.jinja2' not in templates
    assert context['genView'] is False


@pytest.mark.parametrize('tpl_web_type', ['element-ui', 'element-plus'])
@pytest.mark.parametrize('tpl_category', ['crud', 'tree'])
def test_detail_templates_render_with_list_integration(tpl_web_type: str, tpl_category: str) -> None:
    """详情模板渲染时集成列表入口。"""
    gen_table = _gen_table(gen_view=True, tpl_web_type=tpl_web_type, tpl_category=tpl_category)
    context = TemplateUtils.prepare_context(gen_table)
    env = TemplateInitializer.init_jinja2()
    templates = TemplateUtils.get_template_list(gen_table)

    rendered = {template: env.get_template(template).render(**context) for template in templates}
    index_name = 'index-tree.vue.jinja2' if tpl_category == 'tree' else 'index.vue.jinja2'
    index_template = f'vue{"/v3" if tpl_web_type == "element-plus" else ""}/{index_name}'
    view_template = f'vue{"/v3" if tpl_web_type == "element-plus" else ""}/view.vue.jinja2'

    assert 'handleViewData' in rendered[index_template]
    assert '<item-view-drawer ref="itemViewRef" />' in rendered[index_template]
    assert 'generated.test.item:detailTitle' in rendered[view_template]
    assert context['generatedI18n'].frontend['zh-CN']['detailTitle'] == '测试项详情'
    assert 'getItem(itemId)' in rendered[view_template]
    assert 'sys_normal_disable' in rendered[view_template]


@pytest.mark.asyncio
async def test_set_table_from_options_restores_view_flag() -> None:
    """从表选项恢复视图开关。"""
    gen_table = _gen_table(gen_view=True)
    gen_table.view = False

    result = await GenTableService.set_table_from_options(gen_table)

    assert result.view is True


def test_secondary_source_templates_use_named_dependency_and_isolated_metadata(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """辅助数据源模板使用具名依赖及独立元数据。"""
    gen_table = _gen_table(gen_view=False)
    gen_table.data_source_name = 'reporting'
    monkeypatch.setattr(
        type(database.DataBaseConfig),
        'get_source',
        lambda _self, _name=None: SimpleNamespace(db_type='postgresql'),
    )

    context = TemplateUtils.prepare_context(gen_table)
    env = TemplateInitializer.init_jinja2()
    controller = env.get_template('python/controller.py.jinja2').render(**context)
    entity = env.get_template('python/do.py.jinja2').render(**context)

    assert "DBSessionDependency('reporting')" in controller
    assert 'from common.aspect.db_session import DBSessionDependency' in controller
    assert "DataSourceBase = get_data_source_base('reporting')" in entity
    assert 'class GenItem(DataSourceBase):' in entity
    assert 'from config.database import Base' not in entity
    assert 'from datetime import datetime' not in entity
    assert 'from common.mixin import' not in entity
    compile(entity, '<generated-entity>', 'exec')
    dao = env.get_template('python/dao.py.jinja2').render(**context)
    assert 'await db.execute(update(GenItem), [item])' in dao
    compile(dao, '<generated-dao>', 'exec')
    compile(controller, '<generated-controller>', 'exec')


def test_python_templates_handle_audit_timestamps_by_exact_column_name() -> None:
    """Python 模板按确切列名处理审计时间。"""
    columns = [
        GenTableColumnModel(
            column_name='item_id',
            column_comment='编号',
            column_type='bigint',
            python_type='int',
            python_field='itemId',
            is_pk='1',
            is_insert='1',
        ),
        GenTableColumnModel(
            column_name='create_by',
            column_comment='创建者',
            column_type='varchar(64)',
            python_type='str',
            python_field='createBy',
            is_insert='1',
            is_edit='0',
        ),
        GenTableColumnModel(
            column_name='update_by',
            column_comment='更新者',
            column_type='varchar(64)',
            python_type='str',
            python_field='updateBy',
            is_insert='1',
            is_edit='1',
        ),
        GenTableColumnModel(
            column_name='create_time',
            column_comment='创建时间',
            column_type='datetime',
            python_type='datetime',
            python_field='createTime',
            is_insert='1',
            is_edit='0',
        ),
        GenTableColumnModel(
            column_name='update_time',
            column_comment='更新时间',
            column_type='datetime',
            python_type='datetime',
            python_field='updateTime',
            is_insert='1',
            is_edit='1',
        ),
        GenTableColumnModel(
            column_name='created_time',
            column_comment='其他时间',
            column_type='datetime',
            python_type='datetime',
            python_field='createdTime',
            is_insert='1',
            is_edit='1',
        ),
    ]
    gen_table = _gen_table(gen_view=False)
    gen_table.columns = columns
    gen_table.pk_column = columns[0]

    context = TemplateUtils.prepare_context(gen_table)
    env = TemplateInitializer.init_jinja2()
    entity = env.get_template('python/do.py.jinja2').render(**context)
    dao = env.get_template('python/dao.py.jinja2').render(**context)
    controller = env.get_template('python/controller.py.jinja2').render(**context)

    assert 'from datetime import datetime' in entity
    assert 'from common.mixin import AuditTimeMixin' in entity
    assert 'class GenItem(AuditTimeMixin, Base):' in entity
    assert 'create_time: Mapped[' not in entity
    assert 'update_time: Mapped[' not in entity
    assert 'from common.types import DbUtcDateTime' in entity
    assert 'created_time: Mapped[datetime | None] = mapped_column(DbUtcDateTime(), nullable=True, comment=' in entity
    assert "model_dump(exclude={'create_time', 'update_time'})" in dao
    assert "if key not in {'create_time', 'update_time'}" in dao
    assert 'create_time = datetime.now()' not in controller
    assert 'update_time = datetime.now()' not in controller
    assert 'create_by = current_user.user.user_name' in controller
    assert 'update_by = current_user.user.user_name' in controller
    compile(entity, '<generated-audit-entity>', 'exec')
    compile(dao, '<generated-audit-dao>', 'exec')
    compile(controller, '<generated-audit-controller>', 'exec')
    assert entity.index('from sqlalchemy import') < entity.index('from common.mixin import AuditTimeMixin')
    assert all(len(line) <= MAX_GENERATED_LINE_LENGTH for line in entity.splitlines())
    assert all(len(line) <= MAX_GENERATED_LINE_LENGTH for line in dao.splitlines())
    assert all(len(line) <= MAX_GENERATED_LINE_LENGTH for line in controller.splitlines())


def test_dao_audit_filter_uses_a_set_for_a_single_timestamp() -> None:
    """DAO 过滤单一审计时间时仍使用集合。"""
    columns = [
        GenTableColumnModel(
            column_name='item_id',
            column_comment='编号',
            column_type='bigint',
            python_type='int',
            python_field='itemId',
            is_pk='1',
            is_insert='1',
        ),
        GenTableColumnModel(
            column_name='create_time',
            column_comment='创建时间',
            column_type='datetime',
            python_type='datetime',
            python_field='createTime',
            is_insert='1',
        ),
    ]
    gen_table = _gen_table(gen_view=False)
    gen_table.columns = columns
    gen_table.pk_column = columns[0]

    context = TemplateUtils.prepare_context(gen_table)
    env = TemplateInitializer.init_jinja2()
    entity = env.get_template('python/do.py.jinja2').render(**context)
    dao = env.get_template('python/dao.py.jinja2').render(**context)

    assert 'from common.mixin import CreateTimeMixin' in entity
    assert 'class GenItem(CreateTimeMixin, Base):' in entity
    assert 'create_time: Mapped[' not in entity
    assert "if key not in {'create_time'}" in dao
    compile(entity, '<generated-single-audit-entity>', 'exec')
    compile(dao, '<generated-single-audit-dao>', 'exec')


def test_do_template_supports_required_update_time_only_mixin() -> None:
    """数据对象模板支持仅要求更新时间的混入类。"""
    columns = [
        GenTableColumnModel(
            column_name='item_id',
            column_comment='编号',
            column_type='bigint',
            python_type='int',
            python_field='itemId',
            is_pk='1',
        ),
        GenTableColumnModel(
            column_name='update_time',
            column_comment='最后修改时间',
            column_type='datetime',
            python_type='datetime',
            python_field='updateTime',
            is_required='1',
        ),
    ]
    gen_table = _gen_table(gen_view=False)
    gen_table.columns = columns
    gen_table.pk_column = columns[0]

    context = TemplateUtils.prepare_context(gen_table)
    entity = TemplateInitializer.init_jinja2().get_template('python/do.py.jinja2').render(**context)

    assert 'from common.mixin import UpdateTimeMixin' in entity
    assert 'class GenItem(UpdateTimeMixin, Base):' in entity
    assert '__update_time_nullable__ = False' in entity
    assert "__update_time_comment__ = '最后修改时间'" in entity
    assert 'DateTime' not in entity
    compile(entity, '<generated-update-audit-entity>', 'exec')


def test_sub_table_entity_template_uses_required_nullable_semantics() -> None:
    """子表实体模板区分必填字段和可空字段。"""
    gen_table = _gen_table(gen_view=False, tpl_category='sub')
    gen_table.sub_table_name = 'gen_item_detail'
    gen_table.sub_table_fk_name = 'item_id'
    gen_table.sub_table = GenTableModel(
        table_name='gen_item_detail',
        table_comment='生成测试明细',
        class_name='GenItemDetail',
        columns=[
            GenTableColumnModel(
                column_name='required_value',
                column_comment='必填值',
                column_type='varchar(100)',
                python_type='str',
                python_field='requiredValue',
                is_required='1',
            ),
            GenTableColumnModel(
                column_name='optional_value',
                column_comment='可选值',
                column_type='varchar(100)',
                python_type='str',
                python_field='optionalValue',
                is_required='0',
            ),
            GenTableColumnModel(
                column_name='create_time',
                column_comment='创建时间',
                column_type='datetime',
                python_type='datetime',
                python_field='createTime',
                is_required='1',
            ),
            GenTableColumnModel(
                column_name='update_time',
                column_comment='更新时间',
                column_type='datetime',
                python_type='datetime',
                python_field='updateTime',
            ),
        ],
        business_name='itemDetail',
        function_name='生成测试明细',
    )
    assert gen_table.sub_table.columns
    gen_table.sub_table.pk_column = gen_table.sub_table.columns[0]

    context = TemplateUtils.prepare_context(gen_table)
    env = TemplateInitializer.init_jinja2()
    entity = env.get_template('python/do.py.jinja2').render(**context)
    dao = env.get_template('python/dao.py.jinja2').render(**context)

    assert "required_value: Mapped[str] = mapped_column(String(100), nullable=False, comment='必填值')" in entity
    assert "optional_value: Mapped[str | None] = mapped_column(String(100), nullable=True, comment='可选值')" in entity
    assert 'from common.mixin import AuditTimeMixin' in entity
    assert 'class GenItemDetail(AuditTimeMixin, Base):' in entity
    assert '__create_time_nullable__ = False' in entity
    assert 'create_time: Mapped[' not in entity
    assert 'update_time: Mapped[' not in entity
    assert "model_dump(exclude={'create_time', 'update_time'})" in dao
    assert "if key not in {'create_time', 'update_time'}" in dao
    compile(entity, '<generated-sub-entity>', 'exec')
    compile(dao, '<generated-sub-dao>', 'exec')


def test_named_data_source_bases_are_cached_and_isolated(monkeypatch: pytest.MonkeyPatch) -> None:
    """按名称分别缓存并隔离数据源基类。"""
    database.get_data_source_base.cache_clear()
    monkeypatch.setattr(type(database.DataBaseConfig), 'get_source', lambda _self, _name: object())

    reporting_base = database.get_data_source_base('reporting')
    archive_base = database.get_data_source_base('archive')

    assert reporting_base is database.get_data_source_base('reporting')
    assert reporting_base is not archive_base
    assert reporting_base.metadata is not archive_base.metadata


@pytest.mark.parametrize(
    ('db_type', 'column_type', 'expected'),
    [
        ('postgresql', 'JSONB', 'JSONB'),
        ('postgresql', 'INET', 'INET'),
        ('postgresql', 'ARRAY', 'ARRAY'),
        ('postgresql', 'VARCHAR(64)', 'String(64)'),
        ('mysql', 'DECIMAL(10, 2)', 'DECIMAL(10, 2)'),
        ('mysql', 'LONGBLOB', 'LargeBinary'),
    ],
)
def test_sqlalchemy_type_mapping_uses_target_source(
    monkeypatch: pytest.MonkeyPatch, db_type: str, column_type: str, expected: str
) -> None:
    """SQLAlchemy 类型映射使用目标数据源。"""
    monkeypatch.setattr(
        type(database.DataBaseConfig),
        'get_source',
        lambda _self, _name=None: SimpleNamespace(db_type=db_type),
    )

    assert TemplateUtils.get_sqlalchemy_type(column_type) == expected
