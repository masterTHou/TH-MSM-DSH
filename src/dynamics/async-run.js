import { Worker } from 'node:worker_threads'
export function simulateAsync(options, signal) {
  if (signal?.aborted) return Promise.reject(new Error('ABORTED'))
  return new Promise((resolve, reject) => {
    // The bundled desktop runtime includes process-only V8 flags invalid in workers.
    const worker = new Worker(new URL('./worker.js', import.meta.url), { workerData: options, execArgv: [] }), cleanup = () => signal?.removeEventListener('abort', abort)
    const abort = () => { cleanup(); worker.terminate(); reject(new Error('ABORTED')) }
    signal?.addEventListener('abort', abort, { once: true })
    worker.once('message', message => { cleanup(); if (message.ok) resolve(message.run); else reject(new Error(message.error)) })
    worker.once('error', error => { cleanup(); reject(error) })
    worker.once('exit', code => { cleanup(); if (code !== 0) reject(new Error(`simulation worker exited ${code}`)) })
  })
}
