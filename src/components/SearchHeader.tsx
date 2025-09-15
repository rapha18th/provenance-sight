import { useState } from 'react';
import { Search, FileSearch } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/provenance-radar-logo.png';
import { LeadFilters } from '@/lib/store';
import { Slider } from './ui/slider';

interface SearchHeaderProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  showStats?: boolean;
  stats?: {
    counts: {
      objects: number;
      risk_signals: number;
      sentences: number;
    };
  };
  filters: LeadFilters;
  onFiltersChange: (filters: LeadFilters) => void;
}

export function SearchHeader({
  onSearch,
  placeholder = "Search for suspicious objects...",
  showStats,
  stats,
  filters,
  onFiltersChange
}: SearchHeaderProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      if (onSearch) {
        onSearch(query);
      } else {
        navigate(`/discover?q=${encodeURIComponent(query)}`);
      }
    }
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  const handleMinScoreChange = (value: number[]) => {
    onFiltersChange({
      ...filters,
      min_score: value[0],
    });
  };

  return (
    <header className="border-b border-slate-700 bg-gradient-investigation">
      <div className="container mx-auto px-6 py-6">
        {/* Logo and title */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={handleLogoClick}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <img 
              src={logo} 
              alt="Provenance Radar" 
              className="h-12 w-auto"
            />
          </button>
          
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => navigate('/discover')}
            className="gap-2"
          >
            <FileSearch className="h-4 w-4" />
            Advanced Search
          </Button>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="relative mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-12 pr-4 py-3 text-lg bg-slate-800/50 border-slate-600 focus:border-primary focus:ring-primary/20 rounded-xl"
            />
          </div>
        </form>

        {/* Risk Score Threshold */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-200">
              Minimum Risk Score
            </label>
            <span className="text-sm text-slate-400">
              {Math.round((filters.min_score || 0) * 100)}%+
            </span>
          </div>
          <Slider
            value={[filters.min_score || 0]}
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

        {/* Stats */}
        {showStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="text-2xl font-bold text-slate-100">
                {stats?.counts?.objects?.toLocaleString() || '---'}
              </div>
              <div className="text-sm text-slate-400">Total Objects</div>
            </div>
            <div className="bg-gradient-warning rounded-xl p-4 border border-slate-700">
              <div className="text-2xl font-bold text-slate-100">
                {stats?.counts?.risk_signals?.toLocaleString() || '---'}
              </div>
              <div className="text-sm text-slate-300">Risk Signals</div>
            </div>
            <div className="bg-gradient-danger rounded-xl p-4 border border-slate-700">
              <div className="text-2xl font-bold text-slate-100">
                {stats?.counts?.sentences?.toLocaleString() || '---'}
              </div>
              <div className="text-sm text-slate-300">Evidence Sentences</div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}