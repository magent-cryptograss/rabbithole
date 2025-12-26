import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.js'),
            name: 'Rabbithole',
            fileName: (format) => `rabbithole.${format}.js`
        },
        rollupOptions: {
            // Externalize deps that shouldn't be bundled
            external: ['webamp'],
            output: {
                globals: {
                    webamp: 'Webamp'
                }
            }
        }
    },
    server: {
        port: 5173,
        open: true
    }
});
