/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                prism: {
                    sky: {
                        light: 'var(--prism-sky-light)',
                        DEFAULT: 'var(--prism-sky)',
                    },
                    lavender: 'var(--prism-lavender)',
                    pink: {
                        light: 'var(--prism-pink-light)',
                        DEFAULT: 'var(--prism-pink)',
                    },
                },
                rainbow: {
                    red: 'var(--rainbow-red)',
                    orange: 'var(--rainbow-orange)',
                    yellow: 'var(--rainbow-yellow)',
                    green: 'var(--rainbow-green)',
                    blue: 'var(--rainbow-blue)',
                    purple: 'var(--rainbow-purple)',
                }
            },
            animation: {
                'prism-gradient': 'prism-gradient 15s ease infinite alternate',
                'prism-aurora': 'prism-aurora 60s linear infinite',
                'prism-moon': 'prism-moon 6s ease-in-out infinite alternate',
            }
        },
    },
    plugins: [],
}
