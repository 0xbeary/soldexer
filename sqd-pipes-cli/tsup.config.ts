import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'], // Dual format support
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  banner: {
    js: '#!/usr/bin/env node', // Add shebang automatically
  },
  onSuccess: async () => {
    // Make the file executable after build
    const { chmod } = await import('fs/promises')
    await chmod('dist/index.js', '755')
    console.log('✓ Made dist/index.js executable')
  },
})
