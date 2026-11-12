import {
  BOX_HALF,
  CAR_LENGTH,
  CROSSING_CENTERS,
  LANE_LENGTH,
  SNAPSHOT_INTERVAL_MS,
  STREETS_PER_AXIS,
  isGreen,
  laneAxis,
  laneIsReversed,
  laneStreet,
  type Axis,
  type Phase,
  type Snapshot,
} from '@semaforo/shared'

const CAR_WIDTH = 5
const LANE_OFFSET = (BOX_HALF - CAR_WIDTH) / 2
const LIGHT_COLORS = { green: '#34c759', yellow: '#ffcc00', red: '#ff3b30' }

function lightColor(phase: Phase, axis: Axis) {
  if (phase === `${axis}-green`) return LIGHT_COLORS.green
  if (phase === `${axis}-yellow`) return LIGHT_COLORS.yellow
  return LIGHT_COLORS.red
}

export function createRenderer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  ctx.scale(canvas.width / LANE_LENGTH, canvas.height / LANE_LENGTH)

  let snapshot: Snapshot | undefined
  let previous = new Map<number, number>()
  let receivedAt = 0

  function drawStreets() {
    ctx.fillStyle = '#26332a'
    ctx.fillRect(0, 0, LANE_LENGTH, LANE_LENGTH)
    ctx.fillStyle = '#3d4148'
    for (const center of CROSSING_CENTERS) {
      ctx.fillRect(0, center - BOX_HALF, LANE_LENGTH, BOX_HALF * 2)
      ctx.fillRect(center - BOX_HALF, 0, BOX_HALF * 2, LANE_LENGTH)
    }
  }

  function drawCrossing(phase: Phase, x: number, y: number) {
    ctx.fillStyle = lightColor(phase, 'h')
    ctx.fillRect(x - BOX_HALF - 2, y, 2, BOX_HALF)
    ctx.fillRect(x + BOX_HALF, y - BOX_HALF, 2, BOX_HALF)
    ctx.fillStyle = lightColor(phase, 'v')
    ctx.fillRect(x - BOX_HALF, y - BOX_HALF - 2, BOX_HALF, 2)
    ctx.fillRect(x, y + BOX_HALF, BOX_HALF, 2)

    // Una barra orientada según la calle que tiene el paso, para no depender solo del color.
    ctx.fillStyle = isGreen(phase) ? '#ffffff' : '#ffffff66'
    if (phase.startsWith('h')) ctx.fillRect(x - 7, y - 1.5, 14, 3)
    else ctx.fillRect(x - 1.5, y - 7, 3, 14)
  }

  function drawCar(id: number, lane: number, s: number) {
    const street = CROSSING_CENTERS[laneStreet(lane)]!
    const reversed = laneIsReversed(lane)
    const front = reversed ? LANE_LENGTH - s : s
    const along = reversed ? front : front - CAR_LENGTH
    ctx.fillStyle = `hsl(${(id * 47) % 360} 70% 65%)`
    // Se circula por la derecha: hacia el este por la mitad sur, hacia el sur por la mitad oeste.
    if (laneAxis(lane) === 'h') {
      ctx.fillRect(along, reversed ? street - LANE_OFFSET - CAR_WIDTH : street + LANE_OFFSET, CAR_LENGTH, CAR_WIDTH)
    } else {
      ctx.fillRect(reversed ? street + LANE_OFFSET : street - LANE_OFFSET - CAR_WIDTH, along, CAR_WIDTH, CAR_LENGTH)
    }
  }

  function draw(now: number) {
    requestAnimationFrame(draw)
    drawStreets()
    if (!snapshot) return

    snapshot.crossings.forEach((phase, id) => {
      const x = CROSSING_CENTERS[id % STREETS_PER_AXIS]!
      const y = CROSSING_CENTERS[Math.floor(id / STREETS_PER_AXIS)]!
      drawCrossing(phase, x, y)
    })

    const progress = Math.min(1, (now - receivedAt) / SNAPSHOT_INTERVAL_MS)
    for (const [id, lane, s] of snapshot.cars) {
      const from = previous.get(id) ?? s
      drawCar(id, lane, from + (s - from) * progress)
    }
  }
  requestAnimationFrame(draw)

  return {
    show(next: Snapshot) {
      previous = new Map(snapshot?.cars.map(([id, , s]) => [id, s]))
      snapshot = next
      receivedAt = performance.now()
    },
  }
}
