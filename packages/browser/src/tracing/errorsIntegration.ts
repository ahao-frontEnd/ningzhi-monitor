import { Transport } from '@ningzhi/monitor-sdk-core'

export interface OnUnhandledRejectionErrorPayload {
  type: string
  stack: string
  message: string
  path: string
}

/**
 * 错误处理
 */
export class Errors {
  constructor(private transport: Transport) {}
  init() {
    // 处理全局错误
    // 包括脚本错误, 图片错误, 超时错误等
    window.onerror = (message, source, lineno, colno, error) => {
      console.log('🚀 ~ Errors ~ init ~ message, source:', message, source)
      this.transport.send({
        event_type: 'error',
        type: error?.name,
        stack: error?.stack,
        message,
        path: window.location.pathname,
      })
    }
    // 处理未捕获的 Promise 错误
    window.onunhandledrejection = event => {
      this.transport.send({
        event_type: 'error',
        type: 'unhandledrejection',
        stack: event.reason.stack,
        message: event.reason.message,
        path: window.location.pathname,
      })
    }
  }
}
