import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseAction, parseSnapshot, toSnapshot } from './protocol'
import { advanceCrossing, createCity } from './sim'

test('una foto se interpreta de vuelta con el mismo estado', () => {
  const city = advanceCrossing({ ...createCity(() => 0), cars: [{ id: 1, lane: 0, s: 12.34 }, { id: 2, lane: 7, s: 300 }], waiting: 1 }, 4)
  const snapshot = parseSnapshot(JSON.stringify(toSnapshot(city, 3)))
  assert.deepEqual(snapshot, {
    type: 'snapshot',
    cars: [[1, 0, 12.3], [2, 7, 300]],
    crossings: ['h-green', 'h-green', 'h-green', 'h-green', 'h-yellow', 'h-green', 'h-green', 'h-green', 'h-green'],
    settings: { volume: 20, greenMs: 6000 },
    clients: 3,
    waiting: 1,
  })
})

test('lo que no es una foto se ignora', () => {
  const complete = toSnapshot(createCity(() => 0), 1)
  const incomplete = [
    { ...complete, settings: undefined },
    { ...complete, settings: { volume: 20 } },
    { ...complete, clients: 'dos' },
    { ...complete, waiting: undefined },
    { ...complete, crossings: complete.crossings.slice(1) },
    { ...complete, cars: undefined },
  ].map((snapshot) => JSON.stringify(snapshot))
  for (const text of ['no es json', 'null', '{"type":"otro"}', '{"type":"snapshot"}', ...incomplete]) {
    assert.equal(parseSnapshot(text), undefined, text)
  }
})

test('las acciones inválidas se ignoran sin lanzar', () => {
  const invalid = [
    'no es json',
    'null',
    '{"type":"otro"}',
    '{"type":"advance","crossing":9}',
    '{"type":"advance","crossing":-1}',
    '{"type":"advance","crossing":2.5}',
    '{"type":"advance","crossing":"4"}',
    '{"type":"advance"}',
    '{"type":"settings"}',
    '{"type":"settings","volume":"mucho"}',
    '{"type":"settings","volume":10,"greenMs":null}',
  ]
  for (const text of invalid) assert.equal(parseAction(text), undefined, text)
})

test('las acciones válidas se aceptan', () => {
  assert.deepEqual(parseAction('{"type":"advance","crossing":0}'), { type: 'advance', crossing: 0 })
  assert.deepEqual(parseAction('{"type":"advance","crossing":8}'), { type: 'advance', crossing: 8 })
  assert.deepEqual(parseAction('{"type":"settings","volume":60}'), { type: 'settings', volume: 60, greenMs: undefined })
  assert.deepEqual(parseAction('{"type":"settings","volume":500,"greenMs":3000,"extra":1}'), {
    type: 'settings',
    volume: 500,
    greenMs: 3000,
  })
})
