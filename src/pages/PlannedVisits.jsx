import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { plannedVisitsService } from '../services/api';
import '../styles/PlannedVisits.css';

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const YEARS = ['2026', '2025', '2024'];

const COLUMNS = [
  { key: 'scientific_officer', label: 'Scientific Officer', type: 'string' },
  { key: 'region', label: 'Region', type: 'string' },
  { key: 'territory', label: 'Territory', type: 'string' },
  { key: 'requested_date', label: 'Requested Date', type: 'date' },
  { key: 'count_planned_doctors', label: 'Count of Planned Doctors', type: 'number' },
  { key: 'requested_by', label: 'Raised By (BL)', type: 'string' },
];

const PlannedVisits = () => {
  const [data, setData] = useState({
    total_planned_visits: 0,
    total_planned_doctors: 0,
    total_scientific_officers: 0,
    scientific_officers_list: [],
    regions_list: [],
    territories_list: [],
    planned_visits: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRows, setExpandedRows] = useState({});

  // Server-side / Top filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSO, setSelectedSO] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  // Table Heading Sort & Excel Filter states
  const [sortConfig, setSortConfig] = useState({ key: 'requested_date', direction: 'desc' });
  const [columnFilters, setColumnFilters] = useState({});
  const [columnSearch, setColumnSearch] = useState({});
  const [activeFilterMenu, setActiveFilterMenu] = useState(null);

  const tableRef = useRef(null);

  const fetchPlannedVisits = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (selectedRegion) params.region = selectedRegion;
      if (selectedTerritory) params.territory = selectedTerritory;
      if (selectedSO) params.scientific_officer = selectedSO;
      if (selectedMonth) params.month = selectedMonth;
      if (selectedYear) params.year = selectedYear;
      if (searchTerm) params.search = searchTerm;

      const res = await plannedVisitsService.getPlannedVisits(params);
      setData(res.data);
    } catch (err) {
      console.error('Error fetching planned visits:', err);
      setError('Failed to load planned visits data. ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlannedVisits();
  }, [selectedSO, selectedRegion, selectedTerritory, selectedMonth, selectedYear]);

  // Close Excel filter menu on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tableRef.current && !tableRef.current.contains(event.target)) {
        setActiveFilterMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPlannedVisits();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedSO('');
    setSelectedRegion('');
    setSelectedTerritory('');
    setSelectedMonth('');
    setSelectedYear('');
    setColumnFilters({});
    setColumnSearch({});
    setSortConfig({ key: 'requested_date', direction: 'desc' });
  };

  const toggleRow = (id) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Compute distinct values for each column from current dataset
  const getDistinctValues = (key) => {
    const map = new Map();
    (data.planned_visits || []).forEach((item) => {
      let val = item[key];
      if (val === undefined || val === null || val === '') val = 'N/A';
      else val = String(val);
      map.set(val, (map.get(val) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([val, count]) => ({ val, count }))
      .sort((a, b) => a.val.localeCompare(b.val, undefined, { numeric: true }));
  };

  // Toggle item selection in column Excel filter
  const toggleColumnFilterVal = (key, val) => {
    setColumnFilters((prev) => {
      const currentList = prev[key];
      const allDistinctVals = getDistinctValues(key).map((d) => d.val);

      if (!currentList) {
        // Was "Select All" active -> now uncheck this specific val
        const newList = allDistinctVals.filter((v) => v !== val);
        return { ...prev, [key]: newList };
      }

      if (currentList.includes(val)) {
        const newList = currentList.filter((v) => v !== val);
        return { ...prev, [key]: newList };
      } else {
        const newList = [...currentList, val];
        // If all items now selected, clear the filter array
        if (newList.length >= allDistinctVals.length) {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        }
        return { ...prev, [key]: newList };
      }
    });
  };

  const clearColumnFilter = (key) => {
    setColumnFilters((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const selectAllColumnFilter = (key) => {
    clearColumnFilter(key);
  };

  const handleSortColumn = (key, direction) => {
    setSortConfig({ key, direction });
  };

  // Process filtering and sorting client side
  const processedVisits = useMemo(() => {
    let list = [...(data.planned_visits || [])];

    // 1. Column Filters
    Object.keys(columnFilters).forEach((key) => {
      const selectedVals = columnFilters[key];
      if (selectedVals && selectedVals.length > 0) {
        list = list.filter((item) => {
          let val = item[key];
          if (val === undefined || val === null || val === '') val = 'N/A';
          else val = String(val);
          return selectedVals.includes(val);
        });
      }
    });

    // 2. Sorting
    if (sortConfig.key && sortConfig.direction) {
      const { key, direction } = sortConfig;
      const isAsc = direction === 'asc';
      const colType = COLUMNS.find((c) => c.key === key)?.type || 'string';

      list.sort((a, b) => {
        let valA = a[key];
        let valB = b[key];

        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

        if (colType === 'number') {
          const numA = Number(valA) || 0;
          const numB = Number(valB) || 0;
          return isAsc ? numA - numB : numB - numA;
        } else if (colType === 'date') {
          const dateA = new Date(valA).getTime() || 0;
          const dateB = new Date(valB).getTime() || 0;
          return isAsc ? dateA - dateB : dateB - dateA;
        } else {
          const strA = String(valA).toLowerCase();
          const strB = String(valB).toLowerCase();
          return isAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
        }
      });
    }

    return list;
  }, [data.planned_visits, columnFilters, sortConfig]);

  const exportToCSV = () => {
    if (!processedVisits || processedVisits.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = [
      'Scientific Officer',
      'Region',
      'Territory',
      'Requested Date',
      'Count of Planned Doctors',
      'Raised By (BL)',
      'Doctor Names',
    ];

    const rows = processedVisits.map((pv) => {
      const docNames = (pv.doctors || []).map((d) => d.doctor_name).join('; ');
      return [
        `"${pv.scientific_officer || ''}"`,
        `"${pv.region || ''}"`,
        `"${pv.territory || ''}"`,
        `"${pv.requested_date || ''}"`,
        pv.count_planned_doctors,
        `"${pv.requested_by || ''}"`,
        `"${docNames}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Planned_Visits_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveHeaderFilters = Object.keys(columnFilters).length > 0 || sortConfig.key;

  return (
    <div className="planned-visits-container">
      <div className="pv-header">
        <div>
          <h1>Planned Visits</h1>
          <p className="pv-subtitle">
            Overview of visit requests raised by Business Leaders (BLs) for Scientific Officers
          </p>
        </div>
        <button onClick={exportToCSV} className="export-btn" disabled={loading || !processedVisits.length}>
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="pv-stats-grid">
        <div className="pv-stat-card">
          <div className="stat-value">{processedVisits.length}</div>
          <div className="stat-label">Showing Requests</div>
        </div>
        <div className="pv-stat-card highlight-blue">
          <div className="stat-value">
            {processedVisits.reduce((acc, curr) => acc + curr.count_planned_doctors, 0)}
          </div>
          <div className="stat-label">Total Planned Doctors</div>
        </div>
        <div className="pv-stat-card highlight-purple">
          <div className="stat-value">{data.total_scientific_officers}</div>
          <div className="stat-label">Scientific Officers</div>
        </div>
        <div className="pv-stat-card highlight-green">
          <div className="stat-value">{(data.regions_list || []).length}</div>
          <div className="stat-label">Regions Covered</div>
        </div>
      </div>

      {/* Top Filter Section */}
      <div className="pv-filter-card">
        <form onSubmit={handleSearchSubmit} className="pv-filter-form">
          <div className="filter-group search-group">
            <input
              type="text"
              placeholder="Search by Scientific Officer, Region, Territory, BL, Doctor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pv-input"
            />
            <button type="submit" className="search-btn">
              Search
            </button>
          </div>

          <div className="filter-group">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pv-select"
            >
              <option value="">All Months</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="pv-select"
            >
              <option value="">All Years</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {(searchTerm || selectedMonth || selectedYear || hasActiveHeaderFilters) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="reset-btn"
            >
              Reset All Filters
            </button>
          )}
        </form>
      </div>

      {error && <div className="error-alert">{error}</div>}

      {/* Table Section */}
      {loading ? (
        <div className="pv-loading">
          <div className="spinner"></div>
          <p>Loading planned visits...</p>
        </div>
      ) : processedVisits.length === 0 ? (
        <div className="no-data-card">
          <h3>No Planned Visits Found</h3>
          <p>There are no visit requests raised by BLs matching your criteria.</p>
        </div>
      ) : (
        <div className="pv-table-card" ref={tableRef}>
          <table className="pv-table">
            <thead>
              <tr>
                {COLUMNS.map((col) => {
                  const isSorted = sortConfig.key === col.key;
                  const isFiltered = (columnFilters[col.key] || []).length > 0;
                  const isOpen = activeFilterMenu === col.key;

                  return (
                    <th key={col.key} className={`th-col th-${col.key} ${isOpen ? 'menu-active' : ''}`}>
                      <div className="th-header-inner">
                        <span
                          className="th-label"
                          onClick={() =>
                            handleSortColumn(
                              col.key,
                              isSorted && sortConfig.direction === 'asc' ? 'desc' : 'asc'
                            )
                          }
                          title="Click to toggle sort"
                        >
                          {col.label}
                          {isSorted && (
                            <span className="sort-badge">
                              {sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}
                            </span>
                          )}
                        </span>

                        <button
                          type="button"
                          className={`filter-icon-btn ${isFiltered ? 'is-filtered' : ''} ${isOpen ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveFilterMenu(isOpen ? null : col.key);
                          }}
                          title="Excel Filter & Sort"
                        >
                          <svg className="funnel-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
                          </svg>
                        </button>
                      </div>

                      {/* Excel-Style Dropdown Menu */}
                      {isOpen && (
                        <div className="excel-filter-menu" onClick={(e) => e.stopPropagation()}>
                          <div className="excel-menu-header">
                            <span>Filter: {col.label}</span>
                            <button
                              className="excel-close-btn"
                              onClick={() => setActiveFilterMenu(null)}
                            >
                              ✕
                            </button>
                          </div>

                          {/* Sorting Options */}
                          <div className="excel-sort-section">
                            <button
                              type="button"
                              className={`excel-sort-item ${isSorted && sortConfig.direction === 'asc' ? 'active' : ''}`}
                              onClick={() => handleSortColumn(col.key, 'asc')}
                            >
                              <span className="icon">↑</span> Sort Ascending (
                              {col.type === 'number' ? '1 → 9' : col.type === 'date' ? 'Oldest first' : 'A → Z'}
                              )
                            </button>
                            <button
                              type="button"
                              className={`excel-sort-item ${isSorted && sortConfig.direction === 'desc' ? 'active' : ''}`}
                              onClick={() => handleSortColumn(col.key, 'desc')}
                            >
                              <span className="icon">↓</span> Sort Descending (
                              {col.type === 'number' ? '9 → 1' : col.type === 'date' ? 'Newest first' : 'Z → A'}
                              )
                            </button>
                          </div>

                          <div className="excel-divider" />

                          {/* Filter Search Box */}
                          <div className="excel-search-box">
                            <input
                              type="text"
                              placeholder="Search list..."
                              value={columnSearch[col.key] || ''}
                              onChange={(e) =>
                                setColumnSearch((prev) => ({ ...prev, [col.key]: e.target.value }))
                              }
                              className="excel-search-input"
                            />
                          </div>

                          {/* Distinct Values Checkbox List */}
                          <div className="excel-checkbox-list">
                            <label className="excel-checkbox-item select-all">
                              <input
                                type="checkbox"
                                checked={!columnFilters[col.key] || columnFilters[col.key].length === 0}
                                onChange={() => selectAllColumnFilter(col.key)}
                              />
                              <span className="val-text"><strong>(Select All)</strong></span>
                            </label>

                            {getDistinctValues(col.key)
                              .filter(({ val }) =>
                                val.toLowerCase().includes((columnSearch[col.key] || '').toLowerCase())
                              )
                              .map(({ val, count }) => {
                                const isChecked =
                                  !columnFilters[col.key] || columnFilters[col.key].includes(val);
                                return (
                                  <label key={val} className="excel-checkbox-item">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleColumnFilterVal(col.key, val)}
                                    />
                                    <span className="val-text">{val}</span>
                                    <span className="val-count">({count})</span>
                                  </label>
                                );
                              })}
                          </div>

                          {/* Footer */}
                          <div className="excel-menu-footer">
                            <button
                              type="button"
                              className="excel-footer-btn clear"
                              onClick={() => clearColumnFilter(col.key)}
                            >
                              Clear Filter
                            </button>
                            <button
                              type="button"
                              className="excel-footer-btn apply"
                              onClick={() => setActiveFilterMenu(null)}
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="th-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {processedVisits.map((pv) => {
                const isExpanded = !!expandedRows[pv.id];
                return (
                  <React.Fragment key={pv.id}>
                    <tr className={`pv-row ${isExpanded ? 'row-expanded' : ''}`}>
                      <td className="td-so">
                        <div className="cell-so">
                          <span className="so-avatar">
                            {(pv.scientific_officer[0] || 'S').toUpperCase()}
                          </span>
                          <span className="so-name">{pv.scientific_officer}</span>
                        </div>
                      </td>
                      <td className="td-region">{pv.region}</td>
                      <td className="td-territory">{pv.territory}</td>
                      <td className="td-date">{formatDate(pv.requested_date)}</td>
                      <td className="td-count">
                        <span className="badge-count">
                          {pv.count_planned_doctors} Doctor{pv.count_planned_doctors > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="td-bl">
                        <span className="bl-name">{pv.requested_by}</span>
                      </td>
                      <td className="td-action">
                        <button
                          onClick={() => toggleRow(pv.id)}
                          className="toggle-details-btn"
                        >
                          {isExpanded ? 'Hide Doctors ▲' : 'View Doctors ▼'}
                        </button>
                      </td>
                    </tr>

                    {/* Nested Details Drawer */}
                    {isExpanded && (
                      <tr className="expanded-detail-row">
                        <td colSpan="7" className="td-nested-container">
                          <div className="nested-details-panel">
                            <div className="panel-title">
                              Planned Doctors List ({pv.doctors.length})
                            </div>
                            <table className="nested-table">
                              <thead>
                                <tr>
                                  <th>Doctor Name</th>
                                  <th>Speciality</th>
                                  <th>Patch</th>
                                  <th>Brands</th>
                                  <th>Status</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pv.doctors.map((doc) => (
                                  <tr key={doc.request_id}>
                                    <td className="doc-name-cell">{doc.doctor_name}</td>
                                    <td>{doc.speciality || 'N/A'}</td>
                                    <td>{doc.patch || 'N/A'}</td>
                                    <td>
                                      {[doc.brand, doc.brand2].filter(Boolean).join(', ') || 'N/A'}
                                    </td>
                                    <td>
                                      <span className={`status-pill ${doc.status.toLowerCase().replace(/\s+/g, '-')}`}>
                                        {doc.status}
                                      </span>
                                    </td>
                                    <td>
                                      <Link to={`/requests/${doc.request_id}`} className="view-link">
                                        View Request
                                      </Link>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PlannedVisits;
