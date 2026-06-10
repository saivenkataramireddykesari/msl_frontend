import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doctorService, requestService, interactionService } from '../services/api';
import '../styles/RequestForm.css';

const PRIORITIES = ['High', 'Medium', 'Low'];

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

const RequestForm = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedDoctorId = location.state?.selectedDoctorId;

  // State for cascading dropdowns
  const [regions, setRegions] = useState([]);
  const [territories, setTerritories] = useState([]);
  const [patches, setPatches] = useState([]);
  const [doctors, setDoctors] = useState([]);

  const [doctorHistory, setDoctorHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    doctor_id: '',
    region: '',
    territory: '',
    patch: '',
    therapy_area: '',
    objective: '',
    expected_outcome: '',
    priority: 'Medium',
    notes: '',
    brand: '',
    requested_by: '',
    requested_by_role: '',
  });

  // Get BL territory from user (for BL role filtering)
  const getBLTerritory = () => {
    // For BL users, we need to get their territory from user data
    // This could come from user.bl_territory or similar field
    // For now, we'll pass null to get all regions (backend will handle)
    return user?.bl_territory || null;
  };

  // FETCH REGIONS on mount (filtered by BL location if BL user)
  useEffect(() => {
    fetchRegions();
  }, []);

  const fetchRegions = async () => {
    try {
      console.log('Fetching regions for BL:', user?.username, 'role:', user?.role);
      const blTerritory = user?.role === 'BL' ? getBLTerritory() : null;
      const res = await doctorService.getRegionsByBL(blTerritory);
      console.log('Fetched regions:', res.data);
      setRegions(res.data || []);
    } catch (err) {
      console.error('Error fetching regions:', err);
      setError('Failed to load regions: ' + (err.response?.data?.detail || err.message));
    }
  };

  // FETCH TERRITORIES when region changes
  useEffect(() => {
    if (formData.region) {
      fetchTerritories(formData.region);
    } else {
      setTerritories([]);
      setPatches([]);
      setDoctors([]);
    }
  }, [formData.region]);

  const fetchTerritories = async (region) => {
    try {
      console.log('Fetching territories for region:', region);
      const blTerritory = user?.role === 'BL' ? getBLTerritory() : null;
      const res = await doctorService.getTerritoriesByRegion(region, blTerritory);
      console.log('Fetched territories:', res.data);
      setTerritories(res.data || []);
    } catch (err) {
      console.error('Error fetching territories:', err);
      setError('Failed to load territories: ' + (err.response?.data?.detail || err.message));
    }
  };

  // FETCH PATCHES when territory changes
  useEffect(() => {
    if (formData.territory) {
      fetchPatches(formData.territory);
    } else {
      setPatches([]);
      setDoctors([]);
    }
  }, [formData.territory]);

  const fetchPatches = async (territory) => {
    try {
      console.log('Fetching patches for territory:', territory);
      const blTerritory = user?.role === 'BL' ? getBLTerritory() : null;
      const res = await doctorService.getPatchesByTerritory(territory, formData.region, blTerritory);
      console.log('Fetched patches:', res.data);
      setPatches(res.data || []);
    } catch (err) {
      console.error('Error fetching patches:', err);
      setError('Failed to load patches: ' + (err.response?.data?.detail || err.message));
    }
  };

  // FETCH DOCTORS when patch changes
  useEffect(() => {
    if (formData.patch) {
      fetchDoctors();
    } else {
      setDoctors([]);
    }
  }, [formData.patch]);

  const fetchDoctors = async () => {
    try {
      console.log('Fetching doctors for:', {
        region: formData.region,
        territory: formData.territory,
        patch: formData.patch
      });
      const blTerritory = user?.role === 'BL' ? getBLTerritory() : null;
      const res = await doctorService.getDoctorsByLocation(
        formData.region,
        formData.territory,
        formData.patch,
        blTerritory
      );
      console.log('Fetched doctors:', res.data);
      setDoctors(res.data || []);
    } catch (err) {
      console.error('Error fetching doctors:', err);
      setError('Failed to load doctors: ' + (err.response?.data?.detail || err.message));
    }
  };

  // HANDLE CHANGE for form fields
  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log(`handleChange: ${name} = "${value}"`);

    if (name === 'region') {
      // Reset dependent fields when region changes
      setFormData(prev => ({
        ...prev,
        region: value,
        territory: '',
        patch: '',
        doctor_id: '',
        therapy_area: ''
      }));
      setTerritories([]);
      setPatches([]);
      setDoctors([]);
    } else if (name === 'territory') {
      // Reset dependent fields when territory changes
      setFormData(prev => ({
        ...prev,
        territory: value,
        patch: '',
        doctor_id: '',
        therapy_area: ''
      }));
      setPatches([]);
      setDoctors([]);
    } else if (name === 'patch') {
      // Reset doctor when patch changes
      setFormData(prev => ({
        ...prev,
        patch: value,
        doctor_id: '',
        therapy_area: ''
      }));
      setDoctors([]);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // DOCTOR SELECT
  const handleDoctorChange = (e) => {
    const doctorId = e.target.value;
    const selectedDoctor = doctors.find(d => d.id === parseInt(doctorId));

    console.log('Selected doctor:', selectedDoctor);

    setFormData(prev => ({
      ...prev,
      doctor_id: doctorId,
      therapy_area: selectedDoctor?.therapy_area || selectedDoctor?.speciality || ''
    }));
  };

  // FETCH HISTORY
  const fetchDoctorHistory = async () => {
    try {
      const selectedDoctor = doctors.find(
        d => d.id === parseInt(formData.doctor_id)
      );

      if (selectedDoctor) {
        const res = await interactionService.getDoctorHistory(selectedDoctor.name);
        setDoctorHistory(res.data);
        setShowHistory(true);
      }
    } catch (err) {
      console.error('Error fetching doctor history:', err);
    }
  };

  // SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('=== SUBMIT START ===');
    console.log('Current formData:', JSON.stringify(formData, null, 2));

    // Validation
    if (!formData.doctor_id || formData.doctor_id === '') {
      setError('Please select a doctor');
      setLoading(false);
      return;
    }

    if (!formData.region) {
      setError('Please select a region');
      setLoading(false);
      return;
    }

    if (!formData.territory) {
      setError('Please select a territory');
      setLoading(false);
      return;
    }

    if (!formData.patch) {
      setError('Please select a patch');
      setLoading(false);
      return;
    }

    if ((user?.role === 'BL' || user?.role === 'BM') && !formData.brand) {
      setError('Please select a brand');
      setLoading(false);
      return;
    }

    try {
      const doctorId = parseInt(formData.doctor_id);

      if (isNaN(doctorId) || doctorId <= 0) {
        setError('Invalid doctor selected');
        setLoading(false);
        return;
      }

      const requestPayload = {
        region: formData.region,
        territory: formData.territory,
        doctor_id: doctorId,
        therapy_area: formData.therapy_area,
        objective: formData.objective,
        expected_outcome: formData.expected_outcome,
        priority: formData.priority,
        notes: formData.notes,
        brand: formData.brand || null,
        requested_by: user.username,
        requested_by_role: user.role
      };

      console.log('Request payload to be sent:', JSON.stringify(requestPayload, null, 2));

      const response = await requestService.createRequest(requestPayload);

      console.log('Create request response:', JSON.stringify(response.data, null, 2));
      console.log('=== SUBMIT END ===');

      navigate('/requests');

    } catch (err) {
      console.error('Error creating request:', err);
      console.error('Error response:', err.response?.data);
      setError('Failed to create request: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="request-form-container">
      <div className="form-header">
        <h1>MSL Engagement Request</h1>
        <p>Create request for doctor interaction</p>
      </div>

      <form onSubmit={handleSubmit} className="request-form">

        {error && <div className="error-message">{error}</div>}

        {/* ================= DOCTOR SECTION ================= */}
        <div className="form-section">
          <h3>Doctor Information</h3>

          <div className="form-row">
            <div className="form-group">
              <label>Region *</label>
              <select 
                className="form-control" 
                name="region" 
                value={formData.region} 
                onChange={handleChange}
              >
                <option value="">Select Region</option>
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Territory *</label>
              <select 
                className="form-control" 
                name="territory" 
                value={formData.territory} 
                onChange={handleChange} 
                disabled={!formData.region}
              >
                <option value="">Select Territory</option>
                {territories.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Patch *</label>
              <select 
                className="form-control" 
                name="patch" 
                value={formData.patch} 
                onChange={handleChange} 
                disabled={!formData.territory}
              >
                <option value="">Select Patch</option>
                {patches.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Doctor *</label>
              <select 
                className="form-control" 
                name="doctor_id" 
                value={formData.doctor_id} 
                onChange={handleDoctorChange} 
                disabled={!formData.patch}
              >
                <option value="">Select Doctor</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.speciality || d.therapy_area || 'No Speciality'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Speciality</label>
            <input className="form-control" value={formData.therapy_area} readOnly />
          </div>

          {(user?.role === 'BL' || user?.role === 'BM') && (
            <div className="form-group">
              <label>Brand *</label>
              <select className="form-control" name="brand" value={formData.brand} onChange={handleChange} required>
                <option value="">Select Brand</option>
                {BRAND_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* ================= ENGAGEMENT DETAILS ================= */}
        <div className="form-section">
          <h3>Engagement Details</h3>

          <div className="form-group">
            <label>Objective *</label>
            <textarea
              className="form-control"
              name="objective"
              value={formData.objective}
              onChange={handleChange} 
              placeholder='Reason for requesting msl interaction'
              required
            />
          </div>

          <div className="form-group">
            <label>Expected Outcome</label>
            <textarea
              className="form-control"
              name="expected_outcome"
              value={formData.expected_outcome} 
              placeholder='Expectation from msl interaction'
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Priority</label>
            <select className="form-control" name="priority" value={formData.priority} onChange={handleChange}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Problem Statement</label>
            <textarea
              className="form-control"
              name="notes"
              value={formData.notes} 
              placeholder='Concepts previously discussed, objections'
              onChange={handleChange}
            />
          </div>
        </div>

        {/* ================= HISTORY ================= */}
        {showHistory && (
          <div className="history-box">
            <h3>Doctor History</h3>

            {doctorHistory.length === 0 ? (
              <p>No history found</p>
            ) : (
              doctorHistory.map(item => (
                <div key={item.id} className="history-card">
                  <p><b>Date:</b> {item.visit_date}</p>
                  <p><b>Summary:</b> {item.summary}</p>
                  <p><b>Topics:</b> {item.topics_discussed}</p>
                </div>
              ))
            )}
          </div>
        )}

        <button className="btn-primary" type="submit">
          {loading ? 'Creating...' : 'Create Request'}
        </button>

      </form>
    </div>
  );
};

export default RequestForm;
