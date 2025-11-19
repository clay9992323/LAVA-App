'use client';

import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';

interface GridDataItem {
  GridUniverseKey: number;
  GridUniverseSortOrder: number;
  GridUniverse: string;
  Count: number;
}

export function GridDataPanel() {
  const [gridData, setGridData] = useState<GridDataItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load and parse CSV data
    const loadGridData = async () => {
      try {
        const response = await fetch('/GridData.csv');
        if (!response.ok) {
          throw new Error('Failed to load grid data');
        }
        const csvText = await response.text();
        
        // Helper function to parse CSV line with quoted values
        const parseCSVLine = (line: string): string[] => {
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());
          return values;
        };
        
        // Parse CSV
        const lines = csvText.trim().split('\n');
        const headerValues = parseCSVLine(lines[0]);
        
        // Find column indices
        const keyIndex = headerValues.findIndex(h => h.includes('GridUniverseKey'));
        const sortIndex = headerValues.findIndex(h => h.includes('GridUniverseSortOrder'));
        const labelIndex = headerValues.findIndex(h => h.includes('GridUniverse') && !h.includes('Key') && !h.includes('Sort'));
        const countIndex = headerValues.findIndex(h => h.includes('Count'));
        
        const data: GridDataItem[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Parse CSV line with quoted values
          const values = parseCSVLine(line);
          
          if (values.length >= 4) {
            const key = parseInt(values[keyIndex] || '0', 10);
            const sortOrder = parseInt(values[sortIndex] || '0', 10);
            const label = values[labelIndex] || '';
            const count = parseInt(values[countIndex] || '0', 10);
            
            // Skip "Unknown" entries for the 5x3 grid (15 cells)
            if (label.toLowerCase() !== 'unknown') {
              data.push({
                GridUniverseKey: key,
                GridUniverseSortOrder: sortOrder,
                GridUniverse: label,
                Count: count
              });
            }
          }
        }
        
        // Sort by GridUniverseSortOrder
        data.sort((a, b) => a.GridUniverseSortOrder - b.GridUniverseSortOrder);
        
        // Take first 15 items for 5x3 grid
        setGridData(data.slice(0, 15));
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading grid data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load grid data');
        setIsLoading(false);
      }
    };
    
    loadGridData();
  }, []);

  const cardBorderStyle: CSSProperties = {
    border: '1.5px solid rgba(148, 163, 184, 0.8)',
    backgroundColor: '#ffffff',
    boxShadow: '0 12px 24px rgba(15, 23, 42, 0.06)'
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-6 lg:p-8">
        <div className="text-center py-12 text-gray-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading grid data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-3xl shadow-xl p-6 lg:p-8">
        <div className="text-center py-12 text-red-500">
          <p className="text-lg font-medium">Error loading grid data</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2 tracking-tight">
            Grid Breakdown
          </h2>
          <p className="text-gray-600 text-sm lg:text-base font-medium">
            Audience breakdown by turnout and political affiliation
          </p>
        </div>
      </div>

      {/* 5x3 Grid - Responsive: 2 cols on mobile, 3 on tablet, 5 on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {gridData.map((item, index) => (
          <div
            key={item.GridUniverseKey}
            className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300"
            style={cardBorderStyle}
          >
            <div className="text-sm font-bold text-gray-900 mb-3 min-h-[3rem] flex items-center leading-tight">
              {item.GridUniverse}
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(item.Count)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

