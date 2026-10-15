import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { doctorService } from '../services/api';
import '../styles/DoctorManagement.css';

const DoctorManagement = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const response = await doctorService.getDoctors();
      setDoctors(response.data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const filteredDoctors = useMemo(() => {
    if (!searchTerm.trim()) return doctors;
    const s = searchTerm.toLowerCase().trim();
    return doctors.filter(doctor =>
      (doctor.name && doctor.name.toLowerCase().includes(s)) ||
      (doctor.speciality && doctor.speciality.toLowerCase().includes(s)) ||
      (doctor.therapy_area && doctor.therapy_area.toLowerCase().includes(s)) ||
      (doctor.emp_name && doctor.emp_name.toLowerCase().includes(s)) ||
      (doctor.territory && doctor.territory.toLowerCase().includes(s)) ||
      (doctor.region && doctor.region.toLowerCase().includes(s)) ||
      (doctor.division && doctor.division.toLowerCase().includes(s))
    );
  }, [doctors, searchTerm]);

  const priorityDoctors = useMemo(() => filteredDoctors.filter(d => d.is_priority_doctor), [filteredDoctors]);
  const regularDoctors = useMemo(() => filteredDoctors.filter(d => !d.is_priority_doctor), [filteredDoctors]);

  const val = (v) => v || <span className="null-val">—</span>;

  const DoctorTable = ({ doctorList, isPriority }) => (
    <div className="doctors-table-container">
      <table className="doctors-table">
        <thead>
          <tr>
            <th className="col-expand"></th>
            <th>ID</th>
            <th>Doctor Name</th>
            <th>Speciality</th>
            <th>Division</th>
            <th>Territory</th>
            <th>MR (Emp)</th>
            <th>Region</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {doctorList.map((doctor) => (
            <React.Fragment key={doctor.id}>
              <tr
                key={doctor.id}
                className={`doctor-row ${isPriority ? 'priority-row' : ''} ${expandedRow === doctor.id ? 'expanded' : ''}`}
                onClick={() => toggleRow(doctor.id)}
              >
                <td className="expand-cell">
                  <span className={`expand-icon ${expandedRow === doctor.id ? 'open' : ''}`}>▶</span>
                </td>
                <td className="col-id">{doctor.id}</td>
                <td className="doctor-name">{doctor.name}</td>
                <td>{val(doctor.speciality)}</td>
                <td>{val(doctor.division)}</td>
                <td>{val(doctor.territory)}</td>
                <td>
                  {doctor.emp_name ? (
                    <span className="mr-info">
                      <span className="mr-name">{doctor.emp_name}</span>
                      {doctor.emp_code && <span className="emp-code">#{doctor.emp_code}</span>}
                    </span>
                  ) : val(null)}
                </td>
                <td>{val(doctor.region)}</td>
                <td>
                  {isPriority
                    ? <span className="priority-badge">⭐ Priority</span>
                    : <span className="regular-badge">Regular</span>}
                </td>
              </tr>

              {expandedRow === doctor.id && (
                <tr key={`${doctor.id}-detail`} className="detail-row">
                  <td colSpan="9">
                    <div className="detail-panel">
                      <div className="detail-grid">
                        <div className="detail-group">
                          <h4>🩺 Doctor Info</h4>
                          <div className="detail-items">
                            <div className="detail-item">
                              <span className="detail-label">Doctor ID (Ext)</span>
                              <span className="detail-value">{val(doctor.doctor_id_ext)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">UID Number</span>
                              <span className="detail-value">{val(doctor.uid_number)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Speciality</span>
                              <span className="detail-value">{val(doctor.speciality)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Therapy Area</span>
                              <span className="detail-value">{val(doctor.therapy_area)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="detail-group">
                          <h4>👤 MR / Employee</h4>
                          <div className="detail-items">
                            <div className="detail-item">
                              <span className="detail-label">Emp Name</span>
                              <span className="detail-value">{val(doctor.emp_name)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Emp Code</span>
                              <span className="detail-value">{val(doctor.emp_code)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Division</span>
                              <span className="detail-value">{val(doctor.division)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Region</span>
                              <span className="detail-value">{val(doctor.region)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Territory</span>
                              <span className="detail-value">{val(doctor.territory)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="detail-group">
                          <h4>🗺️ Territory Hierarchy</h4>
                          <div className="detail-items">
                            <div className="detail-item">
                              <span className="detail-label">BM Territory</span>
                              <span className="detail-value">{val(doctor.bm_territory)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">BL Territory</span>
                              <span className="detail-value">{val(doctor.bl_territory)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">BH Territory</span>
                              <span className="detail-value">{val(doctor.bh_territory)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">SBUH Territory</span>
                              <span className="detail-value">{val(doctor.sbuh_territory)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading doctors...</p>
      </div>
    );
  }

  return (
    <div className="doctor-management-container">
      <div className="page-header">
        <div>
          <h1>Doctor Management</h1>
          <p className="page-subtitle">{doctors.length} doctors in database</p>
        </div>
        <Link to="/dashboard" className="back-link">← Back to Dashboard</Link>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by name, speciality, territory, MR, region, division..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        {searchTerm && (
          <span className="search-results-count">{filteredDoctors.length} result(s)</span>
        )}
      </div>

      <div className="doctors-section">
        <h2>⭐ Priority Doctors ({priorityDoctors.length})</h2>
        {priorityDoctors.length === 0 ? (
          <p className="empty-text">No priority doctors found.</p>
        ) : (
          <DoctorTable doctorList={priorityDoctors} isPriority={true} />
        )}
      </div>

      {regularDoctors.length > 0 && (
        <div className="doctors-section">
          <h2>All Doctors ({regularDoctors.length})</h2>
          <DoctorTable doctorList={regularDoctors} isPriority={false} />
        </div>
      )}

      <div className="info-section">
        <h3>💡 How to use</h3>
        <ul>
          <li><strong>Click any row</strong> to expand and view full doctor details (territories, UID, emp info)</li>
        </ul>
      </div>
    </div>
  );
};

export default DoctorManagement;