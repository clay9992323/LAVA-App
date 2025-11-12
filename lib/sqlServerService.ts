import { CombinedPersonData } from '@/types/audience';

// Import the database connection from database.js
const db = require('../database.js');

// Utility function for logging SQL queries with timing
function logQuery(query: string, description?: string): void {
  const timestamp = new Date().toISOString();
  const desc = description ? `${description}` : 'SQL Query';
  console.log('\n' + '─'.repeat(80));
  console.log(`📊 SQL QUERY: ${desc}`);
  console.log('─'.repeat(80));
  console.log(query);
  console.log('─'.repeat(80));
  console.log(`🕐 Started at: ${timestamp}`);
}

// Utility function for logging query execution time
function logQueryTime(startTime: number, description?: string): void {
  const duration = Date.now() - startTime;
  const durationInSeconds = (duration / 1000).toFixed(2);
  const desc = description ? `${description}` : 'Query';
  console.log(`⏱️  ${desc} completed in ${durationInSeconds}s`);
  console.log('─'.repeat(80) + '\n');
}

// Helper function for optimized queries with extended timeout
async function executeOptimizedQuery(pool: any, query: string, description: string, timeoutMs: number = 60000): Promise<any> {
  const startTime = Date.now();
  logQuery(query, description);
  
  const request = pool.request();
  request.timeout = timeoutMs;
  const result = await request.query(query);
  
  logQueryTime(startTime, description);
  return result;
}

// =============================================================================
// DYNAMIC TABLE NAME HELPERS (Multi-State Support)
// =============================================================================

/**
 * Sanitizes a state code to prevent SQL injection
 * Only allows 2-letter uppercase codes (e.g., LA, CA, TX, VA, DC)
 */
function sanitizeStateCode(stateCode: string): string {
  // Convert to uppercase and remove any non-letter characters
  const cleaned = stateCode.toUpperCase().replace(/[^A-Z]/g, '');
  
  // Validate: must be exactly 2 letters
  if (cleaned.length !== 2) {
    throw new Error(`Invalid state code: "${stateCode}". Must be 2 letters (e.g., LA, CA, TX).`);
  }
  
  return cleaned;
}

/**
 * Builds a table name for a specific state
 * Example: getTableName('LA') => '[Lava].[AudienceApp_Slim_LA]'
 */
function getTableName(stateCode: string): string {
  const sanitized = sanitizeStateCode(stateCode);
  return `[Lava].[AudienceApp_Slim_${sanitized}]`;
}

/**
 * Extracts state codes from geographic filters
 * Returns array of state codes, defaults to ['LA'] if none provided
 */
function extractStateCodes(geographicFilters?: { state?: string[] }): string[] {
  const states = geographicFilters?.state || [];
  
  // Default to LA if no states specified
  if (states.length === 0) {
    console.log('⚠️ No states specified, defaulting to LA');
    return ['LA'];
  }
  
  // Sanitize all state codes
  return states.map(s => sanitizeStateCode(s));
}

/**
 * Builds a UNION ALL query for multiple states
 * Example: buildMultiStateQuery(
 *   ['LA', 'VA'],
 *   (table) => `SELECT COUNT(*) as count FROM ${table}`
 * )
 * Returns: SELECT COUNT(*) as count FROM [Lava].[AudienceApp_Slim_LA]
 *          UNION ALL
 *          SELECT COUNT(*) as count FROM [Lava].[AudienceApp_Slim_VA]
 */
function buildMultiStateQuery(
  stateCodes: string[],
  queryBuilder: (tableName: string, stateCode: string, index: number) => string
): string {
  if (stateCodes.length === 0) {
    throw new Error('At least one state code is required');
  }
  
  const queries = stateCodes.map((code, index) => {
    const tableName = getTableName(code);
    return queryBuilder(tableName, code, index);
  });
  
  return queries.join('\nUNION ALL\n');
}

/**
 * Wraps a multi-state UNION query with aggregation
 * Example: For count queries that need to be summed across states
 */
function buildAggregatedMultiStateQuery(
  stateCodes: string[],
  queryBuilder: (tableName: string, stateCode: string, index: number) => string,
  aggregationType: 'SUM' | 'COUNT' | 'AVG' = 'SUM'
): string {
  const unionQuery = buildMultiStateQuery(stateCodes, queryBuilder);
  
  return `
    SELECT ${aggregationType}(count) as total
    FROM (
      ${unionQuery}
    ) AS combined_results
  `;
}

class SqlServerService {
  private isConnected = false;

  async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      await db.connect();
      this.isConnected = true;
    }
  }

  // Get paginated data with filters
  async getPaginatedData(
    page: number = 1,
    pageSize: number = 1000,
    filters?: FilterConditions[],
    sortBy?: string,
    sortOrder: 'ASC' | 'DESC' = 'ASC'
  ): Promise<{
    data: CombinedPersonData[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    await this.ensureConnection();
    const pool = db.getPool();
    
    const offset = (page - 1) * pageSize;
    
    // Build WHERE clause from filters
    const whereClause = this.buildWhereClause(filters);
    const orderClause = sortBy ? `ORDER BY ${sortBy} ${sortOrder}` : 'ORDER BY State';
    
    // Count query for total records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM [Lava].[AudienceApp_Slim_LA]
      ${whereClause}
    `;
    
    // Data query with pagination
    const dataQuery = `
      SELECT *
      FROM [Lava].[AudienceApp_Slim_LA]
      ${whereClause}
      ${orderClause}
      OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        pool.request().query(countQuery),
        pool.request().query(dataQuery)
      ]);

      const totalCount = countResult.recordset[0].total;
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        data: dataResult.recordset,
        totalCount,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      console.error('SQL Server query error:', error);
      throw new Error('Failed to fetch data from database');
    }
  }

  // Get unique values for a field (for dropdowns)
  async getUniqueValues(field: string, limit: number = 1000): Promise<string[]> {
    await this.ensureConnection();
    const pool = db.getPool();
    
    const query = `
      SELECT DISTINCT TOP(${limit}) ${field}
      FROM [Lava].[AudienceApp_Slim_LA]
      WHERE ${field} IS NOT NULL AND ${field} != ''
      ORDER BY ${field}
    `;

    try {
      const result = await pool.request().query(query);
      return result.recordset.map((row: any) => String(row[field]));
    } catch (error) {
      console.error('Error fetching unique values:', error);
      return [];
    }
  }

  // Get field statistics
  async getFieldStats(field: string): Promise<{
    min: number;
    max: number;
    unique: number;
    nullCount: number;
  }> {
    await this.ensureConnection();
    const pool = db.getPool();
    
    const query = `
      SELECT 
        MIN(${field}) as min_val,
        MAX(${field}) as max_val,
        COUNT(DISTINCT ${field}) as unique_count,
        COUNT(*) - COUNT(${field}) as null_count
      FROM [Lava].[AudienceApp_Slim_LA]
    `;

    try {
      const result = await pool.request().query(query);
      const row = result.recordset[0];
      
      return {
        min: row.min_val || 0,
        max: row.max_val || 0,
        unique: parseInt(row.unique_count),
        nullCount: parseInt(row.null_count),
      };
    } catch (error) {
      console.error('Error fetching field stats:', error);
      return { min: 0, max: 0, unique: 0, nullCount: 0 };
    }
  }

  // Get audience statistics (demographics, geography, etc.)
  async getAudienceStats(): Promise<{
    totalCount: number;
    demographics: any;
    geography: any;
    partyBreakdown: any;
    engagement: any;
    political: any;
    mediaConsumption: any;
    universe: any;
  }> {
    await this.ensureConnection();
    const pool = db.getPool();

    try {
      // Get total count
      const totalQuery = `SELECT COUNT(*) as total FROM [Lava].[AudienceApp_Slim_LA]`;
      const totalResult = await executeOptimizedQuery(pool, totalQuery, 'Total Count');
      const totalCount = totalResult.recordset[0].total;

      // Get demographic breakdowns
      const demographics = await this.getDemographicBreakdown(pool);
      
      // Get geographic breakdowns
      const geography = await this.getGeographicBreakdown(pool);
      
      // Get party breakdown
      const partyBreakdown = await this.getPartyBreakdown(pool);
      
      // Get engagement breakdown
      const engagement = await this.getEngagementBreakdown(pool);
      
      // Get political breakdown
      const political = await this.getPoliticalBreakdown(pool);
      
      // Get media consumption breakdown
      const mediaConsumption = await this.getMediaConsumptionBreakdown(pool);
      
      // Get universe filter breakdown
      const universe = await this.getUniverseBreakdown(pool);

      return {
        totalCount,
        demographics,
        geography,
        partyBreakdown,
        engagement,
        political,
        mediaConsumption,
        universe
      };
    } catch (error) {
      console.error('Error fetching audience stats:', error);
      throw error;
    }
  }

  // New method to get combined universe + geographic counts
  async getCombinedUniverseGeographicCounts(universeFields: string[], geographicFilters: { [key: string]: string[] }, operator: string = 'AND'): Promise<{ [key: string]: number }> {
    await this.ensureConnection();
    const pool = db.getPool();

    try {
      const results: { [key: string]: number } = {};

      // Build WHERE conditions for geographic filters
      const geographicConditions: string[] = [];
      Object.entries(geographicFilters).forEach(([field, values]) => {
        // Skip district fields that don't exist in database
        if (field === 'stateSenateDistrict' || field === 'stateHouseDistrict') {
          console.log(`⚠️  Skipping non-existent column: ${field}`);
          return;
        }
        
        if (values && values.length > 0) {
          const columnName = field.charAt(0).toUpperCase() + field.slice(1);
          const valueList = values.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
          geographicConditions.push(`${columnName} IN (${valueList})`);
        }
      });

      // Combine all conditions
      const allConditions = [...geographicConditions];

            // If no universe fields, return total count with geographic filters only
            if (universeFields.length === 0) {
              if (allConditions.length > 0) {
                const query = `SELECT COUNT(*) as count FROM [Lava].[AudienceApp_Slim_LA] WHERE (${allConditions.join(' AND ')})`;
                const startTime = Date.now();
                logQuery(query, 'Geographic-Only Total Count');
                const result = await pool.request().query(query);
                logQueryTime(startTime, 'Geographic-Only Total Count');
                results['total'] = parseInt(result.recordset[0].count) || 0;
              } else {
                // No filters at all - return total count
                const query = `SELECT COUNT(*) as count FROM [Lava].[AudienceApp_Slim_LA]`;
                const startTime = Date.now();
                logQuery(query, 'Total Count (No Filters)');
                const result = await pool.request().query(query);
                logQueryTime(startTime, 'Total Count (No Filters)');
                results['total'] = parseInt(result.recordset[0].count) || 0;
              }
              return results;
            }

      // Build universe conditions based on operator (AND or OR)
      const universeConditions: string[] = [];
      universeFields.forEach(field => {
        universeConditions.push(`${field} = '1'`);
      });
      
      if (universeConditions.length > 0) {
        // Use the specified operator (AND or OR) for universe conditions
        const universeOperator = operator.toUpperCase() === 'OR' ? ' OR ' : ' AND ';
        let query = `SELECT COUNT(*) as count FROM [Lava].[AudienceApp_Slim_LA] WHERE (${universeConditions.join(universeOperator)})`;
        
        if (allConditions.length > 0) {
          query += ` AND (${allConditions.join(' AND ')})`;
        }

        const startTime = Date.now();
        logQuery(query, `Combined Universe + Geographic (${operator})`);
        const result = await pool.request().query(query);
        logQueryTime(startTime, `Combined Universe + Geographic (${operator})`);
        results['total'] = parseInt(result.recordset[0].count) || 0;
        
        // Get individual counts for each universe field in a single consolidated query
        if (universeFields.length > 0) {
          const individualCaseStatements = universeFields.map(field => 
            `SUM(CASE WHEN ${field} = '1' THEN 1 ELSE 0 END) as ${field}`
          ).join(',\n            ');
          
          let individualQuery = `SELECT ${individualCaseStatements} FROM [Lava].[AudienceApp_Slim_LA]`;
          
          if (allConditions.length > 0) {
            individualQuery += ` WHERE (${allConditions.join(' AND ')})`;
          }

          const individualResult = await executeOptimizedQuery(pool, individualQuery, `Individual Universe Fields`);
          
          // Process individual results
          const individualRow = individualResult.recordset[0];
          universeFields.forEach(field => {
            results[field] = parseInt(individualRow[field]) || 0;
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error fetching combined universe geographic counts:', error);
      throw error;
    }
  }

  // New method to get ONLY geographic breakdowns via SQL (for county/district views without demo/universe filters)
  async getGeographicBreakdownsOnly(
    geographicFilters: { [key: string]: string[] },
    requestedLevels: string[] = ['state', 'county', 'dma']
  ): Promise<{
    geography: any;
  }> {
    await this.ensureConnection();
    const pool = db.getPool();

    try {
      // Build WHERE conditions for geographic filters
      const geographicConditions: string[] = [];
      const geographicConditionsWithAlias: string[] = [];
      Object.entries(geographicFilters).forEach(([field, values]) => {
        // Skip district fields that don't exist in database
        if (field === 'stateSenateDistrict' || field === 'stateHouseDistrict') {
          console.log(`⚠️  Skipping non-existent column: ${field}`);
          return;
        }
        
        // Skip State filter since we're querying state-specific tables (AudienceApp_Slim_LA)
        if (field === 'state') {
          console.log(`⚠️  Skipping State filter (already implicit in table name)`);
          return;
        }
        
        if (values && values.length > 0) {
          const columnName = field.charAt(0).toUpperCase() + field.slice(1);
          const valueList = values.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
          geographicConditions.push(`${columnName} IN (${valueList})`);
          geographicConditionsWithAlias.push(`a.${columnName} IN (${valueList})`);
        }
      });

      const fullWhereWithAlias = geographicConditionsWithAlias.length > 0 
        ? `WHERE (${geographicConditionsWithAlias.join(' AND ')})`
        : '';

      const geography: any = {};
      
      if (requestedLevels.length > 0) {
        // Build the geographic queries
        const geographicUnionQueries = requestedLevels.map(level => {
          // Map level names to database column names
          let columnName: string;
          if (level === 'zipCode') {
            columnName = 'ZipCode';
          } else if (level === 'dma') {
            columnName = 'DMA';
          } else if (level === 'congressional') {
            columnName = 'US_Congressional_District';
          } else if (level === 'stateSenateDistrict') {
            columnName = 'State_Senate_District';
          } else if (level === 'stateHouseDistrict') {
            columnName = 'State_House_District';
          } else {
            columnName = level.charAt(0).toUpperCase() + level.slice(1);
          }
          
          const topClause = level === 'zipCode' ? 'TOP(50)' : '';
          
          return `SELECT '${level}' as category, ${topClause} f.${columnName} as value, COUNT(*) as count 
                  FROM FilteredData f
                  WHERE f.${columnName} IS NOT NULL 
                  GROUP BY f.${columnName}`;
        });

        const geographicQuery = `
          WITH FilteredData AS (
            SELECT 
              a.State,
              a.County,
              a.DMA,
              a.ZipCode,
              a.US_Congressional_District,
              a.State_Senate_District,
              a.State_House_District
            FROM [Lava].[AudienceApp_Slim_LA] a WITH (NOLOCK)
            ${fullWhereWithAlias || ''}
          )
          ${geographicUnionQueries.join('\n          UNION ALL\n          ')}
          ORDER BY category, count DESC
          OPTION (MAXDOP 4, RECOMPILE)
        `;

        try {
          const startTime = Date.now();
          const result = await executeOptimizedQuery(pool, geographicQuery, `Geographic-Only Query (County/District View)`, 120000);
          const duration = Date.now() - startTime;
          console.log(`⚡ Geographic-only query completed in ${duration}ms for ${requestedLevels.length} levels`);
          
          // Process the consolidated results
          result.recordset.forEach((row: any) => {
            const category = row.category;
            const value = row.value;
            const count = parseInt(row.count) || 0;
            
            if (!geography[category]) {
              geography[category] = {};
            }
            
            if (value) {
              geography[category][value] = count;
            }
          });
        } catch (error) {
          console.error('Error fetching geographic breakdown:', error);
          // Initialize empty geography for requested levels
          requestedLevels.forEach(level => {
            geography[level] = {};
          });
        }
      }

      return { geography };
    } catch (error) {
      console.error('Error fetching geographic breakdowns only:', error);
      throw error;
    }
  }

  // New method to get filtered demographic and geographic breakdowns
  async getFilteredBreakdowns(
    universeFields: string[], 
    geographicFilters: { [key: string]: string[] }, 
    operator: string = 'AND', 
    requestedLevels: string[] = ['state', 'county', 'dma'],
    demographicFilters?: { [key: string]: string[] }
  ): Promise<{
    demographics: any;
    geography: any;
    engagement: any;
    political: any;
    mediaConsumption: any;
  }> {
    await this.ensureConnection();
    const pool = db.getPool();

    try {
      // Build WHERE conditions for universe filters based on operator
      const universeConditions: string[] = [];
      const universeConditionsWithAlias: string[] = [];
      universeFields.forEach(field => {
        universeConditions.push(`${field} = '1'`);
        universeConditionsWithAlias.push(`a.${field} = '1'`);
      });
      const universeOperator = operator.toUpperCase() === 'OR' ? ' OR ' : ' AND ';
      const universeWhere = universeConditions.join(universeOperator);
      const universeWhereWithAlias = universeConditionsWithAlias.join(universeOperator);

      // Build WHERE conditions for geographic filters
      const geographicConditions: string[] = [];
      const geographicConditionsWithAlias: string[] = [];
      Object.entries(geographicFilters).forEach(([field, values]) => {
        // Skip district fields that don't exist in database
        if (field === 'stateSenateDistrict' || field === 'stateHouseDistrict') {
          console.log(`⚠️  Skipping non-existent column: ${field}`);
          return;
        }
        
        // Skip State filter since we're querying state-specific tables (AudienceApp_Slim_LA)
        // This prevents redundant filters that can hurt index performance
        if (field === 'state') {
          console.log(`⚠️  Skipping State filter (already implicit in table name)`);
          return;
        }
        
        if (values && values.length > 0) {
          const columnName = field.charAt(0).toUpperCase() + field.slice(1);
          const valueList = values.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
          geographicConditions.push(`${columnName} IN (${valueList})`);
          geographicConditionsWithAlias.push(`a.${columnName} IN (${valueList})`);
        }
      });

      // Build JOIN and WHERE conditions for demographic filters
      const demographicJoins: string[] = [];
      const demographicConditions: string[] = [];
      
      if (demographicFilters) {
        if (demographicFilters.gender && demographicFilters.gender.length > 0) {
          demographicJoins.push(`LEFT JOIN [Lava].[dim_Gender] g_filter ON a.GenderId = g_filter.Id`);
          const valueList = demographicFilters.gender.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
          demographicConditions.push(`g_filter.Name IN (${valueList})`);
        }
        if (demographicFilters.age && demographicFilters.age.length > 0) {
          demographicJoins.push(`LEFT JOIN [Lava].[dim_AgeRange] ar_filter ON a.AgeRangeId = ar_filter.Id`);
          const valueList = demographicFilters.age.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
          demographicConditions.push(`ar_filter.Name IN (${valueList})`);
        }
        if (demographicFilters.ethnicity && demographicFilters.ethnicity.length > 0) {
          demographicJoins.push(`LEFT JOIN [Lava].[dim_Ethnicity] e_filter ON a.EthnicityId = e_filter.Id`);
          const valueList = demographicFilters.ethnicity.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
          demographicConditions.push(`e_filter.Name IN (${valueList})`);
        }
        if (demographicFilters.income && demographicFilters.income.length > 0) {
          demographicJoins.push(`LEFT JOIN [Lava].[dim_Income] i_filter ON a.IncomeId = i_filter.Id`);
          const valueList = demographicFilters.income.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
          demographicConditions.push(`i_filter.Name IN (${valueList})`);
        }
        if (demographicFilters.education && demographicFilters.education.length > 0) {
          demographicJoins.push(`LEFT JOIN [Lava].[dim_Education] ed_filter ON a.EducationId = ed_filter.Id`);
          const valueList = demographicFilters.education.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
          demographicConditions.push(`ed_filter.Name IN (${valueList})`);
        }
      }

      const demographicJoinsStr = demographicJoins.join(' ');

      // Build the WHERE clause properly
      let fullWhere = '';
      let fullWhereWithAlias = '';
      const allConditions = [...geographicConditions, ...demographicConditions];
      const allConditionsWithAlias = [...geographicConditionsWithAlias, ...demographicConditions];
      
      if (universeWhere && allConditions.length > 0) {
        fullWhere = `WHERE (${universeWhere}) AND (${allConditions.join(' AND ')})`;
        fullWhereWithAlias = `WHERE (${universeWhereWithAlias}) AND (${allConditionsWithAlias.join(' AND ')})`;
      } else if (universeWhere) {
        fullWhere = `WHERE (${universeWhere})`;
        fullWhereWithAlias = `WHERE (${universeWhereWithAlias})`;
      } else if (allConditions.length > 0) {
        fullWhere = `WHERE (${allConditions.join(' AND ')})`;
        fullWhereWithAlias = `WHERE (${allConditionsWithAlias.join(' AND ')})`;
      }

      // Get demographic breakdowns in a single consolidated query using UNION
      // OPTIMIZATION: Use CTE to filter data once, then join dimension tables for readable names
      const demographicQuery = `
        WITH FilteredData AS (
          SELECT 
            a.GenderId,
            a.AgeRangeId,
            a.EthnicityId,
            a.EducationId,
            a.IncomeId
          FROM [Lava].[AudienceApp_Slim_LA] a WITH (NOLOCK)
          ${demographicJoinsStr}
          ${fullWhereWithAlias || ''}
        )
        SELECT 'gender' as category, g.Name as value, COUNT(*) as count 
        FROM FilteredData f
        LEFT JOIN [Lava].[dim_Gender] g ON f.GenderId = g.Id
        WHERE g.Name IS NOT NULL 
        GROUP BY g.Name
        
        UNION ALL
        
        SELECT 'age' as category, ar.Name as value, COUNT(*) as count 
        FROM FilteredData f
        LEFT JOIN [Lava].[dim_AgeRange] ar ON f.AgeRangeId = ar.Id
        WHERE ar.Name IS NOT NULL 
        GROUP BY ar.Name
        
        UNION ALL
        
        SELECT 'ethnicity' as category, e.Name as value, COUNT(*) as count 
        FROM FilteredData f
        LEFT JOIN [Lava].[dim_Ethnicity] e ON f.EthnicityId = e.Id
        WHERE e.Name IS NOT NULL 
        GROUP BY e.Name
        
        UNION ALL
        
        SELECT 'education' as category, ed.Name as value, COUNT(*) as count 
        FROM FilteredData f
        LEFT JOIN [Lava].[dim_Education] ed ON f.EducationId = ed.Id
        WHERE ed.Name IS NOT NULL 
        GROUP BY ed.Name
        
        UNION ALL
        
        SELECT 'income' as category, i.Name as value, COUNT(*) as count 
        FROM FilteredData f
        LEFT JOIN [Lava].[dim_Income] i ON f.IncomeId = i.Id
        WHERE i.Name IS NOT NULL 
        GROUP BY i.Name
        OPTION (MAXDOP 4, RECOMPILE)
      `;

      const demographics: any = {};
      try {
        const startTime = Date.now();
        const result = await executeOptimizedQuery(pool, demographicQuery, `Optimized Demographic Query with CTE`, 120000); // 2 minute timeout
        const duration = Date.now() - startTime;
        console.log(`⚡ Demographic query completed in ${duration}ms`);
        
        // Process the consolidated results
        result.recordset.forEach((row: any) => {
          const category = row.category;
          const value = row.value;
          const count = parseInt(row.count) || 0;
          
          if (!demographics[category]) {
            demographics[category] = {};
          }
          
          if (value) {
            demographics[category][value] = count;
          }
        });
        } catch (error) {
        console.error('Error fetching demographic breakdown:', error);
        // Initialize empty demographics
        demographics.gender = {};
        demographics.age = {};
        demographics.ethnicity = {};
        demographics.education = {};
        demographics.income = {};
      }

      // Get geographic breakdowns for requested levels in a single consolidated query using UNION
      // OPTIMIZATION: Use CTE to filter data once, then query multiple geographic levels
      const geography: any = {};
      
      if (requestedLevels.length > 0) {
        // Build the CTE that filters the data once (applies all filters)
        const geographicUnionQueries = requestedLevels.map(level => {
          // Map level names to database column names
          let columnName: string;
          if (level === 'zipCode') {
            columnName = 'ZipCode';
          } else if (level === 'dma') {
            columnName = 'DMA';
          } else if (level === 'congressional') {
            columnName = 'US_Congressional_District';
          } else if (level === 'stateSenateDistrict') {
            columnName = 'State_Senate_District';
          } else if (level === 'stateHouseDistrict') {
            columnName = 'State_House_District';
          } else {
            columnName = level.charAt(0).toUpperCase() + level.slice(1);
          }
          
          const topClause = level === 'zipCode' ? 'TOP(50)' : '';
          
          // Query the filtered CTE instead of the base table
          return `SELECT '${level}' as category, ${topClause} f.${columnName} as value, COUNT(*) as count 
                  FROM FilteredData f
                  WHERE f.${columnName} IS NOT NULL 
                  GROUP BY f.${columnName}`;
        });

        // Build the complete query with CTE for filtering
        // OPTIMIZATION: CTE filters once, then multiple SELECTs query the filtered dataset
        // This eliminates redundant JOINs and filtering for each geographic level
        const geographicQuery = `
          WITH FilteredData AS (
            SELECT 
              a.State,
              a.County,
              a.DMA,
              a.ZipCode,
              a.US_Congressional_District,
              a.State_Senate_District,
              a.State_House_District
            FROM [Lava].[AudienceApp_Slim_LA] a WITH (NOLOCK)
            ${demographicJoinsStr}
            ${fullWhereWithAlias || ''}
          )
          ${geographicUnionQueries.join('\n          UNION ALL\n          ')}
          ORDER BY category, count DESC
          OPTION (MAXDOP 4, RECOMPILE)
        `;

        try {
          const startTime = Date.now();
          const result = await executeOptimizedQuery(pool, geographicQuery, `Optimized Geographic Query with CTE`, 120000); // 2 minute timeout
          const duration = Date.now() - startTime;
          console.log(`⚡ Geographic query completed in ${duration}ms for ${requestedLevels.length} levels`);
          
          // Process the consolidated results
          result.recordset.forEach((row: any) => {
            const category = row.category;
            const value = row.value;
            const count = parseInt(row.count) || 0;
            
            if (!geography[category]) {
              geography[category] = {};
            }
            
            if (value) {
              geography[category][value] = count;
            }
          });
        } catch (error) {
          console.error('Error fetching geographic breakdown:', error);
          // Initialize empty geography for requested levels
          requestedLevels.forEach(level => {
            geography[level] = {};
          });
        }
      }

      // Get engagement, political, and media consumption breakdowns in a single consolidated query
      const consolidatedQuery = `
        SELECT 
          -- Engagement breakdown
          SUM(CASE WHEN a.engagement_high = '1' THEN 1 ELSE 0 END) as engagement_high,
          SUM(CASE WHEN a.engagement_mid = '1' THEN 1 ELSE 0 END) as engagement_medium,
          SUM(CASE WHEN a.engagement_low = '1' THEN 1 ELSE 0 END) as engagement_low,
          
          -- Political breakdown using PartyId with dimension table
          SUM(CASE WHEN p.Name = 'Democrat' THEN 1 ELSE 0 END) as political_democrat,
          SUM(CASE WHEN p.Name = 'Republican' THEN 1 ELSE 0 END) as political_republican,
          SUM(CASE WHEN p.Name = 'Independent/Other' THEN 1 ELSE 0 END) as political_independent,
          
          -- Media consumption breakdown
          SUM(CASE WHEN a.socialmediaheavyuser = '1' THEN 1 ELSE 0 END) as media_socialmediaheavyuser,
          SUM(CASE WHEN a.socialmediauserfacebook = '1' THEN 1 ELSE 0 END) as media_socialmediauserfacebook,
          SUM(CASE WHEN a.socialmediauserinstagram = '1' THEN 1 ELSE 0 END) as media_socialmediauserinstagram,
          SUM(CASE WHEN a.socialmediauserx = '1' THEN 1 ELSE 0 END) as media_socialmediauserx,
          SUM(CASE WHEN a.socialmediauseryoutube = '1' THEN 1 ELSE 0 END) as media_socialmediauseryoutube
        FROM [Lava].[AudienceApp_Slim_LA] a WITH (NOLOCK)
        LEFT JOIN [Lava].[dim_Party] p ON a.PartyId = p.Id
        ${demographicJoinsStr}
        ${fullWhereWithAlias || ''}
        OPTION (MAXDOP 4, RECOMPILE)
      `;

      const startTime = Date.now();
      const consolidatedResult = await executeOptimizedQuery(pool, consolidatedQuery, `Consolidated Engagement/Political/Media Query`, 120000); // 2 minute timeout
      const duration = Date.now() - startTime;
      console.log(`⚡ Engagement/Political/Media query completed in ${duration}ms`);
      const consolidatedRow = consolidatedResult.recordset[0];
      
      // Process engagement data
      const engagement = {
        high: parseInt(consolidatedRow.engagement_high) || 0,
        medium: parseInt(consolidatedRow.engagement_medium) || 0,
        low: parseInt(consolidatedRow.engagement_low) || 0
      };

      // Process political data
      const political = {
        democrat: parseInt(consolidatedRow.political_democrat) || 0,
        republican: parseInt(consolidatedRow.political_republican) || 0,
        independent: parseInt(consolidatedRow.political_independent) || 0
      };

      // Process media consumption data
      const mediaConsumption = {
        socialmediaheavyuser: parseInt(consolidatedRow.media_socialmediaheavyuser) || 0,
        socialmediauserfacebook: parseInt(consolidatedRow.media_socialmediauserfacebook) || 0,
        socialmediauserinstagram: parseInt(consolidatedRow.media_socialmediauserinstagram) || 0,
        socialmediauserx: parseInt(consolidatedRow.media_socialmediauserx) || 0,
        socialmediauseryoutube: parseInt(consolidatedRow.media_socialmediauseryoutube) || 0
      };

      return {
        demographics,
        geography,
        engagement,
        political,
        mediaConsumption
      };
    } catch (error) {
      console.error('Error fetching filtered breakdowns:', error);
      throw error;
    }
  }

  // New method to get filtered geographic options for cascading dropdowns
  // Optimized to leverage State-based composite indexes for maximum performance
  async getFilteredGeographicOptions(selectedStates: string[], selectedCounties: string[]): Promise<{
    states: { [key: string]: number };
    counties: { [key: string]: number };
    dmas: { [key: string]: number };
    stateSenateDistricts: { [key: string]: number };
    stateHouseDistricts: { [key: string]: number };
  }> {
    await this.ensureConnection();
    const pool = db.getPool();

    try {
      // Build state filter condition for index optimization
      const stateFilter = selectedStates.length > 0 
        ? `WHERE State IN (${selectedStates.map(s => `'${s.replace(/'/g, "''")}'`).join(',')})`
        : 'WHERE State IS NOT NULL';

      // Execute all geographic queries in a single consolidated query using UNION
      // Note: StateSenateDistrict and StateHouseDistrict columns don't exist in the database
      const geographicOptionsQuery = `
        SELECT 'states' as category, State as value, COUNT(*) as count 
        FROM [Lava].[AudienceApp_Slim_LA] WHERE State IS NOT NULL 
        GROUP BY State
        
        UNION ALL
        
        SELECT 'counties' as category, County as value, COUNT(*) as count 
        FROM [Lava].[AudienceApp_Slim_LA] ${stateFilter} AND County IS NOT NULL 
        GROUP BY County
        
        UNION ALL
        
        SELECT 'dmas' as category, DMA as value, COUNT(*) as count 
        FROM [Lava].[AudienceApp_Slim_LA] ${stateFilter} AND DMA IS NOT NULL 
        GROUP BY DMA
        
        ORDER BY category, count DESC
      `;
      
      const startTime = Date.now();
      logQuery(geographicOptionsQuery, 'Filtered Geographic Options');
      const result = await pool.request().query(geographicOptionsQuery);
      logQueryTime(startTime, 'Filtered Geographic Options');

      // Process consolidated results efficiently
      const states: { [key: string]: number } = {};
      const counties: { [key: string]: number } = {};
      const dmas: { [key: string]: number } = {};
      
      result.recordset.forEach((row: any) => {
        const category = row.category;
        const value = row.value;
        const count = parseInt(row.count) || 0;
        
        if (value) {
          switch (category) {
            case 'states':
              states[value] = count;
              break;
            case 'counties':
              counties[value] = count;
              break;
            case 'dmas':
              dmas[value] = count;
              break;
          }
        }
      });

      return {
        states,
        counties,
        dmas,
        stateSenateDistricts: {}, // Empty - column doesn't exist in database
        stateHouseDistricts: {}   // Empty - column doesn't exist in database
      };
    } catch (error) {
      console.error('Error fetching filtered geographic options:', error);
      throw error;
    }
  }

  private async getDemographicBreakdown(pool: any): Promise<any> {
    const queries = {
      gender: `SELECT g.Name, COUNT(*) as count FROM [Lava].[AudienceApp_Slim_LA] a LEFT JOIN [Lava].[dim_Gender] g ON a.GenderId = g.Id WHERE g.Name IS NOT NULL GROUP BY g.Name`,
      age: `SELECT ar.Name, COUNT(*) as count FROM [Lava].[AudienceApp_Slim_LA] a LEFT JOIN [Lava].[dim_AgeRange] ar ON a.AgeRangeId = ar.Id WHERE ar.Name IS NOT NULL GROUP BY ar.Name`,
      ethnicity: `SELECT e.Name, COUNT(*) as count FROM [Lava].[AudienceApp_Slim_LA] a LEFT JOIN [Lava].[dim_Ethnicity] e ON a.EthnicityId = e.Id WHERE e.Name IS NOT NULL GROUP BY e.Name`,
      education: `SELECT ed.Name, COUNT(*) as count FROM [Lava].[AudienceApp_Slim_LA] a LEFT JOIN [Lava].[dim_Education] ed ON a.EducationId = ed.Id WHERE ed.Name IS NOT NULL GROUP BY ed.Name`,
      income: `SELECT i.Name, COUNT(*) as count FROM [Lava].[AudienceApp_Slim_LA] a LEFT JOIN [Lava].[dim_Income] i ON a.IncomeId = i.Id WHERE i.Name IS NOT NULL GROUP BY i.Name`
    };

    const results: any = {};
    
    for (const [key, query] of Object.entries(queries)) {
      try {
        const result = await pool.request().query(query);
        results[key] = result.recordset.reduce((acc: any, row: any) => {
          // All queries now return Name column from dimension tables
          acc[row.Name] = parseInt(row.count);
          return acc;
        }, {});
      } catch (error) {
        console.error(`Error fetching ${key} breakdown:`, error);
        results[key] = {};
      }
    }

    return results;
  }

  private async getGeographicBreakdown(pool: any): Promise<any> {
      // Note: StateSenateDistrict and StateHouseDistrict columns don't exist in database
      const queries = {
        state: `SELECT State, COUNT(*) as count FROM [Lava].[AudienceApp_Slim_LA] WHERE State IS NOT NULL GROUP BY State ORDER BY count DESC`,
        county: `SELECT County, COUNT(*) as count FROM [Lava].[AudienceApp_Slim_LA] WHERE County IS NOT NULL GROUP BY County ORDER BY count DESC`,
        dma: `SELECT DMA, COUNT(*) as count FROM [Lava].[AudienceApp_Slim_LA] WHERE DMA IS NOT NULL GROUP BY DMA ORDER BY count DESC`,
        zipCode: `SELECT TOP(50) ZipCode, COUNT(*) as count FROM [Lava].[AudienceApp_Slim_LA] WHERE ZipCode IS NOT NULL GROUP BY ZipCode ORDER BY count DESC`
      };

    const results: any = {};
    
    for (const [key, query] of Object.entries(queries)) {
      try {
        const startTime = Date.now();
        logQuery(query, `Initial ${key}`);
        const result = await pool.request().query(query);
        logQueryTime(startTime, `Initial ${key}`);
        
        results[key] = result.recordset.reduce((acc: any, row: any) => {
          // Use the correct column name based on the field
          let columnName;
          if (key === 'zipCode') {
            columnName = 'ZipCode';
          } else if (key === 'dma') {
            columnName = 'DMA';
          } else {
            columnName = key.charAt(0).toUpperCase() + key.slice(1);
          }
          
          const value = row[columnName];
          if (value) {
            acc[value] = parseInt(row.count);
          }
          return acc;
        }, {});
      } catch (error) {
        console.error(`Error fetching ${key} breakdown:`, error);
        results[key] = {};
      }
    }
    
    // Add empty objects for district fields that don't exist in database
    results.stateSenateDistrict = {};
    results.stateHouseDistrict = {};

    return results;
  }

  private async getPartyBreakdown(pool: any): Promise<any> {
    try {
      const result = await pool.request().query(`
        SELECT p.Name, COUNT(*) as count 
        FROM [Lava].[AudienceApp_Slim_LA] a
        LEFT JOIN [Lava].[dim_Party] p ON a.PartyId = p.Id
        WHERE p.Name IS NOT NULL 
        GROUP BY p.Name
        ORDER BY count DESC
      `);
      
      return result.recordset.reduce((acc: any, row: any) => {
        acc[row.Name] = parseInt(row.count);
        return acc;
      }, {});
    } catch (error) {
      console.error('Error fetching party breakdown:', error);
      return {};
    }
  }

  private async getEngagementBreakdown(pool: any): Promise<any> {
    try {
      const result = await pool.request().query(`
        SELECT 
          SUM(CASE WHEN engagement_high = '1' THEN 1 ELSE 0 END) as high,
          SUM(CASE WHEN engagement_mid = '1' THEN 1 ELSE 0 END) as medium,
          SUM(CASE WHEN engagement_low = '1' THEN 1 ELSE 0 END) as low
        FROM [Lava].[AudienceApp_Slim_LA]
      `);
      
      const row = result.recordset[0];
      return {
        high: parseInt(row.high) || 0,
        medium: parseInt(row.medium) || 0,
        low: parseInt(row.low) || 0
      };
    } catch (error) {
      console.error('Error fetching engagement breakdown:', error);
      return { high: 0, medium: 0, low: 0 };
    }
  }

  private async getPoliticalBreakdown(pool: any): Promise<any> {
    try {
      // Use PartyId with dimension table join
      const result = await pool.request().query(`
        SELECT 
          SUM(CASE WHEN p.Name = 'Democrat' THEN 1 ELSE 0 END) as democrat,
          SUM(CASE WHEN p.Name = 'Republican' THEN 1 ELSE 0 END) as republican,
          SUM(CASE WHEN p.Name = 'Independent/Other' THEN 1 ELSE 0 END) as independent
        FROM [Lava].[AudienceApp_Slim_LA] a
        LEFT JOIN [Lava].[dim_Party] p ON a.PartyId = p.Id
      `);
      
      const row = result.recordset[0];
      return {
        democrat: parseInt(row.democrat) || 0,
        republican: parseInt(row.republican) || 0,
        independent: parseInt(row.independent) || 0
      };
    } catch (error) {
      console.error('Error fetching political breakdown:', error);
      return { democrat: 0, republican: 0, independent: 0 };
    }
  }

  private async getMediaConsumptionBreakdown(pool: any): Promise<any> {
    try {
      // Get counts for media consumption columns
      const mediaColumns = [
        'socialmediaheavyuser',
        'socialmediauserfacebook',
        'socialmediauserinstagram',
        'socialmediauserx',
        'socialmediauseryoutube'
      ];

      // Build the query to get counts for all media consumption columns
      const caseStatements = mediaColumns.map(col => 
        `SUM(CASE WHEN ${col} = '1' THEN 1 ELSE 0 END) as ${col}`
      ).join(',\n          ');

      const query = `
        SELECT 
          ${caseStatements}
        FROM [Lava].[AudienceApp_Slim_LA]
      `;

      const result = await pool.request().query(query);
      const row = result.recordset[0];
      
      // Convert all values to numbers
      const mediaCounts: any = {};
      mediaColumns.forEach(col => {
        mediaCounts[col] = parseInt(row[col]) || 0;
      });

      return mediaCounts;
    } catch (error) {
      console.error('Error fetching media consumption breakdown:', error);
      throw error;
    }
  }

  private async getUniverseBreakdown(pool: any): Promise<any> {
    try {
      // Get counts for all universe filter columns from Universe_Filters.csv
      // Note: These columns don't exist in database: partydemocrat, partyrepublican, allvotersnoharddem, allvotersnohardgop
      const universeColumns = [
        // 'allvotersnoharddem', // Column doesn't exist
        // 'allvotersnohardgop', // Column doesn't exist
        'engagement_high',
        'engagement_mid',
        'engagement_low',
        'engagementcontact',
        'engagementcurrentevents',
        'ideologyfiscalcons',
        'ideologyfiscalprog',
        'likelytogivepii',
        'likelyvotersdemocrat',
        'likelyvotersrepublican',
        // 'partydemocrat', // Doesn't exist in database
        // 'partyrepublican', // Doesn't exist in database
        'persuasion',
        'socialmediaheavyuser',
        'socialmediauserfacebook',
        'socialmediauserinstagram',
        'socialmediauserx',
        'socialmediauseryoutube',
        'taxstadiumsupport',
        'turnouthigh'
      ];

      // Build the query to get counts for all universe columns
      const caseStatements = universeColumns.map(col => 
        `SUM(CASE WHEN ${col} = '1' THEN 1 ELSE 0 END) as ${col}`
      ).join(',\n          ');

      const query = `
        SELECT 
          ${caseStatements}
        FROM [Lava].[AudienceApp_Slim_LA]
      `;

      const result = await pool.request().query(query);
      const row = result.recordset[0];
      
      // Convert all values to numbers
      const universeCounts: any = {};
      universeColumns.forEach(col => {
        universeCounts[col] = parseInt(row[col]) || 0;
      });

      return universeCounts;
    } catch (error) {
      console.error('Error fetching universe breakdown:', error);
      // Return empty object with all universe columns set to 0
      // Note: These columns don't exist in database: partydemocrat, partyrepublican, allvotersnoharddem, allvotersnohardgop
      const universeColumns = [
        // 'allvotersnoharddem', 'allvotersnohardgop', // Columns don't exist
        'engagement_high', 'engagement_mid', 'engagement_low',
        'engagementcontact', 'engagementcurrentevents', 'ideologyfiscalcons', 'ideologyfiscalprog',
        'likelytogivepii', 'likelyvotersdemocrat', 'likelyvotersrepublican',
        'persuasion', 'socialmediaheavyuser', 'socialmediauserfacebook', 'socialmediauserinstagram',
        'socialmediauserx', 'socialmediauseryoutube', 'taxstadiumsupport', 'turnouthigh'
      ];
      
      const emptyUniverse: any = {};
      universeColumns.forEach(col => {
        emptyUniverse[col] = 0;
      });
      
      return emptyUniverse;
    }
  }

  // Build WHERE clause from filter conditions
  private buildWhereClause(filters?: FilterConditions[]): string {
    if (!filters || filters.length === 0) {
      return '';
    }

    const conditions = filters.map((filter) => {
      const { field, operator, value } = filter;

      switch (operator) {
        case 'equals':
          return `${field} = '${value}'`;
        case 'not_equals':
          return `${field} != '${value}'`;
        case 'contains':
          return `${field} LIKE '%${value}%'`;
        case 'not_contains':
          return `${field} NOT LIKE '%${value}%'`;
        case 'greater_than':
          return `${field} > ${value}`;
        case 'less_than':
          return `${field} < ${value}`;
        case 'between':
          return `${field} BETWEEN ${value[0]} AND ${value[1]}`;
        case 'in':
          const inValues = Array.isArray(value) 
            ? value.map(v => `'${v}'`).join(', ')
            : `'${value}'`;
          return `${field} IN (${inValues})`;
        case 'not_in':
          const notInValues = Array.isArray(value)
            ? value.map(v => `'${v}'`).join(', ')
            : `'${value}'`;
          return `${field} NOT IN (${notInValues})`;
        default:
          return '1=1';
      }
    });

    return `WHERE ${conditions.join(' AND ')}`;
  }

  // Get demographic breakdowns with filters (SQL-based to avoid API rate limits)
  async getFilteredDemographicBreakdowns(
    geoFilter: string, // e.g., "County IN ('JEFFERSON PARISH')" or "1=1" for all
    genderFilter?: string[], // e.g., ["Male"]
    ageFilter?: string[], // e.g., ["18 - 24", "25 - 34"]
    ethnicityFilter?: string[],
    incomeFilter?: string[],
    educationFilter?: string[],
    universeFilters?: string[], // e.g., ["turnouthigh", "socialmediaheavyuser"]
    geographicFilters?: { state?: string[], county?: string[], dma?: string[] } // NEW: for multi-state support
  ): Promise<{
    gender: { [key: string]: number };
    age: { [key: string]: number };
    ethnicity: { [key: string]: number };
    education: { [key: string]: number };
    income: { [key: string]: number };
  }> {
    await this.ensureConnection();
    const pool = db.getPool();
    
    // Extract state codes from geographic filters (defaults to ['LA'] if none)
    const stateCodes = extractStateCodes(geographicFilters);
    console.log(`🗺️ Querying ${stateCodes.length} state table(s):`, stateCodes);
    
    // Build universe WHERE clause
    let universeWhere = '';
    if (universeFilters && universeFilters.length > 0) {
      const universeClauses = universeFilters.map(field => `${field} = 1`);
      universeWhere = ` AND (${universeClauses.join(' OR ')})`;
    }
    
    // Build demographic WHERE clauses INCLUDING all filters (no exclusions)
    // This ensures we only show selected demographics
    const buildDemoJoins = () => {
      const joins: string[] = [];
      
      if (genderFilter && genderFilter.length > 0) {
        joins.push(`LEFT JOIN [Lava].[dim_Gender] g_filter ON a.GenderId = g_filter.Id`);
      }
      if (ageFilter && ageFilter.length > 0) {
        joins.push(`LEFT JOIN [Lava].[dim_AgeRange] ar_filter ON a.AgeRangeId = ar_filter.Id`);
      }
      if (ethnicityFilter && ethnicityFilter.length > 0) {
        joins.push(`LEFT JOIN [Lava].[dim_Ethnicity] e_filter ON a.EthnicityId = e_filter.Id`);
      }
      if (incomeFilter && incomeFilter.length > 0) {
        joins.push(`LEFT JOIN [Lava].[dim_Income] i_filter ON a.IncomeId = i_filter.Id`);
      }
      if (educationFilter && educationFilter.length > 0) {
        joins.push(`LEFT JOIN [Lava].[dim_Education] ed_filter ON a.EducationId = ed_filter.Id`);
      }
      
      return joins.join(' ');
    };
    
    const buildDemoWhere = () => {
      const clauses: string[] = [];
      
      if (genderFilter && genderFilter.length > 0) {
        clauses.push(`g_filter.Name IN (${genderFilter.map(g => `'${g}'`).join(', ')})`);
      }
      if (ageFilter && ageFilter.length > 0) {
        clauses.push(`ar_filter.Name IN (${ageFilter.map(a => `'${a}'`).join(', ')})`);
      }
      if (ethnicityFilter && ethnicityFilter.length > 0) {
        clauses.push(`e_filter.Name IN (${ethnicityFilter.map(e => `'${e}'`).join(', ')})`);
      }
      if (incomeFilter && incomeFilter.length > 0) {
        clauses.push(`i_filter.Name IN (${incomeFilter.map(i => `'${i}'`).join(', ')})`);
      }
      if (educationFilter && educationFilter.length > 0) {
        clauses.push(`ed_filter.Name IN (${educationFilter.map(e => `'${e}'`).join(', ')})`);
      }
      
      return clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '';
    };

    const startTime = Date.now();
    
    // Execute all demographic queries in parallel (using JOINs with dimension tables)
    // NOTE: All queries include ALL demographic filters (no exclusions)
    const demoJoins = buildDemoJoins();
    const demoWhere = buildDemoWhere();
    
    // Build multi-state UNION ALL queries
    const genderQuery = buildMultiStateQuery(stateCodes, (tableName) => `
      SELECT g.Name, COUNT(*) as count
      FROM ${tableName} a
      LEFT JOIN [Lava].[dim_Gender] g ON a.GenderId = g.Id
      ${demoJoins}
      WHERE ${geoFilter}${demoWhere}${universeWhere} AND g.Name IS NOT NULL
      GROUP BY g.Name
    `);
    
    const ageQuery = buildMultiStateQuery(stateCodes, (tableName) => `
      SELECT ar.Name, COUNT(*) as count
      FROM ${tableName} a
      LEFT JOIN [Lava].[dim_AgeRange] ar ON a.AgeRangeId = ar.Id
      ${demoJoins}
      WHERE ${geoFilter}${demoWhere}${universeWhere} AND ar.Name IS NOT NULL
      GROUP BY ar.Name
    `);
    
    const ethnicityQuery = buildMultiStateQuery(stateCodes, (tableName) => `
      SELECT e.Name, COUNT(*) as count
      FROM ${tableName} a
      LEFT JOIN [Lava].[dim_Ethnicity] e ON a.EthnicityId = e.Id
      ${demoJoins}
      WHERE ${geoFilter}${demoWhere}${universeWhere} AND e.Name IS NOT NULL
      GROUP BY e.Name
    `);
    
    const educationQuery = buildMultiStateQuery(stateCodes, (tableName) => `
      SELECT ed.Name, COUNT(*) as count
      FROM ${tableName} a
      LEFT JOIN [Lava].[dim_Education] ed ON a.EducationId = ed.Id
      ${demoJoins}
      WHERE ${geoFilter}${demoWhere}${universeWhere} AND ed.Name IS NOT NULL
      GROUP BY ed.Name
    `);
    
    const incomeQuery = buildMultiStateQuery(stateCodes, (tableName) => `
      SELECT i.Name, COUNT(*) as count
      FROM ${tableName} a
      LEFT JOIN [Lava].[dim_Income] i ON a.IncomeId = i.Id
      ${demoJoins}
      WHERE ${geoFilter}${demoWhere}${universeWhere} AND i.Name IS NOT NULL
      GROUP BY i.Name
    `);
    
    // Wrap UNION queries to sum results across states
    const queries = {
      gender: `SELECT Name, SUM(count) as count FROM (${genderQuery}) AS combined GROUP BY Name`,
      age: `SELECT Name, SUM(count) as count FROM (${ageQuery}) AS combined GROUP BY Name`,
      ethnicity: `SELECT Name, SUM(count) as count FROM (${ethnicityQuery}) AS combined GROUP BY Name`,
      education: `SELECT Name, SUM(count) as count FROM (${educationQuery}) AS combined GROUP BY Name`,
      income: `SELECT Name, SUM(count) as count FROM (${incomeQuery}) AS combined GROUP BY Name`
    };
    
    console.log('🔍 SQL Queries to execute:');
    console.log('Gender query:', queries.gender);
    console.log('Age query:', queries.age);
    
    const [genderResult, ageResult, ethnicityResult, educationResult, incomeResult] = await Promise.all([
      pool.request().query(queries.gender),
      pool.request().query(queries.age),
      pool.request().query(queries.ethnicity),
      pool.request().query(queries.education),
      pool.request().query(queries.income)
    ]);
    
    logQueryTime(startTime, 'Demographic breakdowns (5 parallel queries)');
    
    // Convert results to the expected format
    const demographics = {
      gender: {} as { [key: string]: number },
      age: {} as { [key: string]: number },
      ethnicity: {} as { [key: string]: number },
      education: {} as { [key: string]: number },
      income: {} as { [key: string]: number }
    };
    
    genderResult.recordset.forEach((row: any) => {
      if (row.Name) demographics.gender[row.Name] = row.count;
    });
    
    ageResult.recordset.forEach((row: any) => {
      if (row.Name) demographics.age[row.Name] = row.count;
    });
    
    ethnicityResult.recordset.forEach((row: any) => {
      if (row.Name) demographics.ethnicity[row.Name] = row.count;
    });
    
    educationResult.recordset.forEach((row: any) => {
      if (row.Name) demographics.education[row.Name] = row.count;
    });
    
    incomeResult.recordset.forEach((row: any) => {
      if (row.Name) demographics.income[row.Name] = row.count;
    });
    
    console.log('✅ SQL demographics parsed:', {
      gender: demographics.gender,
      age: demographics.age,
      ethnicity: Object.keys(demographics.ethnicity).length + ' values',
      education: Object.keys(demographics.education).length + ' values',
      income: Object.keys(demographics.income).length + ' values'
    });
    
    return demographics;
  }

  // Close connection
  async close(): Promise<void> {
    if (this.isConnected) {
      await db.close();
      this.isConnected = false;
    }
  }
}

// Filter conditions interface
interface FilterConditions {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in';
  value: any;
}

export const sqlServerService = new SqlServerService();
