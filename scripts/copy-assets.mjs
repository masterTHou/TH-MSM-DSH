import { cp } from 'node:fs/promises'
await cp('src/knowledge/vector/papers.json', 'lib/knowledge/vector/papers.json')
