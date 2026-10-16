import { build } from 'esbuild'
import { mkdir, readFile, writeFile, copyFile, cp, readdir } from 'node:fs/promises'
import path from 'node:path'
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
const root = 'plugins/th-msm'
await mkdir(`${root}/server`, { recursive: true })
await mkdir(`${root}/web`, { recursive: true })
await copyFile('dist/th-msm-web.html', `${root}/web/index.html`)
const options = { bundle: true, platform: 'node', target: 'node22', format: 'esm', minify: true,
  legalComments: 'linked', banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" } }
const result = await build({ ...options, entryPoints: ['lib/codex/server.js'], outfile: `${root}/server/index.mjs`, metafile: true,
  plugins: [{ name: 'offline-knowledge', setup(builder) {
    builder.onResolve({ filter: /knowledge[\/]vector[\/]indexer\.js$/ }, () => ({ path: path.resolve('src/codex/index-disabled.js') }))
  } }],
  alias: { '@deepseek-ai/dsh-tools': './src/codex/tool-definition.js' }, define: { __TH_MSM_VERSION__: JSON.stringify(pkg.version) } })
if (Object.keys(result.metafile.inputs).some(file => file.includes('@deepseek-ai/'))) throw new Error('Codex runtime must not depend on DSH')
await build({ ...options, entryPoints: ['lib/dynamics/worker.js'], outfile: `${root}/server/worker.js` })
await writeFile(`${root}/server/package.json`, JSON.stringify({ private: true, type: 'module' }) + '\n')
for (const name of ['workflow-runtime.mjs', 'workflow-manifest.json', 'workflow-notices.txt']) await copyFile(`lib/workflow/${name}`, `${root}/server/${name}`)
await mkdir(`${root}/knowledge/vector`, { recursive: true })
await copyFile('src/knowledge/vector/papers.json', `${root}/knowledge/vector/papers.json`)
const portable = JSON.parse(await readFile(`${root}/plugin.json`, 'utf8'))
if (portable.version !== pkg.version) throw new Error('Codex manifest version differs from package version')
await writeFile(`${root}/.codex-plugin/plugin.json`, JSON.stringify({ name: portable.name, version: portable.version,
  description: portable.description, author: portable.author, skills: './skills/', mcpServers: './.mcp.json',
  ...portable.extensions['com.openai'] }, null, 2) + '\n')
await copyFile('LICENSE', `${root}/LICENSE`)
await cp('examples/msm', `${root}/examples`, { recursive: true })
await mkdir(`${root}/docs`, { recursive: true })
for (const name of ['SCIENCE.md', 'CLASSICAL-MSM.md', 'CODEX.md', 'USER-MANUAL.md', 'WORKFLOWS.md', 'WEB-UI.md']) await copyFile(`docs/${name}`, `${root}/docs/${name}`)
const dependencies = new Set(Object.keys(result.metafile.inputs).filter(file => file.startsWith('node_modules/')).map(file => {
  const parts = file.split('/')
  return parts.slice(0, parts[1].startsWith('@') ? 3 : 2).join('/')
}))
let notices = '# Bundled third-party software\n\nGenerated from the actual Codex bundle inputs.\n'
for (const directory of [...dependencies].sort()) {
  const manifest = JSON.parse(await readFile(`${directory}/package.json`, 'utf8'))
  notices += `\n## ${manifest.name} ${manifest.version} (${manifest.license ?? 'see license below'})\n\n`
  for (const name of (await readdir(directory)).filter(name => /^(license|copying|notice)(\.|$)/i.test(name))) {
    notices += await readFile(`${directory}/${name}`, 'utf8') + '\n'
  }
}
await writeFile(`${root}/THIRD-PARTY-NOTICES.md`, notices)
console.log(`Codex ${pkg.version} bundled without DSH runtime dependencies.`)
