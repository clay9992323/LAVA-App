import { NextRequest, NextResponse } from 'next/server';
import { apiService } from '@/lib/apiService';
import { sqlServerService } from '@/lib/sqlServerService';
import { getApiTypeCode, transformGeographicView } from '@/lib/dataTransformers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { selectedStates, selectedCounties, universeFields, operator, demographicFilters } = body;

    console.log('\n========================================');
    console.log('🗺️  GEOGRAPHIC OPTIONS API CALLED');
    console.log('========================================');
    console.log('📥 Request Parameters:');
    console.log('   Selected States:', selectedStates);
    console.log('   Selected Counties:', selectedCounties);
    console.log('   Universe Fields:', universeFields);
    console.log('   Operator:', operator);
    console.log('   Demographic Filters:', demographicFilters);
    console.log('========================================\n');

    // Check if demographic filters have actual values (not just empty objects)
    const hasDemographicFilters = demographicFilters && Object.values(demographicFilters).some((values: any) => Array.isArray(values) && values.length > 0);
    
    console.log('🔍 Demographic filter check:', {
      hasDemographicFilters,
      demographicFilters: hasDemographicFilters ? demographicFilters : 'none'
    });
    
    let geographicOptions;
    
    if (hasDemographicFilters) {
      console.log('✅ Using SQL queries (demographic filters active)');
      geographicOptions = await getGeographicOptionsFromSql(
        selectedStates || [],
        selectedCounties || [],
        demographicFilters
      );
    } else {
      console.log('✅ Using API service (no demographic filters - faster)');
      geographicOptions = await getGeographicOptionsFromApi(
        selectedStates || [],
        selectedCounties || []
      );
    }

    console.log('\n========================================');
    console.log('✅ GEOGRAPHIC OPTIONS API RESPONSE');
    console.log('========================================');
    console.log('📤 States Available:', Object.keys(geographicOptions.states).length);
    console.log('📤 Counties Available:', Object.keys(geographicOptions.counties).length);
    console.log('📤 DMAs Available:', Object.keys(geographicOptions.dmas).length);
    console.log('📤 Congressional Districts Available:', Object.keys(geographicOptions.congressionalDistricts).length);
    console.log('📤 State Senate Districts Available:', Object.keys(geographicOptions.stateSenateDistricts).length);
    console.log('📤 State House Districts Available:', Object.keys(geographicOptions.stateHouseDistricts).length);
    console.log('========================================\n');
    
    return NextResponse.json({
      success: true,
      geographicOptions,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Geographic options API error:', error);
    return NextResponse.json({
      success: false,
      error: `Failed to get geographic options: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

async function getGeographicOptionsFromSql(
  selectedStates: string[],
  selectedCounties: string[],
  demographicFilters: { [key: string]: string[] }
): Promise<{
  states: { [key: string]: number };
  counties: { [key: string]: number };
  dmas: { [key: string]: number };
  congressionalDistricts: { [key: string]: number };
  stateSenateDistricts: { [key: string]: number };
  stateHouseDistricts: { [key: string]: number };
}> {
  try {
    console.log('🔍 Fetching geographic options from SQL with demographic filters');
    
    // Build geographic filters
    const geographicFilters: { [key: string]: string[] } = {};
    if (selectedStates.length > 0) {
      geographicFilters.state = selectedStates;
    }
    if (selectedCounties.length > 0) {
      geographicFilters.county = selectedCounties;
    }
    
    // Determine which levels to request based on selections
    let requestedLevels = ['state', 'county', 'dma', 'congressional', 'stateSenateDistrict', 'stateHouseDistrict'];
    
    // Call getFilteredBreakdowns which already supports demographic filters
    const result = await sqlServerService.getFilteredBreakdowns(
      [], // No universe filters
      geographicFilters,
      'AND',
      requestedLevels,
      demographicFilters
    );
    
    console.log('📊 SQL geographic breakdown result:', {
      state: Object.keys(result.geography?.state || {}).length,
      county: Object.keys(result.geography?.county || {}).length,
      dma: Object.keys(result.geography?.dma || {}).length,
      congressional: Object.keys(result.geography?.congressional || {}).length,
    });
    
    return {
      states: result.geography?.state || {},
      counties: result.geography?.county || {},
      dmas: result.geography?.dma || {},
      congressionalDistricts: result.geography?.congressional || {},
      stateSenateDistricts: result.geography?.stateSenateDistrict || {},
      stateHouseDistricts: result.geography?.stateHouseDistrict || {}
    };
  } catch (error) {
    console.error('Error fetching geographic options from SQL:', error);
    throw error;
  }
}

async function getGeographicOptionsFromApi(
  selectedStates: string[],
  selectedCounties: string[]
): Promise<{
  states: { [key: string]: number };
  counties: { [key: string]: number };
  dmas: { [key: string]: number };
  congressionalDistricts: { [key: string]: number };
  stateSenateDistricts: { [key: string]: number };
  stateHouseDistricts: { [key: string]: number };
}> {
  try {
    const requests: Promise<any>[] = [];

    // Get all states with proper API format
    requests.push(apiService.getGeographicView({ 
      typeCode: 'ST',
      geoCode: '',
      subGeoCode: ''
    }));

    // Get counties (CTY = County)
    if (selectedStates.length > 0) {
      requests.push(
        apiService.getGeographicView({
          typeCode: 'CTY',
          geoCode: selectedStates[0],
          subGeoCode: ''
        })
      );
    } else {
      requests.push(apiService.getGeographicView({ 
        typeCode: 'CTY',
        geoCode: '',
        subGeoCode: ''
      }));
    }

    // Get DMAs
    if (selectedStates.length > 0) {
      requests.push(
        apiService.getGeographicView({
          typeCode: 'STDMA',
          geoCode: selectedStates[0],
          subGeoCode: ''
        })
      );
    } else {
      requests.push(apiService.getGeographicView({ 
        typeCode: 'STDMA',
        geoCode: '',
        subGeoCode: ''
      }));
    }

    // Get Congressional Districts (CD)
    if (selectedStates.length > 0) {
      requests.push(
        apiService.getGeographicView({
          typeCode: 'CD',
          geoCode: selectedStates[0],
          subGeoCode: ''
        })
      );
    } else {
      requests.push(apiService.getGeographicView({ 
        typeCode: 'CD',
        geoCode: '',
        subGeoCode: ''
      }));
    }

    // Get State Senate Districts (SSD)
    if (selectedStates.length > 0) {
      requests.push(
        apiService.getGeographicView({
          typeCode: 'SSD',
          geoCode: selectedStates[0],
          subGeoCode: ''
        })
      );
    } else {
      requests.push(apiService.getGeographicView({ 
        typeCode: 'SSD',
        geoCode: '',
        subGeoCode: ''
      }));
    }

    // Get State House Districts (SHD)
    if (selectedStates.length > 0) {
      requests.push(
        apiService.getGeographicView({
          typeCode: 'SHD',
          geoCode: selectedStates[0],
          subGeoCode: ''
        })
      );
    } else {
      requests.push(apiService.getGeographicView({ 
        typeCode: 'SHD',
        geoCode: '',
        subGeoCode: ''
      }));
    }

    const [statesView, countiesView, dmasView, congressionalView, stateSenateView, stateHouseView] = await Promise.all(requests);

    const states = transformGeographicView(statesView, 'state');
    const counties = transformGeographicView(countiesView, 'county');
    const dmas = transformGeographicView(dmasView, 'dma');
    const congressionalDistricts = transformGeographicView(congressionalView, 'congressional');
    const stateSenateDistricts = transformGeographicView(stateSenateView, 'stateSenateDistrict');
    const stateHouseDistricts = transformGeographicView(stateHouseView, 'stateHouseDistrict');

    return {
      states,
      counties,
      dmas,
      congressionalDistricts,
      stateSenateDistricts,
      stateHouseDistricts
    };
  } catch (error) {
    console.error('Error fetching geographic options:', error);
    throw error;
  }
}
