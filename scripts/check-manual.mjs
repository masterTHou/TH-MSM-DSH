// Verify shipped help links and JSON examples against the actual scientific core.
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { buildClassicalModel } from '../lib/msm/index.js'
import { validateRegistry } from '../lib/registry/loader.js'
import { validateWorkflow } from '../lib/workflow/config.js'

const source = 'docs/USER-MANUAL.md'
const text = await readFile(source, 'utf8')
const version = JSON.parse(await readFile('package.json', 'utf8')).version
assert.ok(text.includes(`v${version}`), 'manual version must match package')
const anchors = new Set([...text.matchAll(/<a id="([^"]+)"/g)].map(match => match[1]))
for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
  const target = match[1]
  if (/^https?:/.test(target)) continue
  if (target.startsWith('#')) assert.ok(anchors.has(target.slice(1)), `missing manual anchor: ${target}`)
  else await access(path.resolve(path.dirname(source), target.split('#')[0]))
}
let jsonExamples = 0
for (const match of text.matchAll(/```json\r?\n([\s\S]*?)```/g)) {
  const data = JSON.parse(match[1]); jsonExamples++
  if (data.kind === 'classical-trajectories' || data.kind === 'classical-features') {
    const model = buildClassicalModel(data, { nClusters: 2 })
    assert.equal(model.kind, 'classical-msm')
    assert.notEqual(model.validation.verdict, 'SUPPORTED_AT_TESTED_LAGS', 'short format examples must not imply sufficient sampling')
    assert.ok(model.validation.ck.some(check => check.status === 'insufficient_data'), 'short templates lack held-out CK support')
  }
  if (data.version === 1 && data.msms) validateRegistry(data)
}
assert.ok(jsonExamples >= 6, 'expected dataset, tool and registry examples')
for (const match of (await readFile('docs/WORKFLOWS.md', 'utf8')).matchAll(/```json\r?\n([\s\S]*?)```/g)) validateWorkflow(JSON.parse(match[1]))
for (const name of ['USER-MANUAL.md', 'CODEX.md', 'SCIENCE.md', 'CLASSICAL-MSM.md', 'WORKFLOWS.md', 'WEB-UI.md']) {
  assert.equal(await readFile(`plugins/th-msm/docs/${name}`, 'utf8'), await readFile(`docs/${name}`, 'utf8'), `outdated bundled document: ${name}`)
}
console.log(`Manual ${version}: links, ${jsonExamples} JSON examples, classical templates and 6 bundled documents verified.`)
