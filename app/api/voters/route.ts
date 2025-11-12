 import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '1000');
    
    const filters = extractFiltersFromParams(searchParams);
    
    if (page < 1) {
      return NextResponse.json({ error: 'Page must be greater than 0' }, { status: 400 });
    }
    
    if (pageSize < 1 || pageSize > 10000) {
      return NextResponse.json({ error: 'Page size must be between 1 and 10,000' }, { status: 400 });
    }

    console.log(`Voters API called (page: ${page}, pageSize: ${pageSize}) - Not available in API mode`);
    
    return NextResponse.json({
      success: true,
      data: [],
      totalCount: 0,
      page: page,
      pageSize: pageSize,
      totalPages: 0,
      filters: filters,
      timestamp: new Date().toISOString(),
      message: 'Individual voter data endpoint not available in API mode. Use audience count endpoints for aggregated data.'
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch voter data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

function extractFiltersFromParams(searchParams: URLSearchParams) {
  const filters: any[] = [];
  
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith('filter_')) {
      const parts = key.split('_');
      if (parts.length >= 3) {
        const field = parts[1];
        const operator = parts[2];
        
        filters.push({
          field,
          operator,
          value: parseFilterValue(value, operator)
        });
      }
    }
  }
  
  return filters;
}

function parseFilterValue(value: string, operator: string): any {
  switch (operator) {
    case 'in':
    case 'not_in':
      return value.split(',').map(v => v.trim());
    case 'between':
      const [min, max] = value.split(',').map(v => parseFloat(v.trim()));
      return { min, max };
    case 'greater_than':
    case 'less_than':
      return parseFloat(value);
    default:
      return value;
  }
}
