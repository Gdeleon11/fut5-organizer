import { useState, useEffect } from "react";
import { getWeatherForecast } from "../weather.js";

export default function WeatherWidget({ venue, date, time, lat, lng }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    getWeatherForecast(venue, date, lat, lng, time)
      .then(setWeather)
      .finally(() => setLoading(false));
  }, [venue, date, lat, lng, time, reloadKey]);

  if (!date) return null;
  if (loading && !weather) return <div className="weather-widget"><small>🔄 Cargando pronóstico...</small></div>;
  if (!weather) return null;

  const rainChance = weather.rain_chance || 0;
  const isRainy = rainChance >= 50;
  const temp = weather.temperature ?? weather.temp_max;
  const feelsLike = weather.feels_like ?? temp;
  const isHot = temp >= 30;
  const isCold = temp <= 15;

  return (
    <div className={`weather-widget ${isRainy ? "is-rainy" : ""} ${isHot ? "is-hot" : ""} ${isCold ? "is-cold" : ""}`}>
      <span className="weather-icon">{weather.icon}</span>
      <div className="weather-info">
        <strong>{temp}°C{feelsLike !== temp ? ` (sens. ${feelsLike}°)` : ""}</strong>
        <small>
          {weather.description}
          {weather.is_hourly && weather.time ? ` a las ${weather.time}` : ""}
          {weather.is_historical ? " (histórico)" : ""}
        </small>
      </div>
      <div className="weather-details">
        {rainChance > 0 && <span className="weather-detail">💧 {rainChance}%</span>}
        <span className="weather-detail">💨 {weather.wind_speed || weather.wind_max} km/h</span>
        {weather.humidity != null && <span className="weather-detail">💧 {weather.humidity}%</span>}
        <button
          className="ghost-button"
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          title="Actualizar"
          style={{ minHeight: "auto", padding: "0.2rem 0.4rem", fontSize: "0.85rem" }}
        >
          🔄
        </button>
      </div>
    </div>
  );
}
