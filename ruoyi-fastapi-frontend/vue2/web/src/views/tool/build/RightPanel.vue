<template>
  <div class="right-board">
    <el-tabs
      v-model="currentTab"
      class="center-tabs"
    >
      <el-tab-pane
        :label="$t('tool:builder.componentProperties')"
        name="field"
      />
      <el-tab-pane
        :label="$t('tool:builder.formProperties')"
        name="form"
      />
    </el-tabs>
    <div class="field-box">
      <a
        class="document-link"
        target="_blank"
        :href="documentLink"
        :title="$t('tool:builder.viewComponentDocumentation')"
      >
        <i class="el-icon-link" />
      </a>
      <el-scrollbar class="right-scrollbar">
        <!-- 组件属性 -->
        <el-form
          v-show="currentTab === 'field' && showField"
          size="small"
          label-width="90px"
        >
          <el-form-item
            v-if="activeData.changeTag"
            :label="$t('tool:builder.componentType')"
          >
            <el-select
              v-model="activeData.tagIcon"
              :placeholder="$t('tool:builder.selectComponentType')"
              :style="{ width: '100%' }"
              @change="tagChange"
            >
              <el-option-group
                v-for="group in tagList"
                :key="group.label"
                :label="group.label"
              >
                <el-option
                  v-for="item in group.options"
                  :key="item.label"
                  :label="item.label"
                  :value="item.tagIcon"
                >
                  <svg-icon
                    class="node-icon"
                    :icon-class="item.tagIcon"
                  />
                  <span> {{ item.label }}</span>
                </el-option>
              </el-option-group>
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="activeData.vModel !== undefined"
            :label="$t('tool:builder.fieldName')"
          >
            <el-input
              v-model="activeData.vModel"
              :placeholder="$t('tool:builder.enterFieldNameVModel')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.componentName !== undefined"
            :label="$t('tool:builder.componentName')"
          >
            {{ activeData.componentName }}
          </el-form-item>
          <el-form-item
            v-if="activeData.label !== undefined"
            :label="$t('tool:builder.title')"
          >
            <el-input
              v-model="activeData.label"
              :placeholder="$t('tool:builder.enterTitle')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.placeholder !== undefined"
            :label="$t('tool:builder.placeholder')"
          >
            <el-input
              v-model="activeData.placeholder"
              :placeholder="$t('tool:builder.enterPlaceholder')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['start-placeholder'] !== undefined"
            :label="$t('tool:builder.startPlaceholder')"
          >
            <el-input
              v-model="activeData['start-placeholder']"
              :placeholder="$t('tool:builder.enterPlaceholder')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['end-placeholder'] !== undefined"
            :label="$t('tool:builder.endPlaceholder')"
          >
            <el-input
              v-model="activeData['end-placeholder']"
              :placeholder="$t('tool:builder.enterPlaceholder')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.span !== undefined"
            :label="$t('tool:builder.formGrid')"
          >
            <el-slider
              v-model="activeData.span"
              :max="24"
              :min="1"
              :marks="{ 12: '' }"
              @change="spanChange"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.layout === 'rowFormItem'"
            :label="$t('tool:builder.gridGap')"
          >
            <el-input-number
              v-model="activeData.gutter"
              :min="0"
              :placeholder="$t('tool:builder.gridGap')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.layout === 'rowFormItem'"
            :label="$t('tool:builder.layoutMode')"
          >
            <el-radio-group v-model="activeData.type">
              <el-radio-button label="default" />
              <el-radio-button label="flex" />
            </el-radio-group>
          </el-form-item>
          <el-form-item
            v-if="activeData.justify !== undefined && activeData.type === 'flex'"
            :label="$t('tool:builder.horizontalAlignment')"
          >
            <el-select
              v-model="activeData.justify"
              :placeholder="$t('tool:builder.selectHorizontalAlignment')"
              :style="{ width: '100%' }"
            >
              <el-option
                v-for="(item, index) in justifyOptions"
                :key="index"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="activeData.align !== undefined && activeData.type === 'flex'"
            :label="$t('tool:builder.verticalAlignment')"
          >
            <el-radio-group v-model="activeData.align">
              <el-radio-button label="top" />
              <el-radio-button label="middle" />
              <el-radio-button label="bottom" />
            </el-radio-group>
          </el-form-item>
          <el-form-item
            v-if="activeData.labelWidth !== undefined"
            :label="$t('tool:builder.labelWidth')"
          >
            <el-input
              v-model.number="activeData.labelWidth"
              type="number"
              :placeholder="$t('tool:builder.enterLabelWidth')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.style && activeData.style.width !== undefined"
            :label="$t('tool:builder.componentWidth')"
          >
            <el-input
              v-model="activeData.style.width"
              :placeholder="$t('tool:builder.enterComponentWidth')"
              clearable
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.vModel !== undefined"
            :label="$t('pluginAdmin:messages.defaultValue')"
          >
            <el-input
              :value="setDefaultValue(activeData.defaultValue)"
              :placeholder="$t('tool:builder.enterDefaultValue')"
              @input="onDefaultValueInput"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-checkbox-group'"
            :label="$t('tool:builder.minimumSelections')"
          >
            <el-input-number
              :value="activeData.min"
              :min="0"
              :placeholder="$t('tool:builder.minimumSelections')"
              @input="$set(activeData, 'min', $event ? $event : undefined)"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-checkbox-group'"
            :label="$t('tool:builder.maximumSelections')"
          >
            <el-input-number
              :value="activeData.max"
              :min="0"
              :placeholder="$t('tool:builder.maximumSelections')"
              @input="$set(activeData, 'max', $event ? $event : undefined)"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.prepend !== undefined"
            :label="$t('tool:builder.prefix')"
          >
            <el-input
              v-model="activeData.prepend"
              :placeholder="$t('tool:builder.enterPrefix')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.append !== undefined"
            :label="$t('tool:builder.suffix')"
          >
            <el-input
              v-model="activeData.append"
              :placeholder="$t('tool:builder.enterSuffix')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['prefix-icon'] !== undefined"
            :label="$t('tool:builder.prefixIcon')"
          >
            <el-input
              v-model="activeData['prefix-icon']"
              :placeholder="$t('tool:builder.enterPrefixIconName')"
            >
              <el-button
                slot="append"
                icon="el-icon-thumb"
                @click="openIconsDialog('prefix-icon')"
              >
                {{ $t('layout:search.select') }}
              </el-button>
            </el-input>
          </el-form-item>
          <el-form-item
            v-if="activeData['suffix-icon'] !== undefined"
            :label="$t('tool:builder.suffixIcon')"
          >
            <el-input
              v-model="activeData['suffix-icon']"
              :placeholder="$t('tool:builder.enterSuffixIconName')"
            >
              <el-button
                slot="append"
                icon="el-icon-thumb"
                @click="openIconsDialog('suffix-icon')"
              >
                {{ $t('layout:search.select') }}
              </el-button>
            </el-input>
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-cascader'"
            :label="$t('tool:builder.optionSeparator')"
          >
            <el-input
              v-model="activeData.separator"
              :placeholder="$t('tool:builder.enterOptionSeparator')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.autosize !== undefined"
            :label="$t('tool:builder.minimumRows')"
          >
            <el-input-number
              v-model="activeData.autosize.minRows"
              :min="1"
              :placeholder="$t('tool:builder.minimumRows')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.autosize !== undefined"
            :label="$t('tool:builder.maximumRows')"
          >
            <el-input-number
              v-model="activeData.autosize.maxRows"
              :min="1"
              :placeholder="$t('tool:builder.maximumRows')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.min !== undefined"
            :label="$t('tool:builder.minimumValue')"
          >
            <el-input-number
              v-model="activeData.min"
              :placeholder="$t('tool:builder.minimumValue')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.max !== undefined"
            :label="$t('tool:builder.maximumValue')"
          >
            <el-input-number
              v-model="activeData.max"
              :placeholder="$t('tool:builder.maximumValue')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.step !== undefined"
            :label="$t('tool:builder.stepSize')"
          >
            <el-input-number
              v-model="activeData.step"
              :placeholder="$t('tool:builder.steps')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-input-number'"
            :label="$t('tool:builder.precision')"
          >
            <el-input-number
              v-model="activeData.precision"
              :min="0"
              :placeholder="$t('tool:builder.precision')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-input-number'"
            :label="$t('tool:builder.buttonPosition')"
          >
            <el-radio-group v-model="activeData['controls-position']">
              <el-radio-button label=""> {{ $t('layout:size.default') }} </el-radio-button>
              <el-radio-button label="right"> {{ $t('tool:builder.right') }} </el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item
            v-if="activeData.maxlength !== undefined"
            :label="$t('tool:builder.maximumInputLength')"
          >
            <el-input
              v-model="activeData.maxlength"
              :placeholder="$t('tool:builder.enterCharacterLimit')"
            >
              <template slot="append"> {{ $t('tool:builder.characters') }} </template>
            </el-input>
          </el-form-item>
          <el-form-item
            v-if="activeData['active-text'] !== undefined"
            :label="$t('tool:builder.onLabel')"
          >
            <el-input
              v-model="activeData['active-text']"
              :placeholder="$t('tool:builder.enterOnLabel')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['inactive-text'] !== undefined"
            :label="$t('tool:builder.offLabel')"
          >
            <el-input
              v-model="activeData['inactive-text']"
              :placeholder="$t('tool:builder.enterOffLabel')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['active-value'] !== undefined"
            :label="$t('tool:builder.onValue')"
          >
            <el-input
              :value="setDefaultValue(activeData['active-value'])"
              :placeholder="$t('tool:builder.enterOnValue')"
              @input="onSwitchValueInput($event, 'active-value')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['inactive-value'] !== undefined"
            :label="$t('tool:builder.offValue')"
          >
            <el-input
              :value="setDefaultValue(activeData['inactive-value'])"
              :placeholder="$t('tool:builder.enterOffValue')"
              @input="onSwitchValueInput($event, 'inactive-value')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.type !== undefined && 'el-date-picker' === activeData.tag"
            :label="$t('tool:builder.timeType')"
          >
            <el-select
              v-model="activeData.type"
              :placeholder="$t('tool:builder.selectTimeType')"
              :style="{ width: '100%' }"
              @change="dateTypeChange"
            >
              <el-option
                v-for="(item, index) in dateOptions"
                :key="index"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="activeData.name !== undefined"
            :label="$t('tool:builder.fileFieldName')"
          >
            <el-input
              v-model="activeData.name"
              :placeholder="$t('tool:builder.enterUploadFieldName')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.accept !== undefined"
            :label="$t('tool:builder.fileType')"
          >
            <el-select
              v-model="activeData.accept"
              :placeholder="$t('tool:builder.selectFileType')"
              :style="{ width: '100%' }"
              clearable
            >
              <el-option
                :label="$t('tool:builder.image')"
                value="image/*"
              />
              <el-option
                :label="$t('tool:builder.video')"
                value="video/*"
              />
              <el-option
                :label="$t('tool:builder.audio')"
                value="audio/*"
              />
              <el-option
                label="excel"
                value=".xls,.xlsx"
              />
              <el-option
                label="word"
                value=".doc,.docx"
              />
              <el-option
                label="pdf"
                value=".pdf"
              />
              <el-option
                label="txt"
                value=".txt"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="activeData.fileSize !== undefined"
            :label="$t('file:messages.fileSize')"
          >
            <el-input
              v-model.number="activeData.fileSize"
              :placeholder="$t('tool:builder.enterFileSize')"
            >
              <el-select
                slot="append"
                v-model="activeData.sizeUnit"
                :style="{ width: '66px' }"
              >
                <el-option
                  label="KB"
                  value="KB"
                />
                <el-option
                  label="MB"
                  value="MB"
                />
                <el-option
                  label="GB"
                  value="GB"
                />
              </el-select>
            </el-input>
          </el-form-item>
          <el-form-item
            v-if="activeData.action !== undefined"
            :label="$t('tool:builder.uploadURL')"
          >
            <el-input
              v-model="activeData.action"
              :placeholder="$t('tool:builder.enterUploadURL')"
              clearable
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['list-type'] !== undefined"
            :label="$t('tool:builder.listType')"
          >
            <el-radio-group
              v-model="activeData['list-type']"
              size="small"
            >
              <el-radio-button label="text">{{
                $t('tool:builder.uploadList.text')
              }}</el-radio-button>
              <el-radio-button label="picture">{{
                $t('tool:builder.uploadList.picture')
              }}</el-radio-button>
              <el-radio-button label="picture-card">{{
                $t('tool:builder.uploadList.picture-card')
              }}</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item
            v-if="activeData.buttonText !== undefined"
            v-show="'picture-card' !== activeData['list-type']"
            :label="$t('tool:builder.buttonText')"
          >
            <el-input
              v-model="activeData.buttonText"
              :placeholder="$t('tool:builder.enterButtonText')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['range-separator'] !== undefined"
            :label="$t('tool:builder.separator')"
          >
            <el-input
              v-model="activeData['range-separator']"
              :placeholder="$t('tool:builder.enterSeparator')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['picker-options'] !== undefined"
            :label="$t('tool:builder.timeRange')"
          >
            <el-input
              v-model="activeData['picker-options'].selectableRange"
              :placeholder="$t('tool:builder.enterTimeRange')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.format !== undefined"
            :label="$t('tool:builder.timeFormat')"
          >
            <el-input
              :value="activeData.format"
              :placeholder="$t('tool:builder.enterTimeFormat')"
              @input="setTimeValue($event)"
            />
          </el-form-item>
          <template
            v-if="['el-checkbox-group', 'el-radio-group', 'el-select'].indexOf(activeData.tag) > -1"
          >
            <el-divider>{{ $t('tool:builder.options') }}</el-divider>
            <draggable
              :list="activeData.options"
              :animation="340"
              group="selectItem"
              handle=".option-drag"
            >
              <div
                v-for="(item, index) in activeData.options"
                :key="index"
                class="select-item"
              >
                <div class="select-line-icon option-drag">
                  <i class="el-icon-s-operation" />
                </div>
                <el-input
                  v-model="item.label"
                  :placeholder="$t('tool:builder.optionLabel')"
                  size="small"
                />
                <el-input
                  :placeholder="$t('tool:builder.optionValue')"
                  size="small"
                  :value="item.value"
                  @input="setOptionValue(item, $event)"
                />
                <div
                  class="close-btn select-line-icon"
                  @click="activeData.options.splice(index, 1)"
                >
                  <i class="el-icon-remove-outline" />
                </div>
              </div>
            </draggable>
            <div style="margin-left: 20px">
              <el-button
                style="padding-bottom: 0"
                icon="el-icon-circle-plus-outline"
                type="text"
                @click="addSelectItem"
              >
                {{ $t('tool:builder.addOption') }}
              </el-button>
            </div>
            <el-divider />
          </template>

          <template v-if="['el-cascader'].indexOf(activeData.tag) > -1">
            <el-divider>{{ $t('tool:builder.options') }}</el-divider>
            <el-form-item :label="$t('tool:builder.dataType')">
              <el-radio-group
                v-model="activeData.dataType"
                size="small"
              >
                <el-radio-button label="dynamic">
                  {{ $t('tool:builder.dynamicData') }}
                </el-radio-button>
                <el-radio-button label="static">
                  {{ $t('tool:builder.staticData') }}
                </el-radio-button>
              </el-radio-group>
            </el-form-item>

            <template v-if="activeData.dataType === 'dynamic'">
              <el-form-item :label="$t('tool:builder.labelKey')">
                <el-input
                  v-model="activeData.labelKey"
                  :placeholder="$t('tool:builder.enterLabelKey')"
                />
              </el-form-item>
              <el-form-item :label="$t('tool:builder.valueKey')">
                <el-input
                  v-model="activeData.valueKey"
                  :placeholder="$t('tool:builder.enterValueKey')"
                />
              </el-form-item>
              <el-form-item :label="$t('tool:builder.childrenKey')">
                <el-input
                  v-model="activeData.childrenKey"
                  :placeholder="$t('tool:builder.enterChildrenKey')"
                />
              </el-form-item>
            </template>

            <el-tree
              v-if="activeData.dataType === 'static'"
              draggable
              :data="activeData.options"
              node-key="id"
              :expand-on-click-node="false"
              :render-content="renderContent"
            />
            <div
              v-if="activeData.dataType === 'static'"
              style="margin-left: 20px"
            >
              <el-button
                style="padding-bottom: 0"
                icon="el-icon-circle-plus-outline"
                type="text"
                @click="addTreeItem"
              >
                {{ $t('tool:builder.addParent') }}
              </el-button>
            </div>
            <el-divider />
          </template>

          <el-form-item
            v-if="activeData.optionType !== undefined"
            :label="$t('tool:builder.optionStyle')"
          >
            <el-radio-group v-model="activeData.optionType">
              <el-radio-button label="default"> {{ $t('layout:size.default') }} </el-radio-button>
              <el-radio-button label="button"> {{ $t('system:menu.button') }} </el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item
            v-if="activeData['active-color'] !== undefined"
            :label="$t('tool:builder.onColor')"
          >
            <el-color-picker v-model="activeData['active-color']" />
          </el-form-item>
          <el-form-item
            v-if="activeData['inactive-color'] !== undefined"
            :label="$t('tool:builder.offColor')"
          >
            <el-color-picker v-model="activeData['inactive-color']" />
          </el-form-item>

          <el-form-item
            v-if="activeData['allow-half'] !== undefined"
            :label="$t('tool:builder.allowHalfSelection')"
          >
            <el-switch v-model="activeData['allow-half']" />
          </el-form-item>
          <el-form-item
            v-if="activeData['show-text'] !== undefined"
            :label="$t('tool:builder.helperText')"
          >
            <el-switch
              v-model="activeData['show-text']"
              @change="rateTextChange"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['show-score'] !== undefined"
            :label="$t('tool:builder.showScore')"
          >
            <el-switch
              v-model="activeData['show-score']"
              @change="rateScoreChange"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['show-stops'] !== undefined"
            :label="$t('tool:builder.showStepMarkers')"
          >
            <el-switch v-model="activeData['show-stops']" />
          </el-form-item>
          <el-form-item
            v-if="activeData.range !== undefined"
            :label="$t('tool:builder.rangeSelection')"
          >
            <el-switch
              v-model="activeData.range"
              @change="rangeChange"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.border !== undefined && activeData.optionType === 'default'"
            :label="$t('tool:builder.showBorder')"
          >
            <el-switch v-model="activeData.border" />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-color-picker'"
            :label="$t('tool:builder.colorFormat')"
          >
            <el-select
              v-model="activeData['color-format']"
              :placeholder="$t('tool:builder.selectColorFormat')"
              :style="{ width: '100%' }"
              @change="colorFormatChange"
            >
              <el-option
                v-for="(item, index) in colorFormatOptions"
                :key="index"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="
              activeData.size !== undefined &&
              (activeData.optionType === 'button' ||
                activeData.border ||
                activeData.tag === 'el-color-picker')
            "
            :label="$t('tool:builder.optionSize')"
          >
            <el-radio-group v-model="activeData.size">
              <el-radio-button label="medium"> {{ $t('tool:builder.medium') }} </el-radio-button>
              <el-radio-button label="small"> {{ $t('tool:builder.small') }} </el-radio-button>
              <el-radio-button label="mini"> {{ $t('tool:builder.mini') }} </el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item
            v-if="activeData['show-word-limit'] !== undefined"
            :label="$t('tool:builder.characterCount')"
          >
            <el-switch v-model="activeData['show-word-limit']" />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-input-number'"
            :label="$t('tool:builder.strictStepSize')"
          >
            <el-switch v-model="activeData['step-strictly']" />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-cascader'"
            :label="$t('tool:builder.multipleSelection')"
          >
            <el-switch v-model="activeData.props.props.multiple" />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-cascader'"
            :label="$t('tool:builder.showFullPath')"
          >
            <el-switch v-model="activeData['show-all-levels']" />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-cascader'"
            :label="$t('tool:builder.filterable')"
          >
            <el-switch v-model="activeData.filterable" />
          </el-form-item>
          <el-form-item
            v-if="activeData.clearable !== undefined"
            :label="$t('tool:builder.clearable')"
          >
            <el-switch v-model="activeData.clearable" />
          </el-form-item>
          <el-form-item
            v-if="activeData.showTip !== undefined"
            :label="$t('tool:builder.showTooltip')"
          >
            <el-switch v-model="activeData.showTip" />
          </el-form-item>
          <el-form-item
            v-if="activeData.multiple !== undefined"
            :label="$t('tool:builder.multipleFiles')"
          >
            <el-switch v-model="activeData.multiple" />
          </el-form-item>
          <el-form-item
            v-if="activeData['auto-upload'] !== undefined"
            :label="$t('tool:builder.autoUpload')"
          >
            <el-switch v-model="activeData['auto-upload']" />
          </el-form-item>
          <el-form-item
            v-if="activeData.readonly !== undefined"
            :label="$t('tool:builder.readOnly')"
          >
            <el-switch v-model="activeData.readonly" />
          </el-form-item>
          <el-form-item
            v-if="activeData.disabled !== undefined"
            :label="$t('tool:builder.disabled')"
          >
            <el-switch v-model="activeData.disabled" />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-select'"
            :label="$t('tool:builder.searchable')"
          >
            <el-switch v-model="activeData.filterable" />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-select'"
            :label="$t('tool:builder.multipleSelection')"
          >
            <el-switch
              v-model="activeData.multiple"
              @change="multipleChange"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.required !== undefined"
            :label="$t('tool:builder.required')"
          >
            <el-switch v-model="activeData.required" />
          </el-form-item>

          <template v-if="activeData.layoutTree">
            <el-divider>{{ $t('tool:builder.layoutTree') }}</el-divider>
            <el-tree
              :data="[activeData]"
              :props="layoutTreeProps"
              node-key="renderKey"
              default-expand-all
              draggable
            >
              <span slot-scope="{ node, data }">
                <span class="node-label">
                  <svg-icon
                    class="node-icon"
                    :icon-class="data.tagIcon"
                  />
                  {{ node.label }}
                </span>
              </span>
            </el-tree>
          </template>

          <template v-if="activeData.layout === 'colFormItem' && activeData.tag !== 'el-button'">
            <el-divider>{{ $t('tool:builder.regularExpressionValidation') }}</el-divider>
            <div
              v-for="(item, index) in activeData.regList"
              :key="index"
              class="reg-item"
            >
              <span
                class="close-btn"
                @click="activeData.regList.splice(index, 1)"
              >
                <i class="el-icon-close" />
              </span>
              <el-form-item :label="$t('tool:builder.expression')">
                <el-input
                  v-model="item.pattern"
                  :placeholder="$t('tool:builder.enterRegularExpression')"
                />
              </el-form-item>
              <el-form-item
                :label="$t('tool:builder.errorMessage')"
                style="margin-bottom: 0"
              >
                <el-input
                  v-model="item.message"
                  :placeholder="$t('tool:builder.enterErrorMessage')"
                />
              </el-form-item>
            </div>
            <div style="margin-left: 20px">
              <el-button
                icon="el-icon-circle-plus-outline"
                type="text"
                @click="addReg"
              >
                {{ $t('tool:builder.addRule') }}
              </el-button>
            </div>
          </template>
        </el-form>
        <!-- 表单属性 -->
        <el-form
          v-show="currentTab === 'form'"
          size="small"
          label-width="90px"
        >
          <el-form-item :label="$t('tool:builder.formName')">
            <el-input
              v-model="formConf.formRef"
              :placeholder="$t('tool:builder.enterFormNameRef')"
            />
          </el-form-item>
          <el-form-item :label="$t('tool:builder.formModel')">
            <el-input
              v-model="formConf.formModel"
              :placeholder="$t('tool:builder.enterDataModel')"
            />
          </el-form-item>
          <el-form-item :label="$t('tool:builder.validationModel')">
            <el-input
              v-model="formConf.formRules"
              :placeholder="$t('tool:builder.enterValidationModel')"
            />
          </el-form-item>
          <el-form-item :label="$t('tool:builder.formSize')">
            <el-radio-group v-model="formConf.size">
              <el-radio-button label="medium"> {{ $t('tool:builder.medium') }} </el-radio-button>
              <el-radio-button label="small"> {{ $t('tool:builder.small') }} </el-radio-button>
              <el-radio-button label="mini"> {{ $t('tool:builder.mini') }} </el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item :label="$t('tool:builder.labelAlignment')">
            <el-radio-group v-model="formConf.labelPosition">
              <el-radio-button label="left"> {{ $t('tool:builder.leftAligned') }} </el-radio-button>
              <el-radio-button label="right">
                {{ $t('tool:builder.rightAligned') }}
              </el-radio-button>
              <el-radio-button label="top"> {{ $t('tool:builder.topAligned') }} </el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item :label="$t('tool:builder.labelWidth')">
            <el-input-number
              v-model="formConf.labelWidth"
              :placeholder="$t('tool:builder.labelWidth')"
            />
          </el-form-item>
          <el-form-item :label="$t('tool:builder.gridGap')">
            <el-input-number
              v-model="formConf.gutter"
              :min="0"
              :placeholder="$t('tool:builder.gridGap')"
            />
          </el-form-item>
          <el-form-item :label="$t('tool:builder.disableForm')">
            <el-switch v-model="formConf.disabled" />
          </el-form-item>
          <el-form-item :label="$t('tool:builder.formButtons')">
            <el-switch v-model="formConf.formBtns" />
          </el-form-item>
          <el-form-item :label="$t('tool:builder.showBordersOfUnselectedComponents')">
            <el-switch v-model="formConf.unFocusedComponentBorder" />
          </el-form-item>
        </el-form>
      </el-scrollbar>
    </div>

    <treeNode-dialog
      :visible.sync="dialogVisible"
      :title="$t('tool:builder.addOption')"
      @commit="addNode"
    />
    <icons-dialog
      :visible.sync="iconsVisible"
      :current="activeData[currentIconModel]"
      @select="setIcon"
    />
  </div>
</template>

<script>
import draggable from 'vuedraggable'
import { t } from '@/i18n/adapter'
import TreeNodeDialog from './TreeNodeDialog'
import { isNumberStr } from '@/utils/index'
import IconsDialog from './IconsDialog'
import { inputComponents, selectComponents, layoutComponents } from '@/utils/generator/config'

const dateTimeFormat = {
  date: 'yyyy-MM-dd',
  get week() {
    return t('tool:builder.weekFormat')
  },
  month: 'yyyy-MM',
  year: 'yyyy',
  datetime: 'yyyy-MM-dd HH:mm:ss',
  daterange: 'yyyy-MM-dd',
  monthrange: 'yyyy-MM',
  datetimerange: 'yyyy-MM-dd HH:mm:ss',
}

export default {
  components: {
    draggable,
    TreeNodeDialog,
    IconsDialog,
  },
  props: ['showField', 'activeData', 'formConf'],
  data() {
    return {
      currentTab: 'field',
      currentNode: null,
      dialogVisible: false,
      iconsVisible: false,
      currentIconModel: null,
      dateTypeOptions: [
        {
          get label() {
            return t('tool:builder.types.date')
          },
          value: 'date',
        },
        {
          get label() {
            return t('tool:builder.types.week')
          },
          value: 'week',
        },
        {
          get label() {
            return t('tool:builder.types.month')
          },
          value: 'month',
        },
        {
          get label() {
            return t('tool:builder.types.year')
          },
          value: 'year',
        },
        {
          get label() {
            return t('tool:builder.types.datetime')
          },
          value: 'datetime',
        },
      ],
      dateRangeTypeOptions: [
        {
          get label() {
            return t('tool:builder.types.daterange')
          },
          value: 'daterange',
        },
        {
          get label() {
            return t('tool:builder.types.monthrange')
          },
          value: 'monthrange',
        },
        {
          get label() {
            return t('tool:builder.types.datetimerange')
          },
          value: 'datetimerange',
        },
      ],
      colorFormatOptions: [
        {
          label: 'hex',
          value: 'hex',
        },
        {
          label: 'rgb',
          value: 'rgb',
        },
        {
          label: 'rgba',
          value: 'rgba',
        },
        {
          label: 'hsv',
          value: 'hsv',
        },
        {
          label: 'hsl',
          value: 'hsl',
        },
      ],
      justifyOptions: [
        {
          label: 'start',
          value: 'start',
        },
        {
          label: 'end',
          value: 'end',
        },
        {
          label: 'center',
          value: 'center',
        },
        {
          label: 'space-around',
          value: 'space-around',
        },
        {
          label: 'space-between',
          value: 'space-between',
        },
      ],
      layoutTreeProps: {
        label(data, node) {
          return data.componentName || `${data.label}: ${data.vModel}`
        },
      },
    }
  },
  computed: {
    documentLink() {
      return this.activeData.document || 'https://element.eleme.cn/#/zh-CN/component/installation'
    },
    dateOptions() {
      if (this.activeData.type !== undefined && this.activeData.tag === 'el-date-picker') {
        if (this.activeData['start-placeholder'] === undefined) {
          return this.dateTypeOptions
        }
        return this.dateRangeTypeOptions
      }
      return []
    },
    tagList() {
      return [
        {
          get label() {
            return t('tool:builder.types.input')
          },
          options: inputComponents,
        },
        {
          get label() {
            return t('tool:builder.types.select')
          },
          options: selectComponents,
        },
      ]
    },
  },
  methods: {
    addReg() {
      this.activeData.regList.push({
        pattern: '',
        message: '',
      })
    },
    addSelectItem() {
      this.activeData.options.push({
        label: '',
        value: '',
      })
    },
    addTreeItem() {
      ++this.idGlobal
      this.dialogVisible = true
      this.currentNode = this.activeData.options
    },
    renderContent(h, { node, data, store }) {
      return (
        <div class="custom-tree-node">
          <span>{node.label}</span>
          <span class="node-operation">
            <i
              on-click={() => this.append(data)}
              class="el-icon-plus"
              title={t('common:action.add')}
            ></i>
            <i
              on-click={() => this.remove(node, data)}
              class="el-icon-delete"
              title={t('common:action.delete')}
            ></i>
          </span>
        </div>
      )
    },
    append(data) {
      if (!data.children) {
        this.$set(data, 'children', [])
      }
      this.dialogVisible = true
      this.currentNode = data.children
    },
    remove(node, data) {
      const { parent } = node
      const children = parent.data.children || parent.data
      const index = children.findIndex((d) => d.id === data.id)
      children.splice(index, 1)
    },
    addNode(data) {
      this.currentNode.push(data)
    },
    setOptionValue(item, val) {
      item.value = isNumberStr(val) ? +val : val
    },
    setDefaultValue(val) {
      if (Array.isArray(val)) {
        return val.join(',')
      }
      if (['string', 'number'].indexOf(val) > -1) {
        return val
      }
      if (typeof val === 'boolean') {
        return `${val}`
      }
      return val
    },
    onDefaultValueInput(str) {
      if (Array.isArray(this.activeData.defaultValue)) {
        // 数组
        this.$set(
          this.activeData,
          'defaultValue',
          str.split(',').map((val) => (isNumberStr(val) ? +val : val))
        )
      } else if (['true', 'false'].indexOf(str) > -1) {
        // 布尔
        this.$set(this.activeData, 'defaultValue', JSON.parse(str))
      } else {
        // 字符串和数字
        this.$set(this.activeData, 'defaultValue', isNumberStr(str) ? +str : str)
      }
    },
    onSwitchValueInput(val, name) {
      if (['true', 'false'].indexOf(val) > -1) {
        this.$set(this.activeData, name, JSON.parse(val))
      } else {
        this.$set(this.activeData, name, isNumberStr(val) ? +val : val)
      }
    },
    setTimeValue(val, type) {
      const valueFormat = type === 'week' ? dateTimeFormat.date : val
      this.$set(this.activeData, 'defaultValue', null)
      this.$set(this.activeData, 'value-format', valueFormat)
      this.$set(this.activeData, 'format', val)
    },
    spanChange(val) {
      this.formConf.span = val
    },
    multipleChange(val) {
      this.$set(this.activeData, 'defaultValue', val ? [] : '')
    },
    dateTypeChange(val) {
      this.setTimeValue(dateTimeFormat[val], val)
    },
    rangeChange(val) {
      this.$set(
        this.activeData,
        'defaultValue',
        val ? [this.activeData.min, this.activeData.max] : this.activeData.min
      )
    },
    rateTextChange(val) {
      if (val) this.activeData['show-score'] = false
    },
    rateScoreChange(val) {
      if (val) this.activeData['show-text'] = false
    },
    colorFormatChange(val) {
      this.activeData.defaultValue = null
      this.activeData['show-alpha'] = val.indexOf('a') > -1
      this.activeData.renderKey = +new Date() // 更新renderKey,重新渲染该组件
    },
    openIconsDialog(model) {
      this.iconsVisible = true
      this.currentIconModel = model
    },
    setIcon(val) {
      this.activeData[this.currentIconModel] = val
    },
    tagChange(tagIcon) {
      let target = inputComponents.find((item) => item.tagIcon === tagIcon)
      if (!target) target = selectComponents.find((item) => item.tagIcon === tagIcon)
      this.$emit('tag-change', target)
    },
  },
}
</script>

<style lang="scss" scoped>
.right-board {
  width: 350px;
  position: absolute;
  right: 0;
  top: 0;
  padding-top: 3px;
  .field-box {
    position: relative;
    height: calc(100vh - 42px);
    box-sizing: border-box;
    overflow: hidden;
  }
  .el-scrollbar {
    height: 100%;
  }
}
.select-item {
  display: flex;
  border: 1px dashed #fff;
  box-sizing: border-box;
  & .close-btn {
    cursor: pointer;
    color: #f56c6c;
  }
  & .el-input + .el-input {
    margin-left: 4px;
  }
}
.select-item + .select-item {
  margin-top: 4px;
}
.select-item.sortable-chosen {
  border: 1px dashed #409eff;
}
.select-line-icon {
  line-height: 32px;
  font-size: 22px;
  padding: 0 4px;
  color: #777;
}
.option-drag {
  cursor: move;
}
.time-range {
  .el-date-editor {
    width: 227px;
  }
  ::v-deep .el-icon-time {
    display: none;
  }
}
.document-link {
  position: absolute;
  display: block;
  width: 26px;
  height: 26px;
  top: 0;
  left: 0;
  cursor: pointer;
  background: #409eff;
  z-index: 1;
  border-radius: 0 0 6px 0;
  text-align: center;
  line-height: 26px;
  color: #fff;
  font-size: 18px;
}
.node-label {
  font-size: 14px;
}
.node-icon {
  color: #bebfc3;
}
</style>
