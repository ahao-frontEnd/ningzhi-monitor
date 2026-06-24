import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now()
    return next.handle().pipe(
      // tap 操作符用于在 Observable 流中执行副作用操作，如日志记录、性能分析等
      tap(() => {
        Logger.log(`After... ${Date.now() - now}ms`)
      })
    )
  }
}
