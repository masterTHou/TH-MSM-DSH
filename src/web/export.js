import { dashboardTemplate } from './template.js'
import { validateMSM } from '../msm/validation.js'
import { validateLesson } from './lesson-validation.js'
export function createDashboard(model, options = {}) {
  if (model && validateMSM(model).verdict === 'INVALID_MODEL') throw new Error('INVALID_MODEL: dashboard requires a consistent classical MSM')
  if (!dashboardTemplate) throw new Error('Run npm run build to generate the dashboard')
  const lesson = options.lesson ? validateLesson(options.lesson) : null
  if (lesson && model && JSON.stringify(model) !== JSON.stringify(lesson.model)) throw new Error('LESSON_MODEL_MISMATCH')
  const safe = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  return dashboardTemplate.replace('/*TH_MSM_INITIAL_MODEL*/null', () => safe(model ?? null)).replace('/*TH_MSM_CUSTOM_LESSON*/null', () => safe(lesson))
}
