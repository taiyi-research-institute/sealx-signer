import path, { resolve } from 'path';
import { mergeConfig, defineConfig, type PluginOption } from 'vite';
import { crx, ManifestV3Export } from '@crxjs/vite-plugin';
import baseConfig, { baseManifest, baseBuildOptions } from './base'
import copy from 'rollup-plugin-copy';

const outDir = resolve(__dirname, '../dist_chrome');

export default mergeConfig(
    baseConfig,
    defineConfig({
        plugins: [
            copy({
                targets: [
                    { src: path.resolve(__dirname, '../dist_inpage/inpage.js'), dest: outDir },
                ],
                hook: 'writeBundle',
            }) as PluginOption,
            crx({
                manifest: {
                    ...baseManifest,
                    background: {
                        service_worker: 'src/entries/background/index.ts',
                        type: 'module'
                    },
                } as ManifestV3Export,
                browser: 'chrome',
                contentScripts: {
                    injectCss: true,
                }
            })
        ],
        build: {
            ...baseBuildOptions,
            outDir,
            target: 'esnext',
        },
    }) as never
)
