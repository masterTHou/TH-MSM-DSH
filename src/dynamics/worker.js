import { parentPort, workerData } from 'node:worker_threads'
import { runSimulation } from './run.js'
try { parentPort.postMessage({ ok: true, run: runSimulation(workerData) }) }
catch (e) { parentPort.postMessage({ ok: false, error: e.message }) }
