import { Transport } from './transport'
import { MonitoringOptions } from './types'

// 基础监控客户端
// 用于初始化监控客户端, 并绑定传输层, 初始化集成插件
export class Monitoring {
  private transport: Transport | null = null
  constructor(private options: MonitoringOptions) {}

  init(transport: Transport): void {
    this.transport = transport
    this.options.integrations.forEach(integration => {
      integration.init(transport) // 初始化集成插件
    })
  }

  reportMessage(message: string): void {
    this.transport?.send({ type: 'message', message })
  }

  reportEvent(event: string): void {
    this.transport?.send({ type: 'event', event })
  }
}
