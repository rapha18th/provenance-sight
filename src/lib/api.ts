import { Lead, CaseObject, NetworkNode, NetworkEdge, TimelineEvent, Evidence, HealthStats, LeadFilters } from './store';

class ApiClient {
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

      return await response.json();
    } catch (error) {
      console.error(`API Error for ${endpoint}:`, error);
      throw error;
    }
  }

  async getHealth(): Promise<HealthStats> {
    return this.request<HealthStats>('/api/health');
  }

  async getLeads(filters?: LeadFilters): Promise<Lead[]> {
    const params = new URLSearchParams();
    
    if (filters?.sources?.length) {
      params.append('sources', filters.sources.join(','));
    }
    if (filters?.risk_threshold !== undefined) {
      params.append('risk_threshold', filters.risk_threshold.toString());
    }
    if (filters?.search) {
      params.append('search', filters.search);
    }

    const endpoint = `/api/leads${params.toString() ? `?${params.toString()}` : ''}`;
    return this.request<Lead[]>(endpoint);
  }

  async getCaseObject(id: string): Promise<CaseObject> {
    return this.request<CaseObject>(`/api/object/${id}`);
  }

  async getCaseNetwork(id: string): Promise<{ nodes: NetworkNode[]; edges: NetworkEdge[] }> {
    return this.request<{ nodes: NetworkNode[]; edges: NetworkEdge[] }>(`/api/object/${id}/network`);
  }

  async getCaseTimeline(id: string): Promise<TimelineEvent[]> {
    return this.request<TimelineEvent[]>(`/api/object/${id}/timeline`);
  }

  async getCaseEvidence(id: string): Promise<Evidence[]> {
    return this.request<Evidence[]>(`/api/object/${id}/evidence`);
  }

  async getCaseFile(id: string): Promise<{
    object: CaseObject;
    network: { nodes: NetworkNode[]; edges: NetworkEdge[] };
    timeline: TimelineEvent[];
    evidence: Evidence[];
  }> {
    // Parallel fetch for efficiency
    const [object, network, timeline, evidence] = await Promise.all([
      this.getCaseObject(id),
      this.getCaseNetwork(id),
      this.getCaseTimeline(id),
      this.getCaseEvidence(id),
    ]);

    return { object, network, timeline, evidence };
  }

  async explainObject(id: string): Promise<{ explanation: string }> {
    return this.request<{ explanation: string }>(`/api/explain/object/${id}`, {
      method: 'POST',
    });
  }

  async explainText(text: string): Promise<{ explanation: string }> {
    return this.request<{ explanation: string }>('/api/explain/text', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async searchSimilar(query: string, sources?: string[]): Promise<Lead[]> {
    const body: any = { query };
    if (sources?.length) {
      body.sources = sources;
    }

    return this.request<Lead[]>('/api/search', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}

export const apiClient = new ApiClient();