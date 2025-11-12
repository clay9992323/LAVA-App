// Combined filters API route - handles geographic and universe filtering
import { NextRequest, NextResponse } from 'next/server';
import { apiService } from '@/lib/apiService';
import { sqlServerService } from '@/lib/sqlServerService';
import { compressResponse } from '@/lib/responseOptimizer';
import {
  buildUniverseList,
  getApiTypeCode,
  transformGeographicView
} from '@/lib/dataTransformers';

// Cache for dimension data to avoid repeated API calls and rate limiting
const dimensionsCache: Map<string, { data: any[], timestamp: number }> = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour cache

async function getCachedDimensions(type: string): Promise<any[]> {
  const now = Date.now();
  const cached = dimensionsCache.get(type);
  
  // Check if cache is valid
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`📦 Using cached dimensions for ${type}`);
    return cached.data;
  }
  
  // Fetch from API
  console.log(`🔄 Fetching dimensions for ${type} from API`);
  const data = await apiService.getDimensions(type);
  
  // Update cache
  dimensionsCache.set(type, { data, timestamp: now });
  
  return data;
}

// Request-scoped cache for geographic view data to avoid redundant API calls within a single request
interface GeoViewCacheKey {
  typeCode: string;
  geoCode: string;
  subGeoCode: string;
}

class RequestGeoCache {
  private cache: Map<string, any[]> = new Map();
  
  private getCacheKey(request: GeoViewCacheKey): string {
    return `${request.typeCode}|${request.geoCode}|${request.subGeoCode}`;
  }
  
  async getGeographicView(request: GeoViewCacheKey): Promise<any[]> {
    const key = this.getCacheKey(request);
    
    if (this.cache.has(key)) {
      console.log(`📦 Using cached geo view for ${request.typeCode}/${request.geoCode || 'ALL'}`);
      return this.cache.get(key)!;
    }
    
    console.log(`🔄 Fetching geo view from API: ${request.typeCode}/${request.geoCode || 'ALL'}`);
    const data = await apiService.getGeographicView(request);
    this.cache.set(key, data);
    
    return data;
  }
  
  clear() {
    this.cache.clear();
  }
}

export async function POST(request: NextRequest) {
  // Create request-scoped cache to avoid redundant API calls
  const geoCache = new RequestGeoCache();
  
  try {
    const body = await request.json();
    const { universeFields, geographicFilters, demographicFilters, operator, requestedLevels } = body;

    console.log('\n========================================');
    console.log('🚀 COMBINED FILTERS API CALLED');
    console.log('========================================');
    console.log('📥 Request Parameters:');
    console.log('   Universe Fields:', universeFields);
    console.log('   Geographic Filters:', JSON.stringify(geographicFilters, null, 2));
    console.log('   Demographic Filters:', JSON.stringify(demographicFilters, null, 2));
    console.log('   Operator:', operator || 'AND');
    console.log('   Requested Levels:', requestedLevels);
    console.log('   Counties array:', geographicFilters?.county);
    console.log('   Counties array length:', geographicFilters?.county?.length || 0);
    if (geographicFilters?.county && geographicFilters.county.length > 0) {
      console.log('   First county value:', `"${geographicFilters.county[0]}"`);
      console.log('   First county type:', typeof geographicFilters.county[0]);
    }
    console.log('========================================\n');

    if (!universeFields || !Array.isArray(universeFields)) {
      return NextResponse.json({
        error: 'universeFields must be an array'
      }, { status: 400 });
    }

    if (!geographicFilters || typeof geographicFilters !== 'object') {
      return NextResponse.json({
        error: 'geographicFilters must be an object'
      }, { status: 400 });
    }
    
    let levelsToFetch = requestedLevels || ['state', 'county', 'dma'];
    
    // Auto-add district levels if districts are selected
    if (geographicFilters.congressional && geographicFilters.congressional.length > 0) {
      if (!levelsToFetch.includes('congressional')) {
        levelsToFetch = [...levelsToFetch, 'congressional'];
        console.log('🔧 Auto-added congressional to levelsToFetch:', levelsToFetch);
      }
    }
    if (geographicFilters.stateSenateDistrict && geographicFilters.stateSenateDistrict.length > 0) {
      if (!levelsToFetch.includes('stateSenateDistrict')) {
        levelsToFetch = [...levelsToFetch, 'stateSenateDistrict'];
        console.log('🔧 Auto-added stateSenateDistrict to levelsToFetch:', levelsToFetch);
      }
    }
    if (geographicFilters.stateHouseDistrict && geographicFilters.stateHouseDistrict.length > 0) {
      if (!levelsToFetch.includes('stateHouseDistrict')) {
        levelsToFetch = [...levelsToFetch, 'stateHouseDistrict'];
        console.log('🔧 Auto-added stateHouseDistrict to levelsToFetch:', levelsToFetch);
      }
    }
    
    // Get combined counts and geoIds in one call
    const { counts: combinedCounts, geoIds: resolvedGeoIds } = await getCombinedCountsFromApi(
      universeFields,
      geographicFilters,
      demographicFilters || {},
      operator || 'AND',
      geoCache
    );
    
    // Check if demographic or universe filters are present
    const hasDemographicFilters = demographicFilters && Object.values(demographicFilters).some((values: any) => Array.isArray(values) && values.length > 0);
    const hasUniverseFilters = universeFields && universeFields.length > 0;
    
    let filteredBreakdowns;
    
    if (hasDemographicFilters || hasUniverseFilters) {
      console.log('✅ Using SQL for filtered breakdowns', {
        demographicFilters: hasDemographicFilters,
        universeFilters: hasUniverseFilters
      });
      // Use SQL-based method which supports demographic and universe filters
      filteredBreakdowns = await sqlServerService.getFilteredBreakdowns(
        universeFields,
        geographicFilters,
        operator || 'AND',
        levelsToFetch,
        demographicFilters
      );
    } else {
      console.log('✅ Using API for filtered breakdowns (geography only - faster)');
      // Use API-based method for geography-only filtering (faster)
      // Pass geoCache and resolvedGeoIds to avoid redundant API calls
      filteredBreakdowns = await getFilteredBreakdownsFromApi(
        universeFields,
        geographicFilters,
        demographicFilters || {},
        operator || 'AND',
        levelsToFetch,
        combinedCounts,
        geoCache,
        resolvedGeoIds
      );
    }
    
    const optimizedBreakdowns = {
      demographics: filteredBreakdowns.demographics,
      engagement: filteredBreakdowns.engagement,
      political: filteredBreakdowns.political,
      mediaConsumption: filteredBreakdowns.mediaConsumption,
      geography: {} as Record<string, any>
    };

    levelsToFetch.forEach((level: string) => {
      if (filteredBreakdowns.geography[level]) {
        optimizedBreakdowns.geography[level] = filteredBreakdowns.geography[level];
      }
    });
    
    console.log('\n========================================');
    console.log('✅ COMBINED FILTERS API RESPONSE');
    console.log('========================================');
    console.log('📤 Total Count:', combinedCounts.total);
    console.log('📊 Universe Counts:', Object.keys(combinedCounts).filter(k => k !== 'total').map(k => `${k}: ${combinedCounts[k]}`).join(', '));
    console.log('🎯 Demographics Included:', Object.keys(optimizedBreakdowns.demographics).join(', '));
    console.log('🗺️  Geography Levels Included:', Object.keys(optimizedBreakdowns.geography).join(', '));
    console.log('========================================\n');
    
    return compressResponse({
      success: true,
      combinedCounts,
      filteredBreakdowns: optimizedBreakdowns,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Combined filters API error:', error);
    return NextResponse.json({
      success: false,
      error: `Failed to get combined counts: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  } finally {
    // Clear request-scoped cache
    geoCache.clear();
  }
}

// Helper function to convert demographic filter selections to dimension IDs
async function convertDemographicFiltersToDimensionIds(demographicFilters: { [key: string]: string[] }): Promise<{
  genderIds: string;
  ageRangeIds: string;
  ethnicityIds: string;
  incomeIds: string;
  educationIds: string;
  partyIds: string;
}> {
  const result = {
    genderIds: '',
    ageRangeIds: '',
    ethnicityIds: '',
    incomeIds: '',
    educationIds: '',
    partyIds: ''
  };
  
  // Early return if no demographic filters
  if (!demographicFilters || Object.keys(demographicFilters).length === 0) {
    return result;
  }
  
  // Fetch dimension data for all demographic types (using cache to avoid rate limiting)
  const [genderDims, ageDims, ethnicityDims, incomeDims, educationDims, partyDims] = await Promise.all([
    demographicFilters.gender?.length > 0 ? getCachedDimensions('gender') : Promise.resolve([]),
    demographicFilters.age?.length > 0 ? getCachedDimensions('agerange') : Promise.resolve([]),
    demographicFilters.ethnicity?.length > 0 ? getCachedDimensions('ethnicity') : Promise.resolve([]),
    demographicFilters.income?.length > 0 ? getCachedDimensions('income') : Promise.resolve([]),
    demographicFilters.education?.length > 0 ? getCachedDimensions('education') : Promise.resolve([]),
    demographicFilters.party?.length > 0 ? getCachedDimensions('party') : Promise.resolve([])
  ]);
  
  // Convert gender selections to IDs
  if (demographicFilters.gender && demographicFilters.gender.length > 0) {
    const selectedIds = genderDims
      .filter(dim => dim.name && demographicFilters.gender.includes(dim.name))
      .map(dim => dim.id.toString());
    result.genderIds = selectedIds.join(',');
  }
  
  // Convert age selections to IDs
  if (demographicFilters.age && demographicFilters.age.length > 0) {
    const selectedIds = ageDims
      .filter(dim => dim.name && demographicFilters.age.includes(dim.name))
      .map(dim => dim.id.toString());
    result.ageRangeIds = selectedIds.join(',');
  }
  
  // Convert ethnicity selections to IDs
  if (demographicFilters.ethnicity && demographicFilters.ethnicity.length > 0) {
    const selectedIds = ethnicityDims
      .filter(dim => dim.name && demographicFilters.ethnicity.includes(dim.name))
      .map(dim => dim.id.toString());
    result.ethnicityIds = selectedIds.join(',');
  }
  
  // Convert income selections to IDs
  if (demographicFilters.income && demographicFilters.income.length > 0) {
    const selectedIds = incomeDims
      .filter(dim => dim.name && demographicFilters.income.includes(dim.name))
      .map(dim => dim.id.toString());
    result.incomeIds = selectedIds.join(',');
  }
  
  // Convert education selections to IDs
  if (demographicFilters.education && demographicFilters.education.length > 0) {
    const selectedIds = educationDims
      .filter(dim => dim.name && demographicFilters.education.includes(dim.name))
      .map(dim => dim.id.toString());
    result.educationIds = selectedIds.join(',');
  }
  
  // Convert party selections to IDs
  if (demographicFilters.party && demographicFilters.party.length > 0) {
    const selectedIds = partyDims
      .filter(dim => dim.name && demographicFilters.party.includes(dim.name))
      .map(dim => dim.id.toString());
    result.partyIds = selectedIds.join(',');
  }
  
  return result;
}

async function getCombinedCountsFromApi(
  universeFields: string[],
  geographicFilters: { [key: string]: string[] },
  demographicFilters: { [key: string]: string[] },
  operator: string,
  geoCache: RequestGeoCache
): Promise<{ counts: { [key: string]: number }, geoIds: number[] }> {
  try {
    const results: { [key: string]: number } = {};
    let resolvedGeoIds: number[] = [];
    const states = geographicFilters.state || [];
    const counties = geographicFilters.county || [];
    const dmas = geographicFilters.dma || [];
    const congressional = geographicFilters.congressional || [];
    const stateSenateDistricts = geographicFilters.stateSenateDistrict || [];
    const stateHouseDistricts = geographicFilters.stateHouseDistrict || [];
    
    // Convert demographic filters to dimension IDs
    const demographicIds = await convertDemographicFiltersToDimensionIds(demographicFilters);
    console.log('📊 Converted demographic filters to IDs:', demographicIds);
    
    // Check if demographic filters are present
    const hasDemographicFilters = Object.values(demographicIds).some(val => val && val.trim() !== '');
    
    // NO UNIVERSE FILTERS AND NO DEMOGRAPHIC FILTERS - Just use Geo/view for count (efficient!)
    if (universeFields.length === 0 && !hasDemographicFilters) {
      console.log('📊 No universe or demographic filters - using Geo/view for counts');
      
      // Check for most specific geography selected (priority: County > DMA > State)
      if (counties.length > 0 && states.length > 0) {
        // Get county counts
        console.log(`📊 Getting counts for counties: ${counties.join(', ')}`);
        const countyView = await geoCache.getGeographicView({
          typeCode: 'CTY',
          geoCode: states[0],
          subGeoCode: ''
        });
        // Filter to selected counties
        const selectedCounties = countyView.filter(c => 
          counties.includes(c.subGeoCode || '') || counties.includes(c.geoCode || '')
        );
        results['total'] = selectedCounties.reduce((sum, c) => sum + c.count, 0);
        resolvedGeoIds = selectedCounties.map(c => c.geoId);
        console.log(`📊 County total: ${results['total']}`);
      } else if (congressional.length > 0) {
        // Congressional districts
        console.log(`📊 Getting counts for Congressional Districts: ${congressional.join(', ')}`);
        const cdView = await geoCache.getGeographicView({
          typeCode: 'CD',
          geoCode: states.length > 0 ? states[0] : '',
          subGeoCode: ''
        });
        const selectedCds = cdView.filter(d => 
          congressional.includes(d.subGeoCode || '') || congressional.includes(d.geoCode || '')
        );
        results['total'] = selectedCds.reduce((sum, d) => sum + d.count, 0);
        resolvedGeoIds = selectedCds.map(d => d.geoId);
        console.log(`📊 Congressional total: ${results['total']}`);
      } else if (stateSenateDistricts.length > 0) {
        // State Senate Districts
        console.log(`📊 Getting counts for State Senate Districts: ${stateSenateDistricts.join(', ')}`);
        const ssdView = await geoCache.getGeographicView({
          typeCode: 'SSD',
          geoCode: states.length > 0 ? states[0] : '',
          subGeoCode: ''
        });
        const selectedSsd = ssdView.filter(d => 
          stateSenateDistricts.includes(d.subGeoCode || '') || stateSenateDistricts.includes(d.geoCode || '')
        );
        results['total'] = selectedSsd.reduce((sum, d) => sum + d.count, 0);
        resolvedGeoIds = selectedSsd.map(d => d.geoId);
        console.log(`📊 State Senate total: ${results['total']}`);
      } else if (stateHouseDistricts.length > 0) {
        // State House Districts
        console.log(`📊 Getting counts for State House Districts: ${stateHouseDistricts.join(', ')}`);
        const shdView = await geoCache.getGeographicView({
          typeCode: 'SHD',
          geoCode: states.length > 0 ? states[0] : '',
          subGeoCode: ''
        });
        const selectedShd = shdView.filter(d => 
          stateHouseDistricts.includes(d.subGeoCode || '') || stateHouseDistricts.includes(d.geoCode || '')
        );
        results['total'] = selectedShd.reduce((sum, d) => sum + d.count, 0);
        resolvedGeoIds = selectedShd.map(d => d.geoId);
        console.log(`📊 State House total: ${results['total']}`);
      } else if (dmas.length > 0) {
        // Get DMA counts
        console.log(`📊 Getting counts for DMAs: ${dmas.join(', ')}`);
        const dmaView = await geoCache.getGeographicView({
          typeCode: 'STDMA',
          geoCode: states.length > 0 ? states[0] : '',
          subGeoCode: ''
        });
        const selectedDmas = dmaView.filter(d => 
          dmas.includes(d.subGeoCode || '') || dmas.includes(d.geoCode || '')
        );
        results['total'] = selectedDmas.reduce((sum, d) => sum + d.count, 0);
        resolvedGeoIds = selectedDmas.map(d => d.geoId);
        console.log(`📊 DMA total: ${results['total']}`);
      } else if (states.length === 0) {
        // National - all states
        const stateView = await geoCache.getGeographicView({ 
          typeCode: 'ST',
          geoCode: '',
          subGeoCode: ''
        });
        results['total'] = stateView.reduce((sum, view) => sum + view.count, 0);
        resolvedGeoIds = stateView.map(view => view.geoId);
        console.log(`📊 National total: ${results['total']}`);
      } else {
        // State-level counts
        console.log(`📊 Getting counts for states: ${states.join(', ')}`);
        const selectedStateViews = await Promise.all(
          states.map(state => 
            geoCache.getGeographicView({
              typeCode: 'ST',
              geoCode: state,
              subGeoCode: ''
            })
          )
        );
        results['total'] = selectedStateViews.reduce((sum, views) => 
          sum + views.reduce((s, v) => s + v.count, 0), 0
        );
        resolvedGeoIds = selectedStateViews.filter(views => views.length > 0).map(views => views[0].geoId);
        console.log(`📊 State total: ${results['total']}`);
      }
      return { counts: results, geoIds: resolvedGeoIds };
    }

    // UNIVERSE FILTERS OR DEMOGRAPHIC FILTERS - Use Audience/count endpoint
    if (hasDemographicFilters) {
      console.log('🎯 Demographic filters detected - using Audience/count endpoint');
    }
    if (universeFields.length > 0) {
      console.log('🎯 Universe filters detected - using Audience/count endpoint');
    }
    
    let geoIds: number[] = [];
    
    // Determine most specific geographic level selected and collect ALL geoIds
    // Priority: County > Congressional > State Senate > State House > DMA > State > National
    if (counties.length > 0 && states.length > 0) {
      // Get county geoIds for ALL selected counties
      console.log(`🎯 Getting geoIds for ${counties.length} counties in state: ${states[0]}`);
      const countyView = await geoCache.getGeographicView({
        typeCode: 'CTY',
        geoCode: states[0],
        subGeoCode: ''
      });
      const selectedCounties = countyView.filter(c => 
        counties.includes(c.subGeoCode || '') || counties.includes(c.geoCode || '')
      );
      geoIds = selectedCounties.map(c => c.geoId);
      console.log(`✅ Found ${geoIds.length} county geoIds: [${geoIds.join(', ')}]`);
    } else if (congressional.length > 0) {
      // Get Congressional District geoIds for ALL selected districts
      console.log(`🎯 Getting geoIds for ${congressional.length} Congressional Districts: ${congressional.join(', ')}`);
      const cdView = await geoCache.getGeographicView({
        typeCode: 'CD',
        geoCode: states.length > 0 ? states[0] : '',
        subGeoCode: ''
      });
      const selectedCds = cdView.filter(d => 
        congressional.includes(d.subGeoCode || '') || congressional.includes(d.geoCode || '')
      );
      geoIds = selectedCds.map(d => d.geoId);
      console.log(`✅ Found ${geoIds.length} Congressional District geoIds: [${geoIds.join(', ')}]`);
    } else if (stateSenateDistricts.length > 0) {
      // Get State Senate District geoIds for ALL selected districts
      console.log(`🎯 Getting geoIds for ${stateSenateDistricts.length} State Senate Districts: ${stateSenateDistricts.join(', ')}`);
      const ssdView = await geoCache.getGeographicView({
        typeCode: 'SSD',
        geoCode: states.length > 0 ? states[0] : '',
        subGeoCode: ''
      });
      const selectedSsd = ssdView.filter(d => 
        stateSenateDistricts.includes(d.subGeoCode || '') || stateSenateDistricts.includes(d.geoCode || '')
      );
      geoIds = selectedSsd.map(d => d.geoId);
      console.log(`✅ Found ${geoIds.length} State Senate District geoIds: [${geoIds.join(', ')}]`);
    } else if (stateHouseDistricts.length > 0) {
      // Get State House District geoIds for ALL selected districts
      console.log(`🎯 Getting geoIds for ${stateHouseDistricts.length} State House Districts: ${stateHouseDistricts.join(', ')}`);
      const shdView = await geoCache.getGeographicView({
        typeCode: 'SHD',
        geoCode: states.length > 0 ? states[0] : '',
        subGeoCode: ''
      });
      const selectedShd = shdView.filter(d => 
        stateHouseDistricts.includes(d.subGeoCode || '') || stateHouseDistricts.includes(d.geoCode || '')
      );
      geoIds = selectedShd.map(d => d.geoId);
      console.log(`✅ Found ${geoIds.length} State House District geoIds: [${geoIds.join(', ')}]`);
    } else if (dmas.length > 0) {
      // Get DMA geoIds for ALL selected DMAs
      console.log(`🎯 Getting geoIds for ${dmas.length} DMAs: ${dmas.join(', ')}`);
      const dmaView = await geoCache.getGeographicView({
        typeCode: 'STDMA',
        geoCode: states.length > 0 ? states[0] : '',
        subGeoCode: ''
      });
      const selectedDmas = dmaView.filter(d => 
        dmas.includes(d.subGeoCode || '') || dmas.includes(d.geoCode || '')
      );
      geoIds = selectedDmas.map(d => d.geoId);
      console.log(`✅ Found ${geoIds.length} DMA geoIds: [${geoIds.join(', ')}]`);
    } else if (states.length > 0) {
      // Get state geoIds for ALL selected states
      console.log(`🎯 Getting geoIds for ${states.length} states: ${states.join(', ')}`);
      const stateViews = await Promise.all(
        states.map(state => 
          geoCache.getGeographicView({
            typeCode: 'ST',
            geoCode: state,
            subGeoCode: ''
          })
        )
      );
      geoIds = stateViews.filter(view => view.length > 0).map(view => view[0].geoId);
      console.log(`✅ Found ${geoIds.length} state geoIds: [${geoIds.join(', ')}]`);
    } else {
      // National - get national geoId
      console.log(`🎯 Getting national geoId`);
      const natView = await geoCache.getGeographicView({
        typeCode: 'NAT',
        geoCode: '',
        subGeoCode: ''
      });
      if (Array.isArray(natView) && natView.length > 0) {
        geoIds = [natView[0].geoId];
        console.log(`✅ Using national geoId: ${geoIds[0]}`);
      }
    }
    
    resolvedGeoIds = geoIds;

    const universeList = buildUniverseList(universeFields);
    console.log(`📋 Universe list: ${universeList}`);

    // Get combined count for all universe filters by calling API for each geoId and summing
    console.log(`🔍 Fetching combined count for ${geoIds.length} geoIds with universeList: ${universeList}, demographics: ${JSON.stringify(demographicIds)}`);
    const audienceCountResponses = await Promise.all(
      geoIds.map(async (geoId) => {
        console.log(`  📊 Fetching count for geoId: ${geoId}`);
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
        console.log(`  ✅ geoId ${geoId}: ${response.count}`);
        return response.count;
      })
    );

    results['total'] = audienceCountResponses.reduce((sum, count) => sum + count, 0);
    console.log(`✅ Combined count (sum of ${geoIds.length} geoIds): ${results['total']}`);

    // Get individual counts for each universe field
    console.log(`🔍 Fetching individual counts for ${universeFields.length} universe fields`);
    const individualCounts = await Promise.all(
      universeFields.map(async (field) => {
        const mappedField = buildUniverseList([field]);
        console.log(`  📊 Fetching count for: ${field} (mapped: ${mappedField})`);
        
        // Sum counts across all geoIds for this field
        const fieldCounts = await Promise.all(
          geoIds.map(async (geoId) => {
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
              universeList: mappedField
            });
            return response.count;
          })
        );
        
        const totalCount = fieldCounts.reduce((sum, count) => sum + count, 0);
        console.log(`  ✅ ${field}: ${totalCount} (sum of ${geoIds.length} geoIds)`);
        return { field, count: totalCount };
      })
    );

    individualCounts.forEach(({ field, count }) => {
      results[field] = count;
    });

    return { counts: results, geoIds: resolvedGeoIds };
  } catch (error) {
    console.error('Error fetching combined counts:', error);
    throw error;
  }
}

async function getFilteredDemographicsUsingAudienceCount(
  geoIds: number[],
  universeList: string,
  demographicIds?: {
    genderIds: string;
    ageRangeIds: string;
    ethnicityIds: string;
    incomeIds: string;
    educationIds: string;
    partyIds: string;
  },
  demographicFilters?: { [key: string]: string[] },
  geographicFilters?: { [key: string]: string[] }
): Promise<{
  gender: { [key: string]: number };
  age: { [key: string]: number };
  ethnicity: { [key: string]: number };
  education: { [key: string]: number };
  income: { [key: string]: number };
}> {
  console.log('\n' + '🎯'.repeat(40));
  console.log('🎯 getFilteredDemographicsUsingAudienceCount() CALLED');
  console.log('🎯 Parameters:', {
    geoIds,
    universeList,
    demographicIds,
    demographicFilters,
    geographicFilters
  });
  console.log('🎯'.repeat(40) + '\n');
  
  const demographics = {
    gender: {} as { [key: string]: number },
    age: {} as { [key: string]: number },
    ethnicity: {} as { [key: string]: number },
    education: {} as { [key: string]: number },
    income: {} as { [key: string]: number }
  };

  // Check if demographic filters are present
  const hasDemographicFilters = demographicIds && Object.values(demographicIds).some(val => val && val.trim() !== '');
  
  console.log('\n' + '🔍'.repeat(40));
  console.log(`🔍 DEMOGRAPHIC BREAKDOWN PATH SELECTION`);
  console.log(`🔍 universeList: "${universeList}"`);
  console.log(`🔍 hasDemographicFilters: ${hasDemographicFilters}`);
  console.log(`🔍 demographicIds:`, demographicIds);
  console.log('🔍'.repeat(40) + '\n');
  
  // FAST PATH: No universe filters AND no demographic filters - use GeoDemoCount (geography-only)
  if ((!universeList || universeList.trim() === '') && !hasDemographicFilters) {
    console.log(`📊 ✅ TAKING FAST PATH - No universe or demographic filters - using GeoDemoCount for ${geoIds.length} geoId(s)`);
    console.log(`📊 geoIds to process: [${geoIds.join(', ')}]`);
    
    let processedCount = 0;
    for (const geoId of geoIds) {
      processedCount++;
      console.log(`📊 Processing geoId ${processedCount}/${geoIds.length}: ${geoId}`);
      
      const demoResponse = await apiService.getDemographicBreakdown(geoId);
      if (demoResponse.demographics) {
        Object.entries(demoResponse.demographics).forEach(([category, values]) => {
          const categoryLower = category.toLowerCase();
          if (Array.isArray(values)) {
            values.forEach(item => {
              if (item.value) {
                let targetCategory: 'gender' | 'age' | 'ethnicity' | 'education' | 'income' | null = null;
                if (categoryLower.includes('gender')) targetCategory = 'gender';
                else if (categoryLower.includes('age')) targetCategory = 'age';
                else if (categoryLower.includes('ethnic')) targetCategory = 'ethnicity';
                else if (categoryLower.includes('education')) targetCategory = 'education';
                else if (categoryLower.includes('income')) targetCategory = 'income';
                
                if (targetCategory) {
                  const oldValue = demographics[targetCategory][item.value] || 0;
                  const newValue = oldValue + item.count;
                  demographics[targetCategory][item.value] = newValue;
                  
                  // Log first few gender values to verify summing
                  if (targetCategory === 'gender' && processedCount <= 2) {
                    console.log(`   📊 ${targetCategory}.${item.value}: ${oldValue} + ${item.count} = ${newValue}`);
                  }
                }
              }
            });
          }
        });
      }
    }
    
    console.log(`✅ Fast path demographics fetched (${geoIds.length} API calls, ${processedCount} processed)`);
    console.log(`✅ Final gender totals:`, demographics.gender);
    return demographics;
  }

  // SQL-OPTIMIZED PATH: Use direct SQL queries instead of 20-30 API calls
  console.log('\n' + '═'.repeat(80));
  console.log('🚀 SQL-OPTIMIZED PATH STARTING');
  console.log('═'.repeat(80));
  console.log(`📊 Attempting SQL-based demographic breakdowns to avoid API rate limits`);
  console.log(`📊 Geographic filters (RAW):`, JSON.stringify(geographicFilters, null, 2));
  console.log(`📊 Demographic filters:`, demographicFilters);
  console.log(`📊 Universe list:`, universeList);
  
  try {
    // Build geographic filter for SQL (handle all geographic levels)
    const states = geographicFilters?.state || [];
    const counties = geographicFilters?.county || [];
    const dmas = geographicFilters?.dma || [];
    const congressional = geographicFilters?.congressional || [];
    const stateSenateDistricts = geographicFilters?.stateSenateDistrict || [];
    const stateHouseDistricts = geographicFilters?.stateHouseDistrict || [];
    
    console.log(`📊 Extracted arrays:`, {
      states,
      counties,
      dmas,
      congressional,
      stateSenateDistricts,
      stateHouseDistricts
    });
    
    const geoFilterParts: string[] = [];
    
    // Priority: Use most specific geographic level
    // County names in DB are uppercase like "JEFFERSON PARISH"
    if (counties.length > 0) {
      // Convert to uppercase and remove state suffix (e.g., "Jefferson Parish, LA" -> "JEFFERSON PARISH")
      const cleanedCounties = counties.map(c => {
        const cleaned = c.split(',')[0].trim().toUpperCase(); // Remove ", LA" and uppercase
        console.log(`📊 County mapping: "${c}" -> "${cleaned}"`);
        return cleaned;
      });
      geoFilterParts.push(`County IN (${cleanedCounties.map(c => `'${c}'`).join(', ')})`);
      console.log(`📊 Using county filter with ${cleanedCounties.length} counties:`, cleanedCounties);
    } else if (congressional.length > 0) {
      geoFilterParts.push(`US_Congressional_District IN (${congressional.map(cd => `'${cd}'`).join(', ')})`);
      console.log(`📊 Using congressional district filter: ${congressional.join(', ')}`);
    } else if (stateSenateDistricts.length > 0) {
      geoFilterParts.push(`State_Senate_District IN (${stateSenateDistricts.map(sd => `'${sd}'`).join(', ')})`);
      console.log(`📊 Using state senate district filter: ${stateSenateDistricts.join(', ')}`);
    } else if (stateHouseDistricts.length > 0) {
      geoFilterParts.push(`State_House_District IN (${stateHouseDistricts.map(hd => `'${hd}'`).join(', ')})`);
      console.log(`📊 Using state house district filter: ${stateHouseDistricts.join(', ')}`);
    } else if (dmas.length > 0) {
      geoFilterParts.push(`DMA IN (${dmas.map(d => `'${d}'`).join(', ')})`);
      console.log(`📊 Using DMA filter: ${dmas.join(', ')}`);
    } else if (states.length > 0) {
      geoFilterParts.push(`State IN (${states.map(s => `'${s}'`).join(', ')})`);
      console.log(`📊 Using state filter: ${states.join(', ')}`);
    }
    
    const geoFilter = geoFilterParts.length > 0 ? geoFilterParts.join(' AND ') : '1=1';
    
    console.log(`📊 FINAL SQL geoFilter:`, geoFilter);
    
    // Convert universe list to array
    const universeFiltersArray = universeList ? universeList.split(',').map(u => u.trim()) : [];
    console.log(`📊 SQL universeFilters:`, universeFiltersArray);
    
    // Call SQL-based demographic breakdown
    console.log(`🔄 Calling sqlServerService.getFilteredDemographicBreakdowns()...`);
    const sqlDemographics = await sqlServerService.getFilteredDemographicBreakdowns(
      geoFilter,
      demographicFilters?.gender,
      demographicFilters?.age,
      demographicFilters?.ethnicity,
      demographicFilters?.income,
      demographicFilters?.education,
      universeFiltersArray,
      geographicFilters // NEW: Pass geographic filters for multi-state table selection
    );
    
    console.log('═'.repeat(80));
    console.log(`✅ SQL-OPTIMIZED DEMOGRAPHICS FETCHED SUCCESSFULLY`);
    console.log('═'.repeat(80));
    console.log(`📊 Gender breakdown:`, sqlDemographics.gender);
    console.log(`📊 Age breakdown:`, sqlDemographics.age);
    console.log(`📊 Ethnicity breakdown:`, sqlDemographics.ethnicity);
    console.log('═'.repeat(80) + '\n');
    
    return sqlDemographics;
  } catch (sqlError) {
    console.error('\n' + '═'.repeat(80));
    console.error(`❌ SQL QUERY FAILED - FALLING BACK TO API APPROACH`);
    console.error('═'.repeat(80));
    console.error(`Error:`, sqlError);
    console.error('═'.repeat(80) + '\n');
    // Fall through to API approach below as backup
  }

  // FALLBACK: API-based approach (only if SQL fails)
  if (hasDemographicFilters) {
    console.log(`📊 Demographic filters detected - using API fallback for ${geoIds.length} geoId(s)`);
    console.log(`📊 Demographic filters:`, demographicIds);
  }
  if (universeList && universeList.trim() !== '') {
    console.log(`📊 Universe filters detected: "${universeList}" - using API fallback for ${geoIds.length} geoId(s)`);
  }
  console.log(`⚠️ This will make ~25 API calls per geoId for accurate filtered demographics`);

  // Get dimension lists to know what values to query for (using cache to avoid rate limiting)
  const [genderDims, ageDims, ethnicityDims, educationDims, incomeDims] = await Promise.all([
    getCachedDimensions('gender'),
    getCachedDimensions('agerange'),
    getCachedDimensions('ethnicity'),
    getCachedDimensions('education'),
    getCachedDimensions('income')
  ]);

  // For each geoId, fetch demographics filtered by universe AND demographics
  // NOTE: We only query for selected demographics to avoid unnecessary API calls
  // Unselected demographics are set to 0 without making API calls
  
  // Pre-calculate filter IDs for all categories
  const genderFilterIds = demographicIds?.genderIds ? demographicIds.genderIds.split(',') : [];
  const ageFilterIds = demographicIds?.ageRangeIds ? demographicIds.ageRangeIds.split(',') : [];
  const ethnicityFilterIds = demographicIds?.ethnicityIds ? demographicIds.ethnicityIds.split(',') : [];
  const educationFilterIds = demographicIds?.educationIds ? demographicIds.educationIds.split(',') : [];
  const incomeFilterIds = demographicIds?.incomeIds ? demographicIds.incomeIds.split(',') : [];
  
  for (const geoId of geoIds) {
    // Get gender counts - if gender filter exists, only query for selected genders, others will be 0
    
    for (const genderDim of genderDims) {
      if (!genderDim.name) continue;
      
      // If gender filter exists and this gender is not in the filter, set count to 0 WITHOUT API call
      if (genderFilterIds.length > 0 && !genderFilterIds.includes(genderDim.id.toString())) {
        demographics.gender[genderDim.name] = 0;
        continue; // Skip API call - we know it's 0
      }
      
      // Only make API call for selected genders (or all if no filter)
      const count = await apiService.getAudienceCount({
        geoId,
        genderIds: genderDim.id.toString(),
        ageRangeIds: demographicIds?.ageRangeIds || '',
        partyIds: demographicIds?.partyIds || '',
        ethnicityIds: demographicIds?.ethnicityIds || '',
        incomeIds: demographicIds?.incomeIds || '',
        educationIds: demographicIds?.educationIds || '',
        generalVoteHistoryIds: '',
        primaryVoteHistoryIds: '',
        universeList: universeList
      });
      demographics.gender[genderDim.name] = (demographics.gender[genderDim.name] || 0) + count.count;
    }

    // Get age counts - if age filter exists, only query for selected ages, others will be 0
    for (const ageDim of ageDims) {
      if (!ageDim.name) continue;
      
      // If age filter exists and this age is not in the filter, set count to 0 WITHOUT API call
      if (ageFilterIds.length > 0 && !ageFilterIds.includes(ageDim.id.toString())) {
        demographics.age[ageDim.name] = 0;
        continue; // Skip API call - we know it's 0
      }
      
      // Only make API call for selected ages (or all if no filter)
      const count = await apiService.getAudienceCount({
        geoId,
        ageRangeIds: ageDim.id.toString(),
        genderIds: demographicIds?.genderIds || '',
        partyIds: demographicIds?.partyIds || '',
        ethnicityIds: demographicIds?.ethnicityIds || '',
        incomeIds: demographicIds?.incomeIds || '',
        educationIds: demographicIds?.educationIds || '',
        generalVoteHistoryIds: '',
        primaryVoteHistoryIds: '',
        universeList: universeList
      });
      demographics.age[ageDim.name] = (demographics.age[ageDim.name] || 0) + count.count;
    }

    // Get ethnicity counts - if ethnicity filter exists, only query for selected ethnicities, others will be 0
    for (const ethnicityDim of ethnicityDims) {
      if (!ethnicityDim.name) continue;
      
      // If ethnicity filter exists and this ethnicity is not in the filter, set count to 0 WITHOUT API call
      if (ethnicityFilterIds.length > 0 && !ethnicityFilterIds.includes(ethnicityDim.id.toString())) {
        demographics.ethnicity[ethnicityDim.name] = 0;
        continue; // Skip API call - we know it's 0
      }
      
      // Only make API call for selected ethnicities (or all if no filter)
      const count = await apiService.getAudienceCount({
        geoId,
        ethnicityIds: ethnicityDim.id.toString(),
        genderIds: demographicIds?.genderIds || '',
        ageRangeIds: demographicIds?.ageRangeIds || '',
        partyIds: demographicIds?.partyIds || '',
        incomeIds: demographicIds?.incomeIds || '',
        educationIds: demographicIds?.educationIds || '',
        generalVoteHistoryIds: '',
        primaryVoteHistoryIds: '',
        universeList: universeList
      });
      demographics.ethnicity[ethnicityDim.name] = (demographics.ethnicity[ethnicityDim.name] || 0) + count.count;
    }

    // Get education counts - if education filter exists, only query for selected education levels, others will be 0
    for (const educationDim of educationDims) {
      if (!educationDim.name) continue;
      
      // If education filter exists and this education is not in the filter, set count to 0 WITHOUT API call
      if (educationFilterIds.length > 0 && !educationFilterIds.includes(educationDim.id.toString())) {
        demographics.education[educationDim.name] = 0;
        continue; // Skip API call - we know it's 0
      }
      
      // Only make API call for selected education levels (or all if no filter)
      const count = await apiService.getAudienceCount({
        geoId,
        educationIds: educationDim.id.toString(),
        genderIds: demographicIds?.genderIds || '',
        ageRangeIds: demographicIds?.ageRangeIds || '',
        partyIds: demographicIds?.partyIds || '',
        ethnicityIds: demographicIds?.ethnicityIds || '',
        incomeIds: demographicIds?.incomeIds || '',
        generalVoteHistoryIds: '',
        primaryVoteHistoryIds: '',
        universeList: universeList
      });
      demographics.education[educationDim.name] = (demographics.education[educationDim.name] || 0) + count.count;
    }

    // Get income counts - if income filter exists, only query for selected income levels, others will be 0
    for (const incomeDim of incomeDims) {
      if (!incomeDim.name) continue;
      
      // If income filter exists and this income is not in the filter, set count to 0 WITHOUT API call
      if (incomeFilterIds.length > 0 && !incomeFilterIds.includes(incomeDim.id.toString())) {
        demographics.income[incomeDim.name] = 0;
        continue; // Skip API call - we know it's 0
      }
      
      // Only make API call for selected income levels (or all if no filter)
      const count = await apiService.getAudienceCount({
        geoId,
        incomeIds: incomeDim.id.toString(),
        genderIds: demographicIds?.genderIds || '',
        ageRangeIds: demographicIds?.ageRangeIds || '',
        partyIds: demographicIds?.partyIds || '',
        ethnicityIds: demographicIds?.ethnicityIds || '',
        educationIds: demographicIds?.educationIds || '',
        generalVoteHistoryIds: '',
        primaryVoteHistoryIds: '',
        universeList: universeList
      });
      demographics.income[incomeDim.name] = (demographics.income[incomeDim.name] || 0) + count.count;
    }
  }

  // Calculate actual API calls made
  const apiCallsMade = 
    (genderFilterIds.length > 0 ? genderFilterIds.length : genderDims.length) +
    (ageFilterIds.length > 0 ? ageFilterIds.length : ageDims.length) +
    (ethnicityFilterIds.length > 0 ? ethnicityFilterIds.length : ethnicityDims.length) +
    (educationFilterIds.length > 0 ? educationFilterIds.length : educationDims.length) +
    (incomeFilterIds.length > 0 ? incomeFilterIds.length : incomeDims.length);
  
  console.log(`✅ Optimized demographics fetched (${apiCallsMade} API calls × ${geoIds.length} geoIds = ${apiCallsMade * geoIds.length} total calls)`);
  console.log(`📊 Gender breakdown:`, demographics.gender);
  console.log(`📊 Age breakdown:`, demographics.age);
  return demographics;
}

async function getFilteredBreakdownsFromApi(
  universeFields: string[],
  geographicFilters: { [key: string]: string[] },
  demographicFilters: { [key: string]: string[] },
  operator: string,
  requestedLevels: string[],
  combinedCounts: { [key: string]: number },
  geoCache: RequestGeoCache,
  preResolvedGeoIds?: number[]
): Promise<{
  demographics: any;
  geography: any;
  engagement: any;
  political: any;
  mediaConsumption: any;
}> {
  try {
    const states = geographicFilters.state || [];
    const counties = geographicFilters.county || [];
    const dmas = geographicFilters.dma || [];
    const congressional = geographicFilters.congressional || [];
    const stateSenateDistricts = geographicFilters.stateSenateDistrict || [];
    const stateHouseDistricts = geographicFilters.stateHouseDistrict || [];
    let geoId = 1;
    let geoIdsForDemographics: number[] = [];
    
    // Use pre-resolved geoIds if available to avoid redundant API calls
    if (preResolvedGeoIds && preResolvedGeoIds.length > 0) {
      console.log(`\n🚀 USING PRE-RESOLVED GEO IDS (avoiding redundant API calls):`);
      console.log(`   ${preResolvedGeoIds.length} geoIds:`, preResolvedGeoIds);
      geoIdsForDemographics = preResolvedGeoIds;
      geoId = preResolvedGeoIds[0];
    } else {
      // Determine most specific geographic level selected
      // Priority: County > Congressional > SSD > SHD > DMA > State
      console.log(`\n🔍 DEMOGRAPHICS GEO SELECTION:`);
      console.log(`   counties.length: ${counties.length}`);
      console.log(`   counties array:`, counties);
      console.log(`   states.length: ${states.length}`);
      
      if (counties.length > 0 && states.length > 0) {
        // Get county geoId - counties need state context
        console.log(`   📍 Fetching county view for state: ${states[0]}`);
        const countyView = await geoCache.getGeographicView({
          typeCode: 'CTY',
          geoCode: states[0],
          subGeoCode: ''
        });
      
      console.log(`   📍 County view returned ${countyView.length} counties`);
      
      // Collect all county geoIds
      const selectedCounties = countyView.filter(c => 
        counties.includes(c.subGeoCode || '') || counties.includes(c.geoCode || '')
      );
      
      console.log(`   📍 Filtered to ${selectedCounties.length} selected counties:`);
      selectedCounties.forEach(c => {
        console.log(`      - ${c.subGeoCode} (geoId: ${c.geoId})`);
      });
      
      geoIdsForDemographics.push(...selectedCounties.map(c => c.geoId));
      
      console.log(`   📍 geoIdsForDemographics now has ${geoIdsForDemographics.length} items:`, geoIdsForDemographics);
      
      if (counties.length === 1 && selectedCounties.length > 0) {
        geoId = selectedCounties[0].geoId;
        console.log(`   ✅ Single county path: geoId = ${geoId} (${counties[0]})`);
      } else {
        console.log(`   ✅ Multi-county path: ${counties.length} counties, ${selectedCounties.length} geoIds collected`);
        geoId = -4; // Flag for multi-county handling
      }
      } else if (congressional.length > 0) {
        // Handle congressional districts
        const cdView = await geoCache.getGeographicView({
          typeCode: 'CD',
          geoCode: states.length > 0 ? states[0] : '',
          subGeoCode: ''
        });
        
        // Collect all CD geoIds
        const selectedCds = cdView.filter(d => 
          congressional.includes(d.subGeoCode || '') || congressional.includes(d.geoCode || '')
        );
        geoIdsForDemographics.push(...selectedCds.map(d => d.geoId));
        
        if (congressional.length === 1 && selectedCds.length > 0) {
          geoId = selectedCds[0].geoId;
          console.log(`🎯 Using Congressional geoId for demographics: ${geoId} (${congressional[0]})`);
        } else {
          console.log(`🎯 ${congressional.length} Congressional districts selected, collected ${selectedCds.length} geoIds for demographics`);
          geoId = -1; // Flag for multi-district handling
        }
      } else if (stateSenateDistricts.length > 0) {
        // Handle state senate districts
        const ssdView = await geoCache.getGeographicView({
          typeCode: 'SSD',
          geoCode: states.length > 0 ? states[0] : '',
          subGeoCode: ''
        });
        
        // Collect all SSD geoIds
        const selectedSsds = ssdView.filter(d => 
          stateSenateDistricts.includes(d.subGeoCode || '') || stateSenateDistricts.includes(d.geoCode || '')
        );
        geoIdsForDemographics.push(...selectedSsds.map(d => d.geoId));
        
        if (stateSenateDistricts.length === 1 && selectedSsds.length > 0) {
          geoId = selectedSsds[0].geoId;
          console.log(`🎯 Using State Senate geoId for demographics: ${geoId} (${stateSenateDistricts[0]})`);
        } else {
          console.log(`🎯 ${stateSenateDistricts.length} State Senate districts selected, collected ${selectedSsds.length} geoIds for demographics`);
          geoId = -2; // Flag for multi-SSD handling
        }
      } else if (stateHouseDistricts.length > 0) {
        // Handle state house districts
        const shdView = await geoCache.getGeographicView({
          typeCode: 'SHD',
          geoCode: states.length > 0 ? states[0] : '',
          subGeoCode: ''
        });
        
        // Collect all SHD geoIds
        const selectedShds = shdView.filter(d => 
          stateHouseDistricts.includes(d.subGeoCode || '') || stateHouseDistricts.includes(d.geoCode || '')
        );
        geoIdsForDemographics.push(...selectedShds.map(d => d.geoId));
        
        if (stateHouseDistricts.length === 1 && selectedShds.length > 0) {
          geoId = selectedShds[0].geoId;
          console.log(`🎯 Using State House geoId for demographics: ${geoId} (${stateHouseDistricts[0]})`);
        } else {
          console.log(`🎯 ${stateHouseDistricts.length} State House districts selected, collected ${selectedShds.length} geoIds for demographics`);
          geoId = -3; // Flag for multi-SHD handling
        }
      } else if (dmas.length > 0) {
        // Handle DMAs
        const dmaView = await geoCache.getGeographicView({
          typeCode: 'STDMA',
          geoCode: states.length > 0 ? states[0] : '',
          subGeoCode: ''
        });
        
        // Collect all DMA geoIds
        const selectedDmas = dmaView.filter(d => 
          dmas.includes(d.subGeoCode || '') || dmas.includes(d.geoCode || '')
        );
        geoIdsForDemographics.push(...selectedDmas.map(d => d.geoId));
        
        if (dmas.length === 1 && selectedDmas.length > 0) {
          geoId = selectedDmas[0].geoId;
          console.log(`🎯 Using DMA geoId for demographics: ${geoId} (${dmas[0]})`);
        } else {
          console.log(`🎯 ${dmas.length} DMAs selected, collected ${selectedDmas.length} geoIds for demographics`);
          geoId = -5; // Flag for multi-DMA handling
        }
      } else if (states.length > 0) {
        // Handle states
        const stateView = await geoCache.getGeographicView({
          typeCode: 'ST',
          geoCode: states[0],
          subGeoCode: ''
        });
        
        if (stateView.length > 0) {
          geoIdsForDemographics.push(stateView[0].geoId);
          geoId = stateView[0].geoId;
          console.log(`🎯 Using state geoId for demographics: ${geoId} (${states[0]})`);
        }
      } else {
        // National fallback: resolve a valid National geoId
        const natView = await geoCache.getGeographicView({
          typeCode: 'NAT',
          geoCode: '',
          subGeoCode: ''
        });
        console.log('🌐 NAT Geo/view result size:', Array.isArray(natView) ? natView.length : 'non-array');
        if (Array.isArray(natView) && natView.length > 0) {
          console.log('🌐 NAT Geo/view first item sample:', JSON.stringify(natView[0], null, 2));
          geoIdsForDemographics.push(natView[0].geoId);
          geoId = natView[0].geoId;
          console.log(`🎯 Using NATIONAL geoId for demographics: ${geoId}`);
        } else {
          console.warn('⚠️ Unable to resolve NATIONAL geoId from Geo/view; demographics may be empty');
        }
      }
    }

    // Build universe list for filtering demographics
    const universeList = buildUniverseList(universeFields);
    
    // Convert demographic filters to dimension IDs
    const demographicIds = await convertDemographicFiltersToDimensionIds(demographicFilters);
    
    // Fetch filtered demographics using Audience/count endpoint
    // This ensures demographics match the filtered total count
    let demographics: any = {
      gender: {},
      age: {},
      ethnicity: {},
      education: {},
      income: {}
    };
    
    console.log(`\n🔍 DEMOGRAPHICS FETCH PREPARATION:`);
    console.log(`   geoIdsForDemographics.length: ${geoIdsForDemographics.length}`);
    console.log(`   geoIdsForDemographics: [${geoIdsForDemographics.join(', ')}]`);
    console.log(`   universeList: "${universeList}"`);
    console.log(`   demographicIds:`, demographicIds);
    console.log(`   demographicFilters:`, demographicFilters);
    console.log(`   geographicFilters:`, geographicFilters);
    console.log(`   Will use: ${geoIdsForDemographics.length > 0 ? 'geoIdsForDemographics array' : 'fallback single geoId'}\n`);
    
    if (geoIdsForDemographics.length > 0) {
      console.log(`🚀 Calling getFilteredDemographicsUsingAudienceCount with ${geoIdsForDemographics.length} geoIds...`);
      // Use the new function to get properly filtered demographics
      demographics = await getFilteredDemographicsUsingAudienceCount(
        geoIdsForDemographics,
        universeList,
        demographicIds,
        demographicFilters,
        geographicFilters
      );
      console.log(`✅ getFilteredDemographicsUsingAudienceCount completed`);
    } else if (geoId > 0) {
      console.log(`🚀 Calling getFilteredDemographicsUsingAudienceCount with single geoId: ${geoId}...`);
      // Fallback to single geoId
      demographics = await getFilteredDemographicsUsingAudienceCount(
        [geoId],
        universeList,
        demographicIds,
        demographicFilters,
        geographicFilters
      );
      console.log(`✅ getFilteredDemographicsUsingAudienceCount completed`);
    }

    let geography: any = {};
    
    // Determine if we should use SQL for geographic breakdowns
    // Use SQL when: county OR any district is selected (for geo breakdowns only, not demographics)
    const hasCountyOrDistrictSelection = counties.length > 0 || congressional.length > 0 || 
                                         stateSenateDistricts.length > 0 || stateHouseDistricts.length > 0;
    
    if (hasCountyOrDistrictSelection && requestedLevels.length > 0) {
      // Use SQL for ONLY geographic breakdowns when county/district is selected
      // Demographics still use API (already fetched above)
      console.log('🔄 Using SQL for GEOGRAPHIC BREAKDOWNS ONLY (county/district selected)');
      console.log('🔄 Requested levels:', requestedLevels);
      console.log('🔄 Demographics already fetched via API - NOT re-querying');
      
      try {
        const sqlBreakdowns = await sqlServerService.getGeographicBreakdownsOnly(
          geographicFilters,
          requestedLevels
        );
        
        geography = sqlBreakdowns.geography;
        console.log('✅ SQL geographic-only breakdowns fetched:', Object.keys(geography));
      } catch (error) {
        console.error('Error fetching geographic breakdowns via SQL:', error);
        // Initialize empty geography for requested levels
        requestedLevels.forEach(level => {
          geography[level] = {};
        });
      }
    } else if (requestedLevels.length > 0) {
      // Use API calls for state-only geographic breakdowns (fast path)
      console.log('🔄 Using API calls for geographic breakdowns (state-only - fast)');
      
      const validLevels = requestedLevels.filter(level => 
        level !== 'stateSenateDistrict' && level !== 'stateHouseDistrict' && level !== 'congressional'
      );
      
      if (validLevels.length > 0) {
        const geoViews = await Promise.all(
          validLevels.map(level => {
            const typeCode = getApiTypeCode(level);
            const selectedState = states.length > 0 ? states[0] : '';
            
            // Filter by selected state for all geographic levels when a state is selected
            if (selectedState && (level === 'state' || level === 'county' || level === 'dma')) {
              return geoCache.getGeographicView({ 
                typeCode,
                geoCode: selectedState,
                subGeoCode: ''
              });
            } else {
              return geoCache.getGeographicView({ 
                typeCode,
                geoCode: '',
                subGeoCode: ''
              });
            }
          })
        );

        validLevels.forEach((level, index) => {
          // Transform the full view data
          const fullGeography = transformGeographicView(geoViews[index], level);
          
          // Filter to only selected geographies if specific ones are selected
          let filteredGeography = fullGeography;
          
          if (level === 'state' && states.length > 0) {
            // Only show selected states
            filteredGeography = {};
            Object.entries(fullGeography).forEach(([key, value]) => {
              // Match by state code or full name
              const matchesSelection = states.some(s => 
                key === s || key.toLowerCase().includes(s.toLowerCase())
              );
              if (matchesSelection) {
                filteredGeography[key] = value;
              }
            });
          } else if (level === 'county' && counties.length > 0) {
            // Only show selected counties
            filteredGeography = {};
            Object.entries(fullGeography).forEach(([key, value]) => {
              if (counties.includes(key)) {
                filteredGeography[key] = value;
              }
            });
          } else if (level === 'dma' && dmas.length > 0) {
            // Only show selected DMAs
            filteredGeography = {};
            Object.entries(fullGeography).forEach(([key, value]) => {
              if (dmas.includes(key)) {
                filteredGeography[key] = value;
              }
            });
          }
          
          geography[level] = filteredGeography;
          console.log(`🗺️  ${level} breakdown: ${Object.keys(filteredGeography).length} items`);
        });
      }
    }

    const engagement = {
      high: 0,
      medium: 0,
      low: 0
    };

    const political = {
      democrat: 0,
      republican: 0,
      independent: 0
    };

    const mediaConsumption = {
      socialmediaheavyuser: 0,
      socialmediauserfacebook: 0,
      socialmediauserinstagram: 0,
      socialmediauserx: 0,
      socialmediauseryoutube: 0
    };

    return {
      demographics,
      geography,
      engagement,
      political,
      mediaConsumption
    };
  } catch (error) {
    console.error('Error fetching filtered breakdowns:', error);
    throw error;
  }
}
