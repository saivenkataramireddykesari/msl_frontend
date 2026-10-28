import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { tourPlanService } from '../services/api';
import '../styles/TourPlan.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const currentYear = new Date().getFullYear();
const FILTER_YEARS = [
  String(currentYear + 2),
  String(currentYear + 1),
  String(currentYear),
  String(currentYear - 1),
  String(currentYear - 2),
];

const CREATE_PLAN_YEARS = [
  String(currentYear),
  String(currentYear + 1),
  String(currentYear + 2),
  String(currentYear + 3),
  String(currentYear + 4),
];

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const TourPlan = () => {
  const { user } = useAuth();
  const todayDate = useMemo(() => getTodayDateString(), []);
  const canCreate = ['Asst General Manager', 'Admin', 'admin', 'Associate Vice President'].includes(user?.role);

  // Tour Plans List State
  const [tourPlans, setTourPlans] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');

  // Top Filter States for Tour Plans List
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Form Drawer / Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [meta, setMeta] = useState({ divisions: [], scientific_officers: [] });
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Form Inputs
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [planMonth, setPlanMonth] = useState(MONTH_NAMES[new Date().getMonth()]);
  const [planYear, setPlanYear] = useState(String(new Date().getFullYear()));
  const [selectedDivisions, setSelectedDivisions] = useState([]);
  const [divisionSearch, setDivisionSearch] = useState('');
  
  // Territories state
  const [availableTerritories, setAvailableTerritories] = useState([]);
  const [loadingTerritories, setLoadingTerritories] = useState(false);
  const [selectedTerritories, setSelectedTerritories] = useState([]);
  const [territorySearch, setTerritorySearch] = useState('');

  // Assigned SO and Remarks
  const [assignedSoId, setAssignedSoId] = useState('');
  const [assignedSoEmail, setAssignedSoEmail] = useState('');
  const [remarks, setRemarks] = useState('');

  const handleSoChange = (e) => {
    const id = e.target.value;
    setAssignedSoId(id);
    const found = meta.scientific_officers.find((so) => String(so.id) === String(id));
    if (found && found.email) {
      setAssignedSoEmail(found.email);
    } else {
      setAssignedSoEmail('');
    }
  };
  
  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successReport, setSuccessReport] = useState(null);
  const [selectedEmailPlan, setSelectedEmailPlan] = useState(null);

  // Expanded territory cards
  const [expandedCards, setExpandedCards] = useState({});

  // Fetch tour plans
  const fetchTourPlans = async () => {
    try {
      setLoadingList(true);
      setListError('');
      const params = {
        role: user?.role,
        username: user?.username,
        employee_id: user?.employee_id || user?.Emp_Code,
        division: user?.division || user?.Division,
        month: filterMonth || undefined,
        year: filterYear || undefined,
      };
      const res = await tourPlanService.getTourPlans(params);
      setTourPlans(res.data || []);
    } catch (err) {
      console.error('Error fetching tour plans:', err);
      setListError(err?.response?.data?.detail || 'Failed to load tour plans. Please refresh.');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchTourPlans();
  }, [filterMonth, filterYear, user]);

  // Fetch metadata when create modal is opened or user is AGM/Admin
  useEffect(() => {
    if (canCreate) {
      const loadMeta = async () => {
        try {
          setLoadingMeta(true);
          const res = await tourPlanService.getMeta();
          setMeta(res.data || { divisions: [], scientific_officers: [] });
        } catch (err) {
          console.error('Error loading metadata for tour plans:', err);
        } finally {
          setLoadingMeta(false);
        }
      };
      loadMeta();
    }
  }, [canCreate]);

  // Fetch territories dynamically whenever selectedDivisions changes
  useEffect(() => {
    if (selectedDivisions.length === 0) {
      setAvailableTerritories([]);
      setSelectedTerritories([]);
      return;
    }

    const loadTerritories = async () => {
      try {
        setLoadingTerritories(true);
        const res = await tourPlanService.getTerritories(selectedDivisions);
        const terrs = res.data || [];
        setAvailableTerritories(terrs);
        // Retain only currently selected territories that still exist in the updated list
        setSelectedTerritories((prev) => prev.filter((t) => terrs.includes(t)));
      } catch (err) {
        console.error('Error fetching territories:', err);
      } finally {
        setLoadingTerritories(false);
      }
    };

    loadTerritories();
  }, [selectedDivisions]);

  // Auto-sync month and year when fromDate changes
  const handleFromDateChange = (e) => {
    const val = e.target.value;
    setFromDate(val);
    if (val) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        setPlanMonth(MONTH_NAMES[d.getMonth()]);
        setPlanYear(String(d.getFullYear()));
      }
      if (toDate && toDate < val) {
        setToDate('');
      }
    }
  };

  // Month options for plan creation (only current and future months for current year)
  const availablePlanMonths = useMemo(() => {
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonthIdx = now.getMonth();
    const selectedYearNum = Number(planYear);

    if (selectedYearNum === currYear) {
      return MONTH_NAMES.filter((_, idx) => idx >= currMonthIdx);
    } else if (selectedYearNum > currYear) {
      return MONTH_NAMES;
    } else {
      return [MONTH_NAMES[currMonthIdx]];
    }
  }, [planYear]);

  // Handlers for month and year changes in creation form
  const handlePlanYearChange = (e) => {
    const selectedYear = e.target.value;
    setPlanYear(selectedYear);
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonthIdx = now.getMonth();
    if (Number(selectedYear) === currYear) {
      const selectedMonthIdx = MONTH_NAMES.indexOf(planMonth);
      if (selectedMonthIdx !== -1 && selectedMonthIdx < currMonthIdx) {
        setPlanMonth(MONTH_NAMES[currMonthIdx]);
      }
    }
    if (fromDate) {
      const d = new Date(fromDate);
      if (!isNaN(d.getTime()) && String(d.getFullYear()) !== selectedYear) {
        setFromDate('');
        setToDate('');
      }
    }
  };

  const handlePlanMonthChange = (e) => {
    const newMonth = e.target.value;
    setPlanMonth(newMonth);
    if (fromDate) {
      const d = new Date(fromDate);
      if (!isNaN(d.getTime()) && MONTH_NAMES[d.getMonth()] !== newMonth) {
        setFromDate('');
        setToDate('');
      }
    }
  };

  // Division select handlers
  const handleToggleDivision = (div) => {
    setSelectedDivisions((prev) =>
      prev.includes(div) ? prev.filter((d) => d !== div) : [...prev, div]
    );
  };

  const handleSelectAllDivisions = () => {
    setSelectedDivisions(meta.divisions || []);
  };

  const handleClearAllDivisions = () => {
    setSelectedDivisions([]);
  };

  // Territory select handlers
  const handleToggleTerritory = (terr) => {
    setSelectedTerritories((prev) =>
      prev.includes(terr) ? prev.filter((t) => t !== terr) : [...prev, terr]
    );
  };

  const handleSelectAllTerritories = () => {
    setSelectedTerritories(availableTerritories || []);
  };

  const handleClearAllTerritories = () => {
    setSelectedTerritories([]);
  };

  // Create form submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!fromDate || !toDate) {
      setFormError('Please select both From Date and To Date.');
      return;
    }
    const todayStr = getTodayDateString();
    if (fromDate < todayStr) {
      setFormError('From Date cannot be in the past. Please select today or a future date.');
      return;
    }
    if (fromDate > toDate) {
      setFormError('From Date cannot be later than To Date.');
      return;
    }
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonthIdx = now.getMonth();
    const selectedYearNum = Number(planYear);
    const selectedMonthIdx = MONTH_NAMES.indexOf(planMonth);

    if (
      selectedYearNum < currYear ||
      (selectedYearNum === currYear && selectedMonthIdx < currMonthIdx)
    ) {
      setFormError('Month and Year cannot be in the past. Please select the current or a future month and year.');
      return;
    }
    if (selectedDivisions.length === 0) {
      setFormError('Please select at least one Division.');
      return;
    }
    if (selectedTerritories.length === 0) {
      setFormError('Please select at least one Territory.');
      return;
    }
    if (!assignedSoId) {
      setFormError('Please assign this plan to a Scientific Officer.');
      return;
    }

    if (!assignedSoEmail || !assignedSoEmail.trim()) {
      setFormError('Please enter an email address for the assigned Scientific Officer to receive tour notifications.');
      return;
    }

    const selectedSO = meta.scientific_officers.find(
      (so) => String(so.id) === String(assignedSoId)
    );

    const payload = {
      month: planMonth,
      year: planYear,
      from_date: fromDate,
      to_date: toDate,
      divisions: selectedDivisions,
      territories: selectedTerritories,
      assigned_so: selectedSO?.name || 'Assigned SO',
      assigned_so_id: selectedSO?.id || null,
      assigned_so_code: selectedSO?.employee_code || null,
      assigned_so_email: assignedSoEmail.trim(),
      created_by: user?.username || 'Asst General Manager',
      created_by_emp_code: user?.employee_id || user?.Emp_Code || '',
      created_by_role: user?.role || 'Asst General Manager',
      remarks: remarks.trim() || undefined,
    };

    try {
      setSubmitting(true);
      const res = await tourPlanService.createTourPlan(
        payload,
        user?.role,
        user?.username
      );

      setSuccessReport(res.data);
      // Reset form fields
      setFromDate('');
      setToDate('');
      setPlanMonth(MONTH_NAMES[new Date().getMonth()]);
      setPlanYear(String(new Date().getFullYear()));
      setSelectedDivisions([]);
      setSelectedTerritories([]);
      setAssignedSoId('');
      setAssignedSoEmail('');
      setRemarks('');
      // Refresh list
      fetchTourPlans();
    } catch (err) {
      console.error('Error creating tour plan:', err);
      setFormError(
        err?.response?.data?.detail || 'Failed to create tour plan. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Tour Plan
  const handleDeletePlan = async (id) => {
    if (!window.confirm('Are you sure you want to delete this tour plan?')) return;
    try {
      await tourPlanService.deleteTourPlan(id, user?.role);
      fetchTourPlans();
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to delete tour plan.');
    }
  };

  // Filtered divisions and territories inside the form
  const filteredDivisionsList = useMemo(() => {
    if (!divisionSearch.trim()) return meta.divisions;
    return meta.divisions.filter((d) =>
      d.toLowerCase().includes(divisionSearch.toLowerCase())
    );
  }, [meta.divisions, divisionSearch]);

  const filteredTerritoriesList = useMemo(() => {
    if (!territorySearch.trim()) return availableTerritories;
    return availableTerritories.filter((t) =>
      t.toLowerCase().includes(territorySearch.toLowerCase())
    );
  }, [availableTerritories, territorySearch]);

  // Client-side filtering of tour plans list
  const filteredTourPlans = useMemo(() => {
    return tourPlans.filter((plan) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const soMatch = (plan.assigned_so || '').toLowerCase().includes(term);
      const creatorMatch = (plan.created_by || '').toLowerCase().includes(term);
      const divMatch = (plan.divisions || []).some((d) => d.toLowerCase().includes(term));
      const terrMatch = (plan.territories || []).some((t) => t.toLowerCase().includes(term));
      return soMatch || creatorMatch || divMatch || terrMatch;
    });
  }, [tourPlans, searchTerm]);

  // Unique divisions count across loaded plans
  const totalDivisionsCovered = useMemo(() => {
    const s = new Set();
    tourPlans.forEach((p) => {
      (p.divisions || []).forEach((d) => s.add(d));
    });
    return s.size;
  }, [tourPlans]);

  // Unique SO count
  const totalAssignedSOs = useMemo(() => {
    const s = new Set();
    tourPlans.forEach((p) => {
      if (p.assigned_so) s.add(p.assigned_so);
    });
    return s.size;
  }, [tourPlans]);

  const toggleExpandCard = (id) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getStatusBadge = (fromDateStr, toDateStr) => {
    const today = todayDate;
    if (today < fromDateStr) {
      return <span className="tp-status-badge scheduled">Scheduled</span>;
    } else if (today >= fromDateStr && today <= toDateStr) {
      return <span className="tp-status-badge in-progress">In Progress</span>;
    } else {
      return <span className="tp-status-badge completed">Completed</span>;
    }
  };

  const renderEmailDeliveryDetails = (emailData, planData) => {
    if (!emailData) {
      return (
        <div className="tp-email-dispatch-section">
          <div className="tp-email-dispatch-header">
            <div className="tp-email-header-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <h4>Email Dispatch Status</h4>
            </div>
            <span className="tp-status-pill not-sent">No email logs found</span>
          </div>
        </div>
      );
    }

    const so = emailData.scientific_officer;
    const blList = emailData.business_leaders || [];

    const soSent = so?.status === 'sent';
    const soFailed = so?.status === 'failed';
    const soSkipped = !soSent && !soFailed;

    const blSentCount = blList.filter((b) => b.status === 'sent').length;
    const blFailedCount = blList.filter((b) => b.status === 'failed').length;
    const blSkippedCount = blList.filter((b) => b.status !== 'sent' && b.status !== 'failed').length;

    const totalRecipients = (so ? 1 : 0) + blList.length;
    const totalSent = (soSent ? 1 : 0) + blSentCount;
    const totalFailed = (soFailed ? 1 : 0) + blFailedCount;
    const totalSkipped = (soSkipped ? 1 : 0) + blSkippedCount;

    const isAllSent = totalSent > 0 && totalFailed === 0 && totalSkipped === 0;
    const isNoneSent = totalSent === 0;

    return (
      <div className="tp-email-dispatch-section">
        <div className="tp-email-dispatch-header">
          <div className="tp-email-header-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <h4>Email Notification Dispatch</h4>
          </div>
          <div className="tp-email-header-badge">
            {isAllSent ? (
              <span className="tp-status-pill success">
                ✓ All {totalSent} Emails Sent
              </span>
            ) : isNoneSent ? (
              <span className="tp-status-pill not-sent">
                ✕ 0 Sent ({totalSkipped} Skipped{totalFailed > 0 ? `, ${totalFailed} Failed` : ''})
              </span>
            ) : (
              <span className="tp-status-pill warning">
                ⚠ {totalSent} of {totalRecipients} Sent ({totalSkipped} Skipped{totalFailed > 0 ? `, ${totalFailed} Failed` : ''})
              </span>
            )}
          </div>
        </div>

        <div className="tp-recipients-list">
          {/* Scientific Officer Recipient */}
          <div className="tp-recipient-card">
            <div className="tp-recipient-info">
              <div className="tp-recipient-top">
                <span className="tp-recipient-role-tag so">Scientific Officer</span>
                <span className="tp-recipient-name">
                  {so?.name || planData?.assigned_so || 'Scientific Officer'}
                </span>
              </div>
              <div className="tp-recipient-email">
                {so?.email ? (
                  <span>✉ {so.email}</span>
                ) : (
                  <span className="tp-no-email">No registered email address</span>
                )}
              </div>
            </div>
            <div className="tp-recipient-status">
              {so?.status === 'sent' ? (
                <span className="tp-status-pill success" title="Notification delivered to SO">
                  ✓ Email Sent{so.simulated ? ' (Simulated)' : ''}
                </span>
              ) : so?.status === 'failed' ? (
                <span className="tp-status-pill error" title={so.error || 'Failed to send email'}>
                  ✕ Failed
                </span>
              ) : (
                <span className="tp-status-pill skipped" title={so?.reason || 'No email address registered'}>
                  ⚠ Not Sent (No Email)
                </span>
              )}
            </div>
          </div>

          {/* Business Leaders Recipients */}
          <div className="tp-bl-recipients-section">
            <div className="tp-bl-section-title">
              Business Leaders of Covered Divisions ({blList.length})
            </div>

            {blList.length === 0 ? (
              <div className="tp-no-bl-msg">
                No Business Leaders found for the selected division(s){planData?.divisions ? ` (${(planData.divisions || []).join(', ')})` : ''}.
              </div>
            ) : (
              blList.map((bl, idx) => (
                <div key={idx} className="tp-recipient-card">
                  <div className="tp-recipient-info">
                    <div className="tp-recipient-top">
                      <span className="tp-recipient-role-tag bl">
                        {bl.division ? `BL • ${bl.division}` : 'Business Leader'}
                      </span>
                      <span className="tp-recipient-name">{bl.name}</span>
                    </div>
                    <div className="tp-recipient-email">
                      {bl.email ? (
                        <span>✉ {bl.email}</span>
                      ) : (
                        <span className="tp-no-email">No registered email address</span>
                      )}
                    </div>
                  </div>
                  <div className="tp-recipient-status">
                    {bl.status === 'sent' ? (
                      <span className="tp-status-pill success" title="Notification delivered to Business Leader">
                        ✓ Email Sent{bl.simulated ? ' (Simulated)' : ''}
                      </span>
                    ) : bl.status === 'failed' ? (
                      <span className="tp-status-pill error" title={bl.error || 'Failed to send email'}>
                        ✕ Failed
                      </span>
                    ) : (
                      <span className="tp-status-pill skipped" title={bl.reason || 'No email address registered'}>
                        ⚠ Not Sent (No Email)
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="tour-plan-container">
      {/* Top Header */}
      <div className="tp-page-header">
        <div className="tp-header-left">
          <div className="tp-title-row">
            <span className="tp-title-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <div>
              <h1 className="tp-title">Tour Plan Management</h1>
              <p className="tp-subtitle">
                {canCreate
                  ? 'Plan monthly field tours, select divisions & territories, assign to Scientific Officers, and notify teams.'
                  : user?.role === 'BL'
                  ? `Viewing monthly tour plans scheduled for your division (${user?.division || 'BL'}).`
                  : `Viewing monthly tour plans assigned to you (${user?.username || 'Scientific Officer'}).`}
              </p>
            </div>
          </div>
        </div>

        <div className="tp-header-actions">
          {canCreate && (
            <button
              className="tp-btn-primary create-plan-btn"
              onClick={() => {
                setSuccessReport(null);
                setFormError('');
                setFromDate('');
                setToDate('');
                setPlanMonth(MONTH_NAMES[new Date().getMonth()]);
                setPlanYear(String(new Date().getFullYear()));
                setShowCreateModal(true);
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Create Tour Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* Role specific banner if BL or SO */}
      {!canCreate && (
        <div className="tp-role-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span>
            {user?.role === 'BL'
              ? `You are logged in as Business Leader (${user?.username || user?.Emp_Name}). You will receive email alerts and can view all tour plans scheduled for your division.`
              : `You are logged in as Scientific Officer (${user?.username || user?.Emp_Name}). You can view all tour plans assigned to you.`}
          </span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="tp-stats-grid">
        <div className="tp-stat-card">
          <div className="tp-stat-icon purple">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="tp-stat-details">
            <span className="tp-stat-label">Total Tour Plans</span>
            <span className="tp-stat-value">{tourPlans.length}</span>
          </div>
        </div>

        <div className="tp-stat-card">
          <div className="tp-stat-icon blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div className="tp-stat-details">
            <span className="tp-stat-label">Divisions Covered</span>
            <span className="tp-stat-value">{totalDivisionsCovered}</span>
          </div>
        </div>

        <div className="tp-stat-card">
          <div className="tp-stat-icon emerald">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="tp-stat-details">
            <span className="tp-stat-label">Scientific Officers</span>
            <span className="tp-stat-value">{totalAssignedSOs}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="tp-filters-card">
        <div className="tp-filters-row">
          <div className="tp-search-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by SO name, division, territory, creator..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="tp-search-input"
            />
            {searchTerm && (
              <button className="tp-clear-search" onClick={() => setSearchTerm('')}>
                ✕
              </button>
            )}
          </div>

          <div className="tp-select-wrap">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="tp-select"
            >
              <option value="">All Months</option>
              {MONTH_NAMES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="tp-select-wrap">
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="tp-select"
            >
              <option value="">All Years</option>
              {FILTER_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {(filterMonth || filterYear || searchTerm) && (
            <button
              className="tp-btn-secondary reset-filter-btn"
              onClick={() => {
                setFilterMonth('');
                setFilterYear('');
                setSearchTerm('');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Tour Plans List */}
      {loadingList ? (
        <div className="tp-loading-state">
          <div className="tp-spinner"></div>
          <p>Loading tour plans...</p>
        </div>
      ) : listError ? (
        <div className="tp-error-state">
          <p>{listError}</p>
          <button className="tp-btn-secondary" onClick={fetchTourPlans}>
            Try Again
          </button>
        </div>
      ) : filteredTourPlans.length === 0 ? (
        <div className="tp-empty-state">
          <div className="tp-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <h3>No Tour Plans Found</h3>
          <p>
            {searchTerm || filterMonth || filterYear
              ? 'No tour plans match your selected search or filter criteria.'
              : canCreate
              ? 'No tour plans have been created yet. Click "Create Tour Plan" above to create the first monthly plan.'
              : 'There are no active tour plans assigned to your division or account.'}
          </p>
          {canCreate && !searchTerm && !filterMonth && (
            <button
              className="tp-btn-primary"
              onClick={() => {
                setSuccessReport(null);
                setFormError('');
                setFromDate('');
                setToDate('');
                setPlanMonth(MONTH_NAMES[new Date().getMonth()]);
                setPlanYear(String(new Date().getFullYear()));
                setShowCreateModal(true);
              }}
            >
              + Create Tour Plan
            </button>
          )}
        </div>
      ) : (
        <div className="tp-cards-grid">
          {filteredTourPlans.map((plan) => {
            const isExpanded = !!expandedCards[plan.id];
            const displayedTerritories = isExpanded
              ? plan.territories || []
              : (plan.territories || []).slice(0, 6);
            const remainingCount = (plan.territories || []).length - 6;

            return (
              <div key={plan.id} className="tp-card">
                <div className="tp-card-header">
                  <div className="tp-card-date-badge">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                    </svg>
                    <span>
                      {plan.from_date} &rarr; {plan.to_date}
                    </span>
                  </div>
                  <div className="tp-card-header-actions">
                    {getStatusBadge(plan.from_date, plan.to_date)}
                    {canCreate && (
                      <button
                        className="tp-card-del-btn"
                        onClick={() => handleDeletePlan(plan.id)}
                        title="Delete Tour Plan"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="tp-card-body">
                  <div className="tp-month-indicator">
                    <span className="tp-month-text">
                      {plan.month} {plan.year}
                    </span>
                  </div>

                  {/* Assigned Scientific Officer */}
                  <div className="tp-so-chip">
                    <div className="tp-so-avatar">
                      {plan.assigned_so ? plan.assigned_so.charAt(0).toUpperCase() : 'S'}
                    </div>
                    <div className="tp-so-info">
                      <span className="tp-so-role">Assigned Scientific Officer</span>
                      <span className="tp-so-name">
                        {plan.assigned_so}
                        {plan.assigned_so_code ? ` (${plan.assigned_so_code})` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Divisions Section */}
                  <div className="tp-card-section">
                    <span className="tp-section-heading">
                      Divisions ({(plan.divisions || []).length}):
                    </span>
                    <div className="tp-chips-wrap">
                      {(plan.divisions || []).map((div) => (
                        <span key={div} className="tp-division-chip">
                          {div}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Territories Section */}
                  <div className="tp-card-section">
                    <span className="tp-section-heading">
                      Territories ({(plan.territories || []).length}):
                    </span>
                    <div className="tp-chips-wrap">
                      {displayedTerritories.map((terr) => (
                        <span key={terr} className="tp-territory-chip">
                          {terr}
                        </span>
                      ))}
                      {!isExpanded && remainingCount > 0 && (
                        <button
                          type="button"
                          className="tp-chip-expand-btn"
                          onClick={() => toggleExpandCard(plan.id)}
                        >
                          +{remainingCount} more
                        </button>
                      )}
                      {isExpanded && (plan.territories || []).length > 6 && (
                        <button
                          type="button"
                          className="tp-chip-expand-btn collapse"
                          onClick={() => toggleExpandCard(plan.id)}
                        >
                          Show less
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Remarks */}
                  {plan.remarks && (
                    <div className="tp-card-remarks">
                      <span className="tp-remarks-label">Notes/Objectives:</span>
                      <p className="tp-remarks-text">{plan.remarks}</p>
                    </div>
                  )}

                  {/* Email Dispatch Info if available */}
                  {plan.email_status && (
                    <div className="tp-card-email-info">
                      <div className="tp-card-email-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                        <span>
                          {plan.email_status.stats
                            ? `${plan.email_status.stats.total_sent} of ${plan.email_status.stats.total_recipients} emails sent`
                            : 'Email notifications processed'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="tp-card-email-details-link"
                        onClick={() => setSelectedEmailPlan(plan)}
                      >
                        Email Details &rarr;
                      </button>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="tp-card-footer">
                  <span className="tp-created-by">
                    Created by <strong>{plan.created_by || 'AGM'}</strong> (
                    {plan.created_by_role || 'Asst General Manager'})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE TOUR PLAN MODAL (For Asst General Manager / Admin) */}
      {showCreateModal && (
        <div className="tp-modal-overlay">
          <div className="tp-modal-dialog">
            <div className="tp-modal-header">
              <div className="tp-modal-title-group">
                <span className="tp-modal-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <div>
                  <h2 className="tp-modal-title">Create Monthly Tour Plan</h2>
                  <p className="tp-modal-subtitle">
                    Assign field coverage to Scientific Officer & send notifications to relevant BLs.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="tp-modal-close"
                onClick={() => {
                  if (!submitting) setShowCreateModal(false);
                }}
              >
                ✕
              </button>
            </div>

            {/* Success Report View */}
            {successReport ? (() => {
              const planData = successReport.plan || successReport;
              const emailData = successReport.emails_triggered || successReport.notifications || planData.email_status || {};

              return (
                <div className="tp-success-report">
                  <div className="tp-success-icon-wrap">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3>Tour Plan Created Successfully!</h3>
                  <p className="tp-success-subtext">
                    The monthly plan has been saved and notification emails were triggered.
                  </p>

                  <div className="tp-report-box">
                    <div className="tp-report-row">
                      <span className="tp-report-key">Assigned Scientific Officer:</span>
                      <span className="tp-report-val">
                        {planData.assigned_so}
                      </span>
                    </div>
                    <div className="tp-report-row">
                      <span className="tp-report-key">Tour Duration:</span>
                      <span className="tp-report-val">
                        {planData.from_date} to {planData.to_date} ({planData.month} {planData.year})
                      </span>
                    </div>
                    <div className="tp-report-row">
                      <span className="tp-report-key">Divisions Covered:</span>
                      <span className="tp-report-val">
                        {(planData.divisions || []).join(', ')}
                      </span>
                    </div>
                    <div className="tp-report-row">
                      <span className="tp-report-key">Territories Count:</span>
                      <span className="tp-report-val">
                        {(planData.territories || []).length} Territories
                      </span>
                    </div>
                  </div>

                  {/* Comprehensive Email Notification Breakdown */}
                  {renderEmailDeliveryDetails(emailData, planData)}

                  <div className="tp-report-actions">
                    <button
                      className="tp-btn-primary"
                      onClick={() => {
                        setSuccessReport(null);
                        setShowCreateModal(false);
                      }}
                    >
                      Done & View Tour Plans
                    </button>
                    <button
                      className="tp-btn-secondary"
                      onClick={() => {
                        setSuccessReport(null);
                        setFromDate('');
                        setToDate('');
                        setPlanMonth(MONTH_NAMES[new Date().getMonth()]);
                        setPlanYear(String(new Date().getFullYear()));
                        setAssignedSoEmail('');
                      }}
                    >
                      Create Another Tour Plan
                    </button>
                  </div>
                </div>
              );
            })() : (
              <form onSubmit={handleCreateSubmit} className="tp-modal-form">
                {formError && (
                  <div className="tp-form-alert error">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{formError}</span>
                  </div>
                )}

                {/* Date Fields & Month */}
                <div className="tp-form-row two-cols">
                  <div className="tp-form-group">
                    <label className="tp-label required">From Date</label>
                    <input
                      type="date"
                      value={fromDate}
                      min={todayDate}
                      onChange={handleFromDateChange}
                      required
                      className="tp-input"
                    />
                  </div>

                  <div className="tp-form-group">
                    <label className="tp-label required">To Date</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      min={fromDate || todayDate}
                      required
                      className="tp-input"
                    />
                  </div>
                </div>

                <div className="tp-form-row two-cols">
                  <div className="tp-form-group">
                    <label className="tp-label required">Month</label>
                    <select
                      value={planMonth}
                      onChange={handlePlanMonthChange}
                      className="tp-input"
                    >
                      {availablePlanMonths.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="tp-form-group">
                    <label className="tp-label required">Year</label>
                    <select
                      value={planYear}
                      onChange={handlePlanYearChange}
                      className="tp-input"
                    >
                      {CREATE_PLAN_YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Division Selection */}
                <div className="tp-form-group">
                  <div className="tp-group-header">
                    <label className="tp-label required">
                      Select Divisions ({selectedDivisions.length} selected)
                    </label>
                    <div className="tp-quick-actions">
                      <button
                        type="button"
                        onClick={handleSelectAllDivisions}
                        className="tp-action-link"
                      >
                        Select All
                      </button>
                      <span className="tp-action-sep">•</span>
                      <button
                        type="button"
                        onClick={handleClearAllDivisions}
                        className="tp-action-link"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="tp-sub-search">
                    <input
                      type="text"
                      placeholder="Search divisions..."
                      value={divisionSearch}
                      onChange={(e) => setDivisionSearch(e.target.value)}
                      className="tp-sub-input"
                    />
                  </div>

                  <div className="tp-selector-box">
                    {loadingMeta ? (
                      <p className="tp-loading-text">Loading divisions...</p>
                    ) : filteredDivisionsList.length === 0 ? (
                      <p className="tp-empty-hint">No divisions found</p>
                    ) : (
                      <div className="tp-checkbox-grid">
                        {filteredDivisionsList.map((div) => {
                          const isChecked = selectedDivisions.includes(div);
                          return (
                            <label
                              key={div}
                              className={`tp-checkbox-item ${isChecked ? 'active' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleDivision(div)}
                              />
                              <span className="tp-checkbox-label">{div}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Territories Selection (Cascading based on Divisions) */}
                <div className="tp-form-group">
                  <div className="tp-group-header">
                    <label className="tp-label required">
                      Select Territories ({selectedTerritories.length} selected)
                    </label>
                    {availableTerritories.length > 0 && (
                      <div className="tp-quick-actions">
                        <button
                          type="button"
                          onClick={handleSelectAllTerritories}
                          className="tp-action-link"
                        >
                          Select All ({availableTerritories.length})
                        </button>
                        <span className="tp-action-sep">•</span>
                        <button
                          type="button"
                          onClick={handleClearAllTerritories}
                          className="tp-action-link"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {selectedDivisions.length === 0 ? (
                    <div className="tp-hint-banner">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      <span>Please select at least one Division above to view and choose territories.</span>
                    </div>
                  ) : (
                    <>
                      <div className="tp-sub-search">
                        <input
                          type="text"
                          placeholder="Search territories..."
                          value={territorySearch}
                          onChange={(e) => setTerritorySearch(e.target.value)}
                          className="tp-sub-input"
                        />
                      </div>

                      <div className="tp-selector-box territory-box">
                        {loadingTerritories ? (
                          <div className="tp-loading-text">
                            <span className="tp-spinner small"></span> Loading territories for selected divisions...
                          </div>
                        ) : filteredTerritoriesList.length === 0 ? (
                          <p className="tp-empty-hint">No territories found for selected divisions.</p>
                        ) : (
                          <div className="tp-checkbox-grid">
                            {filteredTerritoriesList.map((terr) => {
                              const isChecked = selectedTerritories.includes(terr);
                              return (
                                <label
                                  key={terr}
                                  className={`tp-checkbox-item ${isChecked ? 'active' : ''}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleTerritory(terr)}
                                  />
                                  <span className="tp-checkbox-label">{terr}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Assign to Scientific Officer */}
                <div className="tp-form-group">
                  <label className="tp-label required">Assign to Scientific Officer</label>
                  <select
                    value={assignedSoId}
                    onChange={handleSoChange}
                    required
                    className="tp-input"
                  >
                    <option value="">-- Choose Scientific Officer --</option>
                    {meta.scientific_officers.map((so) => (
                      <option key={so.id} value={so.id}>
                        {so.name} {so.employee_code ? `(${so.employee_code})` : ''} {so.email ? `(${so.email})` : '(No Email Registered)'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scientific Officer Email */}
                <div className="tp-form-group">
                  <div className="tp-label-with-badge">
                    <label className="tp-label required">Scientific Officer Email</label>
                    <span className="tp-label-subtext">Required for tour plan dispatch</span>
                  </div>
                  <input
                    type="email"
                    value={assignedSoEmail}
                    onChange={(e) => setAssignedSoEmail(e.target.value)}
                    placeholder="Enter email address (e.g. name@pulsepharma.net or gmail)"
                    required
                    className="tp-input"
                  />
                  {assignedSoId && !assignedSoEmail && (
                    <p className="tp-field-hint warning">
                      ⚠ This Scientific Officer has no registered email. Enter an email address above to dispatch the notification and save it.
                    </p>
                  )}
                </div>

                {/* Remarks */}
                <div className="tp-form-group">
                  <label className="tp-label">Notes & Field Objectives (Optional)</label>
                  <textarea
                    rows="3"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter key objectives, focused doctors, or scientific agenda for this tour..."
                    className="tp-textarea"
                  />
                </div>

                {/* Form Actions */}
                <div className="tp-modal-footer">
                  <button
                    type="button"
                    className="tp-btn-secondary"
                    onClick={() => setShowCreateModal(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="tp-btn-primary submit-btn"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="tp-spinner small"></span>
                        <span>Dispatching & Sending Emails...</span>
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Create Plan & Trigger Emails</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* EMAIL NOTIFICATIONS MODAL (For reviewing email dispatch breakdown anytime) */}
      {selectedEmailPlan && (
        <div className="tp-modal-overlay">
          <div className="tp-modal-dialog">
            <div className="tp-modal-header">
              <div className="tp-modal-title-group">
                <span className="tp-modal-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <div>
                  <h2 className="tp-modal-title">Email Notification Details</h2>
                  <p className="tp-modal-subtitle">
                    Tour Plan: {selectedEmailPlan.from_date} &rarr; {selectedEmailPlan.to_date} ({selectedEmailPlan.month} {selectedEmailPlan.year})
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="tp-modal-close"
                onClick={() => setSelectedEmailPlan(null)}
              >
                ✕
              </button>
            </div>
            <div className="tp-modal-body-scroll">
              {renderEmailDeliveryDetails(selectedEmailPlan.email_status, selectedEmailPlan)}
            </div>
            <div className="tp-modal-footer">
              <button
                type="button"
                className="tp-btn-primary"
                onClick={() => setSelectedEmailPlan(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TourPlan;
