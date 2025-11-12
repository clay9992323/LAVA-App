// API Type Definitions based on CausewayAppsAPI_Endpoints.JSON

// Request Types
export interface GetAudienceCountRequest {
  geoId: number;
  ageRangeIds?: string; // comma-separated ids
  genderIds?: string;
  partyIds?: string;
  ethnicityIds?: string;
  incomeIds?: string;
  educationIds?: string;
  generalVoteHistoryIds?: string;
  primaryVoteHistoryIds?: string;
  universeList?: string; // comma-separated names
}

export interface GeoCountViewRequest {
  typeCode: string; // required, non-empty
  geoCode?: string | null;
  subGeoCode?: string | null;
}

// Response Types
export interface AudienceCountResponse {
  count: number;
  geoId: number;
  ageRangeIds: string | null;
  genderIds: string | null;
  partyIds: string | null;
  ethnicityIds: string | null;
  incomeIds: string | null;
  educationIds: string | null;
  generalVoteHistoryIds: string | null;
  primaryVoteHistoryIds: string | null;
  universeList: string | null;
}

export interface Geo {
  id: number;
  geoTypeId: number;
  geoCode: string | null;
  subGeoCode: string | null;
  count: number;
}

export interface GeoCountView {
  geoId: number;
  typeCode: string | null;
  description: string | null;
  geoCode: string | null;
  subGeoCode: string | null;
  count: number;
}

export interface DemoValueCount {
  value: string | null;
  count: number;
}

export interface GeoInfo {
  id: number;
  geoTypeCode: string | null;
  geoCode: string | null;
  subGeoCode: string | null;
  count: number;
}

export interface GeoDemographicsResponse {
  geo: GeoInfo;
  demographics: { [key: string]: DemoValueCount[] } | null;
}

export interface GeoType {
  id: number;
  code: string | null;
  description: string | null;
  geoCodeColumnName: string | null;
  subGeoCodeColumnName: string | null;
}

export interface GeoTypeItem {
  typeCode: string | null;
  description: string | null;
  geoCode: string | null;
  subGeoCode: string | null;
}

export interface DimensionItem {
  id: number;
  name: string | null;
  description: string | null;
}

export interface DimUniverseItem {
  id: number;
  code: string | null;
  name: string | null;
  description: string | null;
}

// API Configuration
export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

// Geographic Type Codes
export enum GeoTypeCode {
  NATIONAL = 'NAT',
  STATE = 'ST',
  COUNTY = 'CTY',
  CONGRESSIONAL = 'CD',
  DMA = 'DMA',
  ZIPCODE = 'ZIP',
  STATE_SENATE = 'SSD',
  STATE_HOUSE = 'SHD'
}

// Dimension Types
export enum DimensionType {
  AGE_RANGE = 'agerange',
  GENDER = 'gender',
  PARTY = 'party',
  ETHNICITY = 'ethnicity',
  INCOME = 'income',
  EDUCATION = 'education',
  GENERAL_VOTE_HISTORY = 'generalvotehistory',
  PRIMARY_VOTE_HISTORY = 'primaryvotehistory'
}




