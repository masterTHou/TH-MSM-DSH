# Trajectory Hub for Markov State Modeling (TH-MSM)

**Codex local plugin**

**不知道怎么提问？** 阅读随包附带的 [完整使用手册](docs/USER-MANUAL.md)。新手直接复制 [第一次运行提示词](docs/USER-MANUAL.md#first-model)；熟悉 MSM 的用户可查 [参数速查](docs/USER-MANUAL.md#tools)。

本地 MSM 建模、动力学分析、教学与实验性非绝热 C1/WE。Node.js ≥22；不需要安装 DSH、Python 或额外 AI API Key。

通过项目的 GitHub marketplace 安装：

```sh
codex plugin marketplace add masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM --ref v1.6.0
codex plugin add th-msm@th-msm-plugins
```

重开 Codex 或新建对话、选择 TH-MSM，然后说：“我没有数据，带我跑第一个 MSM。”给出自己的项目绝对路径，数据与结果将保存在项目中。

提供 13 个 MCP 工具；不包含 DSH 外部命令代理或可选向量索引构建。科学概率来自计算核心，工作流路由不改变跃迁概率或 WE 权重。经典稳态布居不能解释为光解分支比。非绝热 C2 与外部量化软件传播尚未实现。

程序运行包位于 `server/index.mjs`，MCP stdout 只输出协议。根 `plugin.json`/`mcp.json` 是 Agent Plugins 1.0 格式；隐藏兼容清单服务于较早的 Codex 加载器。此独立插件包不包含 marketplace 包装。

[完整安装、工具与科学边界](https://github.com/masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM/blob/v1.6.0/docs/CODEX.md) · [项目主页](https://github.com/masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM)
