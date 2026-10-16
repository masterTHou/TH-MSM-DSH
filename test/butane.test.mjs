import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { buildClassicalModel, validateMSM } from '../lib/msm/index.js'
import { createDashboard } from '../lib/web/export.js'
const read = async file => JSON.parse(await readFile(`examples/butane/${file}`, 'utf8'))
test('recorded molecular trajectories reproduce published model and retain physical provenance', async () => {
  const [input,model,manifest,settings]=await Promise.all(['discrete-trajectories.json','model.json','manifest.json','simulation.json'].map(read))
  const rebuilt=buildClassicalModel(input,{lagFrames:model.lag_frames,holdoutFraction:.25})
  assert.deepEqual(rebuilt,model)
  assert.equal(manifest.input_sha256,createHash('sha256').update(await readFile('examples/butane/discrete-trajectories.json')).digest('hex'))
  assert.equal(manifest.total_es_calls,0)
  assert.equal(manifest.threads,1)
  assert.equal(input.frame_time,settings.save_ps)
  assert.equal(model.lag_time,settings.lag_ps)
  assert.equal(input.trajectories.length,manifest.n_trajectories)
  assert.equal(model.provenance.validation_trajectories,3)
  assert.ok(manifest.max_bond_error_nm<1e-6)
  assert.equal(validateMSM(model).verdict,'SUPPORTED_AT_TESTED_LAGS')
})
test('custom molecular lesson is self-contained and rejects unsafe metadata or mismatched models', async () => {
  const lesson=await read('lesson.json')
  const html=createDashboard(lesson.model,{lesson})
  assert.ok(html.includes('window.TH_MSM_CUSTOM_LESSON={'))
  assert.ok(html.includes('data:image/png;base64,'))
  const other=structuredClone(lesson.model);other.provenance.data_digest='different-run'
  assert.throws(()=>createDashboard(other,{lesson}),/MISMATCH/)
  const unsafe=structuredClone(lesson);unsafe.model.validation.ck_tolerance='<img onerror=alert(1)>'
  assert.throws(()=>createDashboard(null,{lesson:unsafe}),/INVALID_LESSON/)
  unsafe.model.validation.ck_tolerance=.1;unsafe.figure_images[0]='https://example.com/tracker'
  assert.throws(()=>createDashboard(null,{lesson:unsafe}),/INVALID_LESSON/)
  const stale=structuredClone(lesson);stale.figure_sha256[stale.figures[0]]='0000'
  assert.throws(()=>createDashboard(null,{lesson:stale}),/checksum mismatch/)
})
