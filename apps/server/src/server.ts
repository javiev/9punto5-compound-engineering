import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { WebSocket, WebSocketServer } from 'ws'
import { SNAPSHOT_INTERVAL_MS, WS_PORT, advanceCrossing, createCity, parseAction, step, toSnapshot, withSettings } from '@semaforo/shared'

const TICK_MS = 50
const TICKS_PER_SNAPSHOT = SNAPSHOT_INTERVAL_MS / TICK_MS
const MAX_MESSAGE_BYTES = 1024

/**
 * Arranca la ciudad: el servidor corre la simulación, envía a todos la foto completa
 * del estado y aplica las acciones que manda cualquier cliente.
 */
export async function startServer({ port = WS_PORT, random = Math.random } = {}) {
  const wss = new WebSocketServer({ port, maxPayload: MAX_MESSAGE_BYTES })
  await once(wss, 'listening')

  let city = createCity()
  let ticks = 0

  const openClients = () => [...wss.clients].filter((client) => client.readyState === WebSocket.OPEN)
  const snapshot = () => JSON.stringify(toSnapshot(city, openClients().length))

  const timer = setInterval(() => {
    city = step(city, TICK_MS, random)
    if (++ticks % TICKS_PER_SNAPSHOT !== 0) return
    const message = snapshot()
    for (const client of openClients()) client.send(message)
  }, TICK_MS)

  wss.on('connection', (client) => {
    // ws cierra por su cuenta la conexión que envía un mensaje demasiado grande;
    // sin este manejador, ese error tumbaría el proceso.
    client.on('error', () => {})
    client.on('message', (data) => {
      const action = parseAction(data.toString())
      if (action?.type === 'advance') city = advanceCrossing(city, action.crossing)
      if (action?.type === 'settings') city = withSettings(city, action)
    })
    client.send(snapshot())
  })

  return {
    port: (wss.address() as AddressInfo).port,
    close() {
      clearInterval(timer)
      for (const client of wss.clients) client.terminate()
      return new Promise<void>((resolve) => wss.close(() => resolve()))
    },
  }
}
