import { startServer } from './server'

const { port } = await startServer()
console.log(`Ciudad escuchando en ws://localhost:${port}`)
