/// <reference types="vitest/config" />

import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'

const dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url))

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
  },

  plugins: [
    devtools(),
    tailwindcss(),

    // React Start owns the Vite route generator. Keep this in sync with
    // tsr.config.json so routes created while Vite is running use the same
    // page/layout conventions as the CLI generator.
    tanstackStart({
      router: {
        routesDirectory: './routes',
        generatedRouteTree: './routeTree.gen.ts',
        routeToken: 'layout',
        indexToken: /page/,
        routeFileIgnorePattern:
          '^(?!(?:page|layout|__root)\\.(?:[cm]?[jt]sx?|vue)$).+\\.(?:[cm]?[jt]sx?|vue)$',
        autoCodeSplitting: true,
      },
    }),

    viteReact(),
  ],

  test: {
    projects: [
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium',
              },
            ],
          },
        },
      },
    ],
  },
})

export default config
