import test from 'node:test'
import assert from 'node:assert/strict'
import { stationary, spectralModes, mfpt, fitMSM, transitionCounts, buildClassicalModel, generateClassicalExample, validateMSM, mfptToState } from '../lib/msm/index.js'
import { decideWorkflow } from '../lib/decision/router.js'
import { guide } from '../lib/decision/wizard.js'
import { getLesson, lessonCatalog } from '../lib/education/lessons.js'

test('two-state stationary, spectrum and MFPT agree with analytic solutions', () => {
  const P = [[0.9, 0.1], [0.2, 0.8]]
  assert.ok(Math.abs(stationary(P)[0] - 2 / 3) < 1e-12)
  assert.ok(Math.abs(spectralModes(P, 1)[0].decay_time + 1 / Math.log(0.7)) < 1e-12)
  assert.ok(Math.abs(mfpt(P, 1, 1)[0] - 10) < 1e-12)
  assert.ok(Math.abs(mfpt(P, 0, 2)[1] - 10) < 1e-12)
})
test('counts preserve trajectory boundaries and reject unsupported transitions', () => {
  assert.deepEqual(transitionCounts([[0, 0], [1, 1]], 1, [0, 1]), [[1, 0], [0, 1]])
  assert.throws(() => stationary([[1, 0], [0, 1]]), /disconnected/)
  assert.throws(() => transitionCounts([[0, 2]], 1, [0, 1]), /unseen/)
  assert.throws(() => fitMSM({ kind: 'nonadiabatic-c1' }), /classical/)
  assert.throws(() => fitMSM({ kind: 'classical-trajectories', origin: 'unbiased-md', frame_time: 1, time_unit: 'ps', trajectories: [[0, 0, 1]] }), /no outgoing/)
})
test('independent synthetic example passes heldout CK and estimates known quantities', () => {
  const dataset = generateClassicalExample(), model = buildClassicalModel(dataset)
  assert.equal(model.provenance.training_trajectories, 9)
  assert.equal(model.provenance.validation_trajectories, 3)
  assert.equal(validateMSM(model).verdict, 'SUPPORTED_AT_TESTED_LAGS')
  assert.ok(Math.abs(model.stationary_distribution[0] - 2 / 3) < 0.03)
  assert.ok(Math.abs(mfptToState(model, 1).by_state[0].mean_time - 10) < 1)
  const bad = structuredClone(model); bad.stationary_distribution[0] = 0
  assert.equal(validateMSM(bad).verdict, 'INVALID_MODEL')
  const wrongSpectrum = structuredClone(model); wrongSpectrum.spectrum[0].decay_time = 999
  assert.equal(validateMSM(wrongSpectrum).verdict, 'INVALID_MODEL')
})
test('non-Markov projection fails CK and missing holdout is insufficient', () => {
  const t = Array.from({ length: 4000 }, (_, i) => Math.floor(i / 2) % 2)
  const data = { kind: 'classical-trajectories', origin: 'synthetic-markov', frame_time: 1, time_unit: 'steps', trajectories: [t, t, t, t] }
  const failed = buildClassicalModel(data)
  assert.equal(failed.validation.verdict, 'MARKOV_ASSUMPTION_UNSUPPORTED')
  assert.ok(failed.validation.ck.some(c => c.weighted_rmse > 0.4 && c.status === 'fail'))
  const basic = fitMSM(generateClassicalExample('one', 1))
  assert.equal(basic.validation.verdict, 'INSUFFICIENT_DATA')
})
test('periodic and complex modes are represented without fake finite relaxation', () => {
  const mode = spectralModes([[0, 1], [1, 0]], 1)[0]
  assert.equal(mode.decay_time, null); assert.equal(mode.oscillatory, true)
  const complex = spectralModes([[0.1, 0.9, 0], [0, 0.1, 0.9], [0.9, 0, 0.1]], 1)
  assert.ok(complex.every(x => x.oscillatory && Number.isFinite(x.decay_time)))
})
test('feature clustering fits only training data and retains trajectory split', () => {
  const training = Array.from({ length: 400 }, (_, i) => [i % 3 === 0 ? 0 : 10]), validation = training.map(([x], i) => [i % 5 === 0 ? 1000 : x])
  const model = buildClassicalModel({ kind: 'classical-features', origin: 'unbiased-md', frame_time: 0.1, time_unit: 'ps', feature_trajectories: [training, training, training, validation] }, { nClusters: 2 })
  assert.deepEqual(model.clustering.centers.flat().sort((a, b) => a - b), [0, 10])
  assert.equal(model.clustering.fit_on, 'training_only')
  assert.equal(model.provenance.validation_trajectories, 1)
})
test('typed local decisions abstain, respect explicit user selection and are not probabilities', () => {
  assert.equal(decideWorkflow({ message: '什么是非绝热 C1？' }).workflow, 'learn')
  assert.equal(decideWorkflow({ message: '建立一个 MSM 模型' }).workflow, 'classical-msm')
  assert.equal(decideWorkflow({ message: '运行光解模拟' }).workflow, 'nonadiabatic-c1')
  assert.equal(decideWorkflow({ message: '分析模型结果' }).workflow, 'analyze')
  assert.equal(decideWorkflow({ message: '你好' }).workflow, 'clarify')
  assert.equal(decideWorkflow({ message: '你好', explicit: 'learn' }).certainty, 'explicit')
  assert.equal(decideWorkflow({ message: '构建 MSM' }).probabilities, null)
})
test('human guide asks useful questions, skips known fields and offers a no-data demo', () => {
  assert.equal(guide({}).stage, 'choose-goal')
  const lesson = guide({ goal: 'learn' }); assert.ok(lesson.questions.length <= 3)
  assert.equal(guide({ goal: 'learn', topic: 'msm' }).next_action.tool, 'th_msm_teach')
  assert.equal(guide({ goal: 'classical-msm', dataFormat: 'none' }).next_action.tool, 'th_msm_example')
  const ready = guide({ goal: 'classical-msm', dataFormat: 'discrete', dataPath: 'data/example.json' })
  assert.equal(ready.questions.length, 0); assert.equal(ready.next_action.args.mode, 'msm')
  assert.equal(guide({ goal: 'classical-msm', modelPath: 'model.json' }).next_action.tool, 'th_msm_analyze')
})
test('teaching tiers differ, Chinese aliases resolve, unsupported topics are honest', () => {
  assert.ok(lessonCatalog().length >= 12)
  const beginner = getLesson('MSM', 'undergraduate'), expert = getLesson('MSM', 'expert')
  assert.notEqual(beginner.explanation.mathematics, expert.explanation.mathematics)
  assert.equal(getLesson('解释隐含时间尺度', 'graduate').id, 'its')
  assert.equal(getLesson('平均首达时间').id, 'mfpt')
  assert.equal(getLesson('unknown-unimplemented-method'), null)
})
