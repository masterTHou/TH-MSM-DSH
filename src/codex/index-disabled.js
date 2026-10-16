export async function checkIndex() { throw new Error('Codex build mode=index is not supported; use th_msm_knowledge for bundled keyword search.') }
export const buildIndex = checkIndex
