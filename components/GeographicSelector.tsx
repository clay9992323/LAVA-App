'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, Check, X, ChevronDown } from 'lucide-react';
import { getMappedOptions, hasMappings } from '@/lib/dataMapping';
import { formatCountyName, formatStateName } from '@/lib/geoTitle';

interface GeographicSelectorProps {
  onGeographicChange: (geographic: GeographicSelections) => void;
  isDataLoaded: boolean;
  audienceStats?: any;
  universeFilters?: any;
  currentSelections?: GeographicSelections;
  hasPendingChanges?: boolean;
  showOnlyState?: boolean;
  excludeState?: boolean;
  horizontal?: boolean;
  showConfirmButton?: boolean;
  onStateConfirm?: (state: string, sourceElement: HTMLElement) => void;
  onNationalConfirm?: () => void;
  isAnimating?: boolean;
  demographicSelections?: any;
}

interface GeographicSelections {
  state: string[];
  county: string[];
  dma: string[];
  congressional: string[];
  stateSenateDistrict: string[];
  stateHouseDistrict: string[];
}

const GEOGRAPHIC_CATEGORIES = [
  {
    key: 'state',
    label: 'State',
    field: 'State',
    icon: MapPin,
    gradient: 'from-yellow-400 to-yellow-500',
    bgColor: 'bg-gradient-to-br from-yellow-50 to-yellow-100',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-800',
    iconBg: 'bg-yellow-100',
    customColors: {
      primary: '#FFD91A',
      light: '#FFF8E1',
      border: '#FFE082',
      text: '#F57F17',
      icon: '#FFF59D'
    }
  },
  {
    key: 'county',
    label: 'County',
    field: 'County',
    icon: MapPin,
    gradient: 'from-orange-400 to-orange-500',
    bgColor: 'bg-gradient-to-br from-orange-50 to-orange-100',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-800',
    iconBg: 'bg-orange-100',
    customColors: {
      primary: '#FFB333',
      light: '#FFF3E0',
      border: '#FFCC80',
      text: '#E65100',
      icon: '#FFE0B2'
    }
  },
  {
    key: 'dma',
    label: 'DMA',
    field: 'DMA',
    icon: MapPin,
    gradient: 'from-orange-500 to-red-400',
    bgColor: 'bg-gradient-to-br from-orange-50 to-red-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-800',
    iconBg: 'bg-orange-100',
    customColors: {
      primary: '#FF8C4D',
      light: '#FFF3E0',
      border: '#FFAB91',
      text: '#D84315',
      icon: '#FFCCBC'
    }
  },
  {
    key: 'congressional',
    label: 'Congressional District',
    field: 'Congressional District',
    icon: MapPin,
    gradient: 'from-purple-400 to-purple-500',
    bgColor: 'bg-gradient-to-br from-purple-50 to-purple-100',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-800',
    iconBg: 'bg-purple-100',
    customColors: {
      primary: '#A78BFA',
      light: '#F3E8FF',
      border: '#D8B4FE',
      text: '#6D28D9',
      icon: '#E9D5FF'
    }
  },
  {
    key: 'stateSenateDistrict',
    label: 'State Senate District',
    field: 'State_Senate_District',
    icon: MapPin,
    gradient: 'from-red-400 to-red-500',
    bgColor: 'bg-gradient-to-br from-red-50 to-red-100',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    iconBg: 'bg-red-100',
    customColors: {
      primary: '#FF6666',
      light: '#FFEBEE',
      border: '#FFCDD2',
      text: '#C62828',
      icon: '#FFCDD2'
    }
  },
  {
    key: 'stateHouseDistrict',
    label: 'State House District',
    field: 'State_House_District',
    icon: MapPin,
    gradient: 'from-pink-400 to-pink-500',
    bgColor: 'bg-gradient-to-br from-pink-50 to-pink-100',
    borderColor: 'border-pink-200',
    textColor: 'text-pink-800',
    iconBg: 'bg-pink-100',
    customColors: {
      primary: '#FF4080',
      light: '#FCE4EC',
      border: '#F8BBD9',
      text: '#AD1457',
      icon: '#F8BBD9'
    }
  }
];

// Custom Dropdown Component
function CustomDropdown({ 
  options, 
  selectedValues, 
  onSelectionChange, 
  placeholder = "Select options...",
  disabled = false,
  onOpenChange
}: {
  options: Array<{ value: string; label: string }>;
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Notify parent when dropdown state changes
  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectionChange(selectedValues.filter(v => v !== value));
    } else {
      onSelectionChange([...selectedValues, value]);
    }
  };

  const clearSelection = () => {
    onSelectionChange([]);
  };

  return (
    <div className="relative" ref={dropdownRef} style={{ zIndex: isOpen ? 999999 : 'auto' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-left bg-white border-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${isOpen ? 'ring-2 ring-orange-500 border-orange-500' : 'border-gray-300 hover:border-gray-400'}`}
      >
        <div className="flex items-center justify-between min-h-[32px]">
          <div className="flex-1 min-w-0 pr-2">
            {selectedValues.length === 0 ? (
              <span className="text-gray-500 text-xs font-medium">{placeholder}</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedValues.slice(0, 1).map(value => {
                  const option = options.find(opt => opt.value === value);
                  return (
                    <span
                      key={value}
                      className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-md whitespace-nowrap"
                      style={{
                        background: 'linear-gradient(135deg, #FF4080, #FF8C4D)',
                        color: 'white'
                      }}
                    >
                      {option?.label}
                    </span>
                  );
                })}
                {selectedValues.length > 1 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-md whitespace-nowrap">
                    +{selectedValues.length - 1} more
                  </span>
                )}
              </div>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute w-full mt-2 bg-white border-2 border-gray-200 rounded-2xl shadow-2xl" style={{ maxHeight: '320px', zIndex: 999999 }}>
          <div className="p-4">
            {selectedValues.length > 0 && (
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <span className="text-sm text-gray-600 font-semibold">{selectedValues.length} selected</span>
                <button
                  onClick={clearSelection}
                  className="text-sm text-red-600 hover:text-red-700 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all font-medium"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Clear All</span>
                </button>
              </div>
            )}
            <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: '256px' }}>
              {options.map(option => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleOption(option.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center space-x-3 ${
                      isSelected 
                        ? 'bg-gradient-to-r from-pink-50 to-orange-50 text-orange-700 shadow-sm' 
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isSelected ? 'border-orange-600 scale-105' : 'border-gray-300'
                    }`}
                    style={isSelected ? { background: 'linear-gradient(135deg, #FF4080, #FF8C4D)' } : {}}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                    </div>
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function GeographicSelector({ onGeographicChange, isDataLoaded, audienceStats, universeFilters, currentSelections, hasPendingChanges, showOnlyState = false, excludeState = false, horizontal = false, showConfirmButton = false, onStateConfirm, onNationalConfirm, isAnimating = false, demographicSelections }: GeographicSelectorProps) {
  const [selections, setSelections] = useState<GeographicSelections>({
    state: [],
    county: [],
    dma: [],
    congressional: [],
    stateSenateDistrict: [],
    stateHouseDistrict: []
  });

  // Sync internal state with passed selections
  useEffect(() => {
    if (currentSelections) {
      console.log('🗺️ GeographicSelector: Syncing with currentSelections:', currentSelections);
      // Merge with default values to ensure all properties exist
      const newSelections = {
        state: currentSelections.state || [],
        county: currentSelections.county || [],
        dma: currentSelections.dma || [],
        congressional: currentSelections.congressional || [],
        stateSenateDistrict: currentSelections.stateSenateDistrict || [],
        stateHouseDistrict: currentSelections.stateHouseDistrict || []
      };
      setSelections(newSelections);
      // Update ref to prevent triggering fetch when syncing from props
      previousSelectionsRef.current = newSelections;
    }
  }, [currentSelections]);

  const [geographicOptions, setGeographicOptions] = useState<{
    states: { [key: string]: number };
    counties: { [key: string]: number };
    dmas: { [key: string]: number };
    congressionalDistricts: { [key: string]: number };
    stateSenateDistricts: { [key: string]: number };
    stateHouseDistricts: { [key: string]: number };
  }>({
    states: {},
    counties: {},
    dmas: {},
    congressionalDistricts: {},
    stateSenateDistricts: {},
    stateHouseDistricts: {}
  });

  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const previousSelectionsRef = useRef<GeographicSelections | null>(null);
  const hasMountedRef = useRef(false);
  const isMountingRef = useRef(true); // Track if this is the initial mount

  // Mark component as fully mounted after first render
  useEffect(() => {
    // Set mounted flag after a brief delay to allow all sync effects to complete
    const timer = setTimeout(() => {
      console.log('🗺️ GeographicSelector: Component fully mounted - enabling fetch on changes');
      hasMountedRef.current = true;
    }, 100);
    
    return () => clearTimeout(timer);
  }, []); // Empty deps - runs once on mount

  // Initialize geographic options from audienceStats on mount - ONE TIME ONLY
  useEffect(() => {
    if (isDataLoaded && audienceStats?.geography && Object.keys(geographicOptions.states).length === 0) {
      console.log('🗺️ GeographicSelector: Initializing options from cached audienceStats (ONE TIME ONLY)');
      setGeographicOptions({
        states: audienceStats.geography.state || {},
        counties: audienceStats.geography.county || {},
        dmas: audienceStats.geography.dma || {},
        congressionalDistricts: audienceStats.geography.congressional || {},
        stateSenateDistricts: audienceStats.geography.stateSenateDistrict || {},
        stateHouseDistricts: audienceStats.geography.stateHouseDistrict || {}
      });
    }
  }, [isDataLoaded, audienceStats, geographicOptions.states]);

  // Fetch geographic options when geographic selections change (not on initial mount)
  useEffect(() => {
    if (!isDataLoaded) return;
    
    // NEVER fetch on mount - only when user actively changes selections
    if (!hasMountedRef.current) {
      console.log('🗺️ GeographicSelector: Skipping fetch (component just mounted)');
      return;
    }
    
    // Skip if we don't have a previous reference yet
    if (!previousSelectionsRef.current) {
      console.log('🗺️ GeographicSelector: Skipping fetch (no previous selections to compare)');
      previousSelectionsRef.current = selections;
      return;
    }
    
    // Check if selections actually changed
    const selectionsChanged = 
      JSON.stringify(previousSelectionsRef.current.state) !== JSON.stringify(selections.state) ||
      JSON.stringify(previousSelectionsRef.current.county) !== JSON.stringify(selections.county) ||
      JSON.stringify(previousSelectionsRef.current.dma) !== JSON.stringify(selections.dma);
    
    if (!selectionsChanged) {
      console.log('🗺️ GeographicSelector: Skipping fetch (no selection change)');
      return;
    }
    
    console.log('🗺️ GeographicSelector: Selection changed - fetching updated options');
    previousSelectionsRef.current = selections;

    const fetchGeographicOptions = async () => {
      setIsLoadingOptions(true);
      try {
        const requestBody = {
          selectedStates: selections.state,
          selectedCounties: selections.county,
          universeFields: [], // Don't apply universe filters to options
          operator: 'AND',
          demographicFilters: demographicSelections || {} // Include demographic filters
        };
        
        console.log('\n🗺️ ========================================');
        console.log('🗺️ GeographicSelector: Fetching options');
        console.log('🗺️ ========================================');
        console.log('🗺️ Request body:', JSON.stringify(requestBody, null, 2));
        console.log('🗺️ Current selections:', selections);
        console.log('🗺️ Demographic selections:', demographicSelections);
        console.log('🗺️ Has demographic filters:', !!(demographicSelections && Object.values(demographicSelections).some((arr: any) => arr && arr.length > 0)));
        console.log('🗺️ ========================================\n');
        
        const response = await fetch('/api/geographic-options', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const result = await response.json();
          setGeographicOptions(result.geographicOptions);
          console.log('🗺️ Updated geographic options:', result.geographicOptions);
        } else {
          console.error('Failed to fetch geographic options');
        }
      } catch (error) {
        console.error('Error fetching geographic options:', error);
      } finally {
        setIsLoadingOptions(false);
      }
    };

    fetchGeographicOptions();
  }, [isDataLoaded, selections.state, selections.county, selections.dma]); // Removed demographicSelections to prevent fetch on mount

  // Memoize options to prevent excessive re-computation
  const optionsCache = useMemo(() => {
    if (!isDataLoaded) return {};
    
    const cache: { [key: string]: Array<{ value: string; label: string }> } = {};
    const sortDistrictKeys = (keys: string[]) => keys.sort((a, b) => {
      const na = parseInt((a || '').toString().replace(/\D/g, ''));
      const nb = parseInt((b || '').toString().replace(/\D/g, ''));
      if (isNaN(na) || isNaN(nb)) return (a || '').localeCompare(b || '');
      return na - nb;
    });
    
    // Use the filtered geographic options
    cache['State'] = Object.keys(geographicOptions.states).map(value => ({
      value,
      label: formatStateName(value)
    }));

    cache['County'] = Object.keys(geographicOptions.counties).map(value => ({
      value,
      label: formatCountyName(value)
    }));

    cache['DMA'] = Object.keys(geographicOptions.dmas).map(value => ({
      value,
      label: value
    }));

    cache['Congressional District'] = sortDistrictKeys(Object.keys(geographicOptions.congressionalDistricts)).map(value => ({
      value,
      label: value
    }));

    // Districts
    cache['State_Senate_District'] = sortDistrictKeys(Object.keys(geographicOptions.stateSenateDistricts)).map(value => ({
      value,
      label: value
    }));
    cache['State_House_District'] = sortDistrictKeys(Object.keys(geographicOptions.stateHouseDistricts)).map(value => ({
      value,
      label: value
    }));
    
    return cache;
  }, [isDataLoaded, geographicOptions]);

  const getOptions = (field: string) => {
    if (!isDataLoaded) return [];
    return optionsCache[field] || [];
  };

  const handleSelectionChange = (category: string, values: string[]) => {
    const newSelections = {
      ...selections,
      [category]: values
    };

    // Clear dependent selections when parent selection changes
    if (category === 'state') {
      // When state changes, clear county selections and districts
      newSelections.county = [];
      newSelections.congressional = [];
      newSelections.stateSenateDistrict = [];
      newSelections.stateHouseDistrict = [];
    } else if (category === 'dma') {
      // When DMA changes, clear county selections and districts
      newSelections.county = [];
      newSelections.congressional = [];
      newSelections.stateSenateDistrict = [];
      newSelections.stateHouseDistrict = [];
    } else if (category === 'county') {
      // When county changes, no need to clear anything as it's a refinement
    }

    setSelections(newSelections);
    onGeographicChange(newSelections);
  };

  const clearAll = () => {
    const emptySelections: GeographicSelections = {
      state: [],
      county: [],
      dma: [],
      congressional: [],
      stateSenateDistrict: [],
      stateHouseDistrict: []
    };
    setSelections(emptySelections);
    onGeographicChange(emptySelections);
  };

  const hasAnySelection = Object.values(selections).some(arr => arr.length > 0);

  return (
    <div className={`backdrop-blur-sm rounded-3xl shadow-xl border p-4 w-full transition-all duration-300 ${
      showConfirmButton 
        ? 'bg-white border-gray-200' 
        : 'bg-white/80 border-white/20'
    }`} style={{ overflow: 'visible' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            {showConfirmButton ? (
              <>
                <div className="flex items-center space-x-2.5">
                  <div 
                    className="p-2 rounded-lg shadow-md"
                    style={{
                      background: 'linear-gradient(135deg, #FF4080, #FF8C4D)'
                    }}
                  >
                    <MapPin className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent tracking-tight">
                      Select Your Geography
                    </h2>
                    <p className="text-gray-600 text-[11px] font-medium leading-tight">
                      Choose your primary geography and optionally refine your audience
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900">Geographic Filters</h2>
                {hasPendingChanges && (
                  <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                    Pending
                  </span>
                )}
              </>
            )}
          </div>
          {!showConfirmButton && (
            <p className="text-gray-600 text-xs">Filter by location and market areas</p>
          )}
        </div>
        
        {/* Show National Button (when in geography selection mode) or Clear button */}
        {showConfirmButton ? (
          <button
            onClick={() => {
              clearAll();
              onNationalConfirm && onNationalConfirm();
            }}
            disabled={isAnimating}
            className={`px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all duration-200 flex items-center space-x-2 flex-shrink-0 ml-3 border border-gray-300 hover:border-gray-400 hover:shadow-md ${
              isAnimating ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>National View</span>
          </button>
        ) : hasAnySelection ? (
          <button
            onClick={clearAll}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200 flex items-center space-x-1 flex-shrink-0 ml-3"
          >
            <X className="h-3 w-3" />
            <span>Clear</span>
          </button>
        ) : null}
      </div>

      {/* Conditional Layout: Professional centerpiece design when confirming, standard when filtering */}
      {showConfirmButton ? (
        <div className="space-y-4">
          {/* State & DMA - Centerpiece */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative" style={{ zIndex: 2 }}>
            {GEOGRAPHIC_CATEGORIES.filter(cat => cat.key === 'state' || cat.key === 'dma').map(({ key, label, field, icon: Icon, customColors }) => {
              const options = getOptions(field);
              const selectedValues = selections[key as keyof GeographicSelections];
              
              return (
                <div key={key} className="relative">
                  {/* Centerpiece Container */}
                  <div className="bg-gradient-to-br from-pink-50 via-orange-50 to-yellow-50 border-2 border-orange-200 rounded-2xl p-6 shadow-lg transition-all duration-300 hover:shadow-xl">
                    <div className="flex items-center space-x-4 mb-4">
                      <div 
                        className="p-3 rounded-xl shadow-md flex-shrink-0"
                        style={{
                          background: 'linear-gradient(135deg, #FF4080, #FF8C4D)'
                        }}
                      >
                        <Icon className="h-8 w-8 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-2xl font-bold text-gray-900 leading-tight">{label}</h3>
                        <p className="text-sm text-gray-600 font-medium leading-tight">Primary geographic selection</p>
                      </div>
                    </div>
                    <CustomDropdown
                      options={options}
                      selectedValues={selectedValues}
                      onSelectionChange={(values) => handleSelectionChange(key, values)}
                      placeholder={isLoadingOptions ? "Loading..." : `Choose ${label}...`}
                      disabled={!isDataLoaded || isLoadingOptions}
                      onOpenChange={(isOpen) => setOpenDropdown(isOpen ? key : null)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Refinement Filters - Grid Layout with Pop-out Animation */}
          <div 
            className={`relative transition-all duration-500 ease-out ${
              (selections.state.length > 0 || selections.dma.length > 0)
                ? 'opacity-100 max-h-[2000px] translate-y-0' 
                : 'opacity-0 max-h-0 -translate-y-4 overflow-hidden'
            }`}
            style={{ 
              overflow: (selections.state.length > 0 || selections.dma.length > 0) ? 'visible' : 'hidden',
              zIndex: 2
            }}
          >
            <div className="text-center mb-3">
              <div className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-gray-50 to-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                <svg className="h-3 w-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-[11px] font-semibold text-gray-700">Refine Your Selection (Optional)</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ isolation: 'auto' }}>
              {GEOGRAPHIC_CATEGORIES.filter(cat => cat.key !== 'state' && cat.key !== 'dma').map(({ key, label, field, icon: Icon, customColors }) => {
                const options = getOptions(field);
                const selectedValues = selections[key as keyof GeographicSelections] || [];
                const isDisabled = selections.state.length === 0 && selections.dma.length === 0;

                return (
                  <div 
                    key={key} 
                    className={`relative bg-white border-2 rounded-lg p-3 transition-shadow duration-300 ${
                      isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
                    }`}
                    style={{
                      borderColor: selectedValues.length > 0 ? customColors.primary : '#E5E7EB'
                    }}
                  >
                    <div className="flex items-center space-x-2.5 mb-2.5">
                      <div 
                        className={`p-1.5 rounded-lg flex-shrink-0 transition-transform duration-300 ${openDropdown ? '' : 'hover:scale-110'}`}
                        style={{ 
                          backgroundColor: `${customColors.primary}20`,
                          borderWidth: '2px',
                          borderColor: customColors.primary
                        }}
                      >
                        <Icon 
                          className="h-4 w-4"
                          style={{ color: customColors.primary }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-xs text-gray-900 leading-tight">
                          {label}
                        </h3>
                      </div>
                      {selectedValues.length > 0 && (
                        <div 
                          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: `${customColors.primary}20` }}
                        >
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: customColors.primary }}
                          ></div>
                          <span 
                            className="text-xs font-bold"
                            style={{ color: customColors.primary }}
                          >
                            {selectedValues.length}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <CustomDropdown
                      options={options}
                      selectedValues={selectedValues}
                      onSelectionChange={(values) => handleSelectionChange(key, values)}
                      placeholder={isDisabled ? "Select a state or DMA first" : `Choose ${label}...`}
                      disabled={!isDataLoaded || isDisabled || isLoadingOptions}
                      onOpenChange={(isOpen) => setOpenDropdown(isOpen ? key : null)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        // Standard vertical layout for sidebar display
        <div className={horizontal ? "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4" : "space-y-8"}>
          {GEOGRAPHIC_CATEGORIES.map(({ key, label, field, icon: Icon, gradient, bgColor, borderColor, textColor, iconBg, customColors }) => {
            // Filter based on showOnlyState or excludeState props
            if (showOnlyState && key !== 'state') return null;
            if (excludeState && key === 'state') return null;
            
            const options = getOptions(field);
            const selectedValues = selections[key as keyof GeographicSelections] || [];
            
            // Determine if this dropdown should be disabled
            // State and DMA are top-level geos and never disabled
            // Refinement options require either state OR dma to be selected
            const isDisabled = (key === 'county' && selections.state.length === 0 && selections.dma.length === 0) || 
                             (key === 'congressional' && selections.state.length === 0 && selections.dma.length === 0) ||
                             (key === 'stateSenateDistrict' && selections.state.length === 0 && selections.dma.length === 0) ||
                             (key === 'stateHouseDistrict' && selections.state.length === 0 && selections.dma.length === 0);

            return (
              <div 
                key={key} 
                className={`border-2 rounded-2xl ${horizontal ? 'p-3' : 'p-4'} transition-all duration-300 hover:shadow-lg ${isDisabled ? 'opacity-60' : ''}`}
                style={{
                  background: `linear-gradient(135deg, ${customColors.light}, ${customColors.light}dd)`,
                  borderColor: customColors.border
                }}
              >
                <div className={`flex items-center ${horizontal ? 'space-x-2 mb-2' : 'space-x-3 mb-3'}`}>
                  <div 
                    className={`${horizontal ? 'p-1.5' : 'p-2'} rounded-lg flex-shrink-0`}
                    style={{ backgroundColor: customColors.icon }}
                  >
                    <Icon 
                      className={`${horizontal ? 'h-4 w-4' : 'h-5 w-5'}`}
                      style={{ color: customColors.text }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 
                      className={`font-bold ${horizontal ? 'text-xs' : 'text-sm'}`}
                      style={{ color: customColors.text }}
                    >
                      {label}
                    </h3>
                    {isDisabled && !horizontal && (
                      <p className="text-xs text-gray-500 mt-1">Select a state or DMA first</p>
                    )}
                  </div>
                  {selectedValues.length > 0 && (
                    <div className="flex items-center space-x-1">
                      <div 
                        className={`${horizontal ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full`}
                        style={{ backgroundColor: customColors.primary }}
                      ></div>
                      <span className={`${horizontal ? 'text-[10px]' : 'text-xs'} text-gray-600 font-medium`}>
                        {selectedValues.length}
                      </span>
                    </div>
                  )}
                </div>
                
                <CustomDropdown
                  options={options}
                  selectedValues={selectedValues}
                  onSelectionChange={(values) => handleSelectionChange(key, values)}
                  placeholder={isLoadingOptions ? "Loading..." : `Choose ${label}...`}
                  disabled={!isDataLoaded || isDisabled || isLoadingOptions}
                  onOpenChange={(isOpen) => setOpenDropdown(isOpen ? key : null)}
                />
              </div>
            );
          })}
        </div>
      )}

      {!isDataLoaded && (
        <div className="text-center py-12 text-gray-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading geographic options...</p>
          <p className="text-sm">Preparing your selection interface</p>
        </div>
      )}

      {showConfirmButton && (selections.state.length > 0 || selections.dma.length > 0) && isDataLoaded && (
        <div className="mt-4 pt-4 border-t border-gray-200 relative" style={{ zIndex: 1 }}>
          <button
            onClick={(e) => {
              // Pass the first selected state if available, otherwise use a default value
              const primaryGeo = selections.state.length > 0 ? selections.state[0] : (selections.dma.length > 0 ? selections.dma[0] : '');
              onStateConfirm && onStateConfirm(primaryGeo, e.currentTarget);
            }}
            disabled={isAnimating}
            className={`group w-full text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2.5 ${
              isAnimating ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{
              background: 'linear-gradient(135deg, #FF4080, #FF8C4D, #FFD91A)'
            }}
          >
            <Check className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span className="text-base tracking-tight">{isAnimating ? 'Confirming...' : 'Confirm & Continue'}</span>
            <svg className="h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <p className="text-center text-[11px] text-gray-500 mt-2 font-medium leading-tight">
            Your selection will be saved and you can proceed to audience building
          </p>
        </div>
      )}
    </div>
  );
}
