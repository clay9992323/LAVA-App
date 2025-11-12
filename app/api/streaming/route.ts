import { NextRequest, NextResponse } from 'next/server';
import { apiService } from '@/lib/apiService';
import { getCachedStats, setCachedStats, getCacheInfo } from '@/lib/statsCache';
import {
  transformGeographicView,
  transformDimensionItems,
  getApiTypeCode
} from '@/lib/dataTransformers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';
    const limit = parseInt(searchParams.get('limit') || '1000');
    const forceRefresh = searchParams.get('refresh') === 'true';
    
    // Parse filters from query parameters
    const demographicFilters = searchParams.get('demographics');
    const geographicFilters = searchParams.get('geography');

    console.log(`Streaming API called with action: ${action}`);

    if (action === 'stats') {
      try {
        // If filters are present, skip cache and query API
        if (demographicFilters || geographicFilters) {
          console.log('Filtered stats requested - querying API (no cache)');
          const stats = await getAudienceStatsFromApi();
          
          return NextResponse.json({
            success: true,
            data: stats,
            type: 'filtered_stats',
            cached: false,
            source: 'api'
          });
        }

        // Try to get from cache first (unless force refresh)
        if (!forceRefresh) {
          const cachedStats = getCachedStats();
          
          if (cachedStats) {
            const cacheInfo = getCacheInfo();
            const ageMinutes = cacheInfo?.age ? Math.round(cacheInfo.age / 1000 / 60) : 0;
            
            console.log(`📦 Returning cached stats - ${ageMinutes}min old, ${cachedStats.totalCount?.toLocaleString()} records`);
            
            return NextResponse.json({
              success: true,
              data: cachedStats,
              type: 'stats',
              cached: true,
              cacheAge: ageMinutes,
              cacheInfo: {
                ageMinutes,
                recordCount: cachedStats.totalCount
              },
              source: 'cache'
            });
          }
        }

        // No cache or force refresh - query API
        console.log(forceRefresh ? '🔄 Force refresh requested - querying API' : '📊 No cache found - querying API');
        const startTime = Date.now();
        
        const stats = await getAudienceStatsFromApi();
        
        const queryTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`📊 API query completed in ${queryTime}s`);
        
        // Save to cache for next time
        setCachedStats(stats);
        
        return NextResponse.json({
          success: true,
          data: stats,
          type: 'stats',
          cached: false,
          queryTime: parseFloat(queryTime),
          source: 'api'
        });
      } catch (apiError) {
        console.error('API failed for stats:', apiError);
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch statistics from API'
        }, { status: 500 });
      }
      
    } else if (action === 'sample') {
      console.log('Sample data not supported in API mode');
      
      // Sample data endpoint not available in the API
      // Return empty sample or error
      return NextResponse.json({
        success: true,
        data: [],
        type: 'sample',
        count: 0,
        source: 'api',
        message: 'Sample data endpoint not available in API mode'
      });
      
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Use "stats" or "sample"'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in streaming API:', error);
    
    return NextResponse.json({
      success: false,
      error: `Streaming API error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}

// Helper function to aggregate stats from multiple API calls
async function getAudienceStatsFromApi() {
  try {
    // Get all required data in parallel
    const [
      allDimensions,
      universeItems,
      geoTypes,
      stateView,
      countyView,
      dmaView
    ] = await Promise.all([
      apiService.getAllDimensions(),
      apiService.getUniverseOptions(),
      apiService.getGeoTypes(),
      apiService.getGeographicView({ typeCode: 'ST', geoCode: '', subGeoCode: '' }),
      apiService.getGeographicView({ typeCode: 'CTY', geoCode: '', subGeoCode: '' }),
      apiService.getGeographicView({ typeCode: 'STDMA', geoCode: '', subGeoCode: '' })
    ]);

    // Calculate total count from state view (sum of all states)
    const totalCount = stateView.reduce((sum, view) => sum + view.count, 0);

    // Transform dimensions to the format expected by the app
    const demographics = {
      gender: transformDimensionItems(allDimensions.gender),
      age: transformDimensionItems(allDimensions.ageRange),
      ethnicity: transformDimensionItems(allDimensions.ethnicity),
      education: transformDimensionItems(allDimensions.education),
      income: transformDimensionItems(allDimensions.income)
    };

    // Transform geographic views
    const geography = {
      state: transformGeographicView(stateView, 'state'),
      county: transformGeographicView(countyView, 'county'),
      dma: transformGeographicView(dmaView, 'dma'),
      zipCode: {}, // Not available from basic API calls
      stateSenateDistrict: {}, // Not available
      stateHouseDistrict: {} // Not available
    };

    // Transform party data
    const partyBreakdown = transformDimensionItems(allDimensions.party);

    // Note: Engagement, political affiliation, media consumption, and universe stats
    // would require geographic-specific queries with the API
    // For initial load, we'll provide empty structures
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

    // Create universe breakdown from universe items
    const universe: { [key: string]: number } = {};
    universeItems.forEach(item => {
      if (item.code) {
        universe[item.code] = 0; // Counts would need to be fetched separately
      }
    });

    return {
      totalCount,
      demographics,
      geography,
      partyBreakdown,
      engagement,
      political,
      mediaConsumption,
      universe
    };
  } catch (error) {
    console.error('Error aggregating stats from API:', error);
    throw error;
  }
}
