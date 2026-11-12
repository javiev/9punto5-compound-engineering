import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { WebSocket, WebSocketServer } from 'ws'
import { DEFAULT_DURATIONS, INITIAL_COLOR, WS_PORT, nextColor, serializeState } from '@semaforo/shared'

/**
 * Arranca el semáforo: el servidor lleva el tiempo y difunde cada cambio de color.
 * Los clientes solo escuchan; lo que envían se ignora.
 */
export async function startServer({ port = WS_PORT, durations = DEFAULT_DURATIONS } = {}) {
  const wss = new WebSocketServer({ port })
  await once(wss, 'listening')

  let color = INITIAL_COLOR
  let timer: NodeJS.Timeout

  function scheduleNextChange() {
    timer = setTimeout(() => {
      color = nextColor(color)
      const message = serializeState(color)
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(message)
      }
      scheduleNextChange()
    }, durations[color])
  }
  scheduleNextChange()

  wss.on('connection', (client) => {
    client.on('error', console.error)
    client.send(serializeState(color))
  })

  return {
    port: (wss.address() as AddressInfo).port,
    close() {
      clearTimeout(timer)
      for (const client of wss.clients) client.terminate()
      return new Promise<void>((resolve) => wss.close(() => resolve()))
    },
  }
}
