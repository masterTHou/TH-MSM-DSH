import { runClassicalExample } from '../lib/msm/demo.js'
const result = await runClassicalExample(process.cwd())
console.log(JSON.stringify(result, null, 2))
if (!result.ok) process.exitCode = 1
