import { t } from '@/i18n'
export const projectNotice = [
  {
    id: 'xxx1',
    title: 'Alipay',
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/WdGqmHpayyMjiEhcKoVE.png',
    description: '那是一种内在的东西，他们到达不了，也无法触及的',
    get updatedAt() {
      return t('common:justNow')
    },
    member: '科学搬砖组',
    href: '',
    memberLink: '',
  },
  {
    id: 'xxx2',
    title: 'Angular',
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/zOsKZmFRdUtvpqCImOVY.png',
    description: '希望是一个好东西，也许是最好的，好东西是不会消亡的',
    get updatedAt() {
      return t('common:6YearsAgo')
    },
    member: '全组都是吴彦祖',
    href: '',
    memberLink: '',
  },
  {
    id: 'xxx3',
    title: 'Ant Design',
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/dURIMkkrRFpPgTuzkwnB.png',
    description: '城镇中有那么多的酒馆，她却偏偏走进了我的酒馆',
    get updatedAt() {
      return t('common:justNow')
    },
    member: '中二少女团',
    href: '',
    memberLink: '',
  },
  {
    id: 'xxx4',
    title: 'Ant Design Pro',
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/sfjbOqnsXXJgNCjCzDBL.png',
    description: '那时候我只会想自己想要什么，从不想自己拥有什么',
    get updatedAt() {
      return t('common:6YearsAgo')
    },
    member: '程序员日常',
    href: '',
    memberLink: '',
  },
  {
    id: 'xxx5',
    title: 'Bootstrap',
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/siCrBXXhmvTQGWPNLBow.png',
    description: '凛冬将至',
    get updatedAt() {
      return t('common:6YearsAgo')
    },
    member: '高逼格设计天团',
    href: '',
    memberLink: '',
  },
  {
    id: 'xxx6',
    title: 'React',
    logo: 'https://gw.alipayobjects.com/zos/rmsportal/kZzEzemZyKLKFsojXItE.png',
    description: '生命就像一盒巧克力，结果往往出人意料',
    get updatedAt() {
      return t('common:6YearsAgo')
    },
    member: '骗你来学计算机',
    href: '',
    memberLink: '',
  },
]

export const activities = [
  {
    id: 'trend-1',
    get updatedAt() {
      return t('common:justNow')
    },
    user: {
      name: '曲丽丽',
      avatar: 'https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png',
    },
    group: {
      name: '高逼格设计天团',
      link: 'http://github.com/',
    },
    project: {
      name: '六月迭代',
      link: 'http://github.com/',
    },
    messageKey: 'common:dashboard.activity.created',
  },
  {
    id: 'trend-2',
    get updatedAt() {
      return t('common:justNow')
    },
    user: {
      name: '付小小',
      avatar: 'https://gw.alipayobjects.com/zos/rmsportal/cnrhVkzwxjPwAaCfPbdc.png',
    },
    group: {
      name: '高逼格设计天团',
      link: 'http://github.com/',
    },
    project: {
      name: '六月迭代',
      link: 'http://github.com/',
    },
    messageKey: 'common:dashboard.activity.created',
  },
  {
    id: 'trend-3',
    get updatedAt() {
      return t('common:justNow')
    },
    user: {
      name: '林东东',
      avatar: 'https://gw.alipayobjects.com/zos/rmsportal/gaOngJwsRYRaVAuXXcmB.png',
    },
    group: {
      name: '中二少女团',
      link: 'http://github.com/',
    },
    project: {
      name: '六月迭代',
      link: 'http://github.com/',
    },
    messageKey: 'common:dashboard.activity.created',
  },
  {
    id: 'trend-4',
    get updatedAt() {
      return t('common:justNow')
    },
    user: {
      name: '周星星',
      avatar: 'https://gw.alipayobjects.com/zos/rmsportal/WhxKECPNujWoWEFNdnJE.png',
    },
    group: {
      name: '5 月日常迭代',
      link: 'http://github.com/',
    },
    messageKey: 'common:dashboard.activity.updated',
  },
  {
    id: 'trend-5',
    get updatedAt() {
      return t('common:justNow')
    },
    user: {
      name: '朱偏右',
      avatar: 'https://gw.alipayobjects.com/zos/rmsportal/ubnKSIfAJTxIgXOKlciN.png',
    },
    group: {
      name: '工程效能',
      link: 'http://github.com/',
    },
    project: {
      name: '留言',
      link: 'http://github.com/',
    },
    messageKey: 'common:dashboard.activity.published',
  },
  {
    id: 'trend-6',
    get updatedAt() {
      return t('common:justNow')
    },
    user: {
      name: '乐哥',
      avatar: 'https://gw.alipayobjects.com/zos/rmsportal/jZUIxmJycoymBprLOUbT.png',
    },
    group: {
      name: '程序员日常',
      link: 'http://github.com/',
    },
    project: {
      name: '品牌迭代',
      link: 'http://github.com/',
    },
    messageKey: 'common:dashboard.activity.created',
  },
]

export const radarData = [
  {
    name: 'personal',
    get label() {
      return t('common:reference')
    },
    value: 10,
  },
  {
    name: 'personal',
    get label() {
      return t('common:reputation')
    },
    value: 8,
  },
  {
    name: 'personal',
    get label() {
      return t('common:output')
    },
    value: 4,
  },
  {
    name: 'personal',
    get label() {
      return t('common:contribution')
    },
    value: 5,
  },
  {
    name: 'personal',
    get label() {
      return t('common:popularity')
    },
    value: 7,
  },
  {
    name: 'team',
    get label() {
      return t('common:reference')
    },
    value: 3,
  },
  {
    name: 'team',
    get label() {
      return t('common:reputation')
    },
    value: 9,
  },
  {
    name: 'team',
    get label() {
      return t('common:output')
    },
    value: 6,
  },
  {
    name: 'team',
    get label() {
      return t('common:contribution')
    },
    value: 3,
  },
  {
    name: 'team',
    get label() {
      return t('common:popularity')
    },
    value: 1,
  },
  {
    name: 'department',
    get label() {
      return t('common:reference')
    },
    value: 4,
  },
  {
    name: 'department',
    get label() {
      return t('common:reputation')
    },
    value: 1,
  },
  {
    name: 'department',
    get label() {
      return t('common:output')
    },
    value: 6,
  },
  {
    name: 'department',
    get label() {
      return t('common:contribution')
    },
    value: 5,
  },
  {
    name: 'department',
    get label() {
      return t('common:popularity')
    },
    value: 7,
  },
]
