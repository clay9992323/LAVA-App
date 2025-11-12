# User Flows & API Documentation

**Audience Builder Dashboard - API Integration Guide**  
**Date:** October 30, 2025  
**API Base URL:** `https://causewayappsapi-f9c7fmb8e5emhzbg.southcentralus-01.azurewebsites.net`

---

## Table of Contents

1. [Initial Application Load](#1-initial-application-load)
2. [Selecting a State (Louisiana)](#2-selecting-a-state-louisiana)
3. [Selecting a County within a State](#3-selecting-a-county-within-a-state)
4. [Adding Universe Filters](#4-adding-universe-filters)
5. [Viewing Geographic Breakdown](#5-viewing-geographic-breakdown)
6. [Changing States](#6-changing-states)
7. [National View](#7-national-view)

---

## 1. Initial Application Load

### User Action
User opens the dashboard for the first time. No filters selected.

### API Calls Made

#### 1.1 Get Initial Statistics
**Endpoint:** `GET /api/streaming?action=stats`

**Request Headers:**
```http
GET /api/streaming?action=stats HTTP/1.1
Host: localhost:3000
Accept: application/json
```

**Response:** (Status: 200 OK)
```json
{
  "success": true,
  "data": {
    "totalCount": 8866385,
    "demographics": {
      "gender": {
        "Female": 0,
        "Male": 0
      },
      "age": {
        "18 - 24": 0,
        "25 - 34": 0,
        "35 - 44": 0,
        "45 - 54": 0,
        "55 - 64": 0,
        "65 +": 0
      },
      "ethnicity": {
        "Asian": 0,
        "Black": 0,
        "Hispanic": 0,
        "White": 0,
        "Other": 0
      },
      "education": {},
      "income": {}
    },
    "geography": {
      "state": {
        "Louisiana": 2885943,
        "Virginia": 5980442
      },
      "county": {},
      "dma": {},
      "zipCode": {},
      "stateSenateDistrict": {},
      "stateHouseDistrict": {}
    },
    "partyBreakdown": {},
    "engagement": {
      "high": 0,
      "medium": 0,
      "low": 0
    },
    "political": {
      "democrat": 0,
      "republican": 0,
      "independent": 0
    },
    "mediaConsumption": {
      "socialmediaheavyuser": 0,
      "socialmediauserfacebook": 0,
      "socialmediauserinstagram": 0,
      "socialmediauserx": 0,
      "socialmediauseryoutube": 0
    },
    "universe": {}
  },
  "type": "stats",
  "cached": false,
  "queryTime": 2.45,
  "source": "api"
}
```

**What Happens:**
- Dashboard displays total count: **8,866,385**
- Shows 2 available states: Louisiana and Virginia
- All filters are empty/unselected

---

## 2. Selecting a State (Louisiana)

### User Action
User clicks on the State dropdown and selects **Louisiana (LA)**.

### API Calls Made

#### 2.1 Get Geographic Options for Louisiana
**Endpoint:** `POST /api/geographic-options`

**Request:**
```json
{
  "selectedStates": ["LA"],
  "selectedCounties": [],
  "universeFields": [],
  "operator": "AND"
}
```

**Internal API Call to Causeway API:**
```json
POST /api/Geo/view
{
  "typeCode": "CTY",
  "geoCode": "LA",
  "subGeoCode": ""
}
```

**Response:** (Status: 200 OK)
```json
{
  "success": true,
  "geographicOptions": {
    "states": {
      "Louisiana": 2885943,
      "Virginia": 5980442
    },
    "counties": {
      "ACADIA PARISH": 56789,
      "ALLEN PARISH": 23456,
      "ASCENSION PARISH": 125432,
      "ASSUMPTION PARISH": 21098,
      "AVOYELLES PARISH": 38765,
      "... (64 total parishes)": 0
    },
    "dmas": {},
    "stateSenateDistricts": {
      "District 1": 73456,
      "District 2": 68234,
      "... (39 total districts)": 0
    },
    "stateHouseDistricts": {
      "District 1": 27456,
      "District 2": 28234,
      "... (105 total districts)": 0
    }
  },
  "timestamp": "2025-10-30T14:32:15.123Z"
}
```

#### 2.2 Get Combined Counts for Louisiana
**Endpoint:** `POST /api/combined-filters`

**Request:**
```json
{
  "universeFields": [],
  "geographicFilters": {
    "state": ["LA"]
  },
  "operator": "AND",
  "requestedLevels": ["state", "county", "dma"]
}
```

**Internal API Call to Causeway API:**
```json
POST /api/Geo/view
{
  "typeCode": "ST",
  "geoCode": "LA",
  "subGeoCode": ""
}
```

**Response:** (Status: 200 OK)
```json
{
  "success": true,
  "combinedCounts": {
    "total": 2885943
  },
  "filteredBreakdowns": {
    "demographics": {
      "gender": {},
      "age": {},
      "ethnicity": {},
      "education": {},
      "income": {}
    },
    "geography": {
      "state": {
        "Louisiana": 2885943
      },
      "county": {
        "ACADIA PARISH": 56789,
        "ALLEN PARISH": 23456,
        "... (64 parishes)": 0
      },
      "dma": {}
    },
    "engagement": {
      "high": 0,
      "medium": 0,
      "low": 0
    },
    "political": {
      "democrat": 0,
      "republican": 0,
      "independent": 0
    },
    "mediaConsumption": {
      "socialmediaheavyuser": 0,
      "socialmediauserfacebook": 0,
      "socialmediauserinstagram": 0,
      "socialmediauserx": 0,
      "socialmediauseryoutube": 0
    }
  },
  "timestamp": "2025-10-30T14:32:15.456Z"
}
```

**What Happens:**
- Total count updates to: **2,885,943**
- County dropdown now shows **64 Louisiana parishes** (not all counties)
- State Senate dropdown shows **39 districts** for Louisiana
- State House dropdown shows **105 districts** for Louisiana
- Geographic Breakdown shows **ONLY Louisiana** (not Virginia)

---

## 3. Selecting a County within a State

### User Action
User has Louisiana selected and now selects **Orleans Parish** from the county dropdown.

### API Calls Made

#### 3.1 Get Updated Geographic Options
**Endpoint:** `POST /api/geographic-options`

**Request:**
```json
{
  "selectedStates": ["LA"],
  "selectedCounties": ["ORLEANS PARISH"],
  "universeFields": [],
  "operator": "AND"
}
```

**Response:** (Status: 200 OK)
```json
{
  "success": true,
  "geographicOptions": {
    "states": {
      "Louisiana": 2885943,
      "Virginia": 5980442
    },
    "counties": {
      "ACADIA PARISH": 56789,
      "ALLEN PARISH": 23456,
      "ORLEANS PARISH": 343829,
      "... (64 total)": 0
    },
    "dmas": {},
    "stateSenateDistricts": {
      "... (39 districts for LA)": 0
    },
    "stateHouseDistricts": {
      "... (105 districts for LA)": 0
    }
  },
  "timestamp": "2025-10-30T14:35:22.789Z"
}
```

#### 3.2 Get Combined Counts with County Filter
**Endpoint:** `POST /api/combined-filters`

**Request:**
```json
{
  "universeFields": [],
  "geographicFilters": {
    "state": ["LA"],
    "county": ["ORLEANS PARISH"]
  },
  "operator": "AND",
  "requestedLevels": ["state", "county", "dma"]
}
```

**Response:** (Status: 200 OK)
```json
{
  "success": true,
  "combinedCounts": {
    "total": 343829
  },
  "filteredBreakdowns": {
    "demographics": {
      "gender": {},
      "age": {},
      "ethnicity": {},
      "education": {},
      "income": {}
    },
    "geography": {
      "state": {
        "Louisiana": 2885943
      },
      "county": {
        "ORLEANS PARISH": 343829
      },
      "dma": {}
    },
    "engagement": {},
    "political": {},
    "mediaConsumption": {}
  },
  "timestamp": "2025-10-30T14:35:23.123Z"
}
```

**What Happens:**
- Total count updates to: **343,829** (Orleans Parish only)
- Geographic Breakdown still shows Louisiana at state level
- County breakdown shows only Orleans Parish

---

## 4. Adding Universe Filters

### User Action
User has Louisiana selected and now adds universe filter: **High Engagement**.

### API Calls Made

#### 4.1 Get Combined Counts with Universe Filter
**Endpoint:** `POST /api/combined-filters`

**Request:**
```json
{
  "universeFields": ["engagement_high"],
  "geographicFilters": {
    "state": ["LA"]
  },
  "operator": "AND",
  "requestedLevels": ["state", "county", "dma"]
}
```

**Internal API Calls to Causeway API:**
```json
// First: Get geoId for Louisiana
POST /api/Geo/view
{
  "typeCode": "ST",
  "geoCode": "LA",
  "subGeoCode": ""
}
// Response includes: { "geoId": 123, ... }

// Then: Use that geoId for audience count
POST /api/Audience/count
{
  "geoId": 123,
  "universeList": "engagement_high"
}
```

**Response from Causeway API:**
```json
{
  "count": 425678,
  "geoId": 123,
  "ageRangeIds": null,
  "genderIds": null,
  "partyIds": null,
  "ethnicityIds": null,
  "incomeIds": null,
  "educationIds": null,
  "generalVoteHistoryIds": null,
  "primaryVoteHistoryIds": null,
  "universeList": "engagement_high"
}
```

**Response to Frontend:** (Status: 200 OK)
```json
{
  "success": true,
  "combinedCounts": {
    "total": 425678,
    "engagement_high": 425678
  },
  "filteredBreakdowns": {
    "demographics": {
      "gender": {
        "Female": 234567,
        "Male": 191111
      },
      "age": {
        "18 - 24": 45678,
        "25 - 34": 89234,
        "35 - 44": 102345,
        "45 - 54": 98765,
        "55 - 64": 56234,
        "65 +": 33422
      },
      "ethnicity": {
        "White": 245678,
        "Black": 123456,
        "Hispanic": 34567,
        "Asian": 12345,
        "Other": 9632
      },
      "education": {},
      "income": {}
    },
    "geography": {
      "state": {
        "Louisiana": 425678
      },
      "county": {
        "ORLEANS PARISH": 89234,
        "EAST BATON ROUGE PARISH": 78456,
        "... (64 parishes with counts)": 0
      },
      "dma": {}
    },
    "engagement": {
      "high": 425678,
      "medium": 0,
      "low": 0
    },
    "political": {},
    "mediaConsumption": {}
  },
  "timestamp": "2025-10-30T14:40:15.789Z"
}
```

**What Happens:**
- Total count updates to: **425,678** (Louisiana residents with high engagement)
- Demographics now show actual data (gender, age, ethnicity breakdowns)
- Geographic breakdown shows distribution across Louisiana parishes
- Engagement section highlights high engagement

---

## 5. Viewing Geographic Breakdown

### User Action
User views the "Geographic Breakdown" panel in the preview section.

**Data Source:** The geographic breakdown uses data from the most recent `/api/combined-filters` response.

**Display Logic:**
- **If Louisiana is selected:** Shows ONLY Louisiana (not Virginia)
- **If no state is selected:** Shows both Louisiana and Virginia with percentages

**Example Display (Louisiana Selected):**

```
Geographic Breakdown
─────────────────────

State
  Louisiana        2,885,943  (100.0%)

County (Top showing)
  Orleans Parish     343,829   (11.9%)
  East Baton Rouge   456,234   (15.8%)
  Jefferson Parish   312,456   (10.8%)
  ... (remaining 61 parishes)
```

**Example Display (No State Selected):**

```
Geographic Breakdown
─────────────────────

State
  Virginia         5,980,442  (67.5%)
  Louisiana        2,885,943  (32.5%)
```

---

## 6. Changing States

### User Action
User changes from Louisiana to **Virginia (VA)**.

### API Calls Made

#### 6.1 Get Geographic Options for Virginia
**Endpoint:** `POST /api/geographic-options`

**Request:**
```json
{
  "selectedStates": ["VA"],
  "selectedCounties": [],
  "universeFields": [],
  "operator": "AND"
}
```

**Internal API Calls:**
```json
// Get Virginia counties
POST /api/Geo/view
{
  "typeCode": "CTY",
  "geoCode": "VA",
  "subGeoCode": ""
}

// Get Virginia State Senate Districts
POST /api/Geo/view
{
  "typeCode": "SSD",
  "geoCode": "VA",
  "subGeoCode": ""
}

// Get Virginia State House Districts
POST /api/Geo/view
{
  "typeCode": "SHD",
  "geoCode": "VA",
  "subGeoCode": ""
}
```

**Response:** (Status: 200 OK)
```json
{
  "success": true,
  "geographicOptions": {
    "states": {
      "Louisiana": 2885943,
      "Virginia": 5980442
    },
    "counties": {
      "ACCOMACK COUNTY": 28765,
      "ALBEMARLE COUNTY": 89432,
      "ALEXANDRIA CITY": 145678,
      "... (133 total counties/cities)": 0
    },
    "dmas": {},
    "stateSenateDistricts": {
      "District 1": 149234,
      "District 2": 148567,
      "... (40 total districts)": 0
    },
    "stateHouseDistricts": {
      "District 1": 59823,
      "District 2": 60145,
      "... (100 total districts)": 0
    }
  },
  "timestamp": "2025-10-30T14:45:32.456Z"
}
```

#### 6.2 Get Combined Counts for Virginia
**Endpoint:** `POST /api/combined-filters`

**Request:**
```json
{
  "universeFields": [],
  "geographicFilters": {
    "state": ["VA"]
  },
  "operator": "AND",
  "requestedLevels": ["state", "county", "dma"]
}
```

**Response:** (Status: 200 OK)
```json
{
  "success": true,
  "combinedCounts": {
    "total": 5980442
  },
  "filteredBreakdowns": {
    "demographics": {
      "gender": {},
      "age": {},
      "ethnicity": {},
      "education": {},
      "income": {}
    },
    "geography": {
      "state": {
        "Virginia": 5980442
      },
      "county": {
        "FAIRFAX COUNTY": 987654,
        "PRINCE WILLIAM COUNTY": 456789,
        "VIRGINIA BEACH CITY": 345678,
        "... (133 total)": 0
      },
      "dma": {}
    },
    "engagement": {},
    "political": {},
    "mediaConsumption": {}
  },
  "timestamp": "2025-10-30T14:45:32.789Z"
}
```

**What Happens:**
- Total count updates to: **5,980,442**
- County dropdown now shows **133 Virginia counties/cities** (completely different from Louisiana)
- State Senate dropdown shows **40 districts** for Virginia
- State House dropdown shows **100 districts** for Virginia
- Geographic Breakdown shows **ONLY Virginia** (Louisiana is removed)
- Any previously selected Louisiana counties are cleared

---

## 7. National View

### User Action
User clears all state selections or selects "National" view.

### API Calls Made

#### 7.1 Get All Geographic Options
**Endpoint:** `POST /api/geographic-options`

**Request:**
```json
{
  "selectedStates": [],
  "selectedCounties": [],
  "universeFields": [],
  "operator": "AND"
}
```

**Internal API Call:**
```json
POST /api/Geo/view
{
  "typeCode": "ST",
  "geoCode": "",
  "subGeoCode": ""
}
```

**Response:** (Status: 200 OK)
```json
{
  "success": true,
  "geographicOptions": {
    "states": {
      "Louisiana": 2885943,
      "Virginia": 5980442
    },
    "counties": {
      "... (197 total counties from all states)": 0
    },
    "dmas": {
      "New York, NY": 1234567,
      "Los Angeles, CA": 987654,
      "... (17 total DMAs)": 0
    },
    "stateSenateDistricts": {
      "... (mixed from all states)": 0
    },
    "stateHouseDistricts": {
      "... (mixed from all states)": 0
    }
  },
  "timestamp": "2025-10-30T14:50:15.123Z"
}
```

#### 7.2 Get National Combined Counts
**Endpoint:** `POST /api/combined-filters`

**Request:**
```json
{
  "universeFields": [],
  "geographicFilters": {
    "state": []
  },
  "operator": "AND",
  "requestedLevels": ["state", "county", "dma"]
}
```

**Response:** (Status: 200 OK)
```json
{
  "success": true,
  "combinedCounts": {
    "total": 8866385
  },
  "filteredBreakdowns": {
    "demographics": {
      "gender": {},
      "age": {},
      "ethnicity": {},
      "education": {},
      "income": {}
    },
    "geography": {
      "state": {
        "Louisiana": 2885943,
        "Virginia": 5980442
      },
      "county": {
        "... (197 counties across all states)": 0
      },
      "dma": {
        "... (17 DMAs)": 0
      }
    },
    "engagement": {},
    "political": {},
    "mediaConsumption": {}
  },
  "timestamp": "2025-10-30T14:50:15.456Z"
}
```

**What Happens:**
- Total count resets to full database: **8,866,385**
- All 197 counties from all states are available
- Geographic Breakdown shows **both Louisiana and Virginia**
- DMAs become relevant (can cross state lines)

---

## API Request Patterns Summary

### Key Patterns

1. **Geographic Filtering Strategy:**
   - Empty `geoCode` = All states/counties/districts
   - Specific `geoCode` (e.g., "LA") = Only that state's data

2. **Request Format:**
   ```json
   {
     "typeCode": "ST|CTY|DMA|SSD|SHD",
     "geoCode": "STATE_CODE or empty",
     "subGeoCode": ""
   }
   ```

3. **Optimization:**
   - **No universe filters:** Use `/api/Geo/view` for efficient counts
   - **With universe filters:** Use `/api/Audience/count` for filtered results

4. **Data Transformation:**
   - States/Counties: Use `subGeoCode` field for names (e.g., "Louisiana")
   - DMAs: Use `geoCode` field for DMA identifiers
   - Counts: Always use `count` field

---

## Error Handling

### Invalid API Key (401)
**Response:**
```json
{
  "error": "Invalid API Key",
  "status": 401
}
```

### Server Error (500)
**Response:**
```json
{
  "success": false,
  "error": "Failed to get geographic options: API Error (500): Internal Server Error"
}
```

### Timeout
**Response:**
```json
{
  "error": "API request timeout after 60000ms"
}
```

---

## Performance Notes

- **Initial Load:** ~2-3 seconds (6 parallel API calls)
- **State Selection:** ~0.5-1 second (5 parallel API calls for geographic options)
- **Adding Universe Filter:** ~1-2 seconds (includes demographic calculations)
- **Changing States:** ~0.5-1 second (cached state data helps)

---

## Environment Configuration

**Required in `.env.local`:**
```env
# IMPORTANT: The $ character must be escaped as \$ for the dotenv parser
API_KEY=7i\$6OdzDBQVIXJ2!
NEXT_PUBLIC_API_KEY=7i\$6OdzDBQVIXJ2!
API_BASE_URL=https://causewayappsapi-f9c7fmb8e5emhzbg.southcentralus-01.azurewebsites.net
NEXT_PUBLIC_API_BASE_URL=https://causewayappsapi-f9c7fmb8e5emhzbg.southcentralus-01.azurewebsites.net
```

**Note:** The backslash escape (`\$`) is required for Next.js's dotenv parser to correctly read the `$` character in the API key.

---

## Additional Resources

- **API Endpoints Reference:** `CausewayAppsAPI_Endpoints.JSON`
- **Implementation Context:** `API_IMPLEMENTATION_CONTEXT.md`
- **TypeScript Types:** `types/api.ts`

---

**Last Updated:** October 30, 2025  
**Version:** 1.0

