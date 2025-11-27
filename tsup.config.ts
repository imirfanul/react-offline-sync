import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'], // Support CommonJS and ES Modules
  dts: true, // Generate Type Definitions
  clean: true,
  minify: true,
  sourcemap: true,
});