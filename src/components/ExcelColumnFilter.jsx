import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Excel-like column filter popover for data tables.
 * Provides:
 * - Sort Ascending / Descending
 * - Search filter list
 * - Select All / Clear All
 * - Multi-select checkboxes for unique values with frequency counts
 * - Blank values handling: '(Blanks)'
 */
const ExcelColumnFilter = ({
  columnKey,
  title,
  dataset = [],
  getValue,
  filterValues, // Set of allowed values, or null if no filter
  onApplyFilter,
  sortConfig, // { key, direction: 'asc' | 'desc' }
  onSort,
  align = 'left',
  dataType = 'text', // 'text' | 'number' | 'date'
  onClose,
}) => {
  const popoverRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Extract all unique values and their frequencies from the dataset
  const { uniqueValues, counts, hasBlanks } = useMemo(() => {
    const valueCounts = new Map();
    let blanks = false;

    for (const item of dataset) {
      let rawVal = getValue ? getValue(item) : item[columnKey];
      let val = rawVal === null || rawVal === undefined ? '' : String(rawVal).trim();
      if (!val) {
        blanks = true;
        val = '__BLANK__';
      }
      valueCounts.set(val, (valueCounts.get(val) || 0) + 1);
    }

    const values = Array.from(valueCounts.keys()).sort((a, b) => {
      if (a === '__BLANK__') return 1;
      if (b === '__BLANK__') return -1;
      if (dataType === 'number') {
        const numA = parseFloat(a);
        const numB = parseFloat(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      }
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    return { uniqueValues: values, counts: valueCounts, hasBlanks: blanks };
  }, [dataset, columnKey, getValue, dataType]);

  // Initial selected values: if filterValues is null/undefined, all are selected initially
  const [tempSelected, setTempSelected] = useState(() => {
    if (filterValues instanceof Set) {
      return new Set(filterValues);
    }
    return new Set(uniqueValues);
  });

  // Filter the list of values by search term
  const visibleValues = useMemo(() => {
    if (!searchTerm.trim()) return uniqueValues;
    const term = searchTerm.toLowerCase().trim();
    return uniqueValues.filter(val => {
      const display = val === '__BLANK__' ? '(blanks)' : val.toLowerCase();
      return display.includes(term);
    });
  }, [uniqueValues, searchTerm]);

  // Click outside and Esc key listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const isAllVisibleSelected =
    visibleValues.length > 0 &&
    visibleValues.every(val => tempSelected.has(val));

  const isSomeVisibleSelected =
    visibleValues.some(val => tempSelected.has(val)) && !isAllVisibleSelected;

  const handleToggleSelectAll = () => {
    setTempSelected(prev => {
      const next = new Set(prev);
      if (isAllVisibleSelected) {
        // Deselect all currently visible
        for (const val of visibleValues) {
          next.delete(val);
        }
      } else {
        // Select all currently visible
        for (const val of visibleValues) {
          next.add(val);
        }
      }
      return next;
    });
  };

  const handleToggleValue = (val) => {
    setTempSelected(prev => {
      const next = new Set(prev);
      if (next.has(val)) {
        next.delete(val);
      } else {
        next.add(val);
      }
      return next;
    });
  };

  const handleApply = () => {
    // If all unique values are selected, it means no filter is applied
    if (tempSelected.size === uniqueValues.length) {
      onApplyFilter?.(null);
    } else {
      onApplyFilter?.(new Set(tempSelected));
    }
    onClose?.();
  };

  const handleClear = () => {
    onApplyFilter?.(null);
    onClose?.();
  };

  const isSortedAsc = sortConfig?.key === columnKey && sortConfig?.direction === 'asc';
  const isSortedDesc = sortConfig?.key === columnKey && sortConfig?.direction === 'desc';

  // Sort labels based on data type
  const sortAscLabel = dataType === 'number' ? 'Sort Smallest to Largest' : dataType === 'date' ? 'Sort Oldest to Newest' : 'Sort A to Z';
  const sortDescLabel = dataType === 'number' ? 'Sort Largest to Smallest' : dataType === 'date' ? 'Sort Newest to Oldest' : 'Sort Z to A';

  return (
    <div
      ref={popoverRef}
      className={`excel-filter-popover align-${align}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Popover Header */}
      <div className="excel-popover-header">
        <span className="excel-popover-title">Filter: {title}</span>
        <button type="button" className="excel-popover-close" onClick={onClose} title="Close">
          ✕
        </button>
      </div>

      {/* Sort Actions */}
      <div className="excel-sort-group">
        <button
          type="button"
          className={`excel-sort-btn ${isSortedAsc ? 'active' : ''}`}
          onClick={() => {
            onSort?.('asc');
            onClose?.();
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
          <span>{sortAscLabel}</span>
        </button>
        <button
          type="button"
          className={`excel-sort-btn ${isSortedDesc ? 'active' : ''}`}
          onClick={() => {
            onSort?.('desc');
            onClose?.();
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7"/>
          </svg>
          <span>{sortDescLabel}</span>
        </button>
      </div>

      <div className="excel-divider" />

      {/* Quick Clear from column */}
      {filterValues instanceof Set && (
        <>
          <button type="button" className="excel-clear-col-btn" onClick={handleClear}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span>Clear filter from "{title}"</span>
          </button>
          <div className="excel-divider" />
        </>
      )}

      {/* Search Filter Items */}
      <div className="excel-search-box">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          className="excel-search-input"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
        />
        {searchTerm && (
          <button type="button" className="excel-search-clear" onClick={() => setSearchTerm('')}>
            ✕
          </button>
        )}
      </div>

      {/* Checklist of Values */}
      <div className="excel-values-list">
        {/* Select All Checkbox */}
        <label className="excel-checkbox-item select-all-item">
          <input
            type="checkbox"
            checked={isAllVisibleSelected}
            ref={(el) => {
              if (el) el.indeterminate = isSomeVisibleSelected;
            }}
            onChange={handleToggleSelectAll}
          />
          <span className="excel-val-text select-all-text">
            {searchTerm ? '(Select All Search Results)' : '(Select All)'}
          </span>
        </label>

        {visibleValues.length === 0 ? (
          <div className="excel-no-matches">No matches found</div>
        ) : (
          visibleValues.map((val) => {
            const isChecked = tempSelected.has(val);
            const count = counts.get(val) || 0;
            const isBlank = val === '__BLANK__';

            return (
              <label key={val} className="excel-checkbox-item">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleValue(val)}
                />
                <span className={`excel-val-text ${isBlank ? 'is-blank' : ''}`} title={isBlank ? '(Blanks)' : val}>
                  {isBlank ? '(Blanks)' : val}
                </span>
                <span className="excel-val-count">({count})</span>
              </label>
            );
          })
        )}
      </div>

      {/* Footer Controls */}
      <div className="excel-popover-footer">
        <button type="button" className="excel-btn-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="excel-btn-apply" onClick={handleApply}>
          Apply
        </button>
      </div>
    </div>
  );
};

export default ExcelColumnFilter;
