# Trajectory Hub for Markov State Modeling (TH-MSM) v1.7.0

## 看懂 MSM：离线网页与交互教学

本版本增加无需安装运行环境的交互网页，也将网页导出接入 Codex / DSH 的自动工作流。

- 点击状态网络，查看一个 lag 后的去向与概率；点击转移矩阵，自动用一句话解释。
- 查看长期布居、选择目标态查看 MFPT，拖动滑块观察 `p(0)P^n` 分布演化。
- 展示慢衰减模式、ITS、留出轨迹 CK、RMSE、支持行数和中文验证结论。
- 支持导入自己的经典 `model.json`、下载模型及打印 / 保存 PDF。数据在浏览器本地处理，无 CDN 或云端上传。
- 新增 **th_msm_view**；完整 **th_msm_run** 自动输出 **dashboard.html**，记录实际产物路径和 visualize 阶段。

## 三分钟上手

1. 下载本 Release 的 **th-msm-web.html**，双击，用 Chrome / Edge / Firefox 打开。
2. 点击 **打开两状态教学示例**，先看矩阵，再看布居与 MFPT。
3. 有自己的 TH-MSM 模型时，点击 **导入自己的 model.json**。

插件里可以直接问：

> 请用 TH-MSM 生成交互网页。我是本科生，请用两状态示例解释状态、lag、布居、MFPT 和验证结论，每次讲一个概念。

> 把 output/msm/model.json 生成交互网页，保存到 output/my-msm.html，解释哪些动力学结论得到支持。

源码启动：`npm ci --ignore-scripts` → `npm run build` → `npm run web`，打开终端输出的本机网址。网页服务只提供页面，不暴露项目文件或执行接口。

[逐步网页使用手册](https://github.com/masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM/blob/v1.7.0/docs/WEB-UI.md) · [完整软件使用手册](https://github.com/masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM/blob/v1.7.0/docs/USER-MANUAL.md)

## 安装插件

Codex 新用户：

```sh
codex plugin marketplace add masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM --ref v1.7.0
codex plugin add th-msm@th-msm-plugins
```

已固定旧版本来源的用户按软件手册更新 marketplace。DSH 安装本 Release 的 `th-msm-dsh-plugin-1.7.0.tgz`。Codex 插件包附带 `web/index.html` 和离线网页手册。

## 已检查的范围与边界

本地检查包含网页示例加载、矩阵解释、目标态切换、分布演化、真实模型导入、负向诊断与坏模型报错，以及模型嵌入转义、MCP 导出、路径边界和独立工作流。支持宽屏双栏及窄屏单栏布局。

网页支持 2–128 态经典 MSM v1；导入模型限 8 MiB，网络与热图只展示前 16 态。网页用于解读和教学，建模仍使用插件 / Node 工作流；不直接读取 XTC/DCD 或非绝热 C1 数据。

两状态示例来自合成链。稳态布居不是光解分支比。导入时重算矩阵、布居和谱的一致性；没有原始轨迹时不能重新审计保存的 ITS/CK。通过有限检验不证明马尔可夫性，布居与 MFPT 尚无置信区间。
