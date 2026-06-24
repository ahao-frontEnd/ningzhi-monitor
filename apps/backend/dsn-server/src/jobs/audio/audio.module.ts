/**
 * AudioModule - 音频任务处理模块
 *
 * 这个模块负责管理音频相关的后台任务队列。
 * 使用 Bull (基于 Redis 的队列库) 来实现异步任务处理。
 *
 * 主要功能：
 * 1. 注册一个名为 'audio' 的任务队列
 * 2. 提供音频任务的控制器（接收任务请求）
 * 3. 提供音频任务的处理器（执行实际的音频处理工作）
 */

// 导入 NestJS Bull 模块，用于创建和管理任务队列
import { BullModule } from '@nestjs/bull'
// 导入 NestJS 的核心 Module 装饰器，用于定义模块
import { Module } from '@nestjs/common'
// 导入 NestJS 配置服务，用于读取环境变量配置
import { ConfigService } from '@nestjs/config'

// 导入音频控制器，负责接收外部的任务请求
import { AudioController } from './audio.controller'
// 导入音频处理器，负责实际执行音频任务
import { AudioProcessor } from './audio.processor'

/**
 * @Module 装饰器用于定义一个 NestJS 模块
 *
 * 模块是 NestJS 应用的基本构建块，它组织相关的组件（控制器、服务、提供者等）
 */
@Module({
  /**
   * imports 数组：导入当前模块依赖的其他模块
   *
   * 这里我们导入 BullModule，并注册一个异步队列
   */
  imports: [
    // 使用 registerQueueAsync 方法异步注册一个队列
    // 异步方式允许我们在注册队列时使用 ConfigService 读取配置
    BullModule.registerQueueAsync({
      // 队列名称：'audio'，这个名称用于在应用中标识和访问这个队列
      name: 'audio',
      /**
       * useFactory: 一个工厂函数，返回队列的配置对象
       *
       * 参数 config: ConfigService - 用于读取配置的服务
       * 返回值: 队列配置对象，包含 Redis 连接信息
       */
      useFactory: (config: ConfigService) => ({
        // 从配置中获取 Redis 连接信息
        // config.get('redis') 会读取配置文件中 redis 相关的配置项
        redis: config.get('redis'),
      }),

      /**
       * inject: 指定需要注入到 useFactory 函数中的依赖
       *
       * 这里注入 ConfigService，这样 useFactory 函数就能使用它来读取配置
       */
      inject: [ConfigService],
    }),
  ],

  /**
   * controllers 数组：声明当前模块的控制器
   *
   * 控制器负责处理 HTTP 请求，定义 API 端点
   * AudioController 负责接收音频任务相关的请求
   */
  controllers: [AudioController],

  /**
   * providers 数组：声明当前模块的提供者
   *
   * 提供者是 NestJS 中的服务类，可以被注入到其他组件中
   * AudioProcessor 是一个 Bull 处理器，负责处理队列中的音频任务
   */
  providers: [AudioProcessor],
})
/**
 * 导出 AudioModule 类
 *
 * 其他模块可以通过导入 AudioModule 来使用它提供的功能
 */
export class AudioModule {}
