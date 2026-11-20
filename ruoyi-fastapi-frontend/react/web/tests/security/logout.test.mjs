import {
  runLogoutTests,
  runUserInfoSessionTests,
} from '../../../../../ruoyi-fastapi-test/frontend/logout-behavior.mjs'

runLogoutTests(new URL('../../', import.meta.url), 'react-web')
runUserInfoSessionTests(new URL('../../', import.meta.url), 'react-web')
