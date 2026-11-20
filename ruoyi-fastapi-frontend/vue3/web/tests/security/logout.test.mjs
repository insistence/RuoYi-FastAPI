import {
  runLogoutTests,
  runUserInfoSessionTests,
} from '../../../../../ruoyi-fastapi-test/frontend/logout-behavior.mjs'

runLogoutTests(new URL('../../', import.meta.url), 'vue3')
runUserInfoSessionTests(new URL('../../', import.meta.url), 'vue3')
