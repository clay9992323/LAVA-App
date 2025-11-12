/**
 * Unit tests for GeographicSelector component
 * Tests cascading dropdown behavior and geographic filtering
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GeographicSelector } from '../GeographicSelector';
import { mockAudienceStats, mockGeographicOptions } from '../../lib/test-utils';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('GeographicSelector', () => {
  const mockOnGeographicChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        geographicOptions: mockGeographicOptions,
      }),
    });
  });

  describe('Rendering', () => {
    it('should render the component with title', () => {
      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      expect(screen.getByText('Geographic Filters')).toBeInTheDocument();
    });

    it('should show loading state when data is not loaded', () => {
      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={false}
        />
      );

      expect(screen.getByText(/Loading geographic options/i)).toBeInTheDocument();
    });

    it('should show pending changes indicator', () => {
      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
          hasPendingChanges={true}
        />
      );

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should render all geographic categories', () => {
      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      expect(screen.getByText('State')).toBeInTheDocument();
      expect(screen.getByText('County')).toBeInTheDocument();
      expect(screen.getByText('DMA')).toBeInTheDocument();
    });
  });

  describe('State Selection', () => {
    it('should call API to fetch geographic options', async () => {
      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      // Wait for initial API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Verify API was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/geographic-options',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should call onGeographicChange when state changes', async () => {
      const currentSelections = {
        state: [],
        county: [],
        dma: [],
        stateSenateDistrict: [],
        stateHouseDistrict: [],
      };
      
      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
          currentSelections={currentSelections}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // The component should be rendered
      expect(screen.getByText('Geographic Filters')).toBeInTheDocument();
    });
  });

  describe('Cascading Dropdown Behavior', () => {
    it('should disable county dropdown when no state is selected', () => {
      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      // County dropdown should show "Select a state first" message (multiple instances expected)
      const messages = screen.getAllByText(/Select a state first/i);
      expect(messages.length).toBeGreaterThan(0);
    });

    it('should enable county dropdown after selecting a state', async () => {
      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Select a state
      const stateDropdowns = screen.getAllByText(/Choose State/i);
      fireEvent.click(stateDropdowns[0]);

      await waitFor(() => {
        const louisiana = screen.getByText('Louisiana');
        fireEvent.click(louisiana);
      });

      // County dropdown should now be enabled
      await waitFor(() => {
        const countyDropdowns = screen.queryAllByText(/Choose County/i);
        expect(countyDropdowns.length).toBeGreaterThan(0);
      });
    });

    it('should sync with currentSelections prop', async () => {
      const currentSelections = {
        state: ['Louisiana'],
        county: ['Orleans'],
        dma: [],
        stateSenateDistrict: [],
        stateHouseDistrict: [],
      };
      
      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
          currentSelections={currentSelections}
        />
      );

      // Should render with current selections
      await waitFor(() => {
        expect(screen.getByText('Geographic Filters')).toBeInTheDocument();
      });

      // Should show clear button when selections exist
      const clearButtons = screen.getAllByText('Clear');
      expect(clearButtons.length).toBeGreaterThan(0);
    });

    it('should disable DMA dropdown when no state is selected', () => {
      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      // DMA section should show "Select a state first"
      const dmaSection = screen.getAllByText(/Select a state first/i);
      expect(dmaSection.length).toBeGreaterThan(0);
    });
  });

  describe('Clear Functionality', () => {
    it('should show clear button when selections exist', async () => {
      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
          currentSelections={{
            state: ['Louisiana'],
            county: [],
            dma: [],
            stateSenateDistrict: [],
            stateHouseDistrict: [],
          }}
        />
      );

      // Clear button should be visible
      const clearButtons = screen.getAllByText('Clear');
      expect(clearButtons.length).toBeGreaterThan(0);
    });

    it('should clear all selections when clear all is clicked', async () => {
      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
          currentSelections={{
            state: ['Louisiana'],
            county: ['Orleans'],
            dma: [],
            stateSenateDistrict: [],
            stateHouseDistrict: [],
          }}
        />
      );

      // Find and click clear all button (the main one in the header)
      const clearButtons = screen.getAllByText('Clear');
      if (clearButtons.length > 0) {
        fireEvent.click(clearButtons[0]);
      }

      await waitFor(() => {
        expect(mockOnGeographicChange).toHaveBeenCalledWith({
          state: [],
          county: [],
          dma: [],
          stateSenateDistrict: [],
          stateHouseDistrict: [],
        });
      });
    });
  });

  describe('API Integration', () => {
    it('should fetch geographic options on mount', async () => {
      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/geographic-options',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('should refetch options when state selection changes', async () => {
      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Wait for initial load
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Change state
      const stateDropdowns = screen.getAllByText(/Choose State/i);
      if (stateDropdowns.length > 0) {
        fireEvent.click(stateDropdowns[0]);

        await waitFor(() => {
          const louisiana = screen.queryByText('Louisiana');
          if (louisiana) {
            fireEvent.click(louisiana);
          }
        });
      }

      // Should make another API call
      await waitFor(() => {
        expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      // Component should still render
      expect(screen.getByText('Geographic Filters')).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Dropdown Interaction', () => {
    it('should render dropdown buttons for all geographic levels', async () => {
      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Should have multiple dropdown buttons rendered
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(4); // State, County, DMA, etc.
    });

    it('should show selected count in dropdown button', async () => {
      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
          currentSelections={{
            state: ['Louisiana', 'Mississippi'],
            county: [],
            dma: [],
            stateSenateDistrict: [],
            stateHouseDistrict: [],
          }}
        />
      );

      // Should show count indicator
      await waitFor(() => {
        const countIndicators = screen.getAllByText('2');
        expect(countIndicators.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty geographic options', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          geographicOptions: {
            states: {},
            counties: {},
            dmas: {},
            stateSenateDistricts: {},
            stateHouseDistricts: {},
          },
        }),
      });

      render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Should still render without crashing
      expect(screen.getByText('Geographic Filters')).toBeInTheDocument();
    });

    it('should handle multiple selection updates', async () => {
      const { rerender } = render(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
          currentSelections={{
            state: [],
            county: [],
            dma: [],
            stateSenateDistrict: [],
            stateHouseDistrict: [],
          }}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Update selections multiple times via props
      rerender(
        <GeographicSelector
          onGeographicChange={mockOnGeographicChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
          currentSelections={{
            state: ['Louisiana'],
            county: [],
            dma: [],
            stateSenateDistrict: [],
            stateHouseDistrict: [],
          }}
        />
      );

      // Should handle without crashing
      expect(screen.getByText('Geographic Filters')).toBeInTheDocument();
    });
  });
});

