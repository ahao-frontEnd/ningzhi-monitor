import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src'],
    format: ['cjs'],
    sourcemap: true,
    bundle: true, // 将所有依赖打包到一起,意思就是将所有依赖的代码都打包到一个文件中,而不是每个文件都打包到一个文件中
    dts: false, // 生成 .d.ts 文件
    clean: true,
    minify: true,
    outDir: 'build/cjs',
  },
  {
    entry: ['src'],
    format: ['esm'],
    sourcemap: true,
    bundle: true,
    dts: false,
    clean: true,
    minify: true,
    outDir: 'build/esm',
  },
])
