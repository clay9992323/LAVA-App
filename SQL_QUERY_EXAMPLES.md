# SQL Query Examples - Audience Builder

This document contains example SQL queries for different types of filter selections used in the Audience Builder application.

## Table Structure
All queries use the `[Lava].[AudienceApp_Slim]` table which contains pre-aggregated voter data.

---

## 1. Basic Geographic Filter (State Selection)

**Filter Selections:**
- **Geographic Filters:**
  - States: LA, VA
- **Universe Filters:** None

```sql
SELECT SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] 
WHERE (State IN ('LA', 'VA'))
```

**Use Case:** User selects LA and VA from the state dropdown.

---

## 2. Universe Filter Only (Single Selection - High Engagement)

**Filter Selections:**
- **Geographic Filters:** None
- **Universe Filters:**
  - Engagement High

```sql
SELECT SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] 
WHERE (engagement_high = '1')
```

**Use Case:** User selects only "Engagement High" universe filter.

---

## 3. Multiple Universe Filters with AND Operator

**Filter Selections:**
- **Geographic Filters:** None
- **Universe Filters:**
  - Engagement High
  - Social Media Heavy User
  - High Turnout
- **Operator:** AND

```sql
SELECT SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] 
WHERE (engagement_high = '1' AND socialmediaheavyuser = '1' AND turnouthigh = '1')
```

**Use Case:** User selects multiple universe filters (High Engagement, Social Media Heavy User, High Turnout) with AND operator - only voters matching ALL criteria.

---

## 4. Multiple Universe Filters with OR Operator

**Filter Selections:**
- **Geographic Filters:** None
- **Universe Filters:**
  - Engagement High
  - Engagement Mid
  - Engagement Low
- **Operator:** OR

```sql
SELECT SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] 
WHERE (engagement_high = '1' OR engagement_mid = '1' OR engagement_low = '1')
```

**Use Case:** User selects multiple universe filters with OR operator - voters matching ANY criteria.

---

## 5. Combined Universe + Geographic (AND operator)

**Filter Selections:**
- **Geographic Filters:**
  - States: LA, VA
  - Counties: Orleans, Fairfax
- **Universe Filters:**
  - Engagement High
  - Facebook User
- **Operator:** AND

```sql
SELECT SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] 
WHERE (engagement_high = '1' AND socialmediauserfacebook = '1') 
  AND (State IN ('LA', 'VA') AND County IN ('Orleans', 'Fairfax'))
```

**Use Case:** User selects universe filters (High Engagement AND Facebook User) combined with geographic filters (LA/VA AND Orleans/Fairfax counties).

---

## 6. Combined Universe + Geographic (OR operator)

**Filter Selections:**
- **Geographic Filters:**
  - States: LA
  - DMAs: New Orleans
- **Universe Filters:**
  - Engagement High
  - Engagement Mid
- **Operator:** OR

```sql
SELECT SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] 
WHERE (engagement_high = '1' OR engagement_mid = '1') 
  AND (State IN ('LA') AND DMA IN ('New Orleans'))
```

**Use Case:** User selects universe filters with OR operator (High OR Mid Engagement) combined with geographic filters (LA AND New Orleans DMA).

---

## 7. Geographic-Only Total Count (No Universe Filters)

**Example 7a - No Filters:**

**Filter Selections:**
- **Geographic Filters:** None
- **Universe Filters:** None

```sql
SELECT SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim]
```

**Use Case:** No filters selected - returns total audience count.

---

**Example 7b - State Filter Only:**

**Filter Selections:**
- **Geographic Filters:**
  - States: LA
- **Universe Filters:** None

```sql
SELECT SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] 
WHERE (State IN ('LA'))
```

**Use Case:** Only geographic filter selected (LA), no universe filters.

---

## 8. Demographic Breakdown Query (Consolidated)

**Filter Selections:**
- **Geographic Filters:** None
- **Universe Filters:** None
- **Query Type:** Initial stats for visualization panels

```sql
SELECT 'gender' as category, Gender as value, SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] WITH (NOLOCK) 
WHERE Gender IS NOT NULL 
GROUP BY Gender

UNION ALL

SELECT 'age' as category, AgeRange as value, SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] WITH (NOLOCK) 
WHERE AgeRange IS NOT NULL 
GROUP BY AgeRange

UNION ALL

SELECT 'ethnicity' as category, Ethnicity as value, SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] WITH (NOLOCK) 
WHERE Ethnicity IS NOT NULL 
GROUP BY Ethnicity

UNION ALL

SELECT 'education' as category, Education as value, SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] WITH (NOLOCK) 
WHERE Education IS NOT NULL 
GROUP BY Education

UNION ALL

SELECT 'income' as category, Income as value, SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] WITH (NOLOCK) 
WHERE Income IS NOT NULL 
GROUP BY Income

OPTION (MAXDOP 4, RECOMPILE)
```

**Use Case:** Get all demographic breakdowns (gender, age, ethnicity, education, income) in a single consolidated query. Used for visualization panels.

---

## 9. Geographic Options Query (Cascading Dropdowns)

**Filter Selections:**
- **Geographic Filters (Pre-selected):**
  - States: LA, VA
- **Universe Filters:** None
- **Query Type:** Populate cascading dropdown options

```sql
SELECT 'states' as category, State as value, SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] 
WHERE State IS NOT NULL 
GROUP BY State

UNION ALL

SELECT 'counties' as category, County as value, SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] 
WHERE State IN ('LA', 'VA') AND County IS NOT NULL 
GROUP BY County

UNION ALL

SELECT 'dmas' as category, DMA as value, SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] 
WHERE State IN ('LA', 'VA') AND DMA IS NOT NULL 
GROUP BY DMA

ORDER BY category, count DESC
```

**Use Case:** Populate cascading geographic dropdowns. When states are selected (LA, VA), filter counties and DMAs to only show options within those states.

---

## 10. Filtered Breakdown with Universe + Geographic Filters

**Filter Selections:**
- **Geographic Filters:**
  - States: LA
- **Universe Filters:**
  - Engagement High
  - Engagement Mid
- **Operator:** OR
- **Query Type:** Get breakdowns for visualization panels

```sql
SELECT 
  -- Engagement breakdown
  SUM(CASE WHEN engagement_high = '1' THEN VoterCount ELSE 0 END) as engagement_high,
  SUM(CASE WHEN engagement_mid = '1' THEN VoterCount ELSE 0 END) as engagement_medium,
  SUM(CASE WHEN engagement_low = '1' THEN VoterCount ELSE 0 END) as engagement_low,
  
  -- Political breakdown
  SUM(CASE WHEN Party = 'Democrat' THEN VoterCount ELSE 0 END) as political_democrat,
  SUM(CASE WHEN Party = 'Republican' THEN VoterCount ELSE 0 END) as political_republican,
  SUM(CASE WHEN Party = 'Independent/Other' THEN VoterCount ELSE 0 END) as political_independent,
  
  -- Media consumption breakdown
  SUM(CASE WHEN socialmediaheavyuser = '1' THEN VoterCount ELSE 0 END) as media_socialmediaheavyuser,
  SUM(CASE WHEN socialmediauserfacebook = '1' THEN VoterCount ELSE 0 END) as media_socialmediauserfacebook,
  SUM(CASE WHEN socialmediauserinstagram = '1' THEN VoterCount ELSE 0 END) as media_socialmediauserinstagram,
  SUM(CASE WHEN socialmediauserx = '1' THEN VoterCount ELSE 0 END) as media_socialmediauserx,
  SUM(CASE WHEN socialmediauseryoutube = '1' THEN VoterCount ELSE 0 END) as media_socialmediauseryoutube
FROM [Lava].[AudienceApp_Slim] WITH (NOLOCK) 
WHERE (engagement_high = '1' OR engagement_mid = '1') 
  AND (State IN ('LA'))
OPTION (MAXDOP 4, RECOMPILE)
```

**Use Case:** Get engagement, political, and media consumption breakdowns for filtered audience (High OR Mid Engagement in LA). Used to update visualization panels when filters are applied.

---

## 11. Individual Universe Field Counts Query

**Filter Selections:**
- **Geographic Filters:**
  - States: LA, VA
- **Universe Filters (being counted individually):**
  - Engagement High
  - Social Media Heavy User
  - High Turnout
- **Query Type:** Get individual counts for each universe filter

```sql
SELECT 
  SUM(CASE WHEN engagement_high = '1' THEN VoterCount ELSE 0 END) as engagement_high,
  SUM(CASE WHEN socialmediaheavyuser = '1' THEN VoterCount ELSE 0 END) as socialmediaheavyuser,
  SUM(CASE WHEN turnouthigh = '1' THEN VoterCount ELSE 0 END) as turnouthigh
FROM [Lava].[AudienceApp_Slim]
WHERE (State IN ('LA', 'VA'))
```

**Use Case:** Get individual counts for each selected universe filter within geographic boundaries (LA and VA). Used to show how many voters match each individual criterion.

---

## 12. Filtered Demographics with Applied Filters

**Filter Selections:**
- **Geographic Filters:** None
- **Universe Filters:**
  - Engagement High
- **Query Type:** Get demographic breakdowns for filtered audience

```sql
SELECT 'gender' as category, Gender as value, SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] WITH (NOLOCK) 
WHERE (engagement_high = '1') AND Gender IS NOT NULL 
GROUP BY Gender

UNION ALL

SELECT 'age' as category, AgeRange as value, SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] WITH (NOLOCK) 
WHERE (engagement_high = '1') AND AgeRange IS NOT NULL 
GROUP BY AgeRange

UNION ALL

SELECT 'ethnicity' as category, Ethnicity as value, SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] WITH (NOLOCK) 
WHERE (engagement_high = '1') AND Ethnicity IS NOT NULL 
GROUP BY Ethnicity

UNION ALL

SELECT 'education' as category, Education as value, SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] WITH (NOLOCK) 
WHERE (engagement_high = '1') AND Education IS NOT NULL 
GROUP BY Education

UNION ALL

SELECT 'income' as category, Income as value, SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] WITH (NOLOCK) 
WHERE (engagement_high = '1') AND Income IS NOT NULL 
GROUP BY Income

OPTION (MAXDOP 4, RECOMPILE)
```

**Use Case:** Get demographic breakdowns for a filtered audience (e.g., only High Engagement voters). Shows demographic composition of the filtered subset.

---

## 13. Geographic Breakdown with Applied Filters

**Filter Selections:**
- **Geographic Filters:** None (getting all geographic data)
- **Universe Filters:**
  - Engagement High
  - Social Media Heavy User
- **Operator:** AND
- **Query Type:** Get geographic distribution for filtered audience

```sql
SELECT 'state' as category, State as value, SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] 
WHERE (engagement_high = '1' AND socialmediaheavyuser = '1') AND State IS NOT NULL 
GROUP BY State

UNION ALL

SELECT 'county' as category, County as value, SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] 
WHERE (engagement_high = '1' AND socialmediaheavyuser = '1') AND County IS NOT NULL 
GROUP BY County

UNION ALL

SELECT 'dma' as category, DMA as value, SUM(VoterCount) as count 
FROM [Lava].[AudienceApp_Slim] 
WHERE (engagement_high = '1' AND socialmediaheavyuser = '1') AND DMA IS NOT NULL 
GROUP BY DMA

ORDER BY category, count DESC
```

**Use Case:** Get geographic distribution of filtered audience (e.g., High Engagement AND Social Media Heavy Users). Shows where these voters are located.

---

## 14. Initial Stats Query (All Universe Filters)

**Filter Selections:**
- **Geographic Filters:** None
- **Universe Filters:** None (counting all available universe filters)
- **Query Type:** Initial page load - populate universe filter counts in UI

```sql
SELECT 
  SUM(CASE WHEN engagement_high = '1' THEN VoterCount ELSE 0 END) as engagement_high,
  SUM(CASE WHEN engagement_mid = '1' THEN VoterCount ELSE 0 END) as engagement_mid,
  SUM(CASE WHEN engagement_low = '1' THEN VoterCount ELSE 0 END) as engagement_low,
  SUM(CASE WHEN engagementcontact = '1' THEN VoterCount ELSE 0 END) as engagementcontact,
  SUM(CASE WHEN engagementcurrentevents = '1' THEN VoterCount ELSE 0 END) as engagementcurrentevents,
  SUM(CASE WHEN ideologyfiscalcons = '1' THEN VoterCount ELSE 0 END) as ideologyfiscalcons,
  SUM(CASE WHEN ideologyfiscalprog = '1' THEN VoterCount ELSE 0 END) as ideologyfiscalprog,
  SUM(CASE WHEN likelytogivepii = '1' THEN VoterCount ELSE 0 END) as likelytogivepii,
  SUM(CASE WHEN likelyvotersdemocrat = '1' THEN VoterCount ELSE 0 END) as likelyvotersdemocrat,
  SUM(CASE WHEN likelyvotersrepublican = '1' THEN VoterCount ELSE 0 END) as likelyvotersrepublican,
  SUM(CASE WHEN persuasion = '1' THEN VoterCount ELSE 0 END) as persuasion,
  SUM(CASE WHEN socialmediaheavyuser = '1' THEN VoterCount ELSE 0 END) as socialmediaheavyuser,
  SUM(CASE WHEN socialmediauserfacebook = '1' THEN VoterCount ELSE 0 END) as socialmediauserfacebook,
  SUM(CASE WHEN socialmediauserinstagram = '1' THEN VoterCount ELSE 0 END) as socialmediauserinstagram,
  SUM(CASE WHEN socialmediauserx = '1' THEN VoterCount ELSE 0 END) as socialmediauserx,
  SUM(CASE WHEN socialmediauseryoutube = '1' THEN VoterCount ELSE 0 END) as socialmediauseryoutube,
  SUM(CASE WHEN taxstadiumsupport = '1' THEN VoterCount ELSE 0 END) as taxstadiumsupport,
  SUM(CASE WHEN turnouthigh = '1' THEN VoterCount ELSE 0 END) as turnouthigh
FROM [Lava].[AudienceApp_Slim]
```

**Use Case:** Get counts for all universe filters on initial page load. Used to populate filter counts in the UI.

---

## Key Query Patterns

### 1. Boolean Field Filters
Universe filters (engagement, media consumption, etc.) use:
```sql
WHERE field_name = '1'
```

### 2. Geographic Filters
Multiple value selections use:
```sql
WHERE State IN ('LA', 'VA', 'TX')
```

### 3. Aggregation
Since data is pre-aggregated, use:
```sql
SUM(VoterCount) as count
```

### 4. Performance Optimization
```sql
WITH (NOLOCK)                    -- Read uncommitted data
OPTION (MAXDOP 4, RECOMPILE)     -- Limit parallelism, recompile for better plans
```

### 5. Consolidated Queries
Use `UNION ALL` to combine multiple queries:
```sql
SELECT 'category1' as category, ... FROM table WHERE ...
UNION ALL
SELECT 'category2' as category, ... FROM table WHERE ...
```

### 6. Conditional Aggregation
Use `CASE WHEN` for multiple aggregations in one query:
```sql
SUM(CASE WHEN field = '1' THEN VoterCount ELSE 0 END) as field_count
```

---

## Database Schema Notes

### Table: `[Lava].[AudienceApp_Slim]`

**Demographic Fields:**
- `Gender`, `AgeRange`, `Ethnicity`, `Education`, `Income`, `Party`

**Geographic Fields:**
- `State`, `County`, `DMA`, `ZipCode`

**Universe/Boolean Fields (stored as '1' or NULL/empty):**
- `engagement_high`, `engagement_mid`, `engagement_low`
- `engagementcontact`, `engagementcurrentevents`
- `ideologyfiscalcons`, `ideologyfiscalprog`
- `likelytogivepii`, `likelyvotersdemocrat`, `likelyvotersrepublican`
- `persuasion`
- `socialmediaheavyuser`, `socialmediauserfacebook`, `socialmediauserinstagram`, `socialmediauserx`, `socialmediauseryoutube`
- `taxstadiumsupport`, `turnouthigh`

**Aggregation Field:**
- `VoterCount` - Pre-aggregated count of voters for each unique combination

**Note:** The following fields referenced in some filter configs do NOT exist in the database:
- `StateSenateDistrict`, `StateHouseDistrict`
- `partydemocrat`, `partyrepublican`
- `allvotersnoharddem`, `allvotersnohardgop`

---

## Query Execution Notes

1. All queries are logged with timing information in the server console
2. Default query timeout is 60 seconds (60,000ms)
3. Queries use connection pooling from `database.js`
4. SQL injection is prevented through proper escaping of string values
5. Empty results return 0 counts, not errors

---

Generated: October 10, 2025

