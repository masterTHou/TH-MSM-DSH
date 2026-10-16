import { dashboardTemplate } from './template.js'
import { validateMSM } from '../msm/validation.js'
export function createDashboard(model) {
  if (model && validateMSM(model).verdict === 'INVALID_MODEL') throw new Error('INVALID_MODEL: dashboard requires a consistent classical MSM')
  if (!dashboardTemplate) throw new Error('Run npm run build to generate the dashboard')
  const data = JSON.stringify(model ?? null).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  return dashboardTemplate.replace('/*TH_MSM_INITIAL_MODEL*/null', () => data)
}
