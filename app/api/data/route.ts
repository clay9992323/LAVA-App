import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '1000');
    
    const filters = extractFiltersFromParams(searchParams);
    
    console.log(`Data API called (page: ${page}, pageSize: ${pageSize}) - Not available in API mode`);
    
    return NextResponse.json({
      data: [],
      totalCount: 0,
      page: page,
      pageSize: pageSize,
      totalPages: 0,
      source: 'api',
      filters: filters,
      timestamp: new Date().toISOString(),
      message: 'Paginated data endpoint not available in API mode. Use audience count and geographic view endpoints instead.'
    });

  } catch (error) {
    console.error('Error loading data from API:', error);
    
    return NextResponse.json({ 
      error: `Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
}

function extractFiltersFromParams(searchParams: URLSearchParams) {
  const filters: any[] = [];
  
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith('filter_')) {
      const field = key.replace('filter_', '');
      try {
        const filterData = JSON.parse(value);
        filters.push({
          field,
          operator: filterData.operator,
          value: filterData.value
        });
      } catch (e) {
        // Ignore invalid JSON
      }
    }
  }
  
  return filters;
}
