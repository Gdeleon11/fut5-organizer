import { useState, useEffect } from "react";
import { getWeatherForecast } from "../weather.js";

export default function WeatherWidget({ venue, date }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!venue || !date) return;
    setLoading(true);
    getWeatherForecast(venue, date)
      .then(setWeather)
      .finally(() => setLoading(false));
  }, [venue, date]);

  if (!venue || !date) return null;
  if (loading) return <div className="weather-widget"><small>Cargando pronóstico...</small></div>;
  if (!weather) return null;

  const isRainy = weather.rain_chance >= 50;
  const isHot = weather.temp_max >= 30;

  return (
    <div className={`weather-widget ${isRainy ? "is-rainy" : ""} ${isHot ? "is-hot" : ""}`}>
      <span className="weather-icon">{weather.icon}</span>
      <div className="weather-info">
        <strong>{weather.temp_min}° - {weather.temp_max}°C</strong>
        <small>{weather.description}</small>
      </div>
      <div className="weather-details">
        {weather.rain_chance > 0 && (
          <span className="weather-detail">💧 {weather.rain_chance}%</span>
        )}
        <span className="weather-detail">💨 {weather.wind_max} km/h</span>
      </div>
    </div>
  );
}
