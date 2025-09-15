import { 
  Lead, 
  LeadFilters, 
  HealthResponse, 
  LeadsResponse, 
  ObjectResponse, 
  GraphResponse, 
  TimelineResponse, 
  SimilarResponse, 
  SimilarResult, 
  ExplainResponse 
} from './store';

class ProvenanceAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE || 'https://rairo-provenance-api.hf.space';
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Check if API returned an error response
      if (data.ok === false) {
        throw new Error(data.error || 'API returned error');
      }

      return data;
    } catch (error) {
      console.error(`API Error for ${endpoint}:`, error);
      throw error;
    }
  }

  // Health check
  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/api/health');
  }

  // Leads list with filters
  async getLeads(filters?: LeadFilters): Promise<Lead[]> {
    const params = new URLSearchParams();
    
    if (filters?.limit) {
      params.append('limit', filters.limit.toString());
    }
    if (filters?.min_score !== undefined) {
      params.append('min_score', filters.min_score.toString());
    }
    if (filters?.source) {
      params.append('source', filters.source);
    }

    const endpoint = `/api/leads${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.request<LeadsResponse>(endpoint);
    
    // Apply client-side text filtering if needed
    let leads = response.data;
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      leads = leads.filter(lead => 
        lead.title.toLowerCase().includes(searchLower) ||
        lead.creator?.toLowerCase().includes(searchLower)
      );
    }
    
    return leads;
  }

  // Object details
  async getObject(id: number): Promise<ObjectResponse> {
    return this.request<ObjectResponse>(`/api/object/${id}`);
  }

  // Graph data for visualization
  async getGraph(id: number): Promise<GraphResponse> {
    return this.request<GraphResponse>(`/api/graph/${id}`);
  }

  // Timeline data
  async getTimeline(id: number): Promise<TimelineResponse> {
    return this.request<TimelineResponse>(`/api/timeline/${id}`);
  }

  // Places for map
  async getPlaces(id: number): Promise<{
    ok: boolean;
    places: Array<{ 
      place: string; 
      date?: string | null; 
      lat?: number | null; 
      lon?: number | null 
    }>;
  }> {
    return this.request(`/api/places/${id}`);
  }

  // Policy windows
  async getPolicyWindows(): Promise<{
    ok: boolean;
    windows: Array<{ 
      code: string; 
      label: string; 
      from: string; 
      to?: string | null; 
      ref?: string 
    }>;
  }> {
    return this.request('/api/policy/windows');
  }

  // Load complete case file
  async getCaseFile(id: number): Promise<{
    object: ObjectResponse;
    graph: GraphResponse;
    timeline: TimelineResponse;
  }> {
    // Parallel fetch for efficiency
    const [object, graph, timeline] = await Promise.all([
      this.getObject(id),
      this.getGraph(id),
      this.getTimeline(id),
    ]);

    return { object, graph, timeline };
  }

  // Semantic search
  async findSimilar(params: {
    text: string;
    limit?: number;
    candidates?: number;
    source?: string;
  }): Promise<SimilarResult[]> {
    const response = await this.request<SimilarResponse>('/api/similar', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    
    return response.data;
  }

  // AI explanations
  async explainObject(id: number): Promise<ExplainResponse> {
    return this.request<ExplainResponse>(`/api/explain/object/${id}`);
  }

  async explainText(text: string): Promise<ExplainResponse> {
    return this.request<ExplainResponse>('/api/explain/text', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }
}

export const apiClient = new ProvenanceAPI();