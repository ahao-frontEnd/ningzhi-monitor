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
    // ---------- 阶段 1：升级兼容——清理老版本 base_monitor_view ----------
    // 旧版本 clickhouse.initializer 创建的 base_monitor_view 是指向 base_monitor_storage 的。
    // 新方案中 base_monitor_view 改为指向 monitor_data。
    // 为了避免两个不同定义的视图冲突，这里做一次检查：
    //   如果 base_monitor_view 已存在但它的 create_table_query 包含 'base_monitor_storage'，
    //   说明是老版本，先 DROP 掉，让下面的 CREATE ... IF NOT EXISTS 重建。
    try {
      const checkView = await this.clickHouseClient.query({
        query: `
          SELECT count() AS cnt
          FROM system.tables
          WHERE name = 'base_monitor_view'
            AND database = currentDatabase()
            AND create_table_query LIKE '%base_monitor_storage%'
        `,
      })
      // @clickhouse/client 的 json<T>() 返回 QueryResult<T>，即 { data: T[]; ... }
      // 所以泛型 T 是数组元素的类型，而不是整个响应
      const checkJson = await checkView.json<{ cnt: string | number }>()
      const oldViewExists = Number(checkJson.data?.[0]?.cnt ?? 0) > 0
      if (oldViewExists) {
        this.logger.log('Detected legacy base_monitor_view (pointing to base_monitor_storage), dropping it for migration')
        await this.clickHouseClient.command({ query: 'DROP TABLE IF EXISTS base_monitor_view' })
      }
    } catch (e) {
      this.logger.warn(`Check legacy base_monitor_view skipped: ${(e as Error).message}`)
    }

    // ---------- 阶段 2：按依赖顺序幂等建表 / 视图 ----------
    // 注意：@clickhouse/client 的 command 一次执行一条 SQL，所以逐条跑。
    // 顺序有依赖：base_monitor_storage → kafka_monitor → monitor_data → kafka_to_monitor_data → base_monitor_view
    const statements: string[] = [
      // 2.0 兜底存储表（direct / both 模式下写入此表，结构与 monitor_data 一致）
      //     如果 base_monitor_storage 不存在，WRITE_MODE=both 时 direct write 会抛 UNKNOWN_TABLE
      `CREATE TABLE IF NOT EXISTS base_monitor_storage (
          app_id     String,
          event_type String,
          message    String,
          info       JSON
      ) ENGINE = MergeTree()
      ORDER BY tuple()`,

      // 2.1 Kafka 引擎表（消费者，虚拟表，不存储数据）
      //     注意：ClickHouse 运行在 Docker 容器内，必须用 Kafka 容器的服务名（PLAINTEXT listener），
      //     而不是 localhost:9094（那是宿主机视角的 EXTERNAL listener，容器内访问不到）。
      //     kafkajs 在宿主机上运行，用 localhost:9094；ClickHouse 在容器内，用 ningzhi-monitor-kafka:9092。
      //
      //     ⚠️ Kafka 4.x 已知问题（KIP-848）：
      //     Kafka 4.x 的新 group coordinator 不会自动创建 __consumer_offsets topic，
      //     导致 ClickHouse 的 librdkafka 消费者收到 COORDINATOR_NOT_AVAILABLE 错误。
      //     首次部署时需要手动执行一次（Kafka 容器内）：
      //       kafka-topics.sh --bootstrap-server localhost:9094 --create \
      //         --topic __consumer_offsets --partitions 50 --replication-factor 1 \
      //         --config cleanup.policy=compact
      //     后续 Kafka 重启不需要重复执行（数据持久化），仅容器删除重建时需要。
      `CREATE TABLE IF NOT EXISTS kafka_monitor (
          app_id     String,
          event_type String,
          message    String,
          info       JSON
      ) ENGINE = Kafka
        SETTINGS
          kafka_broker_list = 'ningzhi-monitor-kafka:9092',
          kafka_topic_list = 'monitor',
          kafka_group_name = 'monitor-ch',
          kafka_format = 'JSONEachRow',
          kafka_num_consumers = 1,
          kafka_handle_error_mode = 'stream'`,

      // 2.2 真实存储表（字段结构与原 base_monitor_storage 一致）
      `CREATE TABLE IF NOT EXISTS monitor_data (
          app_id     String,
          event_type String,
          message    String,
          info       JSON
      ) ENGINE = MergeTree()
      ORDER BY tuple()`,

      // 2.3 Kafka → monitor_data 管道（物化视图自动同步）
      `CREATE MATERIALIZED VIEW IF NOT EXISTS kafka_to_monitor_data
      TO monitor_data
      AS
      SELECT
          app_id,
          event_type,
          message,
          info
      FROM kafka_monitor`,

      // 2.4 查询层视图（指向 monitor_data，追加 processed_message）
      //     阶段 1 已清理了指向 base_monitor_storage 的旧视图，这里会以新定义重建。
      //     不使用 POPULATE：物化视图本身会在新数据写入时自动触发，不需要回填历史。
      `CREATE MATERIALIZED VIEW IF NOT EXISTS base_monitor_view
      ENGINE = MergeTree()
      ORDER BY tuple()
      AS
      SELECT
          app_id,
          event_type,
          message,
          info,
          concat('Ningzhi ==> ', event_type) AS processed_message
      FROM
          monitor_data`,
    ]

    try {
      for (const stmt of statements) {
        await this.clickHouseClient.command({ query: stmt })
      }
      this.logger.log('ClickHouse schema initialized successfully (kafka + monitor_data + views)')
    } catch (error) {
      this.logger.error(`Failed to initialize ClickHouse schema: ${(error as Error).message || String(error)}`)
      throw error
    }
  }
}
