<template>
  <el-form
    :validate-on-rule-change="false"
    label-width="100px"
    @submit.native.prevent="save"
  >
    <el-form-item :label="$t('system:timeDisplayMode')">
      <el-radio-group
        v-model="mode"
        :disabled="saving"
      >
        <el-radio label="auto">{{ $t('system:user.followDeviceAutomatically') }}</el-radio>
        <el-radio label="custom">{{ $t('system:chooseManually') }}</el-radio>
      </el-radio-group>
    </el-form-item>
    <el-form-item
      v-if="mode === 'custom'"
      :label="$t('system:user.displayTimeZone')"
      :error="fieldError"
    >
      <el-select
        v-model="selectedZone"
        filterable
        :disabled="saving"
        :loading="loading"
        :placeholder="$t('system:user.searchTimeZonesEGAsiaShanghai')"
        :aria-label="$t('system:user.displayTimeZone')"
        style="width: 100%"
        @change="fieldError = ''"
      >
        <el-option
          v-for="zone in timezones"
          :key="zone"
          :label="zone"
          :value="zone"
        />
      </el-select>
    </el-form-item>
    <el-form-item v-if="loadError">
      <el-alert
        type="warning"
        :closable="false"
      >
        <span slot="title">
          {{ $t('system:user.failedToLoadTheTimeZoneListYourCurrentTime') }}
          <el-button
            type="text"
            size="mini"
            :loading="loading"
            @click="loadOptions"
            >{{ $t('common:retry') }}</el-button
          >
        </span>
      </el-alert>
    </el-form-item>
    <el-form-item :label="$t('system:interface.previewTimeZone')">
      <span>{{ previewZone }}</span>
    </el-form-item>
    <el-form-item :label="$t('system:user.timePreview')">
      <span aria-live="polite">{{ previewTime }}</span>
      <div
        v-if="mode === 'auto' && !deviceZone"
        class="timezone-help"
      >
        {{ $t('system:user.thisDeviceCannotIdentifyItsTimeZoneTheSystemTime') }}
      </div>
      <div class="timezone-help">
        {{ $t('system:user.usedForTimeDisplayDateFilteringAndExportsScheduledJobs') }}
      </div>
    </el-form-item>
    <el-form-item :error="saveError">
      <el-button
        type="primary"
        size="mini"
        native-type="submit"
        :loading="saving"
        >{{ $t('common:save') }}</el-button
      >
      <el-button
        type="danger"
        size="mini"
        @click="close"
        >{{ $t('layout:search.close') }}</el-button
      >
    </el-form-item>
  </el-form>
</template>

<script>
import { t } from '@/i18n/adapter'

import { getTimezoneOptions, updateUserTimezone } from '@/api/system/user'
import {
  formatBusinessTime,
  getBusinessTimezone,
  getDeviceTimezone,
  getDisplayTimezone,
  getSupportedTimezones,
} from '@/utils/time'
export default {
  name: 'TimezoneSettings',
  props: {
    user: Object,
  },
  data() {
    return {
      mode: this.$store.state.user.timeZone === 'auto' ? 'auto' : 'custom',
      selectedZone: getDisplayTimezone(),
      timezones: getSupportedTimezones(),
      loading: false,
      loadError: false,
      saving: false,
      saveError: '',
      fieldError: '',
      now: new Date(),
    }
  },
  computed: {
    deviceZone() {
      return getDeviceTimezone()
    },
    previewZone() {
      return this.mode === 'auto' ? this.deviceZone || getBusinessTimezone() : this.selectedZone
    },
    previewTime() {
      return formatBusinessTime(this.now, 'YYYY-MM-DD HH:mm:ss', this.previewZone)
    },
    userTimezone() {
      return this.user?.timeZone
    },
  },
  watch: {
    userTimezone(value) {
      if (!value) {
        return
      }
      this.mode = value === 'auto' ? 'auto' : 'custom'
      this.selectedZone = value === 'auto' ? getDisplayTimezone() : value
    },
  },
  mounted() {
    this.loadOptions()
  },
  methods: {
    close() {
      this.$tab.closePage()
    },
    /** 加载当前浏览器支持的时区选项。 */
    async loadOptions() {
      this.loading = true
      this.loadError = false
      try {
        const response = await getTimezoneOptions()
        this.timezones = getSupportedTimezones(response.data)
      } catch {
        this.loadError = true
      } finally {
        this.loading = false
      }
    },
    /** 保存账号时区，并同步当前页面展示。 */
    async save() {
      if (this.saving) {
        return
      }
      if (this.mode === 'custom' && !this.selectedZone) {
        this.fieldError = t('system:selectDisplayTimeZone')
        return
      }
      this.saving = true
      this.saveError = ''
      const preference = this.mode === 'auto' ? 'auto' : this.selectedZone
      try {
        await updateUserTimezone(preference)
        this.$store.dispatch('ApplyTimezone', preference)
        this.$emit('saved', preference)
        this.now = new Date()
        this.$modal.msgSuccess(t('system:user.timeZoneSaved'))
      } catch (error) {
        this.saveError = error.message || t('common:saveFailed')
      } finally {
        this.saving = false
      }
    },
  },
}
</script>

<style scoped>
.timezone-help {
  color: #909399;
  font-size: 12px;
  line-height: 1.6;
}
</style>
