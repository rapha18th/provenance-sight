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
    if (!mapRef.current || geocodedPlaces.length === 0) return;

    // Simple map implementation using basic HTML/CSS
    // In a real implementation, you'd use a mapping library like Leaflet
    const mapContainer = mapRef.current;
    mapContainer.innerHTML = '';

    // Create a simple coordinate-based visualization
    const bounds = {
      minLat: Math.min(...geocodedPlaces.map(p => p.lat!)),
      maxLat: Math.max(...geocodedPlaces.map(p => p.lat!)),
      minLon: Math.min(...geocodedPlaces.map(p => p.lon!)),
      maxLon: Math.max(...geocodedPlaces.map(p => p.lon!)),
    };

    const width = mapContainer.clientWidth;
    const height = mapContainer.clientHeight;

    // Sort places by date for polyline
    const sortedPlaces = [...geocodedPlaces].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Create SVG for visualization
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', width.toString());
    svg.setAttribute('height', height.toString());
    svg.setAttribute('class', 'absolute inset-0 bg-slate-800 rounded-lg');

    // Add background pattern
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pattern.setAttribute('id', 'grid');
    pattern.setAttribute('width', '20');
    pattern.setAttribute('height', '20');
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 20 0 L 0 0 0 20');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'hsl(var(--slate-700))');
    path.setAttribute('stroke-width', '0.5');
    
    pattern.appendChild(path);
    defs.appendChild(pattern);
    svg.appendChild(defs);

    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', 'url(#grid)');
    svg.appendChild(bgRect);

    // Draw polyline connecting places chronologically
    if (sortedPlaces.length > 1) {
      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      const points = sortedPlaces.map(place => {
        const x = ((place.lon! - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * (width - 60) + 30;
        const y = ((bounds.maxLat - place.lat!) / (bounds.maxLat - bounds.minLat)) * (height - 60) + 30;
        return `${x},${y}`;
      }).join(' ');
      
      polyline.setAttribute('points', points);
      polyline.setAttribute('fill', 'none');
      polyline.setAttribute('stroke', 'hsl(var(--primary))');
      polyline.setAttribute('stroke-width', '2');
      polyline.setAttribute('stroke-dasharray', '5,5');
      svg.appendChild(polyline);
    }

    // Add markers for each place
    geocodedPlaces.forEach((place, index) => {
      const x = ((place.lon! - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * (width - 60) + 30;
      const y = ((bounds.maxLat - place.lat!) / (bounds.maxLat - bounds.minLat)) * (height - 60) + 30;

      // Marker circle
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      marker.setAttribute('cx', x.toString());
      marker.setAttribute('cy', y.toString());
      marker.setAttribute('r', '8');
      marker.setAttribute('fill', 'hsl(var(--primary))');
      marker.setAttribute('stroke', 'hsl(var(--background))');
      marker.setAttribute('stroke-width', '2');
      marker.setAttribute('class', 'cursor-pointer hover:opacity-80 transition-opacity');
      
      // Add title for tooltip
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${place.place}${place.date ? ` (${new Date(place.date).getFullYear()})` : ''}`;
      marker.appendChild(title);
      
      svg.appendChild(marker);

      // Label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', (x + 12).toString());
      label.setAttribute('y', (y + 4).toString());
      label.setAttribute('fill', 'hsl(var(--slate-200))');
      label.setAttribute('font-size', '12');
      label.setAttribute('font-family', 'system-ui, sans-serif');
      label.textContent = place.place;
      svg.appendChild(label);
    });

    mapContainer.appendChild(svg);
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
          className="relative h-96 w-full bg-slate-800 rounded-b-lg overflow-hidden"
        />
      </CardContent>
    </Card>
  );
}