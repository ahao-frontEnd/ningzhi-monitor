export { browserTracingIntegration } from './tracing/browserTracingIntegration'

import { Metrics } from '@ningzhi/monitor-sdk-browser-utils'
import { Integration, Monitoring } from '@ningzhi/monitor-sdk-core'

import { Errors } from './tracing/errorsIntegration'
import { BrowserTransport } from './transport'

export function init(options: { dsn: string; integrations?: Integration[] }) {
  // 初始化监控
  const monitoring = new Monitoring({
    dsn: options.dsn,
    integrations: options.integrations || [],
  })

  const transport = new BrowserTransport(options.dsn) // 创建浏览器传输协议
  monitoring.init(transport) // 初始化监控

  new Errors(transport).init()
  new Metrics(transport).init()

  return monitoring
}

/**
 * 使用示例：
 *
 * import { init, Errors, Metrics } from '@ningzhi/monitor-sdk-browser'
 *
 * const monitoring = init({
 *    dsn: 'http://localhost:8080/api/v1/monitoring/reactRqL9vG',
 *   integrations: [new Errors(), new Metrics()],
 * })
 */
