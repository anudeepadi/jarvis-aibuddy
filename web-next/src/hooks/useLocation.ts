'use client'

import { useState, useEffect, useCallback } from 'react'

interface LocationData {
  latitude: number
  longitude: number
  city?: string
  country?: string
  timestamp: number
}

interface UseLocationReturn {
  location: LocationData | null
  loading: boolean
  error: string | null
  requestLocation: () => void
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'unavailable'
}

const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes
const STORAGE_KEY = 'jarvis-location'

export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<LocationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'unavailable'>('prompt')

  // Check permission status
  useEffect(() => {
    if (!navigator.geolocation) {
      setPermissionStatus('unavailable')
      return
    }

    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionStatus(result.state as 'prompt' | 'granted' | 'denied')

        result.onchange = () => {
          setPermissionStatus(result.state as 'prompt' | 'granted' | 'denied')
        }
      })
    }
  }, [])

  // Load cached location on mount
  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      try {
        const data = JSON.parse(cached) as LocationData
        // Check if cache is still valid
        if (Date.now() - data.timestamp < CACHE_DURATION) {
          setLocation(data)
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  const reverseGeocode = useCallback(async (lat: number, lon: number): Promise<{ city?: string; country?: string }> => {
    try {
      const response = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`)
      if (response.ok) {
        return await response.json()
      }
    } catch (err) {
      console.error('Geocoding error:', err)
    }
    return {}
  }, [])

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }

    setLoading(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords

        // Reverse geocode to get city name
        const { city, country } = await reverseGeocode(latitude, longitude)

        const locationData: LocationData = {
          latitude,
          longitude,
          city,
          country,
          timestamp: Date.now(),
        }

        setLocation(locationData)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(locationData))
        setLoading(false)
        setPermissionStatus('granted')
      },
      (err) => {
        setLoading(false)
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied')
            setPermissionStatus('denied')
            break
          case err.POSITION_UNAVAILABLE:
            setError('Location information unavailable')
            break
          case err.TIMEOUT:
            setError('Location request timed out')
            break
          default:
            setError('An unknown error occurred')
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: CACHE_DURATION,
      }
    )
  }, [reverseGeocode])

  // Auto-request if permission already granted
  useEffect(() => {
    if (permissionStatus === 'granted' && !location) {
      requestLocation()
    }
  }, [permissionStatus, location, requestLocation])

  return {
    location,
    loading,
    error,
    requestLocation,
    permissionStatus,
  }
}
