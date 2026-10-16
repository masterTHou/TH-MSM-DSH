// Recorded publication run; this module never starts MD in a browser.
const data = window.TH_MSM_CUSTOM_LESSON ?? __TH_MSM_MOLECULE__
const $ = id => document.getElementById(id)
const fmt = x => Number(x.toPrecision(4)).toString()
const VERDICTS = {SUPPORTED_AT_TESTED_LAGS:'在已测试 lag 上得到支持',INSUFFICIENT_DATA:'数据不足，暂时无法判断',MARKOV_ASSUMPTION_UNSUPPORTED:'当前马尔可夫假设未获支持'}
const COLORS = ['#087f76', '#bc862c', '#8666a8']
const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0)
const minus = (a,b) => a.map((v,i)=>v-b[i])
const norm = a => {const n=Math.hypot(...a);return a.map(v=>v/n)}
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
function image(i,alt) {return `<figure><img class="science-figure" src="${data.figure_images[i]}" alt="${alt}" loading="lazy"><figcaption>${alt}。由本次发布的实际轨迹和模型生成。</figcaption></figure>`}
function step(n,title,question,body) {return `<article id="mol-step-${n}" class="card lesson-step"><p class="eyebrow">MOLECULAR LAB / ${n} OF 7</p><h2>${title}</h2><p class="question">${question}</p>${body}</article>`}
function renderStructure(index) {
  const x=data.preview.coordinates_nm[index],base=x[1],ex=norm(minus(x[2],base)),v=minus(x[0],base),ey=norm(v.map((a,i)=>a-dot(v,ex)*ex[i])),ez=cross(ex,ey)
  const aligned=x.map(p=>{const r=minus(p,base);return [dot(r,ex),dot(r,ey),dot(r,ez)]})
  const yaw=Number($('mol-view').value)*Math.PI/180
  const p=aligned.map(([x,y,z])=>[170+750*(x*Math.cos(yaw)+z*Math.sin(yaw)),155-600*(.85*y+.35*(-x*Math.sin(yaw)+z*Math.cos(yaw)))])
  let svg='<svg viewBox="0 0 460 320" role="img" aria-label="四站点正丁烷；中央键对齐；氢并入 CHx 站点">'
  for(let j=0;j<3;j++)svg+=`<line x1="${p[j][0]}" y1="${p[j][1]}" x2="${p[j+1][0]}" y2="${p[j+1][1]}" stroke="${j===1?'#bc862c':'#8aa397'}" stroke-width="${j===1?8:5}"/>`
  for(let j=0;j<4;j++)svg+=`<circle cx="${p[j][0]}" cy="${p[j][1]}" r="23" fill="${j===0||j===3?'#087f76':'#53736b'}"/><text x="${p[j][0]}" y="${p[j][1]+5}" fill="white" font-size="13" text-anchor="middle">C${j+1}</text><text x="${p[j][0]}" y="${p[j][1]+44}" font-size="13" text-anchor="middle">${j===0||j===3?'CH₃':'CH₂'}</text>`
  $('mol-structure').innerHTML=svg+'</svg>'
  $('mol-time').textContent=`${fmt(data.preview.time_ps[index])} ps · φ = ${fmt(data.preview.phi_degrees[index])}° · ${data.state_names[data.preview.states[index]]}`
  $('mol-time').style.color=COLORS[data.preview.states[index]]
}
export function installMoleculeLesson(loadModel) {
  let timer
  const stop=()=>{clearInterval(timer);timer=undefined;if($('mol-play'))$('mol-play').textContent='播放已记录轨迹'}
  const hide=()=>{stop();$('molecular-lesson').hidden=true}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()})
  $('molecule').onclick=()=>{
    stop();loadModel(data.model, window.TH_MSM_CUSTOM_LESSON ? '正丁烷 · 本次运行记录' : '正丁烷 · 随版本发布的 MD 记录')
    const m=data.manifest,s=data.settings,model=data.model
    const commands='conda env create -f tutorials/butane/environment.yml\nconda activate th-msm-tutorial\nnpm ci --ignore-scripts\nnpm run build\npython tutorials/butane/run.py --output output/my-butane\nnode tutorials/butane/export-view.mjs output/my-butane'
    $('molecular-lesson').innerHTML=`<section class="lab-heading"><p class="eyebrow">A REAL MOLECULAR WORKFLOW · 一次真实运行的记录</p><h2>跟着正丁烷，走完 MSM 全流程</h2><p>先在 Python / OpenMM 中积分分子运动，再从轨迹建立模型。网页回放记录并解释结果，不在浏览器后台运行 MD。</p><nav class="lesson-nav" aria-label="分子教程导航">${['建分子','定势能','跑动力学','提特征','建 MSM','查验证','读结果'].map((x,i)=>`<a href="#mol-step-${i+1}">${i+1} ${x}</a>`).join('')}</nav><div class="metrics">${[[4,'联合原子站点，无显式氢'],[`${m.n_trajectories} × ${m.production_ps_per_trajectory} ps`,'独立生产轨迹'],[`${fmt(m.total_wall_seconds_through_plots)} s`,'采样、建模及绘图实测'],[`${fmt(m.python_peak_memory_mib)} MiB`,'Python 峰值工作集，不含 Node']].map(([x,t])=>`<div class="metric"><strong>${x}</strong><span>${t}</span></div>`).join('')}</div><p class="explain">孤立的四站点教学模型；无溶剂、无电子结构计算。速率依赖简化势能和恒温摩擦，不能当作实验正丁烷速率。</p></section>`+
    step(1,'建分子：为什么选正丁烷？','一个中间键的转动，就能把“小链条”折成不同形状。',`<p>CH₃–CH₂–CH₂–CH₃：把每个 CHₓ 基团作为一个站点，氢的质量并入站点。这是联合原子表示，不是四个裸碳。保留三个固定键长、两个可弯曲键角和一个中央扭转角。</p><div class="grid"><div><div id="mol-structure"></div><p id="mol-time" aria-live="polite"></p><label>轨迹帧 <input id="mol-frame" type="range" min="0" max="${data.preview.time_ps.length-1}" value="0"></label><label>视角 <input id="mol-view" type="range" min="-50" max="50" value="20"></label><button id="mol-play">播放已记录轨迹</button></div><div><h3>三种构象</h3><p><strong>trans（状态 0）</strong>：二面角靠近 ±180°。<br><strong>gauche+（状态 1）</strong>：靠近 +60°。<br><strong>gauche−（状态 2）</strong>：靠近 −60°。</p><p>金色是中央 C2–C3 键。中央键与第一个站点方向已对齐，去掉分子整体翻转，方便观察内部变化。视角只改变投影。</p><p>显示第一条轨迹前 ${data.preview.time_ps.at(-1)} ps 的实际保存帧，每 ${data.preview.frame_time_ps} ps 一帧；播放速度与物理时间无关。</p></div></div>`)+
    step(2,'定势能：哪种形状更舒服？','势能像地形：谷底偏好，山脊阻碍构象变化。',`<div class="formula">U(φ) = ½[V₁(1+cosφ) + V₂(1−cos2φ) + V₃(1+cos3φ)]</div><p>V₁/V₂/V₃ = ${s.torsion_V_kj_mol.map(fmt).join(' / ')} kJ/mol；键角势为 ½kθ(θ−θ₀)²。键长 ${s.bond_nm} nm，平衡键角 ${fmt(s.angle_degrees)}°。参数采用公开文献的局部 C–C–C–C 项，完整约定与来源在手册中；没有调低势垒来增加跳转。</p>${image(0,'中央二面角的势能曲线及三态区域')}`)+
    step(3,'跑动力学：热运动如何翻过势垒？','每一小步用力改变速度，再用速度改变位置。',`<div class="formula">F = −∇U<br>m dv = F dt − γm v dt + √(2γm kBT) dW</div><p>三项依次是势能力、热浴阻力、热浴随机踢动。T = ${m.temperature_k} K，γ = ${s.friction_ps_inverse} ps⁻¹，积分步长 ${s.dt_fs} fs。独立随机流；无偏置、无权重修正。</p><p>每条先平衡 ${m.equilibration_ps_per_trajectory} ps 并丢弃，再采样 ${m.production_ps_per_trajectory} ps，每 ${m.frame_time_ps} ps 保存。轨迹边界保留，不能把上一条末帧接到下一条首帧。</p>${image(1,'第一条生产轨迹的实际二面角')}<details><summary>检查采样与数值误差</summary>${image(2,'全部 MD 帧分布与同一势能的 Boltzmann 分布')}<p>平衡参考 ∝ exp[−U(φ)/(RT)]，针对本模型，不是实验真值。保存帧彼此相关；逐轨迹占比在运行清单中。</p><p>恒温 MD 能量可以波动。额外 NVE 检查：${m.nve_diagnostics.map(x=>`${x.dt_fs} fs 步长，2 ps 最大 |ΔE|=${fmt(x.max_abs_energy_change_kj_mol)} kJ/mol`).join('；')}。短段检查不能证明长期收敛。</p></details>`)+
    step(4,'提特征与分箱：给每一帧贴标签','先问“中央键转了多少”，再把相似构象放进一个箱。',`<div class="formula">R(t) → φ(t) = dihedral(C1,C2,C3,C4) → s(t) ∈ {0,1,2}</div><p>三态边界：|φ| ≥ 120° 为 trans；0° ≤ φ &lt; 120° 为 gauche+；−120° &lt; φ &lt; 0° 为 gauche−。±180° 是同一方向，必须周期处理。采用物理分箱，未运行 tICA/PCCA/聚类。</p><p>以后若对角度聚类，可用 (sinφ, cosφ)，避免把 −179° 与 +179° 当作相距很远。</p><p>trajectory-data.npz 保存坐标、角度、能量与状态；discrete-trajectories.json 接入项目现有 MSM 核心。</p>`)+
    step(5,'建立 MSM：从次数到概率','计数矩阵是账本，转移矩阵是每一行的比例。',`<div class="formula">Cᵢⱼ(τ) = Σₜ 1[s(t)=i, s(t+τ)=j]<br>Pᵢⱼ(τ) = Cᵢⱼ / Σⱼ Cᵢⱼ</div><p>Σ 表示把观察加起来；1[条件] 表示满足条件记 1，否则记 0。</p><p>lag = ${model.lag_time} ps = ${model.lag_frames} 个保存间隔，区别于 ${s.dt_fs} fs 的积分步长。前 ${model.provenance.training_trajectories} 条用于训练，后 ${model.provenance.validation_trajectories} 条完整轨迹留出做 CK。使用非可逆行归一化 MLE，没有伪计数。</p>${image(3,'实际矩阵、全部帧占比与模型布居')}<button id="mol-jump">跳到可点击的三态模型 ↓</button>`)+
    step(6,'验证 MSM：是否还记得过去？','若状态划分丢失重要信息，“只看现在”就可能不够。',`<div class="formula">ITS：tᵢ = −τ / ln|λᵢ|<br>CK：P(kτ) ≈ [P(τ)]ᵏ</div><p>λ 是转移矩阵的特征值；接近 1 的慢模式表示初态记忆消失较慢。ITS 比较不同 lag 的慢衰减时间；CK 比较多步预测与留出轨迹。默认 lag 预先指定，不根据是否通过偷偷挑选结果。</p>${image(4,'多个 lag 的 ITS 与默认 lag 的留出 CK')}<p class="explain">实际结论：${VERDICTS[data.analysis.validation.verdict]}（${data.analysis.validation.verdict}）。CK 容差 ${model.validation.ck_tolerance}，每行最少 ${model.validation.min_counts_per_row} 条观察。通过仅表示这些有限检查支持模型，不证明马尔可夫性或统计精度。</p>`)+
    step(7,'读结果：偏好哪种构象，多久能到？','长期待在哪里、变化有多慢、第一次到达多久，是三个问题。',`<div class="formula">πP = π，Σᵢπᵢ = 1<br>MFPT：mᵢ = τ + Σⱼ≠目标 Pᵢⱼmⱼ；m目标 = 0</div><p>训练模型布居：${model.stationary_distribution.map((p,i)=>`${data.state_names[i]} ${(p*100).toFixed(1)}%`).join('；')}。下图给出起点至目标的平均首次到达时间。</p><p class="explain">采样仍有限：模型布居与同一势能的 Boltzmann 参考的最大差约 ${fmt(100*Math.max(...model.stationary_distribution.map((v,i)=>Math.abs(v-m.theoretical_torsion_boltzmann_populations[i]))))} 个百分点。ITS/CK 通过不代表布居已充分收敛。</p>${image(5,'各起点到各目标态的模型 MFPT')}<p>这些是没有置信区间的点估计；粗粒化、恒温摩擦和有限采样都会影响动力学。经典布居不是光解分支比；本例没有非绝热跃迁。</p><details><summary>自己重跑：复制终端命令</summary><pre>${commands}</pre><p>在仓库根目录运行，最后双击结果目录 dashboard.html。输出目录必须全新。默认单线程，总生产采样 2.4 ns，MD 时间预算 180 秒；实际耗时随电脑变化。重跑导出器会嵌入本次轨迹、图像和模型，请核对运行清单。</p></details><details><summary>完整运行清单</summary><pre id="mol-manifest"></pre></details>`)
    $('molecular-lesson').hidden=false;$('mol-manifest').textContent=JSON.stringify(m,null,2)
    $('mol-frame').oninput=()=>renderStructure(Number($('mol-frame').value));$('mol-view').oninput=()=>renderStructure(Number($('mol-frame').value))
    $('mol-play').onclick=()=>{if(timer){stop();return}$('mol-play').textContent='暂停回放';timer=setInterval(()=>{const n=(Number($('mol-frame').value)+1)%data.preview.time_ps.length;$('mol-frame').value=n;renderStructure(n)},200)}
    $('mol-jump').onclick=()=>$('results').scrollIntoView({behavior:'smooth'})
    renderStructure(0);$('molecular-lesson').scrollIntoView({behavior:'smooth'})
  }
  return hide
}
