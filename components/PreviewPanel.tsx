'use client';

import type { CSSProperties } from 'react';
import { Users, MapPin, Target, PercentCircle, Zap, Home, Smartphone } from 'lucide-react';
import { AudienceStats } from '@/types/audience';
import { formatCountyName, formatStateName } from '@/lib/geoTitle';

interface PreviewPanelProps {
  audienceStats: AudienceStats | null;
  filteredCount: number;
  totalCount: number;
  geographicFilters?: any;
  hideLiveBadge?: boolean;
  hideHeader?: boolean;
}

export function PreviewPanel({ audienceStats, filteredCount, totalCount, geographicFilters, hideLiveBadge = false, hideHeader = false }: PreviewPanelProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const cardBorderStyle: CSSProperties = {
    border: '1.5px solid rgba(148, 163, 184, 0.8)',
    backgroundColor: '#ffffff',
    boxShadow: '0 12px 24px rgba(15, 23, 42, 0.06)'
  };


  const getTopGeographic = (geography: any, limit = 3) => {
    if (!geography || typeof geography !== 'object') {
      return [];
    }
    return Object.entries(geography)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, limit)
      .map(([key, value]) => ({ key, value: value as number }));
  };

  if (!audienceStats) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2 tracking-tight">
              Audience Preview
            </h2>
            <p className="text-gray-600 text-sm lg:text-base">
              Real-time audience insights and demographics
            </p>
          </div>
        </div>
        <div className="text-center py-12 text-gray-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading preview...</p>
          <p className="text-sm">Analyzing audience data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 lg:p-8">
      {!hideHeader && (
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2 tracking-tight">
              Audience Preview
            </h2>
            <p className="text-gray-600 text-sm lg:text-base font-medium">
              Real-time audience insights and demographics
            </p>
          </div>
          {!hideLiveBadge && (
            <div className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-pink-50 to-orange-50 rounded-xl border border-orange-200 shadow-sm">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse shadow-sm"></div>
              <span className="text-orange-700 text-sm font-bold">Live Data</span>
            </div>
          )}
        </div>
      )}
      
      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <div 
          className="group relative overflow-hidden rounded-2xl bg-white p-6 hover:shadow-lg transition-all duration-300"
          style={cardBorderStyle}
        >
          <div className="relative">
            <div 
              className="flex items-center justify-center w-12 h-12 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300"
              style={{
                background: 'linear-gradient(135deg, #FF4080, #FF8C4D)'
              }}
            >
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="text-2xl lg:text-3xl font-bold mb-1 text-gray-900">
              {formatNumber(filteredCount)}
            </div>
            <div className="text-sm font-semibold text-gray-600">
              Total Audience
            </div>
          </div>
        </div>
        
        <div 
          className="group relative overflow-hidden rounded-2xl bg-white p-6 hover:shadow-lg transition-all duration-300"
          style={cardBorderStyle}
        >
          <div className="relative">
            <div 
              className="flex items-center justify-center w-12 h-12 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300"
              style={{
                background: 'linear-gradient(135deg, #FF4080, #FF8C4D)'
              }}
            >
              <PercentCircle className="h-6 w-6 text-white" />
            </div>
            <div className="text-2xl lg:text-3xl font-bold mb-1 text-gray-900">
              {totalCount > 0 ? `${((filteredCount / totalCount) * 100).toFixed(1)}%` : '0%'}
            </div>
            <div className="text-sm font-semibold text-gray-600">
              of Total Population
            </div>
          </div>
        </div>
        
        <div 
          className="group relative overflow-hidden rounded-2xl bg-white p-6 hover:shadow-lg transition-all duration-300"
          style={cardBorderStyle}
        >
          <div className="relative">
            <div 
              className="flex items-center justify-center w-12 h-12 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300"
              style={{
                background: 'linear-gradient(135deg, #FF4080, #FF8C4D)'
              }}
            >
              <Home className="h-6 w-6 text-white" />
            </div>
            <div className="text-2xl lg:text-3xl font-bold mb-1 text-gray-900">
              {formatNumber(audienceStats?.householdCount || 0)}
            </div>
            <div className="text-sm font-semibold text-gray-600">
              Households
            </div>
          </div>
        </div>
        
        <div 
          className="group relative overflow-hidden rounded-2xl bg-white p-6 hover:shadow-lg transition-all duration-300"
          style={cardBorderStyle}
        >
          <div className="relative">
            <div 
              className="flex items-center justify-center w-12 h-12 rounded-xl mb-4 group-hover:scale-110 transition-transform duration-300"
              style={{
                background: 'linear-gradient(135deg, #FF4080, #FF8C4D)'
              }}
            >
              <Smartphone className="h-6 w-6 text-white" />
            </div>
            <div className="text-2xl lg:text-3xl font-bold mb-1 text-gray-900">
              {formatNumber(audienceStats?.hasCellPhoneCount || 0)}
            </div>
            <div className="text-sm font-semibold text-gray-600">
              Cell Phone Counts
            </div>
          </div>
        </div>
      </div>

      {/* Demographics Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div 
          className="bg-white rounded-2xl p-6 shadow-sm"
          style={cardBorderStyle}
        >
          <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center">
            <div className="w-2.5 h-2.5 rounded-full mr-3 shadow-sm" style={{ background: 'linear-gradient(135deg, #FF4080, #FF8C4D)' }}></div>
            Demographic Breakdown
          </h3>
          
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Gender</div>
              <div className="space-y-2">
                {(() => {
                  const genderEntries = Object.entries(audienceStats.demographics?.gender || {})
                    .filter(([key]) => {
                      const lower = key.toLowerCase().trim();
                      return lower !== 'unknown' && lower !== 'other/unknown' && lower !== 'other-unknown';
                    });
                  const genderTotal = genderEntries.reduce((sum, [, value]) => sum + (value as number), 0);
                  return genderEntries.map(([key, value]) => {
                    const percentage = genderTotal > 0 ? ((value as number) / genderTotal * 100).toFixed(1) : '0.0';
                    return (
                      <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                        <span className="text-gray-600 text-sm font-medium">{key || 'Unknown'}</span>
                        <div className="text-right">
                          <span className="font-bold text-gray-900">{formatNumber(value as number)}</span>
                          <span className="text-xs text-gray-500 ml-2">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Age Range</div>
              <div className="space-y-2">
                {Object.entries(audienceStats.demographics?.age || {})
                  .filter(([key]) => {
                    const lower = key.toLowerCase().trim();
                    return lower !== 'unknown' && lower !== 'other/unknown' && lower !== 'other-unknown';
                  })
                  .sort(([a], [b]) => {
                    // Define age range order
                    const ageOrder = [
                      '18-24', '25-34', '35-44', '45-54', '55-64', '65+'
                    ];
                    const aIndex = ageOrder.indexOf(a);
                    const bIndex = ageOrder.indexOf(b);
                    
                    // If both are in the order array, sort by their position
                    if (aIndex !== -1 && bIndex !== -1) {
                      return aIndex - bIndex;
                    }
                    
                    // If only one is in the order array, prioritize it
                    if (aIndex !== -1) return -1;
                    if (bIndex !== -1) return 1;
                    
                    // If neither is in the order array, sort alphabetically
                    return a.localeCompare(b);
                  })
                  .map(([key, value]) => {
                    const ageEntries = Object.entries(audienceStats.demographics?.age || {})
                      .filter(([k]) => {
                        const lower = k.toLowerCase().trim();
                        return lower !== 'unknown' && lower !== 'other/unknown' && lower !== 'other-unknown';
                      });
                    const ageTotal = ageEntries.reduce((sum, [, val]) => sum + (val as number), 0);
                    const percentage = ageTotal > 0 ? ((value as number) / ageTotal * 100).toFixed(1) : '0.0';
                    return (
                      <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                        <span className="text-gray-600 text-sm font-medium">{key || 'Unknown'}</span>
                        <div className="text-right">
                          <span className="font-bold text-gray-900">{formatNumber(value as number)}</span>
                          <span className="text-xs text-gray-500 ml-2">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Ethnicity</div>
              <div className="space-y-2">
                {(() => {
                  const ethnicityEntries = Object.entries(audienceStats.demographics?.ethnicity || {});
                  const ethnicityTotal = ethnicityEntries.reduce((sum, [, value]) => sum + (value as number), 0);
                  return ethnicityEntries.map(([key, value]) => {
                    const percentage = ethnicityTotal > 0 ? ((value as number) / ethnicityTotal * 100).toFixed(1) : '0.0';
                    return (
                      <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                        <span className="text-gray-600 text-sm font-medium">{key || 'Unknown'}</span>
                        <div className="text-right">
                          <span className="font-bold text-gray-900">{formatNumber(value as number)}</span>
                          <span className="text-xs text-gray-500 ml-2">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>

        <div 
          className="bg-white rounded-2xl p-6 shadow-sm"
          style={cardBorderStyle}
        >
          <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center">
            <div className="w-2.5 h-2.5 rounded-full mr-3 shadow-sm" style={{ background: 'linear-gradient(135deg, #FF4080, #FF8C4D)' }}></div>
            Geographic Breakdown
          </h3>
          
          <div className="space-y-4">
            {(() => {
              // Helper function to render a geographic category
              const renderGeographicCategory = (label: string, data: { [key: string]: number }, topN?: number, sortByName = false) => {
                const entries = Object.entries(data || {});
                const total = entries.reduce((sum, [, value]) => sum + (value as number), 0);

                const sortByNumericLabel = ([keyA]: [string, number], [keyB]: [string, number]) => {
                  const numA = parseInt(keyA.match(/\d+/)?.[0] || '0');
                  const numB = parseInt(keyB.match(/\d+/)?.[0] || '0');
                  return numA - numB;
                };

                let displayEntries: [string, number][];

                if (topN && topN > 0) {
                  const topEntries = [...entries]
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, topN);

                  displayEntries = sortByName
                    ? topEntries.sort(sortByNumericLabel)
                    : topEntries;
                } else {
                  displayEntries = sortByName
                    ? [...entries].sort(sortByNumericLabel)
                    : [...entries].sort(([, a], [, b]) => (b as number) - (a as number));
                }

                if (displayEntries.length === 0) return null;
                
                return (
                  <div key={label}>
                    <div className="text-sm font-semibold text-gray-700 mb-2">{label}</div>
                    <div className="space-y-2">
                      {displayEntries.map(([key, value]) => {
                        const percentage = total > 0 ? ((value as number) / total * 100).toFixed(1) : '0.0';
                        const displayKey = label === 'County'
                          ? formatCountyName(key)
                          : label === 'State'
                            ? formatStateName(key)
                            : key;
                        return (
                          <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                            <span className="text-gray-600 text-sm font-medium">{displayKey || 'Unknown'}</span>
                            <div className="text-right">
                              <span className="font-bold text-gray-900">{formatNumber(value as number)}</span>
                              <span className="text-xs text-gray-500 ml-2">({percentage}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              };

              // Determine which geography type is selected
              const hasStateSelection = geographicFilters?.state && geographicFilters.state.length > 0;
              const hasDmaSelection = geographicFilters?.dma && geographicFilters.dma.length > 0;
              const hasCountySelection = geographicFilters?.county && geographicFilters.county.length > 0;
              const hasCongressionalSelection = geographicFilters?.congressional && geographicFilters.congressional.length > 0;
              const hasStateSenateSelection = geographicFilters?.stateSenateDistrict && geographicFilters.stateSenateDistrict.length > 0;
              const hasStateHouseSelection = geographicFilters?.stateHouseDistrict && geographicFilters.stateHouseDistrict.length > 0;
              const isNationalView = !hasStateSelection && !hasDmaSelection && !hasCountySelection && !hasCongressionalSelection && !hasStateSenateSelection && !hasStateHouseSelection;

              // Conditional rendering based on selection type
              if (hasCountySelection) {
                // County selected: show State, Congressional District, State Senate District, State House District
                return (
                  <>
                    {renderGeographicCategory('State', audienceStats.geography?.state || {})}
                    {renderGeographicCategory('Congressional District', audienceStats.geography?.congressional || {}, 5, true)}
                    {renderGeographicCategory('State Senate District', audienceStats.geography?.stateSenateDistrict || {}, 5, true)}
                    {renderGeographicCategory('State House District', audienceStats.geography?.stateHouseDistrict || {}, 5, true)}
                  </>
                );
              } else if (hasCongressionalSelection) {
                // Congressional District selected: show County, State Senate District, State House District
                return (
                  <>
                    {renderGeographicCategory('County', audienceStats.geography?.county || {})}
                    {renderGeographicCategory('State Senate District', audienceStats.geography?.stateSenateDistrict || {}, undefined, true)}
                    {renderGeographicCategory('State House District', audienceStats.geography?.stateHouseDistrict || {}, undefined, true)}
                  </>
                );
              } else if (hasStateSenateSelection) {
                // State Senate District selected: show County, Congressional District, State House District
                return (
                  <>
                    {renderGeographicCategory('County', audienceStats.geography?.county || {})}
                    {renderGeographicCategory('Congressional District', audienceStats.geography?.congressional || {}, undefined, true)}
                    {renderGeographicCategory('State House District', audienceStats.geography?.stateHouseDistrict || {}, undefined, true)}
                  </>
                );
              } else if (hasStateHouseSelection) {
                // State House District selected: show County, Congressional District, State Senate District
                return (
                  <>
                    {renderGeographicCategory('County', audienceStats.geography?.county || {})}
                    {renderGeographicCategory('Congressional District', audienceStats.geography?.congressional || {}, undefined, true)}
                    {renderGeographicCategory('State Senate District', audienceStats.geography?.stateSenateDistrict || {}, undefined, true)}
                  </>
                );
              } else {
                // National or state-only selected
                return (
                  <>
                    {renderGeographicCategory('State', audienceStats.geography?.state || {}, isNationalView ? 5 : undefined)}
                    {renderGeographicCategory('County', audienceStats.geography?.county || {}, 5)}
                    {renderGeographicCategory('DMA', audienceStats.geography?.dma || {}, 5)}
                  </>
                );
              }
            })()}
          </div>
        </div>
      </div>

      {/* Engagement & Political Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div 
          className="bg-white rounded-2xl p-6 shadow-sm"
          style={cardBorderStyle}
        >
          <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center">
            <div className="w-2.5 h-2.5 rounded-full mr-3 shadow-sm" style={{ background: 'linear-gradient(135deg, #FF4080, #FF8C4D)' }}></div>
            Political Affiliation
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-white/50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Democrat</span>
              <div className="flex items-center space-x-3">
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${filteredCount > 0 ? (audienceStats.political?.democrat || 0) / filteredCount * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-bold text-blue-600 whitespace-nowrap w-20 text-right">{formatNumber(audienceStats.political?.democrat || 0)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Republican</span>
              <div className="flex items-center space-x-3">
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-red-500 to-red-600 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${filteredCount > 0 ? (audienceStats.political?.republican || 0) / filteredCount * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-bold text-red-600 whitespace-nowrap w-20 text-right">{formatNumber(audienceStats.political?.republican || 0)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-white/50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Independent</span>
              <div className="flex items-center space-x-3">
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-gray-500 to-gray-600 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${filteredCount > 0 ? (audienceStats.political?.independent || 0) / filteredCount * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-bold text-gray-600 whitespace-nowrap w-20 text-right">{formatNumber(audienceStats.political?.independent || 0)}</span>
              </div>
            </div>
          </div>
        </div>

        <div 
          className="bg-white rounded-2xl p-6 shadow-sm"
          style={cardBorderStyle}
        >
          <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center">
            <div className="w-2.5 h-2.5 rounded-full mr-3 shadow-sm" style={{ background: 'linear-gradient(135deg, #FF4080, #FF8C4D)' }}></div>
            Media Consumption
          </h3>
          <div className="space-y-3">
            {(() => {
              // Placeholder data for media consumption
              const mediaData = [
                { name: 'Instagram', value: 0 },
                { name: 'Facebook', value: 0 },
                { name: 'X', value: 0 },
                { name: 'YouTube', value: 0 },
                { name: 'Streaming', value: 0 },
              ];
              
              // Calculate total for percentages (using placeholder values)
              const mediaTotal = mediaData.reduce((sum, item) => sum + item.value, 0);
              
              // Color gradients for different media platforms
              const getGradientClass = (name: string) => {
                if (name === 'Instagram') return 'from-pink-500 to-purple-500';
                if (name === 'Facebook') return 'from-blue-500 to-indigo-500';
                if (name === 'X') return 'from-gray-500 to-slate-500';
                if (name === 'YouTube') return 'from-red-500 to-orange-500';
                if (name === 'Streaming') return 'from-purple-500 to-pink-500';
                return 'from-gray-400 to-gray-500';
              };
              
              const getTextColor = (name: string) => {
                if (name === 'Instagram') return 'text-pink-600';
                if (name === 'Facebook') return 'text-blue-600';
                if (name === 'X') return 'text-gray-600';
                if (name === 'YouTube') return 'text-red-600';
                if (name === 'Streaming') return 'text-purple-600';
                return 'text-gray-600';
              };
              
              return mediaData.map((item) => {
                const percentage = mediaTotal > 0 ? (item.value / mediaTotal * 100) : 0;
                
                return (
                  <div key={item.name} className="flex justify-between items-center p-3 bg-white/50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                    <div className="flex items-center space-x-3">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`bg-gradient-to-r ${getGradientClass(item.name)} h-2 rounded-full transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className={`text-sm font-bold ${getTextColor(item.name)} whitespace-nowrap w-20 text-right`}>
                        {formatNumber(item.value)}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div 
          className="bg-white rounded-2xl p-6 shadow-sm"
          style={cardBorderStyle}
        >
          <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center">
            <div className="w-2.5 h-2.5 rounded-full mr-3 shadow-sm" style={{ background: 'linear-gradient(135deg, #FF4080, #FF8C4D)' }}></div>
            General Vote History
          </h3>
          <div className="space-y-3">
            {(() => {
              // Get vote history data (use engagement key for backward compatibility or generalVoteHistory if available)
              const voteHistory = audienceStats.generalVoteHistory || audienceStats.engagement || {};
              const voteHistoryEntries = Object.entries(voteHistory);
              
              // Calculate total for percentages
              const voteHistoryTotal = voteHistoryEntries.reduce((sum, [, value]) => sum + (typeof value === 'number' ? value : 0), 0);
              
              // Sort entries by vote count (0 of 4, 1 of 4, 2 of 4, 3 of 4, 4 of 4)
              const sortedEntries = voteHistoryEntries.sort(([a], [b]) => {
                const extractNumber = (str: string) => {
                  const match = str.match(/^(\d+)\s+of\s+\d+$/);
                  return match ? parseInt(match[1], 10) : -1;
                };
                const aNum = extractNumber(a);
                const bNum = extractNumber(b);
                if (aNum !== -1 && bNum !== -1) return aNum - bNum;
                if (aNum !== -1) return -1;
                if (bNum !== -1) return 1;
                return a.localeCompare(b);
              });
              
              // Color gradients for different vote counts
              const getGradientClass = (key: string) => {
                const num = key.match(/^(\d+)\s+of/) ? parseInt(key.match(/^(\d+)\s+of/)?.[1] || '0', 10) : 0;
                if (num === 0) return 'from-red-500 to-pink-500'; // 0 of 4 - red
                if (num === 1) return 'from-orange-500 to-red-500'; // 1 of 4 - orange
                if (num === 2) return 'from-yellow-500 to-orange-500'; // 2 of 4 - yellow
                if (num === 3) return 'from-green-400 to-yellow-500'; // 3 of 4 - yellow-green
                return 'from-green-500 to-emerald-500'; // 4 of 4 - green
              };
              
              const getTextColor = (key: string) => {
                const num = key.match(/^(\d+)\s+of/) ? parseInt(key.match(/^(\d+)\s+of/)?.[1] || '0', 10) : 0;
                if (num === 0) return 'text-red-600';
                if (num === 1) return 'text-orange-600';
                if (num === 2) return 'text-yellow-600';
                if (num === 3) return 'text-green-600';
                return 'text-green-600';
              };
              
              return sortedEntries.map(([key, value]) => {
                const count = typeof value === 'number' ? value : 0;
                const percentage = voteHistoryTotal > 0 ? (count / voteHistoryTotal * 100) : 0;
                
                return (
                  <div key={key} className="flex justify-between items-center p-3 bg-white/50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">{key}</span>
                    <div className="flex items-center space-x-3">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`bg-gradient-to-r ${getGradientClass(key)} h-2 rounded-full transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className={`text-sm font-bold ${getTextColor(key)} whitespace-nowrap w-20 text-right`}>
                        {formatNumber(count)}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div 
          className="bg-white rounded-2xl p-6 shadow-sm"
          style={cardBorderStyle}
        >
          <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center">
            <div className="w-2.5 h-2.5 rounded-full mr-3 shadow-sm" style={{ background: 'linear-gradient(135deg, #FF4080, #FF8C4D)' }}></div>
            Primary Vote History
          </h3>
          <div className="space-y-3">
            {(() => {
              // Get vote history data (use mediaConsumption key for backward compatibility or primaryVoteHistory if available)
              const voteHistory = audienceStats.primaryVoteHistory || audienceStats.mediaConsumption || {};
              const voteHistoryEntries = Object.entries(voteHistory);
              
              // Calculate total for percentages
              const voteHistoryTotal = voteHistoryEntries.reduce((sum, [, value]) => sum + (typeof value === 'number' ? value : 0), 0);
              
              // Sort entries by vote count (0 of 4, 1 of 4, 2 of 4, 3 of 4, 4 of 4)
              const sortedEntries = voteHistoryEntries.sort(([a], [b]) => {
                const extractNumber = (str: string) => {
                  const match = str.match(/^(\d+)\s+of\s+\d+$/);
                  return match ? parseInt(match[1], 10) : -1;
                };
                const aNum = extractNumber(a);
                const bNum = extractNumber(b);
                if (aNum !== -1 && bNum !== -1) return aNum - bNum;
                if (aNum !== -1) return -1;
                if (bNum !== -1) return 1;
                return a.localeCompare(b);
              });
              
              // Color gradients for different vote counts
              const getGradientClass = (key: string) => {
                const num = key.match(/^(\d+)\s+of/) ? parseInt(key.match(/^(\d+)\s+of/)?.[1] || '0', 10) : 0;
                if (num === 0) return 'from-red-500 to-pink-500'; // 0 of 4 - red
                if (num === 1) return 'from-orange-500 to-red-500'; // 1 of 4 - orange
                if (num === 2) return 'from-yellow-500 to-orange-500'; // 2 of 4 - yellow
                if (num === 3) return 'from-green-400 to-yellow-500'; // 3 of 4 - yellow-green
                return 'from-green-500 to-emerald-500'; // 4 of 4 - green
              };
              
              const getTextColor = (key: string) => {
                const num = key.match(/^(\d+)\s+of/) ? parseInt(key.match(/^(\d+)\s+of/)?.[1] || '0', 10) : 0;
                if (num === 0) return 'text-red-600';
                if (num === 1) return 'text-orange-600';
                if (num === 2) return 'text-yellow-600';
                if (num === 3) return 'text-green-600';
                return 'text-green-600';
              };
              
              return sortedEntries.map(([key, value]) => {
                const count = typeof value === 'number' ? value : 0;
                const percentage = voteHistoryTotal > 0 ? (count / voteHistoryTotal * 100) : 0;
                
                return (
                  <div key={key} className="flex justify-between items-center p-3 bg-white/50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">{key}</span>
                    <div className="flex items-center space-x-3">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`bg-gradient-to-r ${getGradientClass(key)} h-2 rounded-full transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className={`text-sm font-bold ${getTextColor(key)} whitespace-nowrap w-20 text-right`}>
                        {formatNumber(count)}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}