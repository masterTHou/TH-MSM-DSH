import { readFile, realpath } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeWorkspaceText } from '../io/workspace.js'
import { validateWorkflow } from './config.js'
import { freshDirectory, scopedPath } from './paths.js'

export async function trustedRuntime() {
  const entry = fileURLToPath(new URL('./workflow-runtime.mjs', import.meta.url))
  const manifest = JSON.parse(await readFile(new URL('./workflow-manifest.json', import.meta.url), 'utf8'))
  const source = await readFile(entry, 'utf8')
  if (createHash('sha256').update(source).digest('hex') !== manifest.sha256) throw new Error('installed workflow runtime hash mismatch; reinstall the matching release')
  return { entry, source, manifest, notices: await readFile(new URL('./workflow-notices.txt', import.meta.url), 'utf8') }
}
export async function exportWorkflow(workspace, config, scriptDir = `output/scripts/${randomUUID()}`) {
  validateWorkflow(config)
  const runtime = await trustedRuntime()
  workspace = await realpath(workspace)
  const scriptTarget = await scopedPath(workspace, scriptDir), outputTarget = await scopedPath(workspace, config.outputDir)
  if (config.trajectoryPath) await scopedPath(workspace, config.trajectoryPath)
  const contains = (a, b) => { const relative = path.relative(a, b); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) }
  if (contains(scriptTarget, outputTarget) || contains(outputTarget, scriptTarget)) throw new Error('scriptDir and outputDir must not overlap')
  const folder = await freshDirectory(workspace, scriptDir)
  const relativeRoot = path.relative(folder, workspace).split(path.sep).join('/')
  const launcher = `import { readFile } from 'node:fs/promises'\nimport path from 'node:path'\nimport { fileURLToPath } from 'node:url'\nimport { createHash } from 'node:crypto'\nconst directory = path.dirname(fileURLToPath(import.meta.url))\nif (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js >=22 required')\nconst manifest = JSON.parse(await readFile(path.join(directory, 'runtime-manifest.json'), 'utf8'))\nconst runtime = await readFile(path.join(directory, 'runtime.mjs'))\nif (createHash('sha256').update(runtime).digest('hex') !== manifest.sha256) throw new Error('Runtime checksum mismatch')\nconst { runWorkflow } = await import('./runtime.mjs')\nconst config = JSON.parse(await readFile(path.join(directory, 'workflow.json'), 'utf8'))\nconst root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(directory, ${JSON.stringify(relativeRoot)})\nconst result = await runWorkflow(root, config)\nconsole.log(JSON.stringify(result, null, 2))\nif (!result.ok) process.exitCode = 1\n`
  const save = (file, text) => writeWorkspaceText(workspace, path.join(scriptDir, file), text)
  const workflowPath = await save('workflow.json', JSON.stringify(config, null, 2) + '\n')
  const scriptPath = await save('run.mjs', launcher)
  await save('runtime.mjs', runtime.source)
  await save('runtime-manifest.json', JSON.stringify(runtime.manifest, null, 2) + '\n')
  await save('THIRD-PARTY-NOTICES.txt', runtime.notices)
  await save('README.md', `# TH-MSM 独立工作流\n\n只需要原生 Node.js >=22，无需安装 npm、DSH 或 Codex。\n\n在项目根目录终端执行：\n\n\`\`\`sh\nnode "${path.relative(workspace, scriptPath).split(path.sep).join('/')}"\n\`\`\`\n\n移动整份项目后相对目录仍可使用；单独移动脚本目录时请额外提供项目绝对路径：node run.mjs /absolute/project。\n\nworkflow.json 是可审阅的配置，不是任意 shell 命令。outputDir 必须是工作区内尚不存在的新目录，已有结果不会覆盖。要重复运行，请先改为新的 outputDir。\n\n支持 example 或经典离散/预提取特征 JSON；不执行 raw XTC/DCD、Python 后端、tICA/VAMP、PCCA 或 TPT。报告保留科学验证失败或数据不足的结论。\n\n运行核心版本：${runtime.manifest.version}；SHA256：${runtime.manifest.sha256}。运行后读取 START-HERE.md、run-manifest.json 与 workflow.log.jsonl。\n`)
  return { folder, scriptPath, workflowPath, runtime: runtime.manifest, configuration: config, command: ['node', scriptPath] }
}
