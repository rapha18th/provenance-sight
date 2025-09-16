import { useEffect, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Dynamic import to handle Leaflet properly
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Place {
  place: string;
  date?: string | null;
  lat?: number | null;
  lon?: number | null;
}

interface MapViewProps {
  places: Place[];
  loading?: boolean;
}

// Component to handle map invalidation when tab becomes visible
function MapResizer() {
  const map = useMap();
  
  useEffect(() => {
    // Small delay to ensure container is fully visible
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

// Component to handle map bounds and centering
function MapBounds({ places }: { places: Place[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (places.length === 0) return;
    
    if (places.length === 1) {
      // Single point - center with reasonable zoom
      const place = places[0];
      if (place.lat && place.lon) {
        map.setView([place.lat, place.lon], 6);
      }
    } else {
      // Multiple points - fit bounds
      const latLngs = places
        .filter(p => p.lat != null && p.lon != null)
        .map(p => [p.lat!, p.lon!] as [number, number]);
      
      if (latLngs.length > 1) {
        map.fitBounds(latLngs, { padding: [20, 20] });
      }
    }
  }, [map, places]);

  return null;
}

export function MapView({ places, loading }: MapViewProps) {
  const [mapKey, setMapKey] = useState(0);
  
  // Filter places that have valid coordinates
  const geocodedPlaces = places.filter(p => p.lat != null && p.lon != null);

  // Sort places by date for polyline
  const sortedPlaces = [...geocodedPlaces].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Force re-render when places change to handle tab visibility
  useEffect(() => {
    setMapKey(prev => prev + 1);
  }, [geocodedPlaces.length]);

  if (loading) {
    return (
      <Card className="bg-card border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Geographic Movements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (geocodedPlaces.length === 0) {
    return (
      <Card className="bg-card border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Geographic Movements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex flex-col items-center justify-center text-slate-400">
            <MapPin className="h-16 w-16 mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Geographic Data</h3>
            <p className="text-center max-w-md">
              This object's provenance events don't include specific geographic coordinates.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate default center for initial render
  const defaultCenter: [number, number] = geocodedPlaces.length === 1 
    ? [geocodedPlaces[0].lat!, geocodedPlaces[0].lon!]
    : [40, 0]; // World view center

  const defaultZoom = geocodedPlaces.length === 1 ? 6 : 2;

  return (
    <Card className="bg-card border-slate-700">
      <CardHeader>
        <CardTitle className="text-slate-100">Geographic Movements</CardTitle>
        <p className="text-sm text-slate-400">
          {geocodedPlaces.length} location{geocodedPlaces.length !== 1 ? 's' : ''} traced
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-96 w-full rounded-b-lg overflow-hidden">
          <MapContainer
            key={mapKey}
            center={defaultCenter}
            zoom={defaultZoom}
            style={{ height: '100%', width: '100%' }}
            className="rounded-b-lg"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {/* Map resize handler for tab visibility */}
            <MapResizer />
            
            {/* Bounds and centering handler */}
            <MapBounds places={geocodedPlaces} />
            
            {/* Markers for each place */}
            {geocodedPlaces.map((place, index) => (
              <Marker
                key={`${place.place}-${index}`}
                position={[place.lat!, place.lon!]}
              />
            ))}
            
            {/* Polyline connecting places chronologically */}
            {sortedPlaces.length > 1 && (
              <Polyline
                positions={sortedPlaces.map(p => [p.lat!, p.lon!])}
                pathOptions={{
                  color: "#3b82f6",
                  weight: 2,
                  opacity: 0.7,
                  dashArray: "5, 5"
                }}
              />
            )}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}