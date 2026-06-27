const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";

const WEATHER_CODES = {
  0: { icon: "☀️", desc: "Despejado" },
  1: { icon: "🌤️", desc: "Mayormente despejado" },
  2: { icon: "⛅", desc: "Parcialmente nublado" },
  3: { icon: "☁️", desc: "Nublado" },
  45: { icon: "🌫️", desc: "Neblina" },
  48: { icon: "🌫️", desc: "Neblina helada" },
  51: { icon: "🌦️", desc: "Llovizna ligera" },
  53: { icon: "🌦️", desc: "Llovizna" },
  55: { icon: "🌦️", desc: "Llovizna intensa" },
  61: { icon: "🌧️", desc: "Lluvia ligera" },
  63: { icon: "🌧️", desc: "Lluvia" },
  65: { icon: "🌧️", desc: "Lluvia intensa" },
  71: { icon: "🌨️", desc: "Nieve ligera" },
  73: { icon: "🌨️", desc: "Nieve" },
  75: { icon: "🌨️", desc: "Nieve intensa" },
  80: { icon: "🌦️", desc: "Chubascos ligeros" },
  81: { icon: "🌧️", desc: "Chubascos" },
  82: { icon: "🌧️", desc: "Chubascos intensos" },
  95: { icon: "⛈️", desc: "Tormenta" },
  96: { icon: "⛈️", desc: "Tormenta con granizo" },
  99: { icon: "⛈️", desc: "Tormenta con granizo fuerte" },
};

const GUATEMALA_CITIES = {
  "guatemala": { lat: 14.6349, lon: -90.5069 },
  "ciudad de guatemala": { lat: 14.6349, lon: -90.5069 },
  "mixco": { lat: 14.6308, lon: -90.6071 },
  "villa nueva": { lat: 14.5269, lon: -90.5875 },
  "petapa": { lat: 14.5028, lon: -90.5511 },
  "san juan sacatepequez": { lat: 14.7189, lon: -90.6442 },
  "chinautla": { lat: 14.7028, lon: -90.4997 },
  "escuintla": { lat: 14.305, lon: -90.785 },
  "antigua guatemala": { lat: 14.5586, lon: -90.7295 },
  "quetzaltenango": { lat: 14.8347, lon: -91.5183 },
  "xela": { lat: 14.8347, lon: -91.5183 },
  "coban": { lat: 15.47, lon: -90.375 },
  "huehuetenango": { lat: 15.3197, lon: -91.4711 },
  "mazatenango": { lat: 14.5333, lon: -91.5 },
  "retalhuleu": { lat: 14.5333, lon: -91.6778 },
  "puerto barrios": { lat: 15.7278, lon: -88.5944 },
  "livingston": { lat: 15.8283, lon: -88.7517 },
  "flores": { lat: 16.9333, lon: -89.8833 },
  "jalapa": { lat: 14.6333, lon: -89.9833 },
  "jutiapa": { lat: 14.2917, lon: -89.8958 },
  "zacapa": { lat: 14.9722, lon: -89.5289 },
  "chiquimula": { lat: 14.8011, lon: -89.5453 },
  "salamá": { lat: 15.1072, lon: -90.3117 },
  "totonicapán": { lat: 14.9117, lon: -91.3611 },
  "sololá": { lat: 14.7722, lon: -91.1833 },
  "suchitepequez": { lat: 14.5333, lon: -91.5 },
  "san marcos": { lat: 14.9667, lon: -91.8 },
  "santa rosa": { lat: 14.3833, lon: -90.3833 },
  "baja verapaz": { lat: 15.1, lon: -90.3167 },
  "alta verapaz": { lat: 15.47, lon: -90.375 },
  "petén": { lat: 16.9333, lon: -89.8833 },
  "izabal": { lat: 15.7278, lon: -88.5944 },
  "el progreso": { lat: 14.85, lon: -90.0667 },
  "chimaltenango": { lat: 14.6611, lon: -90.8194 },
  "sacatepequez": { lat: 14.5586, lon: -90.7295 },
};

function findCoordinates(venue) {
  if (!venue) return null;
  const lower = venue.toLowerCase().trim();
  
  for (const [city, coords] of Object.entries(GUATEMALA_CITIES)) {
    if (lower.includes(city)) return coords;
  }
  
  return { lat: 14.6349, lon: -90.5069 };
}

export async function getWeatherForecast(venue, date, lat, lng, time) {
  if (!date) return null;

  try {
    let coords;
    if (lat && lng) {
      coords = { lat, lng };
    } else {
      coords = findCoordinates(venue);
    }
    if (!coords) return null;

    const today = new Date().toISOString().split("T")[0];
    const isHistorical = date < today;
    const baseUrl = isHistorical
      ? "https://archive-api.open-meteo.com/v1/archive"
      : "https://api.open-meteo.com/v1/forecast";

    let vars, url, useHourly = false;
    if (time) {
      useHourly = true;
      vars = "hourly=weathercode,temperature_2m,precipitation_probability,windspeed_10m,apparent_temperature,relative_humidity_2m&daily=weathercode,temperature_2m_max,temperature_2m_min";
    } else {
      vars = "daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max";
    }

    url = `${baseUrl}?latitude=${coords.lat}&longitude=${coords.lon}&${vars}&timezone=America/Guatemala&start_date=${date}&end_date=${date}`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();

    if (useHourly && data.hourly && data.hourly.time) {
      const targetHour = parseInt(time.split(":")[0], 10);
      const idx = data.hourly.time.findIndex((t) => {
        const dateHour = new Date(t);
        return dateHour.getDate() === new Date(date + "T12:00:00").getDate()
          && dateHour.getHours() === targetHour;
      });

      if (idx >= 0) {
        const code = data.hourly.weathercode[idx];
        const weather = WEATHER_CODES[code] || { icon: "🌡️", desc: "Desconocido" };
        return {
          date,
          time,
          icon: weather.icon,
          description: weather.desc,
          temperature: Math.round(data.hourly.temperature_2m[idx]),
          feels_like: Math.round(data.hourly.apparent_temperature?.[idx] ?? data.hourly.temperature_2m[idx]),
          rain_chance: data.hourly.precipitation_probability?.[idx] || 0,
          wind_speed: Math.round(data.hourly.windspeed_10m[idx]),
          humidity: data.hourly.relative_humidity_2m?.[idx] || null,
          is_historical: isHistorical,
          is_hourly: true,
        };
      }
    }

    if (!data.daily || !data.daily.time || data.daily.time.length === 0) return null;

    const code = data.daily.weathercode[0];
    const weather = WEATHER_CODES[code] || { icon: "🌡️", desc: "Desconocido" };

    return {
      date: data.daily.time[0],
      time: null,
      icon: weather.icon,
      description: weather.desc,
      temp_max: Math.round(data.daily.temperature_2m_max[0]),
      temp_min: Math.round(data.daily.temperature_2m_min[0]),
      rain_chance: data.daily.precipitation_probability_max[0] || 0,
      wind_max: Math.round(data.daily.windspeed_10m_max[0]),
      is_historical: isHistorical,
      is_hourly: false,
    };
  } catch (err) {
    console.error("Weather API error:", err);
    return null;
  }
}
