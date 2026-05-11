// vite.config.inpage.ts
import { defineConfig } from 'vite';
import path, { resolve } from 'path';
const outDir = resolve(__dirname, '../dist_inpage');
export default defineConfig({
    resolve: {
        extensions: ['.ts', '.js', '.d.ts', '.tsx'],
        alias: {
            'sealx-core': path.resolve(__dirname, '../../packages/sealx-core/src'),
            'sealx-message': path.resolve(__dirname, '../../packages/sealx-message/src'),
            'sealx-sdk': path.resolve(__dirname, '../../packages/sealx-sdk/src'),
            buffer: path.resolve(__dirname, '../node_modules/buffer'),
            'crypto-js': path.resolve(__dirname, '../node_modules/crypto-js'),
            ethers: path.resolve(__dirname, '../node_modules/ethers'),
            lodash: path.resolve(__dirname, '../node_modules/lodash'),
        },
    },
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
