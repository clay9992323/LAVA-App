import { NextResponse } from 'next/server';
import { gzipSync } from 'zlib';

// Utility function to compress large responses
export function compressResponse(data: any, threshold: number = 10000): NextResponse {
  const jsonString = JSON.stringify(data);
  
  // Only compress if response is larger than threshold
  if (jsonString.length > threshold) {
    const compressed = gzipSync(jsonString);
    
    return new NextResponse(compressed as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
        'Content-Length': compressed.length.toString(),
      },
    });
  }
  
  return NextResponse.json(data);
}

// Utility function to optimize response data
export function optimizeResponseData(data: any, options: {
  removeNulls?: boolean;
  removeEmptyObjects?: boolean;
  compressNumbers?: boolean;
} = {}): any {
  const { removeNulls = true, removeEmptyObjects = true, compressNumbers = false } = options;
  
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => optimizeResponseData(item, options));
  }
  
  const optimized: any = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (removeNulls && value === null) {
      continue;
    }
    
    if (removeEmptyObjects && typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
      continue;
    }
    
    if (compressNumbers && typeof value === 'number' && Number.isInteger(value) && value > 0) {
      // Convert large numbers to shorter format if possible
      optimized[key] = value;
    } else {
      optimized[key] = optimizeResponseData(value, options);
    }
  }
  
  return optimized;
}

