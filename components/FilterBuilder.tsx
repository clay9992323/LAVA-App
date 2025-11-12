'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Filter, ChevronDown, Check, Search } from 'lucide-react';
import { FilterGroup, FilterCondition, AVAILABLE_FILTER_FIELDS, AudienceStats } from '@/types/audience';

interface FilterBuilderProps {
  onFiltersChange: (filters: FilterGroup | null) => void;
  isDataLoaded: boolean;
  audienceStats?: AudienceStats | null;
  hasPendingChanges?: boolean;
  showGeographyLink?: boolean;
  onGeographyClick?: () => void;
}

export function FilterBuilder({ onFiltersChange, isDataLoaded, audienceStats, hasPendingChanges, showGeographyLink = false, onGeographyClick }: FilterBuilderProps) {
  const [selectedUniverses, setSelectedUniverses] = useState<string[]>([]);
  const [logicOperator, setLogicOperator] = useState<'AND' | 'OR'>('OR');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDataLoaded) {
      if (selectedUniverses.length > 0) {
        // Create a simple filter group with OR logic for selected universes
        const conditions: FilterCondition[] = selectedUniverses.map(universe => ({
          id: `universe_${universe}`,
          field: universe,
          operator: 'equals',
          value: '1', // Auto means "yes"
          label: `${AVAILABLE_FILTER_FIELDS.find(f => f.key === universe)?.label || universe} = Yes`
        }));

        const filterGroup: FilterGroup = {
          id: 'root',
          operator: logicOperator, // Use selected logic operator
          conditions,
          groups: [],
        };

        onFiltersChange(filterGroup);
      } else {
        onFiltersChange(null);
      }
    }
  }, [selectedUniverses, logicOperator, isDataLoaded, onFiltersChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setSearchTerm('');
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const toggleUniverse = (universe: string) => {
    setSelectedUniverses(prev => 
      prev.includes(universe) 
        ? prev.filter(u => u !== universe)
        : [...prev, universe]
    );
  };

  const clearAllFilters = () => {
    setSelectedUniverses([]);
  };

  const removeUniverse = (universe: string) => {
    setSelectedUniverses(prev => prev.filter(u => u !== universe));
  };

  // Get count for a universe field
  const getUniverseCount = (fieldKey: string): number => {
    if (!audienceStats?.universe) return 0;
    return audienceStats.universe[fieldKey] || 0;
  };

  // Get universe fields (boolean fields that represent audiences) and sort alphabetically
  const universeFields = AVAILABLE_FILTER_FIELDS
    .filter(field => field.type === 'boolean')
    .sort((a, b) => a.label.localeCompare(b.label));
  
  // Filter universes based on search term
  const filteredUniverses = universeFields.filter(field => 
    field.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isDataLoaded) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-visible">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Universe Filters</h3>
                {hasPendingChanges && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                    Pending
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 font-medium mt-0.5">Select target audiences</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="text-center py-6 text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600 mx-auto mb-2"></div>
            <p className="text-xs font-medium">Loading data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-visible">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Universe Filters</h3>
                <p className="text-xs text-gray-600 font-medium mt-0.5">Select target audiences</p>
              </div>
              {showGeographyLink && (
                <button
                  onClick={onGeographyClick}
                  className="px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-all duration-200 flex items-center space-x-1.5 border border-orange-200 hover:border-orange-300 hover:shadow-md"
                  style={{
                    background: 'linear-gradient(135deg, #FF4080, #FF8C4D)'
                  }}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Add Geography</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {selectedUniverses.length > 1 && (
              <div className="flex items-center space-x-1.5">
                <span className="text-xs text-gray-700 font-semibold">Logic:</span>
                <select
                  value={logicOperator}
                  onChange={(e) => setLogicOperator(e.target.value as 'AND' | 'OR')}
                  className="px-2 py-1 text-xs font-semibold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white transition-all"
                >
                  <option value="OR">OR</option>
                  <option value="AND">AND</option>
                </select>
              </div>
            )}
            {selectedUniverses.length > 0 && (
              <button
                onClick={clearAllFilters}
                className="px-3 py-1 text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all border border-gray-300 hover:border-gray-400"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {selectedUniverses.length === 0 ? (
          <div className="text-center py-2 mb-3">
            <div className="flex items-center justify-center space-x-1.5 text-gray-500">
              <Filter className="h-3.5 w-3.5" />
              <span className="text-xs">No audiences selected</span>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <h4 className="text-xs font-bold text-gray-700 mb-2">Selected Audiences ({selectedUniverses.length})</h4>
            <div className="flex flex-wrap gap-2">
              {selectedUniverses.map(universe => (
                <div 
                  key={universe} 
                  className="flex items-center space-x-1.5 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm border border-orange-200"
                  style={{
                    background: 'linear-gradient(135deg, #FF4080, #FF8C4D)'
                  }}
                >
                   <span>{AVAILABLE_FILTER_FIELDS.find(f => f.key === universe)?.label || universe}</span>
                   <button
                     onClick={() => removeUniverse(universe)}
                     className="text-white hover:text-gray-100 transition-colors"
                   >
                     <X className="h-3.5 w-3.5" />
                   </button>
                </div>
              ))}
            </div>
          </div>
        )}

         {/* Universe Selection Dropdown */}
         <div className="relative" ref={dropdownRef}>
           <button
             onClick={() => setIsDropdownOpen(!isDropdownOpen)}
             className="w-full px-3 py-2 text-left bg-white border-2 border-gray-300 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
           >
             <div className="flex items-center justify-between">
               <span className={`text-sm font-medium ${selectedUniverses.length > 0 ? 'text-gray-900' : 'text-gray-500'}`}>
                 {selectedUniverses.length > 0 
                   ? `${selectedUniverses.length} audience${selectedUniverses.length !== 1 ? 's' : ''} selected`
                   : 'Select audiences...'
                 }
               </span>
               <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
             </div>
           </button>

           {isDropdownOpen && (
             <div className="absolute z-[9999] w-full mt-1.5 bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-72 overflow-hidden">
               {/* Search Input */}
               <div className="p-3 border-b border-gray-200">
                 <div className="relative">
                   <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                   <input
                     type="text"
                     placeholder="Search audiences..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full pl-8 pr-2.5 py-2 text-xs font-medium border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                   />
                 </div>
               </div>

               {/* Options List */}
               <div className="max-h-56 overflow-y-auto p-1.5">
                 {filteredUniverses.length > 0 ? (
                   filteredUniverses.map(field => {
                     const count = getUniverseCount(field.key);
                     const isSelected = selectedUniverses.includes(field.key);
                     return (
                       <button
                         key={field.key}
                         onClick={() => toggleUniverse(field.key)}
                         className={`w-full px-3 py-2 text-left text-xs font-medium rounded-lg transition-all duration-200 flex items-center justify-between mb-0.5 ${
                           isSelected 
                             ? 'bg-gradient-to-r from-pink-50 to-orange-50 text-orange-700 shadow-sm' 
                             : 'hover:bg-gray-50 text-gray-700'
                         }`}
                       >
                       <span>{field.label}</span>
                         {isSelected && (
                           <Check className="h-3.5 w-3.5 text-orange-600" />
                         )}
                       </button>
                     );
                   })
                 ) : (
                   <div className="px-3 py-2 text-xs text-gray-500 text-center">
                     {searchTerm ? 'No audiences found' : 'No audiences available'}
                   </div>
                 )}
               </div>
             </div>
           )}
         </div>
      </div>
    </div>
  );
}