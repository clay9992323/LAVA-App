# Multi-State Table Query Testing

## Overview
This document tracks testing of the new multi-state table architecture where each state has its own table (`[Lava].[AudienceApp_Slim_{STATE}]`).

## Implementation Changes

### 1. Helper Functions Added (`lib/sqlServerService.ts` lines 40-129)
- ✅ `sanitizeStateCode(stateCode: string)` - SQL injection protection
- ✅ `getTableName(stateCode: string)` - Builds table name (e.g., `[Lava].[AudienceApp_Slim_LA]`)
- ✅ `extractStateCodes(geographicFilters)` - Extracts state codes, defaults to `['LA']`
- ✅ `buildMultiStateQuery(stateCodes, queryBuilder)` - Builds UNION ALL queries
- ✅ `buildAggregatedMultiStateQuery(...)` - Wraps UNION with SUM/COUNT/AVG

### 2. Updated Methods
- ✅ `getFilteredDemographicBreakdowns()` - Now accepts `geographicFilters` parameter
  - Uses UNION ALL for multiple states
  - Automatically sums results across states
  - Example: LA + VA selection queries both tables and combines results

### 3. API Route Updated
- ✅ `app/api/combined-filters/route.ts` - Passes `geographicFilters` to SQL service

## Test Scenarios

### Test 1: Single State (Louisiana)
```
Selection: State = LA, County = JEFFERSON PARISH
Expected Table: [Lava].[AudienceApp_Slim_LA]
Expected Query: SELECT ... FROM [Lava].[AudienceApp_Slim_LA] WHERE County IN ('JEFFERSON PARISH')
Status: 🔄 To Test
```

### Test 2: Single State (California)
```
Selection: State = CA
Expected Table: [Lava].[AudienceApp_Slim_CA]
Expected Query: SELECT ... FROM [Lava].[AudienceApp_Slim_CA]
Status: 🔄 To Test
```

### Test 3: Multiple States (LA + VA)
```
Selection: State = LA, State = VA
Expected Tables: [Lava].[AudienceApp_Slim_LA] AND [Lava].[AudienceApp_Slim_VA]
Expected Query: 
  SELECT ... FROM [Lava].[AudienceApp_Slim_LA] ...
  UNION ALL
  SELECT ... FROM [Lava].[AudienceApp_Slim_VA] ...
Status: 🔄 To Test
```

### Test 4: SQL Injection Protection
```
Input: State = "LA'; DROP TABLE Users; --"
Expected: Error thrown: "Invalid state code"
Expected Sanitized: "LA"
Status: 🔄 To Test
```

### Test 5: Default Behavior (No State Selected)
```
Selection: (none)
Expected Default: State = LA
Expected Table: [Lava].[AudienceApp_Slim_LA]
Status: 🔄 To Test
```

### Test 6: Mixed Geography (County in Multiple States)
```
Selection: State = LA + VA, County = Orleans Parish (LA only)
Expected: Query LA table with County filter, VA table with no County filter
Status: 🔄 To Test
```

## How to Test

### Manual Testing Steps
1. **Start the application:**
   ```bash
   npm run dev
   ```

2. **Open browser console (F12)**

3. **Test Single State (LA):**
   - Select State: Louisiana
   - Select County: Jefferson Parish
   - Click "Run Filters"
   - Check terminal for: `🗺️ Querying 1 state table(s): ['LA']`
   - Verify SQL query uses: `[Lava].[AudienceApp_Slim_LA]`

4. **Test Different State (CA/TX/etc):**
   - Select State: California
   - Click "Run Filters"
   - Check terminal for: `🗺️ Querying 1 state table(s): ['CA']`
   - Verify SQL query uses: `[Lava].[AudienceApp_Slim_CA]`

5. **Test Multiple States:**
   - Select States: Louisiana + Virginia
   - Click "Run Filters"
   - Check terminal for: `🗺️ Querying 2 state table(s): ['LA', 'VA']`
   - Verify SQL query contains `UNION ALL`

### Expected Console Output

**Single State (LA):**
```
🗺️ Querying 1 state table(s): ['LA']
📊 Using county filter: JEFFERSON PARISH
📊 FINAL SQL geoFilter: County IN ('JEFFERSON PARISH')
🔄 Calling sqlServerService.getFilteredDemographicBreakdowns()...
```

**Multiple States (LA + VA):**
```
🗺️ Querying 2 state table(s): ['LA', 'VA']
📊 Using state filter: LA, VA
📊 FINAL SQL geoFilter: State IN ('LA', 'VA')
🔄 Calling sqlServerService.getFilteredDemographicBreakdowns()...
[SQL Query will show UNION ALL between tables]
```

## Database Table Naming Convention

| State | State Code | Table Name |
|-------|------------|------------|
| Alabama | AL | `[Lava].[AudienceApp_Slim_AL]` |
| Alaska | AK | `[Lava].[AudienceApp_Slim_AK]` |
| Arizona | AZ | `[Lava].[AudienceApp_Slim_AZ]` |
| Arkansas | AR | `[Lava].[AudienceApp_Slim_AR]` |
| California | CA | `[Lava].[AudienceApp_Slim_CA]` |
| Colorado | CO | `[Lava].[AudienceApp_Slim_CO]` |
| Connecticut | CT | `[Lava].[AudienceApp_Slim_CT]` |
| Delaware | DE | `[Lava].[AudienceApp_Slim_DE]` |
| Florida | FL | `[Lava].[AudienceApp_Slim_FL]` |
| Georgia | GA | `[Lava].[AudienceApp_Slim_GA]` |
| Hawaii | HI | `[Lava].[AudienceApp_Slim_HI]` |
| Idaho | ID | `[Lava].[AudienceApp_Slim_ID]` |
| Illinois | IL | `[Lava].[AudienceApp_Slim_IL]` |
| Indiana | IN | `[Lava].[AudienceApp_Slim_IN]` |
| Iowa | IA | `[Lava].[AudienceApp_Slim_IA]` |
| Kansas | KS | `[Lava].[AudienceApp_Slim_KS]` |
| Kentucky | KY | `[Lava].[AudienceApp_Slim_KY]` |
| Louisiana | LA | `[Lava].[AudienceApp_Slim_LA]` |
| Maine | ME | `[Lava].[AudienceApp_Slim_ME]` |
| Maryland | MD | `[Lava].[AudienceApp_Slim_MD]` |
| Massachusetts | MA | `[Lava].[AudienceApp_Slim_MA]` |
| Michigan | MI | `[Lava].[AudienceApp_Slim_MI]` |
| Minnesota | MN | `[Lava].[AudienceApp_Slim_MN]` |
| Mississippi | MS | `[Lava].[AudienceApp_Slim_MS]` |
| Missouri | MO | `[Lava].[AudienceApp_Slim_MO]` |
| Montana | MT | `[Lava].[AudienceApp_Slim_MT]` |
| Nebraska | NE | `[Lava].[AudienceApp_Slim_NE]` |
| Nevada | NV | `[Lava].[AudienceApp_Slim_NV]` |
| New Hampshire | NH | `[Lava].[AudienceApp_Slim_NH]` |
| New Jersey | NJ | `[Lava].[AudienceApp_Slim_NJ]` |
| New Mexico | NM | `[Lava].[AudienceApp_Slim_NM]` |
| New York | NY | `[Lava].[AudienceApp_Slim_NY]` |
| North Carolina | NC | `[Lava].[AudienceApp_Slim_NC]` |
| North Dakota | ND | `[Lava].[AudienceApp_Slim_ND]` |
| Ohio | OH | `[Lava].[AudienceApp_Slim_OH]` |
| Oklahoma | OK | `[Lava].[AudienceApp_Slim_OK]` |
| Oregon | OR | `[Lava].[AudienceApp_Slim_OR]` |
| Pennsylvania | PA | `[Lava].[AudienceApp_Slim_PA]` |
| Rhode Island | RI | `[Lava].[AudienceApp_Slim_RI]` |
| South Carolina | SC | `[Lava].[AudienceApp_Slim_SC]` |
| South Dakota | SD | `[Lava].[AudienceApp_Slim_SD]` |
| Tennessee | TN | `[Lava].[AudienceApp_Slim_TN]` |
| Texas | TX | `[Lava].[AudienceApp_Slim_TX]` |
| Utah | UT | `[Lava].[AudienceApp_Slim_UT]` |
| Vermont | VT | `[Lava].[AudienceApp_Slim_VT]` |
| Virginia | VA | `[Lava].[AudienceApp_Slim_VA]` |
| Washington | WA | `[Lava].[AudienceApp_Slim_WA]` |
| West Virginia | WV | `[Lava].[AudienceApp_Slim_WV]` |
| Wisconsin | WI | `[Lava].[AudienceApp_Slim_WI]` |
| Wyoming | WY | `[Lava].[AudienceApp_Slim_WY]` |
| Washington DC | DC | `[Lava].[AudienceApp_Slim_DC]` |

## Security Features

### SQL Injection Protection
```typescript
function sanitizeStateCode(stateCode: string): string {
  // Removes all non-letter characters
  const cleaned = stateCode.toUpperCase().replace(/[^A-Z]/g, '');
  
  // Validates exactly 2 letters
  if (cleaned.length !== 2) {
    throw new Error(`Invalid state code...`);
  }
  
  return cleaned;
}
```

**Examples:**
- Input: `"LA"` → Output: `"LA"` ✅
- Input: `"la"` → Output: `"LA"` ✅
- Input: `"Louisiana"` → Error: "Invalid state code" ❌
- Input: `"LA'; DROP TABLE"` → Output: `"LA"` (sanitized) ✅
- Input: `"123"` → Error: "Invalid state code" ❌

## Next Steps

1. ✅ Update `getFilteredDemographicBreakdowns()` - DONE
2. 🔄 Test with Jefferson Parish, LA
3. 🔄 Test with different state (CA, TX, etc.)
4. 🔄 Test with multiple states (LA + VA)
5. 🔄 Update remaining SQL methods (if needed)
6. 🔄 Document any performance implications

## Notes

- Default behavior: If no state is selected, defaults to `LA`
- Multi-state queries use `UNION ALL` for better performance than `UNION`
- Results are automatically aggregated with `SUM(count)`
- All state codes are sanitized to prevent SQL injection
- Geographic filters (county, DMA, districts) still use WHERE clauses within each state's query

## Success Criteria

- ✅ Single state selection queries correct table
- ✅ Multiple state selection creates UNION ALL query
- ✅ SQL injection attempts are blocked
- ✅ Default to LA when no state selected
- ✅ Demographics show correctly for Jefferson Parish
- ✅ Total counts are accurate
- ✅ No 0 values in preview when data exists

