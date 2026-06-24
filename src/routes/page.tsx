import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import dayjs from 'dayjs'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'

import { djangoApi } from '#/api/django-client'
import {
  djangoQueryKeys,
  stickyForecastQueryOptions,
  stickyPredictionQueryOptions,
} from '#/api/django-queries'

import type { Coordinates } from '#/api/django-client'

export const Route = createFileRoute('/')({
  component: Home,
})

type HeatmapPoint = Coordinates & { probability: number }

const HEATMAP_BOUNDS = {
  latMin: 50.750383,
  latMax: 53.5,
  lonMin: 3.358402,
  lonMax: 7.22751,
}

const formatProbability = (probability: number) =>
  `${(probability * 100).toFixed(2)}%`

const idwColor = (probability: number) => {
  const hue = Math.round((1 - Math.min(Math.max(probability, 0), 1)) * 240)
  return `hsla(${hue}, 85%, 48%, 0.58)`
}

const createHeatmapGrid = (): Coordinates[] => {
  const rows = 6
  const columns = 9

  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns

    return {
      lat:
        HEATMAP_BOUNDS.latMin +
        ((HEATMAP_BOUNDS.latMax - HEATMAP_BOUNDS.latMin) * row) / (rows - 1),
      lon:
        HEATMAP_BOUNDS.lonMin +
        ((HEATMAP_BOUNDS.lonMax - HEATMAP_BOUNDS.lonMin) * column) /
          (columns - 1),
    }
  })
}

type LeafletModule = typeof import('leaflet')
type LeafletMap = import('leaflet').Map
type LeafletLayer = import('leaflet').Layer

const createIdwLayer = (
  leaflet: LeafletModule,
  points: HeatmapPoint[],
): LeafletLayer => {
  const IdwLayer = leaflet.Layer.extend({
    onAdd(this: any, map: LeafletMap) {
      this.map = map
      this.canvas = leaflet.DomUtil.create(
        'canvas',
        'leaflet-layer leaflet-zoom-animated',
      )
      map.getPanes().overlayPane.appendChild(this.canvas)
      this.redraw = this.redraw.bind(this)
      map.on('moveend zoomend resize', this.redraw)
      this.redraw()
    },
    onRemove(this: any, map: LeafletMap) {
      map.off('moveend zoomend resize', this.redraw)
      this.canvas.remove()
    },
    redraw(this: any) {
      const map = this.map as LeafletMap
      const canvas = this.canvas as HTMLCanvasElement
      const size = map.getSize()
      const topLeft = map.containerPointToLayerPoint([0, 0])

      canvas.width = size.x
      canvas.height = size.y
      leaflet.DomUtil.setPosition(canvas, topLeft)

      const context = canvas.getContext('2d')
      if (!context) return

      const projectedPoints = points.map((point) => ({
        point: map.latLngToContainerPoint([point.lat, point.lon]),
        probability: point.probability,
      }))
      const cellSize = 16

      for (let y = 0; y < size.y; y += cellSize) {
        for (let x = 0; x < size.x; x += cellSize) {
          let numerator = 0
          let denominator = 0

          for (const sample of projectedPoints) {
            const distanceSquared =
              (sample.point.x - x) ** 2 + (sample.point.y - y) ** 2

            if (distanceSquared < 1) {
              numerator = sample.probability
              denominator = 1
              break
            }

            const weight = 1 / distanceSquared
            numerator += sample.probability * weight
            denominator += weight
          }

          context.fillStyle = idwColor(numerator / denominator)
          context.fillRect(x, y, cellSize, cellSize)
        }
      }
    },
  })

  return new IdwLayer()
}

function Home() {
  const queryClient = useQueryClient()
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [sticky, setSticky] = useState(false)
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([])
  const [heatmapProgress, setHeatmapProgress] = useState(0)
  const [isGeneratingHeatmap, setIsGeneratingHeatmap] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{
    instance: LeafletMap
    heatmapLayer: LeafletLayer | null
  } | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Location services are not supported by this browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
      },
      () =>
        setLocationError('Allow location access to load your local forecast.'),
    )
  }, [])

  const predictionQuery = useQuery({
    ...stickyPredictionQueryOptions(coordinates ?? { lat: 0, lon: 0 }),
    enabled: coordinates !== null,
  })
  const forecastQuery = useQuery({
    ...stickyForecastQueryOptions(coordinates ?? { lat: 0, lon: 0 }),
    enabled: coordinates !== null,
  })

  const captureMutation = useMutation({
    mutationFn: (input: Coordinates & { sticky: boolean }) =>
      djangoApi.captureWeatherData(input),
    onSuccess: async () => {
      if (coordinates) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: djangoQueryKeys.stickyPrediction(coordinates),
          }),
          queryClient.invalidateQueries({
            queryKey: djangoQueryKeys.stickyForecast(coordinates),
          }),
        ])
      }
    },
  })

  const heatmapGrid = useMemo(createHeatmapGrid, [])

  const generateHeatmap = async () => {
    setIsGeneratingHeatmap(true)
    setHeatmapProgress(0)

    let completed = 0
    const results = await Promise.all(
      heatmapGrid.map(async (point): Promise<HeatmapPoint | null> => {
        try {
          const prediction = await queryClient.fetchQuery(
            stickyPredictionQueryOptions(point),
          )
          return { ...point, probability: prediction.probability }
        } catch {
          return null
        } finally {
          completed += 1
          setHeatmapProgress((completed / heatmapGrid.length) * 100)
        }
      }),
    )

    setHeatmap(results.filter((point): point is HeatmapPoint => point !== null))
    setIsGeneratingHeatmap(false)
  }

  const isLoadingLocation = coordinates === null && locationError === null
  const dataError = predictionQuery.error ?? forecastQuery.error

  useEffect(() => {
    if (!mapContainerRef.current || heatmap.length === 0) return

    let isDisposed = false

    void import('leaflet').then((leaflet) => {
      if (isDisposed || !mapContainerRef.current) return

      if (!mapRef.current) {
        const instance = leaflet
          .map(mapContainerRef.current, { scrollWheelZoom: true })
          .setView([52.370216, 4.895168], 7)

        leaflet
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18,
          })
          .addTo(instance)

        mapRef.current = { instance, heatmapLayer: null }
      }

      mapRef.current.heatmapLayer?.remove()
      const heatmapLayer = createIdwLayer(leaflet, heatmap)
      heatmapLayer.addTo(mapRef.current.instance)
      mapRef.current.heatmapLayer = heatmapLayer
    })

    return () => {
      isDisposed = true
    }
  }, [heatmap])

  useEffect(
    () => () => {
      mapRef.current?.instance.remove()
      mapRef.current = null
    },
    [],
  )

  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <Box>
        <Typography component="h1" variant="h3" gutterBottom>
          Placczacc weather
        </Typography>
        <Typography color="text.secondary">
          Local sticky-ball probability, forecast, and regional heatmap.
        </Typography>
      </Box>

      {isLoadingLocation && (
        <Stack alignItems="center" direction="row" spacing={1}>
          <CircularProgress size={20} />
          <Typography color="text.secondary">Finding your location…</Typography>
        </Stack>
      )}
      {locationError && <Alert severity="warning">{locationError}</Alert>}
      {dataError && (
        <Alert severity="error">
          Unable to load weather data. Please try again.
        </Alert>
      )}
      {captureMutation.isError && (
        <Alert severity="error">
          Unable to save the measurement. Please try again.
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography component="h2" variant="h6" gutterBottom>
              Record your conditions
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={sticky}
                  onChange={(event) => setSticky(event.target.checked)}
                />
              }
              label="I have a sticky sack"
            />
            <Box sx={{ mt: 2 }}>
              <Button
                disabled={!coordinates || captureMutation.isPending}
                loading={captureMutation.isPending}
                onClick={() =>
                  coordinates &&
                  captureMutation.mutate({ ...coordinates, sticky })
                }
                variant="contained"
              >
                Submit measurement
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography component="h2" variant="h6" gutterBottom>
              Current probability
            </Typography>
            {predictionQuery.isLoading ? (
              <CircularProgress size={28} />
            ) : (
              <Typography component="p" variant="h2">
                {predictionQuery.data
                  ? formatProbability(predictionQuery.data.probability)
                  : '—'}
              </Typography>
            )}
            <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
              Estimated probability at your current location.
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      <Card>
        <CardContent>
          <Typography component="h2" variant="h5">
            Forecast
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {forecastQuery.data
              ? `Nearest station: ${forecastQuery.data.nearestStation}`
              : 'Loading nearest weather station…'}
          </Typography>
          <Divider />
          <List disablePadding>
            {forecastQuery.data?.forecast.map((item) => (
              <ListItem divider key={item.datetime} sx={{ px: 0 }}>
                <ListItemText
                  primary={dayjs(item.datetime).format('DD MMM YYYY, HH:mm')}
                />
                <Chip
                  label={formatProbability(item.probability)}
                  size="small"
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack
            alignItems={{ xs: 'stretch', sm: 'center' }}
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Typography component="h2" variant="h5">
                Netherlands heatmap
              </Typography>
              <Typography color="text.secondary">
                Regional prediction samples from the weather API.
              </Typography>
            </Box>
            <Button
              disabled={isGeneratingHeatmap}
              loading={isGeneratingHeatmap}
              onClick={generateHeatmap}
              variant="contained"
            >
              Generate heatmap
            </Button>
          </Stack>

          {isGeneratingHeatmap && (
            <Box sx={{ mt: 3 }}>
              <LinearProgress value={heatmapProgress} variant="determinate" />
              <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
                {heatmapProgress.toFixed(0)}% completed
              </Typography>
            </Box>
          )}

          {heatmap.length > 0 && (
            <Box
              aria-label="Sticky-ball probability heatmap"
              sx={{
                borderRadius: 1,
                height: { xs: 360, md: 560 },
                mt: 3,
                overflow: 'hidden',
              }}
              ref={mapContainerRef}
            />
          )}
        </CardContent>
      </Card>
    </Stack>
  )
}
