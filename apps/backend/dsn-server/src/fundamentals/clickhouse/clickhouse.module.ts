import { createClient } from '@clickhouse/client'
import { DynamicModule, Global, Module } from '@nestjs/common'

import { KafkaProducerService } from '../kafka/kafka.producer.service'
import { ClickhouseInitializer } from './clickhouse.initializer'

@Global()
@Module({})
export class ClickhouseModule {
  static forRoot(options: { url: string; username: string; password: string }): DynamicModule {
    return {
      module: ClickhouseModule,
      providers: [
        {
          provide: 'CLICKHOUSE_CLIENT',
          useFactory: () => {
            // 创建 ClickHouse 客户端， 确保只初始化一次
            return createClient(options)
          },
        },
        // NestJS 发现 providers 中有 这个逻辑 ，实例化它（注入 CLICKHOUSE_CLIENT ）
        // 实现 OnModuleInit 接口， 用于在模块初始化完成后执行一些操作
        ClickhouseInitializer,
        // Kafka 生产者服务，全局可用，SpanService 直接注入即可
        KafkaProducerService,
      ],
      exports: ['CLICKHOUSE_CLIENT', KafkaProducerService],
    }
  }
}
