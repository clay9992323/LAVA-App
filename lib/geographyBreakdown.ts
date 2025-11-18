import { AudienceCountResponse, AudienceGeographicBreakdown } from '@/types/api';

export type GeographyCounts = Record<string, Record<string, number>>;

export const GEOGRAPHY_LEVEL_ALIASES: Record<string, string> = {
  state: 'state',
  states: 'state',
  st: 'state',
  usstate: 'state',
  county: 'county',
  counties: 'county',
  cty: 'county',
  parish: 'county',
  dma: 'dma',
  dmas: 'dma',
  stdma: 'dma',
  media: 'dma',
  congressional: 'congressional',
  cd: 'congressional',
  congressionaldistrict: 'congressional',
  statesenatedistrict: 'stateSenateDistrict',
  ssd: 'stateSenateDistrict',
  statehousedistrict: 'stateHouseDistrict',
  shd: 'stateHouseDistrict',
  national: 'national',
  nat: 'national'
};

const PRIMARY_COUNT_FIELDS = ['personCount', 'PersonCount', 'personcount'];
const SECONDARY_COUNT_FIELDS = ['count', 'Count', 'total', 'Total', 'value', 'Value'];

export function normalizeGeographyLevel(raw?: string | null): string | null {
  if (!raw) return null;
  const key = raw.toString().trim().toLowerCase();
  if (GEOGRAPHY_LEVEL_ALIASES[key]) {
    return GEOGRAPHY_LEVEL_ALIASES[key];
  }
  if (key.includes('senate')) return 'stateSenateDistrict';
  if (key.includes('house')) return 'stateHouseDistrict';
  if (key.includes('congress')) return 'congressional';
  if (key.includes('county') || key.includes('parish')) return 'county';
  if (key.includes('dma')) return 'dma';
  if (key.includes('state')) return 'state';
  return key;
}

export function addGeographyValue(
  target: GeographyCounts,
  level: string | null,
  name: string | null,
  count: number | null
): void {
  if (!level || !name || count === null || Number.isNaN(count)) return;
  if (!target[level]) {
    target[level] = {};
  }
  target[level][name] = (target[level][name] || 0) + count;
}

export function extractGeographyName(entry: any): string | null {
  if (!entry || typeof entry !== 'object') return null;
  return (
    entry.subGeoCode ||
    entry.geoCode ||
    entry.code ||
    entry.name ||
    entry.description ||
    entry.label ||
    entry.title ||
    entry.value ||
    null
  );
}

export function normalizeCountValue(raw: any): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/,/g, '').trim();
    if (cleaned.length === 0) return null;
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function extractCountByFields(source: any, fields: string[]): number | null {
  if (!source || typeof source !== 'object') {
    return normalizeCountValue(source);
  }
  for (const key of fields) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const numeric = normalizeCountValue((source as any)[key]);
      if (numeric !== null) {
        return numeric;
      }
    }
  }
  return null;
}

export function extractCountFromObject(source: any, useFallbackFields = true): number | null {
  if (source === null || source === undefined) {
    return null;
  }

  if (typeof source !== 'object') {
    return normalizeCountValue(source);
  }

  const preferred = extractCountByFields(source, PRIMARY_COUNT_FIELDS);
  if (preferred !== null) {
    return preferred;
  }

  if (useFallbackFields) {
    const fallback = extractCountByFields(source, SECONDARY_COUNT_FIELDS);
    if (fallback !== null) {
      return fallback;
    }
  }

  return null;
}

export function extractGeographyCount(entry: any): number | null {
  if (!entry || typeof entry !== 'object') {
    return extractCountFromObject(entry);
  }

  const preferred = extractCountFromObject(entry, false);
  if (preferred !== null) {
    return preferred;
  }

  const nestedContainers = [
    entry.value,
    entry.result,
    entry.Result,
    entry.data,
    entry.Data,
    entry.payload,
    entry.Payload,
    entry.response,
    entry.Response,
    entry.body,
    entry.Body
  ];

  for (const container of nestedContainers) {
    const nested = extractGeographyCount(container);
    if (nested !== null) {
      return nested;
    }
  }

  return extractCountByFields(entry, SECONDARY_COUNT_FIELDS);
}

function traverseGeographyEntry(
  entry: any,
  accumulator: GeographyCounts,
  hintedLevel: string | null = null
) {
  if (!entry || typeof entry !== 'object') return;

  const currentLevel =
    normalizeGeographyLevel(entry.level || entry.type || entry.typeCode || entry.category) ||
    hintedLevel;

  const name = extractGeographyName(entry);
  const count = extractGeographyCount(entry);
  if (currentLevel && name && count !== null) {
    addGeographyValue(accumulator, currentLevel, name, count);
  }

  const childCollections = [
    entry.items,
    entry.values,
    entry.entries,
    Array.isArray(entry.breakdown) ? entry.breakdown : null
  ].filter(Boolean);

  childCollections.forEach((collection: any) => {
    traverseGeographyContainer(collection, accumulator, currentLevel);
  });

  if (
    entry.breakdown &&
    !Array.isArray(entry.breakdown) &&
    typeof entry.breakdown === 'object'
  ) {
    Object.entries(entry.breakdown).forEach(([levelKey, nested]) => {
      traverseGeographyContainer(
        nested,
        accumulator,
        normalizeGeographyLevel(levelKey) || currentLevel
      );
    });
  }
}

export function traverseGeographyContainer(
  container: AudienceGeographicBreakdown | any,
  accumulator: GeographyCounts,
  hintedLevel: string | null = null
): void {
  if (!container) return;

  if (Array.isArray(container)) {
    container.forEach(entry =>
      traverseGeographyEntry(entry, accumulator, hintedLevel)
    );
    return;
  }

  if (typeof container === 'object') {
    Object.entries(container).forEach(([levelKey, value]) => {
      const normalizedLevel =
        normalizeGeographyLevel(levelKey) || hintedLevel;
      if (Array.isArray(value)) {
        value.forEach(entry =>
          traverseGeographyEntry(entry, accumulator, normalizedLevel)
        );
      } else if (typeof value === 'object' && value !== null) {
        Object.entries(value).forEach(([name, count]) => {
          const numeric =
            typeof count === 'number' ? count : Number(count);
          if (Number.isFinite(numeric)) {
            addGeographyValue(
              accumulator,
              normalizedLevel,
              name,
              numeric
            );
          }
        });
      }
    });
  }
}

export function collectGeographyContainers(
  response: AudienceCountResponse | Record<string, any>
): { containers: any[]; relatedCounts: any[] } {
  const containers: any[] = [];
  const relatedCounts: any[] = [];

  if (!response || typeof response !== 'object') {
    return { containers, relatedCounts };
  }

  if (response.breakdowns) {
    Object.values(response.breakdowns).forEach(value => {
      if (value) containers.push(value);
    });
  }

  if (response.geography) containers.push(response.geography);
  if (response.geographicBreakdown) containers.push(response.geographicBreakdown);
  if (response.geographicBreakdowns) containers.push(response.geographicBreakdowns);

  if (Array.isArray((response as any).relatedGeoCounts)) {
    relatedCounts.push(...(response as any).relatedGeoCounts);
  }

  return { containers, relatedCounts };
}

function addRelatedGeoCounts(
  relatedCounts: any[],
  accumulator: GeographyCounts
): void {
  relatedCounts.forEach(entry => {
    const level = normalizeGeographyLevel(entry.geoTypeCode || entry.level);
    const name = extractGeographyName(entry);
    const count = extractCountFromObject(entry);
    if (level && name && count !== null) {
      addGeographyValue(accumulator, level, name, count);
    }
  });
}

export function extractGeographyFromAudienceResponse(
  response: AudienceCountResponse | Record<string, any>
): GeographyCounts {
  const accumulator: GeographyCounts = {};
  const { containers, relatedCounts } = collectGeographyContainers(response);

  containers.forEach(container =>
    traverseGeographyContainer(container, accumulator)
  );
  addRelatedGeoCounts(relatedCounts, accumulator);

  return accumulator;
}

export function mergeGeographyMaps(
  target: GeographyCounts,
  addition?: GeographyCounts | null
): GeographyCounts {
  if (!addition) return target;
  Object.entries(addition).forEach(([level, values]) => {
    Object.entries(values).forEach(([name, count]) => {
      addGeographyValue(target, level, name, count);
    });
  });
  return target;
}

export function pickGeographyLevels(
  geography: GeographyCounts | undefined,
  allowedLevels?: string[]
): GeographyCounts {
  if (!geography) return {};
  if (!allowedLevels || allowedLevels.length === 0) return geography;
  const result: GeographyCounts = {};
  allowedLevels.forEach(level => {
    if (geography[level]) {
      result[level] = { ...geography[level] };
    }
  });
  return result;
}

export function finalizeGeography(
  geography: GeographyCounts | undefined,
  requestedLevels?: string[]
): GeographyCounts {
  if (!geography) return {};
  const levelsToInclude = requestedLevels && requestedLevels.length > 0 ? requestedLevels : Object.keys(geography);
  const result: GeographyCounts = {};
  levelsToInclude.forEach(level => {
    if (geography[level]) {
      result[level] = { ...geography[level] };
    } else {
      result[level] = {};
    }
  });
  return result;
}

export function limitGeographyEntries(
  geography: GeographyCounts | undefined,
  topN: number = 5
): GeographyCounts {
  if (!geography || topN <= 0) {
    return geography ? { ...geography } : {};
  }

  const limited: GeographyCounts = {};

  Object.entries(geography).forEach(([level, values]) => {
    const sortedEntries = Object.entries(values || {})
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, topN);
    limited[level] = Object.fromEntries(sortedEntries);
  });

  return limited;
}

export function normalizeGeographyString(value: string): string {
  return value?.toString().trim().toLowerCase().replace(/\s+/g, ' ') || '';
}

export function isGeographyEmpty(
  geography?: GeographyCounts | null
): boolean {
  if (!geography) return true;
  return Object.values(geography).every(levelValues =>
    !levelValues || Object.keys(levelValues).length === 0
  );
}

