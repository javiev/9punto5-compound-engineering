import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'
import { test } from 'node:test'
import { WebSocket } from 'ws'
import { parseSnapshot, type Action, type Snapshot } from '@semaforo/shared'
import { startServer } from './server'

/** Arranca un servidor en un puerto libre y lo cierra al terminar. */
async function withServer(run: (port: number) => Promise<void>, random?: () => number) {
  const server = await startServer({ port: 0, random })
  try {
    await run(server.port)
  } finally {
    await server.close()
  }
}

/** Cliente de prueba: `next` espera la próxima foto que cumpla la condición. */
function connect(port: number) {
  const socket = new WebSocket(`ws://localhost:${port}`)
  const received: Snapshot[] = []
  let notify = () => {}
  socket.on('message', (data) => {
    received.push(parseSnapshot(data.toString())!)
    notify()
  })
  return {
    socket,
    send: (action: Action | string) => socket.send(typeof action === 'string' ? action : JSON.stringify(action)),
    async next(matches: (snapshot: Snapshot) => boolean = () => true): Promise<Snapshot> {
      for (;;) {
        const found = received.splice(0).find(matches)
        if (found) return found
        await new Promise<void>((resolve) => (notify = resolve))
      }
    },
  }
}

const opened = (socket: WebSocket) => new Promise((resolve) => socket.once('open', resolve))
const closed = (socket: WebSocket) => new Promise((resolve) => socket.once('close', resolve))

test('la primera foto trae nueve cruces, los ajustes por defecto y un conectado', () =>
  withServer(async (port) => {
    const snapshot = await connect(port).next()
    assert.equal(snapshot.crossings.length, 9)
    assert.deepEqual(snapshot.settings, { volume: 20, greenMs: 6000 })
    assert.equal(snapshot.clients, 1)
  }))

test('adelantar un cruce desde un cliente se ve en todos', () =>
  withServer(async (port) => {
    const a = connect(port)
    const b = connect(port)
    await Promise.all([opened(a.socket), opened(b.socket)])
    a.send({ type: 'advance', crossing: 4 })
    const isYellow = (snapshot: Snapshot) => snapshot.crossings[4] === 'h-yellow'
    await Promise.all([a.next(isYellow), b.next(isYellow)])
  }))

test('un ajuste llega a todos y a quien se conecta después', () =>
  withServer(async (port) => {
    const a = connect(port)
    const b = connect(port)
    await Promise.all([opened(a.socket), opened(b.socket)])
    a.send({ type: 'settings', volume: 60, greenMs: undefined })
    const isMax = (snapshot: Snapshot) => snapshot.settings.volume === 60
    await Promise.all([a.next(isMax), b.next(isMax)])
    assert.equal((await connect(port).next()).settings.volume, 60)
  }))

test('si dos clientes cambian el mismo ajuste, vale el último recibido', () =>
  withServer(async (port) => {
    const a = connect(port)
    const b = connect(port)
    await Promise.all([opened(a.socket), opened(b.socket)])
    a.send({ type: 'settings', volume: undefined, greenMs: 3000 })
    await b.next((snapshot) => snapshot.settings.greenMs === 3000)
    b.send({ type: 'settings', volume: undefined, greenMs: 9000 })
    const isLast = (snapshot: Snapshot) => snapshot.settings.greenMs === 9000
    await Promise.all([a.next(isLast), b.next(isLast)])
  }))

test('las fotos cuentan cuántos clientes hay conectados', () =>
  withServer(async (port) => {
    const a = connect(port)
    const b = connect(port)
    await a.next((snapshot) => snapshot.clients === 2)
    const c = connect(port)
    await a.next((snapshot) => snapshot.clients === 3)
    c.socket.close()
    await a.next((snapshot) => snapshot.clients === 2)
    b.socket.close()
  }))

test('los mensajes inválidos o demasiado grandes no alteran la ciudad', () =>
  withServer(async (port) => {
    const a = connect(port)
    const b = connect(port)
    const c = connect(port)
    await Promise.all([opened(a.socket), opened(b.socket), opened(c.socket)])
    a.send('esto no es json')
    a.send('{"type":"advance","crossing":99}')
    c.send(JSON.stringify({ type: 'settings', volume: 60, relleno: 'x'.repeat(5000) }))
    await closed(c.socket)

    await b.next()
    const snapshot = await b.next()
    assert.deepEqual(snapshot.settings, { volume: 20, greenMs: 6000 })
    assert.ok(snapshot.crossings.every((phase) => phase === 'h-green'))
  }))

test('la ciudad corre aunque no haya nadie conectado', () =>
  withServer(async (port) => {
    await sleep(300)
    assert.ok((await connect(port).next()).cars.length > 0)
  }, () => 0))
