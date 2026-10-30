<template>
  <div>
    <div class="page-header-content">
      <div class="avatar">
        <a-avatar
          size="large"
          :src="currentUser.avatar"
        />
      </div>
      <div class="content">
        <div class="content-title">
          {{ $t('layout:dashboard.greeting', { name: currentUser.name })
          }}<span class="welcome-text">{{ $t('layout:home.haveAWonderfulDay') }}</span>
        </div>
        <div>{{ currentUser.title }} |{{ currentUser.group }}</div>
      </div>
      <div class="extra-content">
        <div class="stat-item">
          <a-statistic
            :title="$t('layout:home.projects')"
            :value="56"
          />
        </div>
        <div class="stat-item">
          <a-statistic
            :title="$t('layout:home.teamRanking')"
            :value="8"
            suffix="/ 24"
          />
        </div>
        <div class="stat-item">
          <a-statistic
            :title="$t('layout:home.projectVisits')"
            :value="2223"
          />
        </div>
      </div>
    </div>

    <div>
      <a-row :gutter="24">
        <a-col
          :xl="16"
          :lg="24"
          :md="24"
          :sm="24"
          :xs="24"
        >
          <a-card
            class="project-list"
            :loading="loading"
            style="margin-bottom: 24px"
            :bordered="false"
            :title="$t('layout:home.projectsInProgress')"
            :body-style="{ padding: 0 }"
          >
            <a slot="extra">{{ $t('layout:home.allProjects') }}</a>
            <div>
              <a-card-grid
                class="project-card-grid"
                :key="i"
                v-for="(item, i) in projects"
              >
                <a-card
                  :bordered="false"
                  :body-style="{ padding: 0 }"
                >
                  <a-card-meta>
                    <div
                      slot="title"
                      class="card-title"
                    >
                      <a-avatar
                        size="small"
                        :src="item.logo"
                      />
                      <a>{{ item.title }}</a>
                    </div>
                    <div
                      slot="description"
                      class="card-description"
                    >
                      {{ item.description }}
                    </div>
                  </a-card-meta>
                  <div class="project-item">
                    <a href="/#/">{{ item.member || '' }}</a>
                    <span class="datetime">{{ item.updatedAt }}</span>
                  </div>
                </a-card>
              </a-card-grid>
            </div>
          </a-card>

          <a-card
            :loading="loading"
            :title="$t('layout:home.activity')"
            :bordered="false"
          >
            <a-list>
              <a-list-item
                :key="index"
                v-for="(item, index) in activities"
              >
                <a-list-item-meta>
                  <a-avatar
                    slot="avatar"
                    size="small"
                    :src="item.user.avatar"
                  />
                  <div slot="title">
                    <span>{{ item.user.name }}</span
                    >&nbsp; {{ item.template1 }}&nbsp;<a href="#">{{
                      item.group && item.group.name
                    }}</a
                    >&nbsp; <span>{{ item.template2 }}</span
                    >&nbsp;
                    <a :href="item.project && item.project.link">{{
                      item.project && item.project.name
                    }}</a>
                  </div>
                  <div slot="description">{{ item.updatedAt }}</div>
                </a-list-item-meta>
              </a-list-item>
            </a-list>
          </a-card>
        </a-col>
        <a-col
          style="padding: 0 12px"
          :xl="8"
          :lg="24"
          :md="24"
          :sm="24"
          :xs="24"
        >
          <a-card
            :title="$t('layout:home.quickStartShortcuts')"
            style="margin-bottom: 24px"
            :bordered="false"
            :body-style="{ padding: 0 }"
          >
            <div class="item-group">
              <a>{{ $t('layout:home.action1') }}</a>
              <a>{{ $t('layout:home.action2') }}</a>
              <a>{{ $t('layout:home.action3') }}</a>
              <a>{{ $t('layout:home.action4') }}</a>
              <a>{{ $t('layout:home.action5') }}</a>
              <a>{{ $t('layout:home.action6') }}</a>
              <a-button
                size="small"
                type="primary"
                ghost
                icon="plus"
                >{{ $t('layout:home.add') }}</a-button
              >
            </div>
          </a-card>
          <a-card
            :title="$t('layout:home.xXIndex')"
            style="margin-bottom: 24px"
            :loading="radarLoading"
            :bordered="false"
            :body-style="{ padding: 0 }"
          >
            <div style="min-height: 400px">
              <radar :data="radarData" />
            </div>
          </a-card>
          <a-card
            :loading="loading"
            :title="$t('common:team')"
            :bordered="false"
          >
            <div class="members">
              <a-row>
                <a-col
                  :span="12"
                  v-for="(item, index) in projects"
                  :key="index"
                >
                  <a>
                    <a-avatar
                      size="small"
                      :src="item.logo"
                    />
                    <span class="member">{{ item.member }}</span>
                  </a>
                </a-col>
              </a-row>
            </div>
          </a-card>
        </a-col>
      </a-row>
    </div>
  </div>
</template>

<script>
import Radar from './Radar.vue'
import { t } from '@/i18n/adapter'
import { Avatar, Button, Card, Col, List, Row, Statistic } from 'ant-design-vue'
import 'ant-design-vue/dist/antd.css'
import Vue from 'vue'

Vue.component(Avatar.name, Avatar)
Vue.component(Button.name, Button)
Vue.component(Card.name, Card)
Vue.component(Card.Grid.name, Card.Grid)
Vue.component(Card.Meta.name, Card.Meta)
Vue.component(Col.name, Col)
Vue.component(List.name, List)
Vue.component(List.Item.name, List.Item)
Vue.component(List.Item.Meta.name, List.Item.Meta)
Vue.component(Row.name, Row)
Vue.component(Statistic.name, Statistic)

export default {
  name: 'DashBoard',
  components: {
    Radar,
  },
  data() {
    return {
      currentUser: {
        avatar: 'https://gw.alipayobjects.com/zos/rmsportal/BiazfanxmamNRoxxVxka.png',
        name: '吴彦祖',
        userid: '00000001',
        email: 'antdesign@alipay.com',
        signature: '海纳百川，有容乃大',
        title: '交互专家',
        group: '蚂蚁金服－某某某事业群－某某平台部－某某技术部－UED',
      },
      projects: [
        {
          id: 'xxx1',
          title: 'Alipay',
          logo: 'https://gw.alipayobjects.com/zos/rmsportal/WdGqmHpayyMjiEhcKoVE.png',
          description: '那是一种内在的东西，他们到达不了，也无法触及的',
          get updatedAt() {
            return t('layout:dashboard.secondsAgo')
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
            return t('layout:dashboard.yearsAgo', { count: 6 })
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
            return t('layout:dashboard.secondsAgo')
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
            return t('layout:dashboard.yearsAgo', { count: 6 })
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
            return t('layout:dashboard.yearsAgo', { count: 6 })
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
            return t('layout:dashboard.yearsAgo', { count: 6 })
          },
          member: '骗你来学计算机',
          href: '',
          memberLink: '',
        },
      ],
      activities: [
        {
          id: 'trend-1',
          get updatedAt() {
            return t('layout:dashboard.secondsAgo')
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
          template1: '在',
          template2: '新建项目',
        },
        {
          id: 'trend-2',
          get updatedAt() {
            return t('layout:dashboard.secondsAgo')
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
          template1: '在',
          template2: '新建项目',
        },
        {
          id: 'trend-3',
          get updatedAt() {
            return t('layout:dashboard.secondsAgo')
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
          template1: '在',
          template2: '新建项目',
        },
        {
          id: 'trend-4',
          get updatedAt() {
            return t('layout:dashboard.secondsAgo')
          },
          user: {
            name: '周星星',
            avatar: 'https://gw.alipayobjects.com/zos/rmsportal/WhxKECPNujWoWEFNdnJE.png',
          },
          group: {
            name: '5 月日常迭代',
            link: 'http://github.com/',
          },
          template1: '将',
          template2: '更新至已发布状态',
        },
        {
          id: 'trend-5',
          get updatedAt() {
            return t('layout:dashboard.secondsAgo')
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
          template1: '在',
          template2: '发布了',
        },
        {
          id: 'trend-6',
          get updatedAt() {
            return t('layout:dashboard.secondsAgo')
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
          template1: '在',
          template2: '新建项目',
        },
      ],
      radarData: [
        {
          get item() {
            return t('layout:dashboard.citations')
          },
          get user() {
            return t('layout:dashboard.individual')
          },
          score: 70,
        },
        {
          get item() {
            return t('layout:dashboard.citations')
          },
          get user() {
            return t('layout:dashboard.team')
          },
          score: 30,
        },
        {
          get item() {
            return t('layout:dashboard.citations')
          },
          get user() {
            return t('layout:dashboard.department')
          },
          score: 40,
        },
        {
          get item() {
            return t('layout:dashboard.reputation')
          },
          get user() {
            return t('layout:dashboard.individual')
          },
          score: 60,
        },
        {
          get item() {
            return t('layout:dashboard.reputation')
          },
          get user() {
            return t('layout:dashboard.team')
          },
          score: 70,
        },
        {
          get item() {
            return t('layout:dashboard.reputation')
          },
          get user() {
            return t('layout:dashboard.department')
          },
          score: 40,
        },
        {
          get item() {
            return t('layout:dashboard.output')
          },
          get user() {
            return t('layout:dashboard.individual')
          },
          score: 50,
        },
        {
          get item() {
            return t('layout:dashboard.output')
          },
          get user() {
            return t('layout:dashboard.team')
          },
          score: 60,
        },
        {
          get item() {
            return t('layout:dashboard.output')
          },
          get user() {
            return t('layout:dashboard.department')
          },
          score: 40,
        },
        {
          get item() {
            return t('layout:dashboard.contribution')
          },
          get user() {
            return t('layout:dashboard.individual')
          },
          score: 40,
        },
        {
          get item() {
            return t('layout:dashboard.contribution')
          },
          get user() {
            return t('layout:dashboard.team')
          },
          score: 50,
        },
        {
          get item() {
            return t('layout:dashboard.contribution')
          },
          get user() {
            return t('layout:dashboard.department')
          },
          score: 40,
        },
        {
          get item() {
            return t('layout:dashboard.popularity')
          },
          get user() {
            return t('layout:dashboard.individual')
          },
          score: 60,
        },
        {
          get item() {
            return t('layout:dashboard.popularity')
          },
          get user() {
            return t('layout:dashboard.team')
          },
          score: 70,
        },
        {
          get item() {
            return t('layout:dashboard.popularity')
          },
          get user() {
            return t('layout:dashboard.department')
          },
          score: 40,
        },
        {
          get item() {
            return t('layout:dashboard.citations')
          },
          get user() {
            return t('layout:dashboard.individual')
          },
          score: 70,
        },
        {
          get item() {
            return t('layout:dashboard.citations')
          },
          get user() {
            return t('layout:dashboard.team')
          },
          score: 50,
        },
        {
          get item() {
            return t('layout:dashboard.citations')
          },
          get user() {
            return t('layout:dashboard.department')
          },
          score: 40,
        },
      ],
      loading: true,
      radarLoading: true,
    }
  },
  mounted() {
    setTimeout(() => {
      this.loading = false
      this.radarLoading = false
    }, 1000)
  },
}
</script>

<style lang="less" scoped>
@import './Workplace.less';

.project-list {
  .card-title {
    font-size: 0;

    a {
      color: rgba(0, 0, 0, 0.85);
      margin-left: 12px;
      line-height: 24px;
      height: 24px;
      display: inline-block;
      vertical-align: top;
      font-size: 14px;

      &:hover {
        color: #1890ff;
      }
    }
  }

  .card-description {
    color: rgba(0, 0, 0, 0.45);
    height: 44px;
    line-height: 22px;
    overflow: hidden;
  }

  .project-item {
    display: flex;
    margin-top: 8px;
    overflow: hidden;
    font-size: 12px;
    height: 20px;
    line-height: 20px;

    a {
      color: rgba(0, 0, 0, 0.45);
      display: inline-block;
      flex: 1 1 0;

      &:hover {
        color: #1890ff;
      }
    }

    .datetime {
      color: rgba(0, 0, 0, 0.25);
      flex: 0 0 auto;
      float: right;
    }
  }

  .ant-card-meta-description {
    color: rgba(0, 0, 0, 0.45);
    height: 44px;
    line-height: 22px;
    overflow: hidden;
  }
}

.item-group {
  padding: 20px 0 8px 24px;
  font-size: 0;

  a {
    color: rgba(0, 0, 0, 0.65);
    display: inline-block;
    font-size: 14px;
    margin-bottom: 13px;
    width: 25%;
  }
}

.members {
  a {
    display: block;
    margin: 12px 0;
    line-height: 24px;
    height: 24px;

    .member {
      font-size: 14px;
      color: rgba(0, 0, 0, 0.65);
      line-height: 24px;
      max-width: 100px;
      vertical-align: top;
      margin-left: 12px;
      transition: all 0.3s;
      display: inline-block;
    }

    &:hover {
      span {
        color: #1890ff;
      }
    }
  }
}

.mobile {
  .project-list {
    .project-card-grid {
      width: 100%;
    }
  }

  .more-info {
    border: 0;
    padding-top: 16px;
    margin: 16px 0 16px;
  }

  .headerContent .title .welcome-text {
    display: none;
  }
}
</style>
