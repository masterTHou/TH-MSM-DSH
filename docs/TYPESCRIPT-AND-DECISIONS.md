# TypeScript 与结构化决策的取舍

## 为什么引入 TypeScript

项目同时处理非绝热完整帧、经典离散轨迹、估计模型、诊断与对话状态。类型可以在编译时阻止一部分跨领域误传，并帮助维护公开 API、自动补全与重构。

v1.4.0 采用渐进迁移：轨迹校验器、共享科学类型、新的 MSM 数值/估计/特征模块、教学内容、工作流决策与向导状态使用严格 TS。已有动力学、C1 与 DSH 适配模块继续作为 JS 输入统一编译。`allowJs:true`、`checkJs:false` 只用于迁移兼容，不声称旧 JS 全部经过严格类型检查。

`src/` 是源代码，`lib/` 是构建结果与声明文件，发布包入口为 lib/index.js。运行时仍是标准 JS，用户安装发布包无需本地 TypeScript 编译器。公开子路径提供 .d.ts：/engine、/msm、/education、/decision。

`npm run typecheck` 包含负向类型契约测试，验证未跳跃事件不能携带状态转换、非绝热帧不能当作经典数据、时间单位不能随意拼写。外部 JSON 仍必须经过运行时校验；TypeScript 无法证明物理正确性、马尔可夫性或统计无偏。

## 从 Jev 借鉴了什么

参考 [TypeSafe 官方 System One 文档](https://docs.typesafe.ai/concepts/system-one) 与 [官方发布说明](https://typesafe.ai/blog/introducing-system-one-models-and-jev)：把共享状态交给有限、类型明确的决策，然后由应用代码控制后续动作。

本项目采用这个接口思路：WorkflowDecision 保存选择、证据、备选项与下一工具；GuideState 保存当前用户目标和已知信息；GuideResponse 给出少量问题或可执行动作。明确的用户选择优先，规则冲突或信息不足时选择 clarify。

**没有接入在线 Jev API，也没有训练或复刻 Jev 模型。** 当前决策实现是本地可复现规则，得分不是概率，输出明确 `calibrated:false` 和 `probabilities:null`。不复制厂家关于性能或校准的营销结论。

这层只服务产品体验：任务路由、教学难度、补问信息、建议下一步。分子跃迁概率、WE 权重、MSM 数值、科学验证结论仍由数值代码和观测数据决定。AI 判断不能越过这些边界。

只有在获得代表性的真实对话评估集后，才值得比较在线 Jev 或其他分类器是否改善路由质量与用户完成率，同时核算延迟、费用、隐私与错误率；当前直接接入服务没有经过验证的收益。

## DSH 集成

使用已安装 DSH SDK 公开的 systemPrompt.section 和作用域 systemPrompt.context API，把对话说明与结构化决策真正送入提示词组装。没有此服务时，向导/教学/建模工具仍可直接调用；仅保留诊断字段不等于完整自动路由。实际桌面环境的人机体验仍需用户试用反馈。
