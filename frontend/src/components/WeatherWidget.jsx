import { useState, useEffect } from "react";
import { getWeatherForecast } from "../weather.js";

export default function WeatherWidget({ venue, date, lat, lng }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    getWeatherForecast(venue, date, lat, lng)
      .then(setWeather)
      .finally(() => setLoading(false));
  }, [venue, date, lat, lng, reloadKey]);

  if (!date) return null;
  if (loading && !weather) return <div className="weather-widget"><small>🔄 Cargando pronóstico...</small></div>;
  if (!weather) return null;

  const isRainy = weather.rain_chance >= 50;
  const isHot = weather.temp_max >= 30;

  return (
    <div className={`weather-widget ${isRainy ? "is-rainy" : ""} ${isHot ? "is-hot" : ""}`}>
      <span className="weather-icon">{weather.icon}</span>
      <div className="weather-info">
        <strong>{weather.temp_min}° - {weather.temp_max}°C</strong>
        <small>
          {weather.description}
          {weather.isHistorical ? " (histórico)" : ""}
        </small>
      </div>
      <div className="weather-details">
        {weather.rain_chance > 0 && (
          <span className="weather-detail">💧 {weather.rain_chance}%</span>
        )}
        <span className="weather-detail">💨 {weather.wind_max} km/h</span>
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
