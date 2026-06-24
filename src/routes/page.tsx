import { Box, Stack, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { djangoApi } from '#/api/django-client'
import {
  djangoQueryKeys,
  stickyForecastQueryOptions,
  stickyPredictionQueryOptions,
} from '#/api/django-queries'
import { CurrentProbabilityCard } from '#/routes/components/CurrentProbabilityCard/CurrentProbabilityCard'
import { ForecastCard } from '#/routes/components/ForecastCard/ForecastCard'
import { Heatmap } from '#/routes/components/Heatmap/Heatmap'
import { LocationStatus } from '#/routes/components/LocationStatus/LocationStatus'
import { MeasurementCard } from '#/routes/components/MeasurementCard/MeasurementCard'
import { useCurrentLocation } from '#/routes/hooks/useCurrentLocation'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const queryClient = useQueryClient()
  const { coordinates, error: locationError, isLoading } = useCurrentLocation()
  const [sticky, setSticky] = useState(false)
  const [heatmapRegenerateToken, setHeatmapRegenerateToken] = useState(0)

  const predictionQuery = useQuery({
    ...stickyPredictionQueryOptions(coordinates ?? { lat: 0, lon: 0 }),
    enabled: coordinates !== null,
  })
  const forecastQuery = useQuery({
    ...stickyForecastQueryOptions(coordinates ?? { lat: 0, lon: 0 }),
    enabled: coordinates !== null,
  })
  const captureMutation = useMutation({
    mutationFn: (input: { lat: number; lon: number; sticky: boolean }) =>
      djangoApi.captureWeatherData(input),
    onSuccess: async (_, input) => {
      if (!coordinates) return

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: djangoQueryKeys.stickyPrediction(coordinates),
        }),
        queryClient.invalidateQueries({
          queryKey: djangoQueryKeys.stickyForecast(coordinates),
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
        isLoading={isLoading}
        locationError={locationError}
      />

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
