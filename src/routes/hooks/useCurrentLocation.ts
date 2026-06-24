import { useEffect, useState } from 'react'

import type { Coordinates } from '#/api/django-client'

export const useCurrentLocation = () => {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Location services are not supported by this browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
      },
      () => setError('Allow location access to load your local forecast.'),
    )
  }, [])

  return {
    coordinates,
    error,
    isLoading: coordinates === null && error === null,
  }
}
