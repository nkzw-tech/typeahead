import nkzw from '@nkzw/oxlint-config/with-sorting';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    ignorePatterns: ['lib', 'node_modules', 'pnpm-lock.yaml'],
    singleQuote: true,
    sortImports: { newlinesBetween: false },
    sortPackageJson: { sortScripts: true },
  },
  lint: {
    extends: [nkzw],
    ignorePatterns: ['lib/'],
    options: { typeAware: true, typeCheck: true },
  },
  pack: {
    clean: true,
    copy: ['src/style.css'],
    dts: true,
    entry: ['src/index.ts', 'src/core.ts'],
    fixedExtension: true,
    format: 'esm',
    outDir: 'lib',
    outputOptions: {
      banner: (chunk) => (chunk.isEntry && chunk.name === 'index' ? "'use client';" : ''),
    },
    platform: 'neutral',
    sourcemap: true,
    target: 'es2022',
  },
  run: {
    tasks: {
      'test:all': {
        command:
          'vp check && vp test run && vp run build && vp run test:package && vp run test:browser',
      },
    },
  },
  staged: { '*': 'vp check --fix' },
  test: { clearMocks: true, include: ['src/**/__tests__/**/*.test.{ts,tsx}'] },
});
