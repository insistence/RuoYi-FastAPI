import useSettingsStore from '@/store/modules/settings'
export default function Copyright() {
  const { footerVisible, footerContent } = useSettingsStore()
  return footerVisible ? <footer className="layout-copyright">{footerContent}</footer> : null
}
