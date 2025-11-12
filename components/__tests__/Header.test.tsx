/**
 * Unit tests for Header component
 * Tests count display, percentage calculations, and export button
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../Header';

describe('Header', () => {
  const mockOnExportPDF = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the header with title', () => {
      render(
        <Header
          totalCount={5000000}
          filteredCount={125000}
          onExportPDF={mockOnExportPDF}
        />
      );

      expect(screen.getByText('Audience Builder')).toBeInTheDocument();
      expect(screen.getByText('Lava Data Analysis Platform')).toBeInTheDocument();
    });

    it('should display the total count with formatting', () => {
      render(
        <Header
          totalCount={5000000}
          filteredCount={125000}
          onExportPDF={mockOnExportPDF}
        />
      );

      // Check if numbers are formatted with commas (multiple instances for mobile/desktop)
      const count125k = screen.getAllByText(/125,000/);
      const count5m = screen.getAllByText(/5,000,000/);
      expect(count125k.length).toBeGreaterThan(0);
      expect(count5m.length).toBeGreaterThan(0);
    });

    it('should show live data indicator', () => {
      render(
        <Header
          totalCount={5000000}
          filteredCount={125000}
          onExportPDF={mockOnExportPDF}
        />
      );

      expect(screen.getAllByText('Live Data').length).toBeGreaterThan(0);
    });
  });

  describe('Percentage Calculation', () => {
    it('should show correct percentage (2.5%)', () => {
      render(
        <Header
          totalCount={5000000}
          filteredCount={125000}
          onExportPDF={mockOnExportPDF}
        />
      );

      // 125,000 / 5,000,000 = 2.5%
      expect(screen.getByText(/2.5%/)).toBeInTheDocument();
    });

    it('should show 50% when filtered count is half', () => {
      render(
        <Header
          totalCount={1000000}
          filteredCount={500000}
          onExportPDF={mockOnExportPDF}
        />
      );

      const percentages = screen.getAllByText(/50.0%/);
      expect(percentages.length).toBeGreaterThan(0);
    });

    it('should show 100% when filtered equals total', () => {
      render(
        <Header
          totalCount={1000000}
          filteredCount={1000000}
          onExportPDF={mockOnExportPDF}
        />
      );

      const percentages = screen.getAllByText(/100.0%/);
      expect(percentages.length).toBeGreaterThan(0);
    });

    it('should show 0% when filtered count is zero', () => {
      render(
        <Header
          totalCount={1000000}
          filteredCount={0}
          onExportPDF={mockOnExportPDF}
        />
      );

      const percentages = screen.getAllByText(/0%/);
      expect(percentages.length).toBeGreaterThan(0);
    });

    it('should handle totalCount of zero', () => {
      render(
        <Header
          totalCount={0}
          filteredCount={0}
          onExportPDF={mockOnExportPDF}
        />
      );

      // Should not crash, show 0%
      const percentages = screen.getAllByText(/0%/);
      expect(percentages.length).toBeGreaterThan(0);
    });
  });

  describe('Export Button', () => {
    it('should render export PDF button', () => {
      render(
        <Header
          totalCount={5000000}
          filteredCount={125000}
          onExportPDF={mockOnExportPDF}
        />
      );

      const exportButtons = screen.getAllByText(/Export/);
      expect(exportButtons.length).toBeGreaterThan(0);
    });

    it('should call onExportPDF when clicked', () => {
      render(
        <Header
          totalCount={5000000}
          filteredCount={125000}
          onExportPDF={mockOnExportPDF}
        />
      );

      const buttons = screen.getAllByRole('button');
      const exportButton = buttons.find(btn => btn.textContent?.includes('Export'));
      
      if (exportButton) {
        fireEvent.click(exportButton);
        expect(mockOnExportPDF).toHaveBeenCalledTimes(1);
      }
    });

    it('should be disabled when filteredCount is zero', () => {
      render(
        <Header
          totalCount={5000000}
          filteredCount={0}
          onExportPDF={mockOnExportPDF}
        />
      );

      const buttons = screen.getAllByRole('button');
      const exportButton = buttons.find(btn => btn.textContent?.includes('Export'));
      expect(exportButton).toBeDisabled();
    });

    it('should be enabled when filteredCount is greater than zero', () => {
      render(
        <Header
          totalCount={5000000}
          filteredCount={125000}
          onExportPDF={mockOnExportPDF}
        />
      );

      const buttons = screen.getAllByRole('button');
      const exportButton = buttons.find(btn => btn.textContent?.includes('Export'));
      expect(exportButton).not.toBeDisabled();
    });

    it('should not call onExportPDF when disabled', () => {
      render(
        <Header
          totalCount={5000000}
          filteredCount={0}
          onExportPDF={mockOnExportPDF}
        />
      );

      const buttons = screen.getAllByRole('button');
      const exportButton = buttons.find(btn => btn.textContent?.includes('Export'));
      
      if (exportButton) {
        fireEvent.click(exportButton);
      }

      // Should not be called because button is disabled
      expect(mockOnExportPDF).not.toHaveBeenCalled();
    });
  });

  describe('Responsive Design', () => {
    it('should render mobile stats section', () => {
      render(
        <Header
          totalCount={5000000}
          filteredCount={125000}
          onExportPDF={mockOnExportPDF}
        />
      );

      // Mobile and desktop versions should both exist (hidden via CSS)
      const allCountDisplays = screen.getAllByText(/125,000/);
      expect(allCountDisplays.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large numbers', () => {
      render(
        <Header
          totalCount={999999999}
          filteredCount={123456789}
          onExportPDF={mockOnExportPDF}
        />
      );

      const largeNumbers1 = screen.getAllByText(/999,999,999/);
      const largeNumbers2 = screen.getAllByText(/123,456,789/);
      expect(largeNumbers1.length).toBeGreaterThan(0);
      expect(largeNumbers2.length).toBeGreaterThan(0);
    });

    it('should handle decimal percentages correctly', () => {
      render(
        <Header
          totalCount={3}
          filteredCount={1}
          onExportPDF={mockOnExportPDF}
        />
      );

      // 1/3 = 33.3%
      const percentages = screen.getAllByText(/33.3%/);
      expect(percentages.length).toBeGreaterThan(0);
    });

    it('should not crash with negative numbers', () => {
      render(
        <Header
          totalCount={1000000}
          filteredCount={-100}
          onExportPDF={mockOnExportPDF}
        />
      );

      // Should render without crashing (even though data is invalid)
      expect(screen.getByText('Audience Builder')).toBeInTheDocument();
    });
  });
});

