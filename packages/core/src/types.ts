import { Transport } from './transport'

// 插件化集成接口
export interface IIntegration {
  init(transport: Transport): void
}

export class Integration implements IIntegration {
  constructor(private callback: () => void) {}

  private transport: Transport | null = null

  init(transport: Transport): void {
    this.transport = transport
  }
}

export interface MonitoringOptions {
  dsn: string // 数据采集地址, dsn 全称 Data Source Name, 数据源名称, 用于标识数据采集地址
  integrations: Integration[] // 集成插件, 用于扩展监控功能
}
