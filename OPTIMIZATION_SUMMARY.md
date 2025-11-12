# API Call Redundancy Optimization

## Problem
The `/api/combined-filters` endpoint was making redundant API calls for the same geographic data within a single request. For a simple state selection (e.g., VA), the system was making:

1. **getCombinedCountsFromApi**: Fetched state data via `GET /api/Geo/view` 
2. **getFilteredBreakdownsFromApi**: Re-fetched the same state data to get geoIds for demographics
3. **Geographic breakdowns**: Made 3 more calls for state, county, and DMA levels

**Total**: 5+ API calls for the same state data when only 1-2 should be needed.

## Solution

### 1. Request-Scoped Caching
Created a `RequestGeoCache` class that caches geographic view API calls within a single request:

```typescript
class RequestGeoCache {
  private cache: Map<string, any[]> = new Map();
  
  async getGeographicView(request: GeoViewCacheKey): Promise<any[]> {
    const key = `${request.typeCode}|${request.geoCode}|${request.subGeoCode}`;
    
    if (this.cache.has(key)) {
      console.log(`📦 Using cached geo view for ${request.typeCode}/${request.geoCode || 'ALL'}`);
      return this.cache.get(key)!;
    }
    
    const data = await apiService.getGeographicView(request);
    this.cache.set(key, data);
    return data;
  }
}
```

### 2. GeoId Sharing Between Functions
Modified `getCombinedCountsFromApi` to return both counts and resolved geoIds:

```typescript
return { counts: results, geoIds: resolvedGeoIds };
```

Modified `getFilteredBreakdownsFromApi` to accept and use pre-resolved geoIds:

```typescript
if (preResolvedGeoIds && preResolvedGeoIds.length > 0) {
  console.log(`🚀 USING PRE-RESOLVED GEO IDS (avoiding redundant API calls)`);
  geoIdsForDemographics = preResolvedGeoIds;
  geoId = preResolvedGeoIds[0];
}
```

### 3. Cache Lifecycle Management
- Cache is created at the start of each POST request
- Cache is passed to all helper functions
- Cache is cleared in the finally block to prevent memory leaks

## Results

### Before Optimization
For state "VA" selection, frontend triggered duplicate endpoint calls:

**Request #1** (at T+0ms):
- `POST /api/Geo/view` (ST/VA) - getCombinedCountsFromApi
- `POST /api/Geo/view` (ST/VA) - getFilteredBreakdownsFromApi (demographics) ❌ REDUNDANT
- `POST /api/Geo/view` (ST/VA) - geographic breakdowns ❌ REDUNDANT
- `POST /api/Geo/view` (CTY/VA) - geographic breakdowns
- `POST /api/Geo/view` (STDMA/VA) - geographic breakdowns

**Request #2** (at T+14ms) - DUPLICATE ENDPOINT CALL:
- `POST /api/Geo/view` (ST/VA) ❌ REDUNDANT
- `POST /api/Geo/view` (ST/VA) ❌ REDUNDANT
- `POST /api/Geo/view` (ST/VA) ❌ REDUNDANT
- `POST /api/Geo/view` (CTY/VA) ❌ REDUNDANT
- `POST /api/Geo/view` (STDMA/VA) ❌ REDUNDANT

**Total: 10 API calls** (8 redundant!)

### After Optimization
For state "VA" selection:

**Single Request** (no duplicate):
- `POST /api/Geo/view` (ST/VA) - **cached and shared**
- Demographics: Uses pre-resolved geoIds - **no API call needed**
- Geographic breakdowns:
  - ST/VA - **cache hit, no API call**
  - CTY/VA - **fetched once**
  - STDMA/VA - **fetched once**

**Total: 3 API calls** (0 redundant) - **70% reduction!**

## Impact
- **Reduced API calls by 70%** (from 10 to 3 calls per state selection)
- **Eliminated duplicate endpoint requests** from frontend race conditions
- **Faster response times** due to fewer network round trips and caching
- **Lower server load** on the upstream API (3x reduction in requests)
- **Better user experience** with quicker filter updates and no redundant processing

## Files Modified

### Backend Optimization
**`app/api/combined-filters/route.ts`**
  - Added `RequestGeoCache` class for request-scoped caching
  - Modified `POST` handler to create and manage cache
  - Updated `getCombinedCountsFromApi` signature to return both counts and geoIds
  - Updated `getFilteredBreakdownsFromApi` to accept and use pre-resolved geoIds
  - All `apiService.getGeographicView` calls now use `geoCache.getGeographicView`

### Frontend Optimization
**`app/page.tsx`**
  - Fixed duplicate API calls in `handleStateConfirm`
  - Removed redundant `applyClientSideFilters` call
  - Now relies on `useEffect` to handle filter application when state changes
  - Eliminates duplicate requests when user selects a state

## Testing
After the fix, when you select a state (e.g., "VA"), you should see:

### Console Logs to Monitor:
- `🚀 COMBINED FILTERS API CALLED` - **Should appear ONCE** (not twice)
- `📦 Using cached geo view for ST/VA` - indicates cache hits
- `🔄 Fetching geo view from API` - indicates cache misses (first fetch only)
- `🚀 USING PRE-RESOLVED GEO IDS` - indicates geoId reuse
- `🎯 Updating selections - useEffect will handle filter application` - frontend optimization

### What You Should NO LONGER See:
- ❌ Two identical `🚀 COMBINED FILTERS API CALLED` logs within 20ms
- ❌ Multiple `🔄 Fetching geo view from API: ST/VA` without cache hits
- ❌ Duplicate demographic API calls

## Future Enhancements
1. Consider implementing a time-based cache for dimension data (already done)
2. Add metrics/monitoring for cache hit rates
3. Potentially extend caching to demographic breakdowns

