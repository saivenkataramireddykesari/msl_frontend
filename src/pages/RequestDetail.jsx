import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestService, interactionService, userService } from '../services/api';
import '../styles/RequestDetail.css';

// const STATUSES = ['default', 'potential', 'non-potential'];

const BRAND_OPTIONS = [
  'Aztor',
  'Aztor-EZ',
  'Azsita',
  'Novastat',
  'Novastat-EZ',
  'Rosave',
  'Rosave-C',
  'Rosave-Trio',
  'Rozucor',
  'Other',
];

const INTEREST_LEVEL_OPTIONS = ['Low', 'Moderate', 'High', 'Very High'];

const OUTCOME_OPTIONS = [
  'doctor appreciated the discussion',
  'doctor posted scientific query',
  'doctor asked to meet again',
  'doctor likely to be associated with pulse',
  'RX prescription initiated',
  'no response',
];

const RequestDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [request, setRequest] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [doctorHistory, setDoctorHistory] = useState([]); // visits by OTHER MSLs to same doctor
  const [selectedVisitReport, setSelectedVisitReport] = useState(null); // popup for previous MSL report

  // Assignment states
  const [mslList, setMslList] = useState([]);
  const [selectedMsl, setSelectedMsl] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState(null);
  // Previous MSL activity panel
  const [prevMslPanel, setPrevMslPanel] = useState(null); // { mslName, visits[] }

  // Form states
  const [interactionForm, setInteractionForm] = useState({
    doctor_name: '',
    visit_date: new Date().toISOString().split('T')[0],
    topics_discussed: '',
    summary: '',
    outcomes: '',
    brand_discussed: '',
    brand2_discussed: '', // Legacy field
    brand2_topics: '',    // Legacy field
    brand2_summary: '',   // Legacy field
    brand2_outcomes: '',  // Legacy field
    interest_level: '',
    brand2_interest_level: '', // Legacy field
    objections: '',
    insights_for_marketing: '',
    // New dynamic brands array - each brand has its own objective and insights
    brands: [
      {
        brand_name: '',
        objective: '',
        insights_marketing: '',
        topics_discussed: '',
        summary: '',
        outcomes: '',
        interest_level: ''
      }
    ]
  });

  // Roles that can assign/reassign requests
  const isManager = [
    'Asst General Manager', 'Associate Vice President', 'SBUH/BH'
  ].includes(user?.role);

  useEffect(() => {
    fetchRequestData();
  }, [id]);

  useEffect(() => {
    if (isManager) {
      fetchMslUsers();
    }
  }, [user]);

  const fetchMslUsers = async () => {
    try {
      // Use /api/users and filter client-side for broad compatibility
      const res = await userService.getUsers();
      const msls = res.data.filter(u => ['MSL', 'Scientific Officer'].includes(u.role));
      setMslList(msls);
    } catch (err) {
      console.error('Error fetching MSLs:', err);
    }
  };

  const handleViewPrevMslActivity = (mslName) => {
    const visits = doctorHistory.filter(h => h.logged_by === mslName);
    setPrevMslPanel({ mslName, visits });
  };

  const handleAssignMsl = async (e) => {
    e.preventDefault();
    try {
      setIsAssigning(true);
      await requestService.assignRequest(id, {
        assigned_msl: selectedMsl || null,
        assigned_by: user?.username
      });
      alert('Assignment updated successfully!');
      fetchRequestData();
    } catch (error) {
      console.error('Error assigning request:', error);
      alert('Failed to update assignment');
    } finally {
      setIsAssigning(false);
    }
  };

  const fetchRequestData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [requestRes, logsRes] = await Promise.all([
        requestService.getRequest(id, { role: user?.role, username: user?.username }),
        requestService.getLogs(id),
      ]);
      const requestData = requestRes.data;
      // Map user_classification to status for UI consistency
      if (requestData.user_classification) {
        requestData.status = requestData.user_classification;
      }
      setRequest(requestData);
      setSelectedMsl(requestData.assigned_msl || '');
      console.log('Logs data:', logsRes.data);
      setLogs(logsRes.data);

      // Pre-fill doctor name for interaction form
      if (requestRes.data.doctor) {
        const doctorName = requestRes.data.doctor.name;
        setInteractionForm((prev) => ({
          ...prev,
          doctor_name: doctorName,
        }));
        // Fetch cross-MSL visit history for this doctor
        try {
          const historyRes = await interactionService.getDoctorHistory(doctorName);
          setDoctorHistory(historyRes.data);
        } catch (err) {
          console.error('Could not fetch doctor history:', err);
        }
      }
    } catch (error) {
      console.error('Error fetching request:', error);
      if (error.response && error.response.status === 403) {
        setError("Access Denied: You are not assigned to this request.");
      } else {
        setError(error.response?.data?.detail || "Request not found");
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle status change with enhanced error handling
   * @param {string} newStatus - The new status value ('potential', 'non-potential', 'default')
   */
  const handleStatusChange = async (newStatus) => {
    try {
      // Call the API service to update status
      const response = await requestService.updateStatus(id, newStatus);

      // Update local state on success
      setRequest((prev) => ({ ...prev, status: newStatus }));

      // Show success feedback (optional - can be removed for production)
      console.log('Status updated successfully:', response.data);
    } catch (error) {
      // Enhanced error handling with specific messages
      let errorMessage = 'Failed to update status';

      if (error.response) {
        // Server responded with error status
        const { status, data } = error.response;

        if (status === 400) {
          errorMessage =
            data?.detail || 'Invalid request. Please check the status value.';
        } else if (status === 404) {
          errorMessage = 'Request not found. It may have been deleted.';
        } else if (status === 500) {
          errorMessage = 'Server error. Please try again later.';
        }

        console.error(`Status update failed (${status}):`, data);
      } else if (error.request) {
        // Request made but no response received
        errorMessage = 'Network error. Please check your connection.';
        console.error('Network error - no response received:', error.request);
      } else {
        // Something else happened
        errorMessage = error.message || 'An unexpected error occurred';
        console.error('Error:', error.message);
      }

      // Show user-friendly error
      alert(errorMessage);

      // Re-throw if you want calling code to handle it too
      throw error;
    }
  };

  /**
   * Handle Brand 1 RX status change
   * @param {string} newStatus - The new status value ('potential', 'non-potential', 'default')
   */
  const handleBrand1StatusChange = async (newStatus) => {
    try {
      const response = await requestService.updateBrandStatus(id, { rx_status_brand1: newStatus });
      setRequest((prev) => ({ ...prev, rx_status_brand1: newStatus }));
      console.log('Brand 1 status updated successfully:', response.data);
    } catch (error) {
      console.error('Failed to update Brand 1 status:', error);
      alert('Failed to update Brand 1 RX status');
    }
  };

  /**
   * Handle Brand 2 RX status change
   * @param {string} newStatus - The new status value ('potential', 'non-potential', 'default')
   */
  const handleBrand2StatusChange = async (newStatus) => {
    try {
      const response = await requestService.updateBrandStatus(id, { rx_status_brand2: newStatus });
      setRequest((prev) => ({ ...prev, rx_status_brand2: newStatus }));
      console.log('Brand 2 status updated successfully:', response.data);
    } catch (error) {
      console.error('Failed to update Brand 2 status:', error);
      alert('Failed to update Brand 2 RX status');
    }
  };

  // Handle adding a new brand entry
  const handleAddBrand = () => {
    setInteractionForm(prev => ({
      ...prev,
      brands: [
        ...prev.brands,
        {
          brand_name: '',
          objective: '',
          insights_marketing: '',
          topics_discussed: '',
          summary: '',
          outcomes: '',
          interest_level: ''
        }
      ]
    }));
  };

  // Handle removing a brand entry
  const handleRemoveBrand = (index) => {
    setInteractionForm(prev => ({
      ...prev,
      brands: prev.brands.filter((_, i) => i !== index)
    }));
  };

  // Handle brand field changes
  const handleBrandChange = (index, field, value) => {
    setInteractionForm(prev => ({
      ...prev,
      brands: prev.brands.map((brand, i) =>
        i === index ? { ...brand, [field]: value } : brand
      )
    }));
  };

  const handleInteractionSubmit = async (e) => {
    e.preventDefault();
    try {
      // Filter out empty brand entries
      const validBrands = interactionForm.brands.filter(b => b.brand_name.trim() !== '');
      
      console.log('Current user:', user);
      console.log('User username:', user?.username);
      
      const submissionData = {
        ...interactionForm,
        brands: validBrands,
        request_id: parseInt(id),
        logged_by: user?.username || '',
      };
      console.log('Submission data:', submissionData);
      await interactionService.createInteraction(submissionData);
      setShowInteractionForm(false);
      setInteractionForm({
        doctor_name: request?.doctor?.name || '',
        visit_date: '',
        topics_discussed: '',
        summary: '',
        outcomes: '',
        brand_discussed: '',
        brand2_discussed: '',
        brand2_topics: '',
        brand2_summary: '',
        brand2_outcomes: '',
        interest_level: '',
        brand2_interest_level: '',
        objections: '',
        insights_for_marketing: '',
        brands: [
          {
            brand_name: '',
            objective: '',
            insights_marketing: '',
            topics_discussed: '',
            summary: '',
            outcomes: '',
            interest_level: ''
          }
        ]
      });
      fetchRequestData();
    } catch (error) {
      console.error('Error creating interaction:', error);
      alert('Failed to log interaction');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusClass = (status) => {
    if (!status) return 'unknown';
    return status.toLowerCase().replace(' ', '-');
  };

  if (loading) {
    return <div className="loading">Loading request details...</div>;
  }

  if (error) {
    return (
      <div className="error-container" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
        padding: '32px 24px',
        background: '#fef2f2',
        border: '1px solid #fee2e2',
        borderRadius: '12px',
        color: '#ef4444',
        margin: '40px auto',
        maxWidth: '600px',
        textAlign: 'center',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px', color: '#991b1b' }}>Access Restriction</h2>
        <p style={{ fontSize: '15px', color: '#7f1d1d', margin: '0 0 20px 0' }}>{error}</p>
        <Link to="/requests" style={{
          background: '#ef4444',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: '600',
          fontSize: '14px',
          transition: 'background 0.2s'
        }} onMouseOver={(e) => e.target.style.background = '#dc2626'} onMouseOut={(e) => e.target.style.background = '#ef4444'}>
          Back to Requests List
        </Link>
      </div>
    );
  }

  if (!request) {
    return <div className="error">Request not found</div>;
  }

  const canLogActivities =
    user?.role === 'MSL' || user?.role === 'Scientific Officer';
  const canChangeStatus = [
    'MSL',
    'Scientific Officer',
    'Asst General Manager',
    'Associate Vice President',
    'SBUH/BH',
  ].includes(user?.role);

  return (
    <div className="request-detail-container">
      <div className="detail-header">
        <div className="header-left">
          <Link to="/requests" className="back-link">
            ← Back to Requests
          </Link>
          <h1>Request #{request.id}</h1>
        </div>
      </div>

      <div className="request-info-card">
        <div className="info-grid">
          <div className="info-item">
            <label>Doctor</label>
            <span className="info-value">{request.doctor?.name}</span>
          </div>
          <div className="info-item">
            <label>Therapy Area</label>
            <span className="info-value">{request.therapy_area}</span>
          </div>
          <div className="info-item">
            <label>Requested By</label>
            <span className="info-value">
              {request.requested_by} ({request.requested_by_role})
            </span>
          </div>
          <div className="info-item">
            <label>Created</label>
            <span className="info-value">
              {formatDate(request.created_at)}
            </span>
          </div>
          {/* Priority for Brand 1 (if exists) or overall request if only one brand */}
          {(request.brand || (!request.brand && !request.brand2)) && (
            <div className="info-item">
              <label>Priority {request.brand ? `(${request.brand})` : ''}</label>
              <span
                className={`info-value priority ${(request.priority || '').toLowerCase()}`}
              >
                {request.priority || 'Normal'}
              </span>
            </div>
          )}
          {/* Priority for Brand 2 if exists */}
          {request.brand2 && (
            <div className="info-item">
              <label>Priority (Brand 2)</label>
              <span className={`info-value priority ${(request.priority2 || '').toLowerCase()}`}>
                {request.priority2 || 'Normal'}
              </span>
            </div>
          )}
          <div className="info-item">
            <label>Assigned MSL</label>
            <span className="info-value">
              {request.assigned_msl ? (
                <span className="assigned-badge-text" style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>{request.assigned_msl}</span>
              ) : (
                <span className="unassigned-badge-text" style={{ color: '#ef4444', fontWeight: 'bold' }}>Unassigned</span>
              )}
            </span>
          </div>
        </div>
        {/* Brand Details Table */}
        {(request.brand || request.brand2) && (
          <div style={{ marginTop: '20px', overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: 'white',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderBottom: '2px solid #e0e0e0'
                  }}>Brand</th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderBottom: '2px solid #e0e0e0'
                  }}>Objective</th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderBottom: '2px solid #e0e0e0'
                  }}>Expected Outcome</th>
                  <th style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderBottom: '2px solid #e0e0e0'
                  }}>Problem Statement</th>
                </tr>
              </thead>
              <tbody>
                {/* Brand 1 Row */}
                {request.brand && (
                  <tr style={{ background: '#f0fff4', borderBottom: '1px solid #e0e0e0' }}>
                    <td style={{
                      padding: '12px 16px',
                      fontWeight: '600',
                      color: '#10b981',
                      fontSize: '14px'
                    }}>{request.brand}</td>
                    <td style={{
                      padding: '12px 16px',
                      color: '#4b5563',
                      fontSize: '13px',
                      lineHeight: '1.5'
                    }}>{request.objective || 'Not specified'}</td>
                    <td style={{
                      padding: '12px 16px',
                      color: '#4b5563',
                      fontSize: '13px',
                      lineHeight: '1.5'
                    }}>{request.expected_outcome || 'Not specified'}</td>
                    <td style={{
                      padding: '12px 16px',
                      color: '#4b5563',
                      fontSize: '13px',
                      lineHeight: '1.5'
                    }}>{request.notes || 'Not specified'}</td>
                  </tr>
                )}
                {/* Brand 2 Row */}
                {request.brand2 && (
                  <tr style={{ background: '#e6fffa', borderBottom: '1px solid #e0e0e0' }}>
                    <td style={{
                      padding: '12px 16px',
                      fontWeight: '600',
                      color: '#0d9488',
                      fontSize: '14px'
                    }}>{request.brand2}</td>
                    <td style={{
                      padding: '12px 16px',
                      color: '#4b5563',
                      fontSize: '13px',
                      lineHeight: '1.5'
                    }}>{request.objective2 || 'Not specified'}</td>
                    <td style={{
                      padding: '12px 16px',
                      color: '#4b5563',
                      fontSize: '13px',
                      lineHeight: '1.5'
                    }}>{request.expected_outcome2 || 'Not specified'}</td>
                    <td style={{
                      padding: '12px 16px',
                      color: '#4b5563',
                      fontSize: '13px',
                      lineHeight: '1.5'
                    }}>{request.notes2 || 'Not specified'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isManager && (
        <div className="assignment-card" style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '24px',
          marginTop: '20px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: '#111827', fontWeight: '600' }}>
            Assign Request to Medical Science Liaison (MSL)
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#6b7280' }}>
            As a Manager, you can assign this request to any available MSL. You can update or change the assignment at any time.
          </p>
          <form onSubmit={handleAssignMsl} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <select
                value={selectedMsl}
                onChange={(e) => setSelectedMsl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  background: 'white'
                }}
              >
                <option value="">-- Select MSL --</option>
                {mslList.map(msl => (
                  <option key={msl.employee_id} value={msl.username}>
                    {msl.username} ({msl.employee_id})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={isAssigning}
              style={{
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
            >
              {isAssigning ? 'Saving...' : 'Save Assignment'}
            </button>
          </form>
        </div>
      )}

      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Activity Summary
          </button>
          <button
            className={`tab ${activeTab === 'interactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('interactions')}
          >
            Doctor Interactions ({request.doctor_interactions?.length || 0})
          </button>
          <button
            className={`tab ${activeTab === 'assignments' ? 'active' : ''}`}
            onClick={() => setActiveTab('assignments')}
          >
            Assignment History ({request.assignment_logs?.length || 0})
          </button>
        </div>

        {activeTab === 'summary' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>Activity Timeline</h2>
              {canLogActivities && (
                <div className="action-buttons">
                  <button
                    onClick={() => setShowInteractionForm(true)}
                    className="action-btn"
                  >
                    + Log Doctor Visit
                  </button>
                </div>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="empty-timeline">
                <p>No activities logged yet.</p>
                {canLogActivities && (
                  <p>Start by logging a doctor interaction.</p>
                )}
              </div>
            ) : (
              <div className="timeline-table-container" style={{ marginTop: '20px' }}>
                <table className="timeline-table" style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '13px' }}>Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '13px' }}>MSL Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, index) => {
                      console.log('Log entry:', log);
                      const mslName = log.logged_by || (log.title && log.title.replace('Visit by ', '')) || 'Unknown';
                      return (
                        <tr key={`${log.type}-${log.id}`} style={{ borderBottom: '1px solid #e5e7eb', background: index % 2 === 0 ? 'white' : '#f9fafb' }}>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                            {formatDate(log.date)}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#111827', fontWeight: '500' }}>
                            {mslName}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Previous MSL visits in timeline */}
            {doctorHistory.filter(h => h.logged_by && h.logged_by !== user?.username).length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <div className="timeline">
                  {doctorHistory
                    .filter(h => h.logged_by && h.logged_by !== user?.username)
                    .map((visit) => (
                      <div key={`prev-${visit.id}`} className="timeline-item">
                        <div className="timeline-dot doctor_interaction" style={{ background: '#a78bfa' }}></div>
                        <div className="timeline-content" style={{ borderLeft: '3px solid #ede9fe', background: '#faf8ff' }}>
                          <div className="timeline-header">
                            <span className="timeline-type" style={{ color: '#7c3aed' }}>🏥 Previous MSL Visit</span>
                            <span className="timeline-date">{formatDate(visit.visit_date)}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '28px', height: '28px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: '700', fontSize: '12px', flexShrink: 0
                              }}>
                                {(visit.logged_by || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span style={{ fontWeight: '700', color: '#333', fontSize: '14px' }}>
                                  {visit.logged_by}
                                </span>
                                {visit.brand_discussed && (
                                  <span style={{
                                    marginLeft: '8px', fontSize: '11px', color: 'white', fontWeight: '600',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    padding: '2px 8px', borderRadius: '10px'
                                  }}>Brand 1: {visit.brand_discussed}</span>
                                )}
                                {visit.brand2_discussed && (
                                  <span style={{
                                    marginLeft: '8px', fontSize: '11px', color: 'white', fontWeight: '600',
                                    background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                                    padding: '2px 8px', borderRadius: '10px'
                                  }}>Brand 2: {visit.brand2_discussed}</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedVisitReport(visit)}
                              style={{
                                background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                                color: 'white', border: 'none', padding: '6px 14px',
                                borderRadius: '20px', cursor: 'pointer', fontSize: '12px',
                                fontWeight: '600', transition: 'all 0.2s'
                              }}
                            >
                              View Report
                            </button>
                          </div>
                          {visit.outcomes && (
                            <p style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}>
                              <strong>Outcome:</strong> {visit.outcomes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'interactions' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>Doctor Interactions</h2>
              {canLogActivities && (
                <button
                  onClick={() => setShowInteractionForm(true)}
                  className="action-btn"
                >
                  + Log New Visit
                </button>
              )}
            </div>

            {request.doctor_interactions?.length === 0 ? (
              <div className="empty-state">
                No doctor interactions logged yet.
              </div>
            ) : (
              <div className="interactions-list">
                {request.doctor_interactions?.map((interaction) => (
                  <div key={interaction.id} className="interaction-card">
                    <div className="interaction-header">
                      <h4>{interaction.doctor_name}</h4>
                      <span className="date">
                        {formatDate(interaction.visit_date)}
                      </span>
                    </div>
                    <div className="interaction-details">
                      {/* Display dynamic brands */}
                      {interaction.brands && interaction.brands.length > 0 ? (
                        interaction.brands.map((brand, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: idx % 2 === 0 ? '#f0fff4' : '#e6fffa',
                              padding: '12px',
                              borderRadius: '6px',
                              marginBottom: '12px',
                              border: idx % 2 === 0 ? '1px solid #9ae6b4' : '1px solid #81e6d9'
                            }}
                          >
                            <h5 style={{ margin: '0 0 8px 0', color: idx % 2 === 0 ? '#22543d' : '#234e52', fontSize: '13px' }}>
                              Brand: {brand.brand_name}
                            </h5>
                            {brand.objective && (
                              <p style={{ margin: '4px 0', fontSize: '13px' }}>
                                <strong>Objective:</strong> {brand.objective}
                              </p>
                            )}
                            {brand.insights_marketing && (
                              <p style={{ margin: '4px 0', fontSize: '13px' }}>
                                <strong>Insights for Marketing:</strong> {brand.insights_marketing}
                              </p>
                            )}
                            {brand.topics_discussed && (
                              <p style={{ margin: '4px 0', fontSize: '13px' }}>
                                <strong>Topics Discussed:</strong> {brand.topics_discussed}
                              </p>
                            )}
                            {brand.summary && (
                              <p style={{ margin: '4px 0', fontSize: '13px' }}>
                                <strong>Summary:</strong> {brand.summary}
                              </p>
                            )}
                            {brand.interest_level && (
                              <p style={{ margin: '4px 0', fontSize: '13px' }}>
                                <strong>Interest Level:</strong> {brand.interest_level}
                              </p>
                            )}
                            {brand.outcomes && (
                              <p style={{ margin: '4px 0', fontSize: '13px' }}>
                                <strong>Outcome:</strong> {brand.outcomes}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        /* Legacy display for old interactions without brands array */
                        <>
                          {interaction.brand_discussed && (
                            <p>
                              <strong>Brand 1 Discussed:</strong>{' '}
                              {interaction.brand_discussed}
                            </p>
                          )}
                          {interaction.brand2_discussed && (
                            <p>
                              <strong>Brand 2 Discussed:</strong>{' '}
                              {interaction.brand2_discussed}
                            </p>
                          )}
                          {interaction.topics_discussed && (
                            <p>
                              <strong>Topic Discussed (Brand 1):</strong>{' '}
                              {interaction.topics_discussed}
                            </p>
                          )}
                          {interaction.brand2_topics && (
                            <p>
                              <strong>Topic Discussed (Brand 2):</strong>{' '}
                              {interaction.brand2_topics}
                            </p>
                          )}
                          {interaction.interest_level && (
                            <p>
                              <strong>Interest Level (Brand 1):</strong>{' '}
                              {interaction.interest_level}
                            </p>
                          )}
                          {interaction.brand2_interest_level && (
                            <p>
                              <strong>Interest Level (Brand 2):</strong>{' '}
                              {interaction.brand2_interest_level}
                            </p>
                          )}
                          {interaction.summary && (
                            <p className="summary">
                              <strong>Discussion Summary (Brand 1):</strong>{' '}
                              {interaction.summary}
                            </p>
                          )}
                          {interaction.brand2_summary && (
                            <p className="summary">
                              <strong>Discussion Summary (Brand 2):</strong>{' '}
                              {interaction.brand2_summary}
                            </p>
                          )}
                          {interaction.outcomes && (
                            <p className="outcomes" style={{ marginTop: '5px' }}>
                              <strong>Outcome (Brand 1):</strong> {interaction.outcomes}
                            </p>
                          )}
                          {interaction.brand2_outcomes && (
                            <p className="outcomes" style={{ marginTop: '5px' }}>
                              <strong>Outcome (Brand 2):</strong> {interaction.brand2_outcomes}
                            </p>
                          )}
                          {interaction.insights_for_marketing && (
                            <p style={{ marginTop: '5px' }}>
                              <strong>Insights for Marketing:</strong>{' '}
                              {interaction.insights_for_marketing}
                            </p>
                          )}
                        </>
                      )}
                      {interaction.objections && (
                        <p style={{ marginTop: '5px' }}>
                          <strong>Objections:</strong> {interaction.objections}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Previously visited by other MSLs */}
            {doctorHistory.filter(h => h.logged_by && h.logged_by !== user?.username).length > 0 && (
              <div style={{ marginTop: '30px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  marginBottom: '16px', borderTop: '2px dashed #e0e3ff', paddingTop: '20px'
                }}>
                  <span style={{ fontSize: '18px' }}>👥</span>
                  <h3 style={{ margin: 0, color: '#667eea', fontSize: '16px', fontWeight: '700' }}>
                    Previously Visited by Other MSLs
                  </h3>
                  <span style={{
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white', fontSize: '12px', fontWeight: '600',
                    padding: '2px 10px', borderRadius: '20px'
                  }}>
                    {doctorHistory.filter(h => h.logged_by && h.logged_by !== user?.username).length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {doctorHistory
                    .filter(h => h.logged_by && h.logged_by !== user?.username)
                    .map((visit) => (
                      <div key={`prev-${visit.id}`} className="timeline-item">
                        <div className="timeline-dot doctor_interaction" style={{ background: '#a78bfa' }}></div>
                        <div className="timeline-content" style={{ borderLeft: '3px solid #ede9fe', background: '#faf8ff' }}>
                          <div className="timeline-header">
                            <span className="timeline-type" style={{ color: '#7c3aed' }}>🏥 Previous MSL Visit</span>
                            <span className="timeline-date">{formatDate(visit.visit_date)}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '28px', height: '28px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: '700', fontSize: '12px', flexShrink: 0
                              }}>
                                {(visit.logged_by || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span style={{ fontWeight: '700', color: '#333', fontSize: '14px' }}>
                                  {visit.logged_by}
                                </span>
                                {visit.brand_discussed && (
                                  <span style={{
                                    marginLeft: '8px', fontSize: '11px', color: 'white', fontWeight: '600',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    padding: '2px 8px', borderRadius: '10px'
                                  }}>Brand 1: {visit.brand_discussed}</span>
                                )}
                                {visit.brand2_discussed && (
                                  <span style={{
                                    marginLeft: '8px', fontSize: '11px', color: 'white', fontWeight: '600',
                                    background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                                    padding: '2px 8px', borderRadius: '10px'
                                  }}>Brand 2: {visit.brand2_discussed}</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedVisitReport(visit)}
                              style={{
                                background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                                color: 'white', border: 'none', padding: '6px 14px',
                                borderRadius: '20px', cursor: 'pointer', fontSize: '12px',
                                fontWeight: '600', transition: 'all 0.2s'
                              }}
                            >
                              View Report
                            </button>
                          </div>
                          {visit.outcomes && (
                            <p style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}>
                              <strong>Outcome:</strong> {visit.outcomes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="tab-content">
            <div className="section-header">
              <h2>Request Assignment Audit Trail</h2>
            </div>
            {!request.assignment_logs || request.assignment_logs.length === 0 ? (
              <div className="empty-state">
                <p>No assignment history recorded yet.</p>
              </div>
            ) : (
              <div className="assignment-timeline" style={{
                display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px'
              }}>
                {request.assignment_logs.map((log) => (
                  <div key={log.id} style={{
                    background: 'linear-gradient(135deg, #f3f4f6 0%, #ffffff 100%)',
                    border: '1px solid #e5e7eb',
                    borderLeft: '4px solid #2563eb',
                    borderRadius: '8px',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: '600', color: '#111827', fontSize: '15px' }}>
                        {log.previous_msl ? (
                          <span>
                            Reassigned from{' '}
                            <button
                              onClick={() => handleViewPrevMslActivity(log.previous_msl)}
                              style={{
                                background: '#fef3c7', color: '#92400e',
                                border: '1px solid #fcd34d', borderRadius: '6px',
                                padding: '2px 8px', cursor: 'pointer',
                                fontWeight: '700', fontSize: '13px',
                                transition: 'all 0.2s'
                              }}
                              title={`View ${log.previous_msl}'s activity with this doctor`}
                            >
                              👤 {log.previous_msl}
                            </button>
                            {' '}to{' '}
                            <strong style={{ color: '#16a34a' }}>{log.new_msl}</strong>
                          </span>
                        ) : (
                          <span>Assigned to <strong style={{ color: '#16a34a' }}>{log.new_msl}</strong></span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                        By Manager: <strong>{log.assigned_by}</strong>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '500' }}>
                      {new Date(log.assigned_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Previous MSL Activity Panel */}
      {prevMslPanel && (
        <div
          onClick={() => setPrevMslPanel(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 1000, display: 'flex', alignItems: 'flex-start',
            justifyContent: 'flex-end', padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '480px', maxWidth: '95vw', maxHeight: '90vh',
              background: 'white', borderRadius: '16px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}
          >
            {/* Panel Header */}
            <div style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              padding: '20px 24px', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ color: 'white', fontWeight: '700', fontSize: '16px' }}>
                  👤 {prevMslPanel.mslName}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', marginTop: '2px' }}>
                  Activity with Dr. {request.doctor?.name}
                </div>
              </div>
              <button
                onClick={() => setPrevMslPanel(null)}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none',
                  color: 'white', width: '32px', height: '32px',
                  borderRadius: '50%', cursor: 'pointer', fontSize: '18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >×</button>
            </div>

            {/* Panel Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {prevMslPanel.visits.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
                  <p style={{ fontWeight: '600', margin: '0 0 4px' }}>No interactions logged</p>
                  <p style={{ fontSize: '13px', margin: 0 }}>
                    {prevMslPanel.mslName} has not logged any visits with this doctor.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                    {prevMslPanel.visits.length} interaction(s) found
                  </div>
                  {prevMslPanel.visits.map((v, idx) => (
                    <div key={v.id || idx} style={{
                      border: '1px solid #e5e7eb',
                      borderLeft: '4px solid #f59e0b',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      background: '#fffbeb'
                    }}>
                      {/* Visit header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{
                          background: '#f59e0b', color: 'white',
                          padding: '2px 10px', borderRadius: '10px',
                          fontSize: '11px', fontWeight: '700'
                        }}>
                          Visit #{idx + 1}
                        </span>
                        <span style={{ fontSize: '12px', color: '#92400e', fontWeight: '600' }}>
                          {formatDate(v.visit_date)}
                        </span>
                      </div>
                      {/* Visit details */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#374151' }}>
                        {v.topics_discussed && (
                          <div><strong style={{ color: '#92400e' }}>Topics (Brand 1):</strong> {v.topics_discussed}</div>
                        )}
                        {v.brand2_topics && (
                          <div><strong style={{ color: '#92400e' }}>Topics (Brand 2):</strong> {v.brand2_topics}</div>
                        )}
                        {v.brand_discussed && (
                          <div><strong style={{ color: '#92400e' }}>Brand 1:</strong> {v.brand_discussed}</div>
                        )}
                        {v.brand2_discussed && (
                          <div><strong style={{ color: '#92400e' }}>Brand 2:</strong> {v.brand2_discussed}</div>
                        )}
                        {v.interest_level && (
                          <div><strong style={{ color: '#92400e' }}>Interest (Brand 1):</strong> {v.interest_level}</div>
                        )}
                        {v.brand2_interest_level && (
                          <div><strong style={{ color: '#92400e' }}>Interest (Brand 2):</strong> {v.brand2_interest_level}</div>
                        )}
                        {v.outcomes && (
                          <div><strong style={{ color: '#92400e' }}>Outcome (Brand 1):</strong> {v.outcomes}</div>
                        )}
                        {v.brand2_outcomes && (
                          <div><strong style={{ color: '#92400e' }}>Outcome (Brand 2):</strong> {v.brand2_outcomes}</div>
                        )}
                        {v.objections && (
                          <div><strong style={{ color: '#92400e' }}>Objections:</strong> {v.objections}</div>
                        )}
                        {v.summary && (
                          <div style={{
                            background: 'white', padding: '8px 12px',
                            borderRadius: '6px', border: '1px solid #fcd34d',
                            marginTop: '4px'
                          }}>
                            <strong style={{ color: '#92400e' }}>Summary (Brand 1):</strong> {v.summary}
                          </div>
                        )}
                        {v.brand2_summary && (
                          <div style={{
                            background: 'white', padding: '8px 12px',
                            borderRadius: '6px', border: '1px solid #fcd34d',
                            marginTop: '4px'
                          }}>
                            <strong style={{ color: '#92400e' }}>Summary (Brand 2):</strong> {v.brand2_summary}
                          </div>
                        )}
                        {v.insights_for_marketing && (
                          <div><strong style={{ color: '#92400e' }}>Marketing Insights:</strong> {v.insights_for_marketing}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interaction Form Modal */}
      {showInteractionForm && (
        <div className="modal-overlay" onClick={() => setShowInteractionForm(false)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '700px', width: '92vw', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box', borderRadius: '12px', padding: '24px' }}
          >
            <h2 style={{ marginBottom: '20px', borderBottom: '1px solid #edf2f7', paddingBottom: '12px', color: '#1a202c' }}>📝 Log Doctor Visit</h2>
            <form onSubmit={handleInteractionSubmit}>
              {/* Date and Doctor */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#4a5568' }}>Visit Date *</label>
                  <input
                    type="date"
                    value={interactionForm.visit_date}
                    min={new Date().toISOString().split('T')[0]}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setInteractionForm({ ...interactionForm, visit_date: e.target.value })}
                    className="form-control"
                    style={{ marginTop: '6px' }}
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#4a5568' }}>Doctor Name</label>
                  <input
                    type="text"
                    value={interactionForm.doctor_name}
                    readOnly
                    className="form-control"
                    style={{ marginTop: '6px', background: '#f7fafc' }}
                  />
                </div>
              </div>

              {/* Dynamic Brand Sections */}
              {interactionForm.brands.map((brand, index) => (
                <div
                  key={index}
                  style={{
                    background: index % 2 === 0 ? '#f0fff4' : '#e6fffa',
                    border: index % 2 === 0 ? '1px solid #9ae6b4' : '1px solid #81e6d9',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '20px',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, color: index % 2 === 0 ? '#22543d' : '#234e52', fontSize: '14px' }}>
                      Brand {index + 1} {index === 0 && '*'}
                    </h4>
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBrand(index)}
                        style={{
                          background: '#fed7d7',
                          border: 'none',
                          color: '#c53030',
                          padding: '4px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#4a5568' }}>Brand Name *</label>
                      <select
                        value={brand.brand_name}
                        onChange={e => handleBrandChange(index, 'brand_name', e.target.value)}
                        className="form-control"
                        style={{ marginTop: '4px' }}
                        required={index === 0}
                      >
                        <option value="">Select Brand</option>
                        {BRAND_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#4a5568' }}>Interest Level</label>
                      <select
                        value={brand.interest_level}
                        onChange={e => handleBrandChange(index, 'interest_level', e.target.value)}
                        className="form-control"
                        style={{ marginTop: '4px' }}
                      >
                        <option value="">Select Level</option>
                        {INTEREST_LEVEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#4a5568' }}>Objective</label>
                    <textarea
                      value={brand.objective}
                      onChange={e => handleBrandChange(index, 'objective', e.target.value)}
                      className="form-control"
                      rows="2"
                      style={{ marginTop: '4px', resize: 'vertical' }}
                      placeholder="Objective for this brand discussion..."
                    />
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#4a5568' }}>Insights for Marketing</label>
                    <textarea
                      value={brand.insights_marketing}
                      onChange={e => handleBrandChange(index, 'insights_marketing', e.target.value)}
                      className="form-control"
                      rows="2"
                      style={{ marginTop: '4px', resize: 'vertical' }}
                      placeholder="Marketing insights from this brand discussion..."
                    />
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#4a5568' }}>Topics Discussed</label>
                    <textarea
                      value={brand.topics_discussed}
                      onChange={e => handleBrandChange(index, 'topics_discussed', e.target.value)}
                      className="form-control"
                      rows="2"
                      style={{ marginTop: '4px', resize: 'vertical' }}
                      placeholder="What topics were discussed..."
                    />
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#4a5568' }}>Summary</label>
                    <textarea
                      value={brand.summary}
                      onChange={e => handleBrandChange(index, 'summary', e.target.value)}
                      className="form-control"
                      rows="2"
                      style={{ marginTop: '4px', resize: 'vertical' }}
                      placeholder="Brief summary of the discussion..."
                    />
                  </div>
                  
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#4a5568' }}>Outcomes</label>
                    <select
                      value={brand.outcomes}
                      onChange={e => handleBrandChange(index, 'outcomes', e.target.value)}
                      className="form-control"
                      style={{ marginTop: '4px' }}
                    >
                      <option value="">Select Outcome</option>
                      {OUTCOME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              ))}

              {/* Add Other Brand Button */}
              <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={handleAddBrand}
                  style={{
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    border: 'none',
                    padding: '10px 24px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                >
                  + Add Other Brand
                </button>
              </div>

              {/* Objections */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#4a5568' }}>Objections (if any)</label>
                <textarea
                  value={interactionForm.objections}
                  onChange={e => setInteractionForm({ ...interactionForm, objections: e.target.value })}
                  className="form-control"
                  rows="2"
                  style={{ marginTop: '6px', resize: 'vertical' }}
                  placeholder="Any objections raised by the doctor..."
                />
              </div>

              <div className="modal-actions" style={{ borderTop: '1px solid #edf2f7', paddingTop: '16px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowInteractionForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Visit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Visit Report Modal */}
      {selectedVisitReport && (
        <div
          onClick={() => setSelectedVisitReport(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 1000, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '600px', maxWidth: '95vw', maxHeight: '90vh',
              background: 'white', borderRadius: '16px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              padding: '20px 24px', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ color: 'white', fontWeight: '700', fontSize: '16px' }}>
                  🏥 Previous MSL Visit Report
                </div>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', marginTop: '2px' }}>
                  by {selectedVisitReport.logged_by} on {formatDate(selectedVisitReport.visit_date)}
                </div>
              </div>
              <button
                onClick={() => setSelectedVisitReport(null)}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none',
                  color: 'white', width: '32px', height: '32px',
                  borderRadius: '50%', cursor: 'pointer', fontSize: '18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >×</button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {/* Doctor Info */}
              <div style={{ marginBottom: '20px', padding: '16px', background: '#f3f4f6', borderRadius: '10px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                  Dr. {selectedVisitReport.doctor_name}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  Visit Date: {formatDate(selectedVisitReport.visit_date)}
                </div>
              </div>

              {/* Brands Discussed */}
              {selectedVisitReport.brands && selectedVisitReport.brands.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {selectedVisitReport.brands.map((brand, idx) => (
                    <div key={idx} style={{
                      border: '1px solid #e5e7eb',
                      borderLeft: '4px solid #7c3aed',
                      borderRadius: '10px',
                      padding: '16px',
                      background: idx % 2 === 0 ? '#f5f3ff' : '#faf8ff'
                    }}>
                      <div style={{ fontWeight: '700', color: '#7c3aed', fontSize: '14px', marginBottom: '12px' }}>
                        Brand {idx + 1}: {brand.brand_name}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#374151' }}>
                        {brand.objective && (
                          <div><strong style={{ color: '#6b7280' }}>Objective:</strong> {brand.objective}</div>
                        )}
                        {brand.topics_discussed && (
                          <div><strong style={{ color: '#6b7280' }}>Topics Discussed:</strong> {brand.topics_discussed}</div>
                        )}
                        {brand.summary && (
                          <div style={{ background: 'white', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd6fe' }}>
                            <strong style={{ color: '#6b7280' }}>Summary:</strong> {brand.summary}
                          </div>
                        )}
                        {brand.outcomes && (
                          <div><strong style={{ color: '#6b7280' }}>Outcome:</strong> {brand.outcomes}</div>
                        )}
                        {brand.interest_level && (
                          <div><strong style={{ color: '#6b7280' }}>Interest Level:</strong> {brand.interest_level}</div>
                        )}
                        {brand.insights_marketing && (
                          <div><strong style={{ color: '#6b7280' }}>Marketing Insights:</strong> {brand.insights_marketing}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Legacy display for old interactions without brands array */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Brand 1 */}
                  {(selectedVisitReport.brand_discussed || selectedVisitReport.topics_discussed || selectedVisitReport.summary) && (
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderLeft: '4px solid #7c3aed',
                      borderRadius: '10px',
                      padding: '16px',
                      background: '#f5f3ff'
                    }}>
                      <div style={{ fontWeight: '700', color: '#7c3aed', fontSize: '14px', marginBottom: '12px' }}>
                        Brand 1: {selectedVisitReport.brand_discussed || 'N/A'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#374151' }}>
                        {selectedVisitReport.topics_discussed && (
                          <div><strong style={{ color: '#6b7280' }}>Topics Discussed:</strong> {selectedVisitReport.topics_discussed}</div>
                        )}
                        {selectedVisitReport.summary && (
                          <div style={{ background: 'white', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd6fe' }}>
                            <strong style={{ color: '#6b7280' }}>Summary:</strong> {selectedVisitReport.summary}
                          </div>
                        )}
                        {selectedVisitReport.outcomes && (
                          <div><strong style={{ color: '#6b7280' }}>Outcome:</strong> {selectedVisitReport.outcomes}</div>
                        )}
                        {selectedVisitReport.interest_level && (
                          <div><strong style={{ color: '#6b7280' }}>Interest Level:</strong> {selectedVisitReport.interest_level}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Brand 2 */}
                  {(selectedVisitReport.brand2_discussed || selectedVisitReport.brand2_topics || selectedVisitReport.brand2_summary) && (
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderLeft: '4px solid #0d9488',
                      borderRadius: '10px',
                      padding: '16px',
                      background: '#f0fdfa'
                    }}>
                      <div style={{ fontWeight: '700', color: '#0d9488', fontSize: '14px', marginBottom: '12px' }}>
                        Brand 2: {selectedVisitReport.brand2_discussed || 'N/A'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#374151' }}>
                        {selectedVisitReport.brand2_topics && (
                          <div><strong style={{ color: '#6b7280' }}>Topics Discussed:</strong> {selectedVisitReport.brand2_topics}</div>
                        )}
                        {selectedVisitReport.brand2_summary && (
                          <div style={{ background: 'white', padding: '8px 12px', borderRadius: '6px', border: '1px solid #99f6e4' }}>
                            <strong style={{ color: '#6b7280' }}>Summary:</strong> {selectedVisitReport.brand2_summary}
                          </div>
                        )}
                        {selectedVisitReport.brand2_outcomes && (
                          <div><strong style={{ color: '#6b7280' }}>Outcome:</strong> {selectedVisitReport.brand2_outcomes}</div>
                        )}
                        {selectedVisitReport.brand2_interest_level && (
                          <div><strong style={{ color: '#6b7280' }}>Interest Level:</strong> {selectedVisitReport.brand2_interest_level}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Objections & Insights */}
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedVisitReport.objections && (
                  <div style={{ padding: '12px 16px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                    <strong style={{ color: '#92400e', fontSize: '13px' }}>Objections:</strong>
                    <div style={{ fontSize: '13px', color: '#78350f', marginTop: '4px' }}>{selectedVisitReport.objections}</div>
                  </div>
                )}
                {selectedVisitReport.insights_for_marketing && (
                  <div style={{ padding: '12px 16px', background: '#dbeafe', borderRadius: '8px', border: '1px solid #93c5fd' }}>
                    <strong style={{ color: '#1e40af', fontSize: '13px' }}>Marketing Insights:</strong>
                    <div style={{ fontSize: '13px', color: '#1e3a8a', marginTop: '4px' }}>{selectedVisitReport.insights_for_marketing}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedVisitReport(null)}
                style={{
                  background: '#f3f4f6', color: '#374151', border: 'none',
                  padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '14px', fontWeight: '600'
                }}
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

export default RequestDetail;
