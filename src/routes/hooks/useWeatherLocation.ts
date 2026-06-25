import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

import {
  stickyForecastQueryOptions,
  stickyPredictionQueryOptions,
} from '#/api/django-queries'
import { useCurrentLocation } from '#/routes/hooks/useCurrentLocation'

import type { Coordinates } from '#/api/django-client'

export type WeatherLocationSource = 'browser' | 'manual'

export const useWeatherLocation = () => {
  const browserLocation = useCurrentLocation()
  const [manualCoordinates, setManualCoordinates] =
    useState<Coordinates | null>(null)

  const coordinates = manualCoordinates ?? browserLocation.coordinates
  const source: WeatherLocationSource =
    manualCoordinates === null ? 'browser' : 'manual'

  const queryCoordinates = coordinates ?? { lat: 0, lon: 0 }
  const isQueryEnabled = coordinates !== null

  const predictionQuery = useQuery({
    ...stickyPredictionQueryOptions(queryCoordinates),
    enabled: isQueryEnabled,
  })
  const forecastQuery = useQuery({
    ...stickyForecastQueryOptions(queryCoordinates),
    enabled: isQueryEnabled,
  })

  const selectManualCoordinates = useCallback(
    (nextCoordinates: Coordinates) => {
      setManualCoordinates(nextCoordinates)
    },
    [],
  )

  const useBrowserCoordinates = useCallback(() => {
    setManualCoordinates(null)
  }, [])

  return useMemo(
    () => ({
      coordinates,
      forecastQuery,
      isBrowserLocationLoading:
        manualCoordinates === null && browserLocation.isLoading,
      locationError: manualCoordinates === null ? browserLocation.error : null,
      manualCoordinates,
      predictionQuery,
      selectManualCoordinates,
      source,
      useBrowserCoordinates,
    }),
    [
      browserLocation.error,
      browserLocation.isLoading,
      coordinates,
      forecastQuery,
      manualCoordinates,
      predictionQuery,
      selectManualCoordinates,
      source,
      useBrowserCoordinates,
    ],
  )
}
