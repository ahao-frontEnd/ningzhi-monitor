/*
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// 页面激活后执行回调
// 用于在页面激活后执行指标采集, 避免在页面预渲染过程中执行指标采集, 导致性能问题
export const whenActivated = (callback: () => void) => {
  // 预渲染是浏览器的一种优化技术, 原理是将页面加载到内存中, 但不显示在屏幕上, 等待用户激活后显示
  // 用户激活是指用户点击页面, 或与页面交互, 导致页面从预渲染状态转换为活动状态
  if (document.prerendering) {
    // 页面正在预渲染中, 等待页面激活后执行回调
    // 避免在页面预渲染过程中执行回调, 导致性能问题
    addEventListener('prerenderingchange', () => callback(), true) // 监听页面激活事件, 确保在页面激活后执行回调
  } else {
    // 页面未预渲染, 立即执行回调
    callback()
  }
}
