import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { reportService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "../styles/MonthlyReport.css";

const MonthlyReport = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [employeeIds, setEmployeeIds] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [reportType, setReportType] = useState('monthly'); // 'monthly' or 'daily'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD

  // Safe default variables to prevent crashes
  const reportEmployees = report?.employees ?? [];
  const selectedEmpDailySummary = selectedEmployee?.daily_summary ?? [];
  const selectedEmpDoctorInteractions = selectedEmployee?.doctor_interactions ?? [];
  const selectedEmpOfficeActivities = selectedEmployee?.office_activities ?? [];
  const selectedEmpWorkTypeBreakdown = selectedEmployee?.work_type_breakdown ?? {};
  const selectedEmpActivityCategoryBreakdown = selectedEmployee?.activity_category_breakdown ?? {};

  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      let response;
      if (reportType === 'monthly') {
        response = await reportService.getMonthlySummary(month, year, employeeIds);
      } else {
        response = await reportService.getDailySummary(selectedDate, employeeIds);
      }
      setReport(response.data);
      // Auto-select first employee if only one result
      const respEmployees = response.data?.employees ?? [];
      if (respEmployees.length === 1) {
        setSelectedEmployee(respEmployees[0]);
      } else {
        setSelectedEmployee(null);
      }
    } catch (err) {
      console.error("Error fetching report:", err);
      setError(err.response?.data?.detail || "Failed to fetch report");
    } finally {
      setLoading(false);
    }
  };

  // Effect 1: Handles user authorization and redirection
  // This useEffect is responsible only for checking user roles and redirecting
  // if the user does not have the necessary permissions. It runs when 'user' or 'navigate' changes.
  // Splitting this from data fetching prevents unnecessary re-renders or navigation loops
  // that can occur if authorization and data fetching are intertwined.
  useEffect(() => {
    const allowedRoles = ['Asst General Manager', 'Associate Vice President', 'BM'];
    // Guard clause: If user object is not yet available, do nothing.
    // This prevents trying to access user.role before the user context is loaded.
    if (!user) {
      return;
    }

    // Check if the user's role is allowed. If not, redirect to dashboard.
    // The 'replace: true' option prevents the user from navigating back to this unauthorized page.
    if (!allowedRoles.includes(user.role)) {
      navigate("/requests", { replace: true });
    }
  }, [user, navigate]); // Dependencies: user (to react to login/logout) and navigate (stable reference)

  // Effect 2: Handles fetching report data when filters change if an employee ID is entered
  useEffect(() => {
    if (!user) {
      return;
    }
    if (employeeIds.trim()) {
      fetchReport();
    } else {
      setReport(null);
      setSelectedEmployee(null);
    }
  }, [user, reportType, month, year, selectedDate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchReport();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getWorkTypeColor = (workType) => {
    switch (workType) {
      case "both done":
        return "#28a745";
      case "worked at office":
        return "#007bff";
      case "call supported":
        return "#ffc107";
      default:
        return "#6c757d";
    }
  };

  return (
    <div className="monthly-report">
      <div className="report-header">
        <h1>Employee Working Summary</h1>
        <p className="report-subtitle">
          Detailed report of employee activities, doctor visits, and office work
        </p>
      </div>

      <div className="report-filters">
        <div className="report-type-selector">
          <label>
            <input
              type="radio"
              value="monthly"
              checked={reportType === 'monthly'}
              onChange={() => setReportType('monthly')}
            />
            Monthly Report
          </label>
          <label>
            <input
              type="radio"
              value="daily"
              checked={reportType === 'daily'}
              onChange={() => setReportType('daily')}
            />
            Daily Report
          </label>
        </div>

        <form onSubmit={handleSubmit} className="filters-form">
          {reportType === 'monthly' && (
            <>
              <div className="filter-group">
                <label htmlFor="month">Month</label>
                <select
                  id="month"
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}>
                  {(months ?? []).map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="year">Year</label>
                <select
                  id="year"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}>
                  {(years ?? []).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {reportType === 'daily' && (
            <div className="filter-group">
              <label htmlFor="reportDate">Date</label>
              <input
                type="date"
                id="reportDate"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          )}

          <div className="filter-group filter-group-large">
            <label htmlFor="employeeIds">Employee IDs (comma-separated)</label>
            <input
              type="text"
              id="employeeIds"
              value={employeeIds}
              onChange={(e) => setEmployeeIds(e.target.value)}
              placeholder="Employee id"
            />
          </div>

          <button type="submit" className="btn-generate" disabled={loading}>
            {loading ? "Generating..." : "Generate Report"}
          </button>
        </form>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Generating report...</p>
        </div>
      )}

      {report && !loading && reportType === 'monthly' && (
        <div className="report-content">
          {/* Overall Summary */}
          <div className="overall-summary">
            <h2>
              {report.report_month_name} {report.report_year} - Overall Summary
            </h2>
            <div className="summary-cards">
              <div className="summary-card">
                <div className="card-icon">👥</div>
                <div className="card-content">
                  <span className="card-value">{report.total_employees}</span>
                  <span className="card-label">Total Employees</span>
                </div>
              </div>
              <div className="summary-card">
                <div className="card-icon">🏥</div>
                <div className="card-content">
                  <span className="card-value">{report.total_doctor_visits_all}</span>
                  <span className="card-label">Total Doctor Visits</span>
                </div>
              </div>
              <div className="summary-card">
                <div className="card-icon">📋</div>
                <div className="card-content">
                  <span className="card-value">{report.total_office_activities_all}</span>
                  <span className="card-label">Office Activities</span>
                </div>
              </div>
              <div className="summary-card">
                <div className="card-icon">⏰</div>
                <div className="card-content">
                  <span className="card-value">{report.total_hours_worked_all}</span>
                  <span className="card-label">Total Hours Worked</span>
                </div>
              </div>
            </div>
          </div>



          {/* Employee Detail View */}
          {selectedEmployee && (
            <div className="employee-detail">
              <div className="detail-header">
                <h2>
                  {selectedEmployee.employee_name}{" "}
                  <span className="detail-id">({selectedEmployee.employee_id})</span>
                </h2>
                <span className="detail-period">
                  {selectedEmployee.month_name} {selectedEmployee.year}
                </span>
              </div>

              {/* Employee Information & Hierarchy */}
              <div className="section employee-info-section">
                <h3>Employee Details & Reportings</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Role:</span>
                    <span className="info-value">{selectedEmployee.role || "N/A"}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Territory:</span>
                    <span className="info-value">{selectedEmployee.territory || "N/A"}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Region:</span>
                    <span className="info-value">{selectedEmployee.region || "N/A"}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">HQ:</span>
                    <span className="info-value">{selectedEmployee.hq || "N/A"}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Reporting Manager:</span>
                    <span className="info-value">
                      {selectedEmployee.reporting_manager || "N/A"}{" "}
                      {selectedEmployee.reporting_manager_code ? `(${selectedEmployee.reporting_manager_code})` : ""}
                    </span>
                  </div>
                </div>

                {selectedEmployee.direct_reports && selectedEmployee.direct_reports.length > 0 && (
                  <div className="direct-reports-wrapper" style={{ marginTop: '20px' }}>
                    <h4 style={{ fontSize: '1.05rem', color: '#2c3e50', marginBottom: '10px' }}>Direct Reportings ({selectedEmployee.direct_reports.length})</h4>
                    <div className="daily-summary-table-wrapper">
                      <table className="daily-summary-table">
                        <thead>
                          <tr>
                            <th>Emp ID</th>
                            <th>Emp Name</th>
                            <th>Role</th>
                            <th>Territory</th>
                            <th>Region</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEmployee.direct_reports.map((rep, idx) => (
                            <tr key={idx}>
                              <td><strong>{rep.employee_id}</strong></td>
                              <td>{rep.employee_name}</td>
                              <td>{rep.role || "-"}</td>
                              <td>{rep.territory || "-"}</td>
                              <td>{rep.region || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Employee Summary Cards */}
              <div className="summary-cards employee-cards">
                <div className="summary-card">
                  <div className="card-icon">🩺</div>
                  <div className="card-content">
                    <span className="card-value">
                      {selectedEmployee.total_doctor_visits}
                    </span>
                    <span className="card-label">Doctor Visits</span>
                  </div>
                </div>
                <div className="summary-card">
                  <div className="card-icon">👨‍⚕️</div>
                  <div className="card-content">
                    <span className="card-value">
                      {selectedEmployee.unique_doctors_visited}
                    </span>
                    <span className="card-label">Unique Doctors</span>
                  </div>
                </div>
                <div className="summary-card">
                  <div className="card-icon">📝</div>
                  <div className="card-content">
                    <span className="card-value">
                      {selectedEmployee.total_office_activities}
                    </span>
                    <span className="card-label">Office Activities</span>
                  </div>
                </div>
                <div className="summary-card">
                  <div className="card-icon">🕐</div>
                  <div className="card-content">
                    <span className="card-value">
                      {selectedEmployee.total_hours_worked}
                    </span>
                    <span className="card-label">Hours Worked</span>
                  </div>
                </div>
              </div>

              {/* Work Type Breakdown */}
              <div className="section">
                <h3>Work Type Distribution</h3>
                <div className="work-type-grid">
                  {Object.entries(selectedEmpWorkTypeBreakdown).map(
                    ([type, count]) => (
                      <div
                        key={type}
                        className="work-type-card"
                        style={{ borderColor: getWorkTypeColor(type) }}
                      >
                        <span
                          className="work-type-dot"
                          style={{ backgroundColor: getWorkTypeColor(type) }}
                        ></span>
                        <span className="work-type-name">{type}</span>
                        <span className="work-type-count">{count} days</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Activity Categories */}
              {Object.keys(selectedEmpActivityCategoryBreakdown).length > 0 && (
                <div className="section">
                  <h3>Activity Categories</h3>
                  <div className="category-tags">
                    {Object.entries(selectedEmpActivityCategoryBreakdown).map(
                      ([category, count], index) => (
                        <span key={`${category}-${index}`} className="category-tag">
                          {category}: <strong>{count}</strong>
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Daily Summary */}
              {selectedEmpDailySummary.length > 0 && (
                <div className="section">
                  <h3>Daily Activity Summary</h3>
                  <div className="daily-summary-table-wrapper">
                    <table className="daily-summary-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Day</th>
                          <th>Doctor Visits</th>
                          <th>Office Activities</th>
                          <th>Hours</th>
                          <th>Work Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedEmpDailySummary.map((day, index) => (
                          <tr key={index}>
                            <td>{formatDate(day.date)}</td>
                            <td>{day.day}</td>
                            <td>{day.doctor_visits}</td>
                            <td>{day.office_activities}</td>
                            <td>{day.hours_worked.toFixed(1)}</td>
                            <td>
                              <span
                                className="work-type-badge"
                                style={{
                                  backgroundColor: getWorkTypeColor(day.work_type),
                                }}
                              >
                                {day.work_type}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Doctor Interactions Detail */}
              {selectedEmpDoctorInteractions.length > 0 && (
                <div className="section">
                  <h3>Doctor Visit Details</h3>
                  <div className="interactions-list">
                    {selectedEmpDoctorInteractions.map((interaction) => (
                      <div key={interaction.id} className="interaction-card">
                        <div className="interaction-header">
                          <span className="interaction-date">
                            {formatDate(interaction.visit_date)}
                          </span>
                          <span className="interaction-doctor">
                            {interaction.doctor_name}
                          </span>
                        </div>
                        {(interaction?.brands ?? []).length > 0 && (
                            <div className="interaction-brands">
                                <strong>Brands:</strong>
                                {(interaction?.brands ?? []).map((brand) => brand.brand_name).join(", ")}
                            </div>
                          )}
                        {interaction.objections && (
                          <div className="interaction-objections">
                            Objections: {interaction.objections}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Office Activities Detail */}
              {selectedEmpOfficeActivities.length > 0 && (
                <div className="section">
                  <h3>Office Activity Details</h3>
                  <div className="activities-list">
                    {selectedEmpOfficeActivities.map((activity) => (
                      <div key={activity.id} className="activity-card">
                        <div className="activity-header">
                          <span className="activity-date">
                            {formatDate(activity.activity_date)}
                          </span>
                          <span className="activity-category">
                            {activity.activity_category}
                          </span>
                        </div>
                        {activity.hours_worked > 0 && (
                          <div className="activity-hours">
                            Hours: {activity.hours_worked}
                          </div>
                        )}
                        {activity.doctors_visited > 0 && (
                          <div className="activity-doctors">
                            Doctors Visited: {activity.doctors_visited}
                          </div>
                        )}
                        {activity.work_type && (
                          <div className="activity-work-type">
                            <span
                              className="work-type-badge"
                              style={{
                                backgroundColor: getWorkTypeColor(activity.work_type),
                              }}
                            >
                              {activity.work_type}
                            </span>
                          </div>
                        )}
                        {activity.summary && (
                          <div className="activity-summary">
                            <strong>Summary:</strong> {activity.summary}
                          </div>
                        )}
                        {activity.linked_outputs && (
                          <div className="activity-outputs">
                            <strong>Linked Outputs:</strong> {activity.linked_outputs}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!selectedEmployee && reportEmployees.length > 0 && (
            <div className="select-prompt">
              <p>👆 Click on an employee tab above to view detailed report</p>
            </div>
          )}

          {reportEmployees.length === 0 && (
              <p className="no-data-message">No monthly report data available for the selected criteria.</p>
          )}
        </div>
      )}

      {report && !loading && reportType === 'daily' && (
        <div className="report-content">
          <div className="overall-summary">
            <h2>
              {report.report_day_name}, {formatDate(report.report_date)} - Daily Summary
            </h2>
          </div>
          
          {reportEmployees.length > 0 && (
            <div className="employee-selector">
              <h3>Select Employee to View Details</h3>
              <div className="employee-tabs">
                {reportEmployees.map((emp, index) => (
                  <button
                    key={`emp-${index}`}
                    className={`employee-tab ${
                      selectedEmployee?.employee_id === emp.employee_id ? "active" : ""
                    }`}
                    onClick={() => setSelectedEmployee(emp)}
                  >
                    <span className="tab-name">{emp.employee_name}</span>
                    <span className="tab-id">({emp.employee_id})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedEmployee && (
            <div className="employee-detail">
              <div className="detail-header">
                <h2>
                  {selectedEmployee.employee_name}{" "}
                  <span className="detail-id">({selectedEmployee.employee_id})</span>
                </h2>
                <span className="detail-period">
                  {selectedEmployee.day_name}, {formatDate(selectedEmployee.report_date)}
                </span>
              </div>

              {/* Employee Summary Cards (Daily) */}
              <div className="summary-cards employee-cards">
                <div className="summary-card">
                  <div className="card-icon">🩺</div>
                  <div className="card-content">
                    <span className="card-value">
                      {selectedEmployee.total_doctor_visits}
                    </span>
                    <span className="card-label">Doctor Visits</span>
                  </div>
                </div>
                <div className="summary-card">
                  <div className="card-icon">👨‍⚕️</div>
                  <div className="card-content">
                    <span className="card-value">
                      {selectedEmployee.unique_doctors_visited}
                    </span>
                    <span className="card-label">Unique Doctors</span>
                  </div>
                </div>
                <div className="summary-card">
                  <div className="card-icon">📝</div>
                  <div className="card-content">
                    <span className="card-value">
                      {selectedEmployee.total_office_activities}
                    </span>
                    <span className="card-label">Office Activities</span>
                  </div>
                </div>
                <div className="summary-card">
                  <div className="card-icon">🕐</div>
                  <div className="card-content">
                    <span className="card-value">
                      {selectedEmployee.total_hours_worked}
                    </span>
                    <span className="card-label">Hours Worked</span>
                  </div>
                </div>
              </div>

              {/* Work Type for the Day */}
              {selectedEmployee.work_type && selectedEmployee.work_type !== "nothing done" && (
                <div className="section">
                  <h3>Work Type</h3>
                  <div className="work-type-single">
                    <span
                      className="work-type-badge large"
                      style={{ backgroundColor: getWorkTypeColor(selectedEmployee.work_type) }}
                    >
                      {selectedEmployee.work_type}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Doctor Interactions Detail (Daily) */}
              {selectedEmpDoctorInteractions.length > 0 && (
                <div className="section">
                  <h3>Doctor Visit Details</h3>
                  <div className="interactions-list">
                    {selectedEmpDoctorInteractions.map((interaction) => (
                      <div key={interaction.id} className="interaction-card">
                        <div className="interaction-header">
                          <span className="interaction-date">
                            {formatDate(interaction.visit_date)}
                          </span>
                          <span className="interaction-doctor">
                            {interaction.doctor_name}
                          </span>
                        </div>
                        {(interaction?.brands ?? []).length > 0 && (
                            <div className="interaction-brands">
                                <strong>Brands:</strong>
                                {(interaction?.brands ?? []).map((brand) => brand.brand_name).join(", ")}
                            </div>
                          )}
                        {interaction.objections && (
                          <div className="interaction-objections">
                            Objections: {interaction.objections}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Office Activities Detail (Daily) */}
              {selectedEmpOfficeActivities.length > 0 && (
                <div className="section">
                  <h3>Office Activity Details</h3>
                  <div className="activities-list">
                    {selectedEmpOfficeActivities.map((activity) => (
                      <div key={activity.id} className="activity-card">
                        <div className="activity-header">
                          <span className="activity-date">
                            {formatDate(activity.activity_date)}
                          </span>
                          <span className="activity-category">
                            {activity.activity_category}
                          </span>
                        </div>
                        {activity.hours_worked > 0 && (
                          <div className="activity-hours">
                            Hours: {activity.hours_worked}
                          </div>
                        )}
                        {activity.doctors_visited > 0 && (
                          <div className="activity-doctors">
                            Doctors Visited: {activity.doctors_visited}
                          </div>
                        )}
                        {activity.work_type && (
                          <div className="activity-work-type">
                            <span
                              className="work-type-badge"
                              style={{
                                backgroundColor: getWorkTypeColor(activity.work_type),
                              }}
                            >
                              {activity.work_type}
                            </span>
                          </div>
                        )}
                        {activity.summary && (
                          <div className="activity-summary">
                            <strong>Summary:</strong> {activity.summary}
                          </div>
                        )}
                        {activity.linked_outputs && (
                          <div className="activity-outputs">
                            <strong>Linked Outputs:</strong> {activity.linked_outputs}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!selectedEmployee && reportEmployees.length > 0 && (
            <div className="select-prompt">
              <p>👆 Click on an employee tab above to view detailed report</p>
            </div>
          )}

          {reportEmployees.length === 0 && (
              <p className="no-data-message">No daily report data available for the selected criteria.</p>
          )}
        </div>
      )}

      {!report && !loading && !error && (
        <div className="initial-message">
          <p>Please enter an Employee ID above and click "Generate Report" to view monthly report and reportings.</p>
        </div>
      )}
    </div>
  );
};

export default MonthlyReport;
