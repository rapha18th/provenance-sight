import { create } from 'zustand';

// API Response Types - matching actual API structure  
export interface HealthResponse {
  ok: boolean;
  counts: {
    objects: number;
    sentences: number;
    risk_signals: number;
  };
}

export interface Lead {
  object_id: number;
  source: string;
  title: string;
  creator: string | null;
  risk_score: number;
  top_signals: string; // comma-separated string like "WARTIME_SALE,EXPORT_RESTRICTION"
}

export interface LeadsResponse {
  ok: boolean;
  data: Lead[];
}

export interface ObjectDetail {
  object_id: number;
  source: string;
  title: string;
  creator: string | null;
  date_display: string | null;
  risk_score: number;
  image_url: string | null;
}

export interface Sentence {
  seq: number;
  sentence: string;
}

export interface Event {
  event_type: string; // "ACQUISITION", "SALE", "EXHIBITION", etc.
  date_from: string | null; // ISO date "1933-01-15"
  date_to: string | null;
  place: string | null;
  actor: string | null; // person or organization name
  method: string | null;
  source_ref: string | null;
}

export interface Risk {
  code: string; // "NAZI_ERA", "EXPORT_RESTRICTION", etc.
  detail: string; // human readable explanation
  weight: number; // 0-1 score
}

export interface ObjectResponse {
  ok: boolean;
  object: ObjectDetail;
  sentences: Sentence[];
  events: Event[];
  risks: Risk[];
}

export interface GraphNode {
  id: string; // "obj:123", "actor:John Doe", "place:Paris"
  label: string; // display name
  type: 'object' | 'actor' | 'place';
}

export interface GraphEdge {
  source: string; // node id
  target: string; // node id
  label: string; // event_type like "SOLD_TO"
  date: string | null; // ISO date
  policy: string[]; // policy window codes: ["NAZI_ERA", "UNESCO_1970"]
  source_ref: string | null;
}

export interface GraphResponse {
  ok: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface TimelineItem {
  title: string; // event_type
  start_date: string | null; // ISO date
  end_date: string | null; // ISO date
  text: string; // provenance sentence
  source_ref: string | null;
}

export interface TimelineResponse {
  ok: boolean;
  items: TimelineItem[];
}

export interface SimilarResult {
  object_id: number;
  seq: number; // sentence sequence number
  sentence: string;
  source: string; // "AIC", etc.
  title: string;
  creator: string | null;
  distance: number; // 0-1, lower = more similar
}

export interface SimilarResponse {
  ok: boolean;
  data: SimilarResult[];
  meta: {
    limit: number;
    candidates: number;
    source?: string;
    note?: string; // "retried with smaller candidate set"
  };
}

export interface ExplainResponse {
  ok: boolean;
  note?: string; // for /api/explain/object/:id
  explanation?: string; // for /api/explain/text
  model?: string; // "gemini-2.0-flash"
}

// Filters interface
export interface LeadFilters {
  min_score?: number;
  search?: string;
  limit?: number;
}

// Legacy type aliases for backwards compatibility during transition
export type NetworkNode = GraphNode;
export type NetworkEdge = GraphEdge;
export type TimelineEvent = TimelineItem;

// D3 simulation augmented node interface
export interface NetworkNodeWithSimulation extends NetworkNode {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

// Store interface
interface InvestigationStore {
  // Dashboard state
  leads: Lead[];
  filters: LeadFilters;
  healthStats: HealthResponse | null;
  isLoadingLeads: boolean;
  
  // Case file state
  currentCase: ObjectResponse | null;
  graphData: GraphResponse | null;
  timelineData: TimelineResponse | null;
  isLoadingCase: boolean;
  
  // Search state
  searchResults: SimilarResult[];
  isSearching: boolean;
  
  // Actions
  setLeads: (leads: Lead[]) => void;
  setFilters: (filters: LeadFilters) => void;
  setHealthStats: (stats: HealthResponse) => void;
  setLoadingLeads: (loading: boolean) => void;
  
  setCurrentCase: (caseData: ObjectResponse) => void;
  setGraphData: (data: GraphResponse) => void;
  setTimelineData: (data: TimelineResponse) => void;
  setLoadingCase: (loading: boolean) => void;
  
  setSearchResults: (results: SimilarResult[]) => void;
  setSearching: (searching: boolean) => void;
}

export const useInvestigationStore = create<InvestigationStore>((set) => ({
  // Initial state
  leads: [],
  filters: { limit: 50, min_score: 0.3 },
  healthStats: null,
  isLoadingLeads: false,
  
  currentCase: null,
  graphData: null,
  timelineData: null,
  isLoadingCase: false,
  
  searchResults: [],
  isSearching: false,
  
  // Actions
  setLeads: (leads) => set({ leads }),
  setFilters: (filters) => set({ filters }),
  setHealthStats: (healthStats) => set({ healthStats }),
  setLoadingLeads: (isLoadingLeads) => set({ isLoadingLeads }),
  
  setCurrentCase: (currentCase) => set({ currentCase }),
  setGraphData: (graphData) => set({ graphData }),
  setTimelineData: (timelineData) => set({ timelineData }),
  setLoadingCase: (isLoadingCase) => set({ isLoadingCase }),
  
  setSearchResults: (searchResults) => set({ searchResults }),
  setSearching: (isSearching) => set({ isSearching }),
}));