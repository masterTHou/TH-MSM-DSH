# TH-MSM v1.5.0 — DSH 与 Codex，自由选择工作入口

同一科学核心，现在可在 DeepSeek Harness 或 Codex 中使用。

## Codex 新入口

- 本地插件 + MCP：11 个工具，涵盖向导、教学、文献检索、经典 MSM 建模/分析/验证/报告，以及解析 FC/FSSH/EDC/C1/WE。
- GitHub marketplace 已包含编译后的独立运行包；用户只需 Node.js ≥22，不用安装 DSH 或 npm 依赖。
- Agent Plugins 1.0 与 Codex 兼容清单；每轮 1–3 个问题的科学工作流 skill。
- 明确用户项目根目录，会话记忆隔离、同工作区调用排序、取消传播与结构化错误。

```sh
codex plugin marketplace add masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM --ref v1.5.0
codex plugin add th-msm@th-msm-plugins
```

重开 Codex 或新开对话并选择 TH-MSM，说：“我没有数据，带我跑第一个 MSM。”

## DSH 继续可用

安装 `th-msm-dsh-plugin-1.5.0.tgz`，保留 12 个工具与 DSH 的外部命令代理；包含 v1.4.1 的导入兼容修复。两个宿主共享轨迹、模型、验证与报告格式。

## 附件

- `th-msm-dsh-plugin-1.5.0.tgz`：DSH 安装包。
- `th-msm-codex-plugin-1.5.0.tar.gz`：独立 Codex 插件本体，适合团队已有 marketplace；一般用户可直接使用上面的 GitHub marketplace 命令。
- `SHA256SUMS.txt` 与 `PROVENANCE.json`：校验与验证记录。

## 验证与限制

通过真实 MCP stdio 发现与调用、经典 MSM 数值一致性、建模→分析→验证→报告，以及独立 worker 的非绝热 C1 流程测试。Windows Codex CLI 隔离配置验证了安装与缓存中的 MCP 服务；Codex app-server 确认插件/skill 已启用并发现全部 11 个工具。未声称已完成用户当前 GUI 对话的交互测试。

Codex 版不提供 DSH 外部 shell 命令代理或可选向量模型下载。非绝热 C2、外部 ES 传播与未经验证的加速比仍不提供。科学边界不因新增宿主而改变。GitHub 发布不是 OpenAI 公共插件目录上架。
