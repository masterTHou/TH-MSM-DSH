import { createServer } from 'node:http'
import { createDashboard } from '../lib/web/export.js'
const html = createDashboard()
const server = createServer((req, res) => {
  if (req.url !== '/' || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end(); return }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' })
  res.end(req.method === 'HEAD' ? undefined : html)
})
server.listen(0, '127.0.0.1', () => console.log(`TH-MSM: http://127.0.0.1:${server.address().port}/\nOpen this local URL in a browser. Ctrl+C stops the server. No project files are served.`))
