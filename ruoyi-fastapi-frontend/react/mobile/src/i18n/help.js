import { t } from './index'

export const helpTopics = {
  openSource: {
    title: () => t('mobile:help.openSourceQuestion'),
    content: () => t('mobile:help.openSourceAnswer'),
  },
  commercial: {
    title: () => t('mobile:help.commercialQuestion'),
    content: () => t('mobile:help.commercialAnswer'),
  },
  website: {
    title: () => t('mobile:help.websiteQuestion'),
    content: () => 'https://vfadmin.insistence.tech',
  },
  documentation: {
    title: () => t('mobile:help.docsQuestion'),
    content: () => 'https://vfadmin.insistence.tech',
  },
  signOut: {
    title: () => t('mobile:help.signOutQuestion'),
    content: () => t('mobile:help.signOutAnswer'),
  },
  avatar: {
    title: () => t('mobile:help.avatarQuestion'),
    content: () => t('mobile:help.avatarAnswer'),
  },
  password: {
    title: () => t('mobile:help.passwordQuestion'),
    content: () => t('mobile:help.passwordAnswer'),
  },
}
