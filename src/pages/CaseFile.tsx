import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, AlertTriangle, Calendar, Eye, Archive, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { NetworkGraph } from '@/components/NetworkGraph';
import { TimelineView } from '@/components/TimelineView';
import { ExplainModal } from '@/components/ExplainModal';
import { useInvestigationStore } from '@/lib/store';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function CaseFile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [explainText, setExplainText] = useState('');
  const [error, setError] = useState('');

  const {
    currentCase,
    networkData,
    timeline,
    evidence,
    isLoadingCase,
    setCurrentCase,
    setNetworkData,
    setTimeline,
    setEvidence,
    setLoadingCase,
  } = useInvestigationStore();

  useEffect(() => {
    if (id) {
      loadCaseFile(id);
    }
  }, [id]);

  const loadCaseFile = async (caseId: string) => {
    setLoadingCase(true);
    setError('');

    try {
      const caseData = await apiClient.getCaseFile(caseId);
      setCurrentCase(caseData.object);
      setNetworkData(caseData.network);
      setTimeline(caseData.timeline);
      setEvidence(caseData.evidence);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load case file');
    } finally {
      setLoadingCase(false);
    }
  };

  const handleExplainObject = () => {
    setExplainText('');
    setShowExplainModal(true);
  };

  const handleExplainEvidence = (text: string) => {
    setExplainText(text);
    setShowExplainModal(true);
  };

  const getRiskColor = (score: number) => {
    if (score >= 0.7) return 'text-risk-high';
    if (score >= 0.4) return 'text-risk-medium';
    return 'text-risk-low';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 0.7) return 'High Risk';
    if (score >= 0.4) return 'Medium Risk';
    return 'Low Risk';
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Case File Not Found</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <Button onClick={() => navigate('/')}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-slate-700 bg-gradient-investigation">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            
            {currentCase && (
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-slate-100">
                  Case File: {currentCase.title}
                </h1>
                <div className="flex items-center gap-4 mt-1">
                  {currentCase.creator && (
                    <span className="text-sm text-slate-400">by {currentCase.creator}</span>
                  )}
                  {currentCase.date && (
                    <span className="text-sm text-slate-400">{currentCase.date}</span>
                  )}
                  <Badge 
                    variant={currentCase.risk_score >= 0.7 ? "destructive" : currentCase.risk_score >= 0.4 ? "default" : "secondary"}
                    className="gap-1"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {getRiskLabel(currentCase.risk_score)}
                  </Badge>
                </div>
              </div>
            )}

            <Button onClick={handleExplainObject} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Get AI Explanation
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {isLoadingCase ? (
          <div className="space-y-6">
            <Skeleton className="h-32 w-full bg-slate-800" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Skeleton className="h-96 lg:col-span-2 bg-slate-800" />
              <Skeleton className="h-96 bg-slate-800" />
            </div>
          </div>
        ) : currentCase ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-8">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="network">Network</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <Card className="bg-card border-slate-700">
                <CardHeader>
                  <CardTitle className="text-slate-100">Case Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-slate-200 mb-2">Risk Assessment</h4>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-4 w-4 rounded-full",
                          currentCase.risk_score >= 0.7 ? "bg-risk-high" :
                          currentCase.risk_score >= 0.4 ? "bg-risk-medium" : "bg-risk-low"
                        )} />
                        <span className={cn("font-semibold", getRiskColor(currentCase.risk_score))}>
                          {Math.round(currentCase.risk_score * 100)}% Risk Score
                        </span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-200 mb-2">Source</h4>
                      <p className="text-slate-400">{currentCase.source}</p>
                    </div>
                  </div>
                  
                  {currentCase.description && (
                    <div>
                      <h4 className="font-semibold text-slate-200 mb-2">Description</h4>
                      <p className="text-slate-400">{currentCase.description}</p>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold text-slate-200 mb-2">Flags</h4>
                    <div className="flex flex-wrap gap-2">
                      {currentCase.flags.map((flag, index) => (
                        <Badge key={index} variant="outline">
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="network">
              <Card className="bg-card border-slate-700">
                <CardHeader>
                  <CardTitle className="text-slate-100">Relationship Network</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {networkData ? (
                    <NetworkGraph
                      nodes={networkData.nodes}
                      edges={networkData.edges}
                      height={600}
                    />
                  ) : (
                    <div className="h-96 flex items-center justify-center text-slate-400">
                      No network data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline">
              <Card className="bg-card border-slate-700">
                <CardHeader>
                  <CardTitle className="text-slate-100">Provenance Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <TimelineView events={timeline} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="evidence">
              <Card className="bg-card border-slate-700">
                <CardHeader>
                  <CardTitle className="text-slate-100">Evidence & Documentation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {evidence.length > 0 ? (
                    evidence.map((item) => (
                      <Card key={item.id} className="bg-slate-800/50 border-slate-600">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="text-slate-300 mb-2">{item.text}</p>
                              <div className="flex items-center gap-4">
                                <Badge 
                                  variant={
                                    item.confidence === 'high' ? 'destructive' :
                                    item.confidence === 'medium' ? 'default' : 'secondary'
                                  }
                                  className="text-xs"
                                >
                                  {item.confidence} confidence
                                </Badge>
                                <span className="text-xs text-slate-500">{item.source}</span>
                                {item.date && (
                                  <span className="text-xs text-slate-500">{item.date}</span>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExplainEvidence(item.text)}
                              className="gap-2"
                            >
                              <Sparkles className="h-3 w-3" />
                              Explain
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      No evidence documentation available
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : null}
      </main>

      <ExplainModal
        isOpen={showExplainModal}
        onClose={() => setShowExplainModal(false)}
        type={explainText ? 'text' : 'object'}
        objectId={explainText ? undefined : id}
        text={explainText || undefined}
        title={currentCase?.title}
      />
    </div>
  );
}