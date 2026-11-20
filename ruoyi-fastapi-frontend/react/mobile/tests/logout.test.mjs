import {
  runLogoutTests,
  runUserInfoSessionTests,
} from '../../../../ruoyi-fastapi-test/frontend/logout-behavior.mjs'

runLogoutTests(new URL('../', import.meta.url), 'react-mobile')
runUserInfoSessionTests(new URL('../', import.meta.url), 'react-mobile')
