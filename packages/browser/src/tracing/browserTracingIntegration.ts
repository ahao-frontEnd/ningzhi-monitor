import { captureConsoleIntegration, captureMessage } from '@ningzhi/monitor-sdk-core'

export const browserTracingIntegration = () => {
  captureMessage('browserTracingIntegration')
  return {
    name: 'browserTracingIntegration',
    setupOnce() {
      captureConsoleIntegration()
    },
  }
}
