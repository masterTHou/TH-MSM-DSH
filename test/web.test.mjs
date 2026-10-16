import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createDashboard } from '../lib/web/export.js'
import { generateClassicalExample, buildClassicalModel } from '../lib/msm/index.js'
test('offline dashboard embeds real model and escapes script injection', () => {
  const model = buildClassicalModel(generateClassicalExample('msm-example'))
  model.provenance.data_digest = '</script><script>alert(1)</script>'
  const html = createDashboard(model)
  assert.ok(!html.includes(model.provenance.data_digest))
  const embedded = html.match(/window.TH_MSM_INITIAL_MODEL=(.*?);window.TH_MSM_CUSTOM_LESSON=/)[1]
  assert.deepEqual(JSON.parse(embedded), model)
  assert.ok(html.includes('平均首达时间'))
  assert.ok(!html.includes('<script src='))
  assert.ok(!html.includes('/*TH_MSM_JS*/'))
  assert.throws(() => createDashboard({ kind: 'c1' }), /INVALID_MODEL/)
  model.transition_matrix[0][0] = 999
  assert.throws(() => createDashboard(model), /INVALID_MODEL/)
})
test('web build is present in offline Codex package', async () => {
  const html = await readFile('plugins/th-msm/web/index.html', 'utf8')
  assert.ok(html.includes('TH_MSM_INITIAL_MODEL'))
  assert.ok(html.includes('导入自己的 model.json'))
})
