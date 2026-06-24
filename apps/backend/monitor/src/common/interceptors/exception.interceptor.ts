import { CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common'
// rxjs 是一个用于处理异步数据的库, 它提供了一种称为 Observable 的数据流, 可以用于处理异步数据
import { Observable, throwError } from 'rxjs'
import { catchError } from 'rxjs/operators'

// 这个拦截器用于捕获异常, 并返回 502 错误，在什么情况下会调用呢？
// 当处理函数抛出异常时, 会调用这个拦截器
@Injectable()
export class ErrorsInterceptor implements NestInterceptor {
  // intercept 方法返回的 Observable<any> 表示拦截器可以处理任何类型的响应,
  // Observable 是 rxjs 中的一种数据流, 可以用于处理异步数据
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // 捕获异常, 并返回 502 错误
    // next.handle().pipe 表示继续执行下一个拦截器或处理函数，
    // pipe 是 rxjs 中的一种操作符, 用于对 Observable 进行转换，转换为 Observable 类型，
    // 并在转换过程中可以对 Observable 进行操作， catchError 是一个操作符, 用于捕获 Observable 中的异常
    return next.handle().pipe(
      catchError(() => {
        return throwError(new HttpException('New Message', HttpStatus.BAD_GATEWAY))
      })
    )
  }
}
