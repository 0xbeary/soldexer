import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  target: 'es2022',
  onSuccess: async () => {
    const { chmod } = await import('fs/promises')
    await chmod('dist/index.js', '755')
    console.log('✓ Made dist/index.js executable')
  },
})