import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { platform, arch, freemem, tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { unlink, lstat } from 'node:fs/promises'
import { stationary, mfpt } from '../msm/numerics.js'
import { writeWorkspaceText } from '../io/workspace.js'
import { scopedPath } from './paths.js'
import { readClassicalInput } from './input.js'
const execute = promisify(execFile)
export function childEnvironment() {
  const env = { ...process.env }
  // Embedded Electron / process-only flags must not leak into native Node jobs.
  for (const key of ['NODE_OPTIONS', 'NODE_PATH', 'ELECTRON_RUN_AS_NODE']) delete env[key]
  return env
}
export async function probeNode(signal) {
  try {
    const { stdout } = await execute('node', ['-e', 'console.log(JSON.stringify({executable:process.execPath,version:process.version}))'], { signal, timeout: 5000, maxBuffer: 16384, windowsHide: true, env: childEnvironment(), cwd: tmpdir() })
    const node = JSON.parse(stdout.trim())
    return { status: Number(node.version.slice(1).split('.')[0]) >= 22 ? 'ready' : 'blocked', ...node }
  } catch (error) { return { status: 'blocked', reason: `Native Node probe failed: ${error.code ?? error.message}` } }
}
async function probePython(signal) {
  const program = `import sys,json,importlib\nr={'executable':sys.executable,'version':sys.version.split()[0],'packages':{}}\nfor name in ['numpy','scipy','deeptime','MDAnalysis','mdtraj','matplotlib']:\n try:\n  m=importlib.import_module(name);r['packages'][name]={'status':'imported','version':str(getattr(m,'__version__','unknown'))}\n except Exception as e:r['packages'][name]={'status':'unavailable','reason':str(e)[:300]}\nprint('__TH_MSM_PROBE__'+json.dumps(r))`
  const attempts = []
  for (const command of ['python', 'python3']) {
    try {
      if (signal?.aborted) throw new Error('ABORTED')
      const { stdout } = await execute(command, ['-c', program], { signal, timeout: 8000, maxBuffer: 65536, windowsHide: true, cwd: tmpdir() })
      const marker = stdout.lastIndexOf('__TH_MSM_PROBE__')
      if (marker < 0) throw new Error('no structured probe response')
      return { status: 'checked', ...JSON.parse(stdout.slice(marker + 16).trim()), limitation: 'Dependency import check only; external Python workflows and raw-trajectory extraction are not implemented.' }
    } catch (error) { attempts.push({ command, reason: String(error.code ?? error.message) }) }
  }
  return { status: 'unavailable', attempts }
}
export async function inspectEnvironment({ workspace, trajectoryPath, outputDir, checkPython = false, signal } = {}) {
  const checks = {}, nextSteps = []
  const hostReady = Number(process.versions.node.split('.')[0]) >= 22
  try {
    const P = [[0.9, 0.1], [0.2, 0.8]], pi = stationary(P), times = mfpt(P, 1, 1)
    checks.numerics = { status: Math.abs(pi[0] - 2 / 3) < 1e-10 && Math.abs(times[0] - 10) < 1e-9 ? 'pass' : 'fail', test: 'two-state stationary and MFPT analytic identities' }
  } catch (error) { checks.numerics = { status: 'fail', reason: error.message } }
  const nativeNode = await probeNode(signal)
  checks.native_node = nativeNode
  let file
  if (workspace) {
    try {
      file = await writeWorkspaceText(workspace, `.th-msm-probe-${randomUUID()}.tmp`, 'TH-MSM write probe\n')
      await unlink(file); file = undefined
      checks.workspace = { status: 'pass', test: 'created and removed an actual probe file' }
    } catch (error) { checks.workspace = { status: 'fail', reason: error.message }; if (file) await unlink(file).catch(() => {}) }
    if (trajectoryPath) {
      try {
        const data = await readClassicalInput(workspace, trajectoryPath)
        checks.input = { status: 'pass', kind: data.kind, test: 'JSON readable and classical format recognized; scientific validity is checked during build' }
      } catch (error) { checks.input = { status: 'fail', reason: error.message } }
    }
    if (outputDir) {
      try {
        const target = await scopedPath(workspace, outputDir)
        try { await lstat(target); throw new Error('OUTPUT_EXISTS: choose a new output directory') }
        catch (error) { if (error.code !== 'ENOENT') throw error }
        checks.output = { status: 'pass', path: target, test: 'within workspace and does not already exist; actual claim is performed during run' }
      } catch (error) { checks.output = { status: 'fail', reason: error.message } }
    }
  } else checks.workspace = { status: 'not_checked', reason: 'provide the project workspace for file checks' }
  const inProcessReady = hostReady && checks.numerics.status === 'pass'
  const jobReady = inProcessReady && nativeNode.status === 'ready' && checks.workspace.status === 'pass' && !Object.values(checks).some(check => check.status === 'fail')
  if (nativeNode.status !== 'ready') nextSteps.push('Install native Node.js >=22 on PATH and reopen the host. An embedded host runtime alone does not prove generated scripts can run.')
  if (!workspace) nextSteps.push('Provide the absolute project workspace to check writing, input and output paths.')
  if (Object.values(checks).some(check => check.status === 'fail')) nextSteps.push('Resolve the failing check before running; no dependencies are installed automatically.')
  return { ok: inProcessReady, node: process.version, system: { platform: platform(), arch: arch(), free_memory_bytes: freemem() }, analyticalEngine: checks.numerics.status === 'pass',
    pythonStatus: checkPython ? 'checked_separately' : 'not_checked', esProviderStatus: 'not_connected', checks,
    readiness: { in_process_native: inProcessReady ? 'ready' : 'blocked', standalone_node: nativeNode.status, workflow: jobReady ? 'ready' : workspace ? 'blocked' : 'not_checked',
      external_python_execution: 'not_implemented', raw_trajectory_extraction: 'not_implemented' },
    python: checkPython ? await probePython(signal) : { status: 'not_checked', reason: 'Python is optional for the native MSM workflow.' }, nextSteps }
}
