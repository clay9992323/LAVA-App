// Test utilities and mock data for unit tests

export const mockAudienceStats = {
  totalCount: 5000000,
  demographics: {
    gender: {
      'Male': 2500000,
      'Female': 2400000,
      'Unknown': 100000,
    },
    age: {
      '18-24': 500000,
      '25-34': 800000,
      '35-44': 900000,
      '45-54': 1000000,
      '55-64': 900000,
      '65+': 900000,
    },
    ethnicity: {
      'Caucasian': 2500000,
      'African American': 1500000,
      'Hispanic': 700000,
      'Asian': 200000,
      'Other': 100000,
    },
    education: {
      'High School': 1500000,
      'Some College': 1200000,
      'Bachelor': 1300000,
      'Graduate': 1000000,
    },
    income: {
      '<$50K': 1500000,
      '$50K-$100K': 2000000,
      '$100K-$150K': 1000000,
      '>$150K': 500000,
    },
  },
  geography: {
    state: {
      'Louisiana': 4500000,
      'Mississippi': 300000,
      'Texas': 200000,
    },
    county: {
      'Orleans': 400000,
      'Jefferson': 450000,
      'East Baton Rouge': 450000,
      'Caddo': 250000,
      'Lafayette': 240000,
    },
    dma: {
      'New Orleans': 1300000,
      'Baton Rouge': 850000,
      'Shreveport': 640000,
      'Lafayette': 630000,
      'Lake Charles': 200000,
    },
    zipCode: {},
    stateSenateDistrict: {},
    stateHouseDistrict: {},
  },
  engagement: {
    high: 1500000,
    medium: 2000000,
    low: 1500000,
  },
  political: {
    democrat: 2000000,
    republican: 2200000,
    independent: 800000,
    swing: 0,
  },
  mediaConsumption: {
    socialmediaheavyuser: 1800000,
    socialmediauserfacebook: 3000000,
    socialmediauserinstagram: 1500000,
    socialmediauserx: 800000,
    socialmediauseryoutube: 2500000,
  },
  universe: {
    turnouthigh: 1800000,
    engagement_high: 1500000,
    engagement_mid: 2000000,
    engagement_low: 1500000,
    likelyvotersdemocrat: 1900000,
    likelyvotersrepublican: 2000000,
    socialmediaheavyuser: 1800000,
    persuasion: 800000,
  },
};

export const mockGeographicOptions = {
  states: {
    'Louisiana': 4500000,
    'Mississippi': 300000,
    'Texas': 200000,
  },
  counties: {
    'Orleans': 400000,
    'Jefferson': 450000,
    'East Baton Rouge': 450000,
  },
  dmas: {
    'New Orleans': 1300000,
    'Baton Rouge': 850000,
    'Shreveport': 640000,
  },
  stateSenateDistricts: {},
  stateHouseDistricts: {},
};

export const mockFilteredData = {
  totalCount: 125000,
  demographics: {
    gender: {
      'Male': 62500,
      'Female': 60000,
      'Unknown': 2500,
    },
    age: {
      '18-24': 12500,
      '25-34': 20000,
      '35-44': 22500,
      '45-54': 25000,
      '55-64': 22500,
      '65+': 22500,
    },
    ethnicity: {
      'Caucasian': 62500,
      'African American': 37500,
      'Hispanic': 17500,
      'Asian': 5000,
      'Other': 2500,
    },
    education: {},
    income: {},
  },
  geography: {
    state: {
      'Louisiana': 125000,
    },
    county: {
      'Orleans': 125000,
    },
    dma: {
      'New Orleans': 125000,
    },
    zipCode: {},
    stateSenateDistrict: {},
    stateHouseDistrict: {},
  },
  engagement: {
    high: 125000,
    medium: 0,
    low: 0,
  },
  political: {
    democrat: 50000,
    republican: 55000,
    independent: 20000,
    swing: 0,
  },
  mediaConsumption: {
    socialmediaheavyuser: 45000,
    socialmediauserfacebook: 75000,
    socialmediauserinstagram: 37500,
    socialmediauserx: 20000,
    socialmediauseryoutube: 62500,
  },
  universe: {
    turnouthigh: 125000,
    engagement_high: 125000,
  },
};

// Mock database pool
export const mockPool = {
  request: () => ({
    query: jest.fn().mockResolvedValue({
      recordset: [{ total: 5000000 }],
    }),
  }),
};

// Helper to wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

