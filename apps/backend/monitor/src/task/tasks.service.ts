/**
 * TasksService - 定时任务服务
 *
 * 这个服务类用于定义和管理应用中的定时任务。
 * 使用 NestJS Schedule 模块提供的装饰器来实现三种定时任务：
 *
 * 1. @Cron - 基于 Cron 表达式的定时任务（如每分钟的第45秒执行）
 * 2. @Interval - 固定间隔执行的任务（如每10秒执行一次）
 * 3. @Timeout - 延迟一段时间后只执行一次的任务（如启动5秒后执行一次）
 *
 * 使用 Logger 来记录任务执行日志，方便调试和监控。
 */

// 导入 NestJS 的核心装饰器和日志工具
import { Injectable, Logger } from '@nestjs/common'
// 导入 NestJS Schedule 模块提供的三种定时任务装饰器
import { Cron, Interval, Timeout } from '@nestjs/schedule'

/**
 * @Injectable 装饰器标记这个类是一个可注入的服务
 *
 * 这意味着这个服务可以被注入到其他组件（如控制器、其他服务）中使用
 * NestJS 会自动管理它的生命周期（创建、销毁等）
 */
@Injectable()
export class TasksService {
  /**
   * 创建一个 Logger 实例，用于记录日志
   * Logger 的参数是日志的标签，这里使用服务类的名称作为标签
   * 这样在日志输出时可以清楚地看到是哪个服务输出的日志
   */
  private readonly logger = new Logger(TasksService.name)

  /**
   * @Cron 装饰器 - 基于 Cron 表达式的定时任务
   *
   * Cron 表达式格式（6个字段）：
   * 秒 分 时 日 月 周
   *
   * 示例表达式 '45 * * * * *' 的含义：
   * - 第1个字段（秒）: 45 → 在第45秒时触发
   * - 第2个字段（分）: * → 任意分钟
   * - 第3个字段（时）: * → 任意小时
   * - 第4个字段（日）: * → 任意日期
   * - 第5个字段（月）: * → 任意月份
   * - 第6个字段（周）: * → 任意星期
   *
   * 所以这个任务会在每分钟的第45秒执行一次
   */
  @Cron('45 * * * * *')
  handleCron() {
    // 使用 logger.debug 输出调试级别的日志
    this.logger.debug('Called when the second is 45')
  }

  /**
   * @Interval 装饰器 - 固定间隔执行的定时任务
   *
   * 参数是毫秒数，表示每隔多少毫秒执行一次
   *
   * 示例：Interval(10000) 表示每隔10秒（10000毫秒）执行一次
   *
   * 特点：从应用启动后立即开始计时，每隔指定时间执行一次
   */
  @Interval(10000)
  handleInterval() {
    this.logger.debug('Called every 10 seconds')
  }

  /**
   * @Timeout 装饰器 - 延迟执行一次的任务
   *
   * 参数是毫秒数，表示延迟多少毫秒后执行一次
   *
   * 示例：Timeout(5000) 表示应用启动后延迟5秒（5000毫秒）执行一次
   *
   * 特点：只执行一次，不会重复执行
   */
  @Timeout(5000)
  handleTimeout() {
    this.logger.debug('Called once after 5 seconds')
  }
}
