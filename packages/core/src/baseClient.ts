import { Transport } from './transport'
import { MonitoringOptions } from './types'

export let getTransport: () => Transport | null = () => null

// 基础监控客户端
// 用于初始化监控客户端, 并绑定传输层, 初始化集成插件
export class Monitoring {
  private transport: Transport | null = null

  constructor(private options: MonitoringOptions) {}

  init(transport: Transport): void {
    // 初始化传输层
    this.transport = transport
    // 初始化获取传输层的函数
    // 用于在其他模块中获取传输层
    getTransport = () => transport
    // 初始化集成插件
    this.options.integrations?.forEach(integration => {
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
