import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_DURATIONS, INITIAL_COLOR, nextColor, parseState, serializeState } from './index'

test('el ciclo es rojo, verde, amarillo y vuelve a rojo', () => {
  assert.equal(INITIAL_COLOR, 'rojo')
  const verde = nextColor('rojo')
  const amarillo = nextColor(verde)
  assert.deepEqual([verde, amarillo, nextColor(amarillo)], ['verde', 'amarillo', 'rojo'])
})

test('duraciones por defecto', () => {
  assert.deepEqual(DEFAULT_DURATIONS, { rojo: 5000, verde: 5000, amarillo: 2000 })
})

test('un estado serializado se interpreta de vuelta', () => {
  assert.equal(parseState(serializeState('verde')), 'verde')
})

test('los mensajes inválidos se ignoran sin lanzar', () => {
  assert.equal(parseState('esto no es json'), undefined)
  assert.equal(parseState('null'), undefined)
  assert.equal(parseState('{"type":"state","color":"azul"}'), undefined)
  assert.equal(parseState('{"type":"otro","color":"rojo"}'), undefined)
})
