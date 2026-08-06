import { getTransport } from './baseClient'

export function captureException(exception: Error) {
  getTransport()?.send({ type: 'customError', exception })
}

export function captureMessage(message: string) {
  getTransport()?.send({ type: 'customMessage', message })
}

/**
 * 自定义事件
 * @param event
 * @param data
 */
interface EventData<T> {
  eventType: string
  data: T
}
export function captureEvent<T>(eventData: EventData<T>) {
  getTransport()?.send({ type: 'customEvent', eventData })
}
