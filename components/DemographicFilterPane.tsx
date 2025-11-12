'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, User, TrendingUp, DollarSign, GraduationCap, X } from 'lucide-react';

interface DemographicFilterPaneProps {
  onDemographicChange: (demographic: DemographicSelections) => void;
  isDataLoaded: boolean;
  audienceStats?: any;
  currentSelections?: DemographicSelections;
  onRunFilters?: () => void;
  hasPendingChanges?: boolean;
  isFiltering?: boolean;
  getPendingFilterCount?: () => number;
}

export interface DemographicSelections {
  gender: string[];
  age: string[];
  ethnicity: string[];
  income: string[];
  education: string[];
}

const DEMOGRAPHIC_CATEGORIES = [
  {
    key: 'gender',
    label: 'Gender',
    icon: Users,
    gradient: 'from-blue-400 to-blue-500',
    bgColor: 'bg-gradient-to-br from-blue-50 to-blue-100',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    iconBg: 'bg-blue-100',
  },
  {
    key: 'age',
    label: 'Age Range',
    icon: TrendingUp,
    gradient: 'from-green-400 to-green-500',
    bgColor: 'bg-gradient-to-br from-green-50 to-green-100',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    iconBg: 'bg-green-100',
  },
  {
    key: 'ethnicity',
    label: 'Ethnicity',
    icon: User,
    gradient: 'from-purple-400 to-purple-500',
    bgColor: 'bg-gradient-to-br from-purple-50 to-purple-100',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-800',
    iconBg: 'bg-purple-100',
  },
  {
    key: 'income',
    label: 'Income',
    icon: DollarSign,
    gradient: 'from-yellow-400 to-yellow-500',
    bgColor: 'bg-gradient-to-br from-yellow-50 to-yellow-100',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-800',
    iconBg: 'bg-yellow-100',
  },
  {
    key: 'education',
    label: 'Education',
    icon: GraduationCap,
    gradient: 'from-pink-400 to-pink-500',
    bgColor: 'bg-gradient-to-br from-pink-50 to-pink-100',
    borderColor: 'border-pink-200',
    textColor: 'text-pink-800',
    iconBg: 'bg-pink-100',
  },
];

export function DemographicFilterPane({ 
  onDemographicChange, 
  isDataLoaded, 
  audienceStats,
  currentSelections,
  onRunFilters,
  hasPendingChanges = false,
  isFiltering = false,
  getPendingFilterCount
}: DemographicFilterPaneProps) {
  const [selections, setSelections] = useState<DemographicSelections>({
    gender: currentSelections?.gender || [],
    age: currentSelections?.age || [],
    ethnicity: currentSelections?.ethnicity || [],
    income: currentSelections?.income || [],
    education: currentSelections?.education || [],
  });

  // Get options from audience stats
  const demographicOptions = useMemo(() => {
    if (!audienceStats?.demographics) {
      return {
        gender: [],
        age: [],
        ethnicity: [],
        income: [],
        education: [],
      };
    }

    return {
      gender: Object.keys(audienceStats.demographics.gender || {}),
      age: Object.keys(audienceStats.demographics.age || {}),
      ethnicity: Object.keys(audienceStats.demographics.ethnicity || {}),
      income: Object.keys(audienceStats.demographics.income || {}),
      education: Object.keys(audienceStats.demographics.education || {}),
    };
  }, [audienceStats]);

  // Get counts for each option
  const getCounts = (category: keyof DemographicSelections) => {
    if (!audienceStats?.demographics?.[category]) {
      return {};
    }
    return audienceStats.demographics[category];
  };

  const handleToggleSelection = (category: keyof DemographicSelections, value: string) => {
    setSelections((prev) => {
      const currentValues = prev[category] || [];
      const isSelected = currentValues.includes(value);
      
      const newValues = isSelected
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];
      
      const newSelections = {
        ...prev,
        [category]: newValues,
      };
      
      // Notify parent of change
      onDemographicChange(newSelections);
      
      return newSelections;
    });
  };

  const handleClearCategory = (category: keyof DemographicSelections) => {
    setSelections((prev) => {
      const newSelections = {
        ...prev,
        [category]: [],
      };
      
      // Notify parent of change
      onDemographicChange(newSelections);
      
      return newSelections;
    });
  };

  const handleClearAll = () => {
    const emptySelections = {
      gender: [],
      age: [],
      ethnicity: [],
      income: [],
      education: [],
    };
    setSelections(emptySelections);
    onDemographicChange(emptySelections);
  };

  const totalSelections = Object.values(selections).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="w-full bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-gray-900">Demographic Filters</h2>
          </div>
          {totalSelections > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
        {totalSelections > 0 && (
          <p className="text-gray-600 text-xs mt-1">
            {totalSelections} filter{totalSelections !== 1 ? 's' : ''} selected
          </p>
        )}
      </div>

      {/* Run Filters Button */}
      {onRunFilters && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-3 border-b-2 border-blue-200">
          <button
            onClick={onRunFilters}
            disabled={!hasPendingChanges || isFiltering}
            className={`
              w-full px-6 py-3.5 rounded-xl font-bold text-base transition-all duration-200 transform shadow-lg
              ${hasPendingChanges && !isFiltering
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-xl hover:scale-[1.02] active:scale-95'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
              }
            `}
            style={{
              boxShadow: hasPendingChanges && !isFiltering 
                ? '0 8px 30px rgba(79, 70, 229, 0.4), 0 0 20px rgba(147, 51, 234, 0.3)'
                : undefined
            }}
          >
            {isFiltering ? (
              <div className="flex items-center justify-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Running...</span>
              </div>
            ) : hasPendingChanges ? (
              <div className="flex items-center justify-center space-x-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Run Filters</span>
                {getPendingFilterCount && getPendingFilterCount() > 0 && (
                  <span className="text-xs opacity-90 ml-1">({getPendingFilterCount()} changes)</span>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Applied</span>
              </div>
            )}
          </button>
        </div>
      )}

      {/* Filter Categories */}
      <div className="divide-y divide-gray-200">
        {DEMOGRAPHIC_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const options = demographicOptions[category.key as keyof typeof demographicOptions];
          const counts = getCounts(category.key as keyof DemographicSelections);
          const selectedCount = selections[category.key as keyof DemographicSelections].length;

          return (
            <div key={category.key} className="p-3">
              {/* Category Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-1.5">
                  <div className={`p-1.5 rounded-lg ${category.iconBg}`}>
                    <Icon className={`h-3.5 w-3.5 ${category.textColor}`} />
                  </div>
                  <h3 className={`text-sm font-semibold ${category.textColor}`}>
                    {category.label}
                  </h3>
                  {selectedCount > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${category.bgColor} ${category.textColor} font-medium`}>
                      {selectedCount}
                    </span>
                  )}
                </div>
                {selectedCount > 0 && (
                  <button
                    onClick={() => handleClearCategory(category.key as keyof DemographicSelections)}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Options */}
              <div className="space-y-1.5">
                {options.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No data available</p>
                ) : (
                  options.map((option) => {
                    const isSelected = selections[category.key as keyof DemographicSelections].includes(option);
                    const count = counts[option] || 0;

                    return (
                      <button
                        key={option}
                        onClick={() => handleToggleSelection(category.key as keyof DemographicSelections, option)}
                        disabled={!isDataLoaded}
                        className={`
                          w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all text-xs
                          ${isSelected
                            ? `${category.bgColor} ${category.borderColor} border-2 ${category.textColor}`
                            : 'bg-gray-50 border-2 border-transparent hover:border-gray-300 text-gray-700'
                          }
                          ${!isDataLoaded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <span className="font-medium truncate">{option}</span>
                        <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                          {count > 0 && (
                            <span className={`text-xs ${isSelected ? category.textColor : 'text-gray-500'}`}>
                              {count.toLocaleString()}
                            </span>
                          )}
                          {isSelected && (
                            <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${category.gradient} flex items-center justify-center`}>
                              <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {!isDataLoaded && (
        <div className="bg-gray-50 px-4 py-2 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">Loading demographic data...</p>
        </div>
      )}
    </div>
  );
}

