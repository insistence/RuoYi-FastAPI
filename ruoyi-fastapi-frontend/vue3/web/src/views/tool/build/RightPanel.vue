<template>
  <div class="right-board">
    <el-tabs
      v-model="currentTab"
      stretch
      class="center-tabs"
    >
      <el-tab-pane
        :label="$t('tools:componentProperties')"
        name="field"
      />
      <el-tab-pane
        :label="$t('tools:formProperties')"
        name="form"
      />
    </el-tabs>
    <div class="field-box">
      <a
        class="document-link"
        target="_blank"
        :href="documentLink"
        :title="$t('tools:viewComponentDocumentation')"
      >
        <el-icon>
          <Link />
        </el-icon>
      </a>
      <el-scrollbar class="right-scrollbar">
        <!-- 组件属性 -->
        <el-form
          v-show="currentTab === 'field' && showField"
          size="default"
          label-width="90px"
          label-position="top"
          style=""
        >
          <el-form-item
            v-if="activeData.changeTag"
            :label="$t('tools:componentType')"
          >
            <el-select
              v-model="activeData.tagIcon"
              :placeholder="$t('tools:selectComponentType')"
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
                    style="margin-right: 10px"
                  />
                  <span> {{ item.label }}</span>
                </el-option>
              </el-option-group>
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="activeData.vModel !== undefined"
            :label="$t('tools:fieldName')"
          >
            <el-input
              v-model="activeData.vModel"
              :placeholder="$t('tools:enterFieldNameVModel')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.componentName !== undefined"
            :label="$t('tools:componentName')"
          >
            {{ activeData.componentName }}
          </el-form-item>
          <el-form-item
            v-if="activeData.label !== undefined"
            :label="$t('tools:title')"
          >
            <el-input
              v-model="activeData.label"
              :placeholder="$t('tools:enterTitle')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.placeholder !== undefined"
            :label="$t('tools:placeholder')"
          >
            <el-input
              v-model="activeData.placeholder"
              :placeholder="$t('tools:enterPlaceholder')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['start-placeholder'] !== undefined"
            :label="$t('tools:startPlaceholder')"
          >
            <el-input
              v-model="activeData['start-placeholder']"
              :placeholder="$t('tools:enterPlaceholder')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['end-placeholder'] !== undefined"
            :label="$t('tools:endPlaceholder')"
          >
            <el-input
              v-model="activeData['end-placeholder']"
              :placeholder="$t('tools:enterPlaceholder')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.span !== undefined"
            :label="$t('tools:formGrid')"
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
            :label="$t('tools:gridGap')"
          >
            <el-input-number
              v-model="activeData.gutter"
              :min="0"
              :placeholder="$t('tools:gridGap')"
            />
          </el-form-item>

          <el-form-item
            v-if="activeData.justify !== undefined"
            :label="$t('tools:horizontalAlignment')"
          >
            <el-select
              v-model="activeData.justify"
              :placeholder="$t('tools:selectHorizontalAlignment')"
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
            v-if="activeData.align !== undefined"
            :label="$t('tools:verticalAlignment')"
          >
            <el-radio-group v-model="activeData.align">
              <el-radio-button label="top" />
              <el-radio-button label="middle" />
              <el-radio-button label="bottom" />
            </el-radio-group>
          </el-form-item>
          <el-form-item
            v-if="activeData.labelWidth !== undefined"
            :label="$t('tools:labelWidth')"
          >
            <el-input
              v-model.number="activeData.labelWidth"
              type="number"
              :placeholder="$t('tools:enterLabelWidth')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.style && activeData.style.width !== undefined"
            :label="$t('tools:componentWidth')"
          >
            <el-input
              v-model="activeData.style.width"
              :placeholder="$t('tools:enterComponentWidth')"
              clearable
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.vModel !== undefined"
            :label="$t('tools:defaultValue')"
          >
            <el-input
              :value="setDefaultValue(activeData.defaultValue)"
              :placeholder="$t('tools:enterDefaultValue')"
              @input="onDefaultValueInput"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-checkbox-group'"
            :label="$t('tools:minimumSelections')"
          >
            <el-input-number
              :value="activeData.min"
              :min="0"
              :placeholder="$t('tools:minimumSelections')"
              @input="$set(activeData, 'min', $event ? $event : undefined)"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-checkbox-group'"
            :label="$t('tools:maximumSelections')"
          >
            <el-input-number
              :value="activeData.max"
              :min="0"
              :placeholder="$t('tools:maximumSelections')"
              @input="$set(activeData, 'max', $event ? $event : undefined)"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.prepend !== undefined"
            :label="$t('tools:prefix')"
          >
            <el-input
              v-model="activeData.prepend"
              :placeholder="$t('tools:enterPrefix')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.append !== undefined"
            :label="$t('tools:suffix')"
          >
            <el-input
              v-model="activeData.append"
              :placeholder="$t('tools:enterSuffix')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['prefix-icon'] !== undefined"
            :label="$t('tools:prefixIcon')"
          >
            <el-input
              v-model="activeData['prefix-icon']"
              :placeholder="$t('tools:enterPrefixIconName')"
            >
              <template #append>
                <el-button
                  icon="Pointer"
                  @click="openIconsDialog('prefix-icon')"
                  >{{ $t('layout:search.select') }}</el-button
                >
              </template>
            </el-input>
          </el-form-item>
          <el-form-item
            v-if="activeData['suffix-icon'] !== undefined"
            :label="$t('tools:suffixIcon')"
          >
            <el-input
              v-model="activeData['suffix-icon']"
              :placeholder="$t('tools:enterSuffixIconName')"
            >
              <template #append>
                <el-button
                  icon="Pointer"
                  @click="openIconsDialog('suffix-icon')"
                  >{{ $t('layout:search.select') }}</el-button
                >
              </template>
            </el-input>
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-cascader'"
            :label="$t('tools:optionSeparator')"
          >
            <el-input
              v-model="activeData.separator"
              :placeholder="$t('tools:enterOptionSeparator')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.autosize !== undefined"
            :label="$t('tools:minimumRows')"
          >
            <el-input-number
              v-model="activeData.autosize.minRows"
              :min="1"
              :placeholder="$t('tools:minimumRows')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.autosize !== undefined"
            :label="$t('tools:maximumRows')"
          >
            <el-input-number
              v-model="activeData.autosize.maxRows"
              :min="1"
              :placeholder="$t('tools:maximumRows')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.min !== undefined"
            :label="$t('tools:minimumValue')"
          >
            <el-input-number
              v-model="activeData.min"
              :placeholder="$t('tools:minimumValue')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.max !== undefined"
            :label="$t('tools:maximumValue')"
          >
            <el-input-number
              v-model="activeData.max"
              :placeholder="$t('tools:maximumValue')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.step !== undefined"
            :label="$t('tools:stepSize')"
          >
            <el-input-number
              v-model="activeData.step"
              :placeholder="$t('tools:steps')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-input-number'"
            :label="$t('tools:precision')"
          >
            <el-input-number
              v-model="activeData.precision"
              :min="0"
              :placeholder="$t('tools:precision')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-input-number'"
            :label="$t('tools:buttonPosition')"
          >
            <el-radio-group v-model="activeData['controls-position']">
              <el-radio-button label="">{{ $t('layout:size.default') }}</el-radio-button>
              <el-radio-button label="right">{{ $t('tools:right') }}</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item
            v-if="activeData.maxlength !== undefined"
            :label="$t('tools:maximumInputLength')"
          >
            <el-input
              v-model="activeData.maxlength"
              :placeholder="$t('tools:enterCharacterLimit')"
            >
              <template slot="append">{{ $t('tools:characters') }}</template>
            </el-input>
          </el-form-item>
          <el-form-item
            v-if="activeData['active-text'] !== undefined"
            :label="$t('tools:onLabel')"
          >
            <el-input
              v-model="activeData['active-text']"
              :placeholder="$t('tools:enterOnLabel')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['inactive-text'] !== undefined"
            :label="$t('tools:offLabel')"
          >
            <el-input
              v-model="activeData['inactive-text']"
              :placeholder="$t('tools:enterOffLabel')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['active-value'] !== undefined"
            :label="$t('tools:onValue')"
          >
            <el-input
              :value="setDefaultValue(activeData['active-value'])"
              :placeholder="$t('tools:enterOnValue')"
              @input="onSwitchValueInput($event, 'active-value')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['inactive-value'] !== undefined"
            :label="$t('tools:offValue')"
          >
            <el-input
              :value="setDefaultValue(activeData['inactive-value'])"
              :placeholder="$t('tools:enterOffValue')"
              @input="onSwitchValueInput($event, 'inactive-value')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.type !== undefined && 'el-date-picker' === activeData.tag"
            :label="$t('tools:timeType')"
          >
            <el-select
              v-model="activeData.type"
              :placeholder="$t('tools:selectTimeType')"
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
            :label="$t('tools:fileFieldName')"
          >
            <el-input
              v-model="activeData.name"
              :placeholder="$t('tools:enterUploadFieldName')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.accept !== undefined"
            :label="$t('tools:fileType')"
          >
            <el-select
              v-model="activeData.accept"
              :placeholder="$t('tools:selectFileType')"
              :style="{ width: '100%' }"
              clearable
            >
              <el-option
                :label="$t('tools:image')"
                value="image/*"
              />
              <el-option
                :label="$t('tools:video')"
                value="video/*"
              />
              <el-option
                :label="$t('tools:audio')"
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
            :label="$t('tools:fileSize')"
          >
            <el-input
              v-model.number="activeData.fileSize"
              :placeholder="$t('tools:enterFileSize')"
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
            :label="$t('tools:uploadURL')"
          >
            <el-input
              v-model="activeData.action"
              :placeholder="$t('tools:enterUploadURL')"
              clearable
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['list-type'] !== undefined"
            :label="$t('tools:listType')"
          >
            <el-radio-group
              v-model="activeData['list-type']"
              size="small"
            >
              <el-radio-button label="text"> text </el-radio-button>
              <el-radio-button label="picture"> picture </el-radio-button>
              <el-radio-button label="picture-card"> picture-card </el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item
            v-if="activeData.buttonText !== undefined"
            v-show="'picture-card' !== activeData['list-type']"
            :label="$t('tools:buttonText')"
          >
            <el-input
              v-model="activeData.buttonText"
              :placeholder="$t('tools:enterButtonText')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['range-separator'] !== undefined"
            :label="$t('tools:separator')"
          >
            <el-input
              v-model="activeData['range-separator']"
              :placeholder="$t('tools:enterSeparator')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['picker-options'] !== undefined"
            :label="$t('tools:timeRange')"
          >
            <el-input
              v-model="activeData['picker-options'].selectableRange"
              :placeholder="$t('tools:enterTimeRange')"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.format !== undefined"
            :label="$t('tools:timeFormat')"
          >
            <el-input
              :value="activeData.format"
              :placeholder="$t('tools:enterTimeFormat')"
              @input="setTimeValue($event)"
            />
          </el-form-item>
          <template
            v-if="['el-checkbox-group', 'el-radio-group', 'el-select'].indexOf(activeData.tag) > -1"
          >
            <el-divider>{{ $t('tools:options') }}</el-divider>
            <draggable
              :list="activeData.options"
              :animation="340"
              group="selectItem"
              handle=".option-drag"
              item-key="label"
            >
              <template #item="{ element, index }">
                <div
                  :key="index"
                  class="select-item"
                >
                  <div class="select-line-icon option-drag">
                    <i class="el-icon-s-operation" />
                  </div>
                  <el-input
                    v-model="element.label"
                    :placeholder="$t('tools:optionLabel')"
                    size="small"
                  />
                  <el-input
                    :placeholder="$t('tools:optionValue')"
                    size="small"
                    :value="element.value"
                    @input="setOptionValue(element, $event)"
                  />
                  <div
                    class="close-btn select-line-icon"
                    @click="activeData.options.splice(index, 1)"
                  >
                    <el-icon>
                      <Remove />
                    </el-icon>
                  </div>
                </div>
              </template>
            </draggable>
            <div>
              <el-button
                icon="CirclePlus"
                style="margin-left: 8px; margin-top: 10px"
                text
                bg
                type="primary"
                @click="addSelectItem"
                >{{ $t('tools:addOption') }}</el-button
              >
            </div>
            <el-divider />
          </template>

          <template v-if="['el-cascader'].indexOf(activeData.tag) > -1">
            <el-divider>{{ $t('tools:options') }}</el-divider>
            <el-form-item :label="$t('tools:dataType')">
              <el-radio-group
                v-model="activeData.dataType"
                size="small"
              >
                <el-radio-button label="dynamic">{{ $t('tools:dynamicData') }}</el-radio-button>
                <el-radio-button label="static">{{ $t('tools:staticData') }}</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <template v-if="activeData.dataType === 'dynamic'">
              <el-form-item :label="$t('tools:labelKey')">
                <el-input
                  v-model="activeData.labelKey"
                  :placeholder="$t('tools:enterLabelKey')"
                />
              </el-form-item>
              <el-form-item :label="$t('tools:valueKey')">
                <el-input
                  v-model="activeData.valueKey"
                  :placeholder="$t('tools:enterValueKey')"
                />
              </el-form-item>
              <el-form-item :label="$t('tools:childrenKey')">
                <el-input
                  v-model="activeData.childrenKey"
                  :placeholder="$t('tools:enterChildrenKey')"
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
            <div v-if="activeData.dataType === 'static'">
              <el-button
                icon="CirclePlus"
                style="margin-left: 0; margin-top: 10px"
                type="primary"
                text
                bg
                @click="addTreeItem"
                >{{ $t('tools:addParent') }}</el-button
              >
            </div>
            <el-divider />
          </template>

          <el-form-item
            v-if="activeData.optionType !== undefined"
            :label="$t('tools:optionStyle')"
          >
            <el-radio-group v-model="activeData.optionType">
              <el-radio-button label="default">{{ $t('layout:size.default') }}</el-radio-button>
              <el-radio-button label="button">{{ $t('system:button') }}</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item
            v-if="activeData['active-color'] !== undefined"
            :label="$t('tools:onColor')"
          >
            <el-color-picker v-model="activeData['active-color']" />
          </el-form-item>
          <el-form-item
            v-if="activeData['inactive-color'] !== undefined"
            :label="$t('tools:offColor')"
          >
            <el-color-picker v-model="activeData['inactive-color']" />
          </el-form-item>

          <el-form-item
            v-if="activeData['allow-half'] !== undefined"
            :label="$t('tools:allowHalfSelection')"
          >
            <el-switch v-model="activeData['allow-half']" />
          </el-form-item>
          <el-form-item
            v-if="activeData['show-text'] !== undefined"
            :label="$t('tools:helperText')"
          >
            <el-switch
              v-model="activeData['show-text']"
              @change="rateTextChange"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['show-score'] !== undefined"
            :label="$t('tools:showScore')"
          >
            <el-switch
              v-model="activeData['show-score']"
              @change="rateScoreChange"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData['show-stops'] !== undefined"
            :label="$t('tools:showStepMarkers')"
          >
            <el-switch v-model="activeData['show-stops']" />
          </el-form-item>
          <el-form-item
            v-if="activeData.range !== undefined"
            :label="$t('tools:rangeSelection')"
          >
            <el-switch
              v-model="activeData.range"
              @change="rangeChange"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.border !== undefined && activeData.optionType === 'default'"
            :label="$t('tools:showBorder')"
          >
            <el-switch v-model="activeData.border" />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-color-picker'"
            :label="$t('tools:colorFormat')"
          >
            <el-select
              v-model="activeData['color-format']"
              :placeholder="$t('tools:selectColorFormat')"
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
            :label="$t('tools:optionSize')"
          >
            <el-radio-group v-model="activeData.size">
              <el-radio-button label="large">{{ $t('layout:size.large') }}</el-radio-button>
              <el-radio-button label="default">{{ $t('layout:size.default') }}</el-radio-button>
              <el-radio-button label="small">{{ $t('tools:small') }}</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item
            v-if="activeData['show-word-limit'] !== undefined"
            :label="$t('tools:characterCount')"
          >
            <el-switch v-model="activeData['show-word-limit']" />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-input-number'"
            :label="$t('tools:strictStepSize')"
          >
            <el-switch v-model="activeData['step-strictly']" />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-cascader'"
            :label="$t('tools:multipleSelection')"
          >
            <el-switch v-model="activeData.props.props.multiple" />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-cascader'"
            :label="$t('tools:showFullPath')"
          >
            <el-switch v-model="activeData['show-all-levels']" />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-cascader'"
            :label="$t('tools:filterable')"
          >
            <el-switch v-model="activeData.filterable" />
          </el-form-item>
          <el-form-item
            v-if="activeData.clearable !== undefined"
            :label="$t('tools:clearable')"
          >
            <el-switch v-model="activeData.clearable" />
          </el-form-item>
          <el-form-item
            v-if="activeData.showTip !== undefined"
            :label="$t('tools:showTooltip')"
          >
            <el-switch v-model="activeData.showTip" />
          </el-form-item>
          <el-form-item
            v-if="activeData.multiple !== undefined"
            :label="$t('tools:multipleFiles')"
          >
            <el-switch v-model="activeData.multiple" />
          </el-form-item>
          <el-form-item
            v-if="activeData['auto-upload'] !== undefined"
            :label="$t('tools:autoUpload')"
          >
            <el-switch v-model="activeData['auto-upload']" />
          </el-form-item>
          <el-form-item
            v-if="activeData.readonly !== undefined"
            :label="$t('tools:readOnly')"
          >
            <el-switch v-model="activeData.readonly" />
          </el-form-item>
          <el-form-item
            v-if="activeData.disabled !== undefined"
            :label="$t('tools:disabled')"
          >
            <el-switch v-model="activeData.disabled" />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-select'"
            :label="$t('tools:searchable')"
          >
            <el-switch v-model="activeData.filterable" />
          </el-form-item>
          <el-form-item
            v-if="activeData.tag === 'el-select'"
            :label="$t('tools:multipleSelection')"
          >
            <el-switch
              v-model="activeData.multiple"
              @change="multipleChange"
            />
          </el-form-item>
          <el-form-item
            v-if="activeData.required !== undefined"
            :label="$t('tools:requiredLabel')"
          >
            <el-switch v-model="activeData.required" />
          </el-form-item>

          <template v-if="activeData.layoutTree">
            <el-divider>{{ $t('tools:layoutTree') }}</el-divider>
            <el-tree
              :data="[activeData]"
              :props="layoutTreeProps"
              node-key="renderKey"
              default-expand-all
              draggable
            >
              <template #default="{ node, data }">
                <span class="node-label">
                  <svg-icon
                    class="node-icon"
                    :icon-class="data.tagIcon"
                    style="margin-right: 5px"
                  />
                  {{ node.label }}
                </span>
              </template>
            </el-tree>
          </template>

          <template v-if="activeData.layout === 'colFormItem'">
            <el-divider>{{ $t('tools:regularExpressionValidation') }}</el-divider>
            <div
              v-for="(item, index) in activeData.regList"
              :key="index"
              class="reg-item"
            >
              <span
                class="close-btn"
                @click="activeData.regList.splice(index, 1)"
              >
                <el-icon>
                  <Close />
                </el-icon>
              </span>
              <el-form-item :label="$t('tools:expression')">
                <el-input
                  v-model="item.pattern"
                  :placeholder="$t('tools:enterRegularExpression')"
                />
              </el-form-item>
              <el-form-item
                :label="$t('tools:errorMessage')"
                style="margin-bottom: 0"
              >
                <el-input
                  v-model="item.message"
                  :placeholder="$t('tools:enterErrorMessage')"
                />
              </el-form-item>
            </div>
            <div>
              <el-button
                icon="CirclePlus"
                style="margin-left: 0; margin-top: 10px"
                type="primary"
                text
                bg
                @click="addReg"
                >{{ $t('tools:addRule') }}</el-button
              >
            </div>
          </template>
        </el-form>
        <!-- 表单属性 -->
        <el-form
          v-show="currentTab === 'form'"
          label-width="90px"
          label-position="top"
        >
          <el-form-item :label="$t('tools:formName')">
            <el-input
              v-model="formConf.formRef"
              :placeholder="$t('tools:enterFormNameRef')"
            />
          </el-form-item>
          <el-form-item :label="$t('tools:formModel')">
            <el-input
              v-model="formConf.formModel"
              :placeholder="$t('tools:enterDataModel')"
            />
          </el-form-item>
          <el-form-item :label="$t('tools:validationModel')">
            <el-input
              v-model="formConf.formRules"
              :placeholder="$t('tools:enterValidationModel')"
            />
          </el-form-item>
          <el-form-item :label="$t('tools:formSize')">
            <el-radio-group v-model="formConf.size">
              <el-radio-button value="large">{{ $t('tools:builder.sizeLarge') }}</el-radio-button>
              <el-radio-button value="default">{{
                $t('tools:builder.sizeDefault')
              }}</el-radio-button>
              <el-radio-button value="small">{{ $t('tools:small') }}</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item :label="$t('tools:labelAlignment')">
            <el-radio-group v-model="formConf.labelPosition">
              <el-radio-button value="left">{{ $t('tools:builder.alignLeft') }}</el-radio-button>
              <el-radio-button value="right">{{ $t('tools:builder.alignRight') }}</el-radio-button>
              <el-radio-button value="top">{{ $t('tools:builder.alignTop') }}</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item :label="$t('tools:labelWidth')">
            <el-input-number
              v-model="formConf.labelWidth"
              :placeholder="$t('tools:labelWidth')"
            />
          </el-form-item>
          <el-form-item :label="$t('tools:gridGap')">
            <el-input-number
              v-model="formConf.gutter"
              :min="0"
              :placeholder="$t('tools:gridGap')"
            />
          </el-form-item>
          <el-form-item :label="$t('tools:disableForm')">
            <el-switch v-model="formConf.disabled" />
          </el-form-item>
          <el-form-item :label="$t('tools:formButtons')">
            <el-switch v-model="formConf.formBtns" />
          </el-form-item>
          <el-form-item :label="$t('tools:showBordersOfUnselectedComponents')">
            <el-switch v-model="formConf.unFocusedComponentBorder" />
          </el-form-item>
        </el-form>
      </el-scrollbar>
    </div>
    <icons-dialog
      v-model="iconsVisible"
      :current="activeData[currentIconModel]"
      @select="setIcon"
    />
    <treeNode-dialog
      v-model="dialogVisible"
      @commit="addNode"
    />
  </div>
</template>

<script setup>
import { t } from '@/i18n/adapter'
import draggable from 'vuedraggable/dist/vuedraggable.common'
import { isNumberStr } from '@/utils/index'
import IconsDialog from './IconsDialog'
import TreeNodeDialog from './TreeNodeDialog'
import { inputComponents, selectComponents } from '@/utils/generator/config'

const { proxy } = getCurrentInstance()
const dateTimeFormat = {
  date: 'YYYY-MM-DD',
  week: 'YYYY 第 ww 周',
  month: 'YYYY-MM',
  year: 'YYYY',
  datetime: 'YYYY-MM-DD HH:mm:ss',
  daterange: 'YYYY-MM-DD',
  monthrange: 'YYYY-MM',
  datetimerange: 'YYYY-MM-DD HH:mm:ss',
}
const props = defineProps({
  showField: Boolean,
  activeData: Object,
  formConf: Object,
})

const data = reactive({
  currentTab: 'field',
  currentNode: null,
  dialogVisible: false,
  iconsVisible: false,
  currentIconModel: null,
  dateTypeOptions: [
    {
      get label() {
        return t('tools:builder.date')
      },
      value: 'date',
    },
    {
      get label() {
        return t('tools:builder.week')
      },
      value: 'week',
    },
    {
      get label() {
        return t('tools:builder.month')
      },
      value: 'month',
    },
    {
      get label() {
        return t('tools:builder.year')
      },
      value: 'year',
    },
    {
      get label() {
        return t('tools:builder.dateTime')
      },
      value: 'datetime',
    },
  ],
  dateRangeTypeOptions: [
    {
      get label() {
        return t('tools:builder.dateRange')
      },
      value: 'daterange',
    },
    {
      get label() {
        return t('tools:builder.monthRange')
      },
      value: 'monthrange',
    },
    {
      get label() {
        return t('tools:builder.dateTimeRange')
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
})

const {
  currentTab,
  currentNode,
  dialogVisible,
  iconsVisible,
  currentIconModel,
  dateTypeOptions,
  dateRangeTypeOptions,
  colorFormatOptions,
  justifyOptions,
  layoutTreeProps,
} = toRefs(data)

const documentLink = computed(
  () => props.activeData.document || 'https://element-plus.org/zh-CN/guide/installation'
)

const dateOptions = computed(() => {
  if (props.activeData.type !== undefined && props.activeData.tag === 'el-date-picker') {
    if (props.activeData['start-placeholder'] === undefined) {
      return dateTypeOptions.value
    }
    return dateRangeTypeOptions.value
  }
  return []
})

const tagList = ref([
  {
    get label() {
      return t('tools:inputComponents')
    },
    options: inputComponents,
  },
  {
    get label() {
      return t('tools:selectionComponents')
    },
    options: selectComponents,
  },
])

const emit = defineEmits(['tag-change'])

function addReg() {
  props.activeData.regList.push({
    pattern: '',
    message: '',
  })
}
function addSelectItem() {
  props.activeData.options.push({
    label: '',
    value: '',
  })
}

function addTreeItem() {
  ++proxy.idGlobal
  dialogVisible.value = true
  currentNode.value = props.activeData.options
}

function renderContent(h, { node, data, store }) {
  return h(
    'div',
    {
      class: 'custom-tree-node',
    },
    [
      h('span', node.label),
      h(
        'span',
        {
          class: 'node-operation',
        },
        [
          h(resolveComponent('el-link'), {
            type: 'primary',
            icon: 'Plus',
            underline: false,
            onClick: () => {
              append(data)
            },
          }),
          h(resolveComponent('el-link'), {
            type: 'danger',
            icon: 'Delete',
            underline: false,
            style: 'margin-left: 5px;',
            onClick: () => {
              remove(node, data)
            },
          }),
        ]
      ),
    ]
  )
}
function append(data) {
  if (!data.children) {
    data.children = []
  }
  dialogVisible.value = true
  currentNode.value = data.children
}
function remove(node, data) {
  const { parent } = node
  const children = parent.data.children || parent.data
  const index = children.findIndex((d) => d.id === data.id)
  children.splice(index, 1)
}
function addNode(data) {
  currentNode.value.push(data)
}

function setOptionValue(item, val) {
  item.value = isNumberStr(val) ? +val : val
}
function setDefaultValue(val) {
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
}

function onDefaultValueInput(str) {
  if (Array.isArray(props.activeData.defaultValue)) {
    // 数组
    props.activeData.defaultValue = str.split(',').map((val) => (isNumberStr(val) ? +val : val))
  } else if (['true', 'false'].indexOf(str) > -1) {
    // 布尔
    props.activeData.defaultValue = JSON.parse(str)
  } else {
    // 字符串和数字
    props.activeData.defaultValue = isNumberStr(str) ? +str : str
  }
}

function onSwitchValueInput(val, name) {
  if (['true', 'false'].indexOf(val) > -1) {
    props.activeData[name] = JSON.parse(val)
  } else {
    props.activeData[name] = isNumberStr(val) ? +val : val
  }
}

function setTimeValue(val, type) {
  const valueFormat = type === 'week' ? dateTimeFormat.date : val
  props.activeData.defaultValue = null
  props.activeData['value-format'] = valueFormat
  props.activeData.format = val
}

function spanChange(val) {
  props.formConf.span = val
}

function multipleChange(val) {
  props.activeData.defaultValue = val ? [] : ''
}

function dateTypeChange(val) {
  setTimeValue(dateTimeFormat[val], val)
}

function rangeChange(val) {
  props.activeData.defaultValue = val
    ? [props.activeData.min, props.activeData.max]
    : props.activeData.min
}

function rateTextChange(val) {
  if (val) props.activeData['show-score'] = false
}

function rateScoreChange(val) {
  if (val) props.activeData['show-text'] = false
}

function colorFormatChange(val) {
  props.activeData.defaultValue = null
  props.activeData['show-alpha'] = val.indexOf('a') > -1
  props.activeData.renderKey = +new Date() // 更新renderKey,重新渲染该组件
}

function openIconsDialog(model) {
  iconsVisible.value = true
  currentIconModel.value = model
}

function setIcon(val) {
  props.activeData[currentIconModel.value] = val
}

function tagChange(tagIcon) {
  let target = inputComponents.find((item) => item.tagIcon === tagIcon)
  if (!target) target = selectComponents.find((item) => item.tagIcon === tagIcon)
  emit('tag-change', target)
}
</script>

<style lang="scss" scoped>
.right-board {
  width: 350px;
  position: absolute;
  right: 0;
  top: 0;
  padding-top: 3px;

  &:deep() {
    .el-tabs__header {
      margin: 0;
    }

    .el-input-group__append .el-button {
      display: inline-flex;
    }
  }

  .field-box {
    position: relative;
    height: calc(100vh - 50px - 40px - 42px);
    box-sizing: border-box;
    overflow: hidden;
  }

  .el-scrollbar {
    height: 100%;

    &:deep() {
      .el-scrollbar__view {
        padding: 30px 20px;
      }
    }
  }
}

.reg-item {
  padding: 12px 6px;
  background: var(--el-border-color-extra-light);
  position: relative;
  border-radius: 4px;

  .close-btn {
    position: absolute;
    right: -6px;
    top: -6px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    line-height: 16px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 50%;
    color: #fff;
    z-index: 1;
    cursor: pointer;
    font-size: 12px;
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

  :deep() {
    .el-icon-time {
      display: none;
    }
  }
}

.document-link {
  position: absolute;
  display: flex;
  width: 26px;
  height: 26px;
  top: 0;
  left: 0;
  cursor: pointer;
  background: #409eff;
  z-index: 1;
  border-radius: 0 0 6px 0;
  justify-content: center;
  align-items: center;
  color: #fff;
  font-size: 18px;
}

.node-label {
  font-size: 14px;
}

.node-icon {
  color: #bebfc3;
}

.custom-tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  padding-right: 8px;
}
</style>
