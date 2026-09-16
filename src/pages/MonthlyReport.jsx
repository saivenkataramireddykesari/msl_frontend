import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { reportService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  exportMonthlyReportToExcel,
  exportDailyReportToExcel,
  exportMonthlyReportToPDF,
  exportDailyReportToPDF,
  exportSODoctorVisitsToExcel,
} from "../utils/reportExport";
import "../styles/MonthlyReport.css";

const MonthlyReport = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Filter States
  const [reportType, setReportType] = useState("monthly"); // 'monthly' or 'daily'
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]); // YYYY-MM-DD
  const [selectedRole, setSelectedRole] = useState("All");
  const [employeeIds, setEmployeeIds] = useState("");
  const [availableRoles, setAvailableRoles] = useState([]);

  // Data & UI States
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [isExporting, setIsExporting] = useState(false);

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

  // Check authorization
  useEffect(() => {
    const allowedRoles = ["Admin", "admin", "BM", "Asst General Manager", "Associate Vice President"];
    if (!user) return;
    if (!allowedRoles.includes(user.role)) {
      navigate("/requests", { replace: true });
    }
  }, [user, navigate]);

  // Load distinct roles for dropdown
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await reportService.getRoles();
        if (Array.isArray(res.data) && res.data.length > 0) {
          setAvailableRoles(res.data);
        } else {
          setAvailableRoles([
            "MSL",
            "Scientific Officer",
            "BM",
            "BL",
            "BH",
            "BE",
            "TE",
            "KAE",
            "NE",
            "Asst General Manager",
            "Associate Vice President",
          ]);
        }
      } catch (err) {
        console.warn("Could not load roles dynamically, using defaults:", err);
        setAvailableRoles([
          "MSL",
          "Scientific Officer",
          "BM",
          "BL",
          "BH",
          "BE",
          "TE",
          "KAE",
          "NE",
          "Asst General Manager",
          "Associate Vice President",
        ]);
      }
    };
    fetchRoles();
  }, []);

  // Fetch report function
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let response;
      if (reportType === "monthly") {
        response = await reportService.getMonthlySummary(
          month,
          year,
          employeeIds.trim() || null,
          selectedRole !== "All" ? selectedRole : null
        );
      } else {
        response = await reportService.getDailySummary(
          selectedDate,
          employeeIds.trim() || null,
          selectedRole !== "All" ? selectedRole : null
        );
      }
      setReport(response.data);

      const respEmployees = response.data?.employees ?? [];
      // If exactly 1 employee matches, auto-select them for convenience
      if (respEmployees.length === 1) {
        setSelectedEmployee(respEmployees[0]);
      } else {
        setSelectedEmployee(null);
      }
    } catch (err) {
      console.error("Error fetching report:", err);
      setError(err.response?.data?.detail || "Failed to fetch report data. Please check your filter criteria.");
      setReport(null);
      setSelectedEmployee(null);
    } finally {
      setLoading(false);
    }
  }, [reportType, month, year, selectedDate, employeeIds, selectedRole]);

  // Initial load / auto-fetch on filter change
  useEffect(() => {
    if (user) {
      fetchReport();
    }
  }, [user, reportType, month, year, selectedDate, selectedRole, fetchReport]);

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchReport();
  };

  // Filtered employees list based on search term
  const filteredEmployees = useMemo(() => {
    const employees = report?.employees ?? [];
    if (!searchFilter.trim()) return employees;
    const term = searchFilter.toLowerCase().trim();
    return employees.filter(
      (emp) =>
        emp.employee_name?.toLowerCase().includes(term) ||
        emp.employee_id?.toLowerCase().includes(term) ||
        emp.role?.toLowerCase().includes(term) ||
        emp.territory?.toLowerCase().includes(term) ||
        emp.region?.toLowerCase().includes(term)
    );
  }, [report?.employees, searchFilter]);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return String(dateString);
      return d.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(dateString);
    }
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

  // Export handlers
  const handleExportExcel = (targetEmp = null) => {
    try {
      setIsExporting(true);
      if (reportType === "monthly") {
        exportMonthlyReportToExcel(report, selectedRole, targetEmp);
      } else {
        exportDailyReportToExcel(report, selectedRole, targetEmp);
      }
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Failed to export Excel report: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = (targetEmp = null) => {
    try {
      setIsExporting(true);
      if (reportType === "monthly") {
        exportMonthlyReportToPDF(report, selectedRole, targetEmp);
      } else {
        exportDailyReportToPDF(report, selectedRole, targetEmp);
      }
    } catch (err) {
      console.error("PDF export error:", err);
      alert("Failed to export PDF report: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Dedicated SO Doctor Visits Export
  const handleExportSODoctorVisits = (targetEmp = null) => {
    try {
      setIsExporting(true);
      exportSODoctorVisitsToExcel(report, selectedRole, targetEmp);
    } catch (err) {
      console.error("SO Doctor Visits export error:", err);
      alert("Failed to export SO Doctor Visits: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const selectedEmpDailySummary = selectedEmployee?.daily_summary ?? [];
  const selectedEmpDoctorInteractions = selectedEmployee?.doctor_interactions ?? [];
  const selectedEmpOfficeActivities = selectedEmployee?.office_activities ?? [];
  const selectedEmpWorkTypeBreakdown = selectedEmployee?.work_type_breakdown ?? {};
  const selectedEmpActivityCategoryBreakdown = selectedEmployee?.activity_category_breakdown ?? {};

  return (
    <div className="monthly-report">
      <div className="report-header">
        <h1>Employee Performance & Working Summary</h1>
        <p className="report-subtitle">
          Monitor and export comprehensive daily and monthly activity reports by employee and organizational role
        </p>
      </div>

      {/* Main Filter Control Bar */}
      <div className="report-filters">
        <div className="report-type-selector">
          <label className={`type-radio ${reportType === "monthly" ? "active" : ""}`}>
            <input
              type="radio"
              value="monthly"
              checked={reportType === "monthly"}
              onChange={() => {
                setReportType("monthly");
                setSelectedEmployee(null);
              }}
            />
            📅 Monthly Report
          </label>
          <label className={`type-radio ${reportType === "daily" ? "active" : ""}`}>
            <input
              type="radio"
              value="daily"
              checked={reportType === "daily"}
              onChange={() => {
                setReportType("daily");
                setSelectedEmployee(null);
              }}
            />
            📆 Daily Report
          </label>
        </div>

        <form onSubmit={handleSubmit} className="filters-form">
          {/* Role Filter Dropdown */}
          <div className="filter-group">
            <label htmlFor="roleFilter">Employee Role</label>
            <select
              id="roleFilter"
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setSelectedEmployee(null);
              }}
            >
              <option value="All">All Roles</option>
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Month / Year for Monthly Report */}
          {reportType === "monthly" && (
            <>
              <div className="filter-group">
                <label htmlFor="month">Month</label>
                <select
                  id="month"
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                >
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
                  onChange={(e) => setYear(parseInt(e.target.value))}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Date Picker for Daily Report */}
          {reportType === "daily" && (
            <div className="filter-group">
              <label htmlFor="reportDate">Report Date</label>
              <input
                type="date"
                id="reportDate"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          )}

          {/* Employee ID search */}
          <div className="filter-group filter-group-large">
            <label htmlFor="employeeIds">Employee ID(s) (Optional)</label>
            <input
              type="text"
              id="employeeIds"
              value={employeeIds}
              onChange={(e) => setEmployeeIds(e.target.value)}
              placeholder="All employees or e.g. E9250, E5057"
            />
          </div>

          <div className="filter-actions">
            <button type="submit" className="btn-generate" disabled={loading}>
              {loading ? "Generating..." : "🔍 Generate Report"}
            </button>
          </div>
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
          <p>Generating working report...</p>
        </div>
      )}

      {report && !loading && (
        <div className="report-content">
          {/* Header & Download Bar */}
          <div className="report-action-header">
            <div className="report-title-info">
              <h2>
                {reportType === "monthly"
                  ? `${report.report_month_name} ${report.report_year} Working Report`
                  : `${report.report_day_name}, ${formatDate(report.report_date)} Daily Report`}
              </h2>
              <span className="role-tag-badge">
                Role Filter: <strong>{selectedRole === "All" ? "All Roles" : selectedRole}</strong>
              </span>
              <span className="count-tag-badge">
                {report.employees?.length ?? 0} {report.employees?.length === 1 ? "Employee" : "Employees"} Found
              </span>
            </div>

            {/* Bulk / Role Export Buttons */}
            <div className="export-buttons-group">
              {/* Option to download SO Doctor Visit Data */}
              <button
                className="btn-export btn-export-so-visits"
                onClick={() => handleExportSODoctorVisits(null)}
                disabled={isExporting || (report.employees || []).length === 0}
                title="Download complete SO Doctor Visits data for the selected month in Excel (.xlsx)"
              >
                🩺 Download SO Doctor Visits (.xlsx)
              </button>
              <button
                className="btn-export btn-export-excel"
                onClick={() => handleExportExcel(null)}
                disabled={isExporting || (report.employees || []).length === 0}
                title="Download complete report in Excel (.xlsx)"
              >
                📥 Full Report (.xlsx)
              </button>
              <button
                className="btn-export btn-export-pdf"
                onClick={() => handleExportPDF(null)}
                disabled={isExporting || (report.employees || []).length === 0}
                title="Download formatted summary PDF"
              >
                📄 Download PDF
              </button>
            </div>
          </div>

          {/* Overall Metrics Cards (Monthly) */}
          {reportType === "monthly" && (
            <div className="overall-summary">
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
                    <span className="card-value">{report.total_hours_worked_all} hrs</span>
                    <span className="card-label">Total Hours Worked</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Employees Overview Table (Shows all matching employees) */}
          <div className="employees-table-container">
            <div className="table-header-bar">
              <h3>
                {selectedRole === "All" ? "All Employees Summary" : `${selectedRole} Employees Summary`} (
                {filteredEmployees.length})
              </h3>
              <div className="table-search-box">
                <input
                  type="text"
                  placeholder="🔎 Filter by Name, ID, Territory, Region..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="table-search-input"
                />
              </div>
            </div>

            {filteredEmployees.length > 0 ? (
              <div className="table-responsive">
                <table className="employees-overview-table">
                  <thead>
                    <tr>
                      <th>Emp ID</th>
                      <th>Employee Name</th>
                      <th>Role</th>
                      <th>Territory / Region</th>
                      <th>Doctor Visits</th>
                      <th>Unique Doctors</th>
                      <th>Office Activities</th>
                      <th>Hours Worked</th>
                      {reportType === "daily" ? <th>Work Type</th> : <th>Work Breakdown</th>}
                      <th>Actions & Downloads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp) => {
                      const isSelected = selectedEmployee?.employee_id === emp.employee_id;
                      return (
                        <tr
                          key={emp.employee_id}
                          className={isSelected ? "selected-row" : ""}
                          onClick={() => setSelectedEmployee(emp)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <strong>{emp.employee_id}</strong>
                          </td>
                          <td>
                            <span className="emp-name-text">{emp.employee_name}</span>
                          </td>
                          <td>
                            <span className="role-pill">{emp.role || "-"}</span>
                          </td>
                          <td>
                            <div className="location-cell">
                              <span>{emp.territory || "-"}</span>
                              {emp.region && <small className="region-sub">{emp.region}</small>}
                            </div>
                          </td>
                          <td>
                            <span className="metric-badge visits-badge">{emp.total_doctor_visits}</span>
                          </td>
                          <td>{emp.unique_doctors_visited}</td>
                          <td>
                            <span className="metric-badge activities-badge">{emp.total_office_activities}</span>
                          </td>
                          <td>
                            <strong>{emp.total_hours_worked} hrs</strong>
                          </td>
                          <td>
                            {reportType === "daily" ? (
                              <span
                                className="work-type-badge"
                                style={{
                                  backgroundColor: getWorkTypeColor(emp.work_type),
                                }}
                              >
                                {emp.work_type || "nothing done"}
                              </span>
                            ) : (
                              <div className="work-breakdown-compact">
                                {emp.work_type_breakdown?.["both done"] > 0 && (
                                  <span className="breakdown-dot both" title="Both done">
                                    Both: {emp.work_type_breakdown["both done"]}
                                  </span>
                                )}
                                {emp.work_type_breakdown?.["worked at office"] > 0 && (
                                  <span className="breakdown-dot office" title="Worked at office">
                                    Office: {emp.work_type_breakdown["worked at office"]}
                                  </span>
                                )}
                                {emp.work_type_breakdown?.["call supported"] > 0 && (
                                  <span className="breakdown-dot call" title="Call supported">
                                    Field: {emp.work_type_breakdown["call supported"]}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="row-action-buttons">
                              <button
                                className={`btn-row-action ${isSelected ? "btn-active" : "btn-view"}`}
                                onClick={() => setSelectedEmployee(emp)}
                                title="View detailed breakdown"
                              >
                                {isSelected ? "✓ Active" : "👁️ View"}
                              </button>
                              {/* Option to download this individual SO's doctor visits */}
                              <button
                                className="btn-row-action btn-so-visits"
                                onClick={() => handleExportSODoctorVisits(emp)}
                                title={`Download ${emp.employee_name}'s Doctor Visits (${emp.total_doctor_visits || 0}) for this month`}
                              >
                                🩺 Visits ({emp.total_doctor_visits || 0})
                              </button>
                              <button
                                className="btn-row-download"
                                onClick={() => handleExportExcel(emp)}
                                title="Download complete Excel summary for this employee"
                              >
                                📥
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="no-data-message">
                {searchFilter ? "No employees match your search query." : "No employees found for the selected criteria."}
              </p>
            )}
          </div>

          {/* Detailed View of Selected Employee */}
          {selectedEmployee && (
            <div className="employee-detail">
              <div className="detail-header">
                <div>
                  <h2>
                    {selectedEmployee.employee_name}{" "}
                    <span className="detail-id">({selectedEmployee.employee_id})</span>
                  </h2>
                  <span className="role-pill large">{selectedEmployee.role || "N/A"}</span>
                </div>

                <div className="detail-header-actions">
                  <span className="detail-period">
                    {reportType === "monthly"
                      ? `${selectedEmployee.month_name} ${selectedEmployee.year}`
                      : `${selectedEmployee.day_name}, ${formatDate(selectedEmployee.report_date)}`}
                  </span>

                  {/* Individual SO Doctor Visits Download */}
                  <button
                    className="btn-export btn-export-so-visits btn-sm"
                    onClick={() => handleExportSODoctorVisits(selectedEmployee)}
                    title="Download this SO's Doctor Visits in Excel"
                  >
                    🩺 Doctor Visits ({selectedEmployee.total_doctor_visits || 0})
                  </button>

                  {/* Individual Employee Full Excel Download */}
                  <button
                    className="btn-export btn-export-excel btn-sm"
                    onClick={() => handleExportExcel(selectedEmployee)}
                    title="Download this employee's complete report in Excel"
                  >
                    📥 Full Report (.xlsx)
                  </button>
                  <button
                    className="btn-export btn-export-pdf btn-sm"
                    onClick={() => handleExportPDF(selectedEmployee)}
                    title="Download this employee's report in PDF"
                  >
                    📄 PDF
                  </button>
                  <button
                    className="btn-close-detail"
                    onClick={() => setSelectedEmployee(null)}
                    title="Close detailed view"
                  >
                    ✖ Close
                  </button>
                </div>
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
                  <div className="direct-reports-wrapper" style={{ marginTop: "20px" }}>
                    <h4 style={{ fontSize: "1.05rem", color: "#2c3e50", marginBottom: "10px" }}>
                      Direct Reportings ({selectedEmployee.direct_reports.length})
                    </h4>
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
                              <td>
                                <strong>{rep.employee_id}</strong>
                              </td>
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
                    <span className="card-value">{selectedEmployee.total_doctor_visits}</span>
                    <span className="card-label">Doctor Visits</span>
                  </div>
                </div>
                <div className="summary-card">
                  <div className="card-icon">👨‍⚕️</div>
                  <div className="card-content">
                    <span className="card-value">{selectedEmployee.unique_doctors_visited}</span>
                    <span className="card-label">Unique Doctors</span>
                  </div>
                </div>
                <div className="summary-card">
                  <div className="card-icon">📝</div>
                  <div className="card-content">
                    <span className="card-value">{selectedEmployee.total_office_activities}</span>
                    <span className="card-label">Office Activities</span>
                  </div>
                </div>
                <div className="summary-card">
                  <div className="card-icon">🕐</div>
                  <div className="card-content">
                    <span className="card-value">{selectedEmployee.total_hours_worked}</span>
                    <span className="card-label">Hours Worked</span>
                  </div>
                </div>
              </div>

              {/* Work Type Breakdown (for Monthly) */}
              {reportType === "monthly" && (
                <div className="section">
                  <h3>Work Type Distribution</h3>
                  <div className="work-type-grid">
                    {Object.entries(selectedEmpWorkTypeBreakdown).map(([type, count]) => (
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
                    ))}
                  </div>
                </div>
              )}

              {/* Work Type (for Daily) */}
              {reportType === "daily" && selectedEmployee.work_type && (
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

              {/* Activity Categories */}
              {Object.keys(selectedEmpActivityCategoryBreakdown).length > 0 && (
                <div className="section">
                  <h3>Activity Categories</h3>
                  <div className="category-tags">
                    {Object.entries(selectedEmpActivityCategoryBreakdown).map(([category, count], index) => (
                      <span key={`${category}-${index}`} className="category-tag">
                        {category}: <strong>{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily Activity Breakdown Table (for Monthly report) */}
              {reportType === "monthly" && selectedEmpDailySummary.length > 0 && (
                <div className="section">
                  <h3>Daily Activity Breakdown</h3>
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

              {/* Doctor Visits Detail */}
              {selectedEmpDoctorInteractions.length > 0 && (
                <div className="section">
                  <div className="section-header-flex">
                    <h3>Doctor Visit Details ({selectedEmpDoctorInteractions.length})</h3>
                    <button
                      className="btn-export btn-export-so-visits btn-sm"
                      onClick={() => handleExportSODoctorVisits(selectedEmployee)}
                      title="Export Doctor Visits to Excel (.xlsx)"
                    >
                      🩺 Download Visits (.xlsx)
                    </button>
                  </div>
                  <div className="interactions-list">
                    {selectedEmpDoctorInteractions.map((interaction) => (
                      <div key={interaction.id} className="interaction-card">
                        <div className="interaction-header">
                          <span className="interaction-date">{formatDate(interaction.visit_date)}</span>
                          <span className="interaction-doctor">{interaction.doctor_name}</span>
                          {interaction.speciality && (
                            <span className="doctor-spec-tag">{interaction.speciality}</span>
                          )}
                        </div>
                        <div className="interaction-meta-row">
                          {interaction.division && <span><strong>Division:</strong> {interaction.division}</span>}
                          {interaction.territory && <span><strong>Territory:</strong> {interaction.territory}</span>}
                          {interaction.region && <span><strong>Region:</strong> {interaction.region}</span>}
                          {interaction.patch && <span><strong>Patch:</strong> {interaction.patch}</span>}
                          {interaction.requested_by && <span><strong>Requested By:</strong> {interaction.requested_by} ({interaction.requested_by_role || "MR"})</span>}
                        </div>
                        {(interaction?.brands ?? []).length > 0 && (
                          <div className="interaction-brands">
                            <strong>Brands Discussed:</strong>{" "}
                            {(interaction?.brands ?? []).map((brand) => brand.brand_name).join(", ")}
                          </div>
                        )}
                        {interaction.objections && (
                          <div className="interaction-objections">
                            <strong>Objections / Remarks:</strong> {interaction.objections}
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
                  <h3>Office Activity Details ({selectedEmpOfficeActivities.length})</h3>
                  <div className="activities-list">
                    {selectedEmpOfficeActivities.map((activity) => (
                      <div key={activity.id} className="activity-card">
                        <div className="activity-header">
                          <span className="activity-date">{formatDate(activity.activity_date)}</span>
                          <span className="activity-category">{activity.activity_category}</span>
                        </div>
                        {activity.hours_worked > 0 && (
                          <div className="activity-hours">Hours Worked: {activity.hours_worked}</div>
                        )}
                        {activity.doctors_visited > 0 && (
                          <div className="activity-doctors">Doctors Visited: {activity.doctors_visited}</div>
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

          {!selectedEmployee && (report.employees || []).length > 0 && (
            <div className="select-prompt">
              <p>👆 Click on any employee row above to view complete daily activity logs, doctor interactions, and reportings.</p>
            </div>
          )}
        </div>
      )}

      {!report && !loading && !error && (
        <div className="initial-message">
          <p>Please select a role or employee filter above and click "Generate Report" to view reports.</p>
        </div>
      )}
    </div>
  );
};

export default MonthlyReport;
