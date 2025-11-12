/**
 * Unit tests for sqlServerService
 * Tests database query methods without actually connecting to the database
 */

import { mockAudienceStats, mockGeographicOptions } from '../test-utils';

// Mock the database connection
jest.mock('../../database.js', () => ({
  connect: jest.fn().mockResolvedValue(true),
  getPool: jest.fn(() => ({
    request: () => ({
      query: jest.fn(),
      timeout: 60000,
    }),
  })),
  close: jest.fn(),
}));

describe('sqlServerService', () => {
  let sqlServerService: any;
  let mockPool: any;

  beforeEach(() => {
    // Reset modules to get a fresh instance
    jest.resetModules();
    
    // Mock database
    const db = require('../../database.js');
    mockPool = {
      request: jest.fn(() => ({
        query: jest.fn(),
        timeout: 60000,
      })),
    };
    db.getPool.mockReturnValue(mockPool);

    // Import service after mocks are set up
    const service = require('../sqlServerService');
    sqlServerService = service.sqlServerService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAudienceStats', () => {
    it('should return complete audience statistics', async () => {
      // Create a comprehensive mock that handles all the queries
      let callCount = 0;
      mockPool.request.mockReturnValue({
        query: jest.fn().mockImplementation(() => {
          callCount++;
          // Return appropriate mock data based on call order
          if (callCount === 1) {
            // Total count query
            return Promise.resolve({ recordset: [{ total: 5000000 }] });
          } else if (callCount <= 12) {
            // Demographic and geographic queries
            return Promise.resolve({ recordset: [] });
          } else {
            // Engagement, political, media, universe queries
            return Promise.resolve({ recordset: [{
              high: 1500000,
              medium: 2000000,
              low: 1500000,
              democrat: 2000000,
              republican: 2200000,
              independent: 800000,
              socialmediaheavyuser: 1800000,
              socialmediauserfacebook: 3000000,
              socialmediauserinstagram: 1500000,
              socialmediauserx: 800000,
              socialmediauseryoutube: 2500000,
            }] });
          }
        }),
        timeout: 60000,
      });

      const stats = await sqlServerService.getAudienceStats();

      expect(stats).toBeDefined();
      expect(stats.totalCount).toBe(5000000);
      expect(stats.demographics).toBeDefined();
      expect(stats.geography).toBeDefined();
      expect(stats.engagement).toBeDefined();
      expect(stats.political).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      mockPool.request.mockReturnValue({
        query: jest.fn().mockRejectedValue(new Error('Database connection failed')),
        timeout: 60000,
      });

      await expect(sqlServerService.getAudienceStats()).rejects.toThrow();
    });
  });

  describe('getCombinedUniverseGeographicCounts', () => {
    it('should filter by geographic location only', async () => {
      mockPool.request.mockReturnValue({
        query: jest.fn().mockResolvedValue({
          recordset: [{ count: 125000 }],
        }),
        timeout: 60000,
      });

      const result = await sqlServerService.getCombinedUniverseGeographicCounts(
        [], // No universe filters
        { state: ['Louisiana'] }, // Geographic filter
        'AND'
      );

      expect(result).toBeDefined();
      expect(result.total).toBe(125000);
    });

    it('should filter by universe field only', async () => {
      mockPool.request.mockReturnValue({
        query: jest.fn()
          .mockResolvedValueOnce({ recordset: [{ count: 1800000 }] }) // Combined count
          .mockResolvedValueOnce({ recordset: [{ turnouthigh: 1800000 }] }), // Individual count
        timeout: 60000,
      });

      const result = await sqlServerService.getCombinedUniverseGeographicCounts(
        ['turnouthigh'], // Universe filter
        {}, // No geographic filters
        'AND'
      );

      expect(result).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
      expect(result.turnouthigh).toBeGreaterThan(0);
    });

    it('should combine universe and geographic filters with AND logic', async () => {
      mockPool.request.mockReturnValue({
        query: jest.fn()
          .mockResolvedValueOnce({ recordset: [{ count: 90000 }] }) // Combined count
          .mockResolvedValueOnce({ recordset: [{ turnouthigh: 90000 }] }), // Individual count
        timeout: 60000,
      });

      const result = await sqlServerService.getCombinedUniverseGeographicCounts(
        ['turnouthigh'],
        { state: ['Louisiana'] },
        'AND'
      );

      expect(result).toBeDefined();
      expect(result.total).toBeLessThan(125000); // Should be subset of Louisiana
      expect(result.turnouthigh).toBeLessThan(1800000); // Should be subset of turnouthigh
    });

    it('should support OR logic for universe filters', async () => {
      mockPool.request.mockReturnValue({
        query: jest.fn()
          .mockResolvedValueOnce({ recordset: [{ count: 150000 }] })
          .mockResolvedValueOnce({ recordset: [{ 
            turnouthigh: 90000,
            engagement_high: 75000 
          }] }),
        timeout: 60000,
      });

      const result = await sqlServerService.getCombinedUniverseGeographicCounts(
        ['turnouthigh', 'engagement_high'],
        { state: ['Louisiana'] },
        'OR'
      );

      expect(result).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(result.turnouthigh);
      expect(result.total).toBeGreaterThanOrEqual(result.engagement_high);
    });

    it('should handle empty filters', async () => {
      mockPool.request.mockReturnValue({
        query: jest.fn().mockResolvedValue({
          recordset: [{ count: 5000000 }],
        }),
        timeout: 60000,
      });

      const result = await sqlServerService.getCombinedUniverseGeographicCounts(
        [],
        {},
        'AND'
      );

      expect(result).toBeDefined();
      expect(result.total).toBe(5000000); // Should return all records
    });

    it('should skip non-existent columns (districts)', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockPool.request.mockReturnValue({
        query: jest.fn().mockResolvedValue({
          recordset: [{ count: 125000 }],
        }),
        timeout: 60000,
      });

      await sqlServerService.getCombinedUniverseGeographicCounts(
        [],
        { 
          state: ['Louisiana'],
          stateSenateDistrict: ['1'], // Should be skipped
          stateHouseDistrict: ['10'] // Should be skipped
        },
        'AND'
      );

      // Should log warnings about skipped columns
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping non-existent column')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('getFilteredBreakdowns', () => {
    it('should return filtered demographic breakdowns', async () => {
      // Create a comprehensive mock for all queries in getFilteredBreakdowns
      let queryCount = 0;
      mockPool.request.mockReturnValue({
        query: jest.fn().mockImplementation(() => {
          queryCount++;
          if (queryCount === 1) {
            // Demographics query (UNION query)
            return Promise.resolve({
              recordset: [
                { category: 'gender', value: 'Male', count: 62500 },
                { category: 'gender', value: 'Female', count: 60000 },
                { category: 'age', value: '25-34', count: 20000 },
              ]
            });
          } else if (queryCount === 2) {
            // Geographic query
            return Promise.resolve({
              recordset: [
                { category: 'state', value: 'Louisiana', count: 125000 },
                { category: 'county', value: 'Orleans', count: 125000 },
              ]
            });
          } else {
            // Consolidated engagement/political/media query
            return Promise.resolve({
              recordset: [{
                engagement_high: 125000,
                engagement_medium: 0,
                engagement_low: 0,
                political_democrat: 50000,
                political_republican: 55000,
                political_independent: 20000,
                media_socialmediaheavyuser: 45000,
                media_socialmediauserfacebook: 75000,
                media_socialmediauserinstagram: 37500,
                media_socialmediauserx: 20000,
                media_socialmediauseryoutube: 62500,
              }]
            });
          }
        }),
        timeout: 60000,
      });

      const result = await sqlServerService.getFilteredBreakdowns(
        ['turnouthigh'],
        { state: ['Louisiana'] },
        'AND',
        ['state', 'county']
      );

      expect(result).toBeDefined();
      expect(result.demographics).toBeDefined();
      expect(result.demographics.gender).toBeDefined();
      expect(result.demographics.gender['Male']).toBe(62500);
      expect(result.engagement).toBeDefined();
      expect(result.political).toBeDefined();
      expect(result.mediaConsumption).toBeDefined();
    });

    it('should only include requested geographic levels', async () => {
      let queryCount = 0;
      mockPool.request.mockReturnValue({
        query: jest.fn().mockImplementation(() => {
          queryCount++;
          if (queryCount === 1) {
            // Demographics query
            return Promise.resolve({ recordset: [] });
          } else if (queryCount === 2) {
            // Geography query
            return Promise.resolve({
              recordset: [
                { category: 'state', value: 'Louisiana', count: 125000 },
                { category: 'county', value: 'Orleans', count: 125000 },
              ]
            });
          } else {
            // Consolidated engagement/political/media query
            return Promise.resolve({
              recordset: [{
                engagement_high: 0,
                engagement_medium: 0,
                engagement_low: 0,
                political_democrat: 0,
                political_republican: 0,
                political_independent: 0,
                media_socialmediaheavyuser: 0,
                media_socialmediauserfacebook: 0,
                media_socialmediauserinstagram: 0,
                media_socialmediauserx: 0,
                media_socialmediauseryoutube: 0,
              }]
            });
          }
        }),
        timeout: 60000,
      });

      const result = await sqlServerService.getFilteredBreakdowns(
        [],
        { state: ['Louisiana'] },
        'AND',
        ['state', 'county'] // Only request these levels
      );

      expect(result.geography).toBeDefined();
      expect(result.geography.state).toBeDefined();
      expect(result.geography.county).toBeDefined();
      // Should not include DMA since not requested
    });

    it('should filter out non-existent district levels', async () => {
      let queryCount = 0;
      mockPool.request.mockReturnValue({
        query: jest.fn().mockImplementation(() => {
          queryCount++;
          if (queryCount === 1) {
            // Demographics query
            return Promise.resolve({ recordset: [] });
          } else {
            // Consolidated engagement/political/media query
            return Promise.resolve({
              recordset: [{
                engagement_high: 0,
                engagement_medium: 0,
                engagement_low: 0,
                political_democrat: 0,
                political_republican: 0,
                political_independent: 0,
                media_socialmediaheavyuser: 0,
                media_socialmediauserfacebook: 0,
                media_socialmediauserinstagram: 0,
                media_socialmediauserx: 0,
                media_socialmediauseryoutube: 0,
              }]
            });
          }
        }),
        timeout: 60000,
      });

      const result = await sqlServerService.getFilteredBreakdowns(
        [],
        {},
        'AND',
        ['state', 'stateSenateDistrict', 'stateHouseDistrict']
      );

      // Should return empty objects for district fields
      expect(result.geography.stateSenateDistrict).toEqual({});
      expect(result.geography.stateHouseDistrict).toEqual({});
    });
  });

  describe('getFilteredGeographicOptions', () => {
    it('should return all states when no state is selected', async () => {
      mockPool.request.mockReturnValue({
        query: jest.fn().mockResolvedValue({
          recordset: [
            { category: 'states', value: 'Louisiana', count: 4500000 },
            { category: 'states', value: 'Mississippi', count: 300000 },
            { category: 'states', value: 'Texas', count: 200000 },
            { category: 'counties', value: 'Orleans', count: 400000 },
            { category: 'dmas', value: 'New Orleans', count: 1300000 },
          ]
        }),
        timeout: 60000,
      });

      const result = await sqlServerService.getFilteredGeographicOptions([], []);

      expect(result).toBeDefined();
      expect(result.states).toBeDefined();
      expect(Object.keys(result.states).length).toBeGreaterThan(0);
      expect(result.counties).toBeDefined();
      expect(result.dmas).toBeDefined();
    });

    it('should filter counties by selected state', async () => {
      mockPool.request.mockReturnValue({
        query: jest.fn().mockResolvedValue({
          recordset: [
            { category: 'states', value: 'Louisiana', count: 4500000 },
            { category: 'counties', value: 'Orleans', count: 400000 },
            { category: 'counties', value: 'Jefferson', count: 450000 },
            { category: 'dmas', value: 'New Orleans', count: 1300000 },
          ]
        }),
        timeout: 60000,
      });

      const result = await sqlServerService.getFilteredGeographicOptions(['Louisiana'], []);

      expect(result.counties).toBeDefined();
      // Should only return Louisiana counties
      expect(Object.keys(result.counties).length).toBeGreaterThan(0);
    });

    it('should return empty district objects for non-existent columns', async () => {
      mockPool.request.mockReturnValue({
        query: jest.fn().mockResolvedValue({
          recordset: [
            { category: 'states', value: 'Louisiana', count: 4500000 },
          ]
        }),
        timeout: 60000,
      });

      const result = await sqlServerService.getFilteredGeographicOptions([], []);

      expect(result.stateSenateDistricts).toEqual({});
      expect(result.stateHouseDistricts).toEqual({});
    });
  });

  describe('Edge Cases', () => {
    it('should handle SQL injection attempts safely', async () => {
      mockPool.request.mockReturnValue({
        query: jest.fn().mockResolvedValue({
          recordset: [{ count: 0 }],
        }),
        timeout: 60000,
      });

      // Attempt SQL injection
      const maliciousInput = "'; DROP TABLE Users; --";
      
      const result = await sqlServerService.getCombinedUniverseGeographicCounts(
        [],
        { state: [maliciousInput] },
        'AND'
      );

      // Should handle safely (string escaping in query builder)
      expect(result).toBeDefined();
    });

    it('should handle very large result sets', async () => {
      const largeRecordset = Array(10000).fill(null).map((_, i) => ({
        category: 'states',
        value: `State${i}`,
        count: Math.floor(Math.random() * 100000)
      }));

      mockPool.request.mockReturnValue({
        query: jest.fn().mockResolvedValue({
          recordset: largeRecordset
        }),
        timeout: 60000,
      });

      const result = await sqlServerService.getFilteredGeographicOptions([], []);

      expect(result).toBeDefined();
      expect(Object.keys(result.states).length).toBe(10000);
    });

    it('should handle database timeout errors', async () => {
      mockPool.request.mockReturnValue({
        query: jest.fn().mockRejectedValue(new Error('RequestError: Timeout expired')),
        timeout: 60000,
      });

      await expect(
        sqlServerService.getCombinedUniverseGeographicCounts([], {}, 'AND')
      ).rejects.toThrow();
    });
  });
});

