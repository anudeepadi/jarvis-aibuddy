import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  if (!lat || !lon) {
    return NextResponse.json(
      { error: 'Missing lat or lon parameters' },
      { status: 400 }
    )
  }

  try {
    // Use OpenStreetMap Nominatim for free reverse geocoding
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      {
        headers: {
          'User-Agent': 'Jarvis-AI-Assistant/1.0',
        },
      }
    )

    if (!response.ok) {
      throw new Error('Geocoding service error')
    }

    const data = await response.json()

    return NextResponse.json({
      city: data.address?.city || data.address?.town || data.address?.village || data.address?.municipality,
      country: data.address?.country,
      state: data.address?.state,
      displayName: data.display_name,
    })
  } catch (error) {
    console.error('Geocoding error:', error)
    return NextResponse.json(
      { error: 'Failed to geocode location' },
      { status: 500 }
    )
  }
}
