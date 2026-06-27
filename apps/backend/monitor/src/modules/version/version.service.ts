import { ClickHouseClient } from '@clickhouse/client'
import { Inject, Injectable, Logger } from '@nestjs/common'

@Injectable()
export class VersionService {
  constructor(@Inject('CLICKHOUSE_CLIENT') private clickhouseClient: ClickHouseClient) {}

  getVersion() {
    return '1.0.0'
  }

  async tracking(params: { event_type: string; message: string }): Promise<any> {
    const res = await this.clickhouseClient.insert({
      table: 'base_monitor_storage',
      values: params, // 插入的参数
      columns: ['event_type', 'message'], // 插入的列名
      format: 'JSONEachRow', // 每行一个 JSON 对象
    })
    Logger.log('Query Result ', JSON.stringify(res.summary))
    return { summary: res.summary, params }
  }

  async span(): Promise<any> {
    // 从物化表中查
    // const query = `
    //             SELECT *
    // FROM kafka_to_monitor_data

    // 从最终的 ClickHouse 表中查
    const query = `SELECT * FROM base_monitor_view`
    const res = await this.clickhouseClient.query({ query })
    const queryResult = await res.json()
    Logger.log('Query queryResult ', JSON.stringify(queryResult, null, 2))
    return queryResult.data
  }
}
