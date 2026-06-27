import { useEffect, useRef, useState } from "react";
import L from "leaflet";

const DEFAULT_CENTER = [14.6349, -90.5069]; // Guatemala City
const DEFAULT_ZOOM = 13;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function MapPicker({ lat, lng, onChange, height = "250px" }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const center = lat && lng ? [lat, lng] : DEFAULT_CENTER;
    const zoom = lat && lng ? 15 : DEFAULT_ZOOM;

    const map = L.map(mapRef.current).setView(center, zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
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
      if (markerRef.current) {
        markerRef.current.setLatLng([clickLat, clickLng]);
      } else {
        markerRef.current = L.marker([clickLat, clickLng], { draggable: true }).addTo(map);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current.getLatLng();
          onChange(pos.lat, pos.lng);
        });
      }
      onChange(clickLat, clickLng);
    });

    mapInstance.current = map;
    setReady(true);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !lat || !lng) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapInstance.current);
      markerRef.current.on("dragend", () => {
        const pos = markerRef.current.getLatLng();
        onChange(pos.lat, pos.lng);
      });
    }
    mapInstance.current.setView([lat, lng], 15);
  }, [lat, lng]);

  return (
    <div className="map-picker">
      <div ref={mapRef} style={{ height, width: "100%", borderRadius: "8px" }} />
      <small className="map-hint">
        {lat && lng
          ? `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)} — arrastrá el pin o tocá en el mapa`
          : "Tocá en el mapa para ubicar la cancha"}
      </small>
    </div>
  );
}
