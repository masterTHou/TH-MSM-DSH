import type { HopEvent, TrajectoryFrame } from '../../src/types/science.js'
import type { ClassicalDataset } from '../../src/msm/types.js'
import { fitMSM } from '../../src/msm/index.js'
const correct: HopEvent = { occurred: true, from_state: 1, to_state: 0 }
// @ts-expect-error non-hop events cannot carry state transitions
const incorrect: HopEvent = { occurred: false, from_state: 1, to_state: 0 }
declare const frame: TrajectoryFrame
// @ts-expect-error full nonadiabatic frames are not classical discrete trajectory datasets
fitMSM(frame)
// @ts-expect-error time units cannot be silently invented
const dataset: ClassicalDataset = { kind: 'classical-trajectories', origin: 'unbiased-md', trajectories: [[0, 1]], frame_time: 1, time_unit: 'unknown' }
void correct; void incorrect; void dataset
import type { WorkflowArgs } from '../../src/workflow/config.js'
const workflow: WorkflowArgs = { mode: 'msm', trajectoryPath: 'data.json', lagTime: 2 }
// @ts-expect-error script execution modes are intentionally bounded
const arbitraryMode: WorkflowArgs = { mode: 'shell' }
// @ts-expect-error lag is a frame count, not an implicit unit string
const ambiguousLag: WorkflowArgs = { lagTime: '5 ps' }
void workflow; void arbitraryMode; void ambiguousLag
