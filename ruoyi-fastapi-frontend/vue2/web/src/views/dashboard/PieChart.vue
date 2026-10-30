<template>
  <div
    :class="className"
    :style="{ height: height, width: width }"
  />
</template>

<script>
import * as echarts from 'echarts'
require('echarts/theme/macarons') // echarts theme
import resize from './mixins/resize'

export default {
  mixins: [resize],
  props: {
    className: {
      type: String,
      default: 'chart',
    },
    width: {
      type: String,
      default: '100%',
    },
    height: {
      type: String,
      default: '300px',
    },
  },
  data() {
    return {
      chart: null,
    }
  },
  watch: {
    '$locale.locale'() {
      if (this.chart) this.setOptions()
    },
  },
  mounted() {
    this.$nextTick(() => {
      this.initChart()
    })
  },
  beforeDestroy() {
    if (!this.chart) {
      return
    }
    this.chart.dispose()
    this.chart = null
  },
  methods: {
    initChart() {
      this.chart = echarts.init(this.$el, 'macarons')
      this.setOptions()
    },
    setOptions() {
      this.chart.setOption({
        tooltip: {
          trigger: 'item',
          formatter: '{a} <br/>{b} : {c} ({d}%)',
        },
        legend: {
          left: 'center',
          bottom: '10',
          data: [
            this.$t('layout:dashboard.industries'),
            this.$t('layout:dashboard.technology'),
            this.$t('layout:dashboard.forex'),
            this.$t('layout:dashboard.gold'),
            this.$t('layout:dashboard.forecasts'),
          ],
        },
        series: [
          {
            name: this.$t('layout:dashboard.weeklyArticles'),
            type: 'pie',
            roseType: 'radius',
            radius: [15, 95],
            center: ['50%', '38%'],
            data: [
              { value: 320, name: this.$t('layout:dashboard.industries') },
              { value: 240, name: this.$t('layout:dashboard.technology') },
              { value: 149, name: this.$t('layout:dashboard.forex') },
              { value: 100, name: this.$t('layout:dashboard.gold') },
              { value: 59, name: this.$t('layout:dashboard.forecasts') },
            ],
            animationEasing: 'cubicInOut',
            animationDuration: 2600,
          },
        ],
      })
    },
  },
}
</script>
