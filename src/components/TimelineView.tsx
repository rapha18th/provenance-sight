import { TimelineItem } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, AlertTriangle, Eye, Archive, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineViewProps {
  events: TimelineItem[];
  onEventClick?: (event: TimelineItem) => void;
}

export function TimelineView({ events, onEventClick }: TimelineViewProps) {
  if (!events.length) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400">
        No timeline events available
      </div>
    );
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'acquisition': return <Archive className="h-4 w-4" />;
      case 'exhibition': return <Eye className="h-4 w-4" />;
      case 'provenance': return <AlertTriangle className="h-4 w-4" />;
      case 'research': return <Search className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: string, riskLevel?: string) => {
    if (riskLevel === 'high') return 'text-risk-high';
    if (riskLevel === 'medium') return 'text-risk-medium';
    
    switch (type) {
      case 'acquisition': return 'text-primary';
      case 'exhibition': return 'text-emerald-400';
      case 'provenance': return 'text-red-400';
      case 'research': return 'text-slate-400';
      default: return 'text-slate-400';
    }
  };

  const sortedEvents = [...events].sort((a, b) => {
    const dateA = new Date(a.start_date || '1900-01-01').getTime();
    const dateB = new Date(b.start_date || '1900-01-01').getTime(); 
    return dateA - dateB;
  });

  return (
    <div className="space-y-6">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-700" />
        
        {/* Events */}
        <div className="space-y-6">
          {sortedEvents.map((event, index) => (
            <div key={`${event.title}-${index}`} className="relative flex items-start gap-4">
              {/* Timeline dot */}
              <div className={cn(
                "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background",
                'border-slate-600 bg-slate-800'
              )}>
                <span className="text-slate-400">
                  <Calendar className="h-4 w-4" />
                </span>
              </div>

              {/* Event card */}
              <Card 
                className={cn(
                  "flex-1 cursor-pointer transition-all duration-200 hover:shadow-glow hover:border-primary/30",
                  "bg-card border-slate-700"
                )}
                onClick={() => onEventClick?.(event)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-100 mb-1">
                        {event.title.replace(/_/g, ' ')}
                      </h4>
                      <p className="text-sm text-slate-400 mb-3">
                        {event.text}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          provenance
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-slate-200">
                        {event.start_date ? new Date(event.start_date).getFullYear() : 'Unknown'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {event.start_date ? new Date(event.start_date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        }) : ''}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}