import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Format date helper
 */
const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateString);
  }
};

/**
 * Dedicated Export for Scientific Officer (SO) Doctor Visit Data of Selected Month (.xlsx)
 * Supports downloading for an individual SO or all SOs
 */
export const exportSODoctorVisitsToExcel = (report, selectedRole = 'All', selectedEmployee = null) => {
  if (!report) return;

  const wb = XLSX.utils.book_new();
  const employees = selectedEmployee ? [selectedEmployee] : (report.employees || []);

  // 1. Sheet: Detailed Doctor Visits
  const visitRows = [];
  let visitCounter = 0;

  employees.forEach((emp) => {
    (emp.doctor_interactions || []).forEach((interaction) => {
      visitCounter++;
      const brands = interaction.brands || [];
      const primaryBrand = brands[0] || {};
      const allBrandsList = brands.map((b) => b.brand_name).filter(Boolean).join(', ');
      const additionalBrands = brands.slice(1).map((b) => b.brand_name).filter(Boolean).join(', ');

      visitRows.push({
        'S.No': visitCounter,
        'SO Employee ID': emp.employee_id || '',
        'SO Name': emp.employee_name || '',
        'SO Role': emp.role || 'Scientific Officer',
        'SO Territory': emp.territory || '-',
        'SO Region': emp.region || '-',
        'SO HQ': emp.hq || '-',
        'Visit Date': formatDate(interaction.visit_date),
        'Doctor Name': interaction.doctor_name || '',
        'Doctor Speciality': interaction.speciality || '-',
        'Therapy Area': interaction.therapy_area || '-',
        'Doctor Division': interaction.division || '-',
        'Doctor Territory': interaction.territory || '-',
        'Doctor Region': interaction.region || '-',
        'Doctor Patch': interaction.patch || '-',
        'Priority Doctor': interaction.is_priority_doctor ? 'Yes' : (interaction.is_priority_doctor === false ? 'No' : '-'),
        'Requested By': interaction.requested_by || '-',
        'Requested By Role': interaction.requested_by_role || '-',
        'Request ID': interaction.request_id || '-',
        'Primary Brand': primaryBrand.brand_name || allBrandsList || '-',
        'Brand Objective': primaryBrand.objective || '-',
        'Topics Discussed': primaryBrand.topics_discussed || '-',
        'Discussion Summary': primaryBrand.summary || '-',
        'Outcomes': primaryBrand.outcomes || '-',
        'Interest Level': primaryBrand.interest_level || '-',
        'Marketing Insights': primaryBrand.insights_marketing || '-',
        'Additional Brands Discussed': additionalBrands || '-',
        'Doctor Objections / Remarks': interaction.objections || '-',
      });
    });
  });

  if (visitRows.length === 0) {
    visitRows.push({
      'Message': 'No doctor visits recorded for the selected period / employee.',
    });
  }

  const visitWs = XLSX.utils.json_to_sheet(visitRows);
  XLSX.utils.book_append_sheet(wb, visitWs, 'Doctor Visits Detail');

  // 2. Sheet: Summary by SO
  const soSummaryRows = employees.map((emp, idx) => {
    const visits = emp.doctor_interactions || [];
    const uniqueDocs = new Set(visits.map((v) => v.doctor_name)).size;
    const priorityCount = visits.filter((v) => v.is_priority_doctor).length;

    return {
      'S.No': idx + 1,
      'SO Employee ID': emp.employee_id || '',
      'SO Name': emp.employee_name || '',
      'SO Role': emp.role || '-',
      'SO Territory': emp.territory || '-',
      'SO Region': emp.region || '-',
      'SO HQ': emp.hq || '-',
      'Reporting Manager': `${emp.reporting_manager || '-'} ${emp.reporting_manager_code ? `(${emp.reporting_manager_code})` : ''}`,
      'Period': emp.month_name ? `${emp.month_name} ${emp.year}` : (report.report_month_name ? `${report.report_month_name} ${report.report_year}` : report.report_date || ''),
      'Total Doctor Visits': visits.length,
      'Unique Doctors Visited': uniqueDocs,
      'Priority Doctor Visits': priorityCount,
    };
  });

  const summaryWs = XLSX.utils.json_to_sheet(soSummaryRows);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'SO Visits Summary');

  // File naming
  const period = report.report_month_name ? `${report.report_month_name}_${report.report_year}` : (report.report_date || 'Month');
  let filename = '';
  if (selectedEmployee) {
    const safeName = (selectedEmployee.employee_name || 'SO').replace(/[^a-zA-Z0-9_-]/g, '_');
    filename = `${safeName}_${selectedEmployee.employee_id}_Doctor_Visits_${period}.xlsx`;
  } else if (selectedRole && selectedRole !== 'All') {
    const safeRole = selectedRole.replace(/[^a-zA-Z0-9_-]/g, '_');
    filename = `${safeRole}_Doctor_Visits_${period}.xlsx`;
  } else {
    filename = `All_SO_Doctor_Visits_${period}.xlsx`;
  }

  XLSX.writeFile(wb, filename);
};

/**
 * Export Monthly Report to Excel (.xlsx)
 * Supports all employees, specific role employees, or single selected employee
 */
export const exportMonthlyReportToExcel = (report, selectedRole = 'All', selectedEmployee = null) => {
  if (!report) return;

  const wb = XLSX.utils.book_new();
  const employees = selectedEmployee ? [selectedEmployee] : (report.employees || []);

  // 1. Sheet: Employees Summary
  const summaryRows = employees.map((emp) => ({
    'Employee ID': emp.employee_id || '',
    'Employee Name': emp.employee_name || '',
    'Role': emp.role || '-',
    'Territory': emp.territory || '-',
    'Region': emp.region || '-',
    'HQ': emp.hq || '-',
    'Reporting Manager': emp.reporting_manager || '-',
    'Manager Code': emp.reporting_manager_code || '-',
    'Month': emp.month_name || report.report_month_name || '',
    'Year': emp.year || report.report_year || '',
    'Total Doctor Visits': emp.total_doctor_visits ?? 0,
    'Unique Doctors Visited': emp.unique_doctors_visited ?? 0,
    'Office Activities': emp.total_office_activities ?? 0,
    'Total Hours Worked': emp.total_hours_worked ?? 0,
    'Both Done (Days)': emp.work_type_breakdown?.['both done'] ?? 0,
    'Worked at Office (Days)': emp.work_type_breakdown?.['worked at office'] ?? 0,
    'Call Supported (Days)': emp.work_type_breakdown?.['call supported'] ?? 0,
    'Nothing Done (Days)': emp.work_type_breakdown?.['nothing done'] ?? 0,
  }));

  const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Employees Summary');

  // 2. Sheet: Daily Breakdown
  const dailyRows = [];
  employees.forEach((emp) => {
    (emp.daily_summary || []).forEach((day) => {
      dailyRows.push({
        'Employee ID': emp.employee_id || '',
        'Employee Name': emp.employee_name || '',
        'Role': emp.role || '-',
        'Date': day.date || '',
        'Day': day.day || '',
        'Doctor Visits': day.doctor_visits ?? 0,
        'Office Activities': day.office_activities ?? 0,
        'Hours Worked': day.hours_worked ?? 0,
        'Work Type': day.work_type || '-',
      });
    });
  });
  if (dailyRows.length > 0) {
    const dailyWs = XLSX.utils.json_to_sheet(dailyRows);
    XLSX.utils.book_append_sheet(wb, dailyWs, 'Daily Activity Breakdown');
  }

  // 3. Sheet: Doctor Visit Details
  const doctorRows = [];
  employees.forEach((emp) => {
    (emp.doctor_interactions || []).forEach((interaction) => {
      const brandsList = (interaction.brands || []).map((b) => b.brand_name).filter(Boolean).join(', ');
      doctorRows.push({
        'Employee ID': emp.employee_id || '',
        'Employee Name': emp.employee_name || '',
        'Role': emp.role || '-',
        'Visit Date': formatDate(interaction.visit_date),
        'Doctor Name': interaction.doctor_name || '',
        'Speciality': interaction.speciality || '-',
        'Therapy Area': interaction.therapy_area || '-',
        'Division': interaction.division || '-',
        'Territory': interaction.territory || '-',
        'Region': interaction.region || '-',
        'Patch': interaction.patch || '-',
        'Priority Doctor': interaction.is_priority_doctor ? 'Yes' : (interaction.is_priority_doctor === false ? 'No' : '-'),
        'Requested By': interaction.requested_by || '-',
        'Brands Discussed': brandsList || '-',
        'Objections / Remarks': interaction.objections || '-',
      });
    });
  });
  if (doctorRows.length > 0) {
    const docWs = XLSX.utils.json_to_sheet(doctorRows);
    XLSX.utils.book_append_sheet(wb, docWs, 'Doctor Visits');
  }

  // 4. Sheet: Office Activity Details
  const activityRows = [];
  employees.forEach((emp) => {
    (emp.office_activities || []).forEach((act) => {
      activityRows.push({
        'Employee ID': emp.employee_id || '',
        'Employee Name': emp.employee_name || '',
        'Role': emp.role || '-',
        'Activity Date': formatDate(act.activity_date),
        'Activity Category': act.activity_category || '',
        'Hours Worked': act.hours_worked ?? 0,
        'Doctors Visited': act.doctors_visited ?? 0,
        'Work Type': act.work_type || '-',
        'Summary': act.summary || '-',
        'Linked Outputs': act.linked_outputs || '-',
      });
    });
  });
  if (activityRows.length > 0) {
    const actWs = XLSX.utils.json_to_sheet(activityRows);
    XLSX.utils.book_append_sheet(wb, actWs, 'Office Activities');
  }

  // File Name construction
  const period = `${report.report_month_name}_${report.report_year}`;
  let filename = '';
  if (selectedEmployee) {
    const safeName = (selectedEmployee.employee_name || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
    filename = `${safeName}_${selectedEmployee.employee_id}_Monthly_Report_${period}.xlsx`;
  } else if (selectedRole && selectedRole !== 'All') {
    const safeRole = selectedRole.replace(/[^a-zA-Z0-9_-]/g, '_');
    filename = `${safeRole}_Role_Monthly_Report_${period}.xlsx`;
  } else {
    filename = `All_Employees_Monthly_Report_${period}.xlsx`;
  }

  XLSX.writeFile(wb, filename);
};

/**
 * Export Daily Report to Excel (.xlsx)
 * Supports all employees, specific role employees, or single selected employee
 */
export const exportDailyReportToExcel = (report, selectedRole = 'All', selectedEmployee = null) => {
  if (!report) return;

  const wb = XLSX.utils.book_new();
  const employees = selectedEmployee ? [selectedEmployee] : (report.employees || []);

  // 1. Sheet: Daily Summary
  const summaryRows = employees.map((emp) => ({
    'Employee ID': emp.employee_id || '',
    'Employee Name': emp.employee_name || '',
    'Role': emp.role || '-',
    'Territory': emp.territory || '-',
    'Region': emp.region || '-',
    'HQ': emp.hq || '-',
    'Report Date': emp.report_date || report.report_date || '',
    'Day': emp.day_name || report.report_day_name || '',
    'Doctor Visits': emp.total_doctor_visits ?? 0,
    'Unique Doctors Visited': emp.unique_doctors_visited ?? 0,
    'Office Activities': emp.total_office_activities ?? 0,
    'Total Hours Worked': emp.total_hours_worked ?? 0,
    'Work Type': emp.work_type || '-',
  }));

  const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Daily Summary');

  // 2. Sheet: Doctor Visits
  const doctorRows = [];
  employees.forEach((emp) => {
    (emp.doctor_interactions || []).forEach((interaction) => {
      const brandsList = (interaction.brands || []).map((b) => b.brand_name).filter(Boolean).join(', ');
      doctorRows.push({
        'Employee ID': emp.employee_id || '',
        'Employee Name': emp.employee_name || '',
        'Role': emp.role || '-',
        'Visit Date': formatDate(interaction.visit_date),
        'Doctor Name': interaction.doctor_name || '',
        'Speciality': interaction.speciality || '-',
        'Therapy Area': interaction.therapy_area || '-',
        'Division': interaction.division || '-',
        'Territory': interaction.territory || '-',
        'Region': interaction.region || '-',
        'Patch': interaction.patch || '-',
        'Priority Doctor': interaction.is_priority_doctor ? 'Yes' : (interaction.is_priority_doctor === false ? 'No' : '-'),
        'Requested By': interaction.requested_by || '-',
        'Brands Discussed': brandsList || '-',
        'Objections / Remarks': interaction.objections || '-',
      });
    });
  });
  if (doctorRows.length > 0) {
    const docWs = XLSX.utils.json_to_sheet(doctorRows);
    XLSX.utils.book_append_sheet(wb, docWs, 'Doctor Visits');
  }

  // 3. Sheet: Office Activities
  const activityRows = [];
  employees.forEach((emp) => {
    (emp.office_activities || []).forEach((act) => {
      activityRows.push({
        'Employee ID': emp.employee_id || '',
        'Employee Name': emp.employee_name || '',
        'Role': emp.role || '-',
        'Activity Date': formatDate(act.activity_date),
        'Activity Category': act.activity_category || '',
        'Hours Worked': act.hours_worked ?? 0,
        'Doctors Visited': act.doctors_visited ?? 0,
        'Work Type': act.work_type || '-',
        'Summary': act.summary || '-',
        'Linked Outputs': act.linked_outputs || '-',
      });
    });
  });
  if (activityRows.length > 0) {
    const actWs = XLSX.utils.json_to_sheet(activityRows);
    XLSX.utils.book_append_sheet(wb, actWs, 'Office Activities');
  }

  // File Name construction
  const dateStr = report.report_date || 'Daily';
  let filename = '';
  if (selectedEmployee) {
    const safeName = (selectedEmployee.employee_name || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
    filename = `${safeName}_${selectedEmployee.employee_id}_Daily_Report_${dateStr}.xlsx`;
  } else if (selectedRole && selectedRole !== 'All') {
    const safeRole = selectedRole.replace(/[^a-zA-Z0-9_-]/g, '_');
    filename = `${safeRole}_Role_Daily_Report_${dateStr}.xlsx`;
  } else {
    filename = `All_Employees_Daily_Report_${dateStr}.xlsx`;
  }

  XLSX.writeFile(wb, filename);
};

/**
 * Export Monthly Report to PDF
 */
export const exportMonthlyReportToPDF = (report, selectedRole = 'All', selectedEmployee = null) => {
  if (!report) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const employees = selectedEmployee ? [selectedEmployee] : (report.employees || []);
  const period = `${report.report_month_name} ${report.report_year}`;

  // Header Title
  doc.setFontSize(16);
  doc.setTextColor(44, 62, 80);
  doc.text('Scientific Officer Management - Monthly Working Report', 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(108, 117, 125);
  const subtitle = selectedEmployee
    ? `Employee: ${selectedEmployee.employee_name} (${selectedEmployee.employee_id}) | Role: ${selectedEmployee.role || '-'} | Period: ${period}`
    : `Filter: ${selectedRole === 'All' ? 'All Roles' : `Role - ${selectedRole}`} | Period: ${period} | Total Employees: ${employees.length}`;
  doc.text(subtitle, 14, 22);

  if (selectedEmployee) {
    // Individual employee summary
    const empData = [
      ['Role', selectedEmployee.role || '-'],
      ['Territory', selectedEmployee.territory || '-'],
      ['Region', selectedEmployee.region || '-'],
      ['HQ', selectedEmployee.hq || '-'],
      ['Reporting Manager', `${selectedEmployee.reporting_manager || '-'} (${selectedEmployee.reporting_manager_code || '-'})`],
      ['Total Doctor Visits', selectedEmployee.total_doctor_visits ?? 0],
      ['Unique Doctors Visited', selectedEmployee.unique_doctors_visited ?? 0],
      ['Office Activities Logged', selectedEmployee.total_office_activities ?? 0],
      ['Total Hours Worked', `${selectedEmployee.total_hours_worked ?? 0} hrs`],
    ];

    autoTable(doc, {
      startY: 26,
      head: [['Metric / Detail', 'Value']],
      body: empData,
      theme: 'striped',
      headStyles: { fillColor: [102, 126, 234] },
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    });

    let currentY = doc.lastAutoTable.finalY + 10;

    // Daily summary table for employee
    if ((selectedEmployee.daily_summary || []).length > 0) {
      if (currentY > 170) {
        doc.addPage();
        currentY = 15;
      }
      doc.setFontSize(12);
      doc.setTextColor(44, 62, 80);
      doc.text('Daily Activity Breakdown', 14, currentY);

      const dailyBody = selectedEmployee.daily_summary.map((d) => [
        formatDate(d.date),
        d.day,
        d.doctor_visits ?? 0,
        d.office_activities ?? 0,
        (d.hours_worked ?? 0).toFixed(1),
        d.work_type || '-',
      ]);

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Date', 'Day', 'Doctor Visits', 'Office Activities', 'Hours', 'Work Type']],
        body: dailyBody,
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234] },
        styles: { fontSize: 8 },
      });
      currentY = doc.lastAutoTable.finalY + 10;
    }

    // Doctor visits for employee
    if ((selectedEmployee.doctor_interactions || []).length > 0) {
      if (currentY > 170) {
        doc.addPage();
        currentY = 15;
      }
      doc.setFontSize(12);
      doc.setTextColor(44, 62, 80);
      doc.text('Doctor Visits', 14, currentY);

      const docBody = selectedEmployee.doctor_interactions.map((di) => [
        formatDate(di.visit_date),
        di.doctor_name,
        di.speciality || '-',
        di.territory || '-',
        (di.brands || []).map((b) => b.brand_name).join(', ') || '-',
        di.objections || '-',
      ]);

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Date', 'Doctor Name', 'Speciality', 'Territory', 'Brands Discussed', 'Objections / Remarks']],
        body: docBody,
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234] },
        styles: { fontSize: 8 },
      });
    }
  } else {
    // Multi-employee table
    const tableBody = employees.map((emp) => [
      emp.employee_id || '',
      emp.employee_name || '',
      emp.role || '-',
      emp.territory || '-',
      emp.region || '-',
      emp.total_doctor_visits ?? 0,
      emp.unique_doctors_visited ?? 0,
      emp.total_office_activities ?? 0,
      (emp.total_hours_worked ?? 0).toFixed(1),
      emp.work_type_breakdown?.['both done'] ?? 0,
      emp.work_type_breakdown?.['worked at office'] ?? 0,
      emp.work_type_breakdown?.['call supported'] ?? 0,
    ]);

    autoTable(doc, {
      startY: 26,
      head: [[
        'Emp ID',
        'Emp Name',
        'Role',
        'Territory',
        'Region',
        'Visits',
        'Doctors',
        'Activities',
        'Hours',
        'Both Done',
        'Office Only',
        'Call Supp.',
      ]],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [102, 126, 234] },
      styles: { fontSize: 8 },
    });
  }

  // Filename
  let filename = '';
  if (selectedEmployee) {
    const safeName = (selectedEmployee.employee_name || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
    filename = `${safeName}_Monthly_Report_${report.report_month_name}_${report.report_year}.pdf`;
  } else if (selectedRole && selectedRole !== 'All') {
    const safeRole = selectedRole.replace(/[^a-zA-Z0-9_-]/g, '_');
    filename = `${safeRole}_Role_Monthly_Report_${report.report_month_name}_${report.report_year}.pdf`;
  } else {
    filename = `All_Employees_Monthly_Report_${report.report_month_name}_${report.report_year}.pdf`;
  }

  doc.save(filename);
};

/**
 * Export Daily Report to PDF
 */
export const exportDailyReportToPDF = (report, selectedRole = 'All', selectedEmployee = null) => {
  if (!report) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const employees = selectedEmployee ? [selectedEmployee] : (report.employees || []);
  const dateStr = `${report.report_day_name}, ${formatDate(report.report_date)}`;

  // Header Title
  doc.setFontSize(16);
  doc.setTextColor(44, 62, 80);
  doc.text('Scientific Officer Management - Daily Working Report', 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(108, 117, 125);
  const subtitle = selectedEmployee
    ? `Employee: ${selectedEmployee.employee_name} (${selectedEmployee.employee_id}) | Role: ${selectedEmployee.role || '-'} | Date: ${dateStr}`
    : `Filter: ${selectedRole === 'All' ? 'All Roles' : `Role - ${selectedRole}`} | Date: ${dateStr} | Total Employees: ${employees.length}`;
  doc.text(subtitle, 14, 22);

  if (selectedEmployee) {
    const empData = [
      ['Role', selectedEmployee.role || '-'],
      ['Territory', selectedEmployee.territory || '-'],
      ['Region', selectedEmployee.region || '-'],
      ['HQ', selectedEmployee.hq || '-'],
      ['Doctor Visits Today', selectedEmployee.total_doctor_visits ?? 0],
      ['Unique Doctors Visited', selectedEmployee.unique_doctors_visited ?? 0],
      ['Office Activities Today', selectedEmployee.total_office_activities ?? 0],
      ['Hours Worked Today', `${selectedEmployee.total_hours_worked ?? 0} hrs`],
      ['Overall Work Type', selectedEmployee.work_type || '-'],
    ];

    autoTable(doc, {
      startY: 26,
      head: [['Metric / Detail', 'Value']],
      body: empData,
      theme: 'striped',
      headStyles: { fillColor: [102, 126, 234] },
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    });

    let currentY = doc.lastAutoTable.finalY + 10;

    // Doctor visits for employee
    if ((selectedEmployee.doctor_interactions || []).length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(44, 62, 80);
      doc.text('Doctor Visits Today', 14, currentY);

      const docBody = selectedEmployee.doctor_interactions.map((di) => [
        formatDate(di.visit_date),
        di.doctor_name,
        di.speciality || '-',
        di.territory || '-',
        (di.brands || []).map((b) => b.brand_name).join(', ') || '-',
        di.objections || '-',
      ]);

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Date', 'Doctor Name', 'Speciality', 'Territory', 'Brands Discussed', 'Objections / Remarks']],
        body: docBody,
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234] },
        styles: { fontSize: 8 },
      });
      currentY = doc.lastAutoTable.finalY + 10;
    }

    // Office activities for employee
    if ((selectedEmployee.office_activities || []).length > 0) {
      if (currentY > 170) {
        doc.addPage();
        currentY = 15;
      }
      doc.setFontSize(12);
      doc.setTextColor(44, 62, 80);
      doc.text('Office Activities Today', 14, currentY);

      const actBody = selectedEmployee.office_activities.map((act) => [
        act.activity_category,
        act.hours_worked ?? 0,
        act.doctors_visited ?? 0,
        act.work_type || '-',
        act.summary || '-',
        act.linked_outputs || '-',
      ]);

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Category', 'Hours', 'Doctors Visited', 'Work Type', 'Summary', 'Linked Outputs']],
        body: actBody,
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234] },
        styles: { fontSize: 8 },
      });
    }
  } else {
    // Multi-employee daily table
    const tableBody = employees.map((emp) => [
      emp.employee_id || '',
      emp.employee_name || '',
      emp.role || '-',
      emp.territory || '-',
      emp.region || '-',
      emp.total_doctor_visits ?? 0,
      emp.unique_doctors_visited ?? 0,
      emp.total_office_activities ?? 0,
      (emp.total_hours_worked ?? 0).toFixed(1),
      emp.work_type || '-',
    ]);

    autoTable(doc, {
      startY: 26,
      head: [[
        'Emp ID',
        'Emp Name',
        'Role',
        'Territory',
        'Region',
        'Visits',
        'Doctors',
        'Activities',
        'Hours',
        'Work Type',
      ]],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [102, 126, 234] },
      styles: { fontSize: 8 },
    });
  }

  // Filename
  let filename = '';
  if (selectedEmployee) {
    const safeName = (selectedEmployee.employee_name || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
    filename = `${safeName}_Daily_Report_${report.report_date}.pdf`;
  } else if (selectedRole && selectedRole !== 'All') {
    const safeRole = selectedRole.replace(/[^a-zA-Z0-9_-]/g, '_');
    filename = `${safeRole}_Role_Daily_Report_${report.report_date}.pdf`;
  } else {
    filename = `All_Employees_Daily_Report_${report.report_date}.pdf`;
  }

  doc.save(filename);
};
