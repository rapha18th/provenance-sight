import { Lead } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Eye, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeRisk } from '@/lib/risk-utils';

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  const normalizedScore = normalizeRisk(lead.risk_score);

  const getRiskColor = (score: number) => {
    if (score >= 75) return 'risk-high';
    if (score >= 50) return 'risk-medium';
    return 'risk-low';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 75) return 'High Risk';
    if (score >= 50) return 'Medium Risk';
    return 'Low Risk';
  };

  // Parse comma-separated signals into array
  const signals = lead.top_signals ? lead.top_signals.split(',').map(s => s.trim()) : [];

  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-300 hover:shadow-glow hover:scale-[1.02]",
        "bg-card border-slate-700 hover:border-primary/30"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        {/* Header with risk indicator */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-100 group-hover:text-primary transition-colors line-clamp-2">
              {lead.title}
            </h3>
            {lead.creator && (
              <div className="flex items-center gap-1 mt-1 text-sm text-slate-400">
                <User className="h-3 w-3" />
                {lead.creator}
              </div>
            )}
            <div className="flex items-center gap-1 mt-1 text-sm text-slate-400">
              <span>ID: {lead.object_id}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className={cn(
              "h-3 w-3 rounded-full",
              normalizedScore >= 75 ? "bg-risk-high shadow-glow" :
              normalizedScore >= 50 ? "bg-risk-medium" : "bg-risk-low"
            )} />
            <span className="text-xs text-slate-400">
              {normalizedScore}
            </span>
          </div>
        </div>

        {/* Thumbnail placeholder */}
        <div className="w-full h-32 bg-slate-700 rounded-lg mb-4 flex items-center justify-center group-hover:bg-slate-600 transition-colors">
          <Eye className="h-8 w-8 text-slate-500" />
        </div>

        {/* Signals */}
        <div className="flex flex-wrap gap-2 mb-4">
          {signals.slice(0, 3).map((signal, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {signal.replace(/_/g, ' ')}
            </Badge>
          ))}
          {signals.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{signals.length - 3} more
            </Badge>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge 
              variant={normalizedScore >= 75 ? "destructive" : normalizedScore >= 50 ? "default" : "secondary"}
              className="gap-1"
            >
              <AlertTriangle className="h-3 w-3" />
              {getRiskLabel(normalizedScore)}
            </Badge>
          </div>
          
          <span className="text-xs text-slate-500">
            {lead.source}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}