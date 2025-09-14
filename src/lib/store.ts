import { create } from 'zustand';

// Types for the investigation data
export interface Lead {
  id: string;
  title: string;
  creator?: string;
  date?: string;
  risk_score: number;
  flags: string[];
  thumbnail?: string;
  source: string;
}

export interface CaseObject {
  id: string;
  title: string;
  creator?: string;
  date?: string;
  risk_score: number;
  flags: string[];
  description?: string;
  thumbnail?: string;
  source: string;
}

export interface NetworkNode {
  id: string;
  label: string;
  type: 'object' | 'person' | 'place' | 'event';
  risk_level?: 'high' | 'medium' | 'low';
}

export interface NetworkEdge {
  source: string;
  target: string;
  relationship: string;
  period?: 'nazi' | 'unesco' | 'normal';
}

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  type: 'acquisition' | 'exhibition' | 'provenance' | 'research';
  risk_level?: 'high' | 'medium' | 'low';
}

export interface Evidence {
  id: string;
  text: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
  date?: string;
}

export interface HealthStats {
  total_objects: number;
  flagged_objects: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
}

// Filters interface
export interface LeadFilters {
  sources?: string[];
  risk_threshold?: number;
  search?: string;
}

// Store interface
interface InvestigationStore {
  // Dashboard state
  leads: Lead[];
  filters: LeadFilters;
  healthStats: HealthStats | null;
  isLoadingLeads: boolean;
  
  // Case file state
  currentCase: CaseObject | null;
  networkData: { nodes: NetworkNode[]; edges: NetworkEdge[] } | null;
  timeline: TimelineEvent[];
  evidence: Evidence[];
  isLoadingCase: boolean;
  
  // Search state
  searchResults: Lead[];
  isSearching: boolean;
  
  // Actions
  setLeads: (leads: Lead[]) => void;
  setFilters: (filters: LeadFilters) => void;
  setHealthStats: (stats: HealthStats) => void;
  setLoadingLeads: (loading: boolean) => void;
  
  setCurrentCase: (caseObj: CaseObject) => void;
  setNetworkData: (data: { nodes: NetworkNode[]; edges: NetworkEdge[] }) => void;
  setTimeline: (timeline: TimelineEvent[]) => void;
  setEvidence: (evidence: Evidence[]) => void;
  setLoadingCase: (loading: boolean) => void;
  
  setSearchResults: (results: Lead[]) => void;
  setSearching: (searching: boolean) => void;
}

export const useInvestigationStore = create<InvestigationStore>((set) => ({
  // Initial state
  leads: [],
  filters: {},
  healthStats: null,
  isLoadingLeads: false,
  
  currentCase: null,
  networkData: null,
  timeline: [],
  evidence: [],
  isLoadingCase: false,
  
  searchResults: [],
  isSearching: false,
  
  // Actions
  setLeads: (leads) => set({ leads }),
  setFilters: (filters) => set({ filters }),
  setHealthStats: (healthStats) => set({ healthStats }),
  setLoadingLeads: (isLoadingLeads) => set({ isLoadingLeads }),
  
  setCurrentCase: (currentCase) => set({ currentCase }),
  setNetworkData: (networkData) => set({ networkData }),
  setTimeline: (timeline) => set({ timeline }),
  setEvidence: (evidence) => set({ evidence }),
  setLoadingCase: (isLoadingCase) => set({ isLoadingCase }),
  
  setSearchResults: (searchResults) => set({ searchResults }),
  setSearching: (isSearching) => set({ isSearching }),
}));