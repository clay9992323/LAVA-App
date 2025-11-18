'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Check, ChevronDown, ArrowLeft, Globe, Map, TrendingUp, X } from 'lucide-react';
import { formatCountyName, formatStateName } from '@/lib/geoTitle';

interface GeoWizardProps {
  onGeographicChange: (geographic: GeographicSelections) => void;
  isDataLoaded: boolean;
  audienceStats?: any;
  universeFilters?: any;
  currentSelections?: GeographicSelections;
  hasPendingChanges?: boolean;
  onStateConfirm?: (state: string, sourceElement: HTMLElement, geoSelections?: GeographicSelections) => void;
  onNationalConfirm?: () => void;
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

type WizardStep = 'welcome' | 'state-selection' | 'refinement-choice' | 'refinement-selection';
type RouteType = 'national' | 'statewide' | 'dma' | null;
type RefinementType = 'county' | 'congressional' | 'stateSenateDistrict' | 'stateHouseDistrict' | null;

// Custom Dropdown Component (reused from GeographicSelector)
function CustomDropdown({ 
  options, 
  selectedValues, 
  onSelectionChange, 
  placeholder = "Select options...",
  disabled = false,
  singleSelect = false,
}: {
  options: Array<{ value: string; label: string }>;
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  singleSelect?: boolean;
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
    if (singleSelect) {
      onSelectionChange([value]);
      setIsOpen(false);
    } else {
      if (selectedValues.includes(value)) {
        onSelectionChange(selectedValues.filter(v => v !== value));
      } else {
        onSelectionChange([...selectedValues, value]);
      }
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
        className={`w-full px-4 py-3 text-left bg-white border-2 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${isOpen ? 'ring-2 ring-orange-500 border-orange-500' : 'border-gray-300 hover:border-gray-400'}`}
      >
        <div className="flex items-center justify-between min-h-[32px]">
          <div className="flex-1 min-w-0 pr-2">
            {selectedValues.length === 0 ? (
              <span className="text-gray-500 text-sm font-medium">{placeholder}</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedValues.slice(0, 3).map(value => {
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
                {selectedValues.length > 3 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-md whitespace-nowrap">
                    +{selectedValues.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
          <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute w-full mt-2 bg-white border-2 border-gray-200 rounded-2xl shadow-2xl" style={{ maxHeight: '320px', zIndex: 999999 }}>
          <div className="p-4">
            {selectedValues.length > 0 && !singleSelect && (
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

export function GeoWizard({
  onGeographicChange,
  isDataLoaded,
  audienceStats,
  universeFilters,
  currentSelections,
  hasPendingChanges,
  onStateConfirm,
  onNationalConfirm,
  demographicSelections
}: GeoWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [selectedRoute, setSelectedRoute] = useState<RouteType>(null);
  const [selectedState, setSelectedState] = useState<string[]>([]);
  const [selectedRefinementType, setSelectedRefinementType] = useState<RefinementType>(null);
  const [refinementSelections, setRefinementSelections] = useState<string[]>([]);
  const [showDMAMessage, setShowDMAMessage] = useState(false);
  const [geographicOptions, setGeographicOptions] = useState<any>({
    counties: {},
    congressionalDistricts: {},
    stateSenateDistricts: {},
    stateHouseDistricts: {}
  });
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  // Initialize from currentSelections if available
  useEffect(() => {
    if (currentSelections && currentSelections.state.length > 0) {
      setSelectedState(currentSelections.state);
    }
  }, [currentSelections]);

  const fetchRefinementOptions = useCallback(async () => {
    setIsLoadingOptions(true);
    try {
      const response = await fetch('/api/geographic-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedStates: selectedState,
          selectedCounties: [],
          universeFields: [],
          operator: 'AND',
          demographicFilters: demographicSelections || {}
        })
      });

      if (response.ok) {
        const result = await response.json();
        setGeographicOptions(result.geographicOptions);
      }
    } catch (error) {
      console.error('Error fetching refinement options:', error);
    } finally {
      setIsLoadingOptions(false);
    }
  }, [selectedState, demographicSelections]);

  // Fetch refinement options when state is selected
  useEffect(() => {
    if (selectedState.length > 0 && currentStep === 'refinement-choice') {
      fetchRefinementOptions();
    }
  }, [selectedState, currentStep, fetchRefinementOptions]);

  const handleRouteSelection = (route: RouteType) => {
    if (route === 'national') {
      setSelectedRoute('national');
      onNationalConfirm && onNationalConfirm();
    } else if (route === 'statewide') {
      setSelectedRoute('statewide');
      setCurrentStep('state-selection');
    } else if (route === 'dma') {
      setShowDMAMessage(true);
    }
  };

  const handleStatewideView = (element: HTMLElement) => {
    if (selectedState.length > 0) {
      // Go directly to audience preview with state only (no refinement)
      const selections: GeographicSelections = {
        state: selectedState,
        county: [],
        dma: [],
        congressional: [],
        stateSenateDistrict: [],
        stateHouseDistrict: []
      };
      console.log('🗺️ GeoWizard: handleStatewideView - passing selections:', selections);
      onGeographicChange(selections);
      // Pass the selections directly to ensure they're used immediately
      onStateConfirm && onStateConfirm(selectedState[0], element, selections);
    }
  };

  const handleRefineGeography = () => {
    if (selectedState.length > 0) {
      setCurrentStep('refinement-choice');
    }
  };

  const handleRefinementChoice = (refinementType: RefinementType, element?: HTMLElement) => {
    setSelectedRefinementType(refinementType);
    setRefinementSelections([]);
    setCurrentStep('refinement-selection');
  };

  const handleRefinementConfirm = (element: HTMLElement) => {
    if (refinementSelections.length > 0 && selectedRefinementType) {
      const selections: GeographicSelections = {
        state: selectedState,
        county: selectedRefinementType === 'county' ? refinementSelections : [],
        dma: [],
        congressional: selectedRefinementType === 'congressional' ? refinementSelections : [],
        stateSenateDistrict: selectedRefinementType === 'stateSenateDistrict' ? refinementSelections : [],
        stateHouseDistrict: selectedRefinementType === 'stateHouseDistrict' ? refinementSelections : []
      };
      console.log('🗺️ GeoWizard: handleRefinementConfirm - passing selections:', selections);
      onGeographicChange(selections);
      // Pass the selections directly to ensure they're used immediately
      onStateConfirm && onStateConfirm(selectedState[0], element, selections);
    }
  };

  const handleBack = () => {
    if (currentStep === 'state-selection') {
      setCurrentStep('welcome');
      setSelectedRoute(null);
      setSelectedState([]);
    } else if (currentStep === 'refinement-choice') {
      setCurrentStep('state-selection');
    } else if (currentStep === 'refinement-selection') {
      setCurrentStep('refinement-choice');
      setRefinementSelections([]);
    }
  };

  const getStateOptions = () => {
    if (!audienceStats?.geography?.state) return [];
    return Object.keys(audienceStats.geography.state).map(value => ({
      value,
      label: formatStateName(value)
    }));
  };

  const getRefinementOptions = () => {
    if (!selectedRefinementType) return [];

    const sortDistrictKeys = (keys: string[]) => keys.sort((a, b) => {
      const na = parseInt((a || '').toString().replace(/\D/g, ''));
      const nb = parseInt((b || '').toString().replace(/\D/g, ''));
      if (isNaN(na) || isNaN(nb)) return (a || '').localeCompare(b || '');
      return na - nb;
    });

    if (selectedRefinementType === 'county') {
      return Object.keys(geographicOptions.counties || {}).map(value => ({
        value,
        label: formatCountyName(value)
      }));
    } else if (selectedRefinementType === 'congressional') {
      return sortDistrictKeys(Object.keys(geographicOptions.congressionalDistricts || {})).map(value => ({
        value,
        label: value
      }));
    } else if (selectedRefinementType === 'stateSenateDistrict') {
      return sortDistrictKeys(Object.keys(geographicOptions.stateSenateDistricts || {})).map(value => ({
        value,
        label: value
      }));
    } else if (selectedRefinementType === 'stateHouseDistrict') {
      return sortDistrictKeys(Object.keys(geographicOptions.stateHouseDistricts || {})).map(value => ({
        value,
        label: value
      }));
    }
    return [];
  };

  const getRefinementLabel = () => {
    if (selectedRefinementType === 'county') return 'County';
    if (selectedRefinementType === 'congressional') return 'Congressional District';
    if (selectedRefinementType === 'stateSenateDistrict') return 'State Senate District';
    if (selectedRefinementType === 'stateHouseDistrict') return 'State House District';
    return '';
  };

  // STEP 1: Welcome Page
  if (currentStep === 'welcome') {
    return (
      <>
        <div className="backdrop-blur-sm rounded-3xl shadow-xl border bg-white border-gray-200 p-8 w-full transition-all duration-300">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div 
                className="p-3 rounded-xl shadow-md"
                style={{ background: 'linear-gradient(135deg, #FF4080, #FF8C4D)' }}
              >
                <Globe className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent tracking-tight">
                Select Your Geography
              </h2>
            </div>
            <p className="text-gray-600 text-base font-medium">
              Choose how you&apos;d like to define your audience location
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* National Card */}
            <button
              onClick={() => handleRouteSelection('national')}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 p-8 hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div 
                  className="p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
                >
                  <Globe className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">National</h3>
                  <p className="text-sm text-gray-600">
                    View nationwide audience data across all states
                  </p>
                </div>
              </div>
            </button>

            {/* Statewide Card */}
            <button
              onClick={() => handleRouteSelection('statewide')}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-50 via-orange-50 to-yellow-50 border-2 border-orange-300 p-8 hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div 
                  className="p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300"
                  style={{ background: 'linear-gradient(135deg, #FF4080, #FF8C4D)' }}
                >
                  <Map className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Statewide</h3>
                  <p className="text-sm text-gray-600">
                    Select a state and optionally refine your audience
                  </p>
                </div>
              </div>
            </button>

            {/* DMA Card */}
            <button
              onClick={() => handleRouteSelection('dma')}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 p-8 hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
            >
              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-yellow-400 text-yellow-900 shadow-sm">
                  Coming Soon
                </span>
              </div>
              <div className="flex flex-col items-center text-center space-y-4">
                <div 
                  className="p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300"
                  style={{ background: 'linear-gradient(135deg, #6B7280, #9CA3AF)' }}
                >
                  <TrendingUp className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">DMA</h3>
                  <p className="text-sm text-gray-600">
                    Target by Designated Market Area
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* DMA Coming Soon Modal */}
        {showDMAMessage && (
          <div className="fixed inset-0 bg-gray-500/30 backdrop-blur-sm z-[9999] flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 max-w-md mx-4">
              <div className="text-center space-y-4">
                <div 
                  className="w-16 h-16 mx-auto rounded-xl shadow-lg flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #FF4080, #FF8C4D)' }}
                >
                  <TrendingUp className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">DMA Selection</h3>
                <p className="text-gray-600">
                  DMA (Designated Market Area) selection is coming soon! This feature will allow you to target audiences by media markets.
                </p>
                <button
                  onClick={() => setShowDMAMessage(false)}
                  className="w-full px-6 py-3 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                  style={{ background: 'linear-gradient(135deg, #FF4080, #FF8C4D)' }}
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // STEP 2: State Selection
  if (currentStep === 'state-selection') {
    return (
      <div className="backdrop-blur-sm rounded-3xl shadow-xl border bg-white border-gray-200 p-8 w-full transition-all duration-300">
        <button
          onClick={handleBack}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="font-medium">Back to Routes</span>
        </button>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div 
              className="p-3 rounded-xl shadow-md"
              style={{ background: 'linear-gradient(135deg, #FF4080, #FF8C4D)' }}
            >
              <Map className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent tracking-tight">
              Select Your State
            </h2>
          </div>
          <p className="text-gray-600 text-base font-medium">
            Choose the state you want to target for your audience
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-gradient-to-br from-pink-50 via-orange-50 to-yellow-50 border-2 border-orange-200 rounded-2xl p-6">
            <label className="block text-sm font-bold text-gray-900 mb-3">State</label>
            <CustomDropdown
              options={getStateOptions()}
              selectedValues={selectedState}
              onSelectionChange={setSelectedState}
              placeholder={isDataLoaded ? "Choose a state..." : "Loading states..."}
              disabled={!isDataLoaded}
              singleSelect={true}
            />
          </div>

          {selectedState.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={(e) => handleStatewideView(e.currentTarget)}
                className="group text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2.5"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
              >
                <Check className="h-5 w-5" />
                <span className="text-lg">See Statewide</span>
              </button>
              
              <button
                onClick={handleRefineGeography}
                className="group text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2.5"
                style={{ background: 'linear-gradient(135deg, #FF4080, #FF8C4D, #FFD91A)' }}
              >
                <MapPin className="h-5 w-5" />
                <span className="text-lg">Refine Geography</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // STEP 3: Refinement Choice
  if (currentStep === 'refinement-choice') {
    return (
      <div className="backdrop-blur-sm rounded-3xl shadow-xl border bg-white border-gray-200 p-8 w-full transition-all duration-300">
        <button
          onClick={handleBack}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="font-medium">Back to State Selection</span>
        </button>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div 
              className="p-3 rounded-xl shadow-md"
              style={{ background: 'linear-gradient(135deg, #FF4080, #FF8C4D)' }}
            >
              <MapPin className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent tracking-tight">
              Refine Your Selection
            </h2>
          </div>
          <p className="text-gray-600 text-base font-medium">
            Selected: <span className="font-bold text-gray-900">{selectedState[0]}</span>
          </p>
          <p className="text-gray-600 text-sm mt-1">
            Choose a refinement option or select &quot;None&quot; for statewide data
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {/* County */}
          <button
            onClick={(e) => handleRefinementChoice('county')}
            disabled={isLoadingOptions}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-300 p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
          >
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-3 rounded-lg bg-orange-200">
                <MapPin className="h-6 w-6 text-orange-700" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">County</h3>
            </div>
          </button>

          {/* Congressional District */}
          <button
            onClick={(e) => handleRefinementChoice('congressional')}
            disabled={isLoadingOptions}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
          >
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-3 rounded-lg bg-purple-200">
                <MapPin className="h-6 w-6 text-purple-700" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Congressional District</h3>
            </div>
          </button>

          {/* State Senate District */}
          <button
            onClick={(e) => handleRefinementChoice('stateSenateDistrict')}
            disabled={isLoadingOptions}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-300 p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
          >
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-3 rounded-lg bg-red-200">
                <MapPin className="h-6 w-6 text-red-700" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">State Senate District</h3>
            </div>
          </button>

          {/* State House District */}
          <button
            onClick={(e) => handleRefinementChoice('stateHouseDistrict')}
            disabled={isLoadingOptions}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-pink-50 to-pink-100 border-2 border-pink-300 p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
          >
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-3 rounded-lg bg-pink-200">
                <MapPin className="h-6 w-6 text-pink-700" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">State House District</h3>
            </div>
          </button>
        </div>

        {isLoadingOptions && (
          <div className="text-center mt-6">
            <div className="inline-flex items-center space-x-2 text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-orange-500"></div>
              <span className="text-sm font-medium">Loading refinement options...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // STEP 4: Refinement Selection
  if (currentStep === 'refinement-selection') {
    return (
      <div className="backdrop-blur-sm rounded-3xl shadow-xl border bg-white border-gray-200 p-8 w-full transition-all duration-300">
        <button
          onClick={handleBack}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="font-medium">Back to Refinement Options</span>
        </button>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div 
              className="p-3 rounded-xl shadow-md"
              style={{ background: 'linear-gradient(135deg, #FF4080, #FF8C4D)' }}
            >
              <MapPin className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent tracking-tight">
              Select {getRefinementLabel()}
            </h2>
          </div>
          <p className="text-gray-600 text-base font-medium">
            State: <span className="font-bold text-gray-900">{selectedState[0]}</span>
          </p>
          <p className="text-gray-600 text-sm mt-1">
            Choose one or more {getRefinementLabel().toLowerCase()}s to target
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-gradient-to-br from-pink-50 via-orange-50 to-yellow-50 border-2 border-orange-200 rounded-2xl p-6">
            <label className="block text-sm font-bold text-gray-900 mb-3">{getRefinementLabel()}</label>
            <CustomDropdown
              options={getRefinementOptions()}
              selectedValues={refinementSelections}
              onSelectionChange={setRefinementSelections}
              placeholder={`Choose ${getRefinementLabel().toLowerCase()}...`}
              disabled={isLoadingOptions}
              singleSelect={false}
            />
          </div>

          {refinementSelections.length > 0 && (
            <button
              onClick={(e) => handleRefinementConfirm(e.currentTarget)}
              className="w-full text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2.5"
              style={{ background: 'linear-gradient(135deg, #FF4080, #FF8C4D, #FFD91A)' }}
            >
              <Check className="h-5 w-5" />
              <span className="text-lg">Confirm & Continue</span>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}

