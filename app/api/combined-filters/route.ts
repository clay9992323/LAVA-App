// Combined filters API route - handles geographic, demographic, and universe filtering
import { NextRequest, NextResponse } from 'next/server';
import { apiService } from '@/lib/apiService';
import { compressResponse } from '@/lib/responseOptimizer';
import { buildUniverseList } from '@/lib/dataTransformers';
import {
  GeographyCounts,
  extractCountFromObject,
  extractGeographyFromAudienceResponse,
  finalizeGeography,
  limitGeographyEntries,
  mergeGeographyMaps,
  pickGeographyLevels
} from '@/lib/geographyBreakdown';
import {
  convertDemographicFiltersToDimensionIds,
  DemographicIdFilters,
  getCachedDimensions
} from '@/lib/dimensionsCache';
import type { AudienceCountResponse } from '@/types/api';

type GeographicFilters = { [key: string]: string[] };

class RequestGeoCache {
  private cache: Map<string, any[]> = new Map();
  
  private getCacheKey(request: { typeCode: string; geoCode: string; subGeoCode: string }): string {
    return `${request.typeCode}|${request.geoCode}|${request.subGeoCode}`;
  }
  
  async getGeographicView(request: { typeCode: string; geoCode: string; subGeoCode: string }): Promise<any[]> {
    const key = this.getCacheKey(request);
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    const data = await apiService.getGeographicView(request);
    this.cache.set(key, data);
    return data;
  }
  
  clear(): void {
    this.cache.clear();
  }
}

const NESTED_COUNT_CONTAINERS = ['result', 'Result', 'data', 'Data', 'payload', 'Payload', 'response', 'Response', 'body', 'Body'];

function resolvePersonCountValue(source: any, allowFallback = true): number | null {
  if (source === null || source === undefined) {
    return null;
  }

  const preferred = extractCountFromObject(source, false);
  if (preferred !== null) {
    return preferred;
  }

  if (typeof source === 'object') {
    for (const key of NESTED_COUNT_CONTAINERS) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const nested = resolvePersonCountValue((source as Record<string, any>)[key], allowFallback);
        if (nested !== null) {
          return nested;
        }
      }
    }
  }

  if (allowFallback) {
    const fallback = extractCountFromObject(source, true);
    if (fallback !== null) {
      return fallback;
    }
    if (typeof source === 'object') {
      for (const key of Object.keys(source)) {
        if (NESTED_COUNT_CONTAINERS.includes(key)) continue;
        const nested = resolvePersonCountValue((source as Record<string, any>)[key], false);
        if (nested !== null) {
          return nested;
        }
      }
    }
  }

  return null;
}

function getPersonCountValue(response?: AudienceCountResponse | Record<string, any> | null): number {
  const value = resolvePersonCountValue(response);
  return value !== null ? value : 0;
}

function getCellPhoneCount(response?: AudienceCountResponse | Record<string, any> | null): number {
  if (!response || typeof response !== 'object') return 0;
  
  // Try multiple possible field name variations
  const possibleKeys = ['hasCellPhoneCount', 'HasCellPhoneCount', 'hasCellPhone', 'HasCellPhone'];
  
  // Check primaryGeo.hasCellPhoneCount first (most common location)
  if (response.primaryGeo && typeof response.primaryGeo === 'object') {
    for (const key of possibleKeys) {
      if (key in response.primaryGeo) {
        const count = (response.primaryGeo as any)[key];
        if (count !== null && count !== undefined) {
          const num = typeof count === 'string' ? parseInt(count.replace(/,/g, ''), 10) : Number(count);
          if (Number.isFinite(num) && num > 0) return num;
        }
      }
    }
  }
  
  // Fallback: check top-level
  for (const key of possibleKeys) {
    if (key in response) {
      const count = (response as any)[key];
      if (count !== null && count !== undefined) {
        const num = typeof count === 'string' ? parseInt(count.replace(/,/g, ''), 10) : Number(count);
        if (Number.isFinite(num) && num > 0) return num;
      }
    }
  }
  
  return 0;
}

function getHouseholdCount(response?: AudienceCountResponse | Record<string, any> | null): number {
  if (!response || typeof response !== 'object') return 0;
  
  // Try multiple possible field name variations
  const possibleKeys = ['householdCount', 'HouseholdCount', 'household', 'Household'];
  
  // Check primaryGeo.householdCount first (most common location)
  if (response.primaryGeo && typeof response.primaryGeo === 'object') {
    for (const key of possibleKeys) {
      if (key in response.primaryGeo) {
        const count = (response.primaryGeo as any)[key];
        if (count !== null && count !== undefined) {
          const num = typeof count === 'string' ? parseInt(count.replace(/,/g, ''), 10) : Number(count);
          if (Number.isFinite(num) && num > 0) return num;
        }
      }
    }
  }
  
  // Fallback: check top-level
  for (const key of possibleKeys) {
    if (key in response) {
      const count = (response as any)[key];
      if (count !== null && count !== undefined) {
        const num = typeof count === 'string' ? parseInt(count.replace(/,/g, ''), 10) : Number(count);
        if (Number.isFinite(num) && num > 0) return num;
      }
    }
  }
  
  return 0;
}

export async function POST(request: NextRequest) {
  const geoCache = new RequestGeoCache();

  try {
    const body = await request.json();
    const {
      universeFields = [],
      geographicFilters = {},
      demographicFilters = {},
      operator = 'AND',
      requestedLevels = []
    } = body;

    if (!Array.isArray(universeFields)) {
      return NextResponse.json({ error: 'universeFields must be an array' }, { status: 400 });
    }

    if (!geographicFilters || typeof geographicFilters !== 'object') {
      return NextResponse.json({ error: 'geographicFilters must be an object' }, { status: 400 });
    }

    let levelsToFetch: string[] =
      requestedLevels && requestedLevels.length > 0 ? [...requestedLevels] : ['state', 'county', 'dma'];

    if (geographicFilters.congressional?.length && !levelsToFetch.includes('congressional')) {
      levelsToFetch.push('congressional');
    }
    if (geographicFilters.stateSenateDistrict?.length && !levelsToFetch.includes('stateSenateDistrict')) {
      levelsToFetch.push('stateSenateDistrict');
    }
    if (geographicFilters.stateHouseDistrict?.length && !levelsToFetch.includes('stateHouseDistrict')) {
      levelsToFetch.push('stateHouseDistrict');
    }

    const breakdowns = await getAudienceBreakdownsFromApi(
      universeFields,
      geographicFilters,
      demographicFilters,
      levelsToFetch,
      geoCache
    );

    const responsePayload = {
      success: true,
      combinedCounts: breakdowns.counts,
      filteredBreakdowns: {
        demographics: breakdowns.demographics,
        engagement: breakdowns.engagement,
        political: breakdowns.political,
        mediaConsumption: breakdowns.mediaConsumption,
        geography: breakdowns.geography
      },
      operator,
      timestamp: new Date().toISOString()
    };

    return compressResponse(responsePayload);
  } catch (error) {
    console.error('Combined filters API error:', error);
    return NextResponse.json(
      {
      success: false,
      error: `Failed to get combined counts: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  } finally {
    geoCache.clear();
  }
}

async function getAudienceBreakdownsFromApi(
  universeFields: string[],
  geographicFilters: GeographicFilters,
  demographicFilters: { [key: string]: string[] },
  requestedLevels: string[],
  geoCache: RequestGeoCache
): Promise<{
  counts: { [key: string]: number };
  geography: GeographyCounts;
  demographics: any;
  engagement: any;
  generalVoteHistory: { [key: string]: number };
  political: any;
  mediaConsumption: any;
  primaryVoteHistory: { [key: string]: number };
}> {
  const counts: { [key: string]: number } = {};
    const demographicIds = await convertDemographicFiltersToDimensionIds(demographicFilters);
  const geoIds = await resolveGeoIdsForSelection(geographicFilters, geoCache);

  if (geoIds.length === 0) {
    throw new Error('Unable to resolve geoIds for selection');
  }

    const universeList = buildUniverseList(universeFields);
  let aggregatedGeography: GeographyCounts = {};

  const audienceResponses = await Promise.all(
    geoIds.map(async geoId => {
        const response = await apiService.getAudienceCount({
          geoId,
          ageRangeIds: demographicIds.ageRangeIds,
          genderIds: demographicIds.genderIds,
          partyIds: demographicIds.partyIds,
          ethnicityIds: demographicIds.ethnicityIds,
          incomeIds: demographicIds.incomeIds,
          educationIds: demographicIds.educationIds,
          generalVoteHistoryIds: '',
          primaryVoteHistoryIds: '',
          universeList: universeList || undefined
        });
      aggregatedGeography = mergeGeographyMaps(
        aggregatedGeography,
        extractGeographyFromAudienceResponse(response)
      );
      return response;
    })
  );

  counts.total = audienceResponses.reduce((sum, response) => sum + getPersonCountValue(response), 0);
  
  // Extract and sum cell phone and household counts
  const cellPhoneCounts = audienceResponses.map((response) => {
    return getCellPhoneCount(response);
  });
  counts.hasCellPhoneCount = cellPhoneCounts.reduce((sum, count) => sum + count, 0);
  
  const householdCounts = audienceResponses.map((response) => {
    return getHouseholdCount(response);
  });
  counts.householdCount = householdCounts.reduce((sum, count) => sum + count, 0);
  
  // Only log in development mode
  if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DETAILED_API_LOGGING === 'true') {
    console.log('📊 Final counts:', {
      total: counts.total,
      hasCellPhoneCount: counts.hasCellPhoneCount,
      householdCount: counts.householdCount
    });
  }

  // Only make separate API calls for individual universe fields if:
  // 1. There are multiple universe fields (need individual counts for OR logic)
  // 2. OR there are no universe fields in the main call but we need individual counts
  // If there's only one universe field, reuse the total count to avoid duplicate API calls
  if (universeFields.length === 1 && universeList) {
    // Single universe field: reuse the total count from the main API call
    counts[universeFields[0]] = counts.total;
  } else if (universeFields.length > 0) {
    // Multiple universe fields: need individual counts for each field
    const universeFieldCounts = await getUniverseFieldCounts(universeFields, geoIds, demographicIds);
    Object.assign(counts, universeFieldCounts);
  }

  const pickedGeography = pickGeographyLevels(aggregatedGeography, requestedLevels);
  const finalizedGeography = limitGeographyEntries(
    finalizeGeography(pickedGeography, requestedLevels),
    5
  );

  const demographics = extractDemographicBreakdownsFromResponses(audienceResponses);

  // Extract political affiliation from party data
  const political = extractPoliticalAffiliationFromPartyData(demographics.party);

  // Extract general vote history
  const generalVoteHistory = extractGeneralVoteHistoryFromResponses(audienceResponses);

  // Extract primary vote history
  const primaryVoteHistory = extractPrimaryVoteHistoryFromResponses(audienceResponses);

  return {
    counts,
    geography: finalizedGeography,
    demographics,
    engagement: generalVoteHistory, // Using engagement key for backward compatibility
    generalVoteHistory, // Also include under new key
    political,
    mediaConsumption: primaryVoteHistory, // Using mediaConsumption key for backward compatibility
    primaryVoteHistory // Also include under new key
  };
}

async function getUniverseFieldCounts(
  universeFields: string[],
  geoIds: number[],
  demographicIds: DemographicIdFilters
): Promise<{ [key: string]: number }> {
  if (!universeFields || universeFields.length === 0) {
    return {};
  }

  const counts: { [key: string]: number } = {};

  await Promise.all(
    universeFields.map(async field => {
      const mappedField = buildUniverseList([field]);
      const responses = await Promise.all(
        geoIds.map(geoId =>
          apiService.getAudienceCount({
        geoId,
            ageRangeIds: demographicIds.ageRangeIds,
            genderIds: demographicIds.genderIds,
            partyIds: demographicIds.partyIds,
            ethnicityIds: demographicIds.ethnicityIds,
            incomeIds: demographicIds.incomeIds,
            educationIds: demographicIds.educationIds,
        generalVoteHistoryIds: '',
        primaryVoteHistoryIds: '',
            universeList: mappedField || undefined
          })
        )
      );
      counts[field] = responses.reduce((sum, response) => sum + getPersonCountValue(response), 0);
    })
  );

  return counts;
}

async function resolveGeoIdsForSelection(
  geographicFilters: GeographicFilters,
  geoCache: RequestGeoCache
): Promise<number[]> {
    const states = geographicFilters.state || [];
    const counties = geographicFilters.county || [];
    const dmas = geographicFilters.dma || [];
    const congressional = geographicFilters.congressional || [];
    const stateSenateDistricts = geographicFilters.stateSenateDistrict || [];
    const stateHouseDistricts = geographicFilters.stateHouseDistrict || [];

  const unique = (values: number[]) => Array.from(new Set(values));
      
      if (counties.length > 0 && states.length > 0) {
        const countyView = await geoCache.getGeographicView({
          typeCode: 'CTY',
          geoCode: states[0],
          subGeoCode: ''
        });
    const selected = countyView.filter(
      c => counties.includes(c.subGeoCode || '') || counties.includes(c.geoCode || '')
    );
    return unique(selected.map(c => c.geoId));
  }

  if (congressional.length > 0) {
        const cdView = await geoCache.getGeographicView({
          typeCode: 'CD',
          geoCode: states.length > 0 ? states[0] : '',
          subGeoCode: ''
        });
    const selected = cdView.filter(
      d => congressional.includes(d.subGeoCode || '') || congressional.includes(d.geoCode || '')
    );
    return unique(selected.map(d => d.geoId));
  }

  if (stateSenateDistricts.length > 0) {
        const ssdView = await geoCache.getGeographicView({
          typeCode: 'SSD',
          geoCode: states.length > 0 ? states[0] : '',
          subGeoCode: ''
        });
    const selected = ssdView.filter(
      d =>
        stateSenateDistricts.includes(d.subGeoCode || '') ||
        stateSenateDistricts.includes(d.geoCode || '')
    );
    return unique(selected.map(d => d.geoId));
  }

  if (stateHouseDistricts.length > 0) {
        const shdView = await geoCache.getGeographicView({
          typeCode: 'SHD',
          geoCode: states.length > 0 ? states[0] : '',
          subGeoCode: ''
        });
    const selected = shdView.filter(
      d =>
        stateHouseDistricts.includes(d.subGeoCode || '') ||
        stateHouseDistricts.includes(d.geoCode || '')
    );
    return unique(selected.map(d => d.geoId));
  }

  if (dmas.length > 0) {
        const dmaView = await geoCache.getGeographicView({
          typeCode: 'STDMA',
          geoCode: states.length > 0 ? states[0] : '',
          subGeoCode: ''
        });
    const selected = dmaView.filter(
      d => dmas.includes(d.subGeoCode || '') || dmas.includes(d.geoCode || '')
    );
    return unique(selected.map(d => d.geoId));
  }

  if (states.length > 0) {
    const stateViews = await Promise.all(
      states.map(state =>
        geoCache.getGeographicView({
          typeCode: 'ST',
          geoCode: state,
          subGeoCode: ''
        })
      )
    );
    return unique(stateViews.filter(view => view.length > 0).map(view => view[0].geoId));
  }

        const natView = await geoCache.getGeographicView({
          typeCode: 'NAT',
          geoCode: '',
          subGeoCode: ''
        });
        if (Array.isArray(natView) && natView.length > 0) {
    return [natView[0].geoId];
  }
  return [];
}

/**
 * Extract and merge demographic breakdowns from API responses
 * Transforms array format (demographicBreakdowns.ageRanges[]) into object format ({ "18 - 24": 18503, ... })
 * Sums counts across multiple responses if there are multiple geoIds
 */
function extractDemographicBreakdownsFromResponses(
  responses: AudienceCountResponse[]
): {
  gender: { [key: string]: number };
  age: { [key: string]: number };
  ethnicity: { [key: string]: number };
  education: { [key: string]: number };
  income: { [key: string]: number };
  party: { [key: string]: number };
} {
  const demographics = {
    gender: {} as { [key: string]: number },
    age: {} as { [key: string]: number },
    ethnicity: {} as { [key: string]: number },
    education: {} as { [key: string]: number },
    income: {} as { [key: string]: number },
    party: {} as { [key: string]: number }
  };

  // Helper function to check if a demographic name should be excluded (Unknown/Other-Unknown)
  const shouldExcludeName = (name: string, includeUnknown: boolean): boolean => {
    if (includeUnknown) return false; // Keep all names for ethnicity
    const trimmed = name.trim().toLowerCase();
    return trimmed === 'unknown' || trimmed === 'other/unknown' || trimmed === 'other-unknown';
  };

  // Helper function to convert array of { name, personCount } to object { [name]: count }
  const arrayToObject = (
    arr: Array<{ name: string; personCount: number | string }> | undefined,
    includeUnknown: boolean = false
  ): { [key: string]: number } => {
    if (!Array.isArray(arr)) return {};
    const result: { [key: string]: number } = {};
    const len = arr.length;
    
    for (let i = 0; i < len; i++) {
      const item = arr[i];
      if (!item.name) continue;
      
      const name = item.name.trim();
      // Skip Unknown/Other-Unknown entries unless includeUnknown is true
      if (shouldExcludeName(name, includeUnknown)) {
        continue;
      }
      
      // Handle both number and string personCount values
      const count = typeof item.personCount === 'number' 
        ? item.personCount 
        : typeof item.personCount === 'string' 
          ? parseInt(item.personCount.replace(/,/g, ''), 10) || 0
          : 0;
      
      if (count > 0 || item.personCount === 0) {
        result[name] = (result[name] || 0) + count;
      }
    }
    return result;
  };

  // Helper function to merge two demographic objects (optimized with direct property access)
  const mergeDemographicObjects = (
    target: { [key: string]: number },
    source: { [key: string]: number }
  ) => {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = (target[key] || 0) + source[key];
      }
    }
  };

  // Process each response and merge demographics
  responses.forEach((response: any) => {
    const demographicBreakdowns = response.demographicBreakdowns;
    if (!demographicBreakdowns || typeof demographicBreakdowns !== 'object') {
      return;
    }

    // Extract and merge age ranges (exclude Unknown/Other-Unknown)
    if (demographicBreakdowns.ageRanges) {
      const ageRanges = arrayToObject(demographicBreakdowns.ageRanges, false);
      mergeDemographicObjects(demographics.age, ageRanges);
    }

    // Extract and merge genders (exclude Unknown/Other-Unknown)
    if (demographicBreakdowns.genders) {
      const genders = arrayToObject(demographicBreakdowns.genders, false);
      mergeDemographicObjects(demographics.gender, genders);
    }

    // Extract and merge parties (exclude Unknown/Other-Unknown)
    if (demographicBreakdowns.parties) {
      const parties = arrayToObject(demographicBreakdowns.parties, false);
      mergeDemographicObjects(demographics.party, parties);
    }

    // Extract and merge ethnicities (include Unknown/Other-Unknown)
    if (demographicBreakdowns.ethnicities) {
      const ethnicities = arrayToObject(demographicBreakdowns.ethnicities, true);
      mergeDemographicObjects(demographics.ethnicity, ethnicities);
    }

    // Extract and merge educations (exclude Unknown/Other-Unknown)
    if (demographicBreakdowns.educations) {
      const educations = arrayToObject(demographicBreakdowns.educations, false);
      mergeDemographicObjects(demographics.education, educations);
    }

    // Extract and merge incomes (exclude Unknown/Other-Unknown)
    if (demographicBreakdowns.incomes) {
      const incomes = arrayToObject(demographicBreakdowns.incomes, false);
      mergeDemographicObjects(demographics.income, incomes);
    }
  });

  // Only log in detailed logging mode
  if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DETAILED_API_LOGGING === 'true') {
    console.log('📊 Extracted demographic breakdowns:', {
      ageCounts: Object.keys(demographics.age).length,
      genderCounts: Object.keys(demographics.gender).length,
      partyCounts: Object.keys(demographics.party).length,
      ethnicityCounts: Object.keys(demographics.ethnicity).length,
      educationCounts: Object.keys(demographics.education).length,
      incomeCounts: Object.keys(demographics.income).length
    });
  }

  return demographics;
}

/**
 * Extract political affiliation counts from party data
 * Maps party names to political categories: democrat, republican, independent
 */
function extractPoliticalAffiliationFromPartyData(
  partyData: { [key: string]: number }
): {
  democrat: number;
  republican: number;
  independent: number;
} {
  const political = {
    democrat: 0,
    republican: 0,
    independent: 0
  };

  // Map party names to political categories (optimized with for...in loop)
  for (const partyName in partyData) {
    if (!Object.prototype.hasOwnProperty.call(partyData, partyName)) continue;
    
    const count = partyData[partyName];
    const name = partyName.trim().toLowerCase();
    
    // Map party names to political categories
    if (name === 'democrat' || name === 'democratic') {
      political.democrat += count;
    } else if (name === 'republican') {
      political.republican += count;
    } else if (
      name === 'independent' || 
      name === 'independent/other' ||
      name === 'other/unaffiliated' ||
      name === 'other-unknown' ||
      name === 'other'
    ) {
      political.independent += count;
    }
    // Skip entries that don't match known party names
  }

  // Only log in detailed logging mode
  if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DETAILED_API_LOGGING === 'true') {
    console.log('🗳️ Extracted political affiliation:', {
      democrat: political.democrat,
      republican: political.republican,
      independent: political.independent,
      partyEntries: Object.keys(partyData).length
    });
  }

  return political;
}

/**
 * Extract general vote history from API responses
 * Transforms array format (demographicBreakdowns.generalVoteHistories[]) into object format ({ "0 of 4": 62802, ... })
 * Sums counts across multiple responses if there are multiple geoIds
 */
function extractGeneralVoteHistoryFromResponses(
  responses: AudienceCountResponse[]
): { [key: string]: number } {
  const voteHistory: { [key: string]: number } = {};

  // Helper function to convert array of { name, personCount } to object { [name]: count }
  const arrayToObject = (arr: Array<{ name: string; personCount: number | string }> | undefined): { [key: string]: number } => {
    if (!Array.isArray(arr)) return {};
    const result: { [key: string]: number } = {};
    const len = arr.length;
    
    for (let i = 0; i < len; i++) {
      const item = arr[i];
      if (!item.name) continue;
      
      const name = item.name.trim();
      
      // Handle both number and string personCount values
      const count = typeof item.personCount === 'number' 
        ? item.personCount 
        : typeof item.personCount === 'string' 
          ? parseInt(item.personCount.replace(/,/g, ''), 10) || 0
          : 0;
      
      if (count > 0 || item.personCount === 0) {
        result[name] = (result[name] || 0) + count;
      }
    }
    return result;
  };

  // Helper function to merge two vote history objects (optimized with direct property access)
  const mergeVoteHistory = (
    target: { [key: string]: number },
    source: { [key: string]: number }
  ) => {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = (target[key] || 0) + source[key];
      }
    }
  };

  // Process each response and merge vote history
  responses.forEach((response: any) => {
    const demographicBreakdowns = response.demographicBreakdowns;
    if (!demographicBreakdowns || typeof demographicBreakdowns !== 'object') {
      return;
    }

    // Extract and merge general vote histories
    if (demographicBreakdowns.generalVoteHistories) {
      const voteHistories = arrayToObject(demographicBreakdowns.generalVoteHistories);
      mergeVoteHistory(voteHistory, voteHistories);
    }
  });

  // Only log in detailed logging mode
  if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DETAILED_API_LOGGING === 'true') {
    console.log('🗳️ Extracted general vote history:', {
      entries: Object.keys(voteHistory).length,
      voteHistoryKeys: Object.keys(voteHistory)
    });
  }

  return voteHistory;
}

/**
 * Extract primary vote history from API responses
 * Transforms array format (demographicBreakdowns.primaryVoteHistories[]) into object format ({ "0 of 4": 62802, ... })
 * Sums counts across multiple responses if there are multiple geoIds
 */
function extractPrimaryVoteHistoryFromResponses(
  responses: AudienceCountResponse[]
): { [key: string]: number } {
  const voteHistory: { [key: string]: number } = {};

  // Helper function to convert array of { name, personCount } to object { [name]: count }
  const arrayToObject = (arr: Array<{ name: string; personCount: number | string }> | undefined): { [key: string]: number } => {
    if (!Array.isArray(arr)) return {};
    const result: { [key: string]: number } = {};
    const len = arr.length;
    
    for (let i = 0; i < len; i++) {
      const item = arr[i];
      if (!item.name) continue;
      
      const name = item.name.trim();
      
      // Handle both number and string personCount values
      const count = typeof item.personCount === 'number' 
        ? item.personCount 
        : typeof item.personCount === 'string' 
          ? parseInt(item.personCount.replace(/,/g, ''), 10) || 0
          : 0;
      
      if (count > 0 || item.personCount === 0) {
        result[name] = (result[name] || 0) + count;
      }
    }
    return result;
  };

  // Helper function to merge two vote history objects (optimized with direct property access)
  const mergeVoteHistory = (
    target: { [key: string]: number },
    source: { [key: string]: number }
  ) => {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = (target[key] || 0) + source[key];
      }
    }
  };

  // Process each response and merge vote history
  responses.forEach((response: any) => {
    const demographicBreakdowns = response.demographicBreakdowns;
    if (!demographicBreakdowns || typeof demographicBreakdowns !== 'object') {
      return;
    }

    // Extract and merge primary vote histories
    if (demographicBreakdowns.primaryVoteHistories) {
      const voteHistories = arrayToObject(demographicBreakdowns.primaryVoteHistories);
      mergeVoteHistory(voteHistory, voteHistories);
    }
  });

  // Only log in detailed logging mode
  if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DETAILED_API_LOGGING === 'true') {
    console.log('🗳️ Extracted primary vote history:', {
      entries: Object.keys(voteHistory).length,
      voteHistoryKeys: Object.keys(voteHistory)
    });
  }

  return voteHistory;
}

