// vite.config.inpage.ts
import { defineConfig } from 'vite';
import path, { resolve } from 'path';
const outDir = resolve(__dirname, '../dist_inpage');
export default defineConfig({
    define: {
        global: {},
        Buffer: 'buffer.Buffer',
        'browser': {},
    },
    build: {
        outDir,
        lib: {
            entry: path.resolve(__dirname, '../src/entries/inpage/index.ts'),
            name: 'InpageScript',
            fileName: () => 'inpage.js',
            formats: ['iife'], // ✅ 非模块化格式
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true, // ✅ 禁用代码拆分
            },
        },
    },
});
