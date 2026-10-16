# Trajectory Hub for Markov State Modeling (TH-MSM) v1.5.2

## 从第一次提问到完整模型的软件使用手册

新增 `docs/USER-MANUAL.md`，为零基础使用者和熟悉 MSM 的研究人员提供：

- Codex/DSH 安装、更新与实际工具加载检查。
- 新建项目、路径写法、聊天提示词/终端命令/JSON 内容的区别。
- 可复制的首个 MSM 完整流程，以及默认种子的实测参考结果。
- 分层教学、自己的离散/特征数据、模型分析、验证与报告。
- 非绝热解析 C1/WE 示例、时间单位、独立重复与 Bootstrap 限制。
- 全部工具与参数、文件交付、故障排查、高级 API、DSH 注册命令和求助模板。

手册已从主 README、Codex README 和 skill 引用，并随两种插件包分发。Codex 包还包含手册引用的本地技术说明，离线可读。

[打开完整使用手册](https://github.com/masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM/blob/v1.5.2/docs/USER-MANUAL.md)

本次更新以文档和帮助入口为主，科学计算算法不变。说明中明确区分已执行功能与建议、计算成功与科学验证通过，不新增未实现方法的能力声明。

## 安装

DSH 使用 `th-msm-dsh-plugin-1.5.2.tgz`。Codex 首次安装：

```sh
codex plugin marketplace add masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM --ref v1.5.2
codex plugin add th-msm@th-msm-plugins
```

已有固定 tag 来源的用户，请按手册第 2.3 节更新。
