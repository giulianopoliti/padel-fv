export interface GoogleMapsLocation {
  name?: string | null
  address?: string | null
  formattedAddress?: string | null
  googlePlaceId?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
}

const cleanText = (value: string | null | undefined) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const cleanCoordinate = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const buildQuery = (location: GoogleMapsLocation) => {
  const coordinates = {
    latitude: cleanCoordinate(location.latitude),
    longitude: cleanCoordinate(location.longitude),
  }

  if (coordinates.latitude !== null && coordinates.longitude !== null) {
    return `${coordinates.latitude},${coordinates.longitude}`
  }

  return [
    cleanText(location.name),
    cleanText(location.formattedAddress) || cleanText(location.address),
  ]
    .filter(Boolean)
    .join(', ')
}

export const buildGoogleMapsSearchUrl = (location: GoogleMapsLocation) => {
  const query = buildQuery(location)
  if (!query) return null

  const params = new URLSearchParams({
    api: '1',
    query,
  })

  const placeId = cleanText(location.googlePlaceId)
  if (placeId) {
    params.set('query_place_id', placeId)
  }

  return `https://www.google.com/maps/search/?${params.toString()}`
}
