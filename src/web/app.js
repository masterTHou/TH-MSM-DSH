import { validateMSM, mfptToState } from '../msm/validation.js'
const $ = id => document.getElementById(id)
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const number = n => n === null || !Number.isFinite(n) ? '无有限值' : Number(n.toPrecision(5)).toString()
const percent = n => `${(100 * n).toFixed(1)}%`
let model
function table(headers, rows) { return `<table><thead><tr>${headers.map(x => `<th>${escape(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${escape(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>` }
function bars(id, values, formatter = percent) {
  const max = 1 // Probability bars share an absolute 0–100% scale.
  $(id).innerHTML = values.map((p, i) => `<div class="barrow"><span>状态 ${model.labels[i]}</span><div class="track"><div class="bar" style="width:${100 * p / max}%"></div></div><strong>${escape(formatter(p))}</strong></div>`).join('')
}
function fail(error) { $('error').hidden = false; $('error').textContent = `无法载入：${error.message}。请使用 TH-MSM 输出的经典 model.json；之前的有效模型仍可查看。` }
function load(input, source) {
  try {
    // Bound work before dense spectral validation; user-selected files are untrusted.
    if (input?.kind !== 'classical-msm' || !Array.isArray(input.labels) || input.labels.length < 2 || input.labels.length > 128) throw new Error('仅支持 2–128 状态 classical-msm')
    const v = validateMSM(input)
    if (v.verdict === 'INVALID_MODEL') throw new Error(v.uncertainties.join('; '))
    if (!input.provenance || !Array.isArray(input.validation.its)) throw new Error('缺少数据来源或 ITS 记录')
    model = input
    $('error').hidden = true; $('empty').hidden = true; $('results').hidden = false; $('source').textContent = source
    const options = model.labels.map(x => `<option value="${x}">状态 ${x}</option>`).join('')
    $('origin').innerHTML = options; $('target').innerHTML = options; $('target').selectedIndex = 1; $('steps').value = 0
    $('metrics').innerHTML = [[model.labels.length, '离散状态'], [`${number(model.lag_time)} ${model.time_unit}`, '一个 lag 的时长'], [model.provenance.training_trajectories, '训练轨迹'], [model.provenance.validation_trajectories, '留出验证轨迹']].map(([n,t]) => `<div class="metric"><strong>${escape(n)}</strong><span>${escape(t)}</span></div>`).join('')
    bars('population', model.stationary_distribution)
    const labels = model.labels.slice(0,16)
    $('matrix').innerHTML = (model.labels.length > 16 ? '<p>热图仅展示前 16 个状态；选择起点可查看完整转移概率。</p>' : '') + `<table><thead><tr><th>从 ↓ / 到 →</th>${labels.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${labels.map((x,i)=>`<tr><th>${x}</th>${labels.map((y,j)=>`<td style="background:rgba(8,127,118,${model.transition_matrix[i][j]*.65})"><button data-i="${i}" data-j="${j}" aria-label="从状态 ${x} 到 ${y}，概率 ${percent(model.transition_matrix[i][j])}">${percent(model.transition_matrix[i][j])}</button></td>`).join('')}</tr>`).join('')}</tbody></table>`
    $('matrix').querySelectorAll('button').forEach(b=>b.onclick=()=>{const {i,j}=b.dataset;$('cell').textContent=`如果现在在状态 ${model.labels[i]}，经过 ${number(model.lag_time)} ${model.time_unit} 后，在状态 ${model.labels[j]} 的概率约为 ${percent(model.transition_matrix[i][j])}。这对本模型及 lag 有效。`})
    $('cell').textContent = '点击任意概率格子，查看一句话解释。'
    const verdicts = { SUPPORTED_AT_TESTED_LAGS: ['在已测试 lag 上得到支持', 'ITS/CK 检查目前支持该模型；还需结合物理意义、采样覆盖和更多独立数据。'], INSUFFICIENT_DATA: ['数据不足，暂时无法判断', '先增加独立轨迹或转移采样，再做验证。不要把程序运行成功解释为模型可靠。'], MARKOV_ASSUMPTION_UNSUPPORTED: ['当前模型的马尔可夫假设未获支持', '检查特征、状态划分、lag 和采样量。图表可以探索，但动力学数值需谨慎解释。'] }
    const verdict = verdicts[v.verdict]; $('verdict').textContent=verdict[0];$('verdict').className=v.ok?'good':'bad';$('verdict-help').textContent=verdict[1]
    $('its').innerHTML = table(['lag（帧）','最慢衰减时间','备注'], model.validation.its.map(x=>[x.lag_frames,`${number(x.modes?.[0]?.decay_time)} ${model.time_unit}`,x.error ?? (x.modes?.[0]?.oscillatory?'振荡模式':'非振荡 / 无模式')]))
    $('ck').innerHTML = table(['步数 k','加权 RMSE','有支持的行','结果'],model.validation.ck.map(x=>[x.multiple,number(x.weighted_rmse),x.supported_rows,x.status])) + `<p>RMSE 阈值：${escape(model.validation.ck_tolerance)}；每行最少计数：${escape(model.validation.min_counts_per_row)}</p>`
    $('diagnostics').innerHTML=table(['检查','结果','说明'],v.tests.map(x=>[x.name,x.status,x.details]))
    $('provenance').textContent=JSON.stringify(model.provenance,null,2)
    $('modes').innerHTML=table(['模式','衰减时间','是否振荡'],model.spectrum.slice(0,8).map((x,i)=>[i+1,`${number(x.decay_time)} ${model.time_unit}`,x.oscillatory?'是':'否']))
    origin(); target()
  } catch(error) { fail(error) }
}
function origin() {
  const i=model.labels.indexOf(Number($('origin').value)), n=Math.min(model.labels.length,16)
  const pos=Array.from({length:n},(_,k)=>[220+145*Math.cos(2*Math.PI*k/n-Math.PI/2),160+110*Math.sin(2*Math.PI*k/n-Math.PI/2)])
  let svg='<svg viewBox="0 0 440 320" role="group" aria-label="状态转移网络"><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#087f76"/></marker></defs>'
  if(i<n) for(let j=0;j<n;j++) if(j!==i&&model.transition_matrix[i][j]>0){const [x,y]=pos[i],[a,b]=pos[j],dx=a-x,dy=b-y,d=Math.hypot(dx,dy),offset=4+50*Math.sqrt(model.stationary_distribution[j]);svg+=`<line x1="${x}" y1="${y}" x2="${a-dx/d*offset}" y2="${b-dy/d*offset}" stroke="#087f76" stroke-width="${1+5*model.transition_matrix[i][j]}" marker-end="url(#arrow)"/><text x="${(x+a)/2+8}" y="${(y+b)/2-8}" font-size="12">${percent(model.transition_matrix[i][j])}</text>`}
  for(let j=0;j<n;j++){const [x,y]=pos[j];svg+=`<g role="button" tabindex="0" data-state="${model.labels[j]}" aria-label="选择状态 ${model.labels[j]}"><circle cx="${x}" cy="${y}" r="${50*Math.sqrt(model.stationary_distribution[j])}" fill="${i===j?'#087f76':'#e3eee6'}" stroke="#087f76"/><text x="${x}" y="${y+5}" text-anchor="middle" fill="${i===j?'white':'#193333'}" font-size="14">${model.labels[j]}</text></g>`}
  $('network').innerHTML=svg+'</svg>'+(model.labels.length>16?'<p>网络仅画前 16 态；完整行概率见下表。</p>':'')
  $('network').querySelectorAll('[data-state]').forEach(g=>{const choose=()=>{$('origin').value=g.dataset.state;origin()};g.onclick=choose;g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}}})
  $('outgoing').innerHTML=table(['一个 lag 后到达','概率'],model.labels.map((x,j)=>[x,percent(model.transition_matrix[i][j])]))
  evolution()
}
function evolution(){let p=model.labels.map(x=>x===Number($('origin').value)?1:0);const n=Number($('steps').value);for(let k=0;k<n;k++)p=p.map((_,j)=>p.reduce((s,v,i)=>s+v*model.transition_matrix[i][j],0));$('step-label').textContent=`${n}（${number(n*model.lag_time)} ${model.time_unit}）`;bars('evolution',p)}
function target(){try{const result=mfptToState(model,Number($('target').value));$('mfpt').innerHTML=table(['出发态',`平均首达时间（${model.time_unit}）`],result.by_state.map(x=>[x.label,number(x.mean_time)]))}catch(e){$('mfpt').textContent=e.message}}
$('demo').onclick=()=>load(__TH_MSM_DEMO__,'教学示例 · 合成两状态马尔可夫链 · seed=msm-example')
$('origin').onchange=origin;$('target').onchange=target;$('steps').oninput=evolution
$('file').onchange=async()=>{try{const f=$('file').files[0];if(!f)return;if(f.size>8*1024*1024)throw new Error('模型 JSON 需小于 8 MiB');load(JSON.parse(await f.text()),f.name)}catch(e){fail(e)}}
$('download').onclick=()=>{if(!model){fail(new Error('请先打开示例或模型'));return}const url=URL.createObjectURL(new Blob([JSON.stringify(model,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='model.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('print').onclick=()=>window.print()
if(window.TH_MSM_INITIAL_MODEL)load(window.TH_MSM_INITIAL_MODEL,'随网页导出的模型')
