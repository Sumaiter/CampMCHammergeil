// Übersetzt WMO-Wettercodes (Open-Meteo) in die wenigen Zustände, die der Planet darstellen kann.
// https://open-meteo.com/en/docs → „WMO Weather interpretation codes“

export type WeatherCondition = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'

export type WeatherState = { condition: WeatherCondition; intensity: number }

const UNKNOWN: WeatherState = { condition: 'cloudy', intensity: 0.5 }

const state = (condition: WeatherCondition, intensity: number, codes: number[]) =>
  codes.map((code) => [code, { condition, intensity }] as const)

const CODES = new Map<number, WeatherState>([
  ...state('clear', 0, [0, 1]),
  ...state('cloudy', 0.5, [2]),
  ...state('cloudy', 1, [3]),
  ...state('fog', 1, [45, 48]),
  // Niesel zählt als leichter Regen
  ...state('rain', 0.3, [51, 53, 55, 56, 57, 61, 80]),
  ...state('rain', 0.6, [63, 81]),
  ...state('rain', 1, [65, 66, 67, 82]),
  ...state('snow', 0.3, [71, 77, 85]),
  ...state('snow', 0.6, [73]),
  ...state('snow', 1, [75, 86]),
  ...state('storm', 1, [95, 96, 99]),
])

export function mapWeatherCode(code: number): WeatherState {
  return { ...(CODES.get(code) ?? UNKNOWN) }
}
