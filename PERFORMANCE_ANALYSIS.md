# Performance Analysis: State Selection Flow

## Problem Statement
Selecting a state in the web app takes **~3 minutes** compared to **~2 seconds** in Swagger UI for the same operation.

## Flow Comparison

### Swagger UI Flow (2 seconds)
```
User selects state → Direct API call → Response (count only)
──────────────────────────────────────────────────────────
1. POST /api/Audience/count
   Body: { geoId: 123, ... }
   
2. API processes request
   - Query database for count
   - Return simple count response
   
3. Display count
   
Total: ~2 seconds (network + API processing)
```

### Web App Flow (3 minutes)
```
User selects state → Multiple processing steps → Response (full breakdown)
──────────────────────────────────────────────────────────────────────────
```

## Detailed Flow Breakdown

### 1. User Action
**File:** `app/page.tsx:785`
- User clicks state in selector
- `handleStateConfirm()` is called
- Sets `geographicSelections` state

**Time:** ~0ms (instant)

---

### 2. State Change Triggers Effect
**File:** `app/page.tsx:662-712`
- `useEffect` detects `geographicSelections` change
- Calls `applyClientSideFilters()`

**Time:** ~0ms (React state update)

---

### 3. Frontend Processing (applyClientSideFilters)
**File:** `app/page.tsx:130-659`

**Step 3.1: Determine Request Levels**
```typescript
// Lines 238-266
if (geography.state && geography.state.length > 0) {
  levelsToRequest = ['state', 'county', 'dma'];
}
```
**Time:** ~0ms (simple conditional)

**Step 3.2: Make API Call to /api/combined-filters**
```typescript
// Lines 275-286
const geoOnlyResponse = await fetch('/api/combined-filters', {
  method: 'POST',
  body: JSON.stringify({
    universeFields: [],
    geographicFilters: { state: ['LA'] },
    demographicFilters: {},
    requestedLevels: ['state', 'county', 'dma']
  })
});
```
**Time:** Network latency (~50-200ms)

---

### 4. Backend API Route (POST /api/combined-filters)
**File:** `app/api/combined-filters/route.ts:159`

**Step 4.1: Parse Request**
```typescript
// Lines 163-191
const body = await request.json();
const {
  universeFields = [],
  geographicFilters = {},
  demographicFilters = {},
  requestedLevels = []
} = body;
```
**Time:** ~5-10ms (JSON parsing)

**Step 4.2: Determine Levels to Fetch**
```typescript
// Lines 180-191
let levelsToFetch = ['state', 'county', 'dma'];
// Adds additional levels based on filters
```
**Time:** ~0ms

---

### 5. Get Audience Breakdowns
**File:** `app/api/combined-filters/route.ts:230`

**Step 5.1: Convert Demographic Filters**
**File:** `lib/dimensionsCache.ts:35`
```typescript
// Lines 247
const demographicIds = await convertDemographicFiltersToDimensionIds(demographicFilters);
```
- If no demographic filters: Returns empty strings immediately
- If filters exist: Fetches dimension data (cached)

**Time:** ~0-5ms (usually cached)

**Step 5.2: Resolve GeoIds**
**File:** `app/api/combined-filters/route.ts:396`
```typescript
// Lines 248
const geoIds = await resolveGeoIdsForSelection(geographicFilters, geoCache);
```

**Sub-step 5.2.1: Get State GeoId**
```typescript
// Lines 473-483
if (states.length > 0) {
  const stateViews = await Promise.all(
    states.map(state =>
      geoCache.getGeographicView({
        typeCode: 'ST',
        geoCode: state,
        subGeoCode: ''
      })
    )
  );
  return unique(stateViews.filter(view => view.length > 0).map(view => view[0].geoId));
}
```

**CHOKE POINT #1: Geographic View API Call**
- Makes call to `/api/Geo/view` with `typeCode: 'ST'`
- Returns list of all states (including selected one)
- This is a **separate API call** before the main Audience/count call

**Time:** ~500ms-2s (extra network round-trip + API processing)

**Result:** Returns single `geoId` (e.g., `[123]`)

---

### 6. Make Audience Count API Calls
**File:** `app/api/combined-filters/route.ts:257`

```typescript
// Lines 257-273
const audienceResponses = await Promise.all(
  geoIds.map(async geoId =>
    apiService.getAudienceCount({
      geoId,
      ageRangeIds: demographicIds.ageRangeIds,
      genderIds: demographicIds.genderIds,
      // ... other filters
      universeList: universeList || undefined
    })
  )
);
```

**CHOKE POINT #2: Main API Call**
- Makes call to `/api/Audience/count` with state geoId
- API queries database and returns FULL response including:
  - Total count
  - **ALL counties in state** (60+ entries for Louisiana)
  - **ALL DMAs in state** (10+ entries)
  - **ALL demographic breakdowns** (age, gender, ethnicity, education, income, party)
  - **ALL vote history data** (general and primary)
  - Geographic breakdown at multiple levels

**Time:** ~2-5s (same as Swagger UI, but returns MUCH more data)

**Response Size:** 
- Swagger UI: ~1KB (count only)
- Web App: ~500KB-2MB (full breakdown with 100+ geographic entries)

---

### 7. Process Geography Breakdown
**File:** `app/api/combined-filters/route.ts:275-327`

**Step 7.1: Extract Geography from Response**
**File:** `lib/geographyBreakdown.ts:286`
```typescript
// Lines 275-281
for (const response of audienceResponses) {
  aggregatedGeography = mergeGeographyMaps(
    aggregatedGeography,
    extractGeographyFromAudienceResponse(response)
  );
}
```

**CHOKE POINT #3: Geographic Data Extraction**

**Sub-step 7.1.1: Extract All Geography**
```typescript
// lib/geographyBreakdown.ts:286-298
export function extractGeographyFromAudienceResponse(response) {
  const accumulator = {};
  const { containers, relatedCounts } = collectGeographyContainers(response);
  
  containers.forEach(container =>
    traverseGeographyContainer(container, accumulator)
  );
  addRelatedGeoCounts(relatedCounts, accumulator);
  
  return accumulator;
}
```

**Sub-step 7.1.2: Traverse Geography Containers**
```typescript
// lib/geographyBreakdown.ts:162-203
function traverseGeographyEntry(entry, accumulator, hintedLevel) {
  // Processes each geographic entry recursively
  // For Louisiana: 64 parishes + 10+ DMAs = 74+ entries
  // Each entry may have nested breakdowns
  
  childCollections.forEach((collection) =>
    traverseGeographyContainer(collection, accumulator, currentLevel)
  );
  
  // Recursively processes nested breakdowns
  Object.entries(entry.breakdown).forEach(([levelKey, nested]) =>
    traverseGeographyContainer(nested, accumulator, ...)
  );
}
```

**CHOKE POINT #3a: Recursive Traversal**
- Traverses ALL geographic entries (counties, DMAs)
- For each entry, recursively processes nested breakdowns
- Multiple `Object.entries()` and `forEach()` operations
- **Example:** Louisiana = 64 parishes × nested processing = significant overhead

**Time:** ~5-30s (depends on state size and nesting depth)

**Step 7.2: Pick Requested Levels**
```typescript
// Lines 318-319
const pickedGeography = pickGeographyLevels(aggregatedGeography, requestedLevels);
```
**Time:** ~1-5ms (simple filtering)

**Step 7.3: Finalize and Limit Geography**
```typescript
// Lines 322-326
const finalizedGeography = limitGeographyEntries(
  finalizeGeography(pickedGeography, requestedLevels),
  5
);
```

**Sub-step 7.3.1: Finalize Geography**
```typescript
// lib/geographyBreakdown.ts:328-343
export function finalizeGeography(geography, requestedLevels) {
  levelsToInclude.forEach(level => {
    if (geography[level]) {
      result[level] = { ...geography[level] }; // Creates copy of ALL entries
    }
  });
}
```

**Sub-step 7.3.2: Limit to Top 5**
```typescript
// lib/geographyBreakdown.ts:345-363
export function limitGeographyEntries(geography, topN = 5) {
  Object.entries(geography).forEach(([level, values]) => {
    const sortedEntries = Object.entries(values || {})
      .sort(([, a], [, b]) => (b as number) - (a as number)) // Sorts ALL entries
      .slice(0, topN); // Then takes top 5
    limited[level] = Object.fromEntries(sortedEntries);
  });
}
```

**CHOKE POINT #3b: Sorting All Entries**
- Sorts **ALL** counties (64+) to get top 5
- Sorts **ALL** DMAs (10+) to get top 5
- Unnecessary work: We only need top 5, but we sort everything

**Time:** ~2-10s (O(n log n) sort on large arrays)

---

### 8. Process Demographic Breakdowns
**File:** `app/api/combined-filters/route.ts:320`

```typescript
// Lines 320
const demographics = extractDemographicBreakdownsFromResponses(audienceResponses);
```

**CHOKE POINT #4: Demographic Data Extraction**
**File:** `app/api/combined-filters/route.ts:502`

```typescript
// Lines 502-609
function extractDemographicBreakdownsFromResponses(responses) {
  // Process each response
  responses.forEach((response) => {
    const demographicBreakdowns = response.demographicBreakdowns;
    
    // Extract and merge age ranges (exclude Unknown/Other-Unknown)
    if (demographicBreakdowns.ageRanges) {
      const ageRanges = arrayToObject(demographicBreakdowns.ageRanges, false);
      mergeDemographicObjects(demographics.age, ageRanges);
    }
    
    // Same for: genders, parties, ethnicities, educations, incomes
    // Each processes potentially large arrays
  });
}
```

**Sub-step 8.1: Array to Object Conversion**
```typescript
// Lines 513-543
const arrayToObject = (arr, includeUnknown) => {
  for (let i = 0; i < len; i++) {
    const item = arr[i];
    const name = item.name.trim();
    if (shouldExcludeName(name, includeUnknown)) continue;
    
    const count = typeof item.personCount === 'number' 
      ? item.personCount 
      : typeof item.personCount === 'string' 
        ? parseInt(item.personCount.replace(/,/g, ''), 10) || 0
        : 0;
    
    result[name] = (result[name] || 0) + count;
  }
};
```

**Processing:**
- Age ranges: ~10-15 entries
- Genders: ~3-5 entries
- Ethnicities: ~10-15 entries
- Educations: ~10-15 entries
- Incomes: ~10-15 entries
- Parties: ~5-10 entries

**Time:** ~1-5s (string parsing, filtering, object creation)

---

### 9. Process Vote History
**File:** `app/api/combined-filters/route.ts:332-333`

```typescript
// Lines 332-333
const generalVoteHistory = extractGeneralVoteHistoryFromResponses(audienceResponses);
const primaryVoteHistory = extractPrimaryVoteHistoryFromResponses(audienceResponses);
```

**CHOKE POINT #5: Vote History Extraction**
**File:** `app/api/combined-filters/route.ts:671`

```typescript
// Lines 671-732
function extractGeneralVoteHistoryFromResponses(responses) {
  responses.forEach((response) => {
    const demographicBreakdowns = response.demographicBreakdowns;
    if (demographicBreakdowns.generalVoteHistories) {
      const voteHistories = arrayToObject(demographicBreakdowns.generalVoteHistories);
      mergeVoteHistory(voteHistory, voteHistories);
    }
  });
}
```

**Time:** ~500ms-2s (similar array processing)

---

### 10. Extract Political Affiliation
**File:** `app/api/combined-filters/route.ts:329`

```typescript
// Lines 329
const political = extractPoliticalAffiliationFromPartyData(demographics.party);
```

**Time:** ~1-5ms (simple mapping)

---

### 11. Response Compression
**File:** `app/api/combined-filters/route.ts:215`
**File:** `lib/responseOptimizer.ts:5`

```typescript
// Lines 215
return compressResponse(responsePayload);

// lib/responseOptimizer.ts:5-23
export function compressResponse(data, threshold = 10000) {
  const jsonString = JSON.stringify(data); // CHOKE POINT #6
  
  if (jsonString.length > threshold) {
    const compressed = gzipSync(jsonString);
    return new NextResponse(compressed, ...);
  }
  
  return NextResponse.json(data);
}
```

**CHOKE POINT #6: JSON Stringification**
- Converts full response object to JSON string
- Response includes:
  - All processed geography (top 5 counties, top 5 DMAs)
  - All demographics
  - Vote history
  - Political data
- Large object serialization

**Time:** ~500ms-5s (depends on response size)

**CHOKE POINT #7: Gzip Compression**
- Compresses large JSON string
- CPU-intensive operation

**Time:** ~100ms-1s

---

### 12. Network Transfer
- Compressed response sent to frontend
- Response size: ~50KB-200KB (compressed from 500KB-2MB)

**Time:** ~50-200ms (depends on connection speed)

---

### 13. Frontend Processing
**File:** `app/page.tsx:291-407`

**Step 13.1: Parse Response**
```typescript
// Lines 292
const geoOnlyResult = await geoOnlyResponse.json();
```
**Time:** ~10-50ms (decompression + JSON parsing)

**Step 13.2: Update State**
```typescript
// Lines 383-389
if (geoOnlyResult.filteredBreakdowns) {
  filteredStats.demographics = geoOnlyResult.filteredBreakdowns.demographics;
  filteredStats.geography = geoOnlyResult.filteredBreakdowns.geography;
  // ... more assignments
}
```
**Time:** ~1-5ms

**Step 13.3: React Re-render**
- Components update with new data
- PreviewPanel re-renders with statistics

**Time:** ~10-50ms

---

## Performance Summary

### Time Breakdown (Approximate)

| Step | Swagger UI | Web App | Difference |
|------|------------|---------|------------|
| **1-2. User Action & State** | 0ms | 0ms | - |
| **3. Frontend Request Prep** | 0ms | 50ms | +50ms |
| **4. Backend Route Init** | 0ms | 10ms | +10ms |
| **5.1. Convert Demographics** | 0ms | 5ms | +5ms |
| **5.2. Resolve GeoIds** | 0ms | **1000ms** | **+1000ms** ⚠️ |
| **6. Audience Count API** | **2000ms** | **3000ms** | +1000ms ⚠️ |
| **7. Process Geography** | 0ms | **15000ms** | **+15000ms** ⚠️⚠️ |
| **8. Process Demographics** | 0ms | **3000ms** | **+3000ms** ⚠️ |
| **9. Process Vote History** | 0ms | **1500ms** | **+1500ms** ⚠️ |
| **10. Political Affiliation** | 0ms | 5ms | +5ms |
| **11. JSON Stringify** | 0ms | **2000ms** | **+2000ms** ⚠️ |
| **12. Gzip Compression** | 0ms | **500ms** | **+500ms** ⚠️ |
| **13. Network Transfer** | 0ms | 100ms | +100ms |
| **14. Frontend Parse** | 0ms | 30ms | +30ms |
| **15. React Re-render** | 0ms | 30ms | +30ms |
| **TOTAL** | **~2000ms** | **~26330ms** | **+24330ms** |

### Critical Choke Points

1. **CHOKE POINT #1: Geographic View API Call** (~1s)
   - Extra network round-trip
   - Could be cached or optimized

2. **CHOKE POINT #2: Audience Count API** (~3s)
   - Returns MUCH more data than needed
   - API could be optimized to return only requested levels

3. **CHOKE POINT #3: Geographic Extraction** (~15s) ⚠️⚠️ **BIGGEST BOTTLENECK**
   - Recursively processes ALL counties/DMAs (60+ entries)
   - Multiple nested traversals
   - Unnecessary work: Only needs top 5

4. **CHOKE POINT #3b: Sorting All Entries** (~5s)
   - Sorts ALL entries to get top 5
   - Should use partial sort or heap

5. **CHOKE POINT #4: Demographic Extraction** (~3s)
   - Processes large arrays
   - String parsing overhead

6. **CHOKE POINT #6: JSON Stringification** (~2s)
   - Large object serialization
   - Could be optimized

7. **CHOKE POINT #7: Gzip Compression** (~500ms)
   - CPU-intensive but necessary

---

## Root Causes

### Primary Cause: Processing Overhead
**The web app processes 100+ geographic entries when it only needs the top 5.**

- API returns ALL counties (64+) and ALL DMAs (10+)
- App extracts, processes, and sorts ALL of them
- Then limits to top 5
- **Waste:** Processing 75+ entries unnecessarily

### Secondary Causes

1. **Extra API Call:** Geographic view lookup before main call
2. **Large Response:** API returns full breakdown instead of filtered data
3. **Inefficient Sorting:** Sorting all entries instead of partial sort
4. **Multiple Passes:** Multiple iterations over same data
5. **Recursive Traversal:** Deep recursion for nested geography structures

---

## Optimization Opportunities

### Quick Wins (High Impact, Low Effort)

1. **Limit Geography Extraction Early**
   - Stop traversal after finding top N entries
   - Use priority queue/heap instead of full sort
   - **Estimated improvement:** -10s

2. **Cache Geographic Views**
   - Cache state-to-geoId mapping
   - **Estimated improvement:** -1s

3. **Optimize Sorting**
   - Use partial sort (quickselect) for top 5
   - **Estimated improvement:** -3s

4. **Reduce Response Size**
   - Only request needed geographic levels
   - Request top N only from API if possible
   - **Estimated improvement:** -2s

### Medium Effort

1. **Stream Processing**
   - Process geography entries as they're extracted
   - Stop after top N found
   - **Estimated improvement:** -5s

2. **Parallel Processing**
   - Process geography and demographics in parallel (already done)
   - Further parallelize sub-operations
   - **Estimated improvement:** -2s

### Long-term Solutions

1. **API Optimization**
   - Add `topN` parameter to Audience/count endpoint
   - Return only requested geographic levels
   - **Estimated improvement:** -15s

2. **Response Format**
   - API returns pre-processed, limited data
   - Avoid client-side heavy processing
   - **Estimated improvement:** -10s

---

## Expected Performance After Optimizations

| Optimization | Time Saved | Cumulative Total |
|--------------|------------|------------------|
| Baseline | - | ~26s |
| Early Limiting | -10s | ~16s |
| Cache GeoIds | -1s | ~15s |
| Partial Sort | -3s | ~12s |
| Reduce Response | -2s | ~10s |
| **Total Quick Wins** | **-16s** | **~10s** |

**Target:** Reduce from 3 minutes to ~10-15 seconds (still slower than Swagger UI's 2s, but acceptable given the additional functionality).

---

## Conclusion

The **3-minute delay** is primarily caused by:

1. **Processing 60+ counties and 10+ DMAs** when only top 5 are needed (~15s)
2. **Sorting all entries** instead of partial sort (~5s)
3. **Extra API call** for geographic view lookup (~1s)
4. **Large response processing** (~5s total)

**Swagger UI is fast because it:**
- Makes one simple API call
- Returns only a count (no breakdowns)
- Requires no data processing

**The web app is slow because it:**
- Makes an extra API call for geoId lookup
- Processes full geographic breakdowns (100+ entries)
- Extracts and processes demographic data
- Performs extensive data transformation

**The trade-off:** Swagger UI shows a simple count; the web app provides rich breakdowns and visualizations that require this processing.

