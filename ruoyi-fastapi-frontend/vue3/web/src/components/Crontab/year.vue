<template>
  <el-form>
    <el-form-item>
      <el-radio
        :value="1"
        v-model="radioValue"
      >
        {{ $t('components:unspecifiedAllowedWildcards') }}</el-radio
      >
    </el-form-item>

    <el-form-item>
      <el-radio
        :value="2"
        v-model="radioValue"
      >
        {{ $t('components:everyYear') }}</el-radio
      >
    </el-form-item>

    <el-form-item>
      <el-radio
        :value="3"
        v-model="radioValue"
      >
        <LocalizedMessage
          :message="$t('components:cron.range.years', { start: '{start}', end: '{end}' })"
          ><template #start
            ><el-input-number
              v-model="cycle01"
              :min="fullYear"
              :max="2098" /></template
          ><template #end
            ><el-input-number
              v-model="cycle02"
              :min="cycle01 ? cycle01 + 1 : fullYear + 1"
              :max="2099" /></template
        ></LocalizedMessage>
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio
        :value="4"
        v-model="radioValue"
      >
        <LocalizedMessage
          :message="$t('components:cron.every.years', { start: '{start}', step: '{step}' })"
          ><template #start
            ><el-input-number
              v-model="average01"
              :min="fullYear"
              :max="2098" /></template
          ><template #step
            ><el-input-number
              v-model="average02"
              :min="1"
              :max="2099 - average01 || fullYear" /></template
        ></LocalizedMessage>
      </el-radio>
    </el-form-item>

    <el-form-item>
      <el-radio
        :value="5"
        v-model="radioValue"
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
            v-for="item in 9"
            :key="item"
            :value="item - 1 + fullYear"
            :label="item - 1 + fullYear"
          />
        </el-select>
      </el-radio>
    </el-form-item>
  </el-form>
</template>

<script setup>
import LocalizedMessage from '@/components/LocalizedMessage/index.vue'
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

const fullYear = Number(new Date().getFullYear())
const maxFullYear = fullYear + 10
const radioValue = ref(1)
const cycle01 = ref(fullYear)
const cycle02 = ref(fullYear + 1)
const average01 = ref(fullYear)
const average02 = ref(1)
const checkboxList = ref([])
const checkCopy = ref([fullYear])

const cycleTotal = computed(() => {
  cycle01.value = props.check(cycle01.value, fullYear, maxFullYear - 1)
  cycle02.value = props.check(cycle02.value, cycle01.value + 1, maxFullYear)
  return cycle01.value + '-' + cycle02.value
})
const averageTotal = computed(() => {
  average01.value = props.check(average01.value, fullYear, maxFullYear - 1)
  average02.value = props.check(average02.value, 1, 10)
  return average01.value + '/' + average02.value
})
const checkboxString = computed(() => {
  return checkboxList.value.join(',')
})
watch(
  () => props.cron.year,
  (value) => changeRadioValue(value)
)
watch([radioValue, cycleTotal, averageTotal, checkboxString], () => onRadioChange())
function changeRadioValue(value) {
  if (value === '') {
    radioValue.value = 1
  } else if (value === '*') {
    radioValue.value = 2
  } else if (value.indexOf('-') > -1) {
    const indexArr = value.split('-')
    cycle01.value = Number(indexArr[0])
    cycle02.value = Number(indexArr[1])
    radioValue.value = 3
  } else if (value.indexOf('/') > -1) {
    const indexArr = value.split('/')
    average01.value = Number(indexArr[0])
    average02.value = Number(indexArr[1])
    radioValue.value = 4
  } else {
    checkboxList.value = [...new Set(value.split(',').map((item) => Number(item)))]
    radioValue.value = 5
  }
}
function onRadioChange() {
  switch (radioValue.value) {
    case 1:
      emit('update', 'year', '', 'year')
      break
    case 2:
      emit('update', 'year', '*', 'year')
      break
    case 3:
      emit('update', 'year', cycleTotal.value, 'year')
      break
    case 4:
      emit('update', 'year', averageTotal.value, 'year')
      break
    case 5:
      if (checkboxList.value.length === 0) {
        checkboxList.value.push(checkCopy.value[0])
      } else {
        checkCopy.value = checkboxList.value
      }
      emit('update', 'year', checkboxString.value, 'year')
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
