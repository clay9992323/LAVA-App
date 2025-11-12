'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Monitor, Check, X, ChevronDown } from 'lucide-react';
import { dataProcessor } from '@/lib/dataProcessor';
import { getMappedOptions, hasMappings } from '@/lib/dataMapping';

interface MediaConsumptionSelectorProps {
  onMediaConsumptionChange: (mediaConsumption: MediaConsumptionSelections) => void;
  isDataLoaded: boolean;
  audienceStats?: any;
}

interface MediaConsumptionSelections {
  socialmediaheavyuser: string[];
  socialmediauserfacebook: string[];
  socialmediauserinstagram: string[];
  socialmediauserx: string[];
  socialmediauseryoutube: string[];
}

const MEDIA_CONSUMPTION_CATEGORIES = [
  {
    key: 'socialmediaheavyuser',
    label: 'Social Media Heavy User',
    field: 'socialmediaheavyuser',
    icon: Monitor,
    gradient: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    iconBg: 'bg-blue-100'
  },
  {
    key: 'socialmediauserfacebook',
    label: 'Facebook User',
    field: 'socialmediauserfacebook',
    icon: Monitor,
    gradient: 'from-indigo-500 to-blue-500',
    bgColor: 'bg-gradient-to-br from-indigo-50 to-blue-50',
    borderColor: 'border-indigo-200',
    textColor: 'text-indigo-700',
    iconBg: 'bg-indigo-100'
  },
  {
    key: 'socialmediauserinstagram',
    label: 'Instagram User',
    field: 'socialmediauserinstagram',
    icon: Monitor,
    gradient: 'from-pink-500 to-purple-500',
    bgColor: 'bg-gradient-to-br from-pink-50 to-purple-50',
    borderColor: 'border-pink-200',
    textColor: 'text-pink-700',
    iconBg: 'bg-pink-100'
  },
  {
    key: 'socialmediauserx',
    label: 'X User',
    field: 'socialmediauserx',
    icon: Monitor,
    gradient: 'from-gray-500 to-slate-500',
    bgColor: 'bg-gradient-to-br from-gray-50 to-slate-50',
    borderColor: 'border-gray-200',
    textColor: 'text-gray-700',
    iconBg: 'bg-gray-100'
  },
  {
    key: 'socialmediauseryoutube',
    label: 'YouTube User',
    field: 'socialmediauseryoutube',
    icon: Monitor,
    gradient: 'from-red-500 to-orange-500',
    bgColor: 'bg-gradient-to-br from-red-50 to-orange-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    iconBg: 'bg-red-100'
  }
];

// Custom Dropdown Component
function CustomDropdown({ 
  options, 
  selectedValues, 
  onSelectionChange, 
  placeholder = "Select options...",
  disabled = false 
}: {
  options: Array<{ value: string; label: string }>;
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-400'}`}
      >
        <div className="flex items-center justify-between min-h-[36px]">
          <div className="flex-1 min-w-0 pr-2">
            {selectedValues.length === 0 ? (
              <span className="text-gray-500 text-sm">{placeholder}</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {selectedValues.slice(0, 1).map(value => {
                  const option = options.find(opt => opt.value === value);
                  return (
                    <span
                      key={value}
                      className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full whitespace-nowrap"
                    >
                      {option?.label}
                    </span>
                  );
                })}
                {selectedValues.length > 1 && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full whitespace-nowrap">
                    +{selectedValues.length - 1}
                  </span>
                )}
              </div>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto">
          <div className="p-3">
            {selectedValues.length > 0 && (
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                <span className="text-xs text-gray-500 font-medium">{selectedValues.length} selected</span>
                <button
                  onClick={clearSelection}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center space-x-1 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  <X className="h-3 w-3" />
                  <span>Clear</span>
                </button>
              </div>
            )}
            <div className="space-y-1">
              {options.map(option => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleOption(option.value)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 flex items-center space-x-3 ${
                      isSelected 
                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' 
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="h-3 w-3 text-white" />}
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

export function MediaConsumptionSelector({ onMediaConsumptionChange, isDataLoaded, audienceStats }: MediaConsumptionSelectorProps) {
  const [selections, setSelections] = useState<MediaConsumptionSelections>({
    socialmediaheavyuser: [],
    socialmediauserfacebook: [],
    socialmediauserinstagram: [],
    socialmediauserx: [],
    socialmediauseryoutube: []
  });

  const [mediaConsumptionOptions, setMediaConsumptionOptions] = useState<{
    socialmediaheavyuser: { [key: string]: number };
    socialmediauserfacebook: { [key: string]: number };
    socialmediauserinstagram: { [key: string]: number };
    socialmediauserx: { [key: string]: number };
    socialmediauseryoutube: { [key: string]: number };
  }>({
    socialmediaheavyuser: {},
    socialmediauserfacebook: {},
    socialmediauserinstagram: {},
    socialmediauserx: {},
    socialmediauseryoutube: {}
  });

  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  // Fetch media consumption options when data is loaded
  useEffect(() => {
    if (!isDataLoaded) return;

    const fetchMediaConsumptionOptions = async () => {
      setIsLoadingOptions(true);
      try {
        // For media consumption, we'll use the universe data from audienceStats
        if (audienceStats && audienceStats.universe) {
          const options = {
            socialmediaheavyuser: { 'Yes': audienceStats.universe.socialmediaheavyuser || 0 },
            socialmediauserfacebook: { 'Yes': audienceStats.universe.socialmediauserfacebook || 0 },
            socialmediauserinstagram: { 'Yes': audienceStats.universe.socialmediauserinstagram || 0 },
            socialmediauserx: { 'Yes': audienceStats.universe.socialmediauserx || 0 },
            socialmediauseryoutube: { 'Yes': audienceStats.universe.socialmediauseryoutube || 0 }
          };
          setMediaConsumptionOptions(options);
          console.log('📱 Updated media consumption options:', options);
        }
      } catch (error) {
        console.error('Error fetching media consumption options:', error);
      } finally {
        setIsLoadingOptions(false);
      }
    };

    fetchMediaConsumptionOptions();
  }, [isDataLoaded, audienceStats]);

  // Memoize options to prevent excessive re-computation
  const optionsCache = useMemo(() => {
    if (!isDataLoaded) return {};
    
    const cache: { [key: string]: Array<{ value: string; label: string }> } = {};
    
    // Use the media consumption options
    Object.keys(mediaConsumptionOptions).forEach(field => {
      cache[field] = Object.keys(mediaConsumptionOptions[field as keyof typeof mediaConsumptionOptions]).map(value => ({
        value,
        label: value
      }));
    });
    
    return cache;
  }, [isDataLoaded, mediaConsumptionOptions]);

  const getOptions = (field: string) => {
    if (!isDataLoaded) return [];
    return optionsCache[field] || [];
  };

  const handleSelectionChange = (category: string, values: string[]) => {
    const newSelections = {
      ...selections,
      [category]: values
    };

    setSelections(newSelections);
    onMediaConsumptionChange(newSelections);
  };

  const clearAll = () => {
    const emptySelections: MediaConsumptionSelections = {
      socialmediaheavyuser: [],
      socialmediauserfacebook: [],
      socialmediauserinstagram: [],
      socialmediauserx: [],
      socialmediauseryoutube: []
    };
    setSelections(emptySelections);
    onMediaConsumptionChange(emptySelections);
  };

  const hasAnySelection = Object.values(selections).some(arr => arr.length > 0);

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-5 w-full overflow-visible">
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Media Consumption Filters</h2>
          <p className="text-gray-600 text-xs">Filter by social media usage and consumption patterns</p>
        </div>
        {hasAnySelection && (
          <button
            onClick={clearAll}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200 flex items-center space-x-1 flex-shrink-0 ml-3"
          >
            <X className="h-3 w-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="space-y-6">
        {MEDIA_CONSUMPTION_CATEGORIES.map(({ key, label, field, icon: Icon, gradient, bgColor, borderColor, textColor, iconBg }) => {
          const options = getOptions(field);
          const selectedValues = selections[key as keyof MediaConsumptionSelections];
          
          return (
            <div key={key} className={`${bgColor} ${borderColor} border-2 rounded-2xl p-4 transition-all duration-300 hover:shadow-lg`}>
              <div className="flex items-center space-x-3 mb-3">
                <div className={`${iconBg} p-2 rounded-lg flex-shrink-0`}>
                  <Icon className={`h-5 w-5 ${textColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold text-sm ${textColor}`}>{label}</h3>
                </div>
                {selectedValues.length > 0 && (
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${gradient}`}></div>
                    <span className="text-xs text-gray-600 font-medium">
                      {selectedValues.length}
                    </span>
                  </div>
                )}
              </div>
              
              <CustomDropdown
                options={options}
                selectedValues={selectedValues}
                onSelectionChange={(values) => handleSelectionChange(key, values)}
                placeholder={isLoadingOptions ? "Loading..." : `Choose ${label.toLowerCase()}...`}
                disabled={!isDataLoaded || isLoadingOptions}
              />
            </div>
          );
        })}
      </div>

      {!isDataLoaded && (
        <div className="text-center py-12 text-gray-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading media consumption options...</p>
          <p className="text-sm">Preparing your selection interface</p>
        </div>
      )}
    </div>
  );
}






