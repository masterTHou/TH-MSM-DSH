# 仓库审查与非绝热采样引擎路线图

日期：2026-10-15（Asia/Shanghai）。本文件保留初次诊断快照。用户随后确认实施；v1.3.0 已实现 C1 与解析模型基础闭环、实验性 WE 及基础诊断，实际范围与延期项见 CHANGELOG.md、docs/SCIENCE.md 和 benchmarks/README.md。

## 1. 审查范围与基线

- 工作区：`D:\TH-MSM\th-msm-dsh-plugin`。
- 远端：`https://github.com/masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM.git`。
- 分支与提交：`main`，`0de4822`；fetch 后与 `origin/main` 差异为 0/0。
- 现有版本：package/plugin 均为 1.2.0；GitHub 最新 release 为 v1.2.0。
- 仓库共 40 个受 Git 跟踪文件；没有 AGENTS.md、GitHub Actions 工作流、实际 Python 源文件、动力学内核或 WE 调度器。
- 实现是 Node.js ESM；要求 Node >=22，当前执行环境 Node 24.19.0、npm 11.17.0。Python 仅存在于字符串脚本生成器与外部命令示例中。
- `npm test`：16 项，13 通过、3 失败。知识库 topic/level 过滤为真实缺陷；符号链接测试因 Windows EPERM 在创建阶段失败，未执行逃逸断言。
- `npm run check`：通过，但只检查部分文件的 JS 语法，不能证明运行时与物理正确性。
- 实际调用 `generateMsmScript()`：`ReferenceError: str is not defined`。
- `npm pack --dry-run --ignore-scripts --json`：31 个包内文件；已有 dist tgz 为 368366 字节。未安装依赖，也未修改运行代码。
- GitHub CLI (`gh`) 不在 PATH。远端读取正常；推送权限和 release 写入能力尚未验证。

## 2. 全部项目文件清单

以下为审查时所有 Git 跟踪文件；`.git/` 为版本库内部数据，未作为项目源文件逐项展开。忽略目录中另有 `dist/th-msm-dsh-plugin-1.2.0.tgz`。

```text
.gitignore
.npmignore
.th-msm/vector/papers.json
ADR.md
LICENSE
README.md
cordis.patch.yml
embed-with-api.mjs
examples/workspace/.th-msm/registry.json
examples/workspace/tools/echo.mjs
package.json
plugin.json
prebuilt/vector-db.json
src/agent/hooks.js
src/agent/loop.js
src/index.js
src/knowledge/catalog.js
src/knowledge/context.js
src/knowledge/index.js
src/knowledge/loader.js
src/knowledge/searcher.js
src/knowledge/vector/api-embedder.js
src/knowledge/vector/embedder.js
src/knowledge/vector/indexer.js
src/knowledge/vector/papers.json
src/knowledge/vector/retriever.js
src/knowledge/vector/store.js
src/registry/loader.js
src/runtime/executor.js
src/runtime/python.js
src/tools/build.js
src/tools/env.js
src/tools/knowledge.js
src/tools/msm.js
src/tools/plan.js
src/tools/report.js
src/tools/teach.js
src/tools/validate.js
src/util/text.js
test/core.test.mjs
```

三个大型 JSON 已解析其结构与向量维数：均包含 35 个 chunks，模型标记 `qwen3.7-text-embedding`，向量为 1024 维，每个文件 778713 字节。未逐一核验论文元数据的真实性。

## 3. 诊断与修复优先级

| 优先级 | 位置 | 实际行为及影响 | 修改方向 |
|---|---|---|---|
| P0 | `src/tools/build.js:90` | msm 模式不读文件、不执行计算，却返回 ok=true 与就绪状态 | 接入真实 C1 核心；旧模式未实现时明确返回 unsupported |
| P0 | `src/tools/validate.js:124` | 只生成 pending 模板，未加载模型；score/recommendation 返回 null 与声明类型不符 | 验证真实数据；未执行返回 not_run/insufficient_data，不提供伪评分 |
| P0 | `src/runtime/python.js:214` | JS 调用了 Python 的 str，生成器默认调用即抛异常；CK 直接写 passed placeholder | 隔离遗留功能、消除假通过；生成脚本需编译与执行验证 |
| P0 | `src/runtime/python.js:23`、`src/tools/env.js:87` | Python/包版本及可用性被硬编码，install 参数未执行 | 实测或 unknown；将本地解析模型与外部 ES 环境分别报告 |
| P0 | `src/tools/report.js:116` | 没写文件、没画图，却返回 saved 路径及生成图列表 | 只报告真实存在且成功写出的产物，保存数据来源 |
| P0 | `src/runtime/python.js:172`、`src/tools/plan.js` | 现有方案为平衡构象 MSM，reversible=True 与 π 不适合默认光解吸收任务 | C1 默认；C2 非可逆且吸收；平衡分析需显式选择独立用途 |
| P1 | 科学数据层缺失 | 无 R/P/c/active state、谱系、单位、首达账本、ES 计数 | 增加版本化 schema、checkpoint、run manifest 与事件账本 |
| P1 | `src/knowledge/vector/indexer.js` 与 `store.js` | 索引器调用 clear/upsert，静态 store 未实现；已有索引掩盖缺陷 | 统一读写接口，原子持久化与错误报告 |
| P1 | 向量模型 | 内置 1024 维、查询模型 384 维、API 假定 1536 维；维度不符时相似度静默归零 | 模型与维度校验、明确降级；API 可用性另行验证 |
| P1 | `src/knowledge/vector/store.js`、`retriever.js` | 模块单例绑定首次 workspace，可能串用后续工作区数据 | 按规范路径缓存与关闭 |
| P1 | `src/knowledge/loader.js`、`vector/indexer.js` | basePath 未用于 catalog 拼接，配置与 CLI 路径语义不一致 | 一个工作区路径解析器，统一根目录与越界限制 |
| P1 | `src/knowledge/searcher.js` | topic/level 仅影响分数，没有排除不匹配项；无关 query 也有默认分数 | 先严格筛选，再相关性排序 |
| P1 | `src/agent/loop.js` | 只写自定义 agent 属性，仓库内未见注入消费者；主要识别英文；模式配置未接入 | 验证主机真实契约，增加中文与光化学意图，避免宣称自动执行已完成 |
| P1 | `examples/workspace/.th-msm/registry.json` | 五个 Python 工作流命令指向不存在的文件 | 提供能运行的示例或标记为模板 |
| P1 | `package.json`、测试/打包 | 无 lockfile/CI；只测 16 项基础功能；无 DSH 工具 schema/集成/物理测试 | 增加跨平台 CI、物理测试、包内冒烟与可复现 benchmark |
| P2 | README/ADR/教学模块 | 文档存在工具数量、版本、真实执行与语义搜索能力不一致；教学 level 基本不改变内置解释 | 以实际可用能力更新文档，清理死代码与旧承诺 |

可复用部分：registry 白名单、JSON stdin、执行器的超时与错误分类、输出截断、既有插件注册方式。现有每轮工具调用计数绝不是 `total_es_calls`，两者必须分开。

依赖：三个 DSH peer dependencies 为 cordis、dsh-tools、schemastery；向量模块动态导入的 `@xenova/transformers` 没有在包中声明。生成 Python 脚本实际涉及 numpy、mdtraj、sklearn、deeptime，需另建明确的可选环境说明。第一版动力学核心使用纯 JS，避免为 C1/LVC 引入 Python 安装门槛。

## 4. 实现前固定的物理与统计契约

1. 仅接受 FC 分布初始化或真实父 checkpoint；记录初态分布、单位和参数。candidate 几何只改变分箱/资源分配，不能作为无动量轨迹源。
2. clone 深复制 R/P/c/active_state 及所有影响未来的积分器/退相干内部状态；只重新分配 PRNG stream。seed 是初始标识，checkpoint 还必须保存当前 PRNG 状态/计数器。
3. 每轮 WE 检验活轨迹质量 + 累积吸收质量 = 1，误差 <1e-12；不可只对存活者强制归一化。无 source recycling，吸收质量不会重新进入动力学。
4. merge 两条权重 w1/w2 的轨迹，以 w1/(w1+w2) 选择保留第一条完整状态，否则保留第二条；存活权重为 w1+w2。合并需要多父谱系记录，单个 parent_id 不够。
5. 首达只记第一次进入不可逆 sink 时的事件权重。后续 clone 不复制累计事件，merge 不抹掉已发生事件；不从最终叶节点重新累加整段历史。
6. hop flux 为带方向的加权事件数；频率须除以明确时间窗。重复跃迁与首达概率为不同量，不能互换。
7. `C_candidate` 为外部定义；`C_reachable` 需要轨迹访问证据；`C_reactive` 需要该区域实际 hop 及后续通向 sink 的谱系证据。若发生 merge，保留历史标签或使用有明确来源的加权历史重采样，不能把存活者路径套到所有父权重上。
8. 不依赖 CI 先验也记录全空间 hop map；访问/反应区域需附证据事件和时间窗，缺候选时不伪造归属。
9. Bootstrap 以独立完整 WE runs 为首选单位，不能把相关 clone 视为独立样本。单个 WE run 不提供伪独立置信区间。直接轨迹可按独立 FC trajectory 重采样。
10. provider 调用入口记录 ES 成本及请求量，探索、失败调用、初始化、传播与重试均入账；共享父帧与克隆快照不重复计费。缓存命中另计。解析模型 ES 真实调用为 0，另记 model_evaluations 与耗时，不能用 0/0 宣称量化加速。
11. FSSH+EDC 本身为近似动力学；“无偏”限定为 WE 相对于同一传播器/FC 分布的重采样无偏，不等于精确量子动力学。

### 2D LVC 测试台的必要修正

标准实对称双态二维 LVC：V(Q)=V0(Q)I+[[a(Q),b(Q)],[b(Q),-a(Q)]]，a、b 为仿射线性函数。简并要求 a=b=0；两条独立直线仅产生一个孤立 CI。共同谐振子项不改变此条件。

建议设两个明确命名的测试模型：

- `lvc_2d.js`：真正的标准 LVC，验证解析能量、梯度、耦合、FSSH/EDC 与单 CI 动力学。
- `dual_ci_2d.js`：显式标记为扩展的双通道模型，用非线性差势/耦合及势垒产生两个 CI，服务稀有通道 benchmark；不冒称标准 LVC。模型形式与参数先公开，1%–3% 只能是独立校准后观测到的目标范围，不写死在随机分支中。

10,000 条直接轨迹称为“直接轨迹参考估计”，附置信区间；p=0.01–0.03 时二项标准误差约为 0.0010–0.0017（绝对概率）。其有限样本误差与时间步/动力学近似误差均需保留。

## 5. 四阶段与文件的精确映射

| 阶段 | 新增核心模块 | 现有文件修改 | 验收证据 |
|---|---|---|---|
| Phase 1，C1 优先 | `src/core/frame.js`、`checkpoint.js`、`lineage.js`、`cost-ledger.js`、`src/analysis/partition.js`、`first-hit.js`、`hopping-flux.js`、`bootstrap.js`、`build-c1.js`、`src/io/trajectory.js` | `src/tools/build.js` 接 C1；`plan.js`/`report.js` 改为非平衡指标；`package.json` 导出核心 API | 手工可验小数据、吸收守恒、事件不重复、相关样本拒绝伪 CI、candidate/reachable/reactive 三集合 |
| Phase 1，C2 后置 | `src/analysis/counts.js`、`absorbing-msm.js`、`committor.js`、`finite-time-flux.js` | build 增加显式 c2 模式 | 解析吸收链、带谱系 lag 对、欠采样行/奇异求解报错、非可逆估计 |
| Phase 2 | `src/sampling/prng.js`、`resample.js`、`we-runner.js`、`src/interfaces/candidates.js`、`src/dynamics/provider.js` | `src/tools/sample.js`、`src/index.js`、`plugin.json`、`cordis.patch.yml` | clone/checkpoint 完整性、独立随机流、merge 期望、每轮质量守恒、断点复现 |
| Phase 3 | `src/validation/physics.js`、`markov.js`、`benchmark.js`、`stopping-rule.js` | `src/tools/validate.js`、`env.js`、`runtime/python.js`、`report.js` | 能漂/范数/EDC 诊断；瞬态 ITS 与 CK；失败自动回退 C1；同预算多独立运行统计 |
| Phase 4，与 C1 并行推进里程碑 | `src/models/lvc-2d.js`、`dual-ci-2d.js`、`src/dynamics/fssh.js`、`edc.js`、`direct-runner.js`；`test/models/lvc_2d.js` 为测试适配器；`scripts/benchmark.mjs` | `package.json` 增快速测试与长 benchmark 命令 | 解析力有限差分、电子归一化、能量守恒、hop 动量重标定、受挫 hop、时间步收敛、FC→传播→C1→验证报告 |

沿用已有 `test/` 命名，不另起一个不被 npm test 发现的 tests/ 树。可安装的模型放 `src/models/`，使 release 包也能运行示例。DSH 工具为薄适配层，核心模块不依赖 DSH 主机，可以直接用 Node 测试与运行 CLI。

C2 的吸收承诺概率由 (I-Q)q=r 求解；必须注明目标 sink、其他边界及无法确定的状态。吸收系统不以平衡 π 套用稳态 TPT；首版采用 FC 初态传播 p(t+τ)=p(t)P，计算有限时域状态间/吸收通量。若另实现标准稳态 TPT，需要独立定义 source/sink 和相应过程，不能混称。

统一 frame 保留用户指定全部字段，另配 run manifest/checkpoint/events：schema_version、run_id、root_id、单位、质量/坐标约定、复振幅 re/im、父边/重采样事件、first_hit、hop_id、PRNG 当前状态、EDC 参数及内部状态、累计成本。`delta_E_min` 从能量计算并校验，不能信任互相矛盾的输入。接受 JSONL 流式帧，避免 10,000 条长轨迹全部驻内存。

## 6. 确认后的首个实施批次

1. 修复会误导结果的占位状态、已有失败测试与环境状态；补齐 schema/工具返回契约测试。Windows 无符号链接权限时明确 skip，并在 Linux CI 真正执行该安全测试。
2. 实现 schema、单位、PRNG/checkpoint、成本账本、离散化与事件账本；先用精确构造数据验证 C1。
3. 实现标准 LVC 与 FSSH+EDC。核积分、电子子步进、沿 NAC 的 hop 能量重标定、受挫 hop 和 CI 奇点处理均显式配置与记录。EDC 通常是确定性阻尼，不能凭空引入随机 collapse；clone 的差异来自传播器实际随机步骤。
4. 先完成直接 FC→模型→轨迹文件→build C1→基础 validate→真实报告的闭环；加入最小 WE 重采样桥接作为 Phase 2 基础，才能真实运行 guided-WE 对照。C1+模型本身不足以声称完成 WE benchmark。
5. 双 CI 扩展模型先做参数校准，冻结参数后以独立随机种子跑 10,000 条参考轨迹；分别比较 Direct、普通 WE、CI-guided WE 的多个独立 runs。
6. 同一物理时间窗与预算规则下报告均值、方差、相对方差、参考误差影响下的 RMSE、真实成本和耗时；零命中标记不足，不能给出零方差/无限加速。预算不足时不删除未吸收质量或只统计完成者；明确 censoring/未完成状态。
7. 首个版本建议 v1.3.0 作为 C1/解析模型验证基础版。发布说明逐项列出 implemented、experimental、not_implemented；不把 C2 与完整 Phase 2/3 提前写成已完成。

## 7. CI、打包与发布计划

- 新增 `.github/workflows/ci.yml`：Windows/Linux、Node 22/24，语法全扫描、核心/物理/工具测试、npm pack 与解包冒烟。
- 长 benchmark 与快速 CI 分离，使用 `workflow_dispatch`，保存 manifest、种子、参数、结果 JSON 和成本报告；统计效率失败输出负向结论而非调参隐藏。
- 修订 README、ADR，新增 CHANGELOG 和科学方法说明；同步 package/plugin 版本。
- 使用 `codex/` 分支实现，验证完成后按用户已授权范围推送 GitHub，创建 tag/release、上传 tgz、SHA256 与复现实验说明。发布前再读取最新标签，避免覆盖版本。
- 用户已明确授权最终 GitHub 更新与 release；当前等待仅源于本次请求明确的“经我确认后”实施节点。此轮不推送审查草稿、不创建 release。

## 8. 方法来源

- Tully, Molecular dynamics with electronic transitions (1990), DOI: 10.1063/1.459170。
- Zhang, Jasnow & Zuckerman, The weighted ensemble path sampling method is statistically exact for a broad class of stochastic processes and binning procedures (2010), DOI: 10.1063/1.3306345；https://pmc.ncbi.nlm.nih.gov/articles/PMC2830257/ 。用于 WE 保留历史与重采样理论。
- Plasser et al., Highly efficient surface hopping dynamics using a linear vibronic coupling model (2019), DOI: 10.1039/C8CP05662E；https://pubs.rsc.org/en/content/articlehtml/2019/cp/c8cp05662e 。用于 LVC/表面跳跃/EDC 方法对齐。
- SHARC 官方方法文档：https://sharc-md.org/?page_id=1454 。实施时需锁定具体算法与版本。

访问限制：本轮检索取得上述文献摘要和官方搜索结果，PMC 正文返回验证码，RSC 正文返回 403；未声称已通读这些全文。双态二维线性简并条件的结论为本文展示方程的直接推导。
