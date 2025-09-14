import { useEffect, useState, useCallback } from 'react';
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
import { useInvestigationStore, GraphResponse, ObjectResponse, NetworkNode, NetworkEdge } from '@/lib/store';
import { apiClient } from '@/lib/api';

const augmentGraphData = (graph: GraphResponse | null, caseFile: ObjectResponse | null): GraphResponse | null => {
  if (!graph || !caseFile || !caseFile.events) {
    return graph;
  }

  // Check if augmentation is needed (only one object node, no edges)
  if (graph.edges.length > 0 || graph.nodes.length > 1 || caseFile.events.length === 0) {
    return graph;
  }

  const newNodes: NetworkNode[] = [...graph.nodes];
  const newEdges: NetworkEdge[] = [...graph.edges];
  const nodeIds = new Set(newNodes.map(n => n.id));

  const objectNode = newNodes.find(n => n.type === 'object');
  if (!objectNode) return graph;

  caseFile.events.forEach((event, index) => {
    const actorId = event.actor ? `actor:${event.actor}` : null;
    const placeId = event.place ? `place:${event.place}` : null;

    if (actorId && !nodeIds.has(actorId)) {
      newNodes.push({ id: actorId, label: event.actor!, type: 'actor' });
      nodeIds.add(actorId);
    }

    if (placeId && !nodeIds.has(placeId)) {
      newNodes.push({ id: placeId, label: event.place!, type: 'place' });
      nodeIds.add(placeId);
    }

    if (actorId) {
      newEdges.push({
        id: `edge:${objectNode.id}-${actorId}-${index}`,
        source: objectNode.id,
        target: actorId,
        label: event.event_type,
        date: event.date_from,
        policy: [],
        source_ref: event.source_ref
      });
    }

    if (placeId) {
       newEdges.push({
        id: `edge:${objectNode.id}-${placeId}-event-${index}`,
        source: objectNode.id,
        target: placeId,
        label: event.event_type,
        date: event.date_from,
        policy: [],
        source_ref: event.source_ref
      });
    }

    // Connect actor to place if both exist
    if (actorId && placeId) {
      newEdges.push({
        id: `edge:${actorId}-${placeId}-${index}`,
        source: actorId,
        target: placeId,
        label: 'occurred in',
        date: event.date_from,
        policy: [],
        source_ref: event.source_ref
      });
    }
  });

  return { ok: true, nodes: newNodes, edges: newEdges };
};
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
    graphData,
    timelineData,
    isLoadingCase,
    setCurrentCase,
    setGraphData,
    setTimelineData,
    setLoadingCase,
  } = useInvestigationStore();

  const loadCaseFile = useCallback(async (caseId: string) => {
    setLoadingCase(true);
    setError('');

    try {
      const id = parseInt(caseId);
      const caseData = await apiClient.getCaseFile(id);
      setCurrentCase(caseData);

      const augmentedGraph = augmentGraphData(caseData.graph, caseData);
      setGraphData(augmentedGraph);

      setTimelineData(caseData.timeline);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load case file');
    } finally {
      setLoadingCase(false);
    }
  }, [setLoadingCase, setError, setCurrentCase, setGraphData, setTimelineData]);

  useEffect(() => {
    if (id) {
      loadCaseFile(id);
    }
  }, [id, loadCaseFile]);

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
                  Case File: {currentCase.object.title}
                </h1>
                <div className="flex items-center gap-4 mt-1">
                  {currentCase.object.creator && (
                    <span className="text-sm text-slate-400">by {currentCase.object.creator}</span>
                  )}
                  {currentCase.object.date_display && (
                    <span className="text-sm text-slate-400">{currentCase.object.date_display}</span>
                  )}
                  <Badge 
                    variant={currentCase.object.risk_score >= 0.7 ? "destructive" : currentCase.object.risk_score >= 0.3 ? "default" : "secondary"}
                    className="gap-1"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {getRiskLabel(currentCase.object.risk_score)}
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
                          currentCase.object.risk_score >= 0.7 ? "bg-risk-high" :
                          currentCase.object.risk_score >= 0.3 ? "bg-risk-medium" : "bg-risk-low"
                        )} />
                        <span className={cn("font-semibold", getRiskColor(currentCase.object.risk_score))}>
                          {Math.round(currentCase.object.risk_score * 100)}% Risk Score
                        </span>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-200 mb-2">Source</h4>
                      <p className="text-slate-400">{currentCase.object.source}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-200 mb-2">Risk Factors</h4>
                    <div className="flex flex-wrap gap-2">
                      {currentCase.risks.map((risk, index) => (
                        <Badge key={index} variant="outline">
                          {risk.code.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-200 mb-2">Provenance Events</h4>
                    <div className="space-y-2">
                      {currentCase.events.slice(0, 3).map((event, index) => (
                        <div key={index} className="p-3 bg-slate-800/50 rounded-lg">
                          <div className="font-medium text-slate-200">{event.event_type}</div>
                          <div className="text-sm text-slate-400">
                            {event.actor && <span>{event.actor}</span>}
                            {event.place && <span> • {event.place}</span>}
                            {event.date_from && <span> • {event.date_from}</span>}
                          </div>
                        </div>
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
                  {graphData ? (
                    <NetworkGraph
                      nodes={graphData.nodes}
                      edges={graphData.edges}
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
                  {timelineData ? (
                    <TimelineView events={timelineData.items} />
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      No timeline data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="evidence">
              <Card className="bg-card border-slate-700">
                <CardHeader>
                  <CardTitle className="text-slate-100">Evidence & Documentation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentCase && currentCase.sentences.length > 0 ? (
                    currentCase.sentences.map((sentence) => (
                      <Card key={sentence.seq} className="bg-slate-800/50 border-slate-600">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="text-slate-300 mb-2">{sentence.sentence}</p>
                              <div className="flex items-center gap-4">
                                <span className="text-xs text-slate-500">Sentence #{sentence.seq}</span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExplainEvidence(sentence.sentence)}
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
        objectId={explainText ? undefined : parseInt(id || '0')}
        text={explainText || undefined}
        title={currentCase?.object.title}
      />
    </div>
  );
}