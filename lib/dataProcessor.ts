import Papa from 'papaparse';
import { CombinedPersonData, AudienceStats, DemographicsBreakdown, GeographicBreakdown, AVAILABLE_FILTER_FIELDS } from '@/types/audience';
import { dataMappingService } from './dataMapping';

export class DataProcessor {
  private personData: CombinedPersonData[] = [];
  private isLoaded = false;

  async loadData(limit?: number): Promise<void> {
    if (this.isLoaded) return;

    try {
      console.log(`Starting data load with limit: ${limit || 'unlimited'} records from Azure Blob Storage...`);
      
      // Load data mappings first
      console.log('Loading data mappings...');
      await dataMappingService.loadMappings();
      
      // Build query string - only include limit if it's specified
      const queryParams = new URLSearchParams();
      if (limit && limit > 0) {
        queryParams.append('limit', limit.toString());
      }
      
      const queryString = queryParams.toString();
      const url = `/api/data${queryString ? `?${queryString}` : ''}`;
      
      // Load data from Azure Blob Storage
      console.log('Loading data from Azure Blob Storage...');
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.status}`);
      }
      const result = await response.json();
      console.log(`Data loaded: ${result.data.length} records`);

      // Process the data directly
      console.log('Processing data...');
      this.personData = result.data.map((row: any, index: number) => {
        if (index % 10000 === 0) {
          console.log(`Processed ${index} records...`);
        }
        return row as CombinedPersonData;
      });

      console.log(`Total data loaded: ${this.personData.length} records`);
      this.isLoaded = true;
    } catch (error) {
      console.error('Error loading data:', error);
      throw error;
    }
  }

  getPersonData(): CombinedPersonData[] {
    return this.personData;
  }

  // Get mapped value for display
  getMappedValue(fieldKey: string, rawValue: string): string {
    return dataMappingService.getMappedValue(fieldKey, rawValue);
  }

  // Get mapped options for a field
  getMappedOptions(fieldKey: string): Array<{ value: string; label: string }> {
    return dataMappingService.getMappedOptions(fieldKey);
  }

  // Check if field has mappings
  hasMappings(fieldKey: string): boolean {
    return dataMappingService.hasMappings(fieldKey);
  }

  calculateAudienceStats(filteredData: CombinedPersonData[]): AudienceStats {
    const totalCount = filteredData.length;

    // Demographics breakdown
    const demographics: DemographicsBreakdown = {
      age: this.groupByField(filteredData, 'AgeRange'),
      gender: this.groupByField(filteredData, 'Gender'),
      ethnicity: this.groupByField(filteredData, 'Ethnicity'),
      education: this.groupByField(filteredData, 'Education'),
      income: this.groupByField(filteredData, 'Income'),
      party: this.groupByField(filteredData, 'Party'),
      region: this.groupByField(filteredData, 'County'), // Using County as region
    };

    // Geographic breakdown
    const geography: GeographicBreakdown = {
      state: this.groupByField(filteredData, 'County'), // Using County as state
      county: this.groupByField(filteredData, 'County'),
      city: this.groupByField(filteredData, 'County'), // Using County as city
      zipCode: this.groupByField(filteredData, 'ZipCode'),
      dma: this.groupByField(filteredData, 'DMA'),
      stateSenateDistrict: {},
      stateHouseDistrict: {},
    };

    // Engagement breakdown
    const engagement = {
      high: filteredData.filter(p => this.parseBooleanValue(p.engagement_high)).length,
      medium: filteredData.filter(p => this.parseBooleanValue(p.engagement_mid)).length,
      low: filteredData.filter(p => this.parseBooleanValue(p.engagement_low)).length,
    };

    // Political breakdown
    const political = {
      democrat: filteredData.filter(p => p.Party === 'Democrat' || this.parseBooleanValue(p.partydemocrat)).length,
      republican: filteredData.filter(p => p.Party === 'Republican' || this.parseBooleanValue(p.partyrepublican)).length,
      independent: filteredData.filter(p => p.Party === 'Independent/Other').length,
      swing: filteredData.filter(p => this.parseBooleanValue(p.swing)).length,
    };

    // Media consumption breakdown
    const mediaConsumption = {
      socialmediaheavyuser: filteredData.filter(p => this.parseBooleanValue(p.socialmediaheavyuser)).length,
      socialmediauserfacebook: filteredData.filter(p => this.parseBooleanValue(p.socialmediauserfacebook)).length,
      socialmediauserinstagram: filteredData.filter(p => this.parseBooleanValue(p.socialmediauserinstagram)).length,
      socialmediauserx: filteredData.filter(p => this.parseBooleanValue(p.socialmediauserx)).length,
      socialmediauseryoutube: filteredData.filter(p => this.parseBooleanValue(p.socialmediauseryoutube)).length,
    };

    return {
      totalCount,
      demographics,
      geography,
      engagement,
      political,
      mediaConsumption,
      universe: {},
    };
  }

  private groupByField(data: CombinedPersonData[], field: string): { [key: string]: number } {
    const groups: { [key: string]: number } = {};
    
    data.forEach(person => {
      const value = person[field];
      if (value !== undefined && value !== null && value !== '') {
        const key = String(value);
        // Use mapped value for display if available
        const displayKey = this.hasMappings(field) ? this.getMappedValue(field, key) : key;
        groups[displayKey] = (groups[displayKey] || 0) + 1;
      }
    });

    return groups;
  }

  // Filter data based on conditions
  filterData(conditions: any[]): CombinedPersonData[] {
    return this.personData.filter(person => {
      return conditions.every(condition => this.evaluateCondition(person, condition));
    });
  }

  private evaluateCondition(person: CombinedPersonData, condition: any): boolean {
    const { field, operator, value } = condition;
    const personValue = person[field];

    // Handle boolean fields specially - all universe fields are boolean
    const booleanFields = AVAILABLE_FILTER_FIELDS.filter(f => f.type === 'boolean').map(f => f.key);
    const isBooleanField = booleanFields.includes(field);

    switch (operator) {
      case 'equals':
        if (isBooleanField) {
          // For boolean fields, check if the value indicates "true" (1, "1", "true", "yes", etc.)
          const personBool = this.parseBooleanValue(personValue);
          const targetBool = this.parseBooleanValue(value);
          return personBool === targetBool;
        }
        return personValue === value;
      case 'not_equals':
        if (isBooleanField) {
          const personBool = this.parseBooleanValue(personValue);
          const targetBool = this.parseBooleanValue(value);
          return personBool !== targetBool;
        }
        return personValue !== value;
      case 'contains':
        return String(personValue).toLowerCase().includes(String(value).toLowerCase());
      case 'not_contains':
        return !String(personValue).toLowerCase().includes(String(value).toLowerCase());
      case 'greater_than':
        return Number(personValue) > Number(value);
      case 'less_than':
        return Number(personValue) < Number(value);
      case 'between':
        return Number(personValue) >= Number(value.min) && Number(personValue) <= Number(value.max);
      case 'in':
        return Array.isArray(value) && value.includes(personValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(personValue);
      default:
        return true;
    }
  }

  private parseBooleanValue(value: any): boolean {
    if (value === null || value === undefined || value === '') return false;
    const str = String(value).toLowerCase();
    return str === '1' || str === 'true' || str === 'yes' || str === 'y';
  }

  // Get unique values for a field (for dropdown options)
  getUniqueValues(field: string): string[] {
    const values = new Set<string>();
    
    this.personData.forEach(person => {
      const value = person[field];
      if (value !== undefined && value !== null && value !== '') {
        values.add(String(value));
      }
    });

    return Array.from(values).sort();
  }

  // Get field statistics
  getFieldStats(field: string): { min: number; max: number; unique: number } {
    const numericValues = this.personData
      .map(p => Number(p[field]))
      .filter(v => !isNaN(v));

    return {
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
      unique: this.getUniqueValues(field).length,
    };
  }
}

// Singleton instance
export const dataProcessor = new DataProcessor();
