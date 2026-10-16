import { build } from 'esbuild'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
const target = 'lib/workflow/workflow-runtime.mjs'
const result = await build({ entryPoints: ['lib/workflow/entry.js'], outfile: target, bundle: true, platform: 'node', target: 'node22', format: 'esm', minify: true, metafile: true,
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  alias: { '@deepseek-ai/dsh-tools': './src/codex/tool-definition.js' }, define: { __TH_MSM_VERSION__: JSON.stringify(pkg.version) },
  plugins: [{ name: 'offline-workflow', setup(builder) { builder.onResolve({ filter: /knowledge[\/]vector[\/]indexer\.js$/ }, () => ({ path: path.resolve('src/codex/index-disabled.js') })) } }] })
if (Object.keys(result.metafile.inputs).some(file => file.includes('@deepseek-ai/'))) throw new Error('standalone workflow must not require DSH')
await writeFile('lib/workflow/workflow-manifest.json', JSON.stringify({ version: pkg.version, sha256: createHash('sha256').update(await readFile(target)).digest('hex'), format: 'self-contained-esm', node: '>=22' }, null, 2) + '\n')
let notices = 'TH-MSM standalone workflow\n\n' + await readFile('LICENSE', 'utf8') + '\n\nBundled dependencies:\n'
const dependencies = new Set(Object.keys(result.metafile.inputs).filter(file => file.startsWith('node_modules/')).map(file => {
  const parts = file.split('/'); return parts.slice(0, parts[1].startsWith('@') ? 3 : 2).join('/')
}))
for (const directory of [...dependencies].sort()) {
  const manifest = JSON.parse(await readFile(`${directory}/package.json`, 'utf8'))
  notices += `\n${manifest.name} ${manifest.version} (${manifest.license ?? 'see below'})\n\n`
  for (const file of (await readdir(directory)).filter(name => /^(license|copying|notice)(\.|$)/i.test(name))) notices += await readFile(`${directory}/${file}`, 'utf8') + '\n'
}
await writeFile('lib/workflow/workflow-notices.txt', notices)
console.log(`Standalone MSM workflow ${pkg.version} built.`)
