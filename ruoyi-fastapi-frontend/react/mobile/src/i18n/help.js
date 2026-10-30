import { t } from './index'

export const helpTopics = {
  openSource: {
    title: () => t('mobile:isRuoyiFastapiOpenSource'),
    content: () => t('mobile:openSource'),
  },
  commercial: {
    title: () => t('mobile:canIUseRuoyiFastapiCommercially'),
    content: () => t('mobile:yes'),
  },
  website: {
    title: () => t('mobile:whatIsTheRuoyiFastapiWebsite'),
    content: () => 'https://vfadmin.insistence.tech',
  },
  documentation: {
    title: () => t('mobile:whereIsTheRuoyiFastapiDocumentation'),
    content: () => 'https://vfadmin.insistence.tech',
  },
  signOut: {
    title: () => t('mobile:howDoISignOut'),
    content: () => t('mobile:goToMeAppSettingsSignOut'),
  },
  avatar: {
    title: () => t('mobile:howDoIChangeMyAvatar'),
    content: () => t('mobile:goToMeChooseAvatarSubmit'),
  },
  password: {
    title: () => t('mobile:howDoIChangeMyPassword'),
    content: () => t('mobile:goToMeAppSettingsChangePassword'),
  },
}
