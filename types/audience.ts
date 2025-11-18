// Core data interface based on Parquet data structure
export interface CombinedPersonData {
  // Demographics
  VoterCount?: number;
  AgeRange?: string;
  Gender?: string;
  Party?: string;
  Ethnicity?: string;
  Income?: string;
  Education?: string;
  
  // Geographic
  County?: string;
  DMA?: string;
  US_Congressional_District?: string;
  State_Senate_District?: string;
  State_House_District?: string;
  ZipCode?: string;
  
  // Voting History
  GeneralVoteHistory?: string;
  PrimaryVoteHistory?: string;
  
  // Universe/Behavioral Fields (boolean fields)
  cryptoowner?: string | null;
  viewerstreaming?: string | null;
  streamingappletvplus?: string | null;
  engagementvolunteer?: string | null;
  IsVeteran?: string | null;
  IsVeteranDonor?: string | null;
  VeteranSympathizer?: string | null;
  
  // Engagement Fields
  engagement_high?: string | null;
  engagement_low?: string | null;
  engagement_mid?: string | null;
  engagementcontact?: string | null;
  engagementcurrentevents?: string | null;
  engagementpetition?: string | null;
  engagementpolitically?: string | null;
  
  // Political Fields
  harddem?: string | null;
  hardgop?: string | null;
  leandem?: string | null;
  leangop?: string | null;
  swing?: string | null;
  partydemocrat?: string | null;
  partyrepublican?: string | null;
  
  // Turnout Fields
  turnouthigh?: string | null;
  turnoutlow?: string | null;
  turnoutmid?: string | null;
  
  // All other fields
  [key: string]: any;
}

// Filter and segmentation types
export type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in';

export type BooleanOperator = 'AND' | 'OR' | 'NOT';

export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: any;
  label: string;
}

export interface FilterGroup {
  id: string;
  operator: BooleanOperator;
  conditions: FilterCondition[];
  groups: FilterGroup[];
}

export interface AudienceSegment {
  id: string;
  name: string;
  description?: string;
  filters: FilterGroup;
  createdAt: Date;
  updatedAt: Date;
  personCount?: number;
}

// UI and visualization types
export interface DemographicsBreakdown {
  age: { [key: string]: number };
  gender: { [key: string]: number };
  ethnicity: { [key: string]: number };
  education: { [key: string]: number };
  income: { [key: string]: number };
  party: { [key: string]: number };
  region: { [key: string]: number };
}

export interface GeographicBreakdown {
  state: { [key: string]: number };
  county: { [key: string]: number };
  city: { [key: string]: number };
  zipCode: { [key: string]: number };
  dma: { [key: string]: number };
  congressional: { [key: string]: number };
  stateSenateDistrict: { [key: string]: number };
  stateHouseDistrict: { [key: string]: number };
}

export interface AudienceStats {
  totalCount: number;
  hasCellPhoneCount?: number;
  householdCount?: number;
  demographics: DemographicsBreakdown;
  geography: GeographicBreakdown;
  engagement?: {
    high?: number;
    medium?: number;
    low?: number;
    [key: string]: number | undefined;
  };
  generalVoteHistory?: {
    [key: string]: number;
  };
  political: {
    democrat: number;
    republican: number;
    independent: number;
    swing: number;
  };
  mediaConsumption?: {
    socialmediaheavyuser?: number;
    socialmediauserfacebook?: number;
    socialmediauserinstagram?: number;
    socialmediauserx?: number;
    socialmediauseryoutube?: number;
    [key: string]: number | undefined;
  };
  primaryVoteHistory?: {
    [key: string]: number;
  };
  universe: {
    [key: string]: number;
  };
}

// Available filter fields
export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'range' | 'boolean';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  category: 'demographics' | 'geography' | 'political' | 'engagement' | 'behavior' | 'universe' | 'mediaConsumption';
}

export const AVAILABLE_FILTER_FIELDS: FilterField[] = [
  // Universe Fields from Universe_Filters.csv
  // Note: allvotersnoharddem and allvotersnohardgop columns don't exist in database
  // { key: 'allvotersnoharddem', label: 'No Hard Dem', type: 'boolean', category: 'universe' },
  // { key: 'allvotersnohardgop', label: 'No Hard GOP', type: 'boolean', category: 'universe' },
  { key: 'engagement_high', label: 'Engagement High', type: 'boolean', category: 'universe' },
  { key: 'engagement_mid', label: 'Engagement Mid', type: 'boolean', category: 'universe' },
  { key: 'engagement_low', label: 'Engagement Low', type: 'boolean', category: 'universe' },
  { key: 'engagementcontact', label: 'Engagement Contact', type: 'boolean', category: 'universe' },
  { key: 'engagementcurrentevents', label: 'Engagement Current Events', type: 'boolean', category: 'universe' },
  { key: 'ideologyfiscalcons', label: 'Ideology Fiscal Conservative', type: 'boolean', category: 'universe' },
  { key: 'ideologyfiscalprog', label: 'Ideology Fiscal Progressive', type: 'boolean', category: 'universe' },
  { key: 'likelytogivepii', label: 'Likely Give PII', type: 'boolean', category: 'universe' },
  { key: 'likelyvotersdemocrat', label: 'Likely Democrat Voter', type: 'boolean', category: 'universe' },
  { key: 'likelyvotersrepublican', label: 'Likely Republican Voter', type: 'boolean', category: 'universe' },
  // { key: 'partydemocrat', label: 'Democrat', type: 'boolean', category: 'universe' }, // Column doesn't exist in database
  // { key: 'partyrepublican', label: 'Republican', type: 'boolean', category: 'universe' }, // Column doesn't exist in database
  { key: 'persuasion', label: 'Persuasion', type: 'boolean', category: 'universe' },
  { key: 'socialmediaheavyuser', label: 'Social Media Heavy User', type: 'boolean', category: 'universe' },
  { key: 'socialmediauserfacebook', label: 'Facebook User', type: 'boolean', category: 'universe' },
  { key: 'socialmediauserinstagram', label: 'Instagram User', type: 'boolean', category: 'universe' },
  { key: 'socialmediauserx', label: 'X User', type: 'boolean', category: 'universe' },
  { key: 'socialmediauseryoutube', label: 'Youtube User', type: 'boolean', category: 'universe' },
  { key: 'taxstadiumsupport', label: 'Support Stadium Tax', type: 'boolean', category: 'universe' },
  { key: 'turnouthigh', label: 'High Turnout', type: 'boolean', category: 'universe' },
];
