export type GeographicSelections = {
  state?: string[];
  county?: string[];
  dma?: string[];
  congressional?: string[];
  stateSenateDistrict?: string[];
  stateHouseDistrict?: string[];
};

const extractDistrictNumber = (districtName: string): string => {
  const match = districtName.match(/\d+/);
  return match ? match[0] : districtName;
};

const sortDistrictNumbers = (districts: string[]): string[] => {
  return [...districts].sort((a, b) => {
    const numA = parseInt(extractDistrictNumber(a));
    const numB = parseInt(extractDistrictNumber(b));

    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }

    return a.localeCompare(b);
  });
};

const stateFullNames: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia',
  PR: 'Puerto Rico',
};

export function formatGeographicTitle(
  geographicSelections: GeographicSelections | null | undefined,
  options?: { isNational?: boolean; fallback?: string }
): string {
  if (options?.isNational) {
    return 'National Audience';
  }

  if (!geographicSelections) {
    return options?.fallback ?? 'Geographic Selection';
  }

  const {
    state = [],
    dma = [],
    county = [],
    congressional = [],
    stateSenateDistrict = [],
    stateHouseDistrict = [],
  } = geographicSelections;

  let primary = '';
  if (state.length > 0) {
    primary = [...state]
      .sort()
      .map(value => stateFullNames[value] || value)
      .join(', ');
  } else if (dma.length > 0) {
    primary = [...dma].sort().join(', ');
  }

  const refinements: string[] = [];

  if (county.length > 0) {
    refinements.push([...county].sort().join(', '));
  }

  if (congressional.length > 0) {
    const sortedDistricts = sortDistrictNumbers(congressional);
    const districts = sortedDistricts.map(extractDistrictNumber).join(', ');
    refinements.push(`Congressional District ${districts}`);
  }

  if (stateSenateDistrict.length > 0) {
    const sortedDistricts = sortDistrictNumbers(stateSenateDistrict);
    const districts = sortedDistricts.map(extractDistrictNumber).join(', ');
    refinements.push(`State Senate District ${districts}`);
  }

  if (stateHouseDistrict.length > 0) {
    const sortedDistricts = sortDistrictNumbers(stateHouseDistrict);
    const districts = sortedDistricts.map(extractDistrictNumber).join(', ');
    refinements.push(`State House District ${districts}`);
  }

  if (refinements.length > 0) {
    return primary ? `${primary} - ${refinements.join(' • ')}` : refinements.join(' • ');
  }

  return primary || options?.fallback || 'Geographic Selection';
}

