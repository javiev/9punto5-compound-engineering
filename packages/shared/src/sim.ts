// Simulación de la ciudad: tres calles horizontales y tres verticales, de doble sentido.
// Cada pista es una recta que se recorre de 0 a LANE_LENGTH; la posición de un auto es la de su frente.

export const LANE_LENGTH = 400
export const CROSSING_CENTERS = [100, 200, 300] as const
export const BOX_HALF = 10
export const STOP_LINES = CROSSING_CENTERS.map((center) => center - BOX_HALF)
export const CAR_LENGTH = 8
export const CAR_GAP = 4
export const CAR_SPEED = 40 // unidades por segundo
export const YELLOW_MS = 2000
export const GREEN_MS = { min: 2000, max: 20_000, initial: 6000 } as const
export const VOLUME = { min: 0, max: 60, initial: 20 } as const // autos por minuto en cada entrada
export const STREETS_PER_AXIS = CROSSING_CENTERS.length
export const LANE_COUNT = STREETS_PER_AXIS * 2 * 2
export const CROSSING_COUNT = STREETS_PER_AXIS * STREETS_PER_AXIS

const SPACING = CAR_LENGTH + CAR_GAP
const BLOCK_CAPACITY = Math.floor((STOP_LINES[1]! - (CROSSING_CENTERS[0] + BOX_HALF) + CAR_GAP) / SPACING)

export type Axis = 'h' | 'v'
export type Phase = 'h-green' | 'h-yellow' | 'v-green' | 'v-yellow'

export interface Car {
  id: number
  lane: number
  s: number
}

export interface Crossing {
  phase: Phase
  elapsedMs: number
}

export interface Settings {
  volume: number
  greenMs: number
}

export interface City {
  cars: Car[]
  crossings: Crossing[]
  settings: Settings
  /** Autos que no avanzaron en el último paso. */
  waiting: number
  nextId: number
}

// Pistas 0 a 5: calles horizontales (dos sentidos por calle). Pistas 6 a 11: verticales.
export const laneAxis = (lane: number): Axis => (lane < STREETS_PER_AXIS * 2 ? 'h' : 'v')
export const laneStreet = (lane: number) => Math.floor(lane / 2) % STREETS_PER_AXIS
export const laneIsReversed = (lane: number) => lane % 2 === 1

/** Cruce (fila * 3 + columna) que la pista encuentra en su k-ésimo lugar. */
export function crossingOfLane(lane: number, k: number): number {
  const along = laneIsReversed(lane) ? STREETS_PER_AXIS - 1 - k : k
  const street = laneStreet(lane)
  return laneAxis(lane) === 'h' ? street * STREETS_PER_AXIS + along : along * STREETS_PER_AXIS + street
}

/** Cada cruce parte con el paso en una calle al azar y a mitad de su verde, para que no cambien todos juntos. */
export function createCity(random: () => number = Math.random): City {
  return {
    cars: [],
    crossings: Array.from({ length: CROSSING_COUNT }, () => ({
      phase: random() < 0.5 ? 'h-green' : 'v-green',
      elapsedMs: random() * GREEN_MS.initial,
    })),
    settings: { volume: VOLUME.initial, greenMs: GREEN_MS.initial },
    waiting: 0,
    nextId: 0,
  }
}

const clamp = (value: number, { min, max }: { min: number; max: number }) => Math.min(max, Math.max(min, value))

export function withSettings(city: City, { volume, greenMs }: Partial<Settings>): City {
  return {
    ...city,
    settings: {
      volume: volume === undefined ? city.settings.volume : clamp(volume, VOLUME),
      greenMs: greenMs === undefined ? city.settings.greenMs : clamp(greenMs, GREEN_MS),
    },
  }
}

const NEXT_PHASE: Record<Phase, Phase> = {
  'h-green': 'h-yellow',
  'h-yellow': 'v-green',
  'v-green': 'v-yellow',
  'v-yellow': 'h-green',
}
export const isGreen = (phase: Phase) => phase.endsWith('green')

/** Adelanta el cambio de un cruce en verde; en amarillo el cambio ya está en curso. */
export function advanceCrossing(city: City, crossing: number): City {
  if (!isGreen(city.crossings[crossing]!.phase)) return city
  return {
    ...city,
    crossings: city.crossings.map((current, id) =>
      id === crossing ? { phase: NEXT_PHASE[current.phase], elapsedMs: 0 } : current,
    ),
  }
}

function stepCrossing({ phase, elapsedMs }: Crossing, dtMs: number, greenMs: number): Crossing {
  elapsedMs += dtMs
  const duration = isGreen(phase) ? greenMs : YELLOW_MS
  return elapsedMs >= duration ? { phase: NEXT_PHASE[phase], elapsedMs: 0 } : { phase, elapsedMs }
}

/** Avanza la ciudad `dtMs` milisegundos. `random` decide cuándo aparecen autos. */
export function step(city: City, dtMs: number, random: () => number = Math.random): City {
  const { settings } = city
  const crossings = city.crossings.map((crossing) => stepCrossing(crossing, dtMs, settings.greenMs))
  const reach = (CAR_SPEED * dtMs) / 1000
  const spawnChance = (settings.volume / 60_000) * dtMs

  const cars: Car[] = []
  let waiting = 0
  let nextId = city.nextId

  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const moved: Car[] = []
    const inLane = city.cars.filter((car) => car.lane === lane).sort((a, b) => b.s - a.s)

    for (const car of inLane) {
      const ahead = moved.at(-1)
      let limit = ahead ? ahead.s - SPACING : Infinity

      const k = STOP_LINES.findIndex((line) => line >= car.s)
      if (k !== -1) {
        const hasGreen = crossings[crossingOfLane(lane, k)]!.phase === `${laneAxis(lane)}-green`
        // Se cuentan también los autos en movimiento y los que aún cruzan: medir solo el espacio
        // libre del momento dejaría autos detenidos dentro del cruce.
        const nextLine = STOP_LINES[k + 1]
        const hasRoom =
          nextLine === undefined ||
          moved.filter((other) => other.s > STOP_LINES[k]! && other.s <= nextLine).length < BLOCK_CAPACITY
        if (!hasGreen || !hasRoom) limit = Math.min(limit, STOP_LINES[k]!)
      }

      const s = Math.max(car.s, Math.min(car.s + reach, limit))
      if (s === car.s) waiting++
      moved.push({ ...car, s })
    }

    const remaining = moved.filter((car) => car.s - CAR_LENGTH < LANE_LENGTH)
    const last = remaining.at(-1)
    if (random() < spawnChance && (!last || last.s >= SPACING)) remaining.push({ id: nextId++, lane, s: 0 })
    cars.push(...remaining)
  }

  return { cars, crossings, settings, waiting, nextId }
}
