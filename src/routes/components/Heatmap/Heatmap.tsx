import {
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { feature } from 'topojson-client'

import { stickyPredictionQueryOptions } from '#/api/django-queries'
import { useSnackbar } from '#/components/SnackbarProvider/SnackbarProvider'

import type { Coordinates } from '#/api/django-client'

type HeatmapPoint = Coordinates & { probability: number }
type Prediction = { probability: number }
type LeafletModule = typeof import('leaflet')
type LeafletMap = import('leaflet').Map
type LeafletLayer = import('leaflet').Layer

const NETHERLANDS_HEATMAP_BOUNDS = {
  latMin: 50.750383,
  latMax: 53.5,
  lonMin: 3.358402,
  lonMax: 7.22751,
}

const NETHERLANDS_MAP_BOUNDS: [[number, number], [number, number]] = [
  [50.2, 2.5],
  [54, 8],
]

const HEATMAP_ALPHA = Math.round(255 * 0.58)
const IDW_POWER = 3
const MAX_INTERPOLATION_PIXELS = 90_000
const MAX_INTERPOLATION_SCALE = 0.5
const COLOR_LUT_SIZE = 256

const PREDICTION_STALE_TIME = 1000
const PREDICTION_GC_TIME = 1000

type NetherlandsGeometry = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon
>

let leafletModulePromise: Promise<LeafletModule> | undefined
let netherlandsGeometryPromise: Promise<NetherlandsGeometry> | undefined
let netherlandsGeometry: NetherlandsGeometry | undefined

const loadLeafletModule = () => {
  leafletModulePromise ??= import('leaflet')
  return leafletModulePromise
}

const loadNetherlandsGeometry = async () => {
  if (netherlandsGeometry) return netherlandsGeometry

  netherlandsGeometryPromise ??= import('world-atlas/countries-10m.json').then(
    ({ default: countries50m }) => {
      netherlandsGeometry = feature(
        countries50m as any,
        countries50m.objects.countries.geometries.find(
          ({ id }) => id === '528',
        )! as any,
      ) as NetherlandsGeometry

      return netherlandsGeometry
    },
  )

  return netherlandsGeometryPromise
}

const preloadMapDependencies = () => {
  void loadLeafletModule()
  void loadNetherlandsGeometry()
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const hslToRgb = (hue: number, saturation: number, lightness: number) => {
  const s = saturation / 100
  const l = lightness / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (hue < 60) {
    r = c
    g = x
  } else if (hue < 120) {
    r = x
    g = c
  } else if (hue < 180) {
    g = c
    b = x
  } else if (hue < 240) {
    g = x
    b = c
  } else if (hue < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

const createColorLookupTable = () => {
  const table = new Uint8ClampedArray(COLOR_LUT_SIZE * 4)

  for (let index = 0; index < COLOR_LUT_SIZE; index += 1) {
    const probability = index / (COLOR_LUT_SIZE - 1)
    const hue = Math.round((1 - probability) * 240)
    const { r, g, b } = hslToRgb(hue, 85, 48)
    const offset = index * 4

    table[offset] = r
    table[offset + 1] = g
    table[offset + 2] = b
    table[offset + 3] = HEATMAP_ALPHA
  }

  return table
}

const COLOR_LOOKUP_TABLE = createColorLookupTable()

const writeColor = (
  target: Uint8ClampedArray,
  targetOffset: number,
  probability: number,
) => {
  const colorIndex =
    Math.round(clamp(probability, 0, 1) * (COLOR_LUT_SIZE - 1)) * 4

  target[targetOffset] = COLOR_LOOKUP_TABLE[colorIndex]
  target[targetOffset + 1] = COLOR_LOOKUP_TABLE[colorIndex + 1]
  target[targetOffset + 2] = COLOR_LOOKUP_TABLE[colorIndex + 2]
  target[targetOffset + 3] = COLOR_LOOKUP_TABLE[colorIndex + 3]
}

const getInterpolationScale = (width: number, height: number) => {
  const totalPixels = width * height

  if (totalPixels <= MAX_INTERPOLATION_PIXELS) {
    return 1
  }

  return Math.min(
    MAX_INTERPOLATION_SCALE,
    Math.sqrt(MAX_INTERPOLATION_PIXELS / totalPixels),
  )
}

const createHeatmapGrid = (): Coordinates[] => {
  const rows = 4
  const columns = 6

  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns

    return {
      lat:
        NETHERLANDS_HEATMAP_BOUNDS.latMin +
        ((NETHERLANDS_HEATMAP_BOUNDS.latMax -
          NETHERLANDS_HEATMAP_BOUNDS.latMin) *
          row) /
          (rows - 1),
      lon:
        NETHERLANDS_HEATMAP_BOUNDS.lonMin +
        ((NETHERLANDS_HEATMAP_BOUNDS.lonMax -
          NETHERLANDS_HEATMAP_BOUNDS.lonMin) *
          column) /
          (columns - 1),
    }
  })
}

const createIdwLayer = (
  leaflet: LeafletModule,
  geometry: NetherlandsGeometry,
  points: HeatmapPoint[],
): LeafletLayer => {
  const IdwLayer = leaflet.Layer.extend({
    initialize(this: any) {
      this.frame = null
      this.offscreenCanvas = document.createElement('canvas')
      this.offscreenContext = this.offscreenCanvas.getContext('2d', {
        willReadFrequently: false,
      })
    },

    onAdd(this: any, map: LeafletMap) {
      this.map = map
      this.canvas = leaflet.DomUtil.create(
        'canvas',
        'leaflet-layer leaflet-zoom-animated',
      )

      this.canvas.style.pointerEvents = 'none'

      map.getPanes().overlayPane.appendChild(this.canvas)

      this.scheduleRedraw = this.scheduleRedraw.bind(this)
      this.redraw = this.redraw.bind(this)

      map.on('moveend zoomend resize', this.scheduleRedraw)

      this.scheduleRedraw()
    },

    onRemove(this: any, map: LeafletMap) {
      map.off('moveend zoomend resize', this.scheduleRedraw)

      if (this.frame !== null) {
        cancelAnimationFrame(this.frame)
        this.frame = null
      }

      this.canvas.remove()
    },

    scheduleRedraw(this: any) {
      if (this.frame !== null) return

      this.frame = requestAnimationFrame(() => {
        this.frame = null
        this.redraw()
      })
    },

    redraw(this: any) {
      const map = this.map as LeafletMap
      const canvas = this.canvas as HTMLCanvasElement
      const context = canvas.getContext('2d')

      if (!context) return

      const size = map.getSize()
      const topLeft = map.containerPointToLayerPoint([0, 0])

      if (canvas.width !== size.x) {
        canvas.width = size.x
      }

      if (canvas.height !== size.y) {
        canvas.height = size.y
      }

      leaflet.DomUtil.setPosition(canvas, topLeft)

      context.clearRect(0, 0, size.x, size.y)

      if (points.length === 0) return

      const scale = getInterpolationScale(size.x, size.y)
      const interpolationWidth = Math.max(1, Math.ceil(size.x * scale))
      const interpolationHeight = Math.max(1, Math.ceil(size.y * scale))

      const offscreenCanvas = this.offscreenCanvas as HTMLCanvasElement
      const offscreenContext = this.offscreenContext as CanvasRenderingContext2D

      if (!offscreenContext) return

      if (offscreenCanvas.width !== interpolationWidth) {
        offscreenCanvas.width = interpolationWidth
      }

      if (offscreenCanvas.height !== interpolationHeight) {
        offscreenCanvas.height = interpolationHeight
      }

      const sampleCount = points.length
      const sampleXs = new Float32Array(sampleCount)
      const sampleYs = new Float32Array(sampleCount)
      const sampleProbabilities = new Float32Array(sampleCount)

      for (let index = 0; index < sampleCount; index += 1) {
        const point = points[index]
        const projectedPoint = map.latLngToContainerPoint([
          point.lat,
          point.lon,
        ])

        sampleXs[index] = projectedPoint.x * scale
        sampleYs[index] = projectedPoint.y * scale
        sampleProbabilities[index] = point.probability
      }

      const imageData = offscreenContext.createImageData(
        interpolationWidth,
        interpolationHeight,
      )

      const data = imageData.data

      for (let y = 0; y < interpolationHeight; y += 1) {
        for (let x = 0; x < interpolationWidth; x += 1) {
          let numerator = 0
          let denominator = 0

          for (
            let sampleIndex = 0;
            sampleIndex < sampleCount;
            sampleIndex += 1
          ) {
            const dx = sampleXs[sampleIndex] - x
            const dy = sampleYs[sampleIndex] - y
            const distanceSquared = dx * dx + dy * dy

            if (distanceSquared < 0.0001) {
              numerator = sampleProbabilities[sampleIndex]
              denominator = 1
              break
            }

            const weight = 1 / Math.pow(distanceSquared, IDW_POWER / 2)

            numerator += sampleProbabilities[sampleIndex] * weight
            denominator += weight
          }

          const probability = denominator === 0 ? 0 : numerator / denominator
          const offset = (y * interpolationWidth + x) * 4

          writeColor(data, offset, probability)
        }
      }

      offscreenContext.putImageData(imageData, 0, 0)

      const polygons =
        geometry.geometry.type === 'Polygon'
          ? [geometry.geometry.coordinates]
          : geometry.geometry.coordinates

      context.save()
      context.beginPath()

      for (const polygon of polygons) {
        for (const ring of polygon) {
          ring.forEach(([lon, lat], index) => {
            const point = map.latLngToContainerPoint([lat, lon])

            if (index === 0) {
              context.moveTo(point.x, point.y)
            } else {
              context.lineTo(point.x, point.y)
            }
          })

          context.closePath()
        }
      }

      context.clip('evenodd')

      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'

      context.drawImage(
        offscreenCanvas,
        0,
        0,
        interpolationWidth,
        interpolationHeight,
        0,
        0,
        size.x,
        size.y,
      )

      context.restore()
    },
  })

  return new IdwLayer()
}

type HeatmapProps = {
  regenerateToken: number
}

export const Heatmap = ({ regenerateToken }: HeatmapProps) => {
  const queryClient = useQueryClient()
  const { showSnackbar } = useSnackbar()

  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([])
  const [progress, setProgress] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isMapReady, setIsMapReady] = useState(false)

  const mapContainerRef = useRef<HTMLDivElement>(null)

  const mapRef = useRef<{
    instance: LeafletMap
    heatmapLayer: LeafletLayer | null
    leaflet: LeafletModule
    geometry: NetherlandsGeometry
  } | null>(null)

  const generationRef = useRef(0)
  const heatmapRef = useRef<HeatmapPoint[]>([])

  const grid = useMemo(createHeatmapGrid, [])

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
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18,
          })
          .addTo(instance)

        leaflet
          .geoJSON(geometry, {
            interactive: false,
            style: {
              color: '#263238',
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
  }, [])

  useEffect(() => {
    if (!isMapReady || !mapRef.current) return

    const { instance, leaflet, geometry } = mapRef.current

    mapRef.current.heatmapLayer?.remove()

    if (heatmap.length === 0) {
      mapRef.current.heatmapLayer = null
      return
    }

    const heatmapLayer = createIdwLayer(leaflet, geometry, heatmap)

    heatmapLayer.addTo(instance)

    mapRef.current.heatmapLayer = heatmapLayer
  }, [heatmap, isMapReady])

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
                backgroundColor: 'rgb(31 41 55)',
                borderRadius: 1,
                height: 8,
                '& .MuiLinearProgress-bar': {
                  backgroundImage:
                    'linear-gradient(90deg, rgb(255 0 0), rgb(0 255 0), rgb(0 0 255))',
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
      </CardContent>
    </Card>
  )
}
