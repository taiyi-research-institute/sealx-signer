/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './src/**/*.{js,jsx,ts,tsx}',
        './src/**/**/*.{js,jsx,ts,tsx,html}',
        './src/**/**/**/*.{js,jsx,ts,tsx}',
        './src/**/**/**/**/*.{js,jsx,ts,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    DEFAULT: '#00BE78',
                    dark: '#00A366',
                },
                surface: {
                    DEFAULT: '#FFFFFF',
                    secondary: 'rgba(0, 0, 0, 0.05)',
                    tertiary: 'rgba(0, 0, 0, 0.06)',
                },
                text: {
                    primary: '#000000',
                    secondary: 'rgba(0, 0, 0, 0.60)',
                    tertiary: 'rgba(0, 0, 0, 0.50)',
                    error: '#F0231E',
                },
                border: {
                    DEFAULT: 'rgba(0, 0, 0, 0.10)',
                    light: 'rgba(0, 0, 0, 0.06)',
                },
            },
            backgroundImage: {
                'sealx-gradient': 'radial-gradient(circle at 50% 22%, #c0ffe8 0%, #ffffff 58%, #ffffff 100%)',
            },
        },
        fontWeight: {
            thin: '100',
            extralight: '200',
            light: '300',
            normal: '400',
            medium: '500',
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
