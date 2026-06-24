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

type NetherlandsGeometry = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon
>

let netherlandsGeometry: NetherlandsGeometry | undefined

const loadNetherlandsGeometry = async () => {
  if (netherlandsGeometry) return netherlandsGeometry

  const { default: countries50m } =
    await import('world-atlas/countries-10m.json')
  netherlandsGeometry = feature(
    countries50m as any,
    countries50m.objects.countries.geometries.find(
      ({ id }) => id === '528',
    )! as any,
  ) as NetherlandsGeometry

  return netherlandsGeometry
}

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
    onAdd(this: any, map: LeafletMap) {
      this.map = map
      this.canvas = leaflet.DomUtil.create(
        'canvas',
        'leaflet-layer leaflet-zoom-animated',
      )
      this.canvas.style.pointerEvents = 'none'
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
            if (index === 0) context.moveTo(point.x, point.y)
            else context.lineTo(point.x, point.y)
          })
          context.closePath()
        }
      }
      context.clip('evenodd')

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

            const weight = 1 / Math.pow(Math.sqrt(distanceSquared), 3)
            numerator += sample.probability * weight
            denominator += weight
          }

          context.fillStyle = idwColor(numerator / denominator)
          context.fillRect(x, y, cellSize, cellSize)
        }
      }

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
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{
    instance: LeafletMap
    heatmapLayer: LeafletLayer | null
  } | null>(null)
  const grid = useMemo(createHeatmapGrid, [])

  const generate = useCallback(async () => {
    setIsGenerating(true)
    setProgress(0)

    try {
      await loadNetherlandsGeometry()

      let completed = 0
      const results = await Promise.all(
        grid.map(async (point): Promise<HeatmapPoint | null> => {
          try {
            const prediction = await queryClient.fetchQuery(
              stickyPredictionQueryOptions(point),
            )
            return { ...point, probability: prediction.probability }
          } catch {
            return null
          } finally {
            completed += 1
            setProgress((completed / grid.length) * 100)
          }
        }),
      )

      const generatedHeatmap = results.filter(
        (point): point is HeatmapPoint => point !== null,
      )
      setHeatmap(generatedHeatmap)

      if (generatedHeatmap.length > 0) {
        showSnackbar('Heatmap generated successfully.')
      } else {
        showSnackbar('Unable to generate heatmap data.', 'error')
      }
    } catch {
      showSnackbar('Unable to generate the heatmap.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }, [grid, queryClient, showSnackbar])

  useEffect(() => {
    if (regenerateToken > 0) {
      void generate()
    }
  }, [generate, regenerateToken])

  useEffect(() => {
    if (!mapContainerRef.current || heatmap.length === 0) return

    let isDisposed = false

    void import('leaflet').then((leaflet) => {
      if (isDisposed || !mapContainerRef.current) return

      const geometry = netherlandsGeometry
      if (!geometry) return

      if (!mapRef.current) {
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
            style: { color: '#263238', fill: false, weight: 1.5 },
          })
          .addTo(instance)

        mapRef.current = { instance, heatmapLayer: null }
        requestAnimationFrame(() => instance.invalidateSize())
      }

      mapRef.current.heatmapLayer?.remove()
      const heatmapLayer = createIdwLayer(leaflet, geometry, heatmap)
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
            Generate heatmap
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

        {heatmap.length > 0 && (
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
        )}
      </CardContent>
    </Card>
  )
}
