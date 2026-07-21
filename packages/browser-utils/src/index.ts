/**
 *  获取浏览器信息
 * @returns
 */
export function getBrowserInfo() {
  return {
    userAgent: navigator.userAgent, // 浏览器用户代理字符串
    platform: navigator.platform, // 浏览器平台信息
    language: navigator.language, // 浏览器语言信息
    referrer: document.referrer, // 浏览器引用信息
    path: location.pathname, // 浏览器当前路径
  }
}

export { Metrics } from './integrations/metrics'
