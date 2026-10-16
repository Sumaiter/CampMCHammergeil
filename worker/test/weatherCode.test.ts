import { describe, expect, it } from 'vitest'
import { mapWeatherCode } from '../lib/weatherCode'

describe('mapWeatherCode', () => {
  it.each([
    [0, 'clear', 0],
    [1, 'clear', 0],
    [2, 'cloudy', 0.5],
    [3, 'cloudy', 1],
    [45, 'fog', 1],
    [48, 'fog', 1],
    [51, 'rain', 0.3],
    [57, 'rain', 0.3],
    [61, 'rain', 0.3],
    [80, 'rain', 0.3],
    [63, 'rain', 0.6],
    [81, 'rain', 0.6],
    [65, 'rain', 1],
    [66, 'rain', 1],
    [67, 'rain', 1],
    [82, 'rain', 1],
    [71, 'snow', 0.3],
    [77, 'snow', 0.3],
    [85, 'snow', 0.3],
    [73, 'snow', 0.6],
    [75, 'snow', 1],
    [86, 'snow', 1],
    [95, 'storm', 1],
    [96, 'storm', 1],
    [99, 'storm', 1],
    // unbekannte Codes
    [4, 'cloudy', 0.5],
    [100, 'cloudy', 0.5],
    [-1, 'cloudy', 0.5],
  ])('Code %i → %s (%f)', (code, condition, intensity) => {
    expect(mapWeatherCode(code)).toEqual({ condition, intensity })
  })
})
