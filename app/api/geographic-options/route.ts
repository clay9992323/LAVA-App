import { NextRequest, NextResponse } from 'next/server';
import { apiService } from '@/lib/apiService';
import { buildUniverseList } from '@/lib/dataTransformers';
import { convertDemographicFiltersToDimensionIds } from '@/lib/dimensionsCache';
import {
  extractGeographyFromAudienceResponse,
  finalizeGeography,
  pickGeographyLevels
} from '@/lib/geographyBreakdown';

const DEFAULT_LEVELS = [
  'state',
  'county',
  'dma',
  'congressional',
  'stateSenateDistrict',
  'stateHouseDistrict'
];

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

export async function POST(request: NextRequest) {
  const geoCache = new RequestGeoCache();

  try {
    const body = await request.json();
    const {
      selectedStates = [],
      selectedCounties = [],
      universeFields = [],
      demographicFilters = {},
      operator = 'AND'
    } = body;

    const demographicIds = await convertDemographicFiltersToDimensionIds(demographicFilters);
    const universeList = buildUniverseList(universeFields);
    const geoId = await resolvePrimaryGeoId(selectedStates, geoCache);

    if (!geoId) {
      throw new Error('Unable to resolve geoId for geographic options request');
    }

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

    // Don't limit entries for selection dropdowns - show all options
    // The top 5 limit should only apply to visual breakdowns, not selections
    const geography = finalizeGeography(
      pickGeographyLevels(extractGeographyFromAudienceResponse(response), DEFAULT_LEVELS),
      DEFAULT_LEVELS
    );

    const geographicOptions = {
      states: geography.state || {},
      counties: geography.county || {},
      dmas: geography.dma || {},
      congressionalDistricts: geography.congressional || {},
      stateSenateDistricts: geography.stateSenateDistrict || {},
      stateHouseDistricts: geography.stateHouseDistrict || {}
    };

    return NextResponse.json({
      success: true,
      geographicOptions,
      operator,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Geographic options API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to get geographic options: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  } finally {
    geoCache.clear();
  }
}

async function resolvePrimaryGeoId(selectedStates: string[], geoCache: RequestGeoCache): Promise<number | null> {
  if (selectedStates?.length) {
    const stateView = await geoCache.getGeographicView({
      typeCode: 'ST',
      geoCode: selectedStates[0],
      subGeoCode: ''
    });
    if (stateView.length > 0) {
      return stateView[0].geoId;
    }
  }

  const natView = await geoCache.getGeographicView({
    typeCode: 'NAT',
    geoCode: '',
    subGeoCode: ''
  });
  if (Array.isArray(natView) && natView.length > 0) {
    return natView[0].geoId;
  }

  return null;
}

