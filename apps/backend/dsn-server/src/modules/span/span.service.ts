import { ClickHouseClient } from '@clickhouse/client'
import { Inject, Injectable, Logger } from '@nestjs/common'

import { TrackingParams } from './span.controller'

@Injectable()
export class SpanService {
  constructor(@Inject('CLICKHOUSE_CLIENT') private clickHouseClient: ClickHouseClient) {}

  getSpan() {
    return '1.0.0'
  }

  async tracking(app_id: string, params: TrackingParams) {
    const { event_type, message, ...rest } = params
    const values = {
      app_id,
      event_type,
      message,
      info: rest,
    }
    const res = await this.clickHouseClient.insert({
      table: 'base_monitor_storage',
      values,
      columns: ['app_id', 'event_type', 'message', 'info'],
      format: 'JSONEachRow',
    })
    Logger.log('Query result', JSON.stringify(res.summary))
  }

  // 查询数据
  async span() {
    const query = `
        SELECT * FROM base_monitor_view
    `
    const res = await this.clickHouseClient.query({ query })
    const queryResult = await res.json()
    return queryResult.data
  }

  async bugs() {
    const query = `
            SELECT * FROM base_monitor_view
            WHERE event_type = 'error'
        `
    const res = await this.clickHouseClient.query({
      query,
    })
    const queryResult = await res.json()
    return queryResult.data
  }
}
