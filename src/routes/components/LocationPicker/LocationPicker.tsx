import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material'
import 'leaflet/dist/leaflet.css'
import { LocateFixed } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'

import {
  loadLeafletModule,
  loadNetherlandsGeometry,
  NETHERLANDS_MAP_BOUNDS,
  preloadMapDependencies,
} from '#/routes/components/Heatmap/utils/heatmapRendering'

import type { Coordinates } from '#/api/django-client'
import type {
  LeafletLayer,
  LeafletMap,
  LeafletModule,
  NetherlandsGeometry,
} from '#/routes/components/Heatmap/utils/heatmapRendering'
import type { LeafletMouseEvent } from 'leaflet'

type LocationPickerProps = {
  browserLocationAvailable: boolean
  coordinates: Coordinates | null
  onSelect: (coordinates: Coordinates) => void
  onUseBrowserLocation: () => void
}

type LocationPickerMapRef = {
  boundaryLayer: LeafletLayer
  instance: LeafletMap
  leaflet: LeafletModule
  markerLayer: LeafletLayer | null
}

const createMarkerLayer = (
  leaflet: LeafletModule,
  coordinates: Coordinates,
): LeafletLayer =>
  leaflet.circleMarker([coordinates.lat, coordinates.lon], {
    color: '#0f766e',
    fillColor: '#14b8a6',
    fillOpacity: 0.85,
    radius: 7,
    weight: 2,
  })

export const LocationPicker = ({
  browserLocationAvailable,
  coordinates,
  onSelect,
  onUseBrowserLocation,
}: LocationPickerProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const coordinatesRef = useRef<Coordinates | null>(coordinates)
  const mapRef = useRef<LocationPickerMapRef | null>(null)

  const syncMarker = useCallback((nextCoordinates: Coordinates | null) => {
    const map = mapRef.current

    if (!map) return

    map.markerLayer?.remove()

    if (!nextCoordinates) {
      map.markerLayer = null
      return
    }

    const markerLayer = createMarkerLayer(map.leaflet, nextCoordinates)
    markerLayer.addTo(map.instance)
    map.markerLayer = markerLayer
  }, [])

  const handleMapClick = useCallback(
    (event: LeafletMouseEvent) => {
      onSelect({
        lat: event.latlng.lat,
        lon: event.latlng.lng,
      })
    },
    [onSelect],
  )

  useEffect(() => {
    preloadMapDependencies()
  }, [])

  useEffect(() => {
    coordinatesRef.current = coordinates
  }, [coordinates])

  useEffect(() => {
    if (!mapContainerRef.current) return

    let isDisposed = false

    void Promise.all([loadLeafletModule(), loadNetherlandsGeometry()]).then(
      ([leaflet, geometry]: [LeafletModule, NetherlandsGeometry]) => {
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

        const boundaryLayer = leaflet
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
          boundaryLayer,
          instance,
          leaflet,
          markerLayer: null,
        }

        instance.on('click', handleMapClick)
        syncMarker(coordinatesRef.current)

        requestAnimationFrame(() => instance.invalidateSize())
      },
    )

    return () => {
      isDisposed = true

      if (mapRef.current) {
        mapRef.current.instance.off('click', handleMapClick)
        mapRef.current.instance.remove()
        mapRef.current = null
      }
    }
  }, [handleMapClick, syncMarker])

  useEffect(() => {
    syncMarker(coordinates)
  }, [coordinates, syncMarker])

  return (
    <Card>
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Box>
            <Typography component="h2" variant="h6">
              Forecast location
            </Typography>

            {coordinates && (
              <Typography color="text.secondary" variant="body2">
                {coordinates.lat.toFixed(5)}, {coordinates.lon.toFixed(5)}
              </Typography>
            )}
          </Box>

          {browserLocationAvailable && (
            <Button
              onClick={onUseBrowserLocation}
              startIcon={<LocateFixed size={18} />}
              variant="outlined"
            >
              Use current location
            </Button>
          )}
        </Stack>

        <Box
          aria-label="Forecast location picker"
          ref={mapContainerRef}
          sx={{
            borderRadius: 1,
            height: { xs: 280, md: 360 },
            overflow: 'hidden',
          }}
        />
      </CardContent>
    </Card>
  )
}
