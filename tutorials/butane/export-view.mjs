import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createDashboard } from '../../lib/web/export.js'
const folder = path.resolve(process.argv[2] ?? 'output/butane-tutorial')
const model = JSON.parse(await readFile(path.join(folder, 'model.json'), 'utf8'))
const lesson = JSON.parse(await readFile(path.join(folder, 'lesson.json'), 'utf8'))
await writeFile(path.join(folder, 'dashboard.html'), createDashboard(model, { lesson }))
console.log(path.join(folder, 'dashboard.html'))
console.log('Model, recorded preview and figures are embedded from this run; check the manifest in the lesson.')
