import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

test('package supports resolver-first hosts and imports all plugin tools', async () => {
  const require = createRequire(import.meta.url)
  for (const subpath of ['', '/engine', '/msm', '/education', '/decision']) {
    const specifier = '@th-msm/dsh-plugin' + subpath
    const entry = require.resolve(specifier)
    const direct = await import(specifier)
    assert.equal(await import(pathToFileURL(entry).href), direct)
  }
  const plugin = await import('@th-msm/dsh-plugin')
  const registered = []
  plugin.apply({
    shell: { sandboxMode: 'workspace-write' },
    get: () => ({}),
    tools: { register: tool => registered.push(tool), guard() {} },
    on() {},
    inject() {},
  })
  assert.equal(plugin.name, 'th-msm')
  assert.equal(new Set(registered.map(tool => tool.name)).size, 14)
})
