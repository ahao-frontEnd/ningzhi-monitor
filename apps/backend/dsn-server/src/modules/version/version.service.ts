import { ClickHouseClient } from '@clickhouse/client'
import { Inject, Injectable, Logger } from '@nestjs/common'

@Injectable()
export class VersionService {
  constructor(@Inject('CLICKHOUSE_CLIENT') private clickhouseClient: ClickHouseClient) {}

  getVersion() {
    return '1.0.0'
  }

  async tracking(params: { key: string; value: string }): Promise<any> {
    const res = await this.clickhouseClient.insert({
      table: 'monitor_data',
      values: params, // 插入的参数
      columns: ['key1', 'value1'], // 插入的列名
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
    const query = `SELECT * FROM default.monitor_data WHERE key1 = 'name'`
    const res = await this.clickhouseClient.query({ query })
    const result = await res.json()
    Logger.log('Query result 123... ', JSON.stringify(result, null, 2))
    return result.data
  }
}
