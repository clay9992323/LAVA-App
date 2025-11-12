'use client';

import { MapPin, Globe, Edit2 } from 'lucide-react';
import { formatGeographicTitle } from '@/lib/geoTitle';

interface GeoBannerProps {
  geographicSelections?: {
    state: string[];
    county: string[];
    dma: string[];
    congressional: string[];
    stateSenateDistrict: string[];
    stateHouseDistrict: string[];
  } | null;
  isNational?: boolean;
  onClick?: () => void;
}

export function GeoBanner({ geographicSelections, isNational, onClick }: GeoBannerProps) {
  // Don't show banner if no selections
  if (!geographicSelections && !isNational) {
    return null;
  }

  // Check if any selections exist
  const hasSelections = geographicSelections && Object.values(geographicSelections).some(arr => arr.length > 0);

  if (!hasSelections && !isNational) {
    return null;
  }

  const geoTitle = formatGeographicTitle(geographicSelections);

  return (
    <div className="border-b-2 border-gray-200 bg-white shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div>
          <button
            onClick={onClick}
            className="group w-full flex items-center justify-between space-x-3 px-4 py-3 rounded-xl border-2 border-orange-300 bg-white hover:bg-gradient-to-r hover:from-pink-50 hover:to-orange-50 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-lg hover:shadow-xl"
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {isNational ? (
                <>
                  <div className="flex items-center justify-center p-2 rounded-lg bg-gradient-to-r from-blue-100 to-indigo-100 flex-shrink-0">
                    <Globe className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Viewing</div>
                    <div className="text-base font-bold text-gray-900">National Audience</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center p-2 rounded-lg bg-gradient-to-r from-pink-100 to-orange-100 flex-shrink-0">
                    <MapPin className="h-5 w-5 text-orange-600 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Viewing</div>
                    <div className="text-lg font-bold text-gray-900 truncate">{geoTitle}</div>
                  </div>
                </>
              )}
            </div>
            
            {/* Edit Button */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-pink-100 to-orange-100 rounded-lg group-hover:from-pink-200 group-hover:to-orange-200 transition-colors flex-shrink-0">
              <Edit2 className="h-4 w-4 text-orange-700" />
              <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">Edit</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
