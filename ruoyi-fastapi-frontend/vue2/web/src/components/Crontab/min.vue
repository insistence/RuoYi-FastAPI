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
        {{ $t('tool:interface.minuteAllowedWildcards') }}
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio
        v-model="radioValue"
        :label="2"
      >
        {{ $t('tool:cron.rangeFrom') }}
        <el-input-number
          v-model="cycle01"
          :min="0"
          :max="58"
        />
        -
        <el-input-number
          v-model="cycle02"
          :min="cycle01 ? cycle01 + 1 : 1"
          :max="59"
        />
        {{ $t('common:minutes') }}
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio
        v-model="radioValue"
        :label="3"
      >
        {{ $t('tool:cron.from') }}
        <el-input-number
          v-model="average01"
          :min="0"
          :max="58"
        />
        {{ $t('tool:interface.repeatEvery.min') }}
        <el-input-number
          v-model="average02"
          :min="1"
          :max="59 - average01 || 0"
        />
        {{ $t('tool:interface.minutes') }}
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio
        v-model="radioValue"
        :label="4"
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
            v-for="item in 60"
            :key="item"
            :value="item - 1"
            >{{ item - 1 }}</el-option
          >
        </el-select>
      </el-radio>
    </el-form-item>
  </el-form>
</template>

<script>
export default {
  data() {
    return {
      radioValue: 1,
      cycle01: 1,
      cycle02: 2,
      average01: 0,
      average02: 1,
      checkboxList: [],
      checkNum: this.$options.propsData.check,
    }
  },
  name: 'crontab-min',
  props: ['check', 'cron'],
  methods: {
    // 单选按钮值变化时
    radioChange() {
      switch (this.radioValue) {
        case 1:
          this.$emit('update', 'min', '*', 'min')
          break
        case 2:
          this.$emit('update', 'min', this.cycleTotal, 'min')
          break
        case 3:
          this.$emit('update', 'min', this.averageTotal, 'min')
          break
        case 4:
          this.$emit('update', 'min', this.checkboxString, 'min')
          break
      }
    },
    // 周期两个值变化时
    cycleChange() {
      if (this.radioValue == '2') {
        this.$emit('update', 'min', this.cycleTotal, 'min')
      }
    },
    // 平均两个值变化时
    averageChange() {
      if (this.radioValue == '3') {
        this.$emit('update', 'min', this.averageTotal, 'min')
      }
    },
    // checkbox值变化时
    checkboxChange() {
      if (this.radioValue == '4') {
        this.$emit('update', 'min', this.checkboxString, 'min')
      }
    },
  },
  watch: {
    radioValue: 'radioChange',
    cycleTotal: 'cycleChange',
    averageTotal: 'averageChange',
    checkboxString: 'checkboxChange',
  },
  computed: {
    // 计算两个周期值
    cycleTotal: function () {
      const cycle01 = this.checkNum(this.cycle01, 0, 58)
      const cycle02 = this.checkNum(this.cycle02, cycle01 ? cycle01 + 1 : 1, 59)
      return cycle01 + '-' + cycle02
    },
    // 计算平均用到的值
    averageTotal: function () {
      const average01 = this.checkNum(this.average01, 0, 58)
      const average02 = this.checkNum(this.average02, 1, 59 - average01 || 0)
      return average01 + '/' + average02
    },
    // 计算勾选的checkbox值合集
    checkboxString: function () {
      let str = this.checkboxList.join()
      return str == '' ? '*' : str
    },
  },
}
</script>
