<template>
  <el-form>
    <el-form-item>
      <el-radio
        v-model="radioValue"
        :value="1"
      >
        {{ $t('components:monthAllowedWildcards') }}</el-radio
      >
    </el-form-item>

    <el-form-item>
      <el-radio
        v-model="radioValue"
        :value="2"
      >
        <LocalizedMessage
          :message="$t('components:cron.range.months', { start: '{start}', end: '{end}' })"
          ><template #start
            ><el-input-number
              v-model="cycle01"
              :min="1"
              :max="11" /></template
          ><template #end
            ><el-input-number
              v-model="cycle02"
              :min="cycle01 + 1"
              :max="12" /></template
        ></LocalizedMessage>
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio
        v-model="radioValue"
        :value="3"
      >
        <LocalizedMessage
          :message="$t('components:cron.every.months', { start: '{start}', step: '{step}' })"
          ><template #start
            ><el-input-number
              v-model="average01"
              :min="1"
              :max="11" /></template
          ><template #step
            ><el-input-number
              v-model="average02"
              :min="1"
              :max="12 - average01" /></template
        ></LocalizedMessage>
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio
        v-model="radioValue"
        :value="4"
      >
        {{ $t('components:specify')
        }}<el-select
          clearable
          v-model="checkboxList"
          :placeholder="$t('components:multipleSelectionsAllowed')"
          multiple
          :multiple-limit="8"
        >
          <el-option
            v-for="item in monthList"
            :key="item.key"
            :label="item.value"
            :value="item.key"
          />
        </el-select>
      </el-radio>
    </el-form-item>
  </el-form>
</template>

<script setup>
import LocalizedMessage from '@/components/LocalizedMessage/index.vue'
import { t } from '@/i18n/adapter'
const emit = defineEmits(['update'])
const props = defineProps({
  cron: {
    type: Object,
    default: {
      second: '*',
      min: '*',
      hour: '*',
      day: '*',
      month: '*',
      week: '?',
      year: '',
    },
  },
  check: {
    type: Function,
    default: () => {},
  },
})
const radioValue = ref(1)
const cycle01 = ref(1)
const cycle02 = ref(2)
const average01 = ref(1)
const average02 = ref(1)
const checkboxList = ref([])
const checkCopy = ref([1])
const monthList = computed(() => [
  {
    key: 1,
    get value() {
      return t('components:january')
    },
  },
  {
    key: 2,
    get value() {
      return t('components:february')
    },
  },
  {
    key: 3,
    get value() {
      return t('components:march')
    },
  },
  {
    key: 4,
    get value() {
      return t('components:april')
    },
  },
  {
    key: 5,
    get value() {
      return t('components:may')
    },
  },
  {
    key: 6,
    get value() {
      return t('components:june')
    },
  },
  {
    key: 7,
    get value() {
      return t('components:july')
    },
  },
  {
    key: 8,
    get value() {
      return t('components:august')
    },
  },
  {
    key: 9,
    get value() {
      return t('components:september')
    },
  },
  {
    key: 10,
    get value() {
      return t('components:october')
    },
  },
  {
    key: 11,
    get value() {
      return t('components:november')
    },
  },
  {
    key: 12,
    get value() {
      return t('components:december')
    },
  },
])
const cycleTotal = computed(() => {
  cycle01.value = props.check(cycle01.value, 1, 11)
  cycle02.value = props.check(cycle02.value, cycle01.value + 1, 12)
  return cycle01.value + '-' + cycle02.value
})
const averageTotal = computed(() => {
  average01.value = props.check(average01.value, 1, 11)
  average02.value = props.check(average02.value, 1, 12 - average01.value)
  return average01.value + '/' + average02.value
})
const checkboxString = computed(() => {
  return checkboxList.value.join(',')
})
watch(
  () => props.cron.month,
  (value) => changeRadioValue(value)
)
watch([radioValue, cycleTotal, averageTotal, checkboxString], () => onRadioChange())
function changeRadioValue(value) {
  if (value === '*') {
    radioValue.value = 1
  } else if (value.indexOf('-') > -1) {
    const indexArr = value.split('-')
    cycle01.value = Number(indexArr[0])
    cycle02.value = Number(indexArr[1])
    radioValue.value = 2
  } else if (value.indexOf('/') > -1) {
    const indexArr = value.split('/')
    average01.value = Number(indexArr[0])
    average02.value = Number(indexArr[1])
    radioValue.value = 3
  } else {
    checkboxList.value = [...new Set(value.split(',').map((item) => Number(item)))]
    radioValue.value = 4
  }
}
function onRadioChange() {
  switch (radioValue.value) {
    case 1:
      emit('update', 'month', '*', 'month')
      break
    case 2:
      emit('update', 'month', cycleTotal.value, 'month')
      break
    case 3:
      emit('update', 'month', averageTotal.value, 'month')
      break
    case 4:
      if (checkboxList.value.length === 0) {
        checkboxList.value.push(checkCopy.value[0])
      } else {
        checkCopy.value = checkboxList.value
      }
      emit('update', 'month', checkboxString.value, 'month')
      break
  }
}
</script>

<style lang="scss" scoped>
.el-input-number--small,
.el-select,
.el-select--small {
  margin: 0 0.2rem;
}
.el-select,
.el-select--small {
  width: 18.8rem;
}
</style>
