import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter<HttpException> {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse()
    const request = ctx.getRequest()
    // 获取异常状态码
    const status = exception.getStatus()

    // 获取异常信息
    const exceptionRes: any = exception.getResponse()
    const { error, message } = exceptionRes

    // 过滤器响应异常信息
    response.status(status).json({
      status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error,
      message: message + ' ( Ningzhi )',
    })
  }
}
