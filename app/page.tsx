'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FilterBuilder } from '@/components/FilterBuilder';
import { PreviewPanel } from '@/components/PreviewPanel';
// import { VisualizationPanel } from '@/components/VisualizationPanel';
import { Header } from '@/components/Header';
import { GeographicSelector } from '@/components/GeographicSelector';
import { GeoWizard } from '@/components/GeoWizard';
import { GeoBanner } from '@/components/GeoBanner';
import { DemographicFilterPane, DemographicSelections } from '@/components/DemographicFilterPane';
import { FilterGroup, CombinedPersonData, AudienceStats } from '@/types/audience';
import { formatGeographicTitle } from '@/lib/geoTitle';
import html2canvas from 'html2canvas';
import { PDFDocument, PDFImage, StandardFonts, rgb } from 'pdf-lib';

export default function Dashboard() {
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<string>('Loading audience data...');
  const [loadingPercentage, setLoadingPercentage] = useState(0);
  const [dataLimit, setDataLimit] = useState<number>(0); // 0 means load all records
  const [currentFilters, setCurrentFilters] = useState<FilterGroup | null>(null);
  const [geographicSelections, setGeographicSelections] = useState<any>(null);
  const [demographicSelections, setDemographicSelections] = useState<DemographicSelections | null>(null);
  const [filteredData, setFilteredData] = useState<CombinedPersonData[]>([]);
  const [audienceStats, setAudienceStats] = useState<AudienceStats | null>(null);
  const [originalAudienceStats, setOriginalAudienceStats] = useState<AudienceStats | null>(null);
  const [geographicOnlyCount, setGeographicOnlyCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<FilterGroup | null>(null);
  const [pendingGeographicSelections, setPendingGeographicSelections] = useState<any>(null);
  const [pendingDemographicSelections, setPendingDemographicSelections] = useState<DemographicSelections | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [confirmedState, setConfirmedState] = useState<string | null>(null);
  const [isStateExpanded, setIsStateExpanded] = useState(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const previewPanelRef = useRef<HTMLDivElement>(null);

  // Load data using streaming approach
  useEffect(() => {
    let isMounted = true; // Add cleanup flag
    
    const loadData = async () => {
      // Prevent multiple concurrent calls (but allow initial load)
      if (isDataLoaded) {
        console.log('Data already loaded, skipping...');
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        setLoadingProgress('Loading audience data...');
        setLoadingPercentage(50);
        
        // Use streaming API to get stats (with caching)
        const response = await fetch('/api/streaming?action=stats');
        if (!response.ok) {
          throw new Error(`Streaming API error: ${response.status}`);
        }
        
        // Check if component is still mounted before proceeding
        if (!isMounted) return;
        
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error);
        }
        
        // Check if component is still mounted before updating state
        if (!isMounted) return;
        
        setLoadingProgress('Data loaded successfully!');
        setLoadingPercentage(100);
        
        // Set the audience stats from streaming data
        if (result.data) {
          setAudienceStats(result.data);
          setOriginalAudienceStats(result.data); // Store original stats for filtering restoration
          console.log(`Stats loaded: ${result.data.totalCount} total records`);
          console.log('Demographics sample:', result.data.demographics);
          console.log('Geography sample:', result.data.geography);
          console.log('Engagement sample:', result.data.engagement);
          console.log('Political sample:', result.data.political);
          
          // Debug specific fields
          console.log('Gender options:', Object.keys(result.data.demographics?.gender || {}));
          console.log('Age options:', Object.keys(result.data.demographics?.age || {}));
          console.log('State options:', Object.keys(result.data.geography?.state || {}));
          console.log('County options:', Object.keys(result.data.geography?.county || {}));
          console.log('DMA options:', Object.keys(result.data.geography?.dma || {}));
          console.log('Full geography object:', result.data.geography);
          console.log('Geography object keys:', Object.keys(result.data.geography || {}));
        }
        
        setIsDataLoaded(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        
        // Provide more specific error messages
        let userMessage = 'Failed to load data. ';
        if (errorMessage.includes('timeout')) {
          userMessage += 'The data load timed out. This may be due to the large dataset size.';
        } else if (errorMessage.includes('Azure')) {
          userMessage += 'Azure Blob Storage connection failed. Please check your configuration.';
        } else if (errorMessage.includes('memory') || errorMessage.includes('Memory')) {
          userMessage += 'Insufficient memory to load all records. Try refreshing the page.';
        } else {
          userMessage += errorMessage;
        }
        
        setError(userMessage);
        console.error('Data loading error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    
    // Cleanup function to prevent state updates if component unmounts
    return () => {
      isMounted = false;
    };
  }, [isDataLoaded]);

  // Client-side filtering function - memoized to prevent re-renders
  const applyClientSideFilters = useCallback(async (originalStats: any, geography: any, demographics: any, currentFilters: any) => {
    // Safety checks
    if (!originalStats) {
      return { filteredStats: originalStats, geographicOnlyCount: 0 };
    }
    
    console.log('🔍 applyClientSideFilters called with:', {
      originalStats: originalStats ? Object.keys(originalStats) : 'null',
      geography,
      demographics,
      currentFilters: currentFilters ? currentFilters.conditions : 'null'
    });
    
    if (originalStats && originalStats.universe) {
      console.log('🌌 Universe data available:', Object.keys(originalStats.universe));
      console.log('🌌 Sample universe values:', {
        turnouthigh: originalStats.universe.turnouthigh,
        socialmediaheavyuser: originalStats.universe.socialmediaheavyuser,
        engagement_high: originalStats.universe.engagement_high
      });
    } else {
      console.log('❌ No universe data in originalStats');
    }
    
    // Create a deep clone to prevent mutating the original data
    // CRITICAL: Always deep clone universe to prevent mutation of originalStats
    const filteredStats = {
      ...originalStats,
      universe: { ...originalStats.universe }, // Deep clone universe to prevent mutation
      demographics: {},
      geography: {},
      engagement: { ...originalStats.engagement },
      political: { ...originalStats.political },
      mediaConsumption: { ...originalStats.mediaConsumption }
    };
    
    // Deep clone demographics object
    Object.keys(originalStats.demographics || {}).forEach(field => {
      filteredStats.demographics[field] = { ...originalStats.demographics[field] };
    });
    
    // Deep clone geography object
    Object.keys(originalStats.geography || {}).forEach(field => {
      filteredStats.geography[field] = { ...originalStats.geography[field] };
    });
    

    // Apply geographic filters
    if (geography) {
      Object.entries(geography).forEach(([field, selectedValues]: [string, any]) => {
        if (Array.isArray(selectedValues) && selectedValues.length > 0) {
          // Map UI field names to data field names
          const fieldMap: { [key: string]: string } = {
            'state': 'state',
            'county': 'county',
            'dma': 'dma'
          };
          
          const dataField = fieldMap[field] || field.toLowerCase();
          if (filteredStats.geography[dataField]) {
            // Filter the field to only include selected values
            const filteredField: any = {};
            selectedValues.forEach((value: string) => {
              if (filteredStats.geography[dataField][value]) {
                filteredField[value] = filteredStats.geography[dataField][value];
              }
            });
            filteredStats.geography[dataField] = filteredField;
          }
        }
      });
    }
    
    // Check if we have universe, geographic, or demographic filters - if so, use combined API
    const hasUniverseFilters = currentFilters && currentFilters.conditions && currentFilters.conditions.length > 0;
    const hasGeographicFilters = geography && Object.values(geography).some((values: any) => Array.isArray(values) && values.length > 0);
    const hasDemographicFilters = demographics && Object.values(demographics).some((values: any) => Array.isArray(values) && values.length > 0);
    
    // Convert demographic selections to the format expected by the API (define early for all blocks)
    const demographicFilters = demographics || {};
    
    console.log('🔍 Filter detection:', {
      hasUniverseFilters,
      hasGeographicFilters,
      hasDemographicFilters,
      currentFilters: currentFilters?.conditions,
      geography,
      demographics,
      geographyValues: geography ? Object.values(geography) : null,
      demographicValues: demographics ? Object.values(demographics) : null
    });
    
    if (hasGeographicFilters || hasDemographicFilters) {
      console.log('🌍 Geographic or Demographic filters active - calling combined API');
      console.log('🌍 Universe filters:', currentFilters?.conditions || 'none');
      console.log('🌍 Geographic filters:', geography);
      console.log('🌍 Demographic filters:', demographics);
      
      try {
        const universeFields = currentFilters?.conditions ? currentFilters.conditions.map((condition: any) => condition.field) : [];
        
        console.log('🌍 Sending request with:', { universeFields, geographicFilters: geography, demographicFilters });
        console.log('🌍 geography.congressional:', geography?.congressional);
        console.log('🌍 Full geography object:', JSON.stringify(geography, null, 2));
        console.log('🌍 Full demographic object:', JSON.stringify(demographicFilters, null, 2));
        
        // Determine which geographic levels are needed based on current selections
        // Conditional logic based on geography type for optimal preview panel display
        let levelsToRequest: string[] = [];
        
        if (geography.county && geography.county.length > 0) {
          // County selected: show State, County, Congressional, State Senate, State House
          levelsToRequest = ['state', 'county', 'congressional', 'stateSenateDistrict', 'stateHouseDistrict'];
          console.log('📋 County selection detected - requesting district breakdowns');
        } else if (geography.congressional && geography.congressional.length > 0) {
          // Congressional District selected: show County (top 5), State Senate, State House
          levelsToRequest = ['county', 'stateSenateDistrict', 'stateHouseDistrict'];
          console.log('📋 Congressional District selection detected');
        } else if (geography.stateSenateDistrict && geography.stateSenateDistrict.length > 0) {
          // State Senate District selected: show County (top 5), Congressional, State House
          levelsToRequest = ['county', 'congressional', 'stateHouseDistrict'];
          console.log('📋 State Senate District selection detected');
        } else if (geography.stateHouseDistrict && geography.stateHouseDistrict.length > 0) {
          // State House District selected: show County (top 5), Congressional, State Senate
          levelsToRequest = ['county', 'congressional', 'stateSenateDistrict'];
          console.log('📋 State House District selection detected');
        } else if (geography.state && geography.state.length > 0) {
          // State only: show State, County (top 5), DMA (top 5)
          levelsToRequest = ['state', 'county', 'dma'];
          console.log('📋 State-only selection detected');
        } else {
          // Default: show State, County, DMA
          levelsToRequest = ['state', 'county', 'dma'];
          console.log('📋 No geographic selection - using defaults');
        }
        
        console.log('📋 levelsToRequest:', levelsToRequest);
        
        // OPTIMIZATION: If no universe filters, make appropriate calls based on demographic filters
        if (!hasUniverseFilters) {
          console.log('🔄 No universe filters detected');
          
          // STEP 1: Always fetch geographic-only count for denominator (the "WHERE")
          // This is the total population in the selected geography, regardless of demographics
          console.log('🔄 Step 1: Fetching geographic-only count (no demographics) for denominator...');
          const geoOnlyResponse = await fetch('/api/combined-filters', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              universeFields: [], 
              geographicFilters: geography || {},
              demographicFilters: {}, // NO demographic filters for denominator
              requestedLevels: levelsToRequest
            })
          });
          
          let geographicOnlyCount = 0;
          let geoOnlyResult = null;
          
          if (geoOnlyResponse.ok) {
            geoOnlyResult = await geoOnlyResponse.json();
            geographicOnlyCount = geoOnlyResult.combinedCounts['total'] || 0;
            console.log(`🗺️ Geographic-only count (WHERE - denominator): ${geographicOnlyCount.toLocaleString()}`);
            
            // Extract hasCellPhoneCount and householdCount from geoOnlyResult
            if (geoOnlyResult.combinedCounts) {
              if (geoOnlyResult.combinedCounts['hasCellPhoneCount'] !== undefined) {
                filteredStats.hasCellPhoneCount = geoOnlyResult.combinedCounts['hasCellPhoneCount'];
                console.log('✅ Set filteredStats.hasCellPhoneCount from geoOnlyResult:', filteredStats.hasCellPhoneCount);
              }
              if (geoOnlyResult.combinedCounts['householdCount'] !== undefined) {
                filteredStats.householdCount = geoOnlyResult.combinedCounts['householdCount'];
                console.log('✅ Set filteredStats.householdCount from geoOnlyResult:', filteredStats.householdCount);
              }
            }
          }
          
          // STEP 2: Fetch geographic + demographic for numerator (the "WHO")
          if (hasDemographicFilters) {
            console.log('🔄 Step 2: Fetching geographic+demographic count (WITH demographics) for numerator...');
            const response = await fetch('/api/combined-filters', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                universeFields: [],
                geographicFilters: geography || {},
                demographicFilters: demographicFilters, // Include demographics for numerator
                operator: currentFilters?.operator || 'AND',
                requestedLevels: levelsToRequest
              })
            });
            
            if (response.ok) {
              const result = await response.json();
              const totalCount = result.combinedCounts['total'] || 0;
              filteredStats.totalCount = totalCount;
              console.log(`👥 Geographic+Demographic count (WHO - numerator): ${totalCount.toLocaleString()}`);
              console.log(`📊 Header will show: ${totalCount.toLocaleString()} / ${geographicOnlyCount.toLocaleString()}`);
              
              // Extract hasCellPhoneCount and householdCount from result
              if (result.combinedCounts) {
                if (result.combinedCounts['hasCellPhoneCount'] !== undefined) {
                  filteredStats.hasCellPhoneCount = result.combinedCounts['hasCellPhoneCount'];
                  console.log('✅ Set filteredStats.hasCellPhoneCount from result:', filteredStats.hasCellPhoneCount);
                }
                if (result.combinedCounts['householdCount'] !== undefined) {
                  filteredStats.householdCount = result.combinedCounts['householdCount'];
                  console.log('✅ Set filteredStats.householdCount from result:', filteredStats.householdCount);
                }
              }
              
              if (result.filteredBreakdowns) {
                filteredStats.demographics = result.filteredBreakdowns.demographics;
                filteredStats.geography = result.filteredBreakdowns.geography;
                filteredStats.engagement = result.filteredBreakdowns.engagement;
                filteredStats.political = result.filteredBreakdowns.political;
                filteredStats.mediaConsumption = result.filteredBreakdowns.mediaConsumption;
                console.log(`✅ Geographic+Demographic filtering complete`);
              }
              
              return { filteredStats, geographicOnlyCount };
            }
          } else {
            // No demographic filters - use the already-fetched geographic-only result for both
            console.log('🔄 No demographic filters - using geographic-only result');
            
            if (geoOnlyResult) {
              const totalCount = geoOnlyResult.combinedCounts['total'] || 0;
              filteredStats.totalCount = totalCount;
              
              console.log('📦 geoOnlyResult structure:', {
                hasCombinedCounts: !!geoOnlyResult.combinedCounts,
                hasFilteredBreakdowns: !!geoOnlyResult.filteredBreakdowns,
                totalCount,
                hasCellPhoneCount: geoOnlyResult.combinedCounts?.['hasCellPhoneCount'],
                householdCount: geoOnlyResult.combinedCounts?.['householdCount'],
                demographicsKeys: geoOnlyResult.filteredBreakdowns?.demographics ? Object.keys(geoOnlyResult.filteredBreakdowns.demographics) : 'NONE'
              });
              
              // Ensure counts are preserved (they should already be set from earlier extraction)
              if (geoOnlyResult.combinedCounts) {
                if (geoOnlyResult.combinedCounts['hasCellPhoneCount'] !== undefined && !filteredStats.hasCellPhoneCount) {
                  filteredStats.hasCellPhoneCount = geoOnlyResult.combinedCounts['hasCellPhoneCount'];
                }
                if (geoOnlyResult.combinedCounts['householdCount'] !== undefined && !filteredStats.householdCount) {
                  filteredStats.householdCount = geoOnlyResult.combinedCounts['householdCount'];
                }
              }
              
              if (geoOnlyResult.filteredBreakdowns) {
                filteredStats.demographics = geoOnlyResult.filteredBreakdowns.demographics;
                filteredStats.geography = geoOnlyResult.filteredBreakdowns.geography;
                filteredStats.engagement = geoOnlyResult.filteredBreakdowns.engagement;
                filteredStats.political = geoOnlyResult.filteredBreakdowns.political;
                filteredStats.mediaConsumption = geoOnlyResult.filteredBreakdowns.mediaConsumption;
                
                console.log(`✅ Geographic-only filtering complete: ${totalCount.toLocaleString()}`);
                console.log('📊 filteredStats counts:', {
                  totalCount: filteredStats.totalCount,
                  hasCellPhoneCount: filteredStats.hasCellPhoneCount,
                  householdCount: filteredStats.householdCount
                });
                console.log('📊 filteredStats.demographics:', filteredStats.demographics);
                console.log('📊 filteredStats.demographics.gender:', filteredStats.demographics?.gender);
              } else {
                console.error('❌ NO filteredBreakdowns in geoOnlyResult!');
              }
              
              return { filteredStats, geographicOnlyCount: totalCount };
            } else {
              console.error('❌ geoOnlyResult is null - geographic fetch may have failed');
              return { filteredStats: originalStats, geographicOnlyCount: 0 };
            }
          }
        }
        
        // UNIVERSE FILTERS PRESENT: Make two calls to calculate numerator/denominator
        const response = await fetch('/api/combined-filters', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            universeFields,
            geographicFilters: geography || {},
            demographicFilters: demographicFilters,
            operator: currentFilters?.operator || 'AND',
            requestedLevels: levelsToRequest
          })
        });
        
        console.log('🌍 API response status:', response.status);
        
        if (response.ok) {
          const result = await response.json();
          console.log('🎯 Combined API response:', result.combinedCounts);
          console.log('🎯 Filtered breakdowns:', result.filteredBreakdowns);
          
          // Calculate geographic-only count for denominator (the "WHERE")
          // NOTE: Denominator should NEVER include demographic filters, only geography
          let geographicOnlyCount = 0;
          if (hasGeographicFilters) {
            console.log('🔄 Fetching geographic-only count (no demographics) for denominator...');
            const geoOnlyResponse = await fetch('/api/combined-filters', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                universeFields: [], 
                geographicFilters: geography || {},
                demographicFilters: {}, // NO demographic filters for denominator!
                requestedLevels: levelsToRequest
              })
            });
            
            if (geoOnlyResponse.ok) {
              const geoOnlyResult = await geoOnlyResponse.json();
              geographicOnlyCount = geoOnlyResult.combinedCounts['total'] || 0;
              console.log(`🗺️ Geographic-only count (WHERE - denominator): ${geographicOnlyCount.toLocaleString()}`);
              
              // Note: For universe filters, we use counts from the filtered result, not geoOnlyResult
              // geoOnlyResult is only for the denominator calculation
            }
          }
          
          // Update the universe counts with the combined results
          const combinedUniverseCounts = result.combinedCounts;
          Object.keys(combinedUniverseCounts).forEach(field => {
            filteredStats.universe[field] = combinedUniverseCounts[field];
          });
          
          // Use the total count from the backend (which handles AND/OR logic correctly)
          const totalCount = combinedUniverseCounts['total'] || 0;
          console.log(`📊 Total count from backend (${currentFilters?.operator || 'AND'} logic): ${totalCount}`);
          
          // Extract hasCellPhoneCount and householdCount from API response
          console.log('📱 Frontend - combinedUniverseCounts keys:', Object.keys(combinedUniverseCounts));
          console.log('📱 Frontend - hasCellPhoneCount value:', combinedUniverseCounts['hasCellPhoneCount']);
          console.log('🏠 Frontend - householdCount value:', combinedUniverseCounts['householdCount']);
          
          if (combinedUniverseCounts['hasCellPhoneCount'] !== undefined) {
            filteredStats.hasCellPhoneCount = combinedUniverseCounts['hasCellPhoneCount'];
            console.log('✅ Set filteredStats.hasCellPhoneCount to:', filteredStats.hasCellPhoneCount);
          } else {
            console.log('❌ hasCellPhoneCount is undefined in combinedUniverseCounts');
          }
          
          if (combinedUniverseCounts['householdCount'] !== undefined) {
            filteredStats.householdCount = combinedUniverseCounts['householdCount'];
            console.log('✅ Set filteredStats.householdCount to:', filteredStats.householdCount);
          } else {
            console.log('❌ householdCount is undefined in combinedUniverseCounts');
          }
          
          // Log individual counts for reference
          if (currentFilters?.conditions && currentFilters.conditions.length > 0) {
            currentFilters.conditions.forEach((condition: any) => {
              const { field } = condition;
              const fieldCount = combinedUniverseCounts[field] || 0;
              console.log(`📊 Individual universe filter ${field}: count = ${fieldCount}`);
            });
          }
          
          if (totalCount > 0) {
            filteredStats.totalCount = totalCount;
            console.log(`✅ Final combined total count: ${totalCount}`);
            console.log(`🎯 UI should now show total count: ${totalCount.toLocaleString()}`);
            
            // Use the actual filtered breakdowns from the database
            if (result.filteredBreakdowns) {
              filteredStats.demographics = result.filteredBreakdowns.demographics;
              filteredStats.geography = result.filteredBreakdowns.geography;
              filteredStats.engagement = result.filteredBreakdowns.engagement;
              filteredStats.political = result.filteredBreakdowns.political;
              filteredStats.mediaConsumption = result.filteredBreakdowns.mediaConsumption;
              console.log(`📊 Updated all breakdowns with filtered data from database`);
              console.log('📊 New demographics:', result.filteredBreakdowns.demographics);
              console.log('📊 New gender breakdown:', result.filteredBreakdowns.demographics?.gender);
              console.log('📊 New geography breakdown:', result.filteredBreakdowns.geography);
              console.log('📊 New media consumption breakdown:', result.filteredBreakdowns.mediaConsumption);
              console.log('📊 New DMA data:', result.filteredBreakdowns.geography?.dma);
              console.log('📊 New DMA data keys:', Object.keys(result.filteredBreakdowns.geography?.dma || {}));
              console.log('📊 New DMA data entries:', Object.entries(result.filteredBreakdowns.geography?.dma || {}));
            }
          }
          
          // Log final filteredStats before returning
          console.log('📊 Final filteredStats before return:', {
            totalCount: filteredStats.totalCount,
            hasCellPhoneCount: filteredStats.hasCellPhoneCount,
            householdCount: filteredStats.householdCount
          });
          
          return { filteredStats, geographicOnlyCount };
        } else {
          console.error('❌ Combined API failed:', response.status);
          const errorText = await response.text();
          console.error('❌ Error response:', errorText);
        }
      } catch (error) {
        console.error('❌ Error calling combined API:', error);
      }
    } else if (hasUniverseFilters && !hasGeographicFilters && !hasDemographicFilters) {
      console.log('🌌 Universe-only filtering - getting filtered demographic data');
      
      // CRITICAL: Always use originalStats.universe for universe-only filtering
      // Never use filteredStats.universe which may have been modified by combined filtering
      console.log('🌌 Using originalStats.universe for calculations:', Object.keys(originalStats.universe || {}));
      
      // Get filtered breakdowns for universe-only filtering
      let universeTotalCount = 0;
      
      try {
        const universeFields = currentFilters.conditions.map((condition: any) => condition.field);
        const response = await fetch('/api/combined-filters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            universeFields,
            geographicFilters: {}, // Empty geographic filters for universe-only
            demographicFilters: demographicFilters
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('🌌 Universe-only API response:', result);
          
          // Use filtered breakdowns from the API
          if (result.filteredBreakdowns) {
            filteredStats.demographics = result.filteredBreakdowns.demographics;
            filteredStats.geography = result.filteredBreakdowns.geography;
            filteredStats.engagement = result.filteredBreakdowns.engagement;
            filteredStats.political = result.filteredBreakdowns.political;
            filteredStats.mediaConsumption = result.filteredBreakdowns.mediaConsumption;
            console.log('🌌 Updated demographics with filtered data for universe-only');
            console.log('🌌 New demographics:', result.filteredBreakdowns.demographics);
            console.log('🌌 New gender breakdown:', result.filteredBreakdowns.demographics?.gender);
            console.log('🌌 New media consumption breakdown:', result.filteredBreakdowns.mediaConsumption);
          }
          
          // Calculate universe total count from the API response
          if (result.combinedCounts) {
            currentFilters.conditions.forEach((condition: any) => {
              const { field, operator } = condition;
              console.log(`🌌 Processing universe condition: ${field} ${operator}`);
              
              const fieldCount = result.combinedCounts[field] || 0;
              console.log(`📊 Universe filter ${field}: count = ${fieldCount} (from API)`);
              
              if (currentFilters.operator === 'AND') {
                if (universeTotalCount === 0) {
                  universeTotalCount = fieldCount;
                } else {
                  universeTotalCount = Math.min(universeTotalCount, fieldCount);
                }
              } else {
                universeTotalCount = Math.max(universeTotalCount, fieldCount);
              }
            });
            
            if (universeTotalCount > 0) {
              filteredStats.totalCount = universeTotalCount;
              console.log(`✅ Final universe total count: ${universeTotalCount}`);
              console.log(`🎯 UI should now show filtered universe count: ${universeTotalCount.toLocaleString()}`);
            }
          }
        } else {
          throw new Error(`API response not ok: ${response.status}`);
        }
      } catch (error) {
        console.error('❌ Error getting universe-only filtered data:', error);
        
        // Fallback to original calculation
        currentFilters.conditions.forEach((condition: any) => {
          const { field, operator, value } = condition;
          console.log(`🌌 Fallback processing universe condition: ${field} ${operator} ${value}`);
          
          if (originalStats.universe && originalStats.universe[field] !== undefined) {
            const fieldCount = originalStats.universe[field];
            console.log(`📊 Universe filter ${field}: count = ${fieldCount} (from originalStats fallback)`);
            
            if (currentFilters.operator === 'AND') {
              if (universeTotalCount === 0) {
                universeTotalCount = fieldCount;
              } else {
                universeTotalCount = Math.min(universeTotalCount, fieldCount);
              }
            } else {
              universeTotalCount = Math.max(universeTotalCount, fieldCount);
            }
          } else {
            console.log(`❌ Universe filter ${field}: not found in originalStats.universe`);
          }
        });
        
        if (universeTotalCount > 0) {
          filteredStats.totalCount = universeTotalCount;
          console.log(`✅ Final universe total count (fallback): ${universeTotalCount}`);
        } else {
          console.log(`❌ No universe total count calculated`);
        }
        
        // Fallback to original data
        filteredStats.universe = { ...originalStats.universe };
        filteredStats.demographics = { ...originalStats.demographics };
        filteredStats.geography = { ...originalStats.geography };
        filteredStats.engagement = { ...originalStats.engagement };
        filteredStats.political = { ...originalStats.political };
        filteredStats.mediaConsumption = { ...originalStats.mediaConsumption };
      }
      
      return { filteredStats, geographicOnlyCount: 0 };
    }
    
    // All filtering is now handled through the combined API above
    // No additional client-side filtering needed
    
    // No additional processing needed - all filtering handled by combined API above
    
    // All filtering and scaling is handled by the combined API above
    // No additional processing needed
    
    return { filteredStats, geographicOnlyCount: 0 };
  }, []);

  // Update filtered data when filters change
  useEffect(() => {
    if (isDataLoaded && originalAudienceStats) {
      // Check if we have any active filters (allow null selections)
      const hasGeographicFilters = geographicSelections && Object.values(geographicSelections).some((arr: any) => arr && arr.length > 0);
      const hasUniverseFilters = currentFilters && currentFilters.conditions.length > 0;
      const hasDemographicFilters = demographicSelections && Object.values(demographicSelections).some((arr: any) => arr && arr.length > 0);
      
      if (hasGeographicFilters || hasUniverseFilters || hasDemographicFilters) {
        // Apply client-side filtering on original stats
        const applyFilters = async () => {
          setIsFiltering(true);
          try {
            const result = await applyClientSideFilters(originalAudienceStats, geographicSelections, demographicSelections, currentFilters);
            console.log('🎯🎯🎯 applyClientSideFilters returned:', {
              hasResult: !!result,
              hasFilteredStats: !!(result && result.filteredStats),
              geographicOnlyCount: result?.geographicOnlyCount,
              totalCount: result?.filteredStats?.totalCount,
              demographicsGender: result?.filteredStats?.demographics?.gender
            });
            
            if (result && result.filteredStats) {
              console.log('🎯 Setting audienceStats with filtered data:', {
                totalCount: result.filteredStats.totalCount,
                hasCellPhoneCount: result.filteredStats.hasCellPhoneCount,
                householdCount: result.filteredStats.householdCount,
                demographics: result.filteredStats.demographics,
                gender: result.filteredStats.demographics?.gender
              });
              setAudienceStats(result.filteredStats);
              setGeographicOnlyCount(result.geographicOnlyCount);
              console.log('🎯 State set complete. geographicOnlyCount now:', result.geographicOnlyCount);
            } else {
              console.log('🎯 Setting audienceStats with original data (filteredStats was null)');
              setAudienceStats(originalAudienceStats);
              setGeographicOnlyCount(0);
            }
          } finally {
            setIsFiltering(false);
          }
        };
        applyFilters();
      } else {
        // No filters: fetch national breakdowns via combined-filters to trigger server-side demographics
        const fetchNational = async () => {
          try {
            // Reset geographic-only count since we're on National view
            setGeographicOnlyCount(0);
            
            const response = await fetch('/api/combined-filters', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                universeFields: [],
                geographicFilters: {},
                demographicFilters: {},
                requestedLevels: ['state', 'county', 'dma']
              })
            });
            if (response.ok) {
              const result = await response.json();
              const updated = { ...originalAudienceStats } as any;
              if (result.filteredBreakdowns) {
                updated.demographics = result.filteredBreakdowns.demographics;
                updated.geography = result.filteredBreakdowns.geography;
                updated.engagement = result.filteredBreakdowns.engagement;
                updated.political = result.filteredBreakdowns.political;
                updated.mediaConsumption = result.filteredBreakdowns.mediaConsumption;
              }
              // For National view (no filters), keep the original totalCount to ensure 100% percentage
              // Don't override with API count as it should match the original
              setAudienceStats(updated);
            } else {
              // Fallback to original if API fails
              setAudienceStats(originalAudienceStats);
            }
          } catch {
            setAudienceStats(originalAudienceStats);
          }
        };
        fetchNational();
      }
    }
  }, [isDataLoaded, geographicSelections, demographicSelections, currentFilters, applyClientSideFilters, originalAudienceStats]);

  const handleFiltersChange = useCallback((filters: FilterGroup | null) => {
    setPendingFilters(filters);
    setHasPendingChanges(true);
  }, []);

  const handleGeographicChange = useCallback((geography: any) => {
    console.log('handleGeographicChange called with:', geography);
    setPendingGeographicSelections(geography);
    setHasPendingChanges(true);
  }, []);

  const handleDemographicChange = useCallback((demographics: DemographicSelections) => {
    console.log('handleDemographicChange called with:', demographics);
    setPendingDemographicSelections(demographics);
    setHasPendingChanges(true);
  }, []);

  const getPendingFilterCount = useCallback(() => {
    let count = 0;
    
    // Count universe filter changes
    if (pendingFilters && pendingFilters.conditions) {
      count += pendingFilters.conditions.length;
    }
    
    // Count geographic filter changes
    if (pendingGeographicSelections) {
      Object.values(pendingGeographicSelections).forEach((arr: any) => {
        if (Array.isArray(arr) && arr.length > 0) {
          count += arr.length;
        }
      });
    }
    
    // Count demographic filter changes
    if (pendingDemographicSelections) {
      Object.values(pendingDemographicSelections).forEach((arr: any) => {
        if (Array.isArray(arr) && arr.length > 0) {
          count += arr.length;
        }
      });
    }
    
    return count;
  }, [pendingFilters, pendingGeographicSelections, pendingDemographicSelections]);

  const handleRunFilters = useCallback(async () => {
    if (!hasPendingChanges) return;
    
    setIsFiltering(true);
    setError(null);
    
    try {
      // Apply pending filters
      setCurrentFilters(pendingFilters);
      setGeographicSelections(pendingGeographicSelections);
      setDemographicSelections(pendingDemographicSelections);
      
      // Clear pending state
      setHasPendingChanges(false);
      
      // Apply the filters (this will trigger the useEffect that calls applyClientSideFilters)
      console.log('🎯 Applying filters:', { pendingFilters, pendingGeographicSelections, pendingDemographicSelections });
    } catch (error) {
      console.error('Error applying filters:', error);
      setError('Failed to apply filters');
    } finally {
      setIsFiltering(false);
    }
  }, [hasPendingChanges, pendingFilters, pendingGeographicSelections, pendingDemographicSelections]);

  const handleStateConfirm = useCallback(async (state: string, sourceElement: HTMLElement, geoSelections?: any) => {
    console.log('🗺️ Confirming state:', state);
    console.log('🗺️ Geographic selections passed:', geoSelections);
    console.log('🗺️ Pending geographic selections:', pendingGeographicSelections);
    
    // Use the passed geoSelections if provided, otherwise fall back to pendingGeographicSelections
    const selectionsToUse = geoSelections || pendingGeographicSelections;
    
    console.log('🎯 Updating selections - useEffect will handle filter application');
    console.log('🎯 Using geographic selections:', selectionsToUse);
    
    // Update selections and clear pending state
    // The useEffect will automatically trigger applyClientSideFilters
    setCurrentFilters(pendingFilters);
    setGeographicSelections(selectionsToUse);
    setDemographicSelections(pendingDemographicSelections);
    setHasPendingChanges(false);
    
    // Show the confirmed state
    setConfirmedState(state);
    setIsStateExpanded(false);
  }, [pendingFilters, pendingGeographicSelections, pendingDemographicSelections]);

  const handleStateEdit = useCallback(() => {
    console.log('🗺️ Editing state - expanding state selector');
    setIsStateExpanded(true);
    
    // Keep only state selection, clear everything else (county, districts, demographics)
    const currentState = geographicSelections?.state || pendingGeographicSelections?.state || [];
    const clearedSelections = {
      state: currentState,
      county: [],
      dma: [],
      congressional: [],
      stateSenateDistrict: [],
      stateHouseDistrict: []
    };
    
    console.log('🗺️ Resetting to state-only:', clearedSelections);
    setPendingGeographicSelections(clearedSelections);
    
    // Clear ALL demographic filters (both pending AND current) when editing geography
    console.log('🗺️ Clearing ALL demographic filters (pending and current)');
    setPendingDemographicSelections(null);
    setDemographicSelections(null);
    
    // Also clear universe filters
    console.log('🗺️ Clearing universe filters');
    setPendingFilters(null);
    setCurrentFilters(null);
    
    setHasPendingChanges(false);
  }, [geographicSelections, pendingGeographicSelections]);

  const handleNationalConfirm = useCallback(async () => {
    console.log('🌍 Confirming national view');
    
    const emptySelections = {
      state: [],
      county: [],
      dma: [],
      stateSenateDistrict: [],
      stateHouseDistrict: []
    };
    
    setIsFiltering(true);
    setError(null);
    
    try {
      // First set the geographic selections
      setGeographicSelections(emptySelections);
      setPendingGeographicSelections(emptySelections);
      setCurrentFilters(pendingFilters);
      setDemographicSelections(pendingDemographicSelections);
      setHasPendingChanges(false);
      
      // Fetch national data
      console.log('🎯 Fetching national data...');
      const response = await fetch('/api/combined-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universeFields: pendingFilters?.conditions?.map((c: any) => c.field) || [],
          geographicFilters: {},
          demographicFilters: pendingDemographicSelections || {},
          requestedLevels: ['state', 'county', 'dma']
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        const updated = { ...originalAudienceStats } as any;
        if (result.combinedCounts) {
          if (result.combinedCounts['hasCellPhoneCount'] !== undefined) {
            updated.hasCellPhoneCount = result.combinedCounts['hasCellPhoneCount'];
          }
          if (result.combinedCounts['householdCount'] !== undefined) {
            updated.householdCount = result.combinedCounts['householdCount'];
          }
        }
        if (result.filteredBreakdowns) {
          updated.demographics = result.filteredBreakdowns.demographics;
          updated.geography = result.filteredBreakdowns.geography;
          updated.engagement = result.filteredBreakdowns.engagement;
          updated.political = result.filteredBreakdowns.political;
          updated.mediaConsumption = result.filteredBreakdowns.mediaConsumption;
        }
        setAudienceStats(updated);
        setGeographicOnlyCount(0);
        console.log('✅ National data loaded successfully');
      }
      
      // Now show the confirmed view
      setConfirmedState("National");
      setIsStateExpanded(false);
      
      console.log('🎯 National view confirmed:', { pendingFilters, emptySelections });
    } catch (error) {
      console.error('Error applying national view:', error);
      setError('Failed to apply national view');
      setAudienceStats(originalAudienceStats);
    } finally {
      setIsFiltering(false);
    }
  }, [pendingFilters, pendingDemographicSelections, originalAudienceStats]);


  // Show minimal loading screen (fast API loads in ~1 second)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center space-y-6 p-8">
          {/* Simple Spinner */}
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-purple-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-purple-600 border-t-transparent animate-spin"></div>
          </div>
          
          {/* Simple Title */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">{loadingProgress}</h2>
          </div>
        </div>
      </div>
    );
  }

  // Show error screen
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center space-y-6 p-8 bg-white rounded-2xl shadow-xl border border-red-100 max-w-lg mx-4">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">Error Loading Data</h2>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
          
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const mmToPt = (mm: number) => (mm / 25.4) * 72;

  const handleExportPDF = async () => {
    if (!previewPanelRef.current) {
      console.error('Preview panel ref not found');
      return;
    }

    let blobUrl: string | null = null;
    try {
      setIsExportingPDF(true);
      await new Promise(resolve => setTimeout(resolve, 0));

      const [canvas, backgroundBytes, logoBytes] = await Promise.all([
        html2canvas(previewPanelRef.current, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          width: previewPanelRef.current.scrollWidth,
          height: previewPanelRef.current.scrollHeight,
        }),
        fetch('/blank_background_page.pdf').then(response => {
          if (!response.ok) {
            throw new Error('Failed to load PDF background');
          }
          return response.arrayBuffer();
        }),
        fetch('/causeway-solutions-logo-rgb_primary.png').then(response => {
          if (!response.ok) {
            throw new Error('Failed to load logo image');
          }
          return response.arrayBuffer();
        })
      ]);

      const imgData = canvas.toDataURL('image/png');
      const pdfDoc = await PDFDocument.load(backgroundBytes);
      const page = pdfDoc.getPages()[0];
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();

      const margin = mmToPt(4);
      const titleFontSize = 14;
      const dateFontSize = 9;
      const spacing = mmToPt(2);
      const headerHeight = mmToPt(15);

      const geoTitle = confirmedState === 'National'
        ? 'National Audience'
        : formatGeographicTitle(geographicSelections, { fallback: confirmedState || 'Geographic Selection' });
      const generatedOn = new Date().toLocaleDateString();

      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const filterBadges: string[] = [];
      const seenBadges = new Set<string>();

      const toTitleCase = (value: string) => {
        const formatted = value
          .replace(/_/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .replace(/\w+/g, word => word.charAt(0).toUpperCase() + word.slice(1));
        return formatted.replace(/\bOr\b/g, 'or').replace(/\bAnd\b/g, 'and');
      };

      const addBadge = (text: string) => {
        const trimmed = text.trim();
        if (trimmed && !seenBadges.has(trimmed)) {
          seenBadges.add(trimmed);
          filterBadges.push(trimmed);
        }
      };

      const toFriendlyDemographicValues = (values?: string[]) => {
        if (!values || values.length === 0) return [];
        if (
          values.length === 2 &&
          values.some(v => /or/i.test(v)) &&
          values.some(v => /and/i.test(v))
        ) {
          const andValue = values.find(v => /and/i.test(v));
          const orValue = values.find(v => /or/i.test(v));
          const remainder = values.filter(v => v !== andValue && v !== orValue).map(v => toTitleCase(String(v)));
          const friendlyAnd = andValue ? andValue.replace(/_/g, ' ').trim() : '';
          const friendlyOr = orValue ? orValue.replace(/_/g, ' ').trim() : '';
          return [friendlyAnd, friendlyOr, ...remainder.filter(Boolean)];
        }
        return values.map(v => toTitleCase(String(v)));
      };

      if (demographicSelections) {
        (Object.values(demographicSelections) as string[][]).forEach(values => {
          toFriendlyDemographicValues(values).forEach(addBadge);
        });
      }
 
      if (currentFilters?.conditions?.length) {
        const universeLabels = currentFilters.conditions
          .map((condition: any) => condition?.label || (condition?.field ? toTitleCase(String(condition.field)) : ''))
          .map(label => label.replace(/\s*=\s*yes$/i, '').trim())
          .filter(Boolean);
        universeLabels.forEach(addBadge);
      }

      if (geographicSelections) {
        const geographyLabelMap: Record<string, string> = {
          county: 'County',
          dma: 'DMA',
          congressional: 'Congressional District',
          stateSenateDistrict: 'State Senate District',
          stateHouseDistrict: 'State House District',
        };

        const geographyParts = Object.entries(geographyLabelMap)
          .map(([key, label]) => {
            const values = (geographicSelections as any)?.[key];
            return Array.isArray(values) && values.length > 0 ? `${label}: ${values.join(', ')}` : '';
          })
          .filter(Boolean);

        geographyParts.forEach(addBadge);
      }

      const gradientCanvas = document.createElement('canvas');
      gradientCanvas.width = 1200;
      gradientCanvas.height = Math.max(200, Math.floor(headerHeight));
      const gradientCtx = gradientCanvas.getContext('2d');
      let gradientImage: PDFImage | null = null;
      if (gradientCtx) {
        const gradient = gradientCtx.createLinearGradient(0, gradientCanvas.height, gradientCanvas.width, 0);
        gradient.addColorStop(0, '#FF4080');
        gradient.addColorStop(0.5, '#FF8C4D');
        gradient.addColorStop(1, '#FFD91A');
        gradientCtx.fillStyle = gradient;
        gradientCtx.fillRect(0, 0, gradientCanvas.width, gradientCanvas.height);

        const gradientBytes = await fetch(gradientCanvas.toDataURL('image/png')).then(res => res.arrayBuffer());
        gradientImage = await pdfDoc.embedPng(gradientBytes);
      }

      if (gradientImage) {
        page.drawImage(gradientImage, {
          x: 0,
          y: pageHeight - headerHeight,
          width: pageWidth,
          height: headerHeight
        });
      }

      const logoImage = await pdfDoc.embedPng(logoBytes);
      const desiredLogoWidth = mmToPt(42);
      const logoScale = desiredLogoWidth / logoImage.width;
      const logoWidth = logoImage.width * logoScale;
      const logoHeight = logoImage.height * logoScale;
      const headerTop = pageHeight - headerHeight;
      const headerMidY = headerTop + headerHeight / 2;
      const logoX = margin;
      const logoY = headerMidY - logoHeight / 2;
      page.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight
      });

      const titleHeight = boldFont.heightAtSize(titleFontSize);
      const titleY = headerMidY - titleHeight / 2;
      const titleWidth = boldFont.widthOfTextAtSize(geoTitle, titleFontSize);
      page.drawText(geoTitle, {
        x: Math.max((pageWidth - titleWidth) / 2, margin),
        y: titleY,
        size: titleFontSize,
        font: boldFont,
        color: rgb(1, 1, 1)
      });

      const dateText = `Generated ${generatedOn}`;
      const dateWidth = regularFont.widthOfTextAtSize(dateText, dateFontSize);
      const dateHeight = regularFont.heightAtSize(dateFontSize);
      const dateY = headerMidY - dateHeight / 2;
      page.drawText(dateText, {
        x: pageWidth - margin - dateWidth,
        y: dateY,
        size: dateFontSize,
        font: regularFont,
        color: rgb(0.95, 0.95, 0.95)
      });

      let contentTop = gradientImage ? headerTop : Math.min(titleY, dateY, logoY);

      if (filterBadges.length > 0) {
        const badgeFontSize = 9;
        const badgePaddingX = mmToPt(2.4);
        const badgePaddingY = mmToPt(1.2);
        const badgeGapX = mmToPt(2);
        const badgeGapY = mmToPt(2);
        const badgeTextHeight = regularFont.heightAtSize(badgeFontSize);
        const badgeRowHeight = badgeTextHeight + badgePaddingY * 2;

        const badgeLayouts: {
          x: number;
          y: number;
          width: number;
          height: number;
          text: string;
          textWidth: number;
          textHeight: number;
        }[] = [];

        let currentX = margin;
        let baselineY = contentTop - spacing - badgePaddingY - badgeFontSize;
        const maxX = pageWidth - margin;

        filterBadges.forEach(text => {
          const textWidth = regularFont.widthOfTextAtSize(text, badgeFontSize);
          const badgeWidth = textWidth + badgePaddingX * 2;

          if (currentX + badgeWidth > maxX && currentX > margin) {
            baselineY -= badgeRowHeight + badgeGapY;
            currentX = margin;
          }

          badgeLayouts.push({
            x: currentX,
            y: baselineY - badgePaddingY,
            width: badgeWidth,
            height: badgeRowHeight,
            text,
            textWidth,
            textHeight: badgeTextHeight,
          });

          currentX += badgeWidth + badgeGapX;
        });

        const badgesTop = Math.max(...badgeLayouts.map(item => item.y + item.height));
        const badgesBottom = Math.min(...badgeLayouts.map(item => item.y));
        const backgroundPadding = mmToPt(1);
        const backgroundY = badgesBottom - backgroundPadding;
        const backgroundHeight = (badgesTop - badgesBottom) + backgroundPadding * 2;

        page.drawRectangle({
          x: margin,
          y: backgroundY,
          width: pageWidth - margin * 2,
          height: backgroundHeight,
          color: rgb(0.96, 0.97, 1),
          opacity: 0.9,
        });

        const pxPerPt = 96 / 72;
        const canvasScale = 4;

        const badgeImages = await Promise.all(
          badgeLayouts.map(async layout => {
            const canvasWidthPx = Math.max(1, Math.round(layout.width * pxPerPt * canvasScale));
            const canvasHeightPx = Math.max(1, Math.round(layout.height * pxPerPt * canvasScale));
            const canvas = document.createElement('canvas');
            canvas.width = canvasWidthPx;
            canvas.height = canvasHeightPx;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              return { layout, image: null as PDFImage | null };
            }

            ctx.scale(canvasScale, canvasScale);
            ctx.imageSmoothingEnabled = true;

            const widthPx = layout.width * pxPerPt;
            const heightPx = layout.height * pxPerPt;
            const borderPx = 1.2;
            const radiusPx = heightPx / 2;

            const drawRoundedRect = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
              const r = Math.max(0, Math.min(radius, width / 2, height / 2));
              context.beginPath();
              context.moveTo(x + r, y);
              context.lineTo(x + width - r, y);
              context.quadraticCurveTo(x + width, y, x + width, y + r);
              context.lineTo(x + width, y + height - r);
              context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
              context.lineTo(x + r, y + height);
              context.quadraticCurveTo(x, y + height, x, y + height - r);
              context.lineTo(x, y + r);
              context.quadraticCurveTo(x, y, x + r, y);
              context.closePath();
            };

            ctx.lineWidth = borderPx;
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.8)';
            ctx.fillStyle = '#FFFFFF';
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            drawRoundedRect(ctx, borderPx / 2, borderPx / 2, widthPx - borderPx, heightPx - borderPx, radiusPx - borderPx);
            ctx.stroke();

            drawRoundedRect(ctx, borderPx, borderPx, widthPx - borderPx * 2, heightPx - borderPx * 2, radiusPx - borderPx * 1.5);
            ctx.fill();

            const pngDataUrl = canvas.toDataURL('image/png');
            const image = await pdfDoc.embedPng(pngDataUrl);
            return { layout, image };
          })
        );

        badgeImages.forEach(({ layout, image }) => {
          if (image) {
        page.drawImage(image, {
          x: layout.x,
          y: layout.y,
          width: layout.width,
          height: layout.height,
        });
          }

          const textX = layout.x + (layout.width - layout.textWidth) / 2;
          const textY = layout.y + (layout.height - layout.textHeight) / 2;

          page.drawText(layout.text, {
            x: textX,
            y: textY,
            size: badgeFontSize,
            font: regularFont,
            color: rgb(0.15, 0.17, 0.22),
          });
        });

        contentTop = backgroundY;
      }

      const pngImage = await pdfDoc.embedPng(imgData);
      const pngDims = pngImage.scale(1);

      const availableWidth = pageWidth - margin * 2;
      const topBoundary = contentTop - spacing;
      const effectiveTopBoundary = Math.max(topBoundary, margin + spacing);
      const availableHeight = effectiveTopBoundary - margin;

      const canvasRatio = pngDims.width / pngDims.height;
      let renderWidth = availableWidth;
      let renderHeight = renderWidth / canvasRatio;

      if (renderHeight > availableHeight) {
        renderHeight = availableHeight;
        renderWidth = renderHeight * canvasRatio;
      }

      const imageX = margin + (availableWidth - renderWidth) / 2;
      const imageY = margin;

      page.drawImage(pngImage, {
        x: imageX,
        y: imageY,
        width: renderWidth,
        height: renderHeight
      });

      const pdfBytes = await pdfDoc.save();
      const pdfArrayBuffer = pdfBytes.buffer.slice(
        pdfBytes.byteOffset,
        pdfBytes.byteOffset + pdfBytes.byteLength
      ) as ArrayBuffer;
      const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
      const fileName = `audience-preview-${new Date().toISOString().split('T')[0]}.pdf`;
      blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('PDF exported successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-orange-50 to-yellow-50">
      {isExportingPDF && (
        <div className="fixed inset-0 z-[9999] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 px-6 py-5 flex items-center space-x-4">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-[3px] border-orange-200"></div>
              <div className="absolute inset-0 rounded-full border-[3px] border-orange-500 border-t-transparent animate-spin"></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Preparing PDF export…</p>
              <p className="text-xs text-gray-600">This may take a few seconds</p>
            </div>
          </div>
        </div>
      )}

      <Header 
        totalCount={
          // Denominator: Geographic filtered count (or total if no geo filters)
          geographicOnlyCount > 0 ? geographicOnlyCount : originalAudienceStats?.totalCount || 0
        }
        filteredCount={
          // Numerator: Combined filters count (or geo-only if no universe filters)
          audienceStats?.totalCount || 0
        }
        onExportPDF={handleExportPDF}
        showStats={!isStateExpanded}
      />

      {/* Geographic Summary Banner - Show when geography is confirmed */}
      {!isStateExpanded && confirmedState && (
        <GeoBanner 
          geographicSelections={geographicSelections}
          isNational={confirmedState === 'National'}
          onClick={handleStateEdit}
        />
      )}
      
      {/* Filter Loading Overlay - Show whenever filtering, regardless of wizard state */}
      {isFiltering && (
        <div className="fixed inset-0 bg-gray-500/30 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <div className="text-center space-y-4 p-6 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 max-w-sm mx-4">
            <div className="relative mx-auto w-10 h-10">
              <div className="absolute inset-0 rounded-full border-2 border-purple-200/50"></div>
              <div className="absolute inset-0 rounded-full border-2 border-purple-600 border-t-transparent animate-spin"></div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-gray-900">Applying Filters</h3>
              <p className="text-xs text-gray-600">Processing audience data...</p>
            </div>
          </div>
        </div>
      )}

      <div className={`mx-auto px-4 py-8 ${isStateExpanded ? 'max-w-5xl' : 'container'}`} style={{ overflow: 'visible' }}>
        <div className="space-y-8" style={{ overflow: 'visible' }}>

          {/* Geographic Wizard - Always show when expanded */}
          {isStateExpanded && (
            <div style={{ overflow: 'visible' }}>
              <GeoWizard
                onGeographicChange={handleGeographicChange}
                isDataLoaded={isDataLoaded}
                audienceStats={originalAudienceStats}
                universeFilters={pendingFilters}
                currentSelections={pendingGeographicSelections}
                hasPendingChanges={hasPendingChanges}
                onStateConfirm={handleStateConfirm}
                onNationalConfirm={handleNationalConfirm}
                demographicSelections={pendingDemographicSelections}
              />
            </div>
          )}

          {/* Main Content Area - Show when geography is confirmed and NOT editing */}
          {!isStateExpanded && confirmedState && (
            <>

              {/* Universe Filters - Full Width at Top */}
              <div className="overflow-visible">
                <FilterBuilder
                  onFiltersChange={handleFiltersChange}
                  isDataLoaded={isDataLoaded}
                  audienceStats={originalAudienceStats}
                  hasPendingChanges={hasPendingChanges}
                  showGeographyLink={confirmedState === "National"}
                  onGeographyClick={handleStateEdit}
                />
              </div>

              {/* Two Column Layout Below: Demographics | Preview */}
              <div className="flex flex-col xl:flex-row gap-6 lg:gap-8">
                {/* Left Column - Demographic Filters */}
                <div className="xl:w-80 flex-shrink-0">
                  <DemographicFilterPane
                    onDemographicChange={handleDemographicChange}
                    isDataLoaded={isDataLoaded}
                    audienceStats={originalAudienceStats}
                    currentSelections={pendingDemographicSelections || undefined}
                    onRunFilters={handleRunFilters}
                    hasPendingChanges={hasPendingChanges}
                    isFiltering={isFiltering}
                    getPendingFilterCount={getPendingFilterCount}
                  />
                </div>
                
                {/* Right Column - Preview Panel */}
                <div className="flex-1 min-w-0" ref={previewPanelRef}>
                  <PreviewPanel
                    audienceStats={audienceStats}
                    filteredCount={audienceStats?.totalCount || 0}
                    totalCount={
                      // Use geographic-only count as denominator if geographic filters are active
                      geographicOnlyCount > 0 ? geographicOnlyCount : originalAudienceStats?.totalCount || 0
                    }
                    geographicFilters={geographicSelections}
                    hideLiveBadge={isExportingPDF}
                    hideHeader={isExportingPDF}
                  />
                </div>
              </div>

              {/* Visualizations - Full Width Below */}
              {/* Temporarily hidden until ready to fix */}
              {/* <div className="mt-6 lg:mt-8">
                <VisualizationPanel
                  audienceStats={audienceStats}
                  filteredData={filteredData}
                />
              </div> */}
            </>
          )}
        </div>
      </div>

    </div>
  );
}