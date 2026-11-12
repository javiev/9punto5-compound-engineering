import { startServer } from './server'

const { port } = await startServer()
console.log(`Semáforo escuchando en ws://localhost:${port}`)
