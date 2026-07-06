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
      if (response.data.employees && response.data.employees.length === 1) {
        setSelectedEmployee(response.data.employees[0]);
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

  useEffect(() => {
    // Check if user has access to this page
    const allowedRoles = ['Asst General Manager', 'Associate Vice President'];
    if (user && !allowedRoles.includes(user.role)) {
      navigate('/dashboard');
      return;
    }
    
    // Auto-fetch report when component mounts if user is logged in
    if (user) {
      fetchReport();
    }
  }, [user, navigate, reportType, month, year, selectedDate]); // Add dependencies for re-fetching on filter change

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
                  {months.map((m) => (
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
                  {years.map((y) => (
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
                  {selectedEmployee.work_type_breakdown && Object.entries(selectedEmployee.work_type_breakdown).map(
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
              {selectedEmployee.activity_category_breakdown && Object.keys(selectedEmployee.activity_category_breakdown).length > 0 && (
                <div className="section">
                  <h3>Activity Categories</h3>
                  <div className="category-tags">
                    {Object.entries(selectedEmployee.activity_category_breakdown).map(
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
              {selectedEmployee.daily_summary.length > 0 && (
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
                        {selectedEmployee.daily_summary.map((day, index) => (
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
              {selectedEmployee.doctor_interactions.length > 0 && (
                <div className="section">
                  <h3>Doctor Visit Details</h3>
                  <div className="interactions-list">
                    {selectedEmployee.doctor_interactions.map((interaction) => (
                      <div key={interaction.id} className="interaction-card">
                        <div className="interaction-header">
                          <span className="interaction-date">
                            {formatDate(interaction.visit_date)}
                          </span>
                          <span className="interaction-doctor">
                            {interaction.doctor_name}
                          </span>
                        </div>
                        {interaction.brands && interaction.brands.length > 0 && (
                            <div className="interaction-brands">
                                <strong>Brands:</strong>
                                {interaction.brands.map((brand) => brand.brand_name).join(", ")}
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
              {selectedEmployee.office_activities.length > 0 && (
                <div className="section">
                  <h3>Office Activity Details</h3>
                  <div className="activities-list">
                    {selectedEmployee.office_activities.map((activity) => (
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

          {!selectedEmployee && report.employees.length > 0 && (
            <div className="select-prompt">
              <p>👆 Click on an employee tab above to view detailed report</p>
            </div>
          )}

          {report.employees.length === 0 && (
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
          
          {report.employees.length > 0 && (
            <div className="employee-selector">
              <h3>Select Employee to View Details</h3>
              <div className="employee-tabs">
                {report.employees.map((emp, index) => (
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
              {selectedEmployee.doctor_interactions.length > 0 && (
                <div className="section">
                  <h3>Doctor Visit Details</h3>
                  <div className="interactions-list">
                    {selectedEmployee.doctor_interactions.map((interaction) => (
                      <div key={interaction.id} className="interaction-card">
                        <div className="interaction-header">
                          <span className="interaction-date">
                            {formatDate(interaction.visit_date)}
                          </span>
                          <span className="interaction-doctor">
                            {interaction.doctor_name}
                          </span>
                        </div>
                        {interaction.brands && interaction.brands.length > 0 && (
                            <div className="interaction-brands">
                                <strong>Brands:</strong>
                                {interaction.brands.map((brand) => brand.brand_name).join(", ")}
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
              {selectedEmployee.office_activities.length > 0 && (
                <div className="section">
                  <h3>Office Activity Details</h3>
                  <div className="activities-list">
                    {selectedEmployee.office_activities.map((activity) => (
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

          {!selectedEmployee && report.employees.length > 0 && (
            <div className="select-prompt">
              <p>👆 Click on an employee tab above to view detailed report</p>
            </div>
          )}

          {report.employees.length === 0 && (
              <p className="no-data-message">No daily report data available for the selected criteria.</p>
          )}
        </div>
      )}

      {!report && !loading && !error && (
        <div className="initial-message">
          <p>Select criteria and generate a report to see employee activity.</p>
        </div>
      )}
    </div>
  );
};

export default MonthlyReport;
