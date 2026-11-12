import { CROSSING_COUNT, type City, type Phase, type Settings } from './sim'

export const WS_PORT = 3001
/** Cada cuánto envía el servidor una foto; el navegador interpola el movimiento entre dos fotos. */
export const SNAPSHOT_INTERVAL_MS = 100

/** Estado completo de la ciudad, tal como lo envía el servidor. Cada auto va como [id, pista, posición]. */
export interface Snapshot {
  type: 'snapshot'
  cars: [id: number, lane: number, s: number][]
  crossings: Phase[]
  settings: Settings
  clients: number
  waiting: number
}

export type Action =
  | { type: 'advance'; crossing: number }
  | { type: 'settings'; volume: number | undefined; greenMs: number | undefined }

export function toSnapshot(city: City, clients: number): Snapshot {
  return {
    type: 'snapshot',
    cars: city.cars.map((car) => [car.id, car.lane, Math.round(car.s * 10) / 10]),
    crossings: city.crossings.map((crossing) => crossing.phase),
    settings: city.settings,
    clients,
    waiting: city.waiting,
  }
}

function parseJson(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** Devuelve la foto, o undefined si el texto no lo es. */
export function parseSnapshot(text: string): Snapshot | undefined {
  const message = parseJson(text)
  const isSnapshot = message?.type === 'snapshot' && Array.isArray(message.cars) && Array.isArray(message.crossings)
  return isSnapshot ? message : undefined
}

const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const isOptionalNumber = (value: unknown) => value === undefined || isNumber(value)

/** Devuelve la acción que envió un navegador, o undefined si no es válida. Los ajustes se recortan al aplicarlos. */
export function parseAction(text: string): Action | undefined {
  const message = parseJson(text)
  if (message?.type === 'advance') {
    const { crossing } = message
    return Number.isInteger(crossing) && crossing >= 0 && crossing < CROSSING_COUNT ? { type: 'advance', crossing } : undefined
  }
  if (message?.type === 'settings') {
    const { volume, greenMs } = message
    const hasValue = volume !== undefined || greenMs !== undefined
    return hasValue && isOptionalNumber(volume) && isOptionalNumber(greenMs) ? { type: 'settings', volume, greenMs } : undefined
  }
  return undefined
}
