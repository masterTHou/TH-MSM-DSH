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
