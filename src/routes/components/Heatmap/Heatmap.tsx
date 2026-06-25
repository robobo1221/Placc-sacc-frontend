import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  LinearProgress,
  Popover,
  Stack,
  Typography,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useQueryClient } from '@tanstack/react-query'
import 'leaflet/dist/leaflet.css'
import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { stickyPredictionQueryOptions } from '#/api/django-queries'
import { useSnackbar } from '#/components/SnackbarProvider/SnackbarProvider'
import {
  createHeatmapGrid,
  createHeatmapLayerStyle,
  createIdwLayer,
  getHeatmapSelection,
  loadLeafletModule,
  loadNetherlandsGeometry,
  NETHERLANDS_MAP_BOUNDS,
  preloadMapDependencies,
} from '#/routes/components/Heatmap/utils/heatmapRendering.ts'

import type { Coordinates } from '#/api/django-client'
import type {
  HeatmapMapRef,
  HeatmapPoint,
  HeatmapSelection,
} from '#/routes/components/Heatmap/utils/heatmapRendering.ts'
import type { LeafletMouseEvent } from 'leaflet'

type Prediction = { probability: number }

const PREDICTION_STALE_TIME = 1000
const PREDICTION_GC_TIME = 1000

type HeatmapProps = {
  regenerateToken: number
}

type HeatmapPopoverState = {
  anchorPosition: {
    left: number
    top: number
  }
  selection: HeatmapSelection
}

export const Heatmap = ({ regenerateToken }: HeatmapProps) => {
  const theme = useTheme()
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([])
  const [progress, setProgress] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isMapReady, setIsMapReady] = useState(false)
  const [popoverState, setPopoverState] = useState<HeatmapPopoverState | null>(
    null,
  )

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HeatmapMapRef | null>(null)
  const generationRef = useRef(0)
  const heatmapRef = useRef<HeatmapPoint[]>([])

  const grid = useMemo(createHeatmapGrid, [])
  const heatmapLayerStyle = useMemo(
    () => createHeatmapLayerStyle(theme.heatmap),
    [theme.heatmap],
  )

  const getPredictionQueryOptions = useCallback((point: Coordinates) => {
    return {
      ...stickyPredictionQueryOptions(point),
      staleTime: PREDICTION_STALE_TIME,
      gcTime: PREDICTION_GC_TIME,
    }
  }, [])

  const isQueryFresh = useCallback(
    (queryKey: readonly unknown[]) => {
      const queryState = queryClient.getQueryState(queryKey)

      if (!queryState?.dataUpdatedAt) return false

      return Date.now() - queryState.dataUpdatedAt < PREDICTION_STALE_TIME
    },
    [queryClient],
  )

  const handleMapClick = useCallback((event: LeafletMouseEvent) => {
    const map = mapRef.current?.instance

    if (!map) return

    const selection = getHeatmapSelection(
      map,
      event.latlng.lat,
      event.latlng.lng,
      heatmapRef.current,
    )

    if (!selection) {
      setPopoverState(null)
      return
    }

    setPopoverState({
      anchorPosition: {
        left: event.originalEvent.clientX,
        top: event.originalEvent.clientY,
      },
      selection,
    })
  }, [])

  const generate = useCallback(async () => {
    const generation = generationRef.current + 1
    generationRef.current = generation

    setIsGenerating(true)
    setProgress(0)

    const currentHeatmap = heatmapRef.current
    const currentHeatmapByCoordinate = new Map(
      currentHeatmap.map((point) => [`${point.lat}:${point.lon}`, point]),
    )

    const nextHeatmapByIndex: Array<HeatmapPoint | null> = grid.map((point) => {
      return currentHeatmapByCoordinate.get(`${point.lat}:${point.lon}`) ?? null
    })

    const flushNextHeatmap = () => {
      if (generationRef.current !== generation) return

      const nextHeatmap = nextHeatmapByIndex.filter(
        (point): point is HeatmapPoint => point !== null,
      )

      heatmapRef.current = nextHeatmap
      setHeatmap(nextHeatmap)
    }

    try {
      preloadMapDependencies()

      let completed = 0

      await Promise.all(
        grid.map(async (point, index) => {
          const predictionQueryOptions = getPredictionQueryOptions(point)
          const cachedPrediction = queryClient.getQueryData<Prediction>(
            predictionQueryOptions.queryKey,
          )

          const hasFreshCache =
            cachedPrediction && isQueryFresh(predictionQueryOptions.queryKey)

          if (hasFreshCache) {
            nextHeatmapByIndex[index] = {
              ...point,
              probability: cachedPrediction.probability,
            }

            flushNextHeatmap()

            completed += 1
            setProgress((completed / grid.length) * 100)

            return
          }

          try {
            const prediction = await queryClient.fetchQuery(
              predictionQueryOptions,
            )

            nextHeatmapByIndex[index] = {
              ...point,
              probability: prediction.probability,
            }

            flushNextHeatmap()
          } catch {
            if (cachedPrediction) {
              nextHeatmapByIndex[index] = {
                ...point,
                probability: cachedPrediction.probability,
              }

              flushNextHeatmap()
            }
          } finally {
            completed += 1

            if (generationRef.current === generation) {
              setProgress((completed / grid.length) * 100)
            }
          }
        }),
      )

      if (generationRef.current !== generation) return

      const nextHeatmap = nextHeatmapByIndex.filter(
        (point): point is HeatmapPoint => point !== null,
      )

      if (nextHeatmap.length > 0) {
        showSnackbar(
          currentHeatmap.length > 0
            ? 'Heatmap updated successfully.'
            : 'Heatmap generated successfully.',
        )
      } else {
        showSnackbar('Unable to generate heatmap data.', 'error')
      }
    } catch {
      if (generationRef.current === generation) {
        showSnackbar('Unable to generate the heatmap.', 'error')
      }
    } finally {
      if (generationRef.current === generation) {
        setIsGenerating(false)
      }
    }
  }, [getPredictionQueryOptions, grid, isQueryFresh, queryClient, showSnackbar])

  useEffect(() => {
    preloadMapDependencies()
  }, [])

  useEffect(() => {
    heatmapRef.current = heatmap

    if (heatmap.length === 0) {
      setPopoverState(null)
    }
  }, [heatmap])

  useEffect(() => {
    if (!mapContainerRef.current) return

    let isDisposed = false

    void Promise.all([loadLeafletModule(), loadNetherlandsGeometry()]).then(
      ([leaflet, geometry]) => {
        if (isDisposed || !mapContainerRef.current || mapRef.current) return

        const netherlandsBounds = leaflet.latLngBounds(NETHERLANDS_MAP_BOUNDS)

        const instance = leaflet
          .map(mapContainerRef.current, {
            maxBounds: netherlandsBounds,
            maxBoundsViscosity: 1,
            scrollWheelZoom: true,
          })
          .fitBounds(netherlandsBounds)

        instance.setMinZoom(instance.getZoom())

        leaflet
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 18,
          })
          .addTo(instance)

        leaflet
          .geoJSON(geometry, {
            interactive: false,
            style: {
              color: heatmapLayerStyle.boundaryColor,
              fill: false,
              weight: 1.5,
            },
          })
          .addTo(instance)

        mapRef.current = {
          instance,
          heatmapLayer: null,
          leaflet,
          geometry,
        }

        setIsMapReady(true)

        requestAnimationFrame(() => instance.invalidateSize())
      },
    )

    return () => {
      isDisposed = true
    }
  }, [heatmapLayerStyle.boundaryColor])

  useEffect(() => {
    if (!isMapReady || !mapRef.current) return

    const { instance } = mapRef.current

    instance.on('click', handleMapClick)

    return () => {
      instance.off('click', handleMapClick)
    }
  }, [handleMapClick, isMapReady])

  useEffect(() => {
    if (!isMapReady || !mapRef.current) return

    const { instance, leaflet, geometry } = mapRef.current

    mapRef.current.heatmapLayer?.remove()

    if (heatmap.length === 0) {
      mapRef.current.heatmapLayer = null
      return
    }

    const heatmapLayer = createIdwLayer(
      leaflet,
      geometry,
      heatmap,
      heatmapLayerStyle,
    )

    heatmapLayer.addTo(instance)

    mapRef.current.heatmapLayer = heatmapLayer
  }, [heatmap, heatmapLayerStyle, isMapReady])

  useEffect(() => {
    if (regenerateToken > 0) {
      void generate()
    }
  }, [generate, regenerateToken])

  useEffect(
    () => () => {
      mapRef.current?.instance.remove()
      mapRef.current = null
    },
    [],
  )

  return (
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
            disabled={isGenerating}
            loading={isGenerating}
            onClick={generate}
            variant="contained"
          >
            {heatmap.length > 0 ? 'Update heatmap' : 'Generate heatmap'}
          </Button>
        </Stack>

        {isGenerating && (
          <Box sx={{ mt: 3 }}>
            <LinearProgress
              value={progress}
              variant="determinate"
              sx={{
                backgroundColor: theme.heatmap.progressBarBackground,
                borderRadius: 1,
                height: 8,
                '& .MuiLinearProgress-bar': {
                  backgroundImage: theme.heatmap.progressBarGradient,
                  borderRadius: 'inherit',
                },
              }}
            />

            <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
              {progress.toFixed(0)}% completed
            </Typography>
          </Box>
        )}

        <Box
          aria-label="Sticky-ball probability heatmap"
          ref={mapContainerRef}
          sx={{
            borderRadius: 1,
            height: { xs: 360, md: 560 },
            mt: 3,
            overflow: 'hidden',
          }}
        />

        <Popover
          anchorPosition={popoverState?.anchorPosition}
          anchorReference="anchorPosition"
          onClose={() => setPopoverState(null)}
          open={popoverState !== null}
          sx={{
            zIndex: (muiTheme) => muiTheme.zIndex.tooltip,
          }}
          slotProps={{
            paper: {
              sx: {
                p: 1.5,
              },
            },
          }}
          transformOrigin={{
            horizontal: 'left',
            vertical: 'top',
          }}
        >
          {popoverState && (
            <Stack spacing={0.5}>
              <Stack
                alignItems="center"
                direction="row"
                justifyContent="space-between"
                spacing={1}
              >
                <Typography fontWeight={600} variant="body2">
                  {Math.round(popoverState.selection.probability * 100)}%
                  probability
                </Typography>

                <IconButton
                  aria-label="Close location details"
                  onClick={() => setPopoverState(null)}
                  size="small"
                >
                  <X size={16} />
                </IconButton>
              </Stack>

              <Typography color="text.secondary" variant="caption">
                Latitude: {popoverState.selection.lat.toFixed(5)}
              </Typography>

              <Typography color="text.secondary" variant="caption">
                Longitude: {popoverState.selection.lon.toFixed(5)}
              </Typography>
            </Stack>
          )}
        </Popover>
      </CardContent>
    </Card>
  )
}
