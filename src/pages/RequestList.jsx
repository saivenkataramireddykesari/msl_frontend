import { useEffect, useState, useMemo, useDeferredValue } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestService, userService } from '../services/api';
import '../styles/RequestList.css';

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

const CAN_ASSIGN_ROLES = ['Asst General Manager', 'Associate Vice President', 'Admin', 'admin'];
const CAN_EDIT_DATE_ROLES = ['Asst General Manager', 'Associate Vice President', 'Admin', 'admin'];

const RequestList = () => {
  const { user, canCreateRequest } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const [filterTerritory, setFilterTerritory] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterTherapy, setFilterTherapy] = useState('');
  const [filterAssignment, setFilterAssignment] = useState('All');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Screen detection for conditional rendering (never render both cards and table in DOM)
  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth <= 900 : false;
  });

  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // View mode: 'auto' (cards on mobile, table on desktop), 'cards', or 'table'
  const [viewMode, setViewMode] = useState('auto');
  const renderAsCards = viewMode === 'cards' || (viewMode === 'auto' && isMobileScreen);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Bulk assignment state
  const [selectedRequestIds, setSelectedRequestIds] = useState([]);
  const [mslList, setMslList] = useState([]);
  const [bulkMsl, setBulkMsl] = useState('');
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);

  // Inline Request Date edit state
  const [editingDateId, setEditingDateId] = useState(null);
  const [editingDateValue, setEditingDateValue] = useState('');
  const [isSavingDate, setIsSavingDate] = useState(false);

  const canBulkAssign = CAN_ASSIGN_ROLES.includes(user?.role);
  const canEditDate = CAN_EDIT_DATE_ROLES.includes(user?.role);

  useEffect(() => {
    fetchRequests();
  }, [user]);

  useEffect(() => {
    if (canBulkAssign) {
      fetchMslUsers();
    }
  }, [user, canBulkAssign]);

  const fetchMslUsers = async () => {
    try {
      const res = await userService.getMslUsers();
      setMslList(res.data || []);
    } catch (err) {
      console.error('Error fetching Scientific Officers / MSLs:', err);
    }
  };

  // Unique options for filters
  const uniqueTerritories = useMemo(() => {
    return [...new Set(requests.map(r => r.territory).filter(Boolean))].sort();
  }, [requests]);

  const uniqueRegions = useMemo(() => {
    return [...new Set(requests.map(r => r.region).filter(Boolean))].sort();
  }, [requests]);

  const uniqueTherapies = useMemo(() => {
    return [...new Set(requests.map(r => r.therapy_area).filter(Boolean))].sort();
  }, [requests]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (filterAssignment !== 'All') count++;
    if (filterMonth) count++;
    if (filterYear) count++;
    if (filterTerritory) count++;
    if (filterRegion) count++;
    if (filterTherapy) count++;
    return count;
  }, [search, filterAssignment, filterMonth, filterYear, filterTerritory, filterRegion, filterTherapy]);

  // High performance memoized filtering (No extra state setter, no re-render loops)
  const filteredRequests = useMemo(() => {
    let data = requests;

    if (filterAssignment === 'Assigned') {
      data = data.filter(r => r.assigned_msl && r.assigned_msl.trim() !== '');
    } else if (filterAssignment === 'Unassigned') {
      data = data.filter(r => !r.assigned_msl || r.assigned_msl.trim() === '');
    }

    if (filterMonth) {
      data = data.filter(r => {
        const dateStr = r.request_date || r.created_at;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return (d.getMonth() + 1).toString() === filterMonth;
      });
    }

    if (filterYear) {
      data = data.filter(r => {
        const dateStr = r.request_date || r.created_at;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d.getFullYear().toString() === filterYear;
      });
    }

    if (deferredSearch.trim()) {
      const s = deferredSearch.toLowerCase().trim();
      data = data.filter(r =>
        (r.doctor_name && r.doctor_name.toLowerCase().includes(s)) ||
        (r.requested_by && r.requested_by.toLowerCase().includes(s)) ||
        (r.assigned_msl && r.assigned_msl.toLowerCase().includes(s))
      );
    }

    if (filterTerritory) {
      data = data.filter(r => r.territory === filterTerritory);
    }

    if (filterRegion) {
      data = data.filter(r => r.region === filterRegion);
    }

    if (filterTherapy) {
      data = data.filter(r => r.therapy_area === filterTherapy);
    }

    return data;
  }, [requests, filterAssignment, filterMonth, filterYear, deferredSearch, filterTerritory, filterRegion, filterTherapy]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch, filterAssignment, filterMonth, filterYear, filterTerritory, filterRegion, filterTherapy]);

  // Paginated records for rendering (Massively reduces DOM size from 570+ to 25)
  const totalPages = pageSize > 0 ? Math.ceil(filteredRequests.length / pageSize) || 1 : 1;
  const paginatedRequests = useMemo(() => {
    if (pageSize === 0) return filteredRequests;
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = {
        role: user?.role,
        username: user?.username
      };
      const response = await requestService.getRequests(params);
      setRequests(response.data || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setFilterAssignment('All');
    setFilterMonth('');
    setFilterYear('');
    setFilterTerritory('');
    setFilterRegion('');
    setFilterTherapy('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      // Select all visible on current page
      const visibleIds = paginatedRequests.map(r => r.id);
      setSelectedRequestIds(prev => [...new Set([...prev, ...visibleIds])]);
    } else {
      const visibleIds = paginatedRequests.map(r => r.id);
      setSelectedRequestIds(prev => prev.filter(id => !visibleIds.includes(id)));
    }
  };

  const handleSelectRequest = (id) => {
    setSelectedRequestIds(prev =>
      prev.includes(id) ? prev.filter(reqId => reqId !== id) : [...prev, id]
    );
  };

  const handleBulkAssign = async () => {
    if (selectedRequestIds.length === 0) {
      alert('Please select at least one request to assign.');
      return;
    }

    if (!bulkMsl) {
      alert('Please select a Scientific Officer to assign.');
      return;
    }

    const confirmMsg = `Are you sure you want to assign ${selectedRequestIds.length} request(s) to ${bulkMsl}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsBulkAssigning(true);
      await requestService.bulkAssignRequests({
        request_ids: selectedRequestIds,
        assigned_msl: bulkMsl,
        assigned_by: user?.username || user?.employee_id || 'Manager'
      });
      alert(`Successfully assigned ${selectedRequestIds.length} request(s) to ${bulkMsl}`);
      setSelectedRequestIds([]);
      setBulkMsl('');
      await fetchRequests();
    } catch (error) {
      console.error('Error bulk assigning requests:', error);
      alert(error.response?.data?.detail || 'Failed to assign requests. Please try again.');
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const handleSaveDate = async (requestId) => {
    if (!editingDateValue) {
      alert('Please select a valid date.');
      return;
    }
    try {
      setIsSavingDate(true);
      await requestService.updateRequestDate(requestId, editingDateValue);
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, request_date: editingDateValue } : r));
      setEditingDateId(null);
      setEditingDateValue('');
    } catch (err) {
      console.error('Error updating request date:', err);
      alert(err.response?.data?.detail || 'Failed to update request date.');
    } finally {
      setIsSavingDate(false);
    }
  };

  if (loading) {
    return (
      <div className="req-loading-container">
        <div className="req-spinner"></div>
        <p className="req-loading-text">Loading requests...</p>
      </div>
    );
  }

  const isAllCurrentPageSelected =
    paginatedRequests.length > 0 &&
    paginatedRequests.every(r => selectedRequestIds.includes(r.id));

  return (
    <div className="request-list-container">
      {/* ── Page Header ── */}
      <div className="list-header">
        <div className="header-title-wrap">
          <div className="title-row">
            <h1>Scientific Office Requests</h1>
            <span className="count-pill">{filteredRequests.length}</span>
          </div>
          <p className="header-subtitle">Track, filter, and assign medical field requests</p>
        </div>

        <div className="header-actions">
          {/* View Mode Toggle */}
          <div className="view-toggle-wrap">
            <button
              type="button"
              className={`view-toggle-btn ${renderAsCards ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Card View"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              <span>Cards</span>
            </button>
            <button
              type="button"
              className={`view-toggle-btn ${!renderAsCards ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
              <span>Table</span>
            </button>
          </div>

          {canCreateRequest() && (
            <Link to="/requests/new" className="new-request-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>New Request</span>
            </Link>
          )}
        </div>
      </div>

      {/* ── Filters Card ── */}
      <div className="filters-card">
        {/* Top Search & Filter Toggles */}
        <div className="filters-search-row">
          <div className="search-input-wrap">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search doctor, requester, or MSL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearch('')}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="mobile-filter-buttons">
            <button
              type="button"
              className={`filter-collapse-btn ${showMobileFilters ? 'open' : ''} ${activeFiltersCount > 0 ? 'has-active' : ''}`}
              onClick={() => setShowMobileFilters(!showMobileFilters)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="active-count-tag">{activeFiltersCount}</span>
              )}
            </button>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                className="reset-filters-btn"
                onClick={handleResetFilters}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className={`filters-grid ${showMobileFilters ? 'mobile-visible' : ''}`}>
          <div className="filter-field">
            <label>Assignment</label>
            <select
              value={filterAssignment}
              onChange={(e) => setFilterAssignment(e.target.value)}
            >
              <option value="All">All Requests</option>
              <option value="Assigned">Assigned Only</option>
              <option value="Unassigned">Unassigned Only</option>
            </select>
          </div>

          <div className="filter-field">
            <label>Month</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            >
              <option value="">All Months</option>
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label>Year</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
            >
              <option value="">All Years</option>
              {['2026', '2025', '2024'].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label>Territory</label>
            <select
              value={filterTerritory}
              onChange={(e) => setFilterTerritory(e.target.value)}
            >
              <option value="">All Territories</option>
              {uniqueTerritories.map(t => (
                <option key={`terr-${t}`} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label>Region</label>
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
            >
              <option value="">All Regions</option>
              {uniqueRegions.map(r => (
                <option key={`reg-${r}`} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label>Therapy Area</label>
            <select
              value={filterTherapy}
              onChange={(e) => setFilterTherapy(e.target.value)}
            >
              <option value="">All Therapy</option>
              {uniqueTherapies.map(t => (
                <option key={`therapy-${t}`} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Bulk Assign Bar (Only for Authorized Roles) ── */}
      {canBulkAssign && (
        <div className="bulk-assign-bar">
          <div className="bulk-assign-info">
            <span className="selected-count-badge">
              {selectedRequestIds.length} selected
            </span>
            <span className="bulk-prompt">Assign to Scientific Officer:</span>
          </div>

          <div className="bulk-assign-controls">
            <select
              value={bulkMsl}
              onChange={(e) => setBulkMsl(e.target.value)}
              disabled={isBulkAssigning}
              className="bulk-assign-select"
            >
              <option value="">-- Choose Scientific Officer --</option>
              {mslList.map((msl) => (
                <option key={msl.id} value={msl.username}>
                  {msl.username} ({msl.role})
                </option>
              ))}
            </select>

            <button
              className="bulk-assign-btn"
              onClick={handleBulkAssign}
              disabled={isBulkAssigning || selectedRequestIds.length === 0 || !bulkMsl}
            >
              {isBulkAssigning ? 'Assigning...' : 'Assign Selected'}
            </button>

            {selectedRequestIds.length > 0 && (
              <button
                className="bulk-clear-btn"
                onClick={() => setSelectedRequestIds([])}
                disabled={isBulkAssigning}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Main Content Area ── */}
      {filteredRequests.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-icon">📂</div>
          <h3>No requests found</h3>
          <p>
            {activeFiltersCount > 0
              ? 'No requests match your current filters. Try resetting the filters.'
              : 'There are currently no requests available in the system.'}
          </p>
          {activeFiltersCount > 0 && (
            <button className="empty-reset-btn" onClick={handleResetFilters}>
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ================= CONDITIONAL RENDER: CARDS OR TABLE (Never both!) ================= */}
          {renderAsCards ? (
            /* MOBILE CARDS VIEW */
            <div className="mobile-cards-grid">
              {canBulkAssign && (
                <div className="mobile-select-all-bar">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={isAllCurrentPageSelected}
                      onChange={handleSelectAll}
                    />
                    <span>Select page ({paginatedRequests.length})</span>
                  </label>
                </div>
              )}

              {paginatedRequests.map((request) => (
                <div
                  key={`card-${request.id}`}
                  className={`request-card ${selectedRequestIds.includes(request.id) ? 'card-selected' : ''}`}
                >
                  <div className="card-header">
                    <div className="card-header-left">
                      {canBulkAssign && (
                        <input
                          type="checkbox"
                          checked={selectedRequestIds.includes(request.id)}
                          onChange={() => handleSelectRequest(request.id)}
                          className="card-checkbox"
                        />
                      )}
                      <span className="card-id-tag">#{request.id}</span>
                    </div>

                    <div className="card-header-right">
                      {request.assigned_msl ? (
                        <span className="badge-assigned">
                          <span className="dot online"></span>
                          {request.assigned_msl}
                        </span>
                      ) : (
                        <span className="badge-unassigned">
                          <span className="dot offline"></span>
                          Unassigned
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="card-doctor-info">
                      <h3 className="card-doctor-name">{request.doctor_name}</h3>
                      <div className="card-location">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <span>{[request.territory, request.region].filter(Boolean).join(' • ') || '—'}</span>
                      </div>
                    </div>

                    {request.objective && (
                      <div className="card-objective">
                        <span className="label">Objective:</span>
                        <p>{request.objective}</p>
                      </div>
                    )}

                    <div className="card-brands-row">
                      {request.brand && (
                        <div className="brand-chip">
                          <span className="brand-name">{request.brand}</span>
                          {request.rx_status_brand1 && (
                            <span className={`status-pill ${request.rx_status_brand1.toLowerCase()}`}>
                              {request.rx_status_brand1}
                            </span>
                          )}
                        </div>
                      )}
                      {request.brand2 && (
                        <div className="brand-chip">
                          <span className="brand-name">{request.brand2}</span>
                          {request.rx_status_brand2 && (
                            <span className={`status-pill ${request.rx_status_brand2.toLowerCase()}`}>
                              {request.rx_status_brand2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="card-meta-grid">
                      <div className="meta-item">
                        <span className="meta-label">Visits</span>
                        <span className="visits-count-pill">{request.num_visits ?? 0}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Requested By</span>
                        <span className="meta-value">{request.requested_by || '—'}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Request Date</span>
                        <div className="meta-value">
                          {canEditDate ? (
                            editingDateId === request.id ? (
                              <div className="inline-date-edit">
                                <input
                                  type="date"
                                  value={editingDateValue}
                                  onChange={(e) => setEditingDateValue(e.target.value)}
                                  className="date-input-mini"
                                />
                                <button
                                  className="date-action-btn check"
                                  onClick={() => handleSaveDate(request.id)}
                                  disabled={isSavingDate}
                                >
                                  ✓
                                </button>
                                <button
                                  className="date-action-btn cancel"
                                  onClick={() => {
                                    setEditingDateId(null);
                                    setEditingDateValue('');
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="date-display-trigger">
                                <span>{formatDate(request.request_date)}</span>
                                <button
                                  className="date-edit-btn"
                                  onClick={() => {
                                    setEditingDateId(request.id);
                                    setEditingDateValue(request.request_date ? request.request_date.split('T')[0] : '');
                                  }}
                                  title="Edit Date"
                                >
                                  ✏️
                                </button>
                              </div>
                            )
                          ) : (
                            <span>{formatDate(request.request_date)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card-footer">
                    <span className="created-text">Created: {formatDate(request.created_at)}</span>
                    <Link to={`/requests/${request.id}`} className="card-view-btn">
                      <span>View Details</span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* DESKTOP TABLE VIEW */
            <div className="table-container-card">
              <div className="table-responsive-wrapper">
                <table className="requests-table">
                  <thead>
                    <tr>
                      {canBulkAssign && (
                        <th style={{ width: '42px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isAllCurrentPageSelected}
                            onChange={handleSelectAll}
                            title="Select visible on page"
                          />
                        </th>
                      )}
                      <th>ID</th>
                      <th>Region</th>
                      <th>Territory</th>
                      <th>Doctor</th>
                      <th>Objective(s)</th>
                      <th>RX Status (Brand 1)</th>
                      <th>RX Status (Brand 2)</th>
                      <th>Brand(s)</th>
                      <th>Assigned To</th>
                      <th style={{ textAlign: 'center' }}>Visits</th>
                      <th>Requested By</th>
                      <th>Request Date</th>
                      <th>Created</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedRequests.map((request) => (
                      <tr key={request.id} className={selectedRequestIds.includes(request.id) ? 'row-selected' : ''}>
                        {canBulkAssign && (
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedRequestIds.includes(request.id)}
                              onChange={() => handleSelectRequest(request.id)}
                            />
                          </td>
                        )}
                        <td className="id-cell">#{request.id}</td>
                        <td>{request.region || '—'}</td>
                        <td>{request.territory || '—'}</td>
                        <td className="doctor-cell">
                          <strong>{request.doctor_name}</strong>
                        </td>
                        <td className="objective-cell">
                          {request.objective ? (
                            <>
                              {request.objective.substring(0, 48)}
                              {request.objective.length > 48 ? '...' : ''}
                            </>
                          ) : '—'}
                        </td>
                        <td>
                          {request.brand ? (
                            <span className={`status-pill ${(request.rx_status_brand1 || 'default').toLowerCase().replace(' ', '-')}`}>
                              {request.rx_status_brand1 || 'Default'}
                            </span>
                          ) : (
                            <span className="no-brand">—</span>
                          )}
                        </td>
                        <td>
                          {request.brand2 ? (
                            <span className={`status-pill ${(request.rx_status_brand2 || 'default').toLowerCase().replace(' ', '-')}`}>
                              {request.rx_status_brand2 || 'Default'}
                            </span>
                          ) : (
                            <span className="no-brand">—</span>
                          )}
                        </td>
                        <td className="brands-cell">
                          {request.brand && <div className="brand-text">{request.brand}</div>}
                          {request.brand2 && <div className="brand-text secondary">{request.brand2}</div>}
                          {!request.brand && !request.brand2 && '—'}
                        </td>
                        <td>
                          {request.assigned_msl ? (
                            <span className="badge-assigned">{request.assigned_msl}</span>
                          ) : (
                            <span className="badge-unassigned">Unassigned</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="visits-count-pill">{request.num_visits ?? 0}</span>
                        </td>
                        <td>{request.requested_by || '—'}</td>
                        <td className="date-cell">
                          {canEditDate ? (
                            editingDateId === request.id ? (
                              <div className="inline-date-edit">
                                <input
                                  type="date"
                                  value={editingDateValue}
                                  onChange={(e) => setEditingDateValue(e.target.value)}
                                  className="date-input-mini"
                                  disabled={isSavingDate}
                                />
                                <button
                                  className="date-action-btn check"
                                  onClick={() => handleSaveDate(request.id)}
                                  disabled={isSavingDate}
                                >
                                  ✓
                                </button>
                                <button
                                  className="date-action-btn cancel"
                                  onClick={() => {
                                    setEditingDateId(null);
                                    setEditingDateValue('');
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="date-display-trigger">
                                <span>{formatDate(request.request_date)}</span>
                                <button
                                  className="date-edit-btn"
                                  onClick={() => {
                                    setEditingDateId(request.id);
                                    setEditingDateValue(request.request_date ? request.request_date.split('T')[0] : '');
                                  }}
                                  title="Edit Date"
                                >
                                  ✏️
                                </button>
                              </div>
                            )
                          ) : (
                            <span>{formatDate(request.request_date)}</span>
                          )}
                        </td>
                        <td className="created-cell">{formatDate(request.created_at)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <Link to={`/requests/${request.id}`} className="view-table-btn">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Modern Fast Pagination Bar ── */}
          <div className="pagination-bar">
            <div className="pagination-info">
              Showing{' '}
              <strong>
                {filteredRequests.length === 0
                  ? 0
                  : (currentPage - 1) * pageSize + 1}
                -
                {pageSize === 0
                  ? filteredRequests.length
                  : Math.min(currentPage * pageSize, filteredRequests.length)}
              </strong>{' '}
              of <strong>{filteredRequests.length}</strong> requests
            </div>

            <div className="pagination-controls">
              <select
                className="page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
                <option value={0}>Show all</option>
              </select>

              {pageSize > 0 && totalPages > 1 && (
                <div className="page-nav-group">
                  <button
                    type="button"
                    className="page-nav-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  >
                    ‹ Prev
                  </button>

                  <span className="page-current-tag">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    className="page-nav-btn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  >
                    Next ›
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RequestList;
