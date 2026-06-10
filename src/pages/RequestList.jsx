import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestService } from '../services/api';
import '../styles/RequestList.css';

const CLASSIFICATIONS = ['All', 'potential', 'non-potential', 'default'];

const RequestList = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ NEW STATES
  const [search, setSearch] = useState('');
  const [filterTerritory, setFilterTerritory] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterTherapy, setFilterTherapy] = useState('');
  const [filterClassification, setFilterClassification] = useState('All');

  useEffect(() => {
    fetchRequests();
  }, [user]);

  // ✅ UPDATED FILTER LOGIC (MERGED ALL FILTERS)
  useEffect(() => {
    let data = requests;

    // classification filter
    if (filterClassification !== 'All') {
      data = data.filter(r => r.user_classification === filterClassification);
    }

    // search filter
    if (search) {
      data = data.filter(r =>
        r.doctor_name?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // territory filter
    if (filterTerritory) {
      data = data.filter(r => r.territory === filterTerritory);
    }

    // region filter
    if (filterRegion) {
      data = data.filter(r => r.region === filterRegion);
    }

    // therapy filter
    if (filterTherapy) {
      data = data.filter(r => r.therapy_area === filterTherapy);
    }

    setFilteredRequests(data);

  }, [filterClassification, search, filterTerritory, filterRegion, filterTherapy, requests]);

  const fetchRequests = async () => {
    try {
      setLoading(true);

      const params = {
        role: user?.role,
        username: user?.username
      };

      const response = await requestService.getRequests(params);

      console.log('=== FETCH REQUESTS ===');
      console.log('Fetched requests count:', response.data.length);
      if (response.data.length > 0) {
        console.log('First request full data:', JSON.stringify(response.data[0], null, 2));
      }
      console.log('=== END FETCH ===');

      setRequests(response.data);
      setFilteredRequests(response.data);

    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return <div className="loading">Loading requests...</div>;
  }

  return (
    <div className="request-list-container">

      <div className="list-header">
        <h1>MSL Engagement Requests</h1>
        {(user?.role === 'BL' || user?.role === 'BM') && (
          <Link to="/requests/new" className="new-request-btn">
            + New Request
          </Link>
        )}
      </div>

      {/* ✅ CLASSIFICATION FILTER */}
      <div className="filter-bar">
        <label>Filter by Classification:</label>
        <div className="filter-buttons">
          {CLASSIFICATIONS.map(classification => (
            <button
              key={classification}
              className={`filter-btn ${filterClassification === classification ? 'active' : ''}`}
              onClick={() => setFilterClassification(classification)}
            >
              {classification === 'All'
                ? 'All'
                : classification === 'potential'
                  ? 'Potential User'
                  : classification === 'non-potential'
                    ? 'Not a Potential User'
                    : 'Default'}
            </button>
          ))}
        </div>
      </div>

      {/* ✅ FILTER BAR */}
      <div className="filters">

        <input
          type="text"
          placeholder="Search doctor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select onChange={(e) => setFilterTerritory(e.target.value)} value={filterTerritory}>
          <option value="">All Territories</option>
          {[...new Set(requests.map(r => r.territory).filter(Boolean))].map(t => (
            <option key={`terr-${t}`} value={t}>{t}</option>
          ))}
        </select>

        <select onChange={(e) => setFilterRegion(e.target.value)} value={filterRegion}>
          <option value="">All Regions</option>
          {[...new Set(requests.map(r => r.region).filter(Boolean))].map(r => (
            <option key={`reg-${r}`} value={r}>{r}</option>
          ))}
        </select>

        <select onChange={(e) => setFilterTherapy(e.target.value)} value={filterTherapy}>
          <option value="">All Therapy</option>
          {[...new Set(requests.map(r => r.therapy_area).filter(Boolean))].map(t => (
            <option key={`therapy-${t}`} value={t}>{t}</option>
          ))}
        </select>

      </div>
      {filteredRequests.length === 0 ? (
        <div className="empty-state">
          <p>No requests found.</p>
        </div>
      ) : (
        <div className="requests-table-container">
          <table className="requests-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Doctor</th>
                <th>Territory</th> {/* ✅ ADDED */}
                <th>Region</th>    {/* ✅ ADDED */}
                {/* <th>Therapy Area</th> */}
                <th>Objective</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Requested By</th>
                <th>Assigned MSL</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id}>
                  <td>#{request.id}</td>
                  <td className="doctor-name">{request.doctor_name}</td>
                  <td>{request.territory}</td> {/* ✅ */}
                  <td>{request.region}</td>    {/* ✅ */}
                  <td className="objective-cell">
                    {request.objective?.substring(0, 50)}
                    {request.objective?.length > 50 ? '...' : ''}
                  </td>
                  <td>
                    <span className={`priority-badge ${request.priority?.toLowerCase()}`}>
                      {request.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${request.user_classification?.toLowerCase().replace(' ', '-') || 'default'}`}>
                      {request.user_classification === 'potential' ? 'Potential User' :
                        request.user_classification === 'non-potential' ? 'Not a Potential User' :
                          'Default User'}
                    </span>
                  </td>
                  <td>{request.requested_by}</td>
                  <td>
                    {request.assigned_msl ? (
                      <span className="assigned-badge">{request.assigned_msl}</span>
                    ) : (
                      <span className="unassigned-badge">Unassigned</span>
                    )}
                  </td>
                  <td>{formatDate(request.created_at)}</td>
                  <td>
                    <Link to={`/requests/${request.id}`} className="view-btn">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      )}
    </div>
  );
};

export default RequestList;