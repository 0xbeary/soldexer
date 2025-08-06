import { defineConfig } from 'tsup'
import { copyFileSync, mkdirSync, existsSync, cpSync } from 'fs'
import { join } from 'path'

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
    
    // Copy templates to dist (so they're relative to the built files)
    if (existsSync('templates')) {
      console.log('✓ Copying templates to dist...')
      cpSync('templates', 'dist/templates', { recursive: true })
      console.log('✓ Templates copied to dist/templates')
    }
  },
})