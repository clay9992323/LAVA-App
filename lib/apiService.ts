import {
  GetAudienceCountRequest,
  AudienceCountResponse,
  GeoCountViewRequest,
  GeoCountView,
  GeoDemographicsResponse,
  DimensionItem,
  DimUniverseItem,
  Geo,
  GeoType,
  GeoTypeItem,
  ApiConfig,
  DimensionType
} from '@/types/api';

// Helper to clean quotes from environment variables
function cleanEnvVar(value: string | undefined): string | undefined {
  if (!value) return value;
  // Remove surrounding quotes if present
  return value.replace(/^["'](.*)["']$/, '$1');
}

// Logging configuration - enable verbose logging in development only
const ENABLE_VERBOSE_LOGGING = process.env.NODE_ENV === 'development' || process.env.ENABLE_API_LOGGING === 'true';
const ENABLE_DETAILED_LOGGING = process.env.NODE_ENV === 'development' && process.env.ENABLE_DETAILED_API_LOGGING === 'true';

// API Configuration
const API_CONFIG: ApiConfig = {
  baseUrl: cleanEnvVar(process.env.API_BASE_URL) || cleanEnvVar(process.env.NEXT_PUBLIC_API_BASE_URL) || 'https://causewayappsapi-f9c7fmb8e5emhzbg.southcentralus-01.azurewebsites.net',
  apiKey: cleanEnvVar(process.env.API_KEY) || cleanEnvVar(process.env.NEXT_PUBLIC_API_KEY) || '7i$6OdzDBQVIXJ2!',
  timeout: 120000
};

// Utility function for logging API requests (only in development or when enabled)
function logRequest(method: string, url: string, body?: any): void {
  if (!ENABLE_VERBOSE_LOGGING) return;
  
  const timestamp = new Date().toISOString();
  console.log(`📡 API REQUEST: ${method} ${url}`);
  if (ENABLE_DETAILED_LOGGING && body) {
    console.log('Request Body:', JSON.stringify(body, null, 2));
  } else if (body) {
    console.log('Request Body:', typeof body === 'object' ? Object.keys(body).join(', ') : 'present');
  }
  console.log(`🕐 Started at: ${timestamp}`);
}

// Utility function for logging request time (only in development or when enabled)
function logRequestTime(startTime: number, method: string, url: string): void {
  if (!ENABLE_VERBOSE_LOGGING) return;
  
  const duration = Date.now() - startTime;
  const durationInSeconds = (duration / 1000).toFixed(2);
  console.log(`⏱️  ${method} ${url} completed in ${durationInSeconds}s`);
}

class ApiService {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(config: ApiConfig = API_CONFIG) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 60000;
  }

  // Generic HTTP request method
  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: any;
      queryParams?: Record<string, string>;
      timeout?: number;
    }
  ): Promise<T> {
    const startTime = Date.now();
    
    // Build URL with query parameters
    let url = `${this.baseUrl}${path}`;
    if (options?.queryParams) {
      const params = new URLSearchParams(options.queryParams);
      url += `?${params.toString()}`;
    }

    logRequest(method, url, options?.body);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout || this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      logRequestTime(startTime, method, url);
      
      // Log API responses only in detailed logging mode (development with flag)
      if (ENABLE_DETAILED_LOGGING) {
        console.log('📥 API RESPONSE:', path, `Status: ${response.status}`);
        if (Array.isArray(data)) {
          console.log(`Response Type: Array with ${data.length} items`);
          if (data.length > 0) {
            // Only log keys/type info, not full JSON
            console.log('First item keys:', Object.keys(data[0] || {}).slice(0, 10).join(', '));
          }
        } else if (typeof data === 'object' && data !== null) {
          console.log('Response Type: Object');
          console.log('Response keys:', Object.keys(data).slice(0, 15).join(', '));
        }
      }
      
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`API request timeout after ${this.timeout}ms`);
      }
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Verify API key
  async verifyApiKey(): Promise<boolean> {
    try {
      await this.request('GET', '/api/apikeyverification/verify');
      return true;
    } catch (error) {
      console.error('API key verification failed:', error);
      return false;
    }
  }

  // Get audience count by filters
  async getAudienceCount(request: GetAudienceCountRequest): Promise<AudienceCountResponse> {
    return this.request<AudienceCountResponse>('POST', '/api/Audience/count', {
      body: request
    });
  }

  // Get dimension items by type
  async getDimensions(dimType: DimensionType | string): Promise<DimensionItem[]> {
    return this.request<DimensionItem[]>('GET', `/api/Dim/${dimType}`);
  }

  // Get all available universes
  async getUniverseOptions(): Promise<DimUniverseItem[]> {
    return this.request<DimUniverseItem[]>('GET', '/api/Dim/universe');
  }

  // Get all geographies
  async getGeographies(): Promise<Geo[]> {
    return this.request<Geo[]>('GET', '/api/Geo');
  }

  // Get geography by ID
  async getGeographyById(id: number): Promise<Geo> {
    return this.request<Geo>('GET', `/api/Geo/${id}`);
  }

  // Get geographies by type
  async getGeographiesByType(geoTypeId: number): Promise<Geo[]> {
    return this.request<Geo[]>('GET', `/api/Geo/geotype/${geoTypeId}`);
  }

  // Get geographies by geoCode
  async getGeographiesByCode(geoCode: string): Promise<Geo[]> {
    return this.request<Geo[]>('GET', `/api/Geo/geocode/${geoCode}`);
  }

  // Get geographic view with counts
  async getGeographicView(request: GeoCountViewRequest): Promise<GeoCountView[]> {
    const response = await this.request<any>('POST', '/api/Geo/view', {
      body: request
    });
    
    // Unwrap OData-style response if needed
    if (response && typeof response === 'object' && 'value' in response && Array.isArray(response.value)) {
      return response.value as GeoCountView[];
    }
    
    // Return as-is if already an array
    return response as GeoCountView[];
  }

  // Get all geo types
  async getGeoTypes(): Promise<GeoType[]> {
    return this.request<GeoType[]>('GET', '/api/GeoTypes');
  }

  // Get geo type by ID
  async getGeoTypeById(id: number): Promise<GeoType> {
    return this.request<GeoType>('GET', `/api/GeoTypes/${id}`);
  }

  // Get geo type by code
  async getGeoTypeByCode(code: string): Promise<GeoType> {
    return this.request<GeoType>('GET', `/api/GeoTypes/code/${code}`);
  }

  // List geo types by codes
  async listGeoTypesByCodes(typeCode?: string, geoCode?: string): Promise<GeoTypeItem[]> {
    const queryParams: Record<string, string> = {};
    if (typeCode) queryParams.typeCode = typeCode;
    if (geoCode) queryParams.geoCode = geoCode;
    
    return this.request<GeoTypeItem[]>('GET', '/api/Geo/listgeotypesbycodes', {
      queryParams
    });
  }

  // Get demographic breakdown for a geography
  async getDemographicBreakdown(geoId: number): Promise<GeoDemographicsResponse> {
    if (ENABLE_VERBOSE_LOGGING) {
      console.log('🧭 DEMOGRAPHIC API REQUEST: /api/GeoDemoCount/geo/', geoId);
    }

    const resp = await this.request<GeoDemographicsResponse>('GET', `/api/GeoDemoCount/geo/${geoId}`);

    // Log response summary only in detailed logging mode
    if (ENABLE_DETAILED_LOGGING) {
      const demo = resp?.demographics || {} as Record<string, any>;
      const categories = Object.keys(demo);
      console.log('📊 DEMOGRAPHIC API RESPONSE - Categories:', categories.join(', '));
      categories.forEach(cat => {
        const values = Array.isArray(demo[cat]) ? demo[cat] : [];
        console.log(`  • ${cat}: ${values.length} items`);
      });
    }

    return resp;
  }

  // Helper: Get multiple dimensions in parallel
  async getAllDimensions(): Promise<{
    ageRange: DimensionItem[];
    gender: DimensionItem[];
    party: DimensionItem[];
    ethnicity: DimensionItem[];
    income: DimensionItem[];
    education: DimensionItem[];
    generalVoteHistory: DimensionItem[];
    primaryVoteHistory: DimensionItem[];
  }> {
    const [
      ageRange,
      gender,
      party,
      ethnicity,
      income,
      education,
      generalVoteHistory,
      primaryVoteHistory
    ] = await Promise.all([
      this.getDimensions(DimensionType.AGE_RANGE),
      this.getDimensions(DimensionType.GENDER),
      this.getDimensions(DimensionType.PARTY),
      this.getDimensions(DimensionType.ETHNICITY),
      this.getDimensions(DimensionType.INCOME),
      this.getDimensions(DimensionType.EDUCATION),
      this.getDimensions(DimensionType.GENERAL_VOTE_HISTORY),
      this.getDimensions(DimensionType.PRIMARY_VOTE_HISTORY)
    ]);

    return {
      ageRange,
      gender,
      party,
      ethnicity,
      income,
      education,
      generalVoteHistory,
      primaryVoteHistory
    };
  }

  // Helper: Get geographic views for multiple types
  async getGeographicViewsByTypes(typeCodes: string[], geoCode?: string): Promise<{
    [typeCode: string]: GeoCountView[]
  }> {
    const results = await Promise.all(
      typeCodes.map(typeCode =>
        this.getGeographicView({ typeCode, geoCode, subGeoCode: '' })
      )
    );

    const viewsByType: { [typeCode: string]: GeoCountView[] } = {};
    typeCodes.forEach((typeCode, index) => {
      viewsByType[typeCode] = results[index];
    });

    return viewsByType;
  }
}

export const apiService = new ApiService();



