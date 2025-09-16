import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

export function MapView({ places, loading }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // Filter places that have valid coordinates
  const geocodedPlaces = places.filter(p => p.lat != null && p.lon != null);

  useEffect(() => {
    // Try to load Leaflet dynamically to avoid initial bundle issues
    const loadLeafletMap = async () => {
      try {
        if (!mapRef.current || geocodedPlaces.length === 0) return;

        // Dynamic import to avoid SSR issues
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');

        // Fix icon paths for bundlers
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        // Clear existing map
        mapRef.current.innerHTML = '';

        // Calculate center and bounds
        let center: [number, number] = [40, 0];
        let zoom = 2;

        if (geocodedPlaces.length === 1) {
          center = [geocodedPlaces[0].lat!, geocodedPlaces[0].lon!];
          zoom = 6;
        } else if (geocodedPlaces.length > 1) {
          const lats = geocodedPlaces.map(p => p.lat!);
          const lons = geocodedPlaces.map(p => p.lon!);
          center = [
            (Math.min(...lats) + Math.max(...lats)) / 2,
            (Math.min(...lons) + Math.max(...lons)) / 2
          ];
          zoom = 4;
        }

        // Create map
        const map = L.map(mapRef.current).setView(center, zoom);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Add markers
        geocodedPlaces.forEach((place) => {
          L.marker([place.lat!, place.lon!])
            .addTo(map)
            .bindPopup(`${place.place}${place.date ? ` (${new Date(place.date).getFullYear()})` : ''}`);
        });

        // Add polyline if multiple places
        if (geocodedPlaces.length > 1) {
          const sortedPlaces = [...geocodedPlaces].sort((a, b) => {
            if (!a.date && !b.date) return 0;
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          });

          const polylinePoints = sortedPlaces.map(p => [p.lat!, p.lon!] as [number, number]);
          L.polyline(polylinePoints, {
            color: '#3b82f6',
            weight: 2,
            opacity: 0.7,
            dashArray: '5, 5'
          }).addTo(map);
        }

        // Fit bounds if multiple points
        if (geocodedPlaces.length > 1) {
          const bounds = L.latLngBounds(geocodedPlaces.map(p => [p.lat!, p.lon!]));
          map.fitBounds(bounds, { padding: [20, 20] });
        }

        // Handle resize for tabs
        setTimeout(() => {
          map.invalidateSize();
        }, 100);

      } catch (error) {
        console.error('Failed to load map:', error);
        setMapError('Failed to load map');
      }
    };

    loadLeafletMap();
  }, [geocodedPlaces]);

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

  if (mapError) {
    return (
      <Card className="bg-card border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Geographic Movements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex flex-col items-center justify-center text-slate-400">
            <MapPin className="h-16 w-16 mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Map Error</h3>
            <p className="text-center max-w-md">
              {mapError}
            </p>
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

  return (
    <Card className="bg-card border-slate-700">
      <CardHeader>
        <CardTitle className="text-slate-100">Geographic Movements</CardTitle>
        <p className="text-sm text-slate-400">
          {geocodedPlaces.length} location{geocodedPlaces.length !== 1 ? 's' : ''} traced
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div 
          ref={mapRef} 
          className="h-96 w-full rounded-b-lg overflow-hidden bg-slate-800"
        />
      </CardContent>
    </Card>
  );
}