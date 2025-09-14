import { useState } from 'react';
import { Search, FileSearch } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/provenance-radar-logo.png';

interface SearchHeaderProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  showStats?: boolean;
  stats?: {
    total_objects: number;
    flagged_objects: number;
    high_risk: number;
  };
}

export function SearchHeader({ onSearch, placeholder = "Search for suspicious objects...", showStats, stats }: SearchHeaderProps) {
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

        {/* Stats */}
        {showStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="text-2xl font-bold text-slate-100">
                {stats?.total_objects?.toLocaleString() || '---'}
              </div>
              <div className="text-sm text-slate-400">Total Objects</div>
            </div>
            <div className="bg-gradient-warning rounded-xl p-4 border border-slate-700">
              <div className="text-2xl font-bold text-slate-100">
                {stats?.flagged_objects?.toLocaleString() || '---'}
              </div>
              <div className="text-sm text-slate-300">Flagged Objects</div>
            </div>
            <div className="bg-gradient-danger rounded-xl p-4 border border-slate-700">
              <div className="text-2xl font-bold text-slate-100">
                {stats?.high_risk?.toLocaleString() || '---'}
              </div>
              <div className="text-sm text-slate-300">High Risk</div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}