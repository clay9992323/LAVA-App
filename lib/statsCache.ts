/**
 * Simple file-based cache for initial audience statistics
 * Saves ~3 seconds on every page load by caching unchanging data
 */

import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'cache', 'initial-stats.json');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface CachedStats {
  data: any;
  timestamp: number;
  version: string;
}

/**
 * Get cached stats if available and not expired
 */
export function getCachedStats(): any | null {
  try {
    // Check if cache file exists
    if (!fs.existsSync(CACHE_FILE)) {
      console.log('📦 No cache file found - will query database');
      return null;
    }

    // Read cache file
    const fileContent = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cached: CachedStats = JSON.parse(fileContent);

    // Check if cache is expired
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_DURATION) {
      console.log(`📦 Cache expired (${Math.round(age / 1000 / 60 / 60)}h old) - will refresh`);
      return null;
    }

    console.log(`📦 ✅ Cache hit! Using cached stats (${Math.round(age / 1000 / 60)}min old)`);
    console.log(`📦 Cache contains ${cached.data.totalCount?.toLocaleString()} records`);
    
    return cached.data;
  } catch (error) {
    console.error('📦 Error reading cache:', error);
    return null;
  }
}

/**
 * Save stats to cache file
 */
export function setCachedStats(data: any): void {
  try {
    // Ensure cache directory exists
    const cacheDir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Create cache object
    const cached: CachedStats = {
      data,
      timestamp: Date.now(),
      version: '1.0'
    };

    // Write to file
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cached, null, 2), 'utf-8');
    
    console.log(`📦 ✅ Cached stats saved (${data.totalCount?.toLocaleString()} records)`);
    console.log(`📦 Cache will expire in ${CACHE_DURATION / 1000 / 60 / 60}h`);
  } catch (error) {
    console.error('📦 Error writing cache:', error);
  }
}

/**
 * Clear the cache (force refresh on next load)
 */
export function clearCache(): void {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
      console.log('📦 ✅ Cache cleared - next load will refresh from database');
    } else {
      console.log('📦 No cache file to clear');
    }
  } catch (error) {
    console.error('📦 Error clearing cache:', error);
  }
}

/**
 * Get cache info (age, size, etc.)
 */
export function getCacheInfo(): { exists: boolean; age?: number; size?: number; records?: number } | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return { exists: false };
    }

    const stats = fs.statSync(CACHE_FILE);
    const fileContent = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cached: CachedStats = JSON.parse(fileContent);
    
    return {
      exists: true,
      age: Date.now() - cached.timestamp,
      size: stats.size,
      records: cached.data.totalCount
    };
  } catch (error) {
    console.error('📦 Error getting cache info:', error);
    return null;
  }
}


