import { ArrowLeft, Shield, Search, Network, Clock, Sparkles, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/provenance-radar-logo.png';

export default function About() {
  const navigate = useNavigate();

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
            
            <div className="flex items-center gap-3">
              <img src={logo} alt="Provenance Radar" className="h-8 w-auto" />
              <div>
                <h1 className="text-2xl font-bold text-slate-100">About Provenance Radar</h1>
                <p className="text-slate-400">Museum Collection Investigation Tool</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Introduction */}
        <div className="mb-12">
          <Card className="bg-card border-slate-700">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-slate-100 mb-4">
                Uncovering Hidden Histories
              </h2>
              <p className="text-slate-300 leading-relaxed mb-4">
                Provenance Radar is a sophisticated investigation tool designed to help museums, 
                researchers, and cultural institutions identify objects with potentially problematic 
                ownership histories. By combining advanced data analysis with intuitive visualization, 
                we make complex provenance research accessible and actionable.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Our mission is to support the ethical stewardship of cultural heritage by providing 
                the tools needed to uncover, understand, and address historical injustices in 
                museum collections.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-slate-100 mb-6">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-card border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-slate-100">
                  <Shield className="h-5 w-5 text-primary" />
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300">
                  Advanced algorithms analyze multiple data sources to identify objects with 
                  suspicious ownership patterns, focusing on periods of historical concern.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-slate-100">
                  <Network className="h-5 w-5 text-primary" />
                  Relationship Mapping
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300">
                  Interactive network visualizations reveal connections between objects, people, 
                  places, and events, helping investigators understand complex provenance chains.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-slate-100">
                  <Clock className="h-5 w-5 text-primary" />
                  Timeline Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300">
                  Chronological visualization of ownership changes, acquisitions, and historical 
                  events provides crucial context for provenance research.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-slate-100">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI-Powered Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300">
                  Machine learning models analyze patterns across vast datasets to identify 
                  similar cases and provide intelligent explanations for complex findings.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-slate-100 mb-6">How It Works</h2>
          <Card className="bg-card border-slate-700">
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-100 mb-2">Data Aggregation</h3>
                    <p className="text-slate-300">
                      We continuously collect and process provenance data from major museums, 
                      archives, and cultural institutions worldwide.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-100 mb-2">Risk Analysis</h3>
                    <p className="text-slate-300">
                      Advanced algorithms analyze ownership patterns, historical context, and 
                      documentation gaps to calculate risk scores.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-100 mb-2">Investigation Tools</h3>
                    <p className="text-slate-300">
                      Researchers use our intuitive interface to explore flagged objects, 
                      analyze relationships, and generate detailed reports.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Sources */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-slate-100 mb-6">Data Sources</h2>
          <Card className="bg-card border-slate-700">
            <CardContent className="p-8">
              <p className="text-slate-300 mb-6">
                Provenance Radar integrates data from trusted cultural institutions and research organizations:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ul className="space-y-2 text-slate-300">
                  <li>• Getty Research Institute</li>
                  <li>• National Archives</li>
                  <li>• Smithsonian Institution</li>
                  <li>• Library of Congress</li>
                </ul>
                <ul className="space-y-2 text-slate-300">
                  <li>• Metropolitan Museum of Art</li>
                  <li>• British Museum</li>
                  <li>• Louvre</li>
                  <li>• Museum of Modern Art</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <Card className="bg-gradient-investigation border-slate-700">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-slate-100 mb-4">
                Ready to Start Investigating?
              </h2>
              <p className="text-slate-300 mb-6">
                Explore our database of flagged objects and discover the hidden stories 
                behind museum collections.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Button onClick={() => navigate('/')} className="gap-2">
                  <Search className="h-4 w-4" />
                  View Dashboard
                </Button>
                <Button variant="outline" onClick={() => navigate('/discover')} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Start Searching
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}