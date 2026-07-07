import { type ClassValue, clsx } from 'clsx' // 引入 clsx 库, 用于合并类名, clsx 是一个函数, 可以将多个类名合并成一个字符串, 并自动去重
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  // 合并类名, 并自动去重, 并返回一个字符串
  return twMerge(clsx(inputs))
}
