import { ClickHouseClient } from '@clickhouse/client'
import { Inject, Injectable, Logger } from '@nestjs/common'

import { KafkaProducerService } from '../../fundamentals/kafka/kafka.producer.service'
import { TrackingParams } from './span.controller'

@Injectable()
export class SpanService {
  constructor(
    @Inject('CLICKHOUSE_CLIENT') private clickHouseClient: ClickHouseClient,
    private readonly kafkaProducer: KafkaProducerService
  ) {}

  getSpan() {
    return '1.0.0'
  }

  /**
   * 写入 tracking 数据。
   * 写模式由 KafkaProducerService.writeMode 决定（环境变量 WRITE_MODE）：
   *   kafka  : 仅发送到 topic=monitor，由 ClickHouse Kafka 引擎异步落盘到 monitor_data
   *   direct : 直接写入 base_monitor_storage（等价原有行为，兜底/回滚用）
   *   both   : 双写，用于灰度期间比对两条链路一致性
   */
  async tracking(app_id: string, params: TrackingParams) {
    const { event_type, message, ...rest } = params
    const payload = {
      app_id,
      event_type,
      message: message ?? '',
      info: rest as Record<string, any>,
    }

    const mode = this.kafkaProducer.writeMode

    // --- 直写 CK（direct 模式 / both 模式下兜底写入 base_monitor_storage） ---
    if (mode === 'direct' || mode === 'both') {
      const res = await this.clickHouseClient.insert({
        table: 'base_monitor_storage',
        values: payload,
        columns: ['app_id', 'event_type', 'message', 'info'],
        format: 'JSONEachRow',
      })
      Logger.log(`[direct] Insert result: ${JSON.stringify(res.summary)}`)
    }

    // --- 写 Kafka（kafka 模式 / both 模式） ---
    if (mode === 'kafka' || mode === 'both') {
      try {
        await this.kafkaProducer.sendTracking(payload)
      } catch (e) {
        // kafka 模式下发送失败必须向上抛，让接口返回 5xx，避免静默数据丢失
        // both 模式下 Kafka 失败但 direct 已写入，则仅记录错误日志，不影响接口响应
        if (mode === 'kafka') throw e
        Logger.error(`[both] Kafka send failed, but direct write succeeded: ${(e as Error).message}`)
      }
    }
  }

  // 查询数据：同时查询 base_monitor_view（Kafka 管道落盘）和 base_monitor_storage（direct 写入兜底）
  // 两层写入互不影响，UNION ALL 保证任何路径的数据都能被查到
  async span() {
    const query = `
        SELECT
            app_id,
            event_type,
            message,
            info,
            concat('Ningzhi ==> ', event_type) AS processed_message
        FROM base_monitor_storage
        UNION ALL
        SELECT * FROM base_monitor_view
    `
    const res = await this.clickHouseClient.query({ query })
    const queryResult = await res.json()
    return queryResult.data
  }

  async bugs() {
    const query = `
        SELECT * FROM (
            SELECT
                app_id,
                event_type,
                message,
                info,
                concat('Ningzhi ==> ', event_type) AS processed_message
            FROM base_monitor_storage
            WHERE event_type = 'error'
            UNION ALL
            SELECT * FROM base_monitor_view
            WHERE event_type = 'error'
        )
    `
    const res = await this.clickHouseClient.query({
      query,
    })
    const queryResult = await res.json()
    return queryResult.data
  }
}
