import react from '@vitejs/plugin-react';
import path, { resolve } from 'path';
import { ManifestV3Export } from '@crxjs/vite-plugin';
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, BuildOptions } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths'
import { stripDevIcons, crxI18n } from './custom-vite-plugins';
import manifest from '../manifest/manifest.json';
import pkg from '../package.json';
import svgr from 'vite-plugin-svgr';



const isDev = process.env.__DEV__ === 'true';
// set this flag to true, if you want localization support
const localize = false;

// Public key for Chrome extension (from extension.pem)
// This ensures a fixed extension ID during development
const extensionKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqOMn0GPvx3IYpHGK+Hf0YatEjrfEspIbAl0UP+C64uHch+2E9tskudfTsa+58mQjNwztIDHPQCXfpl0d0/rXFtZL4BBU7H4Z3/KSrxCSLwocDeoLIzjrlcErb1xPQ9a0oK8mFnObl+/qFLH1RVcLGCSViJZerDmR2kiJrK2pdn/rVvmCiNVYWECAguQXjeetZ5HdoLp73V3mFtgtS/BUN+iY+9YDaxyOWvw7TAZMk+ntRm1wm78YnyDo4q9bp2MQdzbbGqLE2YAcEPp15PqKkYSRDB1s+tFMqNmCZlxyXOau+wy+x9Vxw4qUDjKDnPtjy/J2ib3EVH+qzQhYX+kf/wIDAQAB';

export const baseManifest = {
    ...manifest,
    version: pkg.version,
    ...(localize ? {
        name: '__MSG_extName__',
        description: '__MSG_extDescription__',
        default_locale: 'en'
    } : {}),
    ...(isDev ? { key: extensionKey } : {})
} as ManifestV3Export

export const baseBuildOptions: BuildOptions = {
    sourcemap: isDev,
    emptyOutDir: !isDev
}

export default defineConfig({
    plugins: [
        svgr(),
        tailwindcss(),
        tsconfigPaths(),
        react(),
        stripDevIcons(isDev),
        crxI18n({ localize, src: '../src/locales' }),
    ],
    publicDir: resolve(__dirname, 'public'),
    resolve: {
        extensions: ['.ts', '.js', '.d.ts', '.tsx'],
        alias: {
            buffer: path.resolve(__dirname, 'node_modules', 'buffer')
        },
    },
    define: {
        global: {},
        Buffer: 'buffer.Buffer',
    },
    build: {
        rollupOptions: {
            input: {
                inpage: path.resolve(__dirname, '../src/entries/inpage/index.ts'),
                popup: path.resolve(__dirname, '../src/entries/popup/index.html'),
                sandbox: path.resolve(__dirname, '../src/entries/sandbox/index.html'),
            },
            output: {
                entryFileNames: '[name].js',
            }
        }
    }
});
