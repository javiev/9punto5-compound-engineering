import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BOX_HALF,
  CAR_LENGTH,
  CROSSING_CENTERS,
  LANE_COUNT,
  STOP_LINES,
  advanceCrossing,
  createCity,
  crossingOfLane,
  laneAxis,
  step,
  withSettings,
  type Car,
  type City,
  type Phase,
} from './sim'

const DT = 50
const never = () => 1
const always = () => 0

/** Generador determinista para que las pruebas con azar sean reproducibles. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Ciudad sin autos nuevos y con verdes largos, para aislar lo que se prueba. */
function quietCity(cars: Car[], phases: Record<number, Phase> = {}): City {
  const city = withSettings(createCity(always), { volume: 0, greenMs: 20_000 })
  return {
    ...city,
    cars,
    crossings: city.crossings.map((crossing, id) => ({ ...crossing, phase: phases[id] ?? crossing.phase })),
  }
}

function run(city: City, ms: number, random = never): City {
  for (let elapsed = 0; elapsed < ms; elapsed += DT) city = step(city, DT, random)
  return city
}

const positions = (city: City) => city.cars.map((car) => car.s)
const phaseOf = (city: City, crossing: number) => city.crossings[crossing]!.phase

// La pista 0 va por la primera calle horizontal y encuentra los cruces 0, 1 y 2.
test('los autos hacen fila ante el rojo y salen en orden con el verde', () => {
  const cars = [60, 40, 20].map((s, id) => ({ id, lane: 0, s }))
  let city = run(quietCity(cars, { 0: 'v-green' }), 3000)
  assert.deepEqual(positions(city), [90, 78, 66])
  assert.equal(city.waiting, 3)

  city = run({ ...city, crossings: city.crossings.map((c, id) => (id === 0 ? { ...c, phase: 'h-green' } : c)) }, 1000)
  const [first, second, third] = positions(city) as [number, number, number]
  assert.ok(first > STOP_LINES[0]! && first > second && second > third)
  assert.equal(city.waiting, 0)
})

test('adelantar un cruce en amarillo no cambia nada', () => {
  const city = quietCity([], { 4: 'h-yellow' })
  city.crossings[4]!.elapsedMs = 500
  assert.deepEqual(advanceCrossing(city, 4), city)
})

test('un auto no entra al cruce si la cuadra siguiente está llena', () => {
  const block = [190, 178, 166, 154, 142, 130, 118].map((s, id) => ({ id, lane: 0, s }))
  const waiting = { id: 99, lane: 0, s: 90 }
  let city = run(quietCity([...block, waiting], { 1: 'v-green' }), 2000)
  assert.equal(city.cars.find((car) => car.id === 99)!.s, 90)

  city = run({ ...city, crossings: city.crossings.map((c, id) => (id === 1 ? { ...c, phase: 'h-green' } : c)) }, 3000)
  assert.ok(city.cars.find((car) => car.id === 99)!.s > 90)
})

test('un cruce pasa de verde a amarillo y luego da el paso a la otra calle', () => {
  let city = withSettings(createCity(always), { volume: 0 })
  city = run(city, 5950)
  assert.equal(phaseOf(city, 0), 'h-green')
  city = step(city, DT, never)
  assert.equal(phaseOf(city, 0), 'h-yellow')
  city = run(city, 2000)
  assert.equal(phaseOf(city, 0), 'v-green')
})

test('adelantar un cruce en verde lo pone en amarillo y después sigue solo', () => {
  let city = advanceCrossing(withSettings(createCity(always), { volume: 0 }), 4)
  assert.equal(phaseOf(city, 4), 'h-yellow')
  assert.equal(phaseOf(city, 3), 'h-green')
  city = run(city, 2000)
  assert.equal(phaseOf(city, 4), 'v-green')
  city = run(city, 8000)
  assert.equal(phaseOf(city, 4), 'h-green')
})

test('con amarillo, quien no entró se detiene y quien ya entró termina de cruzar', () => {
  const city = run(quietCity([{ id: 1, lane: 0, s: 95 }, { id: 2, lane: 0, s: 80 }], { 0: 'h-yellow' }), 1000)
  assert.deepEqual(positions(city), [135, 90])
})

test('un auto que recorre su pista completa sale del mapa', () => {
  assert.equal(run(quietCity([{ id: 1, lane: 0, s: 0 }]), 11_000).cars.length, 0)
})

test('con tráfico en 0 no aparecen autos', () => {
  assert.equal(run(withSettings(createCity(always), { volume: 0 }), 60_000, seeded(1)).cars.length, 0)
})

test('con tráfico en 60 aparece cerca de un auto por segundo en cada entrada', () => {
  const city = run(withSettings(createCity(always), { volume: 60 }), 5000, seeded(2))
  assert.ok(city.nextId >= 40 && city.nextId <= 80, `aparecieron ${city.nextId}`)
})

test('no aparece un auto si la entrada de su pista está ocupada', () => {
  const city = step(withSettings(quietCity([{ id: 1, lane: 0, s: 5 }]), { volume: 60 }), DT, always)
  assert.equal(city.cars.filter((car) => car.lane === 0).length, 1)
  assert.equal(city.cars.length, LANE_COUNT)
})

test('los cruces parten en fases y momentos distintos', () => {
  const { crossings } = createCity(seeded(4))
  assert.deepEqual(new Set(crossings.map((crossing) => crossing.phase)), new Set(['h-green', 'v-green']))
  assert.equal(new Set(crossings.map((crossing) => crossing.elapsedMs)).size, crossings.length)
  assert.ok(crossings.every((crossing) => crossing.elapsedMs >= 0 && crossing.elapsedMs < 6000))
})

test('los ajustes fuera de rango se recortan', () => {
  assert.deepEqual(withSettings(createCity(always), { volume: 500, greenMs: 1000 }).settings, { volume: 60, greenMs: 2000 })
  assert.deepEqual(withSettings(createCity(always), { volume: -3 }).settings, { volume: 0, greenMs: 6000 })
})

test('con tráfico máximo y cruces adelantados al azar no hay choques ni cruces compartidos', () => {
  const random = seeded(3)
  let city = withSettings(createCity(always), { volume: 60 })
  for (let tick = 0; tick < 6000; tick++) {
    if (random() < 0.01) city = advanceCrossing(city, Math.floor(random() * 9))
    city = step(city, DT, random)

    const inside = new Map<number, Set<string>>()
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const fronts = city.cars.filter((car) => car.lane === lane).map((car) => car.s).sort((a, b) => a - b)
      for (let i = 1; i < fronts.length; i++) {
        assert.ok(fronts[i]! - fronts[i - 1]! >= CAR_LENGTH - 1e-9, `autos encimados en la pista ${lane}, paso ${tick}`)
      }
      for (const front of fronts) {
        CROSSING_CENTERS.forEach((center, k) => {
          if (front > STOP_LINES[k]! && front - CAR_LENGTH < center + BOX_HALF) {
            const crossing = crossingOfLane(lane, k)
            inside.set(crossing, (inside.get(crossing) ?? new Set()).add(laneAxis(lane)))
          }
        })
      }
    }
    for (const [crossing, axes] of inside) {
      assert.equal(axes.size, 1, `las dos calles ocupan el cruce ${crossing}, paso ${tick}`)
    }
  }
  assert.ok(city.cars.length > 0)
})
