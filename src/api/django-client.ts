import { JsonApiClient, JsonApiError } from './json-api-client'

import type { RequestOptions } from './json-api-client'

export type Coordinates = {
  lat: number
  lon: number
}

export type StickyWeatherPrediction = {
  probability: number
}

export interface Forecast {
  datetime: string
  probability: number
}

export type StickyWeatherForecast = {
  nearestStation: string
  forecast: Forecast[]
}

export type CapturedWeatherData = {
  id: number
}

export class DjangoApiError extends JsonApiError {}

/**
 * Client for the Django routes mounted at `/api/`.
 *
 * Set `VITE_DJANGO_API_URL` to a full URL when Django is hosted separately,
 * for example `http://localhost:8000/api`.
 */
export class DjangoApiClient extends JsonApiClient {
  constructor(baseUrl = import.meta.env.VITE_DJANGO_API_URL ?? '/api') {
    super(baseUrl)
  }

  getWeatherData(sticky?: boolean, options?: RequestOptions) {
    return this.get<unknown[]>('weatherdata', { sticky }, options)
  }

  getBuienradar(coordinates: Coordinates, options?: RequestOptions) {
    return this.get<unknown>('buienradar', coordinates, options)
  }

  getStickyPrediction(coordinates: Coordinates, options?: RequestOptions) {
    return this.get<StickyWeatherPrediction>(
      'stickyprediction',
      coordinates,
      options,
    )
  }

  getStickyForecast(coordinates: Coordinates, options?: RequestOptions) {
    return this.get<StickyWeatherForecast>(
      'forecaststicky',
      coordinates,
      options,
    )
  }

  captureWeatherData(
    coordinates: Coordinates & { sticky?: boolean },
    options?: RequestOptions,
  ) {
    return this.request<CapturedWeatherData>('capturedweatherdata', {
      ...options,
      method: 'POST',
      body: coordinates,
    })
  }

  protected createError(message: string, status: number, body: unknown) {
    return new DjangoApiError(message, status, body)
  }
}

export const djangoApi = new DjangoApiClient()
