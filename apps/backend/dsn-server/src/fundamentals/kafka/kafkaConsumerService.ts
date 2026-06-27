import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Client, ClientKafka, Transport } from '@nestjs/microservices'

@Injectable()
export class KafkaConsumerService implements OnModuleInit {
  constructor() {}

  async onModuleInit() {
    this.kafkaClient.subscribeToResponseOf('tracking') // 订阅 tracking 主题， 意思就是监听 tracking 主题的所有消息
    this.kafkaClient.bindTopics() // 绑定 tracking 主题， 用于监听 tracking 主题的所有消息
  }

  // kafka 作为一个微服务， 用于监听 tracking 主题的消息， 并将消息写入 ClickHouse
  // 定义 Kafka 客户端， 用于连接 Kafka 服务器， 并订阅 tracking 主题
  @Client({
    transport: Transport.KAFKA, // 使用 Kafka 传输协议, 用于连接 Kafka 服务器
    options: {
      client: {
        clientId: 'ningzhi-monitor',
        brokers: ['localhost:9092'], // Kafka 服务器地址
      },
      // 消费者配置
      consumer: {
        groupId: 'ningzhi-consumer',
      },
    },
  })
  private kafkaClient: ClientKafka // Kafka 客户端实例

  // 消费 tracking 主题的消息
  async consumeMessages() {
    await this.kafkaClient.connect()
    // 订阅 tracking 主题， 意思就是监听 tracking 主题的所有消息
    //  this.kafkaClient.send('tracking', {}) 是发送一个空消息到 tracking 主题， 用于触发订阅
    this.kafkaClient.send('tracking', {}).subscribe({
      // 当收到消息时调用，next 回调函数，message 是 Kafka 消息对象，包含 topic、partition、offset、value 等信息
      next: async message => {
        const payload = message.value // 获取 Kafka 消息的内容
        // 这里可以调用将消息写入 ClickHouse 的逻辑
        await this.writeToClickHouse(payload)
      },
      error: err => {
        Logger.error('Error while consuming message', err)
      },
    })
  }

  async writeToClickHouse(payload: any) {
    Logger.log('Writing to ClickHouse', JSON.stringify(payload))
    // 这里将数据写入到 ClickHouse
  }
}
