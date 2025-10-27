import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';

export default [
    // JS 构建：输出 .mjs 和 .cjs
    {
        input: 'src/index.ts',
        output: [
            {
                file: 'dist/index.mjs',
                format: 'esm',
                sourcemap: true,
            },
            {
                file: 'dist/index.cjs',
                format: 'cjs',
                sourcemap: true,
            }
        ],
        plugins: [resolve(), commonjs(), typescript({ tsconfig: './tsconfig.json' })],
        external: ['react', 'lodash'] // 根据需要排除依赖
    },

    // 类型声明构建：输出 .d.ts
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/index.d.ts',
            format: 'es'
        },
        plugins: [dts()]
    }
];
