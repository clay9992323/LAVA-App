import {
  GeoCountView,
  GeoDemographicsResponse,
  DimensionItem,
  DimUniverseItem,
  GeoTypeCode
} from '@/types/api';

// Geographic type code mapping (app level to API typeCode)
export const GEO_TYPE_MAPPING: { [key: string]: string } = {
  'national': 'NAT',
  'state': 'ST',
  'county': 'CTY',
  'congressional': 'CD',
  'dma': 'STDMA',
  'zipCode': 'ZIP',
  'stateSenateDistrict': 'SSD',
  'stateHouseDistrict': 'SHD'
};

// Reverse mapping (API typeCode to app level)
export const REVERSE_GEO_TYPE_MAPPING: { [key: string]: string } = {
  'NAT': 'national',
  'ST': 'state',
  'CTY': 'county',
  'CD': 'congressional',
  'STDMA': 'dma',
  'ZIP': 'zipCode',
  'SSD': 'stateSenateDistrict',
  'SHD': 'stateHouseDistrict'
};

// Universe field name mapping (app field names to API universe codes)
export const UNIVERSE_FIELD_MAPPING: { [key: string]: string } = {
  'engagement_high': 'engagement_high',
  'engagement_mid': 'engagement_mid',
  'engagement_low': 'engagement_low',
  'engagementcontact': 'engagementcontact',
  'engagementcurrentevents': 'engagementcurrentevents',
  'ideologyfiscalcons': 'ideologyfiscalcons',
  'ideologyfiscalprog': 'ideologyfiscalprog',
  'likelytogivepii': 'likelytogivepii',
  'likelyvotersdemocrat': 'likelyvotersdemocrat',
  'likelyvotersrepublican': 'likelyvotersrepublican',
  'persuasion': 'persuasion',
  'socialmediaheavyuser': 'socialmediaheavyuser',
  'socialmediauserfacebook': 'socialmediauserfacebook',
  'socialmediauserinstagram': 'socialmediauserinstagram',
  'socialmediauserx': 'socialmediauserx',
  'socialmediauseryoutube': 'socialmediauseryoutube',
  'taxstadiumsupport': 'taxstadiumsupport',
  'turnouthigh': 'turnouthigh'
};

// Transform GeoCountView array to geographic breakdown format
export function transformGeographicView(
  views: GeoCountView[],
  level: string
): { [key: string]: number } {
  const result: { [key: string]: number } = {};
  const LOG_LIMIT = 5;
  let loggedEntries = 0;
  let hasLoggedOmissionNotice = false;
  
  console.log(`🔄 Transforming ${views.length} items for level: ${level}`);
  if (level === 'congressional' && views.length > 0) {
    console.log('🔍 RAW Congressional view sample:', JSON.stringify(views[0], null, 2));
  }
  
  views.forEach(view => {
    // For all geographic levels (including DMA), use subGeoCode as the primary key
    const key = view.subGeoCode || view.geoCode || view.description;
    
    if (key) {
      result[key] = view.count;
      if (loggedEntries < LOG_LIMIT) {
        console.log(`  ✅ Added ${level}: ${key} (count: ${view.count})`);
        loggedEntries++;
        if (
          loggedEntries === LOG_LIMIT &&
          views.length > LOG_LIMIT &&
          !hasLoggedOmissionNotice
        ) {
          console.log(
            `  ... ${views.length - LOG_LIMIT} additional ${level} entries omitted from debug output`
          );
          hasLoggedOmissionNotice = true;
        }
      }
    } else {
      if (loggedEntries < LOG_LIMIT) {
        console.log(`  ⚠️ Skipping view - no key found:`, JSON.stringify(view));
        loggedEntries++;
        if (
          loggedEntries === LOG_LIMIT &&
          views.length > LOG_LIMIT &&
          !hasLoggedOmissionNotice
        ) {
          console.log(
            `  ... ${views.length - LOG_LIMIT} additional ${level} entries omitted from debug output`
          );
          hasLoggedOmissionNotice = true;
        }
      }
    }
  });
  
  console.log(`📊 Transform complete: ${Object.keys(result).length} ${level} items`);
  return result;
}

// Transform demographic API response to app format
export function transformDemographicBreakdown(
  apiResponse: GeoDemographicsResponse
): {
  gender: { [key: string]: number };
  age: { [key: string]: number };
  ethnicity: { [key: string]: number };
  education: { [key: string]: number };
  income: { [key: string]: number };
} {
  const demographics = apiResponse.demographics || {};
  
  const result = {
    gender: {} as { [key: string]: number },
    age: {} as { [key: string]: number },
    ethnicity: {} as { [key: string]: number },
    education: {} as { [key: string]: number },
    income: {} as { [key: string]: number }
  };

  // Transform each demographic category
  Object.entries(demographics).forEach(([category, values]) => {
    const categoryLower = category.toLowerCase();
    
    if (values && Array.isArray(values)) {
      values.forEach(item => {
        if (item.value) {
          if (categoryLower.includes('gender')) {
            result.gender[item.value] = item.count;
          } else if (categoryLower.includes('age')) {
            result.age[item.value] = item.count;
          } else if (categoryLower.includes('ethnic')) {
            result.ethnicity[item.value] = item.count;
          } else if (categoryLower.includes('education')) {
            result.education[item.value] = item.count;
          } else if (categoryLower.includes('income')) {
            result.income[item.value] = item.count;
          }
        }
      });
    }
  });

  return result;
}

// Transform dimension items to simple name-count map
export function transformDimensionItems(
  items: DimensionItem[]
): { [key: string]: number } {
  const result: { [key: string]: number } = {};
  
  items.forEach(item => {
    if (item.name) {
      // We don't have counts from dimension endpoint, so set to 0
      // These will be populated by separate count queries
      result[item.name] = 0;
    }
  });
  
  return result;
}

// Build universe list string from field names
export function buildUniverseList(universeFields: string[]): string {
  const mappedFields = universeFields
    .map(field => UNIVERSE_FIELD_MAPPING[field] || field)
    .filter(Boolean);
  
  return mappedFields.join(',');
}

// Parse universe list back to field names
export function parseUniverseList(universeList: string): string[] {
  if (!universeList) return [];
  
  return universeList.split(',').map(code => code.trim()).filter(Boolean);
}

// Helper to get app-level geographic type from API typeCode
export function getAppGeoLevel(typeCode: string | null): string {
  if (!typeCode) return 'state';
  return REVERSE_GEO_TYPE_MAPPING[typeCode.toUpperCase()] || 'state';
}

// Helper to get API typeCode from app-level geographic type
export function getApiTypeCode(appLevel: string): string {
  return GEO_TYPE_MAPPING[appLevel] || 'ST';
}

// Create dimension ID lookup from dimension items
export function createDimensionLookup(
  items: DimensionItem[]
): {
  byName: Map<string, number>;
  byId: Map<number, string>;
} {
  const byName = new Map<string, number>();
  const byId = new Map<number, string>();
  
  items.forEach(item => {
    if (item.name) {
      byName.set(item.name, item.id);
      byId.set(item.id, item.name);
    }
  });
  
  return { byName, byId };
}

// Convert array of names to comma-separated IDs
export function namesToIds(
  names: string[],
  lookup: Map<string, number>
): string {
  const ids = names
    .map(name => lookup.get(name))
    .filter(id => id !== undefined);
  
  return ids.join(',');
}

// Convert comma-separated IDs to array of names
export function idsToNames(
  idsString: string | null | undefined,
  lookup: Map<number, string>
): string[] {
  if (!idsString) return [];
  
  return idsString
    .split(',')
    .map(id => {
      const numId = parseInt(id.trim());
      return lookup.get(numId);
    })
    .filter(name => name !== undefined) as string[];
}

// Transform universe items for app usage
export function transformUniverseItems(
  items: DimUniverseItem[]
): {
  byCode: Map<string, DimUniverseItem>;
  byName: Map<string, DimUniverseItem>;
} {
  const byCode = new Map<string, DimUniverseItem>();
  const byName = new Map<string, DimUniverseItem>();
  
  items.forEach(item => {
    if (item.code) {
      byCode.set(item.code, item);
    }
    if (item.name) {
      byName.set(item.name, item);
    }
  });
  
  return { byCode, byName };
}

// Cache for dimension lookups (to avoid repeated API calls)
class DimensionCache {
  private static instance: DimensionCache;
  private cache: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): DimensionCache {
    if (!DimensionCache.instance) {
      DimensionCache.instance = new DimensionCache();
    }
    return DimensionCache.instance;
  }

  set(key: string, value: any): void {
    this.cache.set(key, value);
  }

  get(key: string): any {
    return this.cache.get(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const dimensionCache = DimensionCache.getInstance();



