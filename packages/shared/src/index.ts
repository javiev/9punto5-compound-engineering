export const COLORS = ['rojo', 'verde', 'amarillo'] as const
export type Color = (typeof COLORS)[number]

export const INITIAL_COLOR: Color = 'rojo'
export const DEFAULT_DURATIONS: Record<Color, number> = { rojo: 5000, verde: 5000, amarillo: 2000 }
export const WS_PORT = 3001

export function nextColor(color: Color): Color {
  return COLORS[(COLORS.indexOf(color) + 1) % COLORS.length]!
}

export function serializeState(color: Color): string {
  return JSON.stringify({ type: 'state', color })
}

/** Devuelve el color de un mensaje de estado, o undefined si el texto no es uno válido. */
export function parseState(text: string): Color | undefined {
  try {
    const message = JSON.parse(text)
    if (message?.type === 'state' && COLORS.includes(message.color)) return message.color
  } catch {
    return undefined
  }
  return undefined
}
