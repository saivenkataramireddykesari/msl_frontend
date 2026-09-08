import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { activityService, interactionService } from '../services/api';
import '../styles/OfficeActivities.css';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


const ACTIVITY_CATEGORIES = [
  'Literature Review',
  'Content Development',
  'Training',
  'Strategy Meetings',
  'CME',
  'Scientific evaluation',
  'Protocol drafting',
  'Advisory Board Preparation',
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const OfficeActivities = () => {
  const { user } = useAuth();

  const [activities, setActivities] = useState([]);
  const [mslUsers, setMslUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewMode, setViewMode] = useState('loading');
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');   // '' = all months
  const [reportMonth, setReportMonth] = useState(null); // month whose modal is open
  const [showReportModal, setShowReportModal] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);

  // Download report state
  const [showDownloadMenu, setShowDownloadMenu] = useState(null);
  const [downloadingReport, setDownloadingReport] = useState(false);


  const [selectedDayActivity, setSelectedDayActivity] = useState(null);
  const [dayInteractions, setDayInteractions] = useState([]);
  const [loadingDayInteractions, setLoadingDayInteractions] = useState(false);

  const [activityForm, setActivityForm] = useState({
    activity_date: new Date().toISOString().split('T')[0],
    activity_category: '',
    summary: '',
    linked_outputs: '',
    hours_worked: '',
    // doctors_visited is now auto-calculated based on date
  });

  /* -- Auth / initial load -- */
  useEffect(() => {
    if (user) {
      const isMSL = user.role === 'MSL' || user.role === 'Scientific Officer';
      if (isMSL) {
        setSelectedUser(user.username);
        setViewMode('activities');
        fetchActivities(user.username);
      } else {
        setViewMode('users');
        fetchMslUsers();
      }
    }
  }, [user]);

  /* -- Data fetch -- */
  const fetchMslUsers = async () => {
    try {
      setLoading(true);
      const res = await activityService.getActivityUsers();
      setMslUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async (username) => {
    try {
      setLoading(true);
      console.log('DEBUG - Fetching activities for user:', username);
      const res = await activityService.getActivities(username);
      console.log('DEBUG - Fetched activities:', res.data);
      setActivities(res.data);
    } catch (err) {
      console.error('ERROR - Failed to fetch activities:', err);
      console.error('Error response:', err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  /* -- Navigation -- */
  const handleUserSelect = (username) => {
    setSelectedUser(username);
    setViewMode('activities');
    fetchActivities(username);
  };

  const handleBackToUsers = () => {
    setSelectedUser(null);
    setViewMode('users');
    setActivities([]);
    setSelectedMonth('');
    fetchMslUsers();
  };

  /* -- Log activity submit with data verification -- */
  const handleActivitySubmit = async (e) => {
    e.preventDefault();

    const minDate = getNinetyDaysAgoString();
    const maxDate = getTodayString();
    if (activityForm.activity_date < minDate || activityForm.activity_date > maxDate) {
      alert(`Activity date must be within the last 90 days (${minDate} to ${maxDate}). You cannot log activity for dates older than 90 days or in the future.`);
      return;
    }

    const hours = parseFloat(activityForm.hours_worked) || 0;

    // Prepare data for submission
    const submitData = {
      ...activityForm,
      hours_worked: hours,
      msl_username: user.username
    };

    console.log('DEBUG - Submitting activity data:', submitData);

    try {
      const response = await activityService.createActivity(submitData);
      console.log('DEBUG - Activity saved successfully:', response.data);

      // Reset form
      setShowActivityForm(false);
      setActivityForm({
        activity_date: '',
        activity_category: '',
        summary: '',
        linked_outputs: '',
        hours_worked: '',
      });

      // Refresh data from server to verify persistence
      await fetchActivities(user.username);
      alert('Activity logged successfully!');
    } catch (err) {
      console.error('ERROR - Failed to save activity:', err);
      console.error('Error response:', err.response?.data);
      alert('Failed to log activity: ' + (err.response?.data?.detail || err.message));
    }
  };

  /* -- Helpers -- */
  const getNinetyDaysAgoString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDate = (ds) =>
    new Date(ds).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const getMonthName = (ds) => MONTHS[new Date(ds).getMonth()];

  const getMonthYear = (ds) => {
    const d = new Date(ds);
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Group activities by month for summary view
  const getMonthlySummary = () => {
    const monthGroups = {};
    const filteredActivities = selectedMonth
      ? activities.filter(a => getMonthName(a.activity_date) === selectedMonth)
      : activities;

    filteredActivities.forEach(a => {
      const monthKey = getMonthYear(a.activity_date);
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = {
          month: monthKey,
          activities: [],
          totalHours: 0,
          totalDoctors: 0,
          officeCount: 0,
          fieldCount: 0,
          bothCount: 0
        };
      }
      monthGroups[monthKey].activities.push(a);
      monthGroups[monthKey].totalHours += (a.hours_worked || 0);
      monthGroups[monthKey].totalDoctors += (a.doctors_visited || 0);

      const wt = (a.work_type || '').toLowerCase();
      if (wt === 'worked at office' || wt === 'office') monthGroups[monthKey].officeCount++;
      else if (wt === 'call supported' || wt === 'field') monthGroups[monthKey].fieldCount++;
      else if (wt === 'both done') monthGroups[monthKey].bothCount++;
    });
    return Object.values(monthGroups).sort((a, b) => {
      // Sort by date descending
      const dateA = new Date(a.activities[0].activity_date);
      const dateB = new Date(b.activities[0].activity_date);
      return dateB - dateA;
    });
  };

  const isOffice = (a) => {
    const wt = (a.work_type || '').toLowerCase();
    return wt === 'worked at office' || wt === 'both done' || wt === 'office';
  };

  const isField = (a) => {
    const wt = (a.work_type || '').toLowerCase();
    return wt === 'call supported' || wt === 'both done' || wt === 'field';
  };

  // Work type is now auto-calculated by backend based on hours and auto-counted doctor visits

  const renderWorkTypeBadge = (workType) => {
    const wt = (workType || '').toLowerCase();
    switch (wt) {
      case 'worked at office':
      case 'office':
        return <span className="status-badge" style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #a7f3d0', whiteSpace: 'nowrap' }}>Worked at Office</span>;
      case 'call supported':
      case 'field':
        return <span className="status-badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', whiteSpace: 'nowrap' }}>Call Supported</span>;
      case 'both done':
        return <span className="status-badge" style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>Both Done</span>;
      case 'nothing done':
      default:
        return <span className="status-badge no" style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Nothing Done</span>;
    }
  };

  /* -- Modal rows -- */
  const modalActivities = reportMonth
    ? activities.filter(a => getMonthYear(a.activity_date) === reportMonth)
    : [];

  const openModal = (month) => { setReportMonth(month); setShowReportModal(true); };

  // ============================================================
  // DOWNLOAD MONTHLY REPORT
  // ============================================================

  /**
   * Convert "September 2026" into:
   * {
   *   monthName: "September",
   *   year: 2026
   * }
   */
  const parseReportMonth = (monthYear) => {
    const parts = monthYear.split(' ');

    return {
      monthName: parts[0],
      year: Number(parts[1])
    };
  };


  /**
   * Get all doctor interactions for all activity dates
   * belonging to the selected month.
   */
  const fetchMonthlyDoctorInteractions = async (monthName, year, monthlyActivities) => {
    try {
      const response = await interactionService.getInteractionsByUser(selectedUser);
      const allUserInteractions = Array.isArray(response.data) ? response.data : [];

      const monthlyInteractions = allUserInteractions.filter(int => {
        if (!int.visit_date) return false;
        const d = new Date(int.visit_date);
        return MONTHS[d.getMonth()] === monthName && d.getFullYear() === year;
      });

      return monthlyInteractions;
    } catch (error) {
      console.error("Failed to fetch doctor interactions by user:", error);
      const interactions = [];
      const uniqueDates = [
        ...new Set(
          monthlyActivities
            .map(activity => activity.activity_date)
            .filter(Boolean)
        )
      ];

      await Promise.all(
        uniqueDates.map(async (date) => {
          try {
            const username =
              monthlyActivities.find(
                activity => activity.activity_date === date
              )?.msl_username || selectedUser;

            const response =
              await interactionService.getInteractionsByDateUser(
                date,
                username
              );

            const dateInteractions = Array.isArray(response.data)
              ? response.data
              : [];

            dateInteractions.forEach(interaction => {
              interactions.push({
                ...interaction,
                visit_date: date,
                msl_username: username
              });
            });

          } catch (e) {
            console.error(`Failed to fetch doctor interactions for ${date}:`, e);
          }
        })
      );

      return interactions;
    }
  };


  /**
   * Prepare monthly report data.
   */
  const prepareMonthlyReport = async (monthYear) => {
    const { monthName, year } = parseReportMonth(monthYear);

    // Filter activities for selected month/year
    const monthlyActivities = activities.filter(activity => {
      const date = new Date(activity.activity_date);

      return (
        MONTHS[date.getMonth()] === monthName &&
        date.getFullYear() === year
      );
    });

    // Fetch doctor interactions for the selected month
    const doctorInteractions =
      await fetchMonthlyDoctorInteractions(monthName, year, monthlyActivities);

    if (monthlyActivities.length === 0 && doctorInteractions.length === 0) {
      throw new Error(`No activity or doctor visit data found for ${monthYear}.`);
    }

    // Calculate summary
    const totalHours = monthlyActivities.reduce(
      (total, activity) =>
        total + (Number(activity.hours_worked) || 0),
      0
    );

    const totalDoctors = doctorInteractions.length;

    const officeDays = monthlyActivities.filter(
      activity => isOffice(activity)
    ).length;

    const fieldDays = monthlyActivities.filter(
      activity => isField(activity)
    ).length;

    const bothDays = monthlyActivities.filter(activity => {
      const wt = (activity.work_type || '').toLowerCase();
      return wt === 'both done';
    }).length;

    return {
      monthYear,
      monthName,
      year,
      monthlyActivities,
      doctorInteractions,
      summary: {
        totalDays: monthlyActivities.length,
        totalHours,
        totalDoctors,
        officeDays,
        fieldDays,
        bothDays
      }
    };
  };


  /**
   * Download Excel report.
   */
  const downloadExcelReport = async (monthYear) => {
    try {
      setDownloadingReport(true);
      setShowDownloadMenu(null);

      const report = await prepareMonthlyReport(monthYear);

      const {
        monthlyActivities,
        doctorInteractions,
        summary
      } = report;

      const workbook = XLSX.utils.book_new();

      // ========================================================
      // SHEET 1 - MONTHLY SUMMARY
      // ========================================================

      const summaryData = [
        ['MONTHLY ACTIVITY & DOCTOR VISIT REPORT'],
        [],
        ['MSL / User', selectedUser],
        ['Report Month', monthYear],
        [],
        ['Metric', 'Value'],
        ['Total Days Logged', summary.totalDays],
        ['Total Hours Worked', summary.totalHours],
        ['Total Doctors Visited', summary.totalDoctors],
        ['Office Days', summary.officeDays],
        ['Field Days', summary.fieldDays],
        ['Both Done Days', summary.bothDays]
      ];

      const summarySheet =
        XLSX.utils.aoa_to_sheet(summaryData);

      summarySheet['!cols'] = [
        { wch: 30 },
        { wch: 25 }
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        summarySheet,
        'Monthly Summary'
      );


      // ========================================================
      // SHEET 2 - OFFICE ACTIVITIES
      // ========================================================

      const activityRows = monthlyActivities.map(
        (activity, index) => ({
          '#': index + 1,
          'Date': activity.activity_date
            ? formatDate(activity.activity_date)
            : '',
          'Day': activity.activity_date
            ? new Date(activity.activity_date)
              .toLocaleDateString('en-US', {
                weekday: 'long'
              })
            : '',
          'MSL': activity.msl_username || selectedUser,
          'Category': activity.activity_category || '',
          'Hours Worked':
            activity.hours_worked ?? '',
          'Doctors Visited':
            activity.doctors_visited ?? 0,
          'Office': isOffice(activity) ? 'Yes' : 'No',
          'Field': isField(activity) ? 'Yes' : 'No',
          'Work Type': activity.work_type || '',
          'Task / Work Done':
            activity.summary || '',
          'Linked Outputs':
            activity.linked_outputs || ''
        })
      );

      const activitySheet = XLSX.utils.json_to_sheet(
        activityRows
      );

      activitySheet['!cols'] = [
        { wch: 6 },
        { wch: 15 },
        { wch: 12 },
        { wch: 20 },
        { wch: 25 },
        { wch: 15 },
        { wch: 18 },
        { wch: 10 },
        { wch: 10 },
        { wch: 20 },
        { wch: 45 },
        { wch: 35 }
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        activitySheet,
        'Office Activities'
      );


      // ========================================================
      // SHEET 3 - DOCTOR VISITS
      // ========================================================

      const doctorRows = doctorInteractions.map(
        (interaction, index) => ({
          '#': index + 1,

          'Visit Date':
            interaction.visit_date
              ? formatDate(interaction.visit_date)
              : '',

          'MSL':
            interaction.msl_username || selectedUser,

          'Doctor Name':
            interaction.doctor_name || '',

          'Priority Doctor':
            interaction.is_priority_doctor
              ? 'Yes'
              : 'No',

          'Brand 1 Discussed':
            interaction.brand_discussed || '',

          'Brand 2 Discussed':
            interaction.brand2_discussed || '',

          'Topic - Brand 1':
            interaction.topics_discussed || '',

          'Topic - Brand 2':
            interaction.brand2_topics || '',

          'Interest Level - Brand 1':
            interaction.interest_level || '',

          'Interest Level - Brand 2':
            interaction.brand2_interest_level || '',

          'Summary - Brand 1':
            interaction.summary || '',

          'Summary - Brand 2':
            interaction.brand2_summary || '',

          'Outcome - Brand 1':
            interaction.outcomes || '',

          'Outcome - Brand 2':
            interaction.brand2_outcomes || '',

          'Objections':
            interaction.objections || '',

          'Insights for Marketing':
            interaction.insights_for_marketing || ''
        })
      );

      const doctorSheet = XLSX.utils.json_to_sheet(
        doctorRows
      );

      doctorSheet['!cols'] = [
        { wch: 6 },
        { wch: 15 },
        { wch: 20 },
        { wch: 25 },
        { wch: 15 },
        { wch: 25 },
        { wch: 25 },
        { wch: 30 },
        { wch: 30 },
        { wch: 25 },
        { wch: 25 },
        { wch: 40 },
        { wch: 40 },
        { wch: 35 },
        { wch: 35 },
        { wch: 35 },
        { wch: 45 }
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        doctorSheet,
        'Doctor Visits'
      );


      // ========================================================
      // DOWNLOAD
      // ========================================================

      const safeUserName = String(selectedUser || 'MSL')
        .replace(/[^a-z0-9]/gi, '_');

      const safeMonth = monthYear
        .replace(/[^a-z0-9]/gi, '_');

      const fileName =
        `${safeUserName}_${safeMonth}_Activity_Report.xlsx`;

      XLSX.writeFile(workbook, fileName);

    } catch (error) {
      console.error('Excel report error:', error);

      alert(
        `Failed to generate Excel report: ${error.message || 'Unknown error'
        }`
      );

    } finally {
      setDownloadingReport(false);
    }
  };


  /**
   * Download PDF report.
   */
  /**
   * Download PDF report (combines Office Activities & Doctor Visits into a single PDF).
   */
  const downloadPDFReport = async (monthYear) => {
    try {
      setDownloadingReport(true);
      setShowDownloadMenu(null);

      const report = await prepareMonthlyReport(monthYear);

      const {
        monthlyActivities,
        doctorInteractions,
        summary
      } = report;

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // ========================================================
      // TITLE
      // ========================================================
      doc.setFontSize(18);
      doc.setTextColor(40, 53, 147);
      doc.text('Monthly Activity & Doctor Visit Report', 14, 15);

      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`User / SO: ${selectedUser}`, 14, 22);
      doc.text(`Report Month: ${monthYear}`, 14, 27);

      // ========================================================
      // SUMMARY
      // ========================================================
      autoTable(doc, {
        startY: 32,
        head: [
          [
            'Total Days Logged',
            'Total Hours Worked',
            'Total Doctor Visits',
            'Office Days',
            'Field Days',
            'Both Done Days'
          ]
        ],
        body: [
          [
            summary.totalDays,
            summary.totalHours.toFixed(1),
            summary.totalDoctors,
            summary.officeDays,
            summary.fieldDays,
            summary.bothDays
          ]
        ],
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, halign: 'center', cellPadding: 3 }
      });

      // ========================================================
      // OFFICE ACTIVITIES
      // ========================================================
      let currentY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.text('Office Activity Details', 14, currentY);

      const officeRows = monthlyActivities.map(activity => [
        activity.activity_date ? formatDate(activity.activity_date) : '',
        activity.activity_category || '',
        activity.hours_worked ?? '',
        activity.doctors_visited ?? 0,
        isOffice(activity) ? 'Yes' : 'No',
        isField(activity) ? 'Yes' : 'No',
        activity.work_type || '',
        activity.summary || '',
        activity.linked_outputs || ''
      ]);

      autoTable(doc, {
        startY: currentY + 4,
        head: [[
          'Date',
          'Category',
          'Hours',
          'Doctors',
          'Office',
          'Field',
          'Status Note',
          'Task / Work Done',
          'Outputs'
        ]],
        body: officeRows.length > 0 ? officeRows : [['—', 'No office activities recorded', '—', '—', '—', '—', '—', '—', '—']],
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 30 },
          2: { cellWidth: 14 },
          3: { cellWidth: 16 },
          4: { cellWidth: 14 },
          5: { cellWidth: 14 },
          6: { cellWidth: 26 },
          7: { cellWidth: 70 },
          8: { cellWidth: 60 }
        }
      });

      // ========================================================
      // DOCTOR VISITS
      // ========================================================
      currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 40;
      if (currentY > 170) {
        doc.addPage();
        currentY = 15;
      }

      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.text('Doctor Visit / Interaction Details', 14, currentY);

      const doctorRows = doctorInteractions.map(int => {
        let brandsStr = '';
        let topicsStr = '';
        let interestStr = '';
        let summaryStr = '';
        let outcomesStr = '';

        if (int.brands && int.brands.length > 0) {
          brandsStr = int.brands.map(b => b.brand_name).filter(Boolean).join(', ');
          topicsStr = int.brands.map(b => b.topics_discussed).filter(Boolean).join('; ');
          interestStr = int.brands.map(b => b.interest_level).filter(Boolean).join('; ');
          summaryStr = int.brands.map(b => b.summary).filter(Boolean).join('; ') || int.summary || '';
          outcomesStr = int.brands.map(b => b.outcomes).filter(Boolean).join('; ') || int.outcomes || '';
        } else {
          brandsStr = [int.brand_discussed, int.brand2_discussed].filter(Boolean).join(', ');
          topicsStr = [int.topics_discussed, int.brand2_topics].filter(Boolean).join('; ');
          interestStr = [int.interest_level, int.brand2_interest_level].filter(Boolean).join('; ');
          summaryStr = [int.summary, int.brand2_summary].filter(Boolean).join('; ');
          outcomesStr = [int.outcomes, int.brand2_outcomes].filter(Boolean).join('; ');
        }

        return [
          int.visit_date ? formatDate(int.visit_date) : '',
          int.doctor_name || '',
          int.is_priority_doctor ? 'Yes' : 'No',
          brandsStr || '—',
          topicsStr || '—',
          interestStr || '—',
          summaryStr || '—',
          outcomesStr || '—',
          int.objections || '—'
        ];
      });

      autoTable(doc, {
        startY: currentY + 4,
        head: [[
          'Date',
          'Doctor Name',
          'Priority',
          'Brands Discussed',
          'Topics Discussed',
          'Interest Level',
          'Summary',
          'Outcome',
          'Objections'
        ]],
        body: doctorRows.length > 0 ? doctorRows : [['—', 'No doctor visits recorded', '—', '—', '—', '—', '—', '—', '—']],
        theme: 'grid',
        headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 8 },
        styles: { fontSize: 6.5, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 35 },
          2: { cellWidth: 14 },
          3: { cellWidth: 35 },
          4: { cellWidth: 35 },
          5: { cellWidth: 22 },
          6: { cellWidth: 40 },
          7: { cellWidth: 35 },
          8: { cellWidth: 30 }
        }
      });

      // ========================================================
      // FOOTER ON EVERY PAGE
      // ========================================================
      const pageCount = doc.internal.getNumberOfPages();
      for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, 14, 200);
        doc.text(`Page ${page} of ${pageCount}`, 265, 200);
      }

      // ========================================================
      // SAVE PDF
      // ========================================================
      const safeUserName = String(selectedUser || 'SO_User').replace(/[^a-z0-9]/gi, '_');
      const safeMonth = monthYear.replace(/[^a-z0-9]/gi, '_');
      const fileName = `${safeUserName}_${safeMonth}_Activity_Report.pdf`;

      doc.save(fileName);

    } catch (error) {
      console.error('PDF report error:', error);
      alert(`Failed to generate PDF report: ${error.message || 'Unknown error'}`);
    } finally {
      setDownloadingReport(false);
    }
  };

  const handleDayClick = async (activity) => {
    setSelectedDayActivity(activity);
    setDayInteractions([]);
    setLoadingDayInteractions(true);
    try {
      const res = await interactionService.getInteractionsByDateUser(activity.activity_date, activity.msl_username);
      setDayInteractions(res.data);
    } catch (err) {
      console.error("ERROR - Failed to fetch day interactions:", err);
    } finally {
      setLoadingDayInteractions(false);
    }
  };

  const canLogActivities = user?.role === 'MSL' || user?.role === 'Scientific Officer';

  /* ----------------------------------------------- */
  if (loading) return <div className="loading">Loading office activities...</div>;

  return (
    <div className="office-activities-container">

      {/* -- Header -- */}
      <div className="list-header">
        <div className="header-left">
          {viewMode === 'activities' && !canLogActivities && (
            <button onClick={handleBackToUsers} className="back-btn">← Back to MSL List</button>
          )}
          <h1>{viewMode === 'users' ? 'MSL Office Activities' : `Activities — ${selectedUser}`}</h1>
        </div>
        {canLogActivities && (
          <button onClick={() => setShowActivityForm(true)} className="log-activity-btn">
            + Log Activity
          </button>
        )}
      </div>

      {/* -- Users grid -- */}
      {viewMode === 'users' && (
        mslUsers.length === 0
          ? <div className="empty-state"><p>No MSLs have logged activities yet.</p></div>
          : (
            <div className="users-grid">
              {mslUsers.map(u => (
                <div key={u} className="user-card">
                  <div className="user-avatar">{u.charAt(0).toUpperCase()}</div>
                  <h3>{u}</h3>
                  <button onClick={() => handleUserSelect(u)} className="view-activity-btn">View Activities</button>
                </div>
              ))}
            </div>
          )
      )}

      {/* -- Activities view -- */}
      {viewMode === 'activities' && (
        <>
          {/* Month filter pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '600', color: '#555', fontSize: '14px', whiteSpace: 'nowrap' }}>Filter by Month:</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['', ...MONTHS].map((m) => (
                <button
                  key={m || 'all'}
                  onClick={() => setSelectedMonth(m)}
                  style={{
                    padding: '5px 13px', borderRadius: '20px',
                    border: '1.5px solid #667eea',
                    background: selectedMonth === m ? '#667eea' : 'white',
                    color: selectedMonth === m ? 'white' : '#667eea',
                    cursor: 'pointer', fontWeight: '600', fontSize: '12px',
                    transition: 'all 0.18s',
                  }}
                >
                  {m === '' ? 'All' : m.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Monthly Summary Table */}
          {activities.length === 0 ? (
            <div className="empty-state">
              <p>No office activities logged yet.</p>
            </div>
          ) : (
            <div className="activities-table-container">
              <table className="activities-table">
                <thead>
                  <tr>
                    <th style={{ width: '36px' }}>#</th>
                    <th>Month</th>
                    <th style={{ textAlign: 'center' }}>Total Days Logged</th>
                    <th style={{ textAlign: 'center' }}>Total Hours</th>
                    <th style={{ textAlign: 'center' }}>Total Doctors<br /><span style={{ fontSize: '10px', fontWeight: '400', color: '#888' }}>(Auto)</span></th>
                    <th style={{ textAlign: 'center' }}>Office Days</th>
                    <th style={{ textAlign: 'center' }}>Field Days</th>
                    <th style={{ textAlign: 'center' }}>Both Done</th>
                    <th style={{ textAlign: 'center' }}>View Details</th>
                    <th style={{ textAlign: 'center' }}>Download Report</th>
                  </tr>
                </thead>
                <tbody>
                  {getMonthlySummary().map((monthData, idx) => (
                    <tr key={monthData.month}>
                      <td style={{ color: '#aaa', fontSize: '12px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ fontWeight: '600', color: '#667eea', whiteSpace: 'nowrap' }}>{monthData.month}</td>
                      <td style={{ textAlign: 'center', fontWeight: '600' }}>{monthData.activities.length}</td>
                      <td style={{ textAlign: 'center', fontWeight: '600' }}>{monthData.totalHours.toFixed(1)}</td>
                      <td style={{ textAlign: 'center', fontWeight: '600' }}>{monthData.totalDoctors}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>
                          {monthData.officeCount}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>
                          {monthData.fieldCount}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>
                          {monthData.bothCount}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          onClick={() => openModal(monthData.month)}
                          title={`View detailed report for ${monthData.month}`}
                          style={{
                            display: 'inline-block',
                            background: 'linear-gradient(135deg,#667eea,#764ba2)',
                            color: 'white', padding: '4px 12px',
                            borderRadius: '12px', fontSize: '12px',
                            fontWeight: '600', cursor: 'pointer',
                            userSelect: 'none', whiteSpace: 'nowrap',
                          }}
                        >
                          View
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => downloadPDFReport(monthData.month)}
                          disabled={downloadingReport}
                          title={`Download PDF report for ${monthData.month}`}
                          style={{
                            display: 'inline-block',
                            background: 'linear-gradient(135deg,#667eea,#764ba2)',
                            color: 'white',
                            padding: '6px 14px',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: downloadingReport ? 'not-allowed' : 'pointer',
                            opacity: downloadingReport ? 0.6 : 1,
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 4px rgba(102, 126, 234, 0.25)'
                          }}
                        >
                          {downloadingReport ? 'Preparing PDF...' : '📄 Download Report'}
                        </button>
                      </td>
                    </tr>

                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════
          Log Activity Modal
      ══════════════════════════════════════════════ */}
      {showActivityForm && (
        <div className="modal-overlay" onClick={() => setShowActivityForm(false)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '650px', width: '92vw', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box', borderRadius: '12px', padding: '24px' }}
          >
            <h2 style={{ marginBottom: '20px', borderBottom: '1px solid #edf2f7', paddingBottom: '12px', color: '#1a202c' }}>📝 Log Office Activity</h2>
            <form onSubmit={handleActivitySubmit}>

              {/* Three-column responsive grid for metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#4a5568' }}>Date *</label>
                  <input
                    type="date"
                    value={activityForm.activity_date}
                    min={getNinetyDaysAgoString()}
                    max={getTodayString()}
                    onChange={e => setActivityForm({ ...activityForm, activity_date: e.target.value })}
                    className="form-control"
                    style={{ marginTop: '6px' }}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#4a5568' }}>Category *</label>
                  <select value={activityForm.activity_category}
                    onChange={e => setActivityForm({ ...activityForm, activity_category: e.target.value })}
                    className="form-control" style={{ marginTop: '6px' }} required>
                    <option value="">Select Category</option>
                    {ACTIVITY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#4a5568' }}>Hours Worked *</label>
                  <input type="number" min="0" max="24" step="0.5" value={activityForm.hours_worked}
                    onChange={e => setActivityForm({ ...activityForm, hours_worked: e.target.value })}
                    className="form-control" style={{ marginTop: '6px' }} required placeholder="e.g. 8" />
                </div>
              </div>

              {/* Textarea inputs */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#4a5568' }}>Task / Work Done *</label>
                <textarea value={activityForm.summary} rows="3"
                  onChange={e => setActivityForm({ ...activityForm, summary: e.target.value })}
                  className="form-control" style={{ marginTop: '6px', resize: 'vertical' }} placeholder="Describe what task or work you did..." required />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#4a5568' }}>Linked Outputs (Optional)</label>
                <textarea value={activityForm.linked_outputs} rows="2"
                  onChange={e => setActivityForm({ ...activityForm, linked_outputs: e.target.value })}
                  className="form-control" style={{ marginTop: '6px', resize: 'vertical' }} placeholder="e.g. Slides, report, training material" />
              </div>

              {/* Informative Auto-Calculated Info Callout */}
              <div style={{ padding: '12px 15px', borderRadius: '8px', background: '#f0f9ff', border: '1px solid #bae6fd', marginBottom: '24px' }}>
                <label style={{ fontSize: '12px', color: '#0369a1', marginBottom: '4px', fontWeight: '700', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ℹ️ Auto-Calculated Information</label>
                <p style={{ fontSize: '12px', color: '#0c4a6e', margin: 0, lineHeight: '1.5' }}>
                  Doctor visits will be automatically counted based on your interactions logged on the selected date. The activity note status will be auto-calculated accordingly.
                </p>
              </div>

              <div className="modal-actions" style={{ borderTop: '1px solid #edf2f7', paddingTop: '16px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowActivityForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Activity</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          Detailed Month Report Modal
      ══════════════════════════════════════════════ */}
      {showReportModal && reportMonth && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '1000px', width: '94vw', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '2px solid #e0e3ff', paddingBottom: '14px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#333' }}> {reportMonth} — Detailed Report</h2>
                <span style={{ fontSize: '13px', color: '#888' }}>User: <strong>{selectedUser}</strong> &nbsp;|&nbsp; {modalActivities.length} activit{modalActivities.length === 1 ? 'y' : 'ies'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => downloadPDFReport(reportMonth)}
                  disabled={downloadingReport}
                  className="btn-primary"
                  style={{ padding: '7px 16px', fontSize: '12px' }}
                >
                  {downloadingReport ? 'Preparing PDF...' : '📄 Download PDF Report'}
                </button>
                <button onClick={() => setShowReportModal(false)} className="btn-secondary" style={{ padding: '7px 18px' }}>✕ Close</button>
              </div>
            </div>

            {/* Daily Data Table */}
            {modalActivities.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '30px' }}>No activities for {reportMonth}.</p>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                <table className="activities-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8f9ff', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '11px 14px', borderBottom: '2px solid #e0e3ff', fontSize: '13px', whiteSpace: 'nowrap' }}>#</th>
                      <th style={{ padding: '11px 14px', borderBottom: '2px solid #e0e3ff', fontSize: '13px', whiteSpace: 'nowrap' }}>Date & Day</th>
                      <th style={{ padding: '11px 14px', borderBottom: '2px solid #e0e3ff', fontSize: '13px', textAlign: 'center' }}>Office</th>
                      <th style={{ padding: '11px 14px', borderBottom: '2px solid #e0e3ff', fontSize: '13px', textAlign: 'center' }}>Field</th>
                      <th style={{ padding: '11px 14px', borderBottom: '2px solid #e0e3ff', fontSize: '13px', textAlign: 'center' }}>Hours</th>
                      <th style={{ padding: '11px 14px', borderBottom: '2px solid #e0e3ff', fontSize: '13px', textAlign: 'center' }}>Doctors Visited<br /><span style={{ fontSize: '9px', fontWeight: '400', color: '#888' }}>(Auto)</span></th>
                      <th style={{ padding: '11px 14px', borderBottom: '2px solid #e0e3ff', fontSize: '13px' }}>Status Note</th>
                      <th style={{ padding: '11px 14px', borderBottom: '2px solid #e0e3ff', fontSize: '13px' }}>Category</th>
                      <th style={{ padding: '11px 14px', borderBottom: '2px solid #e0e3ff', fontSize: '13px' }}>Task / Work Done</th>
                      <th style={{ padding: '11px 14px', borderBottom: '2px solid #e0e3ff', fontSize: '13px' }}>Outputs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalActivities.map((a, idx) => {
                      const d = new Date(a.activity_date);
                      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                      return (
                        <tr
                          key={a.id}
                          onClick={() => handleDayClick(a)}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f3ff'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'white' : '#fafbff'}
                          style={{
                            borderBottom: '1px solid #eef0ff',
                            background: idx % 2 === 0 ? 'white' : '#fafbff',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s'
                          }}
                          title="Click to view detailed day report"
                        >
                          <td style={{ padding: '10px 14px', fontSize: '12px', color: '#aaa', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: '600', fontSize: '13px' }}>{formatDate(a.activity_date)}</div>
                            <div style={{ fontSize: '11px', color: '#999' }}>{dayName}</div>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {isOffice(a) ? <span className="status-badge yes" style={{ background: '#d1fae5', color: '#065f46' }}>✓ Yes</span> : <span className="status-badge no">—</span>}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {isField(a) ? <span className="status-badge yes" style={{ background: '#fef3c7', color: '#92400e' }}>✓ Yes</span> : <span className="status-badge no">—</span>}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '600' }}>
                            {a.hours_worked !== null && a.hours_worked !== undefined ? a.hours_worked : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '600' }}>
                            {a.doctors_visited !== null && a.doctors_visited !== undefined ? a.doctors_visited : '—'}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {renderWorkTypeBadge(a.work_type)}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: '600', color: '#667eea', fontSize: '13px' }}>{a.activity_category}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', color: '#444', lineHeight: '1.4', maxWidth: '240px' }}>{a.summary || '—'}</td>
                          <td style={{ padding: '10px 14px', fontSize: '13px', color: '#666', maxWidth: '140px' }}>{a.linked_outputs || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          Day Detail Modal
      ══════════════════════════════════════════════ */}
      {selectedDayActivity && (
        <div className="modal-overlay" onClick={() => setSelectedDayActivity(null)} style={{ zIndex: 1100 }}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '750px', width: '94vw', maxHeight: '85vh', overflowY: 'auto', boxSizing: 'border-box', borderRadius: '12px', padding: '24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '2px solid #667eea', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#1a202c', fontSize: '20px' }}>🗓️ Report for {formatDate(selectedDayActivity.activity_date)}</h2>
                <span style={{ fontSize: '13px', color: '#666' }}>Logged by: <strong>{selectedDayActivity.msl_username}</strong></span>
              </div>
              <button onClick={() => setSelectedDayActivity(null)} className="btn-secondary" style={{ padding: '5px 14px' }}>✕ Close</button>
            </div>

            {/* Office Activity Detail Card */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#4a5568', borderBottom: '1px solid #edf2f7', paddingBottom: '6px' }}>🏢 Office Activity Log</h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#718096', fontWeight: '700' }}>Category</span>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#2d3748', marginTop: '3px' }}>{selectedDayActivity.activity_category}</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#718096', fontWeight: '700' }}>Hours Worked</span>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#2d3748', marginTop: '3px' }}>{selectedDayActivity.hours_worked ?? '—'} hours</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#718096', fontWeight: '700' }}>Status Note</span>
                  <div style={{ marginTop: '3px' }}>{renderWorkTypeBadge(selectedDayActivity.work_type)}</div>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#718096', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Task / Work Done</span>
                <div style={{ fontSize: '13px', color: '#2d3748', background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                  {selectedDayActivity.summary || 'No description provided.'}
                </div>
              </div>

              {selectedDayActivity.linked_outputs && (
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#718096', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Linked Outputs</span>
                  <div style={{ fontSize: '13px', color: '#4a5568', background: 'white', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    {selectedDayActivity.linked_outputs}
                  </div>
                </div>
              )}
            </div>

            {/* Doctor Interactions Details */}
            <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #ede9fe', paddingBottom: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#5b21b6', fontWeight: '600' }}>🩺 Doctor Interactions logged on this day ({selectedDayActivity.doctors_visited})</h3>
              </div>

              {loadingDayInteractions ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6b21a8', fontSize: '13px' }}>Loading doctor interactions...</div>
              ) : dayInteractions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: '13px', background: 'white', borderRadius: '6px', border: '1px dashed #d1d5db' }}>
                  No doctor interactions logged on this date.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {dayInteractions.map((int, idx) => (
                    <div key={int.id || idx} style={{ background: 'white', border: '1px solid #ede9fe', borderRadius: '6px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: '700', color: '#6d28d9', fontSize: '14px' }}>{int.doctor_name}</span>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: '#f3e8ff', color: '#6b21a8', fontWeight: '600' }}>
                          Priority: {int.is_priority_doctor ? 'Yes' : 'No'}
                        </span>
                      </div>

                      {int.brand_discussed && (
                        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                          <strong style={{ color: '#4b5563' }}>Brand 1 Discussed:</strong> {int.brand_discussed}
                        </div>
                      )}
                      {int.brand2_discussed && (
                        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                          <strong style={{ color: '#4b5563' }}>Brand 2 Discussed:</strong> {int.brand2_discussed}
                        </div>
                      )}
                      {int.topics_discussed && (
                        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                          <strong style={{ color: '#4b5563' }}>Topic Discussed (Brand 1):</strong> {int.topics_discussed}
                        </div>
                      )}
                      {int.brand2_topics && (
                        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                          <strong style={{ color: '#4b5563' }}>Topic Discussed (Brand 2):</strong> {int.brand2_topics}
                        </div>
                      )}
                      {int.interest_level && (
                        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                          <strong style={{ color: '#4b5563' }}>Interest Level (Brand 1):</strong> {int.interest_level}
                        </div>
                      )}
                      {int.brand2_interest_level && (
                        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                          <strong style={{ color: '#4b5563' }}>Interest Level (Brand 2):</strong> {int.brand2_interest_level}
                        </div>
                      )}
                      {int.summary && (
                        <div style={{ fontSize: '12px', color: '#4b5563', padding: '6px 8px', background: '#f9fafb', borderRadius: '4px', borderLeft: '3px solid #8b5cf6', lineHeight: '1.4', marginBottom: '4px' }}>
                          <strong style={{ color: '#4b5563' }}>Summary (Brand 1):</strong> {int.summary}
                        </div>
                      )}
                      {int.brand2_summary && (
                        <div style={{ fontSize: '12px', color: '#4b5563', padding: '6px 8px', background: '#f9fafb', borderRadius: '4px', borderLeft: '3px solid #8b5cf6', lineHeight: '1.4', marginBottom: '4px' }}>
                          <strong style={{ color: '#4b5563' }}>Summary (Brand 2):</strong> {int.brand2_summary}
                        </div>
                      )}
                      {int.outcomes && (
                        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                          <strong style={{ color: '#4b5563' }}>Outcome (Brand 1):</strong> {int.outcomes}
                        </div>
                      )}
                      {int.brand2_outcomes && (
                        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                          <strong style={{ color: '#4b5563' }}>Outcome (Brand 2):</strong> {int.brand2_outcomes}
                        </div>
                      )}
                      {int.objections && (
                        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                          <strong style={{ color: '#4b5563' }}>Objections:</strong> {int.objections}
                        </div>
                      )}
                      {int.insights_for_marketing && (
                        <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                          <strong style={{ color: '#4b5563' }}>Insights for Marketing:</strong> {int.insights_for_marketing}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OfficeActivities;
