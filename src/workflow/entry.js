import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runWorkflow, runnerVersion } from './core.js'
export { runWorkflow, runnerVersion }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] !== '--execute' || !process.argv[3] || process.argv.length !== 4) throw new Error('usage: workflow-runtime.mjs --execute <absolute-workspace>; workflow JSON on stdin')
    const chunks = []; let bytes = 0
    for await (const chunk of process.stdin) { bytes += chunk.length; if (bytes > 65536) throw new Error('workflow config too large'); chunks.push(chunk) }
    const config = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    const result = await runWorkflow(process.argv[3], config, { runId: process.env.TH_MSM_JOB_ID })
    process.stdout.write(JSON.stringify(result) + '\n'); if (!result.ok) process.exitCode = 1
  } catch (error) { process.stdout.write(JSON.stringify({ ok: false, status: 'failed', error: error.message }) + '\n'); process.exitCode = 1 }
}
