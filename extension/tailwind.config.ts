/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './src/**/*.{js,jsx,ts,tsx}',
        './src/**/**/*.{js,jsx,ts,tsx,html}',
        './src/**/**/**/*.{js,jsx,ts,tsx}',
        './src/**/**/**/**/*.{js,jsx,ts,tsx}',
    ],
    theme: {
        extend: {},
        fontWeight: {
            thin: '100',
            extralight: '200',
            light: '300',
            normal: '400',
            medium: '500',   // ← 确保写上
            semibold: '600',
            bold: '700',
            extrabold: '800',
            black: '900',
        },
    },
    plugins: [],
    corePlugins: {
        fontWeight: true,
    },
};
