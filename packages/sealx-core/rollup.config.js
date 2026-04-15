import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default [
    // JS 构建：输出 .mjs 和 .cjs
    {
        input: 'src/index.ts',
        output: [
            {
                dir: 'dist',
                format: 'esm',
                sourcemap: true,
                preserveModules: true,
                preserveModulesRoot: 'src',
                entryFileNames: '[name].mjs',
            },
            {
                dir: 'dist',
                format: 'cjs',
                sourcemap: true,
                entryFileNames: '[name].cjs',
            },
        ],
        plugins: [
            resolve(),
            commonjs({
                transformMixedEsModules: true,
            }),
            typescript({
                tsconfig: './tsconfig.json',
                declaration: true,
                declarationDir: 'dist',
                declarationMap: true,
            }),
        ],
        external: ['react', 'lodash', 'ethers', 'crypto-js', 'webextension-polyfill'],
    },
];
