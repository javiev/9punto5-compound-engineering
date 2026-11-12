import './style.css'
import {
  CROSSING_CENTERS,
  CROSSING_COUNT,
  GREEN_MS,
  LANE_LENGTH,
  STREETS_PER_AXIS,
  VOLUME,
  WS_PORT,
  parseSnapshot,
  type Action,
  type Phase,
  type Snapshot,
} from '@semaforo/shared'
import { createRenderer } from './render'

const RETRY_MS = 1000
const PHASE_TEXT: Record<Phase, string> = {
  'h-green': 'paso horizontal',
  'h-yellow': 'cambiando',
  'v-green': 'paso vertical',
  'v-yellow': 'cambiando',
}

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const city = byId('ciudad')
const notice = byId('aviso')
const clients = byId('conectados')
const waiting = byId('esperando')
const volume = byId<HTMLInputElement>('trafico')
const volumeValue = byId('trafico-valor')
const green = byId<HTMLInputElement>('verde')
const greenValue = byId('verde-valor')
const renderer = createRenderer(byId<HTMLCanvasElement>('mapa'))

let socket: WebSocket | undefined

function send(action: Action) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(action))
}

// Un botón real sobre cada cruce: da clic, teclado y lector de pantalla sin calcular coordenadas.
const crossingButtons = Array.from({ length: CROSSING_COUNT }, (_, crossing) => {
  const row = Math.floor(crossing / STREETS_PER_AXIS)
  const column = crossing % STREETS_PER_AXIS
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'cruce'
  button.style.left = `${(CROSSING_CENTERS[column]! / LANE_LENGTH) * 100}%`
  button.style.top = `${(CROSSING_CENTERS[row]! / LANE_LENGTH) * 100}%`
  button.dataset.name = `Cruce fila ${row + 1}, columna ${column + 1}`
  button.addEventListener('click', () => send({ type: 'advance', crossing }))
  city.append(button)
  return button
})

volume.min = String(VOLUME.min)
volume.max = String(VOLUME.max)
green.min = String(GREEN_MS.min / 1000)
green.max = String(GREEN_MS.max / 1000)
volume.addEventListener('input', () => send({ type: 'settings', volume: volume.valueAsNumber, greenMs: undefined }))
green.addEventListener('input', () => send({ type: 'settings', volume: undefined, greenMs: green.valueAsNumber * 1000 }))

function setConnected(connected: boolean) {
  document.body.classList.toggle('desconectado', !connected)
  notice.textContent = connected ? '' : 'Sin conexión. Reconectando…'
  volume.disabled = green.disabled = !connected
  if (!connected) {
    for (const button of crossingButtons) {
      delete button.dataset.phase
      button.setAttribute('aria-disabled', 'true')
    }
  }
}

function show(snapshot: Snapshot) {
  renderer.show(snapshot)
  clients.textContent = String(snapshot.clients)
  waiting.textContent = String(snapshot.waiting)

  // Mientras alguien arrastra un control, las fotos no se lo mueven de la mano.
  if (!volume.matches(':active')) volume.valueAsNumber = snapshot.settings.volume
  if (!green.matches(':active')) green.valueAsNumber = snapshot.settings.greenMs / 1000
  volumeValue.textContent = String(snapshot.settings.volume)
  greenValue.textContent = String(snapshot.settings.greenMs / 1000)

  snapshot.crossings.forEach((phase, crossing) => {
    const button = crossingButtons[crossing]!
    if (button.dataset.phase === phase) return
    button.dataset.phase = phase
    // aria-disabled en vez de disabled: el botón conserva el foco del teclado mientras el cruce cambia.
    button.setAttribute('aria-disabled', String(!phase.endsWith('green')))
    button.setAttribute('aria-label', `${button.dataset.name}: ${PHASE_TEXT[phase]}`)
  })
}

function connect() {
  socket = new WebSocket(`ws://${location.hostname}:${WS_PORT}`)
  socket.onmessage = (event) => {
    const snapshot = parseSnapshot(String(event.data))
    if (!snapshot) return
    setConnected(true)
    show(snapshot)
  }
  // onclose también se dispara cuando la conexión nunca llegó a abrirse.
  socket.onclose = () => {
    setConnected(false)
    setTimeout(connect, RETRY_MS)
  }
}

setConnected(false)
connect()
