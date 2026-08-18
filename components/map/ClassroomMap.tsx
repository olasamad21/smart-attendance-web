'use client';
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default icon path issues in Next.js/Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface ClassroomMapProps {
  center: { lat: number; lng: number };
  radius: number;
  onLocationChange: (lat: number, lng: number) => void;
  onRadiusChange: (radius: number) => void;
}

// Component to handle external center updates (e.g., clicking "Use Current Location")
function MapCenterUpdater({ center }: { center: {lat: number, lng: number} }) {
  const map = useMapEvents({});
  useEffect(() => {
    map.flyTo([center.lat, center.lng], map.getZoom() > 16 ? map.getZoom() : 18, { animate: true, duration: 0.5 });
  }, [center.lat, center.lng, map]);
  return null;
}

// Component to handle clicking on the map to set a new location
function MapClickHandler({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

export default function ClassroomMap({ center, radius, onLocationChange, onRadiusChange }: ClassroomMapProps) {
  const markerRef = useRef<L.Marker>(null);

  // Default to a central point (e.g., a university campus or city center) if 0,0
  const defaultCenter = center.lat === 0 && center.lng === 0 
    ? { lat: 7.3775, lng: 3.9470 } // Default fallback (e.g. Ibadan)
    : center;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-64 w-full rounded-2xl overflow-hidden border border-outline-variant shadow-sm z-0">
        <MapContainer 
          center={[defaultCenter.lat, defaultCenter.lng]} 
          zoom={18} 
          style={{ height: '100%', width: '100%', zIndex: 0 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapCenterUpdater center={defaultCenter} />
          <MapClickHandler onLocationChange={onLocationChange} />
          
          <Marker 
            position={[defaultCenter.lat, defaultCenter.lng]} 
            draggable={true}
            ref={markerRef}
            eventHandlers={{
              dragend: (e) => {
                const marker = markerRef.current;
                if (marker != null) {
                  const position = marker.getLatLng();
                  onLocationChange(position.lat, position.lng);
                }
              }
            }}
          />
          
          <Circle 
            center={[defaultCenter.lat, defaultCenter.lng]} 
            radius={radius} 
            pathOptions={{ 
              color: '#4ade80', // Tailwind green-400
              fillColor: '#4ade80', 
              fillOpacity: 0.2,
              weight: 2
            }}
          />
        </MapContainer>
        <div className="absolute top-2 right-2 bg-surface/90 px-2 py-1 rounded shadow text-xs font-bold z-[400] pointer-events-none">
          Radius: {radius}m
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center text-xs font-semibold text-on-surface-variant">
          <span>Radius</span>
          <span className="text-primary">{radius}m</span>
        </div>
        <input 
          type="range" 
          min="20" 
          max="1000" 
          step="10"
          value={radius} 
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between items-center text-[10px] text-outline mt-1">
          <span>20m (Strict)</span>
          <span>1000m (Campus)</span>
        </div>
      </div>
    </div>
  );
}
