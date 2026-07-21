import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src'],
    format: ['cjs'],
    sourcemap: true,
    bundle: true, // 将所有依赖打包到一起
    dts: false,
    clean: true,
    minify: true,
    outDir: 'build/cjs',
  },
  {
    entry: ['src'],
    format: ['esm'],
    sourcemap: true,
    bundle: true,
    dts: false, // 不生成 .d.ts 文件
    clean: true,
    minify: true, // 压缩输出文件
    outDir: 'build/esm',
  },
])
