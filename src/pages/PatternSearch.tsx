import { useState, useEffect } from 'react';
import { SimilarResult } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { LeadCard } from '@/components/LeadCard';
import { useInvestigationStore } from '@/lib/store';
import { apiClient } from '@/lib/api';

const SAMPLE_QUERIES = [
  "Objects with unclear ownership during WWII",
  "Artworks acquired from private collectors in Germany 1933-1945",
  "Paintings with missing provenance records",
  "Items flagged by UNESCO restitution database",
  "Objects with suspicious dealer connections"
];

const DEFAULT_SOURCES = [
  'Getty Research Institute',
  'National Archives',
  'Smithsonian Institution',
  'Library of Congress',
  'Metropolitan Museum of Art',
  'British Museum',
  'Louvre',
  'Museum of Modern Art'
];

export default function PatternSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const {
    searchResults,
    isSearching,
    setSearchResults,
    setSearching,
  } = useInvestigationStore();

  // Search on initial load if query param exists
  useEffect(() => {
    const initialQuery = searchParams.get('q');
    if (initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, []);

  const performSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setHasSearched(true);

    try {
      const response = await apiClient.findSimilar({
        text: searchQuery,
        limit: 20,
        candidates: 200,
        source: selectedSources.length > 0 ? selectedSources[0] : undefined
      });
      setSearchResults(response);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const handleSampleQuery = (sampleQuery: string) => {
    setQuery(sampleQuery);
    performSearch(sampleQuery);
  };

  const handleLeadClick = (result: SimilarResult) => {
    navigate(`/object/${result.object_id}`);
  };

  const handleSourceToggle = (source: string) => {
    setSelectedSources(prev => 
      prev.includes(source) 
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-slate-700 bg-gradient-investigation">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Pattern Discovery</h1>
              <p className="text-slate-400">Find similar cases using AI-powered search</p>
            </div>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <Textarea
                placeholder="Describe the pattern you're looking for... (e.g., 'Objects acquired from German dealers between 1933-1945 with missing documentation')"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-h-[100px] pl-12 pr-4 py-3 text-lg bg-slate-800/50 border-slate-600 focus:border-primary focus:ring-primary/20 rounded-xl resize-none"
              />
              <Search className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
            </div>

            <div className="flex items-center justify-between">
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="gap-2 text-slate-400 hover:text-slate-200">
                    Advanced Options
                    <span className="text-xs">({selectedSources.length} sources)</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-sm text-slate-200">Filter by Sources</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {DEFAULT_SOURCES.map((source) => (
                        <div key={source} className="flex items-center space-x-2">
                          <Checkbox
                            id={source}
                            checked={selectedSources.includes(source)}
                            onCheckedChange={() => handleSourceToggle(source)}
                          />
                          <label
                            htmlFor={source}
                            className="text-sm text-slate-300 cursor-pointer"
                          >
                            {source}
                          </label>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>

              <Button type="submit" disabled={!query.trim() || isSearching} className="gap-2">
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isSearching ? 'Searching...' : 'Search Patterns'}
              </Button>
            </div>
          </form>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Sample Queries */}
        {!hasSearched && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-slate-100 mb-4">Try these example searches:</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {SAMPLE_QUERIES.map((sampleQuery, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="justify-start text-left h-auto p-4 border-slate-600 hover:border-primary/50"
                  onClick={() => handleSampleQuery(sampleQuery)}
                >
                  <div>
                    <div className="font-medium text-slate-200">{sampleQuery}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        {hasSearched && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-100">
                {isSearching ? 'Searching...' : `Found ${searchResults.length} similar cases`}
              </h2>
              {searchResults.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    setSearchResults([]);
                    setHasSearched(false);
                  }}
                >
                  Clear Results
                </Button>
              )}
            </div>

            {isSearching ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-48 bg-slate-800 rounded-lg mb-4" />
                    <div className="h-4 bg-slate-800 rounded mb-2" />
                    <div className="h-4 bg-slate-800 rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-4">
                {searchResults.map((result) => (
                  <Card
                    key={`${result.object_id}-${result.seq}`}
                    className="cursor-pointer transition-all duration-200 hover:shadow-glow hover:border-primary/30 bg-card border-slate-700"
                    onClick={() => handleLeadClick(result)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-100 mb-2">
                            {result.title}
                          </h3>
                          {result.creator && (
                            <p className="text-sm text-slate-400 mb-2">
                              by {result.creator}
                            </p>
                          )}
                          <p className="text-slate-300 mb-3">
                            "{result.sentence}"
                          </p>
                          <div className="flex items-center gap-4">
                            <Badge variant="outline" className="text-xs">
                              {result.source}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              Similarity: {Math.round((1 - result.distance) * 100)}%
                            </span>
                            <span className="text-xs text-slate-500">
                              ID: {result.object_id}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-slate-200 mb-2">
                  No matching patterns found
                </h3>
                <p className="text-slate-400 mb-6">
                  Try refining your search terms or adjusting the source filters
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery('');
                    setHasSearched(false);
                  }}
                >
                  Try New Search
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}