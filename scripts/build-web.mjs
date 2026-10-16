import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { buildClassicalModel, generateClassicalExample } from '../lib/msm/index.js'
const demo=buildClassicalModel(generateClassicalExample('msm-example'))
const result=await build({entryPoints:['src/web/app.js'],bundle:true,platform:'browser',target:'es2022',format:'iife',minify:true,write:false,metafile:true,legalComments:'inline',define:{__TH_MSM_DEMO__:JSON.stringify(demo)}})
const js=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')
let html=(await readFile('src/web/page.html','utf8')).replace('/*TH_MSM_CSS*/',await readFile('src/web/style.css','utf8')).replace('/*TH_MSM_JS*/',()=>js)
const { readdir } = await import('node:fs/promises')
let notices = await readFile('LICENSE','utf8')
const dependencies = new Set(Object.keys(result.metafile.inputs).filter(f=>f.startsWith('node_modules/')).map(f=>{const p=f.split('/');return p.slice(0,p[1].startsWith('@')?3:2).join('/')}))
for(const directory of [...dependencies].sort()) {
  const pkg=JSON.parse(await readFile(`${directory}/package.json`,'utf8'))
  notices+=`\n\n${pkg.name} ${pkg.version}\n`
  for(const file of (await readdir(directory)).filter(f=>/^(license|copying|notice)(\.|$)/i.test(f))) notices+=await readFile(`${directory}/${file}`,'utf8')+'\n'
}
html += '\n<!-- Bundled open-source notices\n'+notices.replace(/--/g,'- -')+'\n-->\n'
html = html.replace(/\r\n/g, '\n')
await writeFile('lib/web/template.js',`export const dashboardTemplate = ${JSON.stringify(html)}\n`)
await mkdir('dist',{recursive:true});await writeFile('dist/th-msm-web.html',html)
console.log('Offline MSM dashboard built: dist/th-msm-web.html')
