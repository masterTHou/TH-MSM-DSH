let raw = ''
for await (const chunk of process.stdin) raw += chunk
const request = JSON.parse(raw)
process.stdout.write(JSON.stringify({ msm: request.msm, args: request.args }))