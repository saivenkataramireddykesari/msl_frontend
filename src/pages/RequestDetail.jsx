import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestService, interactionService, userService } from '../services/api';
import '../styles/RequestDetail.css';

const STATUSES = ['default', 'potential', 'non-potential'];

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
    visit_date: '',
    topics_discussed: '',
    summary: '',
    outcomes: '',
    brand_discussed: '',
    interest_level: '',
    objections: '',
    insights_for_marketing: '',
  });

  // Roles that can assign/reassign requests
  const isManager = [
    'Asst General Manager', 'Associate Vice President', 'BL', 'BM', 'SBUH/BH'
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

  const handleInteractionSubmit = async (e) => {
    e.preventDefault();
    try {
      const submissionData = {
        ...interactionForm,
        request_id: parseInt(id),
        logged_by: user?.username || '',
      };
      await interactionService.createInteraction(submissionData);
      setShowInteractionForm(false);
      setInteractionForm({
        doctor_name: request?.doctor?.name || '',
        visit_date: '',
        topics_discussed: '',
        summary: '',
        outcomes: '',
        brand_discussed: '',
        interest_level: '',
        objections: '',
        insights_for_marketing: '',
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
        <div className="header-right">
          <span
            className={`status-badge-large ${getStatusClass(request.status)}`}
          >
            {request.status === 'potential'
              ? 'Potential User'
              : request.status === 'non-potential'
                ? 'Not a Potential User'
                : 'Default User'}
          </span>
          {canChangeStatus && (
            <select
              value={request.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="status-select"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === 'potential'
                    ? 'Potential User'
                    : s === 'non-potential'
                      ? 'Not a Potential User'
                      : 'Default'}
                </option>
              ))}
            </select>
          )}
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
            <label>Priority</label>
            <span
              className={`info-value priority ${(request.priority || '').toLowerCase()}`}
            >
              {request.priority || 'Normal'}
            </span>
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
          {request.brand && (
            <div className="info-item">
              <label>Brand</label>
              <span className="info-value" style={{ fontWeight: '600', color: '#10b981' }}>
                {request.brand}
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
        <div className="info-section">
          <label>Objective</label>
          <p>{request.objective}</p>
        </div>
        <div className="info-section">
          <label>Expected Outcome</label>
          <p>{request.expected_outcome || 'Not specified'}</p>
        </div>
        {request.notes && (
          <div className="info-section">
            <label>Additional Notes</label>
            <p>{request.notes}</p>
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
              <div className="timeline">
                {logs.map((log) => (
                  <div key={`${log.type}-${log.id}`} className="timeline-item">
                    <div className={`timeline-dot ${log.type}`}></div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="timeline-type">👨‍⚕️ Doctor Visit</span>
                        <span className="timeline-date">
                          {formatDate(log.date)}
                        </span>
                      </div>
                      <h4>{log.title}</h4>
                      {log.details && <p>{log.details}</p>}
                    </div>
                  </div>
                ))}
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
                                  }}>{visit.brand_discussed}</span>
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
                      {interaction.brand_discussed && (
                        <p>
                          <strong>Brand Discussed:</strong>{' '}
                          {interaction.brand_discussed}
                        </p>
                      )}
                      {interaction.topics_discussed && (
                        <p>
                          <strong>Topic Discussed:</strong>{' '}
                          {interaction.topics_discussed}
                        </p>
                      )}
                      {interaction.interest_level && (
                        <p>
                          <strong>Interest Level:</strong>{' '}
                          {interaction.interest_level}
                        </p>
                      )}
                      {interaction.summary && (
                        <p className="summary">
                          <strong>Discussion Summary:</strong>{' '}
                          {interaction.summary}
                        </p>
                      )}
                      {interaction.outcomes && (
                        <p className="outcomes" style={{ marginTop: '5px' }}>
                          <strong>Outcome:</strong> {interaction.outcomes}
                        </p>
                      )}
                      {interaction.objections && (
                        <p style={{ marginTop: '5px' }}>
                          <strong>Objections:</strong> {interaction.objections}
                        </p>
                      )}
                      {interaction.insights_for_marketing && (
                        <p style={{ marginTop: '5px' }}>
                          <strong>Insights for Marketing:</strong>{' '}
                          {interaction.insights_for_marketing}
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
                      <div key={visit.id} style={{
                        background: 'linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%)',
                        border: '1px solid #e0e3ff',
                        borderLeft: '4px solid #667eea',
                        borderRadius: '10px',
                        padding: '16px 20px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '50%',
                              background: 'linear-gradient(135deg, #667eea, #764ba2)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white', fontWeight: '700', fontSize: '13px', flexShrink: 0
                            }}>
                              {(visit.logged_by || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: '700', color: '#333', fontSize: '14px' }}>
                                {visit.logged_by}
                              </div>
                              <div style={{ fontSize: '12px', color: '#888' }}>MSL</div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>
                              {formatDate(visit.visit_date)}
                            </div>
                            {visit.brand_discussed && (
                              <div style={{
                                fontSize: '11px', color: 'white', fontWeight: '600',
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                padding: '2px 8px', borderRadius: '10px', marginTop: '4px', display: 'inline-block'
                              }}>
                                {visit.brand_discussed}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', color: '#555' }}>
                          {visit.interest_level && (
                            <div><strong style={{ color: '#667eea' }}>Interest:</strong> {visit.interest_level}</div>
                          )}
                          {visit.outcomes && (
                            <div><strong style={{ color: '#667eea' }}>Outcome:</strong> {visit.outcomes}</div>
                          )}
                          {visit.topics_discussed && (
                            <div style={{ gridColumn: '1/-1' }}><strong style={{ color: '#667eea' }}>Topic:</strong> {visit.topics_discussed}</div>
                          )}
                          {visit.summary && (
                            <div style={{ gridColumn: '1/-1', background: '#f0f4ff', padding: '8px 12px', borderRadius: '6px' }}>
                              <strong style={{ color: '#667eea' }}>Summary:</strong> {visit.summary}
                            </div>
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
              <div className="assignment-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
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
                            <strong style={{color:'#16a34a'}}>{log.new_msl}</strong>
                          </span>
                        ) : (
                          <span>Assigned to <strong style={{color:'#16a34a'}}>{log.new_msl}</strong></span>
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
                          <div><strong style={{ color: '#92400e' }}>Topics:</strong> {v.topics_discussed}</div>
                        )}
                        {v.brand_discussed && (
                          <div><strong style={{ color: '#92400e' }}>Brand:</strong> {v.brand_discussed}</div>
                        )}
                        {v.interest_level && (
                          <div><strong style={{ color: '#92400e' }}>Interest:</strong> {v.interest_level}</div>
                        )}
                        {v.outcomes && (
                          <div><strong style={{ color: '#92400e' }}>Outcome:</strong> {v.outcomes}</div>
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
                            <strong style={{ color: '#92400e' }}>Summary:</strong> {v.summary}
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

      {/* Doctor Interaction Modal */}
      {showInteractionForm && (
        <div
          className="modal-overlay"
          onClick={() => setShowInteractionForm(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Log Doctor Interaction</h2>
            <form onSubmit={handleInteractionSubmit}>
              <div className="form-group">
                <label>Doctor Name</label>
                <input
                  type="text"
                  value={interactionForm.doctor_name}
                  onChange={(e) =>
                    setInteractionForm({
                      ...interactionForm,
                      doctor_name: e.target.value,
                    })
                  }
                  className="form-control"
                  required
                />
              </div>
              <div className="form-group">
                <label>Visit Date</label>
                <input
                  type="date"
                  value={interactionForm.visit_date}
                  onChange={(e) =>
                    setInteractionForm({
                      ...interactionForm,
                      visit_date: e.target.value,
                    })
                  }
                  className="form-control"
                  required
                />
              </div>
              {/* Brand Discussed */}
              <div className="form-group">
                <label>Brand Discussed <span style={{color:'#e74c3c'}}>*</span></label>
                <select
                  value={interactionForm.brand_discussed}
                  onChange={(e) =>
                    setInteractionForm({
                      ...interactionForm,
                      brand_discussed: e.target.value,
                      topics_discussed: '',
                    })
                  }
                  className="form-control"
                  required
                >
                  <option value="">Select Brand</option>
                  {BRAND_OPTIONS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Topic Discussed — shown only after brand is selected */}
              {interactionForm.brand_discussed && (
                <div className="form-group">
                  <label>Topic Discussed <span style={{color:'#e74c3c'}}>*</span></label>
                  <textarea
                    value={interactionForm.topics_discussed}
                    onChange={(e) =>
                      setInteractionForm({
                        ...interactionForm,
                        topics_discussed: e.target.value,
                      })
                    }
                    className="form-control"
                    rows="2"
                    placeholder="Topic discussed"
                    required
                  />
                </div>
              )}

              {/* Interest Level */}
              <div className="form-group">
                <label>Interest Level <span style={{color:'#e74c3c'}}>*</span></label>
                <select
                  value={interactionForm.interest_level}
                  onChange={(e) =>
                    setInteractionForm({
                      ...interactionForm,
                      interest_level: e.target.value,
                    })
                  }
                  className="form-control"
                  required
                >
                  <option value="">Select Interest Level</option>
                  {INTEREST_LEVEL_OPTIONS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Discussion Summary */}
              <div className="form-group">
                <label>Discussion Summary <span style={{color:'#e74c3c'}}>*</span></label>
                <textarea
                  value={interactionForm.summary}
                  onChange={(e) =>
                    setInteractionForm({
                      ...interactionForm,
                      summary: e.target.value,
                    })
                  }
                  className="form-control"
                  rows="3"
                  placeholder="Summary of the discussion"
                  required
                />
              </div>

              {/* Outcome */}
              <div className="form-group">
                <label>Outcome <span style={{color:'#e74c3c'}}>*</span></label>
                <select
                  value={interactionForm.outcomes}
                  onChange={(e) =>
                    setInteractionForm({
                      ...interactionForm,
                      outcomes: e.target.value,
                    })
                  }
                  className="form-control"
                  required
                >
                  <option value="">Select Outcome</option>
                  {OUTCOME_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Objections */}
              <div className="form-group">
                <label>Objections <span style={{color:'#e74c3c'}}>*</span></label>
                <textarea
                  value={interactionForm.objections}
                  onChange={(e) =>
                    setInteractionForm({
                      ...interactionForm,
                      objections: e.target.value,
                    })
                  }
                  className="form-control"
                  rows="2"
                  placeholder="Any objections raised by the doctor"
                  required
                />
              </div>

              {/* Insights for Marketing Team */}
              <div className="form-group">
                <label>Insights for Marketing Team <span style={{color:'#e74c3c'}}>*</span></label>
                <textarea
                  value={interactionForm.insights_for_marketing}
                  onChange={(e) =>
                    setInteractionForm({
                      ...interactionForm,
                      insights_for_marketing: e.target.value,
                    })
                  }
                  className="form-control"
                  rows="2"
                  placeholder="Key insights for the marketing team"
                  required
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowInteractionForm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Interaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Previous MSL Visit Full Report Modal */}
      {selectedVisitReport && (
        <div className="modal-overlay" onClick={() => setSelectedVisitReport(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>

            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '2px solid #ede9fe', paddingBottom: '16px' }}>
              <div>
                <h2 style={{ margin: '0 0 6px 0', color: '#333', fontSize: '20px' }}>Visit Report</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: '700', fontSize: '13px'
                    }}>
                      {(selectedVisitReport.logged_by || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', color: '#333', fontSize: '15px' }}>{selectedVisitReport.logged_by}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>MSL</div>
                    </div>
                  </div>
                  <span style={{ color: '#aaa' }}>·</span>
                  <span style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>
                    {formatDate(selectedVisitReport.visit_date)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedVisitReport(null)}
                style={{ background: '#f0f0f0', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontWeight: '600', color: '#555' }}
              >
                Close
              </button>
            </div>

            {/* Report Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Brand + Interest Level row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {selectedVisitReport.brand_discussed && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Brand Discussed</div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#15803d' }}>{selectedVisitReport.brand_discussed}</div>
                  </div>
                )}
                {selectedVisitReport.interest_level && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#1d4ed8', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Interest Level</div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e40af' }}>{selectedVisitReport.interest_level}</div>
                  </div>
                )}
              </div>

              {selectedVisitReport.topics_discussed && (
                <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#667eea', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Topic Discussed</div>
                  <p style={{ margin: 0, color: '#444', lineHeight: '1.6', fontSize: '14px' }}>{selectedVisitReport.topics_discussed}</p>
                </div>
              )}

              {selectedVisitReport.summary && (
                <div style={{ background: '#f8f9ff', border: '1px solid #e0e3ff', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#667eea', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Discussion Summary</div>
                  <p style={{ margin: 0, color: '#444', lineHeight: '1.6', fontSize: '14px' }}>{selectedVisitReport.summary}</p>
                </div>
              )}

              {selectedVisitReport.outcomes && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#c2410c', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Outcome</div>
                  <p style={{ margin: 0, color: '#9a3412', fontWeight: '600', fontSize: '14px' }}>{selectedVisitReport.outcomes}</p>
                </div>
              )}

              {selectedVisitReport.objections && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Objections</div>
                  <p style={{ margin: 0, color: '#7f1d1d', lineHeight: '1.6', fontSize: '14px' }}>{selectedVisitReport.objections}</p>
                </div>
              )}

              {selectedVisitReport.insights_for_marketing && (
                <div style={{ background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Insights for Marketing</div>
                  <p style={{ margin: 0, color: '#4c1d95', lineHeight: '1.6', fontSize: '14px' }}>{selectedVisitReport.insights_for_marketing}</p>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestDetail;
