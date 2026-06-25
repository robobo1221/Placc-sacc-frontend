import { Stack } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { djangoApi } from '#/api/django-client'
import { djangoQueryKeys } from '#/api/django-queries'
import { CurrentProbabilityCard } from '#/routes/components/CurrentProbabilityCard/CurrentProbabilityCard'
import { ForecastCard } from '#/routes/components/ForecastCard/ForecastCard'
import { Heatmap } from '#/routes/components/Heatmap/Heatmap'
import { LocationPicker } from '#/routes/components/LocationPicker/LocationPicker'
import { LocationStatus } from '#/routes/components/LocationStatus/LocationStatus'
import { MeasurementCard } from '#/routes/components/MeasurementCard/MeasurementCard'
import { useWeatherLocation } from '#/routes/hooks/useWeatherLocation'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const queryClient = useQueryClient()
  const {
    coordinates,
    forecastQuery,
    isBrowserLocationLoading,
    locationError,
    predictionQuery,
    selectManualCoordinates,
    useBrowserCoordinates,
  } = useWeatherLocation()
  const [sticky, setSticky] = useState(false)
  const [heatmapRegenerateToken, setHeatmapRegenerateToken] = useState(0)

  const captureMutation = useMutation({
    mutationFn: (input: { lat: number; lon: number; sticky: boolean }) =>
      djangoApi.captureWeatherData(input),
    onSuccess: async (_, input) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: djangoQueryKeys.stickyPrediction(input),
        }),
        queryClient.invalidateQueries({
          queryKey: djangoQueryKeys.stickyForecast(input),
        }),
      ])

      if (input.sticky) {
        setHeatmapRegenerateToken((token) => token + 1)
      }
    },
  })

  const dataError = predictionQuery.error ?? forecastQuery.error

  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <LocationStatus
        hasCaptureError={captureMutation.isError}
        hasDataError={Boolean(dataError)}
        isLoading={isBrowserLocationLoading}
        locationError={locationError}
      />

      {(locationError || coordinates) && (
        <LocationPicker
          browserLocationAvailable={locationError === null}
          coordinates={coordinates}
          onSelect={selectManualCoordinates}
          onUseBrowserLocation={useBrowserCoordinates}
        />
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        <MeasurementCard
          coordinates={coordinates}
          isSubmitting={captureMutation.isPending}
          onStickyChange={setSticky}
          onSubmit={() =>
            coordinates && captureMutation.mutate({ ...coordinates, sticky })
          }
          sticky={sticky}
        />
        <CurrentProbabilityCard
          isLoading={predictionQuery.isLoading}
          probability={predictionQuery.data?.probability}
        />
      </Stack>

      <ForecastCard forecast={forecastQuery.data} />
      <Heatmap regenerateToken={heatmapRegenerateToken} />
    </Stack>
  )
}
