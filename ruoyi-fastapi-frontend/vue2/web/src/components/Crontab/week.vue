<template>
  <el-form
    :validate-on-rule-change="false"
    size="small"
  >
    <el-form-item>
      <el-radio
        v-model="radioValue"
        :label="1"
      >
        {{ $t('tool:interface.weekAllowedWildcardsL') }}
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio
        v-model="radioValue"
        :label="2"
      >
        {{ $t('tool:cron.notSpecified') }}
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio
        v-model="radioValue"
        :label="3"
      >
        {{ $t('tool:interface.fromWeekday') }}
        <el-select
          clearable
          v-model="cycle01"
        >
          <el-option
            v-for="(item, index) of weekList"
            :key="index"
            :label="item.value"
            :value="item.key"
            :disabled="item.key === 1"
            >{{ item.value }}</el-option
          >
        </el-select>
        -
        <el-select
          clearable
          v-model="cycle02"
        >
          <el-option
            v-for="(item, index) of weekList"
            :key="index"
            :label="item.value"
            :value="item.key"
            :disabled="item.key < cycle01 && item.key !== 1"
            >{{ item.value }}</el-option
          >
        </el-select>
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio
        v-model="radioValue"
        :label="4"
      >
        {{ $t('tool:cron.number') }}
        <el-input-number
          v-model="average01"
          :min="1"
          :max="4"
        />
        {{ $t('tool:interface.weekOnWeekday') }}
        <el-select
          clearable
          v-model="average02"
        >
          <el-option
            v-for="(item, index) of weekList"
            :key="index"
            :label="item.value"
            :value="item.key"
            >{{ item.value }}</el-option
          >
        </el-select>
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio
        v-model="radioValue"
        :label="5"
      >
        {{ $t('tool:interface.lastWeekdayOfTheMonth') }}
        <el-select
          clearable
          v-model="weekday"
        >
          <el-option
            v-for="(item, index) of weekList"
            :key="index"
            :label="item.value"
            :value="item.key"
            >{{ item.value }}</el-option
          >
        </el-select>
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio
        v-model="radioValue"
        :label="6"
      >
        {{ $t('common:specified') }}
        <el-select
          clearable
          v-model="checkboxList"
          :placeholder="$t('common:multipleSelect')"
          multiple
          style="width: 100%"
        >
          <el-option
            v-for="(item, index) of weekList"
            :key="index"
            :label="item.value"
            :value="String(item.key)"
            >{{ item.value }}</el-option
          >
        </el-select>
      </el-radio>
    </el-form-item>
  </el-form>
</template>

<script>
import { t } from '@/i18n/adapter'
export default {
  data() {
    return {
      radioValue: 2,
      weekday: 2,
      cycle01: 2,
      cycle02: 3,
      average01: 1,
      average02: 2,
      checkboxList: [],
      weekList: [
        {
          key: 2,
          get value() {
            return t('tool:cron.weekday.monday')
          },
        },
        {
          key: 3,
          get value() {
            return t('tool:cron.weekday.tuesday')
          },
        },
        {
          key: 4,
          get value() {
            return t('tool:cron.weekday.wednesday')
          },
        },
        {
          key: 5,
          get value() {
            return t('tool:cron.weekday.thursday')
          },
        },
        {
          key: 6,
          get value() {
            return t('tool:cron.weekday.friday')
          },
        },
        {
          key: 7,
          get value() {
            return t('tool:cron.weekday.saturday')
          },
        },
        {
          key: 1,
          get value() {
            return t('tool:cron.weekday.sunday')
          },
        },
      ],
      checkNum: this.$options.propsData.check,
    }
  },
  name: 'crontab-week',
  props: ['check', 'cron'],
  methods: {
    // 单选按钮值变化时
    radioChange() {
      if (this.radioValue !== 2 && this.cron.day !== '?') {
        this.$emit('update', 'day', '?', 'week')
      }
      switch (this.radioValue) {
        case 1:
          this.$emit('update', 'week', '*')
          break
        case 2:
          this.$emit('update', 'week', '?')
          break
        case 3:
          this.$emit('update', 'week', this.cycleTotal)
          break
        case 4:
          this.$emit('update', 'week', this.averageTotal)
          break
        case 5:
          this.$emit('update', 'week', this.weekdayCheck + 'L')
          break
        case 6:
          this.$emit('update', 'week', this.checkboxString)
          break
      }
    },

    // 周期两个值变化时
    cycleChange() {
      if (this.radioValue == '3') {
        this.$emit('update', 'week', this.cycleTotal)
      }
    },
    // 平均两个值变化时
    averageChange() {
      if (this.radioValue == '4') {
        this.$emit('update', 'week', this.averageTotal)
      }
    },
    // 最近工作日值变化时
    weekdayChange() {
      if (this.radioValue == '5') {
        this.$emit('update', 'week', this.weekday + 'L')
      }
    },
    // checkbox值变化时
    checkboxChange() {
      if (this.radioValue == '6') {
        this.$emit('update', 'week', this.checkboxString)
      }
    },
  },
  watch: {
    radioValue: 'radioChange',
    cycleTotal: 'cycleChange',
    averageTotal: 'averageChange',
    weekdayCheck: 'weekdayChange',
    checkboxString: 'checkboxChange',
  },
  computed: {
    // 计算两个周期值
    cycleTotal: function () {
      this.cycle01 = this.checkNum(this.cycle01, 1, 7)
      this.cycle02 = this.checkNum(this.cycle02, 1, 7)
      return this.cycle01 + '-' + this.cycle02
    },
    // 计算平均用到的值
    averageTotal: function () {
      this.average01 = this.checkNum(this.average01, 1, 4)
      this.average02 = this.checkNum(this.average02, 1, 7)
      return this.average02 + '#' + this.average01
    },
    // 最近的工作日（格式）
    weekdayCheck: function () {
      this.weekday = this.checkNum(this.weekday, 1, 7)
      return this.weekday
    },
    // 计算勾选的checkbox值合集
    checkboxString: function () {
      let str = this.checkboxList.join()
      return str == '' ? '*' : str
    },
  },
}
</script>
