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

// 双 requestAnimationFrame 用于确保回调在浏览器重绘完成后执行
// 避免在重绘过程中执行回调, 导致性能问题
export const doubleRAF = (cb: () => unknown) => {
  requestAnimationFrame(() => requestAnimationFrame(() => cb()))
}
