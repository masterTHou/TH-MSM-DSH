// Legacy equilibrium pipeline deliberately unsupported until independently validated.
import path from 'node:path'
export async function checkPythonEnv(pythonPath = 'python', requiredPackages = ['deeptime']) {
  return { ok: false, status: 'not_checked', pythonPath, packages: requiredPackages.map(name => ({ name, status: 'unknown' })), missing: [] }
}
export async function detectDeeptime() { return { status: 'not_checked', installHint: 'pip install deeptime' } }
export function generateMsmScript() { throw new Error('NOT_IMPLEMENTED: legacy equilibrium MSM generator removed; use C1 run analysis') }
export function resolvePythonScript(workspace, scriptName = 'msm_pipeline.py') { return path.join(workspace, 'tools', scriptName) }
export function getInstallCommand() { return 'pip install deeptime mdtraj scikit-learn' }
export function getVerifyCommand() { return 'python -c "import deeptime; print(deeptime.__version__)"' }
