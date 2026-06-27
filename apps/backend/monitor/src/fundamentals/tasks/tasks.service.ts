import { Injectable, Logger } from '@nestjs/common'
import { Cron, Interval, Timeout } from '@nestjs/schedule'

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name)

  // 每 45 秒执行一次
  @Cron('45 * * * * *')
  handleCron() {
    this.logger.debug('Called when the second is 45')
  }

  // 每 10 秒执行一次
  @Interval(10000)
  handleInterval() {
    this.logger.debug('Called every 10 seconds')
  }

  // 5 秒后执行一次
  @Timeout(5000)
  handleTimeout() {
    this.logger.debug('Called once after 5 seconds')
  }
}
