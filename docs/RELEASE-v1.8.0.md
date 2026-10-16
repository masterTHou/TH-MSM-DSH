# Trajectory Hub for Markov State Modeling (TH-MSM) v1.8.0

## 从一个分子开始，走完 MSM 全流程

新增正丁烷联合原子教学课：**结构 → 势能 → 真实动力学 → 特征与分箱 → MSM → 验证 → 结果解释**。

- 独立 Anaconda 环境，Python/OpenMM 单线程、4 个 CHₓ 站点，无 GPU 或深度学习依赖。
- 实际运行 12×200 ps，9 条训练、3 条整轨迹留出；复用现有 JS/TS MSM 核心。
- 网页新增七步课程、真实保存帧回放、六张 Python 科学图和通俗公式。
- 提供环境文件、完整脚本、版本冻结、原始数据与运行清单。
- `th_msm_view` 新增 `lessonPath`，导出自己的运行记录；与 modelPath 不一致时拒绝导出。

本机单次正式运行采样/建模/绘图约 **51.33 秒**，Python 峰值约 **130.48 MiB**，不含 Node 子进程、环境安装与系统缓存。默认 MD 时间预算 180 秒，保存帧和积分步数有硬上限，不自动增加采样或覆盖旧结果。

## 最简单的使用方法

1. 下载 **th-msm-web.html**，双击打开。
2. 点击 **打开正丁烷分子全流程**。
3. 按七步学习，拖动轨迹帧观察构象，再进入可点击的三态模型。

不需要先安装 Python。想自己重跑时，按 [完整分子教程](https://github.com/masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM/blob/v1.8.0/docs/BUTANE-TUTORIAL.md) 创建 Conda 环境并执行脚本。

本 Release 的 **th-msm-butane-reference-1.8.0.zip** 包含此次真实运行的坐标 NPZ、XYZ、模型、图像、运行清单和自包含网页；源码中的 `examples/butane` 保存较小的公开参考记录。

插件提示词：

> 我是本科生，请打开正丁烷分子全流程网页，按建结构、势能、动力学、特征、MSM、验证和分析七步教我。每次讲一步，再问一个小问题。

> 请把 output/my-butane/lesson.json 作为 lessonPath 生成网页，检查模型与图像属于这次运行。

## 诚实呈现结果

这是局部 OPLS-style 势能的孤立四站点教学模型，不是实验正丁烷速率或完整全原子力场验证。无非绝热跃迁、无偏置采样、无电子结构调用。

当前 ITS/CK 在测试 lag 上通过，但训练布居与同一势能的 Boltzmann 参考仍有约 **9.11 个百分点**的最大差。网页明确展示此有限采样偏差，不把验证通过说成布居、MFPT 或马尔可夫性已经获得严格证明。布居与 MFPT 尚无置信区间。

验证覆盖势能、有限差分力、几何和周期角、保存帧与坐标的一致性、进程内存测量，以及公开轨迹重建模型、自定义离线网页和插件打包。CI 新增独立 Python 数值检查。

[完整软件手册](https://github.com/masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM/blob/v1.8.0/docs/USER-MANUAL.md) · [网页手册](https://github.com/masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM/blob/v1.8.0/docs/WEB-UI.md)

## 安装

DSH 安装 `th-msm-dsh-plugin-1.8.0.tgz`。Codex 新用户：

```sh
codex plugin marketplace add masterTHou/Trajectory-Hub-for-Markov-State-Modeling-TH-MSM --ref v1.8.0
codex plugin add th-msm@th-msm-plugins
```

已固定旧 tag 的用户按软件手册更新 marketplace。网页查看不启动 Python；重跑 MD 使用源码工作区和用户选定的环境。
