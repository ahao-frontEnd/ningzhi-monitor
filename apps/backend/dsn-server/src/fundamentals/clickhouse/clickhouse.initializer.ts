import { ClickHouseClient } from '@clickhouse/client'
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'

@Injectable()
export class ClickhouseInitializer implements OnModuleInit {
  private readonly logger = new Logger('ClickhouseInitializer')

  constructor(@Inject('CLICKHOUSE_CLIENT') private readonly clickHouseClient: ClickHouseClient) {}

  async onModuleInit() {
    await this.ensureSchema()
  }

  private async ensureSchema() {
    // 使用 IF NOT EXISTS 保证幂等：表/视图已存在时跳过，不存在时创建
    // 注意：@clickhouse/client 的 command 一次只能执行一条语句，所以拆成数组逐条执行
    const statements = [
      `CREATE TABLE IF NOT EXISTS base_monitor_storage (
          event_type String,
          message String,
          app_id String,
          info JSON
      ) ENGINE = MergeTree()
      ORDER BY tuple()`,
      `CREATE MATERIALIZED VIEW IF NOT EXISTS base_monitor_view
      ENGINE = MergeTree()
      ORDER BY tuple()
      AS
      SELECT
          event_type,
          message,
          app_id,
          info,
          concat('Ningzhi ==> ', event_type) AS processed_message
      FROM
          base_monitor_storage`,
    ]
    try {
      for (const stmt of statements) {
        await this.clickHouseClient.command({ query: stmt })
      }
      this.logger.log('ClickHouse schema initialized successfully')
    } catch (error) {
      this.logger.error(`Failed to initialize ClickHouse schema: ${(error as Error).message || error.toString()}`)
      throw error
    }
  }
}
