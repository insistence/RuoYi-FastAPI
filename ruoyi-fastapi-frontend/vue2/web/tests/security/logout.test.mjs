import {
  runLogoutTests,
  runUserInfoSessionTests,
} from '../../../../../ruoyi-fastapi-test/frontend/logout-behavior.mjs'

runLogoutTests(new URL('../../', import.meta.url), 'vue2')
runUserInfoSessionTests(new URL('../../', import.meta.url), 'vue2')
