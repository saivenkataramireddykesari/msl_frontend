import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doctorService, requestService, interactionService, brandService, hierarchyService } from '../services/api';
import '../styles/RequestForm.css';

const PRIORITIES = ['High', 'Medium', 'Low'];

const RequestForm = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedDoctorId = location.state?.selectedDoctorId;
  const brandDropdownRef = useRef(null);
  const doctorInputRef = useRef(null); // Ref for doctor input and suggestions

  // State for doctor search and selection
  const [doctorSearchTerm, setDoctorSearchTerm] = useState('');
  const [suggestedDoctors, setSuggestedDoctors] = useState([]);
  const [showDoctorSuggestions, setShowDoctorSuggestions] = useState(false);
  const [selectedDoctorName, setSelectedDoctorName] = useState('');

  // State for cascading dropdowns
  const [regions, setRegions] = useState([]);
  const [territories, setTerritories] = useState([]);
  const [patches, setPatches] = useState([]);
  
  // NEW: State for cached access data
  const [accessData, setAccessData] = useState({ regions: [], territories: [], patches: [], doctors: [] });

  const [availableBrands, setAvailableBrands] = useState([]); // New state for brands based on division
  const [localStorageDivision, setLocalStorageDivision] = useState(null); // State to store division from local storage

  const [doctorHistory, setDoctorHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showBrandDropdown, setShowBrandDropdown] = useState(false); 
  const [showBrandError, setShowBrandError] = useState(false); // New state for brand error

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

  const getBLTerritory = () => {
    return user?.bl_territory || null;
  };



  // FETCH BRANDS on mount
  useEffect(() => {
    const storedDivision = localStorage.getItem('userDivision');
    if (storedDivision) {
      setLocalStorageDivision(storedDivision);
    }

    const fetchBrands = async () => {
      console.log('Attempting to fetch all brands.');
      setShowBrandError(false); // Reset error state
      try {
        // Use localStorageDivision for fetching brands if available, otherwise fallback to user?.division
        const divisionToFetch = storedDivision || user?.division;
        const res = await brandService.getBrands(divisionToFetch);
        console.log('Fetched all brands for division:', divisionToFetch, res.data);
        setAvailableBrands(res.data);
        // Reset selected brands if the available brands change
        setFormData(prev => ({ ...prev, selectedBrands: [] }));
      } catch (err) {
        console.error('Error fetching brands:', err);
        setError('Failed to load brands: ' + (err.response?.data?.detail || err.message));
        setShowBrandError(true); // Set error state on failure
      }
    };
    fetchBrands();
  }, [user?.division]); // Added user?.division to dependency array so brands re-fetch if user changes

  // Define fetchAccessData outside useEffect to avoid re-creation issues
  const fetchAccessData = useCallback(async () => {
    try {
      if (!user?.employee_id) return;
      
      // Check cache first
      const cacheKey = `accessData_v3_${user.employee_id}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        setAccessData(parsed);
        setRegions(parsed.regions || []);
        if (parsed.regions?.length === 1) {
           setFormData(prev => ({ ...prev, region: parsed.regions[0] }));
        }
        return;
      }

      const res = await hierarchyService.getAccessData(user.employee_id);
      console.log("PATCH API RESPONSE:", res.data); // Added log
      const data = res.data;
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (storageErr) {
        console.warn("Could not cache accessData in sessionStorage, possibly due to quota limits", storageErr);
      }
      setAccessData(data);
      
      setRegions(data.regions || []);
      if (data.regions?.length === 1) {
         setFormData(prev => ({ ...prev, region: data.regions[0] }));
      }
    } catch (err) {
      console.error("Error fetching access data:", err);
      setError("Failed to load access data.");
    }
  }, [user?.employee_id]); // Added dependency for user.employee_id

  // FETCH ACCESS DATA on mount
  useEffect(() => {
    if (user?.employee_id) {
      console.log("User available, fetching access data...");
      fetchAccessData();
    }
  }, [user?.employee_id, fetchAccessData]);

  // FILTER TERRITORIES when region changes
  useEffect(() => {
    if (formData.region) {
      // Filter territories that belong to the selected region
      const filteredTerritories = accessData.territories.filter(
        (territoryItem) => territoryItem.region === formData.region
      );
      const uniqueTerritories = [...new Set(filteredTerritories.map((t) => t.name))].sort();

      setTerritories(uniqueTerritories);

      // Auto select if only one
      if (uniqueTerritories.length === 1) {
        setFormData((prev) => ({ ...prev, territory: uniqueTerritories[0] }));
      } else {
        setFormData((prev) => ({ ...prev, territory: '' })); // Clear territory if region changes
      }
    } else {
      setTerritories([]);
      setPatches([]);
    }
  }, [formData.region, accessData.territories]);

  // FETCH PATCHES when territory changes
  useEffect(() => {
    let cancelled = false;

    const fetchPatches = async () => {

      if (!formData.territory) {
        console.log("PATCH: No territory selected");

        setPatches([]);

        setFormData(prev => ({
          ...prev,
          patch: ''
        }));

        return;
      }

      try {

        console.log("========================================");
        console.log("PATCH FETCH START");
        console.log("Territory:", formData.territory);
        console.log("Region:", formData.region);
        console.log("Employee:", user?.employee_id);
        console.log("Role:", user?.role);
        console.log("========================================");

        const response =
          await doctorService.getPatchesByTerritory(
            formData.territory,
            formData.region || undefined,
            user?.employee_id,
            user?.role
          );

        console.log(
          "PATCH API STATUS:",
          response.status
        );

        console.log(
          "PATCH API RAW RESPONSE:",
          response.data
        );

        if (cancelled) {
          return;
        }

        let fetchedPatches = response.data || [];

        // Support both:
        // ["PATCH1", "PATCH2"]
        //
        // and:
        // [{ name: "PATCH1" }, { name: "PATCH2" }]

        if (
          fetchedPatches.length > 0 &&
          typeof fetchedPatches[0] === 'object'
        ) {
          fetchedPatches = fetchedPatches
            .map(p => p.patch || p.name)
            .filter(Boolean);
        }

        const uniquePatches = [
          ...new Set(
            fetchedPatches
              .map(p => String(p).trim())
              .filter(Boolean)
          )
        ].sort();

        console.log(
          "PATCHES FOUND:",
          uniquePatches
        );

        setPatches(uniquePatches);

        if (uniquePatches.length === 1) {

          console.log(
            "AUTO SELECTING PATCH:",
            uniquePatches[0]
          );

          setFormData(prev => ({
            ...prev,
            patch: uniquePatches[0]
          }));

        } else {

          setFormData(prev => ({
            ...prev,
            patch: ''
          }));
        }

      } catch (error) {

        if (cancelled) {
          return;
        }

        console.error(
          "PATCH API ERROR:",
          error
        );

        console.error(
          "PATCH ERROR RESPONSE:",
          error?.response?.data
        );

        console.error(
          "PATCH ERROR STATUS:",
          error?.response?.status
        );

        setPatches([]);

        setFormData(prev => ({
          ...prev,
          patch: ''
        }));
      }
    };

    fetchPatches();

    return () => {
      cancelled = true;
    };

  }, [
    formData.territory,
    formData.region,
    user?.employee_id,
    user?.role
  ]);



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

  // Close doctor suggestions dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (doctorInputRef.current && !doctorInputRef.current.contains(event.target)) {
        setShowDoctorSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [doctorInputRef]);

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
    } else if (name === 'patch') {
      // Reset doctor when patch changes
      setFormData(prev => ({
        ...prev,
        patch: value,
        doctor_id: '',
        therapy_area: ''
      }));
    } else if (name === 'brand_checkbox_custom') {
      setFormData(prev => {
        const currentBrands = new Set(prev.selectedBrands);
        const brandName = value; // Use the brand name directly
        if (checked) {
          if (currentBrands.size < 2) {
            currentBrands.add(brandName);
          } else {
            alert('You can select a maximum of 2 brands.');
            return prev; 
          }
        } else {
          currentBrands.delete(brandName);
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

  // HANDLE DOCTOR SEARCH INPUT
  const handleDoctorSearchChange = (e) => {
    const term = e.target.value;
    setDoctorSearchTerm(term);
    
    // For BL users: show suggestions from minimum 2 characters when no patch is pre-selected
    const isBL = user?.role === 'BL';
    if (isBL && !formData.patch && term.length >= 2) {
      fetchDoctors(term);
    } else if (!isBL || formData.patch) {
      // Non-BL or BL with patch already selected: normal behavior
      fetchDoctors(term);
    } else if (term.length === 0) {
      setSuggestedDoctors([]);
      setShowDoctorSuggestions(false);
    }

    // Clear selected doctor and (for BL) clear auto-filled territory/patch when typing new name
    setFormData(prev => ({
      ...prev,
      doctor_id: '',
      // Reset auto-filled fields for BL when they start a new search
      ...(isBL && selectedDoctorName && term !== selectedDoctorName
        ? { territory: '', patch: '' }
        : {}),
    }));
    setSelectedDoctorName('');
    setDoctorHistory([]);
  };

  // Fetch doctors dynamically from API
  const fetchDoctors = async (term) => {
    try {
      const isBL = user?.role === 'BL';

      // For BL users: search by name even without patch; require at least 1 char unless showing patch-based list
      if (!isBL && !formData.patch) {
        console.log('fetchDoctors: No patch selected (non-BL), returning.');
        setSuggestedDoctors([]);
        return;
      }

      // BL with no search term and no patch — don't flood with all doctors, wait for typing
      if (isBL && term.length === 0 && !formData.patch) {
        setSuggestedDoctors([]);
        setShowDoctorSuggestions(false);
        return;
      }

      console.log('fetchDoctors API: term:', term, ' patch:', formData.patch, ' isBL:', isBL);

      let fetchedDoctors = [];
      if (!formData.patch && isBL && term.length > 0) {
        // Global search for BL
        const res = await doctorService.searchDoctors(term, formData.region, formData.territory, null, formData.territory);
        fetchedDoctors = res.data || [];
      } else {
        // Location based search
        const res = await doctorService.getDoctorsByLocation(formData.region, formData.territory, formData.patch, null);
        fetchedDoctors = res.data || [];
        
        if (term) {
          const lowerTerm = term.toLowerCase();
          fetchedDoctors = fetchedDoctors.filter(d => 
            (d.name && d.name.toLowerCase().includes(lowerTerm)) ||
            (d.speciality && d.speciality.toLowerCase().includes(lowerTerm))
          );
        }
      }

      setSuggestedDoctors(fetchedDoctors);
      setShowDoctorSuggestions(true);
    } catch (err) {
      console.error('Error fetching doctors API:', err);
      setSuggestedDoctors([]);
    }
  };

  // HANDLE DOCTOR SELECTION FROM SUGGESTIONS
  const handleDoctorSelect = (doctor) => {
    setShowBrandError(false);
    setError('');

    const isBL = user?.role === 'BL';

    setFormData(prev => {
      const updatedForm = {
        ...prev,
        doctor_id: doctor.id,
        therapy_area: doctor.therapy_area || doctor.speciality || '',
        selectedBrands: [],
      };

      // For BL users: auto-populate region, territory, patch from doctor's record
      if (isBL) {
        if (doctor.region) updatedForm.region = doctor.region;
        if (doctor.territory) updatedForm.territory = doctor.territory;
        if (doctor.patch) updatedForm.patch = doctor.patch;
      }

      return updatedForm;
    });

    // The territory and patch will automatically update via the useEffects
    // observing formData.region and formData.territory.

    setSelectedDoctorName(doctor.name);
    setDoctorSearchTerm(doctor.name);
    setShowDoctorSuggestions(false);
    setSuggestedDoctors([]);
  };

  // Handle clearing selected doctor
  const handleClearDoctor = () => {
    setFormData(prev => ({
      ...prev,
      doctor_id: '',
      therapy_area: '',
      selectedBrands: [], // Clear selected brands
    }));
    setSelectedDoctorName('');
    setDoctorSearchTerm('');
    setDoctorHistory([]);
    setAvailableBrands([]); // Clear available brands
    setShowBrandError(false); // Clear brand error
  };

  // This useEffect handles pre-filling the form if a selectedDoctorId is passed via location state
  useEffect(() => {
    if (selectedDoctorId) {
      const fetchSelectedDoctor = async () => {
        try {
          const res = await doctorService.getDoctor(selectedDoctorId); // Assuming an API to get doctor by ID
          const doctor = res.data;
          if (doctor) {
            handleDoctorSelect(doctor);
            // Also set patch, territory, region if doctor data contains it
            setFormData(prev => ({
              ...prev,
              region: doctor.region || '',
              territory: doctor.territory || '',
              patch: doctor.patch || ''
            }));
          }
        } catch (err) {
          console.error('Error fetching selected doctor:', err);
          setError('Failed to load selected doctor: ' + (err.response?.data?.detail || err.message));
        }
      };
      fetchSelectedDoctor();
    }
  }, [selectedDoctorId]);
  
  // This useEffect clears doctor-related states if the patch selection is cleared.
  // For BL users: patch is optional, so we only clear doctor if a non-BL user has no patch.
  useEffect(() => {
    console.log('Patch useEffect triggered. formData.patch:', formData.patch);
    const isBL = user?.role === 'BL';
    if (!formData.patch && !isBL) {
      // Only clear doctor selection for non-BL users when patch is cleared
      setSuggestedDoctors([]);
      setSelectedDoctorName('');
      setDoctorSearchTerm('');
      setFormData(prev => ({ ...prev, doctor_id: '', therapy_area: '' }));
      setShowDoctorSuggestions(false);
    } else if (formData.patch) {
      console.log('Patch selected:', formData.patch, ' - calling fetchDoctors (no debounce)');
      fetchDoctors('');
      setShowDoctorSuggestions(true);
    }
  }, [formData.patch]);

  // FETCH HISTORY
  const fetchDoctorHistory = async () => {
    try {
      if (!formData.doctor_id || !selectedDoctorName) {
        setDoctorHistory([]);
        setShowHistory(false);
        return;
      }
      const res = await interactionService.getDoctorHistory(selectedDoctorName);
      setDoctorHistory(res.data);
      setShowHistory(true);
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

    // Territory and Patch are optional for BL users (SELECT selection)
    if (user?.role !== 'BL') {
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
        <h1>Scientific Officer Engagement Request</h1>
        <p>Create request for doctor interaction</p>
      </div>

      <form onSubmit={handleSubmit} className="request-form">

        {error && <div className="error-message">{error}</div>}

        {/* ================= DOCTOR SECTION ================= */}
        <div className="form-section">
          <h3>Doctor Information</h3>

          {/* Division display for BL/BM users */}


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

          <div className="form-row">
            <div className="form-group">
              <label>{user?.role === 'BL' ? 'Territory' : 'Territory *'}</label>
              <select
                className="form-control"
                name="territory"
                value={formData.territory}
                onChange={handleChange}
                disabled={!formData.region}
                style={user?.role === 'BL' && formData.territory ? { backgroundColor: '#e8f5e9' } : {}}
              >
                <option value="">{user?.role === 'BL' ? 'SELECT' : 'Select Territory'}</option>
                {territories.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {user?.role === 'BL' && formData.territory && (
                <small style={{ color: '#2e7d32', fontSize: '0.75rem' }}></small>
              )}
            </div>

            <div className="form-group">
              <label>{user?.role === 'BL' ? 'Patch' : 'Patch *'}</label>
              <select
                className="form-control"
                name="patch"
                value={formData.patch}
                onChange={handleChange}
                disabled={!formData.territory}
                style={user?.role === 'BL' && formData.patch ? { backgroundColor: '#e8f5e9' } : {}}
              >
                <option value="">{user?.role === 'BL' ? 'SELECT' : 'Select Patch'}</option>
                {patches.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {user?.role === 'BL' && formData.patch && (
                <small style={{ color: '#2e7d32', fontSize: '0.75rem' }}></small>
              )}
            </div>
          </div>

          <div className="form-group" style={{ position: 'relative' }} ref={doctorInputRef}>
            <label>Doctor *</label>
            {user?.role === 'BL' && !formData.patch && (
              <small style={{ color: '#6c757d', display: 'block', marginBottom: '4px' }}>

              </small>
            )}
            <input
              type="text"
              className="form-control"
              name="doctor_search_term"
              value={selectedDoctorName || doctorSearchTerm}
              onChange={handleDoctorSearchChange}
              placeholder={user?.role === 'BL' ? 'Search Doctor by name...' : 'Search Doctor'}
              disabled={user?.role !== 'BL' && !formData.patch}
              onFocus={() => {
                setShowDoctorSuggestions(true);
                if (!doctorSearchTerm && formData.patch) {
                  fetchDoctors('');
                }
              }}
            />
            {formData.doctor_id && (
              <button
                type="button"
                className="clear-doctor-btn"
                onClick={handleClearDoctor}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '38px',
                  background: 'none',
                  border: 'none',
                  color: '#dc3545',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            )}
            {showDoctorSuggestions && suggestedDoctors.length > 0 && (
              <div className="doctor-suggestions-dropdown" style={{
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
                boxShadow: '0 0.5rem 1rem rgba(0,0,0,.15)',
              }}>
                {suggestedDoctors.map(doctor => (
                  <div
                    key={doctor.id}
                    className="doctor-suggestion-item"
                    onClick={() => handleDoctorSelect(doctor)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                  >
                    {doctor.name} ({doctor.speciality || doctor.therapy_area || ''})
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Speciality</label>
            <input className="form-control" value={formData.therapy_area} readOnly />
          </div>

          {(user?.role === 'BL' || user?.role === 'BM') && formData.doctor_id && (
            <div className="form-group" style={{ position: 'relative' }} ref={brandDropdownRef}>
              <label>Select Brands (up to 2) *</label>

              {availableBrands.length === 0 && showBrandError ? (
                <div className="error-message">{ (user?.role === 'BL' || user?.role === 'BM') ? 'No brands available for your division.' : 'No brands available for the selected doctor\'s division.' }</div>
              ) : (
                <>
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
                      formData.selectedBrands.map(brandName => (
                        <span key={brandName} className="selected-brand-tag" style={{
                          backgroundColor: '#e9ecef',
                          padding: '2px 8px',
                          borderRadius: '15px',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          {brandName}
                          <span onClick={(e) => {
                            e.stopPropagation(); // Prevent dropdown from closing
                            handleChange({
                              target: { name: 'brand_checkbox_custom', value: brandName, type: 'checkbox', checked: false }
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
                      {availableBrands.map(brand => (
                        <label key={brand.id} className="checkbox-label" style={{
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
                            value={brand.brandname} // Use brand.brandname as value
                            checked={formData.selectedBrands.includes(brand.brandname)}
                            onChange={handleChange}
                            disabled={!formData.selectedBrands.includes(brand.name) && formData.selectedBrands.length >= 2}
                            style={{ marginRight: '10px' }}
                          />
                          {brand.brandname}
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}
              {/* The general error message will be shown at the top of the form, so no need for a specific one here */}
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
                    placeholder={`Reason for requesting Scientific Officer interaction for ${formData.selectedBrands[0]}`}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Expected Outcome</label>
                  <textarea
                    className="form-control"
                    name="expected_outcome1"
                    value={formData.expected_outcome1} 
                    placeholder={`Expectation from Scientific Officer interaction for ${formData.selectedBrands[0]}`}
                    onChange={handleChange}
                  />
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
                    placeholder={`Reason for requesting Scientific Officer interaction for ${formData.selectedBrands[1]}`}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Expected Outcome</label>
                  <textarea
                    className="form-control"
                    name="expected_outcome2"
                    value={formData.expected_outcome2} 
                    placeholder={`Expectation from Scientific Officer interaction for ${formData.selectedBrands[1]}`}
                    onChange={handleChange}
                  />
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
