# Trajectory Hub for Markov State Modeling (TH-MSM) v1.6.0

## MSM 脚本、环境自检与原生端到端自动化

- **th_msm_script**：生成可读 JS 入口、JSON 配置、自带运行核心、版本/摘要与许可说明；只生成，不执行。脚本离开 DSH/Codex 后只需 Node ≥22，不用 npm install。
- **th_msm_run**：环境/输入检查 → 生成脚本 → 经典 MSM 建模 → 分析 → ITS/CK → 报告、START-HERE、阶段日志与运行清单。
- **th_msm_env**：实际数值自检、PATH 原生 Node、项目写入与文件检查；checkPython=true 可检查常用 Python 依赖导入。
- 经典验证不支持或数据不足时保存 completed_with_limitations 与真实报告；计算成功与科学支持分开。

Codex 提供 13 个工具，DSH 提供 14 个。运行只使用插件的固定数值核心与严格配置，不提供任意生成代码执行或自动安装依赖。新结果目录不会覆盖旧结果，脚本/结果目录不能重叠；原生工作流输入限 64 MiB，基础模型仍为 2–128 态。默认受控运行限时 300 秒。

## 立即体验

```text
请用 TH-MSM 的端到端工具跑完整示例，mode=example。
先确认项目和环境，再生成可复现脚本，完成建模、分析、验证和报告。
使用新的输出目录，解释每个阶段并列出真实结果与科学结论。
```

专家可提供 mode=msm、trajectoryPath、lagTime、nClusters、holdoutFraction 和可选 targetState；只要脚本时明确“只生成，不执行”。

## 边界与验证

当前新工作流接受合成示例或经典离散/预提取特征 JSON，不直接提取 XTC/DCD，不执行 Python MSM、tICA/VAMP、可逆 MLE、PCCA/TPT。Python 包可导入不代表已接通这些流程。非绝热继续使用既有 C1 工具与科学约定。

验证包含独立脚本移到另一项目后的无依赖运行、与计算核心数值一致性、负向科学结论、环境/路径/配置/输入限制、输出不覆盖、取消/超时和真实 MCP 工作流调用。

[使用手册第 16 章](https://github.com/masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM/blob/v1.6.0/docs/USER-MANUAL.md#workflows) · [脚本与自动化指南](https://github.com/masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM/blob/v1.6.0/docs/WORKFLOWS.md)

## 安装

DSH 安装本 Release 的 `th-msm-dsh-plugin-1.6.0.tgz`。Codex 首次安装：

```sh
codex plugin marketplace add masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM --ref v1.6.0
codex plugin add th-msm@th-msm-plugins
```

已登记固定旧 tag 的用户请按手册第 2.3 节更新来源。两种包均附带离线手册与自动化指南。
