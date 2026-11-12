import { CROSSING_COUNT, type City, type Phase, type Settings } from './sim'

export const WS_PORT = 3001
export const SNAPSHOT_INTERVAL_MS = 100

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

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export function parseSnapshot(text: string): Snapshot | undefined {
  const message = parseJson(text) as Partial<Snapshot> | null
  const isSnapshot =
    message?.type === 'snapshot' &&
    Array.isArray(message.cars) &&
    Array.isArray(message.crossings) &&
    message.crossings.length === CROSSING_COUNT &&
    isNumber(message.settings?.volume) &&
    isNumber(message.settings?.greenMs) &&
    isNumber(message.clients) &&
    isNumber(message.waiting)
  return isSnapshot ? (message as Snapshot) : undefined
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isOptionalNumber = (value: unknown): value is number | undefined => value === undefined || isNumber(value)
const isCrossing = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) < CROSSING_COUNT

export function parseAction(text: string): Action | undefined {
  const message = parseJson(text) as Record<string, unknown> | null
  if (message?.type === 'advance') {
    const { crossing } = message
    return isCrossing(crossing) ? { type: 'advance', crossing } : undefined
  }
  if (message?.type === 'settings') {
    const { volume, greenMs } = message
    const hasValue = volume !== undefined || greenMs !== undefined
    return hasValue && isOptionalNumber(volume) && isOptionalNumber(greenMs) ? { type: 'settings', volume, greenMs } : undefined
  }
  return undefined
}
