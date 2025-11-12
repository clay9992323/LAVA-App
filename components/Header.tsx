'use client';

import { Download } from 'lucide-react';
import Image from 'next/image';

interface HeaderProps {
  totalCount: number;
  filteredCount: number;
  onExportPDF: () => void;
  showStats?: boolean;
}

export function Header({ totalCount, filteredCount, onExportPDF, showStats = true }: HeaderProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <header 
      className="shadow-lg border-b border-orange-200/30 backdrop-blur-sm"
      style={{
        background: 'linear-gradient(135deg, #FF4080 0%, #FF8C4D 50%, #FFD91A 100%)'
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 lg:space-x-8">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg p-2 bg-white/95 backdrop-blur-sm">
                  <Image
                    src="/causeway-solutions-logo-rgb_icon.png"
                    alt="Causeway Solutions Logo"
                    width={40}
                    height={40}
                    className="object-contain"
                  />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white shadow-sm"></div>
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                  Audience Builder
                </h1>
                <p className="text-white/95 text-sm font-medium mt-0.5">
                  Causeway Solutions Data Platform
                </p>
              </div>
            </div>
            
            <div className="hidden lg:flex items-center space-x-2 px-4 py-2 bg-white/15 backdrop-blur-md rounded-xl border border-white/25">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-sm"></div>
              <span className="text-white font-semibold text-sm">Live Data</span>
            </div>
          </div>
          
          {showStats && (
            <div className="flex items-center space-x-4 lg:space-x-6">
              <div className="text-right hidden sm:block">
                <div className="text-white font-bold text-xl lg:text-2xl tracking-tight">
                  {formatNumber(filteredCount)} / {formatNumber(totalCount)}
                </div>
                <div className="text-white/95 text-sm font-semibold">
                  {totalCount > 0 ? `${((filteredCount / totalCount) * 100).toFixed(1)}%` : '0%'} of base
                </div>
              </div>
              
              <button
                onClick={onExportPDF}
                disabled={filteredCount === 0}
                className="group relative bg-white hover:bg-gray-50 text-gray-900 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 border border-white/20"
              >
                <Download className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                <span className="hidden sm:inline">Export PDF</span>
                <span className="sm:hidden">Export</span>
              </button>
            </div>
          )}
        </div>
        
        {/* Mobile stats */}
        {showStats && (
          <div className="sm:hidden mt-4 pt-4 border-t border-white/25">
            <div className="flex items-center justify-between">
              <div className="text-white font-bold text-lg tracking-tight">
                {formatNumber(filteredCount)} / {formatNumber(totalCount)}
              </div>
              <div className="text-white/95 text-sm font-semibold">
                {totalCount > 0 ? `${((filteredCount / totalCount) * 100).toFixed(1)}%` : '0%'}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
