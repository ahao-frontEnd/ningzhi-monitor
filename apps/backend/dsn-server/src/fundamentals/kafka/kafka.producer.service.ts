import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Kafka, Producer, ProducerRecord } from 'kafkajs'

/**
 * 写模式（通过环境变量 WRITE_MODE 控制，默认 kafka）
 *   kafka  : 仅写 Kafka，由 ClickHouse Kafka 引擎表异步落盘 → monitor_data
 *   direct : 仅直写 ClickHouse base_monitor_storage（兜底/兼容模式，等价老行为）
 *   both   : 双写，便于比对数据一致性（灰度验证用，生产建议 kafka 或 direct 二选一）
 */
export type WriteMode = 'kafka' | 'direct' | 'both'

export interface TrackingMessage {
  app_id: string
  event_type: string
  message: string
  info: Record<string, any>
}

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('KafkaProducer')
  private readonly kafka: Kafka
  private producer: Producer | null = null

  constructor() {
    this.kafka = new Kafka({
      clientId: 'ningzhi-monitor-dsn',
      brokers: [process.env.KAFKA_BROKERS || 'ningzhi-monitor-kafka:9092'],
    })
  }

  get writeMode(): WriteMode {
    const raw = (process.env.WRITE_MODE || 'kafka').toLowerCase()
    if (raw === 'direct' || raw === 'both' || raw === 'kafka') return raw
    return 'kafka'
  }

  async onModuleInit() {
    if (this.writeMode === 'direct') {
      this.logger.log('WRITE_MODE=direct, Kafka producer will not connect')
      return
    }
    try {
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: true,
        idempotent: true, // 幂等生产者，避免重试导致重复消息
      })
      await this.producer.connect()
      this.logger.log(`Kafka producer connected (brokers=${process.env.KAFKA_BROKERS || 'ningzhi-monitor-kafka:9092'})`)
    } catch (e) {
      this.logger.error(`Kafka producer connect failed: ${(e as Error).message}`)
      // 写模式为 kafka 时必须可连接，否则直接抛出阻断启动；写模式为 both 时仅 warn 即可
      if (this.writeMode === 'kafka') throw e
    }
  }

  async onModuleDestroy() {
    if (this.producer) {
      try {
        await this.producer.disconnect()
        this.logger.log('Kafka producer disconnected')
      } catch (e) {
        this.logger.warn(`Kafka producer disconnect error: ${(e as Error).message}`)
      }
    }
  }

  /**
   * 发送一条 tracking 消息到 topic=monitor
   * value 格式严格对齐 ClickHouse kafka_monitor 表（JSONEachRow）的四个字段。
   */
  async sendTracking(msg: TrackingMessage): Promise<void> {
    if (!this.producer) {
      if (this.writeMode === 'direct') return // direct 模式，直接跳过
      throw new Error('Kafka producer is not connected')
    }
    const record: ProducerRecord = {
      topic: 'monitor',
      messages: [
        {
          // key 使用 app_id，同 app 的消息进同一 partition，保证同 app 消息有序
          key: msg.app_id,
          value: JSON.stringify({
            app_id: msg.app_id,
            event_type: msg.event_type,
            message: msg.message ?? '',
            info: msg.info ?? {},
          }),
        },
      ],
    }
    try {
      await this.producer.send(record)
    } catch (e) {
      this.logger.error(`Kafka send failed (app_id=${msg.app_id}, event_type=${msg.event_type}): ${(e as Error).message}`)
      throw e
    }
  }
}
