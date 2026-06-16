import { useState, useEffect, useRef } from 'react';
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
  const brandDropdownRef = useRef(null); // Add this ref

  // State for cascading dropdowns
  const [regions, setRegions] = useState([]);
  const [territories, setTerritories] = useState([]);
  const [patches, setPatches] = useState([]);
  const [doctors, setDoctors] = useState([]);

  const [doctorHistory, setDoctorHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showBrandDropdown, setShowBrandDropdown] = useState(false); 

  const [formData, setFormData] = useState({
    doctor_id: '',
    region: '',
    territory: '',
    patch: '',
    therapy_area: '',
    selectedBrands: [], // Array to hold selected brands (up to 2)
    objective1: '',
    expected_outcome1: '',
    priority1: 'Medium',
    notes1: '',
    objective2: '',
    expected_outcome2: '',
    priority2: 'Medium',
    notes2: '',
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

  // Close brand dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target)) {
        setShowBrandDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [brandDropdownRef]);

  // HANDLE CHANGE for form fields
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target; 
    console.log(`handleChange: ${name} = "${value}", type: ${type}, checked: ${checked}`);

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
    } else if (name === 'brand_checkbox_custom') { // Handle custom brand checkboxes
      setFormData(prev => {
        const currentBrands = new Set(prev.selectedBrands);
        if (checked) {
          if (currentBrands.size < 2) {
            currentBrands.add(value);
          } else {
            alert('You can select a maximum of 2 brands.');
            return prev; 
          }
        } else {
          currentBrands.delete(value);
        }
        const newSelectedBrands = Array.from(currentBrands);
        
        const updatedPrev = { ...prev };

        // Reset all brand-specific fields initially
        updatedPrev.objective1 = ''; updatedPrev.expected_outcome1 = '';
        updatedPrev.priority1 = 'Medium'; updatedPrev.notes1 = '';
        updatedPrev.objective2 = ''; updatedPrev.expected_outcome2 = '';
        updatedPrev.priority2 = 'Medium'; updatedPrev.notes2 = '';

        // Reassign values based on new selectedBrands order
        if (newSelectedBrands[0]) {
          const oldBrand1 = prev.selectedBrands[0];
          const oldBrand2 = prev.selectedBrands[1];

          if (newSelectedBrands[0] === oldBrand1) { // Same as previous Brand 1
            updatedPrev.objective1 = prev.objective1;
            updatedPrev.expected_outcome1 = prev.expected_outcome1;
            updatedPrev.priority1 = prev.priority1;
            updatedPrev.notes1 = prev.notes1;
          } else if (newSelectedBrands[0] === oldBrand2) { // Was previous Brand 2
            updatedPrev.objective1 = prev.objective2;
            updatedPrev.expected_outcome1 = prev.expected_outcome2;
            updatedPrev.priority1 = prev.priority2;
            updatedPrev.notes1 = prev.notes2;
          }
        }

        if (newSelectedBrands[1]) {
          const oldBrand1 = prev.selectedBrands[0];
          const oldBrand2 = prev.selectedBrands[1];

          if (newSelectedBrands[1] === oldBrand2) { // Same as previous Brand 2
            updatedPrev.objective2 = prev.objective2;
            updatedPrev.expected_outcome2 = prev.expected_outcome2;
            updatedPrev.priority2 = prev.priority2;
            updatedPrev.notes2 = prev.notes2;
          } else if (newSelectedBrands[1] === oldBrand1) { // Was previous Brand 1 (unlikely if only two can be chosen, but for completeness)
            updatedPrev.objective2 = prev.objective1;
            updatedPrev.expected_outcome2 = prev.expected_outcome1;
            updatedPrev.priority2 = prev.priority1;
            updatedPrev.notes2 = prev.notes1;
          }
        }
        
        return {
          ...updatedPrev,
          selectedBrands: newSelectedBrands,
        };
      });
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

    if ((user?.role === 'BL' || user?.role === 'BM') && formData.selectedBrands.length === 0) {
      setError('Please select at least one brand.');
      setLoading(false);
      return;
    }

    // Validate per-brand engagement details if brands are selected
    if (formData.selectedBrands[0]) {
      if (!formData.objective1 || !formData.notes1) {
        setError(`Please fill in all required engagement details for ${formData.selectedBrands[0]}.`);
        setLoading(false);
        return;
      }
    }
    if (formData.selectedBrands[1]) {
      if (!formData.objective2 || !formData.notes2) {
        setError(`Please fill in all required engagement details for ${formData.selectedBrands[1]}.`);
        setLoading(false);
        return;
      }
    }

    try {
      const doctorId = parseInt(formData.doctor_id);

      if (isNaN(doctorId) || doctorId <= 0) {
        setError('Invalid doctor selected');
        setLoading(false);
        return;
      }

      const requestPayload = {
        doctor_id: doctorId,
        territory: formData.territory,
        region: formData.region,
        therapy_area: formData.therapy_area,
        
        // First brand - use field names without "1" suffix to match backend schema
        brand: formData.selectedBrands[0] || null,
        objective: formData.objective1 || null,
        expected_outcome: formData.expected_outcome1 || null,
        priority: formData.priority1 || null,
        notes: formData.notes1 || null,

        // Second brand
        brand2: formData.selectedBrands[1] || null,
        objective2: formData.objective2 || null,
        expected_outcome2: formData.expected_outcome2 || null,
        priority2: formData.priority2 || null,
        notes2: formData.notes2 || null,

        requested_by: user.username,
        requested_by_role: user.role,
        // request_status and user_classification are handled by backend defaults or updates
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
                    {d.name} ({d.speciality || d.therapy_area || ''})
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
            <div className="form-group" style={{ position: 'relative' }} ref={brandDropdownRef}>
              <label>Select Brands (up to 2) *</label>
              <div
                className="custom-multi-select-display"
                onClick={() => setShowBrandDropdown(!showBrandDropdown)}
                style={{
                  border: '1px solid #ced4da',
                  borderRadius: '0.25rem',
                  padding: '0.375rem 0.75rem',
                  minHeight: '38px',
                  cursor: 'pointer',
                  backgroundColor: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '5px',
                }}
              >
                {formData.selectedBrands.length > 0 ? (
                  formData.selectedBrands.map(brand => (
                    <span key={brand} className="selected-brand-tag" style={{
                      backgroundColor: '#e9ecef',
                      padding: '2px 8px',
                      borderRadius: '15px',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      {brand}
                      <span onClick={(e) => {
                        e.stopPropagation(); // Prevent dropdown from closing
                        handleChange({
                          target: { name: 'brand_checkbox_custom', value: brand, type: 'checkbox', checked: false }
                        });
                      }} style={{ cursor: 'pointer', fontWeight: 'bold' }}>&times;</span>
                    </span>
                  ))
                ) : (
                  <span style={{ color: '#6c757d' }}>Select Brands...</span>
                )}
              </div>
              
              {showBrandDropdown && (
                <div className="brand-options-dropdown" style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  border: '1px solid #ced4da',
                  borderRadius: '0.25rem',
                  backgroundColor: '#fff',
                  zIndex: 1000,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  boxShadow: '0 0.5rem 1rem rgba(0,0,0,.15)'
                }}>
                  {BRAND_OPTIONS.map(brand => (
                    <label key={brand} className="checkbox-label" style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee'
                    }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}>
                      <input
                        type="checkbox"
                        name="brand_checkbox_custom"
                        value={brand}
                        checked={formData.selectedBrands.includes(brand)}
                        onChange={handleChange}
                        disabled={!formData.selectedBrands.includes(brand) && formData.selectedBrands.length >= 2}
                        style={{ marginRight: '10px' }}
                      />
                      {brand}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= ENGAGEMENT DETAILS ================= */}
        {(user?.role === 'BL' || user?.role === 'BM') && formData.selectedBrands.length > 0 && (
          <div className="form-section">
            <h3>Engagement Details</h3>

            {formData.selectedBrands[0] && (
              <div className="brand-engagement-section">
                <h4>{formData.selectedBrands[0]} Engagement Details</h4>
                <div className="form-group">
                  <label>Objective *</label>
                  <textarea
                    className="form-control"
                    name="objective1"
                    value={formData.objective1}
                    onChange={handleChange} 
                    placeholder={`Reason for requesting MSL interaction for ${formData.selectedBrands[0]}`}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Expected Outcome</label>
                  <textarea
                    className="form-control"
                    name="expected_outcome1"
                    value={formData.expected_outcome1} 
                    placeholder={`Expectation from MSL interaction for ${formData.selectedBrands[0]}`}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select className="form-control" name="priority1" value={formData.priority1} onChange={handleChange}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Problem Statement * </label>
                  <textarea
                    className="form-control"
                    name="notes1"
                    value={formData.notes1} 
                    placeholder={`Concepts previously discussed, objections for ${formData.selectedBrands[0]}`}
                    required
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            {formData.selectedBrands[1] && (
              <div className="brand-engagement-section">
                <h4>{formData.selectedBrands[1]} Engagement Details</h4>
                <div className="form-group">
                  <label>Objective *</label>
                  <textarea
                    className="form-control"
                    name="objective2"
                    value={formData.objective2}
                    onChange={handleChange} 
                    placeholder={`Reason for requesting MSL interaction for ${formData.selectedBrands[1]}`}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Expected Outcome</label>
                  <textarea
                    className="form-control"
                    name="expected_outcome2"
                    value={formData.expected_outcome2} 
                    placeholder={`Expectation from MSL interaction for ${formData.selectedBrands[1]}`}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select className="form-control" name="priority2" value={formData.priority2} onChange={handleChange}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Problem Statement * </label>
                  <textarea
                    className="form-control"
                    name="notes2"
                    value={formData.notes2} 
                    placeholder={`Concepts previously discussed, objections for ${formData.selectedBrands[1]}`}
                    required
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}
          </div>
        )}

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
