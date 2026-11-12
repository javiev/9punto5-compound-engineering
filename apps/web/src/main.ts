import './style.css'
import { WS_PORT, parseState, type Color } from '@semaforo/shared'

const RETRY_MS = 1000
const lights = document.querySelectorAll<HTMLElement>('.luz')
const status = document.querySelector<HTMLElement>('#estado')!

function render(color?: Color) {
  for (const light of lights) light.classList.toggle('encendida', light.dataset.color === color)
  status.textContent = color ?? 'sin conexión'
}

function connect() {
  const socket = new WebSocket(`ws://${location.hostname}:${WS_PORT}`)
  socket.onmessage = (event) => {
    const color = parseState(String(event.data))
    if (color) render(color)
  }
  // onclose también se dispara cuando la conexión nunca llegó a abrirse.
  socket.onclose = () => {
    render()
    setTimeout(connect, RETRY_MS)
  }
}

connect()
