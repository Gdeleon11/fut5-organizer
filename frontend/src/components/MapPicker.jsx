import { useEffect, useRef, useState } from "react";
import L from "leaflet";

const DEFAULT_CENTER = [14.6349, -90.5069];
const DEFAULT_ZOOM = 13;
const SEARCH_ZOOM = 16;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function MapPicker({ lat, lng, onChange, height = "220px" }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const center = lat && lng ? [lat, lng] : DEFAULT_CENTER;
    const zoom = lat && lng ? SEARCH_ZOOM : DEFAULT_ZOOM;

    const map = L.map(mapRef.current).setView(center, zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    if (lat && lng) {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const pos = markerRef.current.getLatLng();
        onChange(pos.lat, pos.lng);
      });
    }

    map.on("click", (e) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      placeMarker(clickLat, clickLng, map);
      onChange(clickLat, clickLng);
    });

    mapInstance.current = map;
    setReady(true);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  function placeMarker(markerLat, markerLng, map) {
    if (markerRef.current) {
      markerRef.current.setLatLng([markerLat, markerLng]);
    } else {
      markerRef.current = L.marker([markerLat, markerLng], { draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const pos = markerRef.current.getLatLng();
        onChange(pos.lat, pos.lng);
      });
    }
  }

  useEffect(() => {
    if (!mapInstance.current || !lat || !lng) return;
    placeMarker(lat, lng, mapInstance.current);
    mapInstance.current.setView([lat, lng], SEARCH_ZOOM);
    setTimeout(() => mapInstance.current?.invalidateSize(), 100);
  }, [lat, lng]);

  function handleMyLocation() {
    if (!navigator.geolocation) {
      setSearchError("Tu navegador no soporta geolocalización.");
      return;
    }
    setLocating(true);
    setSearchError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        if (mapInstance.current) {
          placeMarker(latitude, longitude, mapInstance.current);
          mapInstance.current.setView([latitude, longitude], SEARCH_ZOOM);
        }
        onChange(latitude, longitude);
      },
      (err) => {
        setLocating(false);
        setSearchError("No se pudo obtener tu ubicación. Verificá los permisos.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchText.trim()) return;
    setSearching(true);
    setSearchError("");
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchText)}&count=1&language=es&format=json`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        setSearchError("No se encontró la dirección. Probá con otra.");
        setSearching(false);
        return;
      }
      const { latitude, longitude } = data.results[0];
      if (mapInstance.current) {
        placeMarker(latitude, longitude, mapInstance.current);
        mapInstance.current.setView([latitude, longitude], SEARCH_ZOOM);
      }
      onChange(latitude, longitude);
    } catch (err) {
      setSearchError("Error al buscar la dirección.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="map-picker">
      <div className="map-picker-controls">
        <form className="map-search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Buscar dirección o lugar..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            disabled={searching}
          />
          <button className="secondary-button" type="submit" disabled={searching || !searchText.trim()}>
            {searching ? "..." : "🔍"}
          </button>
        </form>
        <button
          className="secondary-button"
          type="button"
          onClick={handleMyLocation}
          disabled={locating}
        >
          {locating ? "📍 Localizando..." : "📍 Mi ubicación"}
        </button>
      </div>
      {searchError && <p className="map-error">{searchError}</p>}
      <div className="map-container" ref={mapRef} style={{ height, width: "100%" }} />
      <small className="map-hint">
        {lat && lng
          ? `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)} — arrastrá el pin o tocá en el mapa`
          : "Tocá en el mapa para ubicar la cancha"}
      </small>
    </div>
  );
}
