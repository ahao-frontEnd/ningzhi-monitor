import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { timeout } from 'rxjs/operators'

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // 设置超时时间为5秒, 超时后抛出异常， 也就是会触发 catch 操作符
    // 接口超时后，会返回一个错误信息，提示超时，请稍后重试
    return next.handle().pipe(timeout(5000))
  }
}
