import { apiService } from '@/lib/apiService';

type DimensionCacheEntry = {
  data: any[];
  timestamp: number;
};

const dimensionsCache: Map<string, DimensionCacheEntry> = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function getCachedDimensions(type: string): Promise<any[]> {
  const now = Date.now();
  const cached = dimensionsCache.get(type);

  if (cached && now - cached.timestamp < CACHE_TTL) {
    console.log(`📦 Using cached dimensions for ${type}`);
    return cached.data;
  }

  console.log(`🔄 Fetching dimensions for ${type} from API`);
  const data = await apiService.getDimensions(type);
  dimensionsCache.set(type, { data, timestamp: now });
  return data;
}

export interface DemographicIdFilters {
  genderIds: string;
  ageRangeIds: string;
  ethnicityIds: string;
  incomeIds: string;
  educationIds: string;
  partyIds: string;
}

export async function convertDemographicFiltersToDimensionIds(
  demographicFilters: { [key: string]: string[] } = {}
): Promise<DemographicIdFilters> {
  const result: DemographicIdFilters = {
    genderIds: '',
    ageRangeIds: '',
    ethnicityIds: '',
    incomeIds: '',
    educationIds: '',
    partyIds: ''
  };

  if (!demographicFilters || Object.keys(demographicFilters).length === 0) {
    return result;
  }

  const [
    genderDims,
    ageDims,
    ethnicityDims,
    incomeDims,
    educationDims,
    partyDims
  ] = await Promise.all([
    demographicFilters.gender?.length ? getCachedDimensions('gender') : Promise.resolve([]),
    demographicFilters.age?.length ? getCachedDimensions('agerange') : Promise.resolve([]),
    demographicFilters.ethnicity?.length ? getCachedDimensions('ethnicity') : Promise.resolve([]),
    demographicFilters.income?.length ? getCachedDimensions('income') : Promise.resolve([]),
    demographicFilters.education?.length ? getCachedDimensions('education') : Promise.resolve([]),
    demographicFilters.party?.length ? getCachedDimensions('party') : Promise.resolve([])
  ]);

  if (demographicFilters.gender?.length) {
    result.genderIds = genderDims
      .filter((dim: any) => dim.name && demographicFilters.gender.includes(dim.name))
      .map((dim: any) => dim.id.toString())
      .join(',');
  }

  if (demographicFilters.age?.length) {
    result.ageRangeIds = ageDims
      .filter((dim: any) => dim.name && demographicFilters.age.includes(dim.name))
      .map((dim: any) => dim.id.toString())
      .join(',');
  }

  if (demographicFilters.ethnicity?.length) {
    result.ethnicityIds = ethnicityDims
      .filter((dim: any) => dim.name && demographicFilters.ethnicity.includes(dim.name))
      .map((dim: any) => dim.id.toString())
      .join(',');
  }

  if (demographicFilters.income?.length) {
    result.incomeIds = incomeDims
      .filter((dim: any) => dim.name && demographicFilters.income.includes(dim.name))
      .map((dim: any) => dim.id.toString())
      .join(',');
  }

  if (demographicFilters.education?.length) {
    result.educationIds = educationDims
      .filter((dim: any) => dim.name && demographicFilters.education.includes(dim.name))
      .map((dim: any) => dim.id.toString())
      .join(',');
  }

  if (demographicFilters.party?.length) {
    result.partyIds = partyDims
      .filter((dim: any) => dim.name && demographicFilters.party.includes(dim.name))
      .map((dim: any) => dim.id.toString())
      .join(',');
  }

  return result;
}

