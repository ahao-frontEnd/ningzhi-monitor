import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src'],
    format: ['cjs'],
    sourcemap: true,
    bundle: true, // 将所有依赖打包到一起
    dts: true, // 生成 .d.ts 文件
    clean: true, // 构建前清理输出目录
    minify: true, // 压缩输出文件
    outDir: 'build/cjs', // 输出目录
  },
  {
    entry: ['src'],
    format: ['esm'],
    sourcemap: true,
    bundle: true, // 将所有依赖打包到一起
    dts: true, // 生成 .d.ts 文件
    clean: true, // 构建前清理输出目录
    minify: true, // 压缩输出文件
    outDir: 'build/esm', // 输出目录
    outExtension() {
      // 输出为 .js 和 .d.ts
      return {
        js: '.js',
      }
    },
  },
])
