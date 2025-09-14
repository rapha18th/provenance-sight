import { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LeadFilters } from '@/lib/store';
import { cn } from '@/lib/utils';

interface FilterPanelProps {
  filters: LeadFilters;
  onFiltersChange: (filters: LeadFilters) => void;
  isOpen: boolean;
  onToggle: () => void;
  availableSources?: string[];
}

const DEFAULT_SOURCES = [
  'AIC',
  'CMA',
  'MET',
  'MOMA',
  'LACMA',
  'NGA',
  'SFMOMA',
  'Getty'
];

export function FilterPanel({ 
  filters, 
  onFiltersChange, 
  isOpen, 
  onToggle, 
  availableSources = DEFAULT_SOURCES 
}: FilterPanelProps) {
  const [minScore, setMinScore] = useState([filters.min_score || 0.3]);
  const [selectedSource, setSelectedSource] = useState<string>(filters.source || '');

  const handleMinScoreChange = (value: number[]) => {
    setMinScore(value);
    onFiltersChange({
      ...filters,
      min_score: value[0],
    });
  };

  const handleSourceChange = (source: string) => {
    const newSource = selectedSource === source ? '' : source;
    setSelectedSource(newSource);
    onFiltersChange({
      ...filters,
      source: newSource || undefined,
    });
  };

  const clearFilters = () => {
    setMinScore([0.3]);
    setSelectedSource('');
    onFiltersChange({ limit: 50, min_score: 0.3 });
  };

  const hasActiveFilters = filters.min_score !== 0.3 || filters.source;

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className={cn(
          "fixed top-4 right-4 z-50 gap-2",
          hasActiveFilters && "border-primary text-primary"
        )}
      >
        <Filter className="h-4 w-4" />
        Filters
        {hasActiveFilters && (
          <span className="h-2 w-2 bg-primary rounded-full" />
        )}
      </Button>
    );
  }

  return (
    <Card className="fixed top-4 right-4 z-50 w-80 bg-card border-slate-700 shadow-modal">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Filters</CardTitle>
          <div className="flex gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onToggle}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Risk Score Threshold */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-200">
              Minimum Risk Score
            </label>
            <span className="text-sm text-slate-400">
              {Math.round(minScore[0] * 100)}%+
            </span>
          </div>
          <Slider
            value={minScore}
            onValueChange={handleMinScoreChange}
            max={1}
            min={0}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>Low Risk (0%)</span>
            <span>High Risk (100%)</span>
          </div>
        </div>

        {/* Sources */}
        <Collapsible defaultOpen className="space-y-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <span className="text-sm font-medium text-slate-200">
                Source ({selectedSource ? '1 selected' : 'All sources'})
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 max-h-60 overflow-y-auto">
            {availableSources.map((source) => (
              <div key={source} className="flex items-center space-x-2">
                <Checkbox
                  id={source}
                  checked={selectedSource === source}
                  onCheckedChange={() => handleSourceChange(source)}
                />
                <label
                  htmlFor={source}
                  className="text-sm text-slate-300 cursor-pointer flex-1"
                >
                  {source}
                </label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}