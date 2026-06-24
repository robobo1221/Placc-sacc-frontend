import {
  queryOptions,
  useMutation,
  useQuery,
} from '@tanstack/react-query'

import { djangoApi } from './django-client'

import type { Coordinates } from './django-client'

export const djangoQueryKeys = {
  weatherData: (sticky?: boolean) => ['django', 'weatherdata', sticky] as const,
  buienradar: (coordinates: Coordinates) =>
    ['django', 'buienradar', coordinates] as const,
  stickyPrediction: (coordinates: Coordinates) =>
    ['django', 'stickyprediction', coordinates] as const,
  stickyForecast: (coordinates: Coordinates) =>
    ['django', 'forecaststicky', coordinates] as const,
}

export const weatherDataQueryOptions = (sticky?: boolean) =>
  queryOptions({
    queryKey: djangoQueryKeys.weatherData(sticky),
    queryFn: () => djangoApi.getWeatherData(sticky),
  })

export const buienradarQueryOptions = (coordinates: Coordinates) =>
  queryOptions({
    queryKey: djangoQueryKeys.buienradar(coordinates),
    queryFn: () => djangoApi.getBuienradar(coordinates),
  })

export const stickyPredictionQueryOptions = (coordinates: Coordinates) =>
  queryOptions({
    queryKey: djangoQueryKeys.stickyPrediction(coordinates),
    queryFn: () => djangoApi.getStickyPrediction(coordinates),
  })

export const stickyForecastQueryOptions = (coordinates: Coordinates) =>
  queryOptions({
    queryKey: djangoQueryKeys.stickyForecast(coordinates),
    queryFn: () => djangoApi.getStickyForecast(coordinates),
  })

export const useWeatherData = (sticky?: boolean) =>
  useQuery(weatherDataQueryOptions(sticky))

export const useBuienradar = (coordinates: Coordinates) =>
  useQuery(buienradarQueryOptions(coordinates))

export const useStickyPrediction = (coordinates: Coordinates) =>
  useQuery(stickyPredictionQueryOptions(coordinates))

export const useStickyForecast = (coordinates: Coordinates) =>
  useQuery(stickyForecastQueryOptions(coordinates))

export const useCaptureWeatherData = () =>
  useMutation({
    mutationKey: ['django', 'capturedweatherdata'],
    mutationFn: djangoApi.captureWeatherData.bind(djangoApi),
  })
