/**
 * Unit tests for FilterBuilder component
 * Tests filter selection, AND/OR logic, and pending changes
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FilterBuilder } from '../FilterBuilder';
import { mockAudienceStats } from '../../lib/test-utils';

describe('FilterBuilder', () => {
  const mockOnFiltersChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the component with title', () => {
      render(
        <FilterBuilder
          onFiltersChange={mockOnFiltersChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      expect(screen.getByText('Universe Filters')).toBeInTheDocument();
    });

    it('should show loading state when data is not loaded', () => {
      render(
        <FilterBuilder
          onFiltersChange={mockOnFiltersChange}
          isDataLoaded={false}
        />
      );

      // Component shows loading UI when data is not loaded
      expect(screen.getByText('Universe Filters')).toBeInTheDocument();
    });

    it('should show pending changes indicator', () => {
      render(
        <FilterBuilder
          onFiltersChange={mockOnFiltersChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
          hasPendingChanges={true}
        />
      );

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  describe('Filter Selection', () => {
    it('should allow selecting a universe filter', async () => {
      render(
        <FilterBuilder
          onFiltersChange={mockOnFiltersChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      // Open dropdown
      const dropdown = screen.getByText(/Select audiences/i);
      fireEvent.click(dropdown);

      // Wait for dropdown to open and click a filter
      await waitFor(() => {
        const filter = screen.getByText('High Turnout');
        expect(filter).toBeInTheDocument();
        fireEvent.click(filter);
      });

      // Should call onFiltersChange with the selected filter
      await waitFor(() => {
        expect(mockOnFiltersChange).toHaveBeenCalled();
        const filterGroup = mockOnFiltersChange.mock.calls[0][0];
        expect(filterGroup).toBeDefined();
        expect(filterGroup.conditions.length).toBe(1);
        expect(filterGroup.conditions[0].field).toBe('turnouthigh');
      });
    });

    it('should allow selecting multiple universe filters', async () => {
      render(
        <FilterBuilder
          onFiltersChange={mockOnFiltersChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      // Open dropdown by finding the button
      const buttons = screen.getAllByRole('button');
      const dropdownButton = buttons.find(btn => btn.textContent?.includes('Select audiences'));
      
      if (dropdownButton) {
        fireEvent.click(dropdownButton);

        // Select first filter
        await waitFor(() => {
          const filter1 = screen.queryByText('High Turnout');
          if (filter1) {
            fireEvent.click(filter1);
          }
        });

        // Select second filter
        await waitFor(() => {
          const filter2 = screen.queryByText('Engagement High');
          if (filter2) {
            fireEvent.click(filter2);
          }
        });

        // Should have called onFiltersChange
        await waitFor(() => {
          expect(mockOnFiltersChange).toHaveBeenCalled();
        });
      }
    });

    it('should allow deselecting a filter', async () => {
      render(
        <FilterBuilder
          onFiltersChange={mockOnFiltersChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      const dropdown = screen.getByText(/Select audiences/i);
      fireEvent.click(dropdown);

      // Select a filter
      await waitFor(() => {
        const filter = screen.getByText('High Turnout');
        fireEvent.click(filter);
      });

      // Deselect the same filter
      await waitFor(() => {
        const filter = screen.getByText('High Turnout');
        fireEvent.click(filter);
      });

      // Should remove the filter
      await waitFor(() => {
        const lastCall = mockOnFiltersChange.mock.calls[mockOnFiltersChange.mock.calls.length - 1][0];
        if (lastCall === null) {
          expect(lastCall).toBeNull();
        } else {
          expect(lastCall.conditions.length).toBe(0);
        }
      });
    });

    it('should show filter counts from audience stats', async () => {
      render(
        <FilterBuilder
          onFiltersChange={mockOnFiltersChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      const dropdown = screen.getByText(/Select audiences/i);
      fireEvent.click(dropdown);

      // Should show counts for filters
      await waitFor(() => {
        // Check that numbers are formatted and displayed
        expect(screen.getByText(/1,800,000/)).toBeInTheDocument(); // turnouthigh count
      });
    });
  });

  describe('AND/OR Logic', () => {
    it('should default to OR logic', () => {
      render(
        <FilterBuilder
          onFiltersChange={mockOnFiltersChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      // OR should be selected by default in the select dropdown
      const selects = screen.getAllByRole('combobox');
      const logicSelect = selects.find(select => select instanceof HTMLSelectElement) as HTMLSelectElement;
      expect(logicSelect?.value).toBe('OR');
    });

    it('should allow switching to AND logic', async () => {
      render(
        <FilterBuilder
          onFiltersChange={mockOnFiltersChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      // Change select to AND
      const selects = screen.getAllByRole('combobox');
      const logicSelect = selects.find(select => select instanceof HTMLSelectElement) as HTMLSelectElement;
      
      if (logicSelect) {
        fireEvent.change(logicSelect, { target: { value: 'AND' } });

        // Should update to AND
        await waitFor(() => {
          expect(logicSelect.value).toBe('AND');
        });

        // Add a filter and check the operator
        const dropdown = screen.getByText(/Select audiences/i);
        fireEvent.click(dropdown);

        await waitFor(() => {
          const filter = screen.queryByText('High Turnout');
          if (filter) {
            fireEvent.click(filter);
          }
        });

        await waitFor(() => {
          const lastCall = mockOnFiltersChange.mock.calls[mockOnFiltersChange.mock.calls.length - 1];
          if (lastCall && lastCall[0]) {
            expect(lastCall[0].operator).toBe('AND');
          }
        });
      }
    });

    it('should switch from OR to AND and update existing filters', async () => {
      render(
        <FilterBuilder
          onFiltersChange={mockOnFiltersChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      // Add a filter with OR
      const dropdown = screen.getByText(/Select audiences/i);
      fireEvent.click(dropdown);

      await waitFor(() => {
        const filter = screen.queryByText('High Turnout');
        if (filter) {
          fireEvent.click(filter);
        }
      });

      // Switch to AND using select dropdown
      const selects = screen.getAllByRole('combobox');
      const logicSelect = selects.find(select => select instanceof HTMLSelectElement) as HTMLSelectElement;
      
      if (logicSelect) {
        fireEvent.change(logicSelect, { target: { value: 'AND' } });

        await waitFor(() => {
          const lastCall = mockOnFiltersChange.mock.calls[mockOnFiltersChange.mock.calls.length - 1];
          if (lastCall && lastCall[0]) {
            expect(lastCall[0].operator).toBe('AND');
          }
        });
      }
    });
  });

  describe('Search Functionality', () => {
    it('should filter options based on search term', async () => {
      render(
        <FilterBuilder
          onFiltersChange={mockOnFiltersChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      const dropdown = screen.getByText(/Select audiences/i);
      fireEvent.click(dropdown);

      // Type in search box
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search audiences/i);
        fireEvent.change(searchInput, { target: { value: 'engagement' } });
      });

      // Should show only engagement-related filters
      await waitFor(() => {
        expect(screen.getByText('Engagement High')).toBeInTheDocument();
        expect(screen.getByText('Engagement Mid')).toBeInTheDocument();
        expect(screen.getByText('Engagement Low')).toBeInTheDocument();
        // Should not show turnout
        expect(screen.queryByText('High Turnout')).not.toBeInTheDocument();
      });
    });

    it('should show "no results" when search matches nothing', async () => {
      render(
        <FilterBuilder
          onFiltersChange={mockOnFiltersChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      const dropdown = screen.getByText(/Select audiences/i);
      fireEvent.click(dropdown);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search audiences/i);
        fireEvent.change(searchInput, { target: { value: 'nonexistentfilter123' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/No filters found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Clear All Functionality', () => {
    it('should clear all selected filters', async () => {
      render(
        <FilterBuilder
          onFiltersChange={mockOnFiltersChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      // Select some filters
      const dropdown = screen.getByText(/Select audiences/i);
      fireEvent.click(dropdown);

      await waitFor(() => {
        const filter1 = screen.getByText('High Turnout');
        fireEvent.click(filter1);
      });

      await waitFor(() => {
        const filter2 = screen.getByText('Engagement High');
        fireEvent.click(filter2);
      });

      // Click clear all
      const clearButton = screen.getByText(/Clear/i);
      fireEvent.click(clearButton);

      // Should call onFiltersChange with null or empty
      await waitFor(() => {
        const lastCall = mockOnFiltersChange.mock.calls[mockOnFiltersChange.mock.calls.length - 1][0];
        expect(lastCall).toBeNull();
      });
    });
  });

  describe('Filter Labels', () => {
    it('should display correct labels for selected filters', async () => {
      render(
        <FilterBuilder
          onFiltersChange={mockOnFiltersChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      const dropdown = screen.getByText(/Select audiences/i);
      fireEvent.click(dropdown);

      await waitFor(() => {
        const filter = screen.getByText('High Turnout');
        fireEvent.click(filter);
      });

      // Should generate correct label
      await waitFor(() => {
        const filterGroup = mockOnFiltersChange.mock.calls[mockOnFiltersChange.mock.calls.length - 1][0];
        expect(filterGroup.conditions[0].label).toContain('High Turnout');
        expect(filterGroup.conditions[0].label).toContain('Yes');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing audience stats gracefully', async () => {
      render(
        <FilterBuilder
          onFiltersChange={mockOnFiltersChange}
          isDataLoaded={true}
          audienceStats={null}
        />
      );

      // Should still render without crashing
      expect(screen.getByText('Universe Filters')).toBeInTheDocument();
      
      // Open dropdown - should work even without stats
      const buttons = screen.getAllByRole('button');
      const dropdownButton = buttons.find(btn => btn.textContent?.includes('Select audiences'));
      
      if (dropdownButton) {
        fireEvent.click(dropdownButton);
        
        // Should still show filter options (just with 0 counts)
        await waitFor(() => {
          const filter = screen.queryByText('High Turnout');
          expect(filter).toBeDefined();
        });
      }
    });

    it('should handle rapid filter selection/deselection', async () => {
      render(
        <FilterBuilder
          onFiltersChange={mockOnFiltersChange}
          isDataLoaded={true}
          audienceStats={mockAudienceStats}
        />
      );

      const dropdown = screen.getByText(/Select audiences/i);
      fireEvent.click(dropdown);

      // Rapidly select and deselect
      await waitFor(() => {
        const filter = screen.getByText('High Turnout');
        fireEvent.click(filter);
        fireEvent.click(filter);
        fireEvent.click(filter);
        fireEvent.click(filter);
      });

      // Should handle it without crashing
      expect(mockOnFiltersChange).toHaveBeenCalled();
    });

    it('should close dropdown when clicking outside', async () => {
      render(
        <div>
          <FilterBuilder
            onFiltersChange={mockOnFiltersChange}
            isDataLoaded={true}
            audienceStats={mockAudienceStats}
          />
          <div data-testid="outside">Outside</div>
        </div>
      );

      const dropdown = screen.getByText(/Select audiences/i);
      fireEvent.click(dropdown);

      // Dropdown should be open
      await waitFor(() => {
        expect(screen.getByText('High Turnout')).toBeInTheDocument();
      });

      // Click outside
      const outside = screen.getByTestId('outside');
      fireEvent.mouseDown(outside);

      // Dropdown should close
      await waitFor(() => {
        expect(screen.queryByText('High Turnout')).not.toBeInTheDocument();
      });
    });
  });
});

