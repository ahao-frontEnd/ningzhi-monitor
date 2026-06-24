import { Injectable, Logger, NestMiddleware } from '@nestjs/common'
import { Request, Response } from 'express'

// 这个中间件用于记录请求日志
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: () => void) {
    const now = Date.now()
    next()
    const ms = Date.now() - now
    Logger.log(`${req.method} ${req.url} ${ms}ms`)
  }
}
