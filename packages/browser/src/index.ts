export { browserTracingIntegration } from './tracing/browserTracingIntegration'

import { Integration, Monitoring } from '@ningzhi/monitor-sdk-core'

import { BrowserTransport } from './transport'
export { Metrics } from '@ningzhi/monitor-sdk-browser-utils'
export { Errors } from './tracing/errorsIntegration'

export function init(options: { dsn: string; integrations: Integration[] }) {
  // 初始化监控
  const monitoring = new Monitoring({
    dsn: options.dsn,
    integrations: options.integrations,
  })

  const transport = new BrowserTransport(options.dsn) // 创建浏览器传输协议
  monitoring.init(transport) // 初始化监控

  return monitoring
}

/**
 * 使用示例：
 *
 * import { init, Errors, Metrics } from '@ningzhi/monitor-sdk-browser'
 *
 * const monitoring = init({
 *    dsn: 'http://localhost:3000',
 *   integrations: [new Errors(), new Metrics()],
 * })
 */
