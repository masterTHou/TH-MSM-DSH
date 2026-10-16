"""Figures and compact, auditable lesson data from actual MD and MSM results."""
import json
import math
import base64
import hashlib
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

COLORS = ["#087f76", "#bc862c", "#8666a8"]
NAMES = ["trans", "gauche+", "gauche-"]
plt.rcParams.update({"font.size": 11, "axes.spines.top": False, "axes.spines.right": False, "axes.facecolor": "#fbfcf8", "figure.facecolor": "#fbfcf8", "axes.titleweight": "bold", "savefig.dpi": 135})


def make_report(out, settings, manifest, phis, coords, energies):
    from run import torsion_energy, state_of, R_KJ
    model = json.loads((out/"model.json").read_text(encoding="utf-8"))
    analysis = json.loads((out/"analysis.json").read_text(encoding="utf-8"))
    scan = json.loads((out/"lag-scan.json").read_text(encoding="utf-8"))
    figures = out/"figures"; figures.mkdir()
    def save(name):
        plt.tight_layout(); plt.savefig(figures/(name+".png")); plt.close()
    grid = np.linspace(-math.pi,math.pi,720)
    fig, ax = plt.subplots(figsize=(8,3.8))
    for a,b,color in [(-180,-120,COLORS[0]),(-120,0,COLORS[2]),(0,120,COLORS[1]),(120,180,COLORS[0])]:
        ax.axvspan(a,b,color=color,alpha=.1)
    ax.plot(np.degrees(grid),torsion_energy(grid),color=COLORS[0],lw=2.5)
    ax.set(xlabel="C1-C2-C3-C4 dihedral (degrees)",ylabel="Torsional potential (kJ/mol)",title="One central bond, three conformational basins",xlim=(-180,180))
    save("01-potential")
    fig, ax = plt.subplots(figsize=(8,3.8))
    time = np.arange(phis.shape[1])*settings["save_ps"]
    ax.scatter(time,np.degrees(phis[0]),c=np.array(COLORS)[state_of(phis[0])],s=3,rasterized=True)
    ax.axhline(120,color="gray",ls=":");ax.axhline(-120,color="gray",ls=":");ax.axhline(0,color="gray",ls=":")
    ax.set(xlabel="Production time (ps)",ylabel="Dihedral (degrees)",ylim=(-180,180),title="Actual Langevin MD: trajectory 0")
    save("02-trajectory")
    fig, ax = plt.subplots(figsize=(8,3.8))
    hist,bins=np.histogram(phis.ravel(),bins=72,range=(-math.pi,math.pi),density=True)
    density=np.exp(-torsion_energy(grid)/(R_KJ*settings["temperature_k"]));density/=(np.trapezoid(density,grid) if hasattr(np,"trapezoid") else np.trapz(density,grid))
    ax.bar(np.degrees((bins[:-1]+bins[1:])/2),hist,width=4.6,color=COLORS[0],alpha=.5,label="All saved MD frames")
    ax.plot(np.degrees(grid),density,color=COLORS[1],lw=2,label="Normalized exp(-U(phi)/RT)")
    ax.set(xlabel="Dihedral (degrees)",ylabel="Probability density (rad^-1)",title="Sampling check against this model's equilibrium distribution")
    ax.legend();save("03-distribution")
    fig,axes=plt.subplots(1,2,figsize=(9,3.8))
    im=axes[0].imshow(model["transition_matrix"],vmin=0,vmax=1,cmap="YlGnBu")
    for i,row in enumerate(model["transition_matrix"]):
        for j,value in enumerate(row):axes[0].text(j,i,f"{value:.3f}",ha="center",va="center",color="white" if value>.6 else "black")
    axes[0].set(xticks=range(3),xticklabels=NAMES,yticks=range(3),yticklabels=NAMES,xlabel="State after lag",ylabel="Current state",title=f"P at lag = {model['lag_time']:g} ps")
    fig.colorbar(im,ax=axes[0],fraction=.045)
    x=np.arange(3)
    axes[1].bar(x-.25,manifest["empirical_populations_all_trajectories"],.25,color=COLORS[0],label="All MD frames")
    axes[1].bar(x,model["stationary_distribution"],.25,color=COLORS[1],label="Training MSM")
    axes[1].bar(x+.25,manifest["theoretical_torsion_boltzmann_populations"],.25,color=COLORS[2],label="Potential-only equilibrium")
    axes[1].set(xticks=x,xticklabels=NAMES,ylabel="Population",ylim=(0,1),title="Population is not a rate");axes[1].legend(fontsize=8)
    save("04-msm")
    fig,axes=plt.subplots(1,2,figsize=(9,3.8))
    for mode in range(2):
        pts=[(s["lag_ps"],s["timescales_ps"][mode]) for s in scan if "timescales_ps" in s and len(s["timescales_ps"])>mode and s["timescales_ps"][mode] is not None]
        if pts:axes[0].plot(*np.array(pts).T,"o-",label=f"Mode {mode+1}")
    axes[0].set(xlabel="Lag time (ps)",ylabel="Decay time (ps)",title="ITS scan (training trajectories)");axes[0].legend()
    ck=model["validation"]["ck"]
    valid=[c for c in ck if c["weighted_rmse"] is not None]
    if valid:axes[1].bar([str(c["multiple"])+" x lag" for c in valid],[c["weighted_rmse"] for c in valid],color=COLORS[0])
    axes[1].axhline(model["validation"]["ck_tolerance"],color="#b33b26",ls="--",label="Configured tolerance")
    axes[1].set(ylabel="Weighted RMSE",title="CK test (held-out whole trajectories)");axes[1].legend(fontsize=8)
    save("05-validation")
    fig,ax=plt.subplots(figsize=(8,3.8))
    for target,result in enumerate(analysis["mfpt"]):
        vals=[row["mean_time"] for row in result["by_state"]]
        ax.bar(np.arange(3)+(target-1)*.24,vals,.24,label="Target "+NAMES[target],color=COLORS[target])
    ax.set(xticks=range(3),xticklabels=NAMES,ylabel="Mean first-passage time (ps)",title="How long until the first arrival? (Model estimate)")
    ax.legend(fontsize=8);save("06-mfpt")
    # Preview preserves the actual order of frames, not interpolation into fake MD.
    stride=max(1,round(1/settings["save_ps"]))
    indices=np.arange(0,min(len(phis[0]),1001),stride)
    lesson={"schema_version":1,"title":"正丁烷：从四个站点到三态 MSM", "state_names":NAMES, "model":model,"analysis":analysis,"lag_scan":scan,"manifest":manifest,"settings":settings,"preview":{"frame_time_ps":settings["save_ps"]*stride,"time_ps":(indices*settings["save_ps"]).tolist(),"phi_degrees":np.degrees(phis[0,indices]).round(4).tolist(),"coordinates_nm":coords[0,indices].round(6).tolist(),"states":state_of(phis[0,indices]).tolist()},"figures":[p.name for p in sorted(figures.glob("*.png"))]}
    lesson["figure_images"] = ["data:image/png;base64,"+base64.b64encode(p.read_bytes()).decode("ascii") for p in sorted(figures.glob("*.png"))]
    lesson["figure_sha256"] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(figures.glob("*.png"))}
    (out/"lesson.json").write_text(json.dumps(lesson,ensure_ascii=False,indent=2,allow_nan=False)+"\n",encoding="utf-8")
    rows="\n".join(f"| {NAMES[i]} | {model['stationary_distribution'][i]:.4f} | {manifest['empirical_populations_all_trajectories'][i]:.4f} | {manifest['theoretical_torsion_boltzmann_populations'][i]:.4f} |" for i in range(3))
    text=f"""# 正丁烷全流程实际运行结果

模型：四站点联合原子孤立正丁烷，OPLS-style 局部参数。温度 {settings['temperature_k']:g} K，摩擦系数 5 ps⁻¹。

{manifest['n_trajectories']} 条独立轨迹，每条先平衡 {manifest['equilibration_ps_per_trajectory']:g} ps，再生产 {manifest['production_ps_per_trajectory']:g} ps；保存间隔 {settings['save_ps']:g} ps，MSM lag {model['lag_time']:g} ps。

训练 / 留出轨迹：{model['provenance']['training_trajectories']} / {model['provenance']['validation_trajectories']}。验证结论：**{analysis['validation']['verdict']}**。

| 构象 | 训练 MSM 长期布居 | 全部 MD 帧占比 | 同一扭转势的 Boltzmann 积分 |
|---|---:|---:|---:|
{rows}

三个数来自不同估计，有限采样下不必完全一致。理论积分针对本模型，不是实验参考真值。

MD 耗时 {manifest['md_wall_seconds']:.2f} s；Python 峰值工作集 {manifest['python_peak_memory_mib']} MiB；单线程 {manifest['platform']} 平台。峰值不包含 Node 子进程与系统文件缓存。电子结构调用 0；没有可声明的量化计算加速比。

恒温 MD 的总能量会与热浴交换，不能要求它逐步守恒。额外 2 ps NVE 检查的原始结果见 manifest.json，两个步长各一条短段只作数值诊断，不能证明长轨迹收敛。

## 图像

"""+"\n\n".join(f"![{p.stem}](figures/{p.name})" for p in sorted(figures.glob("*.png")))+"\n\n## 边界\n\n"+"\n".join("- "+x for x in manifest["limits"])+"\n"
    (out/"RESULTS.md").write_text(text,encoding="utf-8")
