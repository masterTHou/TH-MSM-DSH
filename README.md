# TH-MSM DSH v1.3.0

面向非绝热光化学路径的 **FC 采样、实验性 WE 与非平衡 C1 首达/跃迁通量分析**。既可作为 DeepSeek Harness 插件，也可独立使用 Node.js 科学内核。

此版本完成 Phase 1 的 C1 与 Phase 4 的解析测试基础闭环，并提供 Phase 2 的实验性重采样器和 Phase 3 的基础诊断。C2 吸收 MSM、ITS/CK、外部电子结构传播、严格预算运行器尚未实现；接口明确返回不支持，不伪造成功结果。

## 安装与运行

需要 Node.js >=22。源码开发：

```sh
git clone https://github.com/masterTHou/TH-MSM-DSH.git
cd TH-MSM-DSH
npm ci --ignore-scripts
npm test
npm run demo
```

demo 写出 `output/demo/run.json`、`analysis.json` 和 `validation.json`。默认 demo 是标准单 CI LVC；其 main/rare 是 y 方向的两个首达标签，不预设稀有分支比例。

```js
import { runSimulation, buildC1, validateRun } from '@th-msm/dsh-plugin/engine'

const run = runSimulation({
  mode: 'ci-we',
  model: 'dual-ci',
  fc: { center: [-2, -0.15], omega: 0.001 },
  nTrajectories: 64,
  seed: 'my-independent-run-1',
  dt: 0.5, // 原子时间单位，不是 fs
  steps: 1100,
})
const analysis = buildC1(run)
const validation = validateRun(run)
console.log(analysis.curves, validation.verdict, run.cost)
```

`buildC1(run, { bootstrapRuns: [...] })` 接受相同 protocol 的其他独立完整 runs；不把 clone 当作独立样本。

## 物理约束

- 从声明的 FC Gaussian Wigner 分布出发，或从完整真实 checkpoint 继续传播。
- WE split 原样复制 R/P/复振幅/活性态与传播历史；仅随机流改变。merge 以权重比例选择完整存活状态。
- 每轮检查存活质量 + 已吸收质量 = 1，误差 <1e-12；sink 不循环回源。
- 输出时间窗内加权首达概率与带方向的 hop map，不使用平衡 π 充当光解分支比。
- 分别保存 `C_candidate`、`C_reachable`、`C_reactive` 及访问/跃迁/产物证据。
- `total_es_calls` 统计 ES 尝试；解析模型另外统计 `model_evaluations`。本版内置模型没有真实 ES 调用，不提供 ES 加速倍数。

标准双态二维 LVC 具有一个孤立 CI；双 CI 测试模型明确采用非线性耦合。解析模型的吸收边界不证明真实分子完全解离。详见 [科学方法、单位、公式与限制](docs/SCIENCE.md)。

## DSH 工具

| 工具 | 实际能力 |
|---|---|
| `th_msm_sample` | 内置 FC FSSH+EDC 的 direct/we/ci-we 采样，保存真实 run JSON |
| `th_msm_build` | 默认 mode=c1，计算并保存首达曲线、hop map；可提供 bootstrapPaths |
| `th_msm_validate` | 读取 run JSON，检查质量、初态、能漂、范数与 EDC；ITS/CK 明确 not_run |
| `th_msm_report` | 从实际 run 保存 Markdown 报告，不返回虚构图片路径 |
| `th_msm_env` | 实测 Node/OS/内存；Python 状态 not_checked，ES provider not_connected |
| `th_msm_plan` | 对 reaction/electronic-properties 推荐 FC→WE→C1；其他目标保留构象规划 |
| `th_msm_knowledge` | 内置 35 条文献的关键词检索和中文关键词映射 |
| `th_msm_teach` | 内置 MSM 概念解释；不能代替科学验证 |
| `th_msm` | registry 白名单命令代理，JSON stdin 与沙箱执行边界 |

示例调用顺序：

```js
th_msm_sample({mode:'ci-we', model:'lvc', seed:'example', steps:1100})
th_msm_build({trajectoryPath:'output/run.json', outputPath:'output/c1.json'})
th_msm_validate({modelPath:'output/run.json'})
th_msm_report({title:'C1 analysis', modelPath:'output/run.json'})
```

从 [GitHub Releases](https://github.com/masterTHou/TH-MSM-DSH/releases) 下载 tgz，使用 DSH 插件管理面板安装。插件主机依赖为 `@deepseek-ai/cordis`、`@deepseek-ai/dsh-tools`、`@deepseek-ai/schemastery`；完整范围在 package.json。独立科学模块不导入这些主机包，也不要求 Python。

## 可复现实验与负向结果

```sh
npm run benchmark          # 小样本冒烟，不作科学结论
npm run benchmark:full     # 10,000 条参考 + 三种方法各 20 个独立 runs
```

完整实验冻结 FC/model/积分器/吸收边界，参考与评估种子独立；结果保存在 `output/benchmark/`。包含有限参考的 Wilson 区间、各方法均值/方差/相对方差/RMSE、独立-run bootstrap 和真实解析成本。

发布结果见 [benchmarks](benchmarks/README.md)。保留了目标区间外的预实验和缺少效率优势的结果。当前比较为 cost×variance 试验诊断，未实施严格相同 ES 预算调度，也未证明真实分子的加速。无命中或零方差时不输出无限加速。

## 目录

```text
src/core/        轨迹帧、守恒与 ES/解析成本账本
src/models/      标准 LVC、扩展双 CI 模型
src/dynamics/    FC 分布、FSSH、EDC、runner
src/sampling/    可保存状态的 PRNG、split/merge
src/analysis/    电子态/能隙/进度分箱、C1
src/validation/  物理诊断、基准统计、相同 ES 预算输入评估
src/io/          工作区边界检查与原子写入
src/tools/       DSH 薄适配层
src/knowledge/   文献关键词与可选向量模块
test/           安全、物理、统计和真实 DSH 工具契约测试
scripts/        demo、benchmark、全文件语法检查
benchmarks/     已执行实验汇总与来源说明
```

向量索引构建是可选功能，需自行安装 `@xenova/transformers` 并提供 catalog。预构建 1024 维向量与默认查询模型维度不符时明确降级为关键词检索；不会宣称已进行有效语义相似度计算。

## 开发、验证与打包

```sh
npm run check
npm test
npm pack --pack-destination dist
```

CI 在 Windows/Linux、Node 22/24 执行测试；Windows 无创建文件符号链接权限时该安全测试明确 skip，Linux 执行实际逃逸断言。手动 benchmark 工作流保存实验数据。真实 DSH 桌面部署及外部量化接口还需环境内验证。

详细变更见 [CHANGELOG](CHANGELOG.md)，诊断与后续路线图见 [审查文档](docs/REVIEW-AND-ROADMAP-2026-10-15.md)。MIT License。
