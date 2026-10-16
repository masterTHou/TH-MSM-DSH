import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readWorkspaceJSON, writeWorkspaceText } from '../io/workspace.js'
import { childEnvironment, inspectEnvironment } from './doctor.js'
import { trustedRuntime, exportWorkflow } from './artifacts.js'
import { validateWorkflow, workflowFromArgs } from './config.js'

function executeJob(executable, entry, workspace, config, runId, signal, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error(signal?.reason?.message === 'TIMEOUT' ? 'TIMEOUT' : 'ABORTED'))
    const child = spawn(executable, [entry, '--execute', workspace], { shell: false, windowsHide: true, cwd: workspace,
      env: { ...childEnvironment(), TH_MSM_JOB_ID: runId }, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = '', stderr = '', size = 0, settled = false, stopped
    const finish = (error, result) => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort)
      error ? reject(error) : resolve(result)
    }
    const stop = reason => { if (!stopped) { stopped = reason; child.kill() } }
    const abort = () => stop(signal?.reason?.message === 'TIMEOUT' ? 'TIMEOUT' : 'ABORTED')
    const timer = setTimeout(() => stop('TIMEOUT'), timeoutMs)
    signal?.addEventListener('abort', abort, { once: true })
    const collect = key => data => { if (stopped) return; size += data.length; if (size > 262144) return stop('OUTPUT_LIMIT_EXCEEDED'); if (key === 'stdout') stdout += data; else stderr += data }
    child.stdout.on('data', collect('stdout')); child.stderr.on('data', collect('stderr'))
    child.on('error', error => finish(error))
    child.stdin.on('error', error => { if (error.code !== 'EPIPE') finish(error) })
    child.on('close', code => {
      if (settled) return
      if (stopped) return finish(new Error(stopped))
      try {
        const result = JSON.parse(stdout.trim())
        if (code !== 0 && result.ok) throw new Error('worker exit/result mismatch')
        finish(null, { ...result, process: { exit_code: code, stderr: stderr.slice(-4096) } })
      } catch (error) { finish(new Error(`workflow process failed: ${error.message}; ${stderr.slice(-1000)}`)) }
    })
    child.stdin.end(JSON.stringify(config))
  })
}
export async function executeWorkflow(workspace, args, { signal, timeoutMs = 300000 } = {}) {
  const interrupted = () => ({ ok: false, status: signal?.reason?.message === 'TIMEOUT' ? 'failed' : 'cancelled', summary: signal?.reason?.message === 'TIMEOUT' ? 'TIMEOUT' : 'ABORTED', details: {} })
  if (signal?.aborted) return interrupted()
  let config
  if (args.workflowPath) {
    if (Object.keys(args).some(key => key !== 'workflowPath')) throw new Error('workflowPath cannot be combined with inline configuration')
    config = validateWorkflow(await readWorkspaceJSON(workspace, args.workflowPath))
  } else config = workflowFromArgs(args)
  const doctor = await inspectEnvironment({ workspace, trajectoryPath: config.trajectoryPath, outputDir: config.outputDir, signal })
  if (signal?.aborted) return interrupted()
  if (doctor.readiness.workflow !== 'ready') return { ok: false, status: 'blocked', summary: '环境或输入检查未通过，未启动工作流。', details: { environment: doctor, configuration: config } }
  const runtime = await trustedRuntime()
  const bundle = args.workflowPath ? { workflowPath: args.workflowPath } : await exportWorkflow(workspace, config, args.scriptDir)
  const runId = randomUUID()
  try {
    const result = await executeJob(doctor.checks.native_node.executable, runtime.entry, workspace, config, runId, signal, timeoutMs)
    return { ok: result.ok, status: result.status, summary: result.ok ? `工作流已完成；科学验证：${result.science_verdict}。` : `工作流失败：${result.error ?? result.status}`, details: { ...result, script: bundle, environment: doctor } }
  } catch (error) {
    // Only mark outputs owned by this invocation; never rewrite an older run.
    try {
      const file = `${config.outputDir}/run-manifest.json`, manifest = await readWorkspaceJSON(workspace, file)
      if (manifest.run_id === runId) {
        manifest.status = error.message === 'ABORTED' ? 'cancelled' : 'failed'; manifest.execution_ok = false
        manifest.error = error.message; manifest.finished_at = new Date().toISOString()
        for (const stage of manifest.stages) if (stage.status === 'running') stage.status = 'interrupted'
        await writeWorkspaceText(workspace, file, JSON.stringify(manifest, null, 2) + '\n')
      }
    } catch {}
    return { ok: false, status: error.message === 'ABORTED' ? 'cancelled' : 'failed', summary: error.message, details: { script: bundle, configuration: config } }
  }
}
