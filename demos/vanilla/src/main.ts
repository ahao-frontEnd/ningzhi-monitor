import './style.css'

import { init } from '@ningzhi/monitor-sdk-browser'

// import { captureMessage } from '@ningzhi/monitor-sdk-core'
import viteLogo from '/vite.svg'

import { setupCounter } from './counter.ts'
import typescriptLogo from './typescript.svg'

init({
  dsn: 'http://localhost:8080/api/tracing/reactekgfT7',
  integrations: [],
})

// 模拟变量定义错误
// myFunc

// 模拟接口调用错误
Promise.reject(new Error('接口调用错误'))

// for (let i = 0; i < 100000; i++) {
//     console.log('i', i)
// }
// captureMessage('hello world')

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Vite + TypeScript</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite and TypeScript logos to learn more
    </p>
  </div>
`

setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)
