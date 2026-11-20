import { testMobileBehavior } from '../../../../ruoyi-fastapi-test/frontend/mobile-behavior.mjs'
import { runUserInfoSessionTests } from '../../../../ruoyi-fastapi-test/frontend/logout-behavior.mjs'

testMobileBehavior(new URL('../', import.meta.url), 'vue2')
runUserInfoSessionTests(new URL('../', import.meta.url), 'vue2-mobile')
