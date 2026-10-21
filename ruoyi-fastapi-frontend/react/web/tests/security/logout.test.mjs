import { runLogoutTests } from '../../../../../ruoyi-fastapi-test/frontend/logout-behavior.mjs'

runLogoutTests(new URL('../../', import.meta.url), 'react-web')
