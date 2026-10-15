# TH-MSM v1.3.0 — 非绝热 C1 与解析模型验证基础版

这次更新把构建/验证的状态占位符替换为可运行的 FC→FSSH+EDC→Direct/WE/CI-WE→C1→真实报告闭环。

新增统一轨迹帧、复振幅/能隙校验、原样克隆与加权合并、PRNG checkpoint、吸收质量守恒、态/能隙/几何分箱、加权首达曲线、带方向的跃迁通量，以及 C_candidate/C_reachable/C_reactive 证据。Bootstrap 使用独立完整 runs；direct FC 轨迹支持 JSONL 流式输入。ES 尝试与解析模型调用分别计数。

内置标准单 CI 二维 LVC，以及明确标记为非线性扩展的双 CI 模型。提供独立 Node.js 科学 API、采样工具、可取消的计算 worker、真实保存的分析/报告与跨平台 CI。

## 已执行验证

- 本地 Node 24 / Windows：32 项测试，31 通过；1 项因文件符号链接权限明确跳过。
- 真实 DSH 工具定义与输出 schema、解析力/NAC 有限差分、hop 能量守恒、EDC 范数、WE 质量与合并概率、历史去重、检查点恢复、直接/WE/CI-WE 闭环均通过。
- 完整目标实验：10,000 条独立直接参考；三种方法各 20 个独立 runs。参考稀有通道首达概率 **2.24%**，95% Wilson 区间 **[1.9678%, 2.5489%]**。
- **没有观测到 CI-WE 效率优势。** 本实验 CI-WE 的成本归一化方差指标约为 Direct 的 2.39 倍，不能宣称加速。目标范围外的 3.73% 预实验也保留。

## 安装与附件

下载 `th-msm-dsh-plugin-1.3.0.tgz`，在 DSH 插件管理面板安装。源码使用 Node >=22：

```sh
npm ci --ignore-scripts
npm test
npm run demo
npm run benchmark:full
```

附件包括插件包、两套实验的原始事件/谱系/checkpoint 数据压缩包，以及 SHA256SUMS.txt。完整方法、公式与范围见仓库 docs/SCIENCE.md，实验汇总见 benchmarks/README.md。

## 范围与后续

这是 Phase 1 C1 与 Phase 4 的基础验证发布，WE 与统计诊断为实验功能。FSSH+EDC 是近似动力学；无偏性限定为 WE 相对于同一传播器。解析模型真实 ES 调用为零，不提供 ES 加速倍数。产物 sink 是声明的首达边界，不代表真实分子解离。

C2 吸收 MSM/ITS/CK、外部电子结构传播、严格预算运行器、完整 WE 运行恢复，以及跨 CI 产率的时间步系统收敛验证仍待完成。旧 msm 构建路径和未验证 Python 生成器明确返回不支持，不再伪造模型/CK 通过结果。
