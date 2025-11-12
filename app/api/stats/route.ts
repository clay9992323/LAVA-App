import { NextRequest, NextResponse } from 'next/server';
import { apiService } from '@/lib/apiService';
import { DimensionType } from '@/types/api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedFields = searchParams.get('fields')?.split(',');
    const includeUniqueValues = searchParams.get('includeUniqueValues') === 'true';
    const includeStats = searchParams.get('includeStats') === 'true';
    
    const fieldToDimensionMap: { [key: string]: DimensionType | string } = {
      'Gender': DimensionType.GENDER,
      'AgeRange': DimensionType.AGE_RANGE,
      'Party': DimensionType.PARTY,
      'Ethnicity': DimensionType.ETHNICITY,
      'Education': DimensionType.EDUCATION,
      'Income': DimensionType.INCOME,
      'State': 'state',
      'County': 'county'
    };
    
    const fields = requestedFields || [
      'Gender',
      'AgeRange', 
      'Party',
      'Ethnicity',
      'Education',
      'Income',
      'State',
      'County'
    ];

    const shouldIncludeUniqueValues = includeUniqueValues !== false;
    const shouldIncludeStats = includeStats !== false;

    const statsPromises = fields.map(async (field) => {
      const result: any = { field };
      
      if (shouldIncludeUniqueValues) {
        const dimType = fieldToDimensionMap[field];
        
        if (dimType && dimType !== 'state' && dimType !== 'county') {
          const items = await apiService.getDimensions(dimType as DimensionType);
          result.uniqueValues = items.map(item => item.name || '').filter(Boolean);
        } else if (dimType === 'state' || dimType === 'county') {
          const typeCode = dimType === 'state' ? 'ST' : 'CTY';
          const geoView = await apiService.getGeographicView({ 
            typeCode,
            geoCode: '',
            subGeoCode: ''
          });
          result.uniqueValues = geoView.map(view => view.description || view.geoCode || '').filter(Boolean);
        } else {
          result.uniqueValues = [];
        }
      }
      
      if (shouldIncludeStats) {
        result.stats = {
          min: 0,
          max: 0,
          unique: result.uniqueValues?.length || 0,
          nullCount: 0
        };
      }

      return result;
    });

    const fieldStats = await Promise.all(statsPromises);

    let totalRecords = null;
    if (searchParams.get('includeTotalCount') === 'true') {
      const stateView = await apiService.getGeographicView({ 
        typeCode: 'ST',
        geoCode: '',
        subGeoCode: ''
      });
      totalRecords = stateView.reduce((sum, view) => sum + view.count, 0);
    }

    const response: any = {
      success: true,
      fieldStats,
      timestamp: new Date().toISOString(),
    };

    if (totalRecords !== null) {
      response.totalRecords = totalRecords;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Stats API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
