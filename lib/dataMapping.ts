import { CombinedPersonData } from '@/types/audience';

// Data mapping interface
interface DataMapping {
  [key: string]: {
    [value: string]: string;
  };
}

class DataMappingService {
  private mappings: DataMapping = {};
  private isLoaded = false;

  async loadMappings(): Promise<void> {
    if (this.isLoaded) return;

    try {
      // Check if we're in server-side context
      const isServer = typeof window === 'undefined';
      const url = isServer 
        ? `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/data/dim_datamap.csv`
        : '/data/dim_datamap.csv';
      
      const response = await fetch(url);
      const csvText = await response.text();
      
      const lines = csvText.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      // Initialize mappings for each key column
      const keyColumns = headers.filter(h => h.endsWith('Key'));
      keyColumns.forEach(keyCol => {
        const valueCol = keyCol.replace('Key', '');
        this.mappings[keyCol] = {};
      });

      // Parse each row
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        
        keyColumns.forEach((keyCol, index) => {
          const keyIndex = headers.indexOf(keyCol);
          const valueIndex = headers.indexOf(keyCol.replace('Key', ''));
          
          if (keyIndex < values.length && valueIndex < values.length) {
            const key = values[keyIndex];
            const value = values[valueIndex];
            
            if (key && value) {
              this.mappings[keyCol][key] = value;
            }
          }
        });
      }

      console.log('Data mappings loaded:', this.mappings);
      this.isLoaded = true;
    } catch (error) {
      console.error('Error loading data mappings:', error);
    }
  }

  // Get human-readable value for a key
  getMappedValue(fieldKey: string, rawValue: string): string {
    if (!this.mappings[fieldKey] || !this.mappings[fieldKey][rawValue]) {
      return rawValue; // Return original if no mapping found
    }
    return this.mappings[fieldKey][rawValue];
  }

  // Get all mapped options for a field
  getMappedOptions(fieldKey: string): Array<{ value: string; label: string }> {
    if (!this.mappings[fieldKey]) {
      return [];
    }

    return Object.entries(this.mappings[fieldKey]).map(([key, value]) => ({
      value: key,
      label: value
    }));
  }

  // Check if a field has mappings
  hasMappings(fieldKey: string): boolean {
    return !!this.mappings[fieldKey] && Object.keys(this.mappings[fieldKey]).length > 0;
  }

  // Transform person data to use mapped values
  transformPersonData(person: CombinedPersonData): CombinedPersonData {
    const transformed = { ...person };
    
    // Apply mappings to key fields
    Object.keys(this.mappings).forEach(keyField => {
      if (transformed[keyField]) {
        const mappedValue = this.getMappedValue(keyField, String(transformed[keyField]));
        // Store both original and mapped values
        transformed[`${keyField}_mapped`] = mappedValue;
      }
    });

    return transformed;
  }

  // Get mapping statistics
  getMappingStats(): { [key: string]: number } {
    const stats: { [key: string]: number } = {};
    Object.keys(this.mappings).forEach(key => {
      stats[key] = Object.keys(this.mappings[key]).length;
    });
    return stats;
  }
}

export const dataMappingService = new DataMappingService();

// Convenience functions for components
export const getMappedValue = (fieldKey: string, rawValue: string): string => {
  return dataMappingService.getMappedValue(fieldKey, rawValue);
};

export const getMappedOptions = (fieldKey: string): Array<{ value: string; label: string }> => {
  return dataMappingService.getMappedOptions(fieldKey);
};

export const hasMappings = (fieldKey: string): boolean => {
  return dataMappingService.hasMappings(fieldKey);
};
