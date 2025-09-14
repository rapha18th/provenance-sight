import { useEffect, useState } from 'react';
import { Lead } from '@/lib/store';
import { useNavigate } from 'react-router-dom';
import { SearchHeader } from '@/components/SearchHeader';
import { LeadCard } from '@/components/LeadCard';
import { FilterPanel } from '@/components/FilterPanel';
import { useInvestigationStore } from '@/lib/store';
import { apiClient } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState<string>('');
  
  const {
    leads,
    filters,
    healthStats,
    isLoadingLeads,
    setLeads,
    setFilters,
    setHealthStats,
    setLoadingLeads,
  } = useInvestigationStore();

  // Load initial data
  useEffect(() => {
    loadHealthStats();
    loadLeads();
  }, []);

  // Reload leads when filters change
  useEffect(() => {
    loadLeads();
  }, [filters]);

  const loadHealthStats = async () => {
    try {
      const stats = await apiClient.getHealth();
      setHealthStats(stats);
    } catch (err) {
      console.error('Failed to load health stats:', err);
      // Continue without stats if API fails
    }
  };

  const loadLeads = async () => {
    setLoadingLeads(true);
    setError('');
    
    try {
      const leadsData = await apiClient.getLeads(filters);
      setLeads(leadsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load investigations');
    } finally {
      setLoadingLeads(false);
    }
  };

  const handleLeadClick = (lead: Lead) => {
    navigate(`/object/${lead.object_id}`);
  };

  const handleSearch = (query: string) => {
    navigate(`/discover?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <SearchHeader 
        onSearch={handleSearch}
        showStats={true}
        stats={healthStats || undefined}
      />

      <FilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        isOpen={showFilters}
        onToggle={() => setShowFilters(!showFilters)}
      />

      <main className="container mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-destructive">{error}</span>
          </div>
        )}

        {/* Investigation Board */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-100 mb-2">
                Active Investigations
              </h1>
              <p className="text-slate-400">
                {isLoadingLeads ? 'Loading...' : `${leads.length} suspicious objects requiring attention`}
              </p>
            </div>
          </div>

          {/* Leads Grid */}
          {isLoadingLeads ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="h-48 w-full bg-slate-800" />
                  <Skeleton className="h-4 w-3/4 bg-slate-800" />
                  <Skeleton className="h-4 w-1/2 bg-slate-800" />
                </div>
              ))}
            </div>
          ) : leads.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {leads.map((lead) => (
                <LeadCard
                  key={lead.object_id}
                  lead={lead}
                  onClick={() => handleLeadClick(lead)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-slate-200 mb-2">
                No suspicious objects found
              </h3>
              <p className="text-slate-400 mb-6">
                Try adjusting your filters or search for specific objects
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}