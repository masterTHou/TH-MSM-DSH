import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
if (existsSync(new URL('../tsconfig.json', import.meta.url))) {
  if (!process.env.npm_execpath) throw new Error('Run this script through npm, or run npm run build first')
  execFileSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], { stdio: 'inherit' })
} else if (!existsSync(new URL('../lib/engine.js', import.meta.url))) throw new Error('Compiled runtime is missing')
