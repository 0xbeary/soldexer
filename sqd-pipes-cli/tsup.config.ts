import { defineConfig } from 'tsup'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
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
      console.log('✓ Copying templates...')
      // Templates will be copied to dist/templates by the files field in package.json
    }
  },
})