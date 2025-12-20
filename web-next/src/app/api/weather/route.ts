import { NextRequest, NextResponse } from 'next/server'

interface WeatherData {
  current: {
    temp: number
    feels_like: number
    humidity: number
    description: string
    icon: string
    wind_speed: number
  }
  forecast: Array<{
    date: string
    temp_min: number
    temp_max: number
    description: string
    icon: string
  }>
  location: {
    city: string
    country: string
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')
  const units = searchParams.get('units') || 'metric' // metric or imperial

  if (!lat || !lon) {
    return NextResponse.json(
      { error: 'Missing lat or lon parameters' },
      { status: 400 }
    )
  }

  const apiKey = process.env.OPENWEATHERMAP_API_KEY

  if (!apiKey) {
    // Fallback to Open-Meteo (completely free, no API key needed)
    return getOpenMeteoWeather(parseFloat(lat), parseFloat(lon), units)
  }

  try {
    // Fetch current weather
    const currentResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`
    )

    if (!currentResponse.ok) {
      throw new Error('Weather API error')
    }

    const currentData = await currentResponse.json()

    // Fetch 5-day forecast
    const forecastResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`
    )

    const forecastData = forecastResponse.ok ? await forecastResponse.json() : null

    // Process forecast to get daily summaries
    const dailyForecast = forecastData
      ? processForecast(forecastData.list)
      : []

    const weather: WeatherData = {
      current: {
        temp: Math.round(currentData.main.temp),
        feels_like: Math.round(currentData.main.feels_like),
        humidity: currentData.main.humidity,
        description: currentData.weather[0].description,
        icon: currentData.weather[0].icon,
        wind_speed: Math.round(currentData.wind.speed),
      },
      forecast: dailyForecast,
      location: {
        city: currentData.name,
        country: currentData.sys.country,
      },
    }

    return NextResponse.json(weather)
  } catch (error) {
    console.error('Weather error:', error)
    // Fallback to Open-Meteo
    return getOpenMeteoWeather(parseFloat(lat), parseFloat(lon), units)
  }
}

// Free fallback using Open-Meteo (no API key required)
async function getOpenMeteoWeather(lat: number, lon: number, units: string) {
  try {
    const tempUnit = units === 'imperial' ? 'fahrenheit' : 'celsius'
    const windUnit = units === 'imperial' ? 'mph' : 'kmh'

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}&timezone=auto`
    )

    if (!response.ok) {
      throw new Error('Open-Meteo API error')
    }

    const data = await response.json()

    const weather: WeatherData = {
      current: {
        temp: Math.round(data.current.temperature_2m),
        feels_like: Math.round(data.current.apparent_temperature),
        humidity: data.current.relative_humidity_2m,
        description: getWeatherDescription(data.current.weather_code),
        icon: getWeatherIcon(data.current.weather_code),
        wind_speed: Math.round(data.current.wind_speed_10m),
      },
      forecast: data.daily.time.slice(1, 6).map((date: string, i: number) => ({
        date,
        temp_min: Math.round(data.daily.temperature_2m_min[i + 1]),
        temp_max: Math.round(data.daily.temperature_2m_max[i + 1]),
        description: getWeatherDescription(data.daily.weather_code[i + 1]),
        icon: getWeatherIcon(data.daily.weather_code[i + 1]),
      })),
      location: {
        city: data.timezone.split('/').pop()?.replace('_', ' ') || 'Unknown',
        country: '',
      },
    }

    return NextResponse.json(weather)
  } catch (error) {
    console.error('Open-Meteo error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weather' },
      { status: 500 }
    )
  }
}

function processForecast(list: Array<{ dt_txt: string; main: { temp_min: number; temp_max: number }; weather: Array<{ description: string; icon: string }> }>) {
  const dailyMap = new Map<string, { temps: number[]; description: string; icon: string }>()

  for (const item of list) {
    const date = item.dt_txt.split(' ')[0]
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { temps: [], description: item.weather[0].description, icon: item.weather[0].icon })
    }
    const day = dailyMap.get(date)!
    day.temps.push(item.main.temp_min, item.main.temp_max)
  }

  return Array.from(dailyMap.entries()).slice(0, 5).map(([date, data]) => ({
    date,
    temp_min: Math.round(Math.min(...data.temps)),
    temp_max: Math.round(Math.max(...data.temps)),
    description: data.description,
    icon: data.icon,
  }))
}

// WMO Weather interpretation codes
function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  }
  return descriptions[code] || 'Unknown'
}

function getWeatherIcon(code: number): string {
  if (code === 0) return '01d'
  if (code <= 3) return '02d'
  if (code <= 48) return '50d'
  if (code <= 55) return '09d'
  if (code <= 65) return '10d'
  if (code <= 77) return '13d'
  if (code <= 82) return '09d'
  if (code <= 86) return '13d'
  return '11d'
}
