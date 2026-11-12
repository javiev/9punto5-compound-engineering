import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'
import { test } from 'node:test'
import { WebSocket } from 'ws'
import { parseState } from '@semaforo/shared'
import { startServer } from './server'

const TICK = 100
const durations = { rojo: TICK, verde: TICK, amarillo: TICK }

/** Arranca un servidor con ciclo rápido en un puerto libre y lo cierra al terminar. */
async function withServer(run: (port: number) => Promise<void>) {
  const server = await startServer({ port: 0, durations })
  try {
    await run(server.port)
  } finally {
    await server.close()
  }
}

/** Se conecta y devuelve los primeros `count` colores recibidos. */
function collect(port: number, count: number, onOpen?: (ws: WebSocket) => void) {
  return new Promise<unknown[]>((resolve, reject) => {
    const colors: unknown[] = []
    const ws = new WebSocket(`ws://localhost:${port}`)
    ws.on('error', reject)
    ws.on('open', () => onOpen?.(ws))
    ws.on('message', (data) => {
      colors.push(parseState(data.toString()))
      if (colors.length === count) {
        ws.close()
        resolve(colors)
      }
    })
  })
}

test('un cliente recibe el color actual al conectarse y luego cada cambio', () =>
  withServer(async (port) => {
    assert.deepEqual(await collect(port, 4), ['rojo', 'verde', 'amarillo', 'rojo'])
  }))

test('dos clientes reciben la misma secuencia', () =>
  withServer(async (port) => {
    const [a, b] = await Promise.all([collect(port, 3), collect(port, 3)])
    assert.deepEqual(a, ['rojo', 'verde', 'amarillo'])
    assert.deepEqual(b, a)
  }))

test('el ciclo avanza sin clientes y quien llega tarde ve el color actual', () =>
  withServer(async (port) => {
    await sleep(TICK * 1.5)
    assert.deepEqual(await collect(port, 1), ['verde'])
  }))

test('la desconexión de un cliente no afecta a los demás', () =>
  withServer(async (port) => {
    await collect(port, 1)
    assert.equal((await collect(port, 3)).length, 3)
  }))

test('lo que envía un cliente no altera el ciclo', () =>
  withServer(async (port) => {
    const colors = await collect(port, 4, (ws) => ws.send('verde ya'))
    assert.deepEqual(colors, ['rojo', 'verde', 'amarillo', 'rojo'])
  }))
