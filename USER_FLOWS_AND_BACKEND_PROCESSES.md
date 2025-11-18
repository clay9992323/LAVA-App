# User Flows and Backend Process Documentation

This document outlines the main user interaction flows and the corresponding backend API processes for the Audience Builder application.

## Table of Contents
1. [Geographic Selection Only](#1-geographic-selection-only)
2. [Geographic + Demographic Filters](#2-geographic--demographic-filters)
3. [Geographic + Universe Filters](#3-geographic--universe-filters)
4. [Geographic + Demographic + Universe Filters](#4-geographic--demographic--universe-filters)
5. [Universe Filters Only](#5-universe-filters-only)
6. [Geographic Options Loading](#6-geographic-options-loading)

---

## 1. Geographic Selection Only

### User Flow
1. User selects a state (e.g., "Louisiana")
2. UI displays total count and geographic breakdowns (counties, DMAs, etc.)
3. No demographic or universe filters applied

### Frontend Process (`app/page.tsx`)
```
User selects state → applyClientSideFilters() called
  ↓
Detects: hasGeographicFilters=true, hasDemographicFilters=false, hasUniverseFilters=false
  ↓
Makes ONE API call to /api/combined-filters:
  - universeFields: []
  - geographicFilters: { state: ["LA"] }
  - demographicFilters: {}
  - requestedLevels: ["state", "county", "dma"]
  ↓
Receives response with:
  - combinedCounts.total: 2,885,943
  - filteredBreakdowns.geography: { state: {...}, county: {...}, dma: {...} }
  - filteredBreakdowns.demographics: {} (empty placeholder)
  ↓
Updates UI with counts and geographic breakdowns
```

### Backend Process (`app/api/combined-filters/route.ts`)
```
POST /api/combined-filters
  ↓
1. Parse request body
2. Determine levels to fetch:
   - Default: ['state', 'county', 'dma'] if requestedLevels is empty
   - Automatically add 'congressional' if geographicFilters.congressional is selected
   - Automatically add 'stateSenateDistrict' if geographicFilters.stateSenateDistrict is selected
   - Automatically add 'stateHouseDistrict' if geographicFilters.stateHouseDistrict is selected
3. Convert demographic filters to dimension IDs (empty in this case)
4. Resolve geoIds for selection (using RequestGeoCache for caching):
   - If counties selected with states: Filter county view by selected counties
   - If congressional districts selected: Get CD view and filter by selected districts
   - If state senate districts selected: Get SSD view and filter by selected districts
   - If state house districts selected: Get SHD view and filter by selected districts
   - If DMAs selected: Get DMA view and filter by selected DMAs
   - If states selected: Get state view(s) and extract geoId(s)
   - If nothing selected: Get national geoId
   - Cache all /api/Geo/view calls within the request using RequestGeoCache
   - Returns array of geoIds (e.g., [19] for single state, or multiple for complex selections)
  ↓
5. Build Audience/count request(s):
   - geoIds: [19] (or multiple geoIds if complex selection)
   - All demographic IDs: empty strings
   - universeList: undefined
  ↓
6. Call apiService.getAudienceCount() in parallel for all geoIds:
   - Process all geoIds using Promise.all() for parallel execution
   - Each call returns response with primaryGeo and relatedGeoCounts
   → Returns: Array of responses, each with:
   {
     primaryGeo: { 
       geoId: 19, 
       personCount: 2885943,
       hasCellPhoneCount: 2450000,
       householdCount: 1850000,
       ... 
     },
     relatedGeoCounts: [
       { geoTypeCode: "CD", subGeoCode: "01", personCount: 505169, ... },
       { geoTypeCode: "CTY", subGeoCode: "EAST BATON ROUGE PARISH", personCount: 279395, ... },
       { geoTypeCode: "STDMA", subGeoCode: "NEW ORLEANS DMA", personCount: 1036269, ... },
       ...
     ]
   }
  ↓
7. Extract geography from response:
   - Parse relatedGeoCounts array
   - Group by geoTypeCode → normalize to level names (CD→congressional, CTY→county, STDMA→dma)
   - Build GeographyCounts: { county: { "EAST BATON ROUGE PARISH": 279395, ... }, ... }
   - Merge geography from all responses (if multiple geoIds processed in parallel)
  ↓
7. Extract cell phone and household counts:
   - Check primaryGeo.hasCellPhoneCount first (preferred location)
   - Fallback to top-level hasCellPhoneCount if not found
   - Same process for householdCount
   - Sum counts across all responses if multiple geoIds
  ↓
8. Process geography:
   - pickGeographyLevels() → filter to requested levels only
   - limitGeographyEntries() → top 5 per level
  ↓
9. Get demographics (placeholder - returns empty objects)
10. Calculate total count: sum of personCount values from all responses
11. Extract and sum cell phone and household counts from all responses
  ↓
12. Return response:
    {
      combinedCounts: { 
        total: 2885943,
        hasCellPhoneCount: 2450000,
        householdCount: 1850000
      },
      filteredBreakdowns: {
        geography: { state: {...}, county: {...}, dma: {...} },
        demographics: {},
        engagement: { high: 0, medium: 0, low: 0 },
        political: { democrat: 0, republican: 0, independent: 0 },
        mediaConsumption: { ... }
      }
    }
```

### API Calls Made
- **1 call** to `/api/Geo/view` (cached by RequestGeoCache, resolves state geoId)
- **1 call** to `/api/Audience/count` (to get counts, geographic breakdowns, cell phone, and household counts)

---

## 2. Geographic + Demographic Filters

### User Flow
1. User selects state "Louisiana"
2. User selects demographic filters (e.g., Age: "25-34", Gender: "Female")
3. UI displays filtered count and breakdowns

### Frontend Process
```
User selects state + demographics → applyClientSideFilters() called
  ↓
Detects: hasGeographicFilters=true, hasDemographicFilters=true, hasUniverseFilters=false
  ↓
Makes TWO API calls (numerator/denominator pattern):

Call #1 - Denominator (geographic-only):
  - universeFields: []
  - geographicFilters: { state: ["LA"] }
  - demographicFilters: {}  ← NO demographics
  ↓
Call #2 - Numerator (geographic + demographic):
  - universeFields: []
  - geographicFilters: { state: ["LA"] }
  - demographicFilters: { age: ["25-34"], gender: ["Female"] }
  ↓
UI displays: numerator / denominator (e.g., "450,000 / 2,885,943")
```

### Backend Process
```
For Call #1 (Denominator):
  - Same as Flow #1 above
  - Returns total population in LA: 2,885,943

For Call #2 (Numerator):
  ↓
1. Convert demographic filters to dimension IDs:
   - Call getCachedDimensions('agerange') → find ID for "25-34"
   - Call getCachedDimensions('gender') → find ID for "Female"
   - Result: { ageRangeIds: "5", genderIds: "2", ... }
  ↓
2. Resolve geoId: 19 (same as Flow #1)
  ↓
3. Call apiService.getAudienceCount():
   - geoId: 19
   - ageRangeIds: "5"
   - genderIds: "2"
   - All other IDs: empty strings
  ↓
4. Extract geography from response (filtered by demographics)
5. Extract cell phone and household counts from response
6. Get demographics (placeholder - returns empty objects)
7. Calculate total: sum of personCount values
  ↓
8. Return filtered counts and breakdowns (including hasCellPhoneCount and householdCount)
```

### API Calls Made
- **1 call** to `/api/Geo/view` (cached by RequestGeoCache, resolves geoId)
- **2 calls** to `/api/Audience/count` (denominator + numerator, both return cell phone and household counts)
- **2 calls** to `/api/Dim/*` (if dimension cache miss)

---

## 3. Geographic + Universe Filters

### User Flow
1. User selects state "Louisiana"
2. User adds universe filter (e.g., "cryptoowner")
3. UI displays filtered count showing crypto owners in LA

### Frontend Process
```
User selects state + universe filter → applyClientSideFilters() called
  ↓
Detects: hasGeographicFilters=true, hasUniverseFilters=true
  ↓
Makes TWO API calls:

Call #1 - Main filtered count:
  - universeFields: ["cryptoowner"]
  - geographicFilters: { state: ["LA"] }
  - demographicFilters: {}
  ↓
Call #2 - Denominator (geographic-only):
  - universeFields: []
  - geographicFilters: { state: ["LA"] }
  - demographicFilters: {}
  ↓
UI displays: filtered count / total population
```

### Backend Process
```
For Call #1 (Filtered):
  ↓
1. Resolve geoId: 19
2. Build universeList: "cryptoowner"
  ↓
3. Call apiService.getAudienceCount():
   - geoId: 19
   - universeList: "cryptoowner"
   - All demographic IDs: empty
  ↓
4. Extract geography from response
5. Extract cell phone and household counts from response
6. Get universe field counts:
   - Optimization: If only ONE universe field, reuse total count (no additional API call)
   - If multiple universe fields: Make separate API calls for each field
   - Store in combinedCounts.cryptoowner (or respective field name)
  ↓
7. Return:
   {
     combinedCounts: {
       total: 125000,  ← crypto owners in LA
       cryptoowner: 125000,
       hasCellPhoneCount: 110000,
       householdCount: 95000
     },
     filteredBreakdowns: { ... }
   }
```

### API Calls Made
- **1 call** to `/api/Geo/view` (cached by RequestGeoCache, resolves geoId)
- **2 calls** to `/api/Audience/count` (filtered + denominator)
- **0-1 calls** to `/api/Audience/count` (only if multiple universe fields; single field reuses total count)

---

## 4. Geographic + Demographic + Universe Filters

### User Flow
1. User selects state "Louisiana"
2. User selects demographics (Age: "25-34")
3. User adds universe filter ("cryptoowner")
4. UI displays: crypto owners aged 25-34 in LA

### Frontend Process
```
User applies all filters → applyClientSideFilters() called
  ↓
Makes TWO API calls:

Call #1 - Filtered (all filters):
  - universeFields: ["cryptoowner"]
  - geographicFilters: { state: ["LA"] }
  - demographicFilters: { age: ["25-34"] }
  ↓
Call #2 - Denominator (geographic-only):
  - universeFields: []
  - geographicFilters: { state: ["LA"] }
  - demographicFilters: {}
```

### Backend Process
```
1. Convert demographics to IDs: { ageRangeIds: "5", ... }
2. Resolve geoId: 19
3. Build universeList: "cryptoowner"
  ↓
4. Call apiService.getAudienceCount():
   - geoId: 19
   - ageRangeIds: "5"
   - universeList: "cryptoowner"
  ↓
5. Extract geography (filtered by all criteria)
6. Extract cell phone and household counts from response
7. Get universe field counts (with demographic filters applied)
   - Optimization: If only one universe field, reuse total count
8. Return combined results (including hasCellPhoneCount and householdCount)
```

### API Calls Made
- **1 call** to `/api/Geo/view` (cached by RequestGeoCache)
- **2 calls** to `/api/Audience/count` (filtered + denominator)
- **0-1 calls** to `/api/Audience/count` (only if multiple universe fields; single field reuses total count)

---

## 5. Universe Filters Only

### User Flow
1. User adds universe filter (e.g., "cryptoowner")
2. No geographic or demographic selections
3. UI shows national-level filtered count

### Frontend Process
```
User applies universe filter only → applyClientSideFilters() called
  ↓
Detects: hasUniverseFilters=true, hasGeographicFilters=false, hasDemographicFilters=false
  ↓
Makes ONE API call:
  - universeFields: ["cryptoowner"]
  - geographicFilters: {}
  - demographicFilters: {}
```

### Backend Process
```
1. Resolve geoId for national:
   - Call apiService.getGeographicView({ typeCode: 'NAT' })
   - Extract national geoId (e.g., 1)
  ↓
2. Call apiService.getAudienceCount():
   - geoId: 1
   - universeList: "cryptoowner"
  ↓
3. Extract geography (national-level breakdowns)
4. Extract cell phone and household counts from response
5. Get universe field counts (optimized: single field reuses total count)
6. Return national filtered results (including hasCellPhoneCount and householdCount)
```

### API Calls Made
- **1 call** to `/api/Geo/view` (cached by RequestGeoCache, resolves national geoId)
- **1-2 calls** to `/api/Audience/count` (filtered count + per-field counts only if multiple universe fields)

---

## 6. Geographic Options Loading

### User Flow
1. User opens geographic selector dropdown
2. UI needs to populate dropdown options with counts
3. Options may be filtered by existing demographic/universe selections

### Frontend Process
```
User opens dropdown → fetchGeographicOptions() called
  ↓
Makes ONE API call to /api/geographic-options:
  - selectedStates: ["LA"] (if state already selected)
  - selectedCounties: []
  - universeFields: ["cryptoowner"] (if universe filter active)
  - demographicFilters: { age: ["25-34"] } (if demographics selected)
```

### Backend Process (`app/api/geographic-options/route.ts`)
```
POST /api/geographic-options
  ↓
1. Convert demographic filters to dimension IDs
2. Build universeList from universeFields
3. Resolve primary geoId:
   - If selectedStates provided → get state geoId
   - Otherwise → get national geoId
  ↓
4. Call apiService.getAudienceCount():
   - geoId: resolved geoId
   - demographic IDs: converted IDs
   - universeList: built list
  ↓
5. Extract geography from response
6. Process geography:
   - pickGeographyLevels() → all default levels
   - limitGeographyEntries() → top 5 per level
  ↓
7. Return:
   {
     geographicOptions: {
       states: { "LA": 2885943, ... },
       counties: { "EAST BATON ROUGE PARISH": 279395, ... },
       dmas: { "NEW ORLEANS DMA": 1036269, ... },
       congressionalDistricts: { "01": 505169, ... },
       stateSenateDistricts: { ... },
       stateHouseDistricts: { ... }
     }
   }
```

### API Calls Made
- **1 call** to `/api/Geo/view` (resolve geoId)
- **1 call** to `/api/Audience/count` (get all geographic options with counts)

---

## Key Backend Components

### Request-Scoped Caching
- `RequestGeoCache` class caches `/api/Geo/view` calls within a single request
- Cache key format: `${typeCode}|${geoCode}|${subGeoCode}`
- Prevents redundant API calls when multiple functions need the same geo data (e.g., resolving geoIds and fetching geographic views)
- Cache automatically cleared in `finally` block after request completes
- Example: When resolving county geoIds, the county view is cached and reused for geography extraction

### Geography Extraction
- `extractGeographyFromAudienceResponse()` parses Audience/count response
- Handles both old nested structure and new `relatedGeoCounts` array format
- Normalizes geoTypeCode to level names (CD→congressional, CTY→county, etc.)

### Geography Processing Pipeline
1. **Extract** → Parse API response(s) into GeographyCounts from `relatedGeoCounts` array
   - Handles multiple geoId responses by merging geography maps
   - Normalizes geoTypeCode to level names (CD→congressional, CTY→county, STDMA→dma, SSD→stateSenateDistrict, SHD→stateHouseDistrict)
2. **Merge** → Combine geography from multiple responses if processing multiple geoIds in parallel
3. **Pick** → Filter to requested levels only (automatically includes levels from selected filters)
4. **Finalize** → Clean and normalize data, handle missing values
5. **Limit** → Top 5 entries per level (configurable)

### Demographics (Current State)
- Returns empty placeholder objects
- Ready for new demographic API endpoint integration

---

## Performance Optimizations

1. **Request-Scoped Caching**: Geo/view calls cached per request to prevent redundant API calls
2. **Dimension Caching**: Dimension lookups cached for 1 hour to speed up filter conversion
3. **Parallel API Calls**: Multiple geoIds processed in parallel using `Promise.all()` for faster execution
4. **Universe Field Optimization**: Single universe field reuses total count (avoids duplicate API calls)
5. **Top 5 Limiting**: Only top entries returned to reduce payload size
6. **Response Compression**: Large responses automatically gzipped (>10KB threshold)

---

## Response Data Structure

### Cell Phone and Household Counts
- Extracted from `primaryGeo.hasCellPhoneCount` and `primaryGeo.householdCount` (preferred location)
- Fallback to top-level `hasCellPhoneCount` and `householdCount` if not in primaryGeo
- Summed across all geoId responses if multiple selections
- Included in `combinedCounts` response object
- Displayed in PreviewPanel as separate stat cards

### Geographic Levels Support
- **Standard levels**: state, county, dma
- **Additional levels**: congressional, stateSenateDistrict, stateHouseDistrict
- Automatically included in `levelsToFetch` when corresponding filters are selected
- Conditional display in PreviewPanel based on selected geographic filters

## Error Handling

- Invalid geoId resolution → Returns 500 with error message "Unable to resolve geoIds for selection"
- API timeout → 120 second timeout (configurable via API_CONFIG), returns error
- Missing required fields → Returns 400 validation error (universeFields must be array, geographicFilters must be object)
- Empty results → Returns empty objects (not errors)
- Cache errors → Logged but don't break request flow

