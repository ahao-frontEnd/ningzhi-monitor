/**
 * 定义数据传输协议，适配不同的客户端，例如浏览器、Node.js等
 */
export interface Transport {
  send: (data: Record<string, unknown>) => void
}
