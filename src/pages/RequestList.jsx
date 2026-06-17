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

  const [search, setSearch] = useState('');
  const [filterTerritory, setFilterTerritory] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterTherapy, setFilterTherapy] = useState('');
  const [filterClassification, setFilterClassification] = useState('All');

  useEffect(() => {
    fetchRequests();
  }, [user]);

  // Merged filter logic
  useEffect(() => {
    let data = requests;

    if (filterClassification !== 'All') {
      data = data.filter(r => r.user_classification === filterClassification);
    }

    if (search) {
      data = data.filter(r =>
        r.doctor_name?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (filterTerritory) {
      data = data.filter(r => r.territory === filterTerritory);
    }

    if (filterRegion) {
      data = data.filter(r => r.region === filterRegion);
    }

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
        {/* <h1>Scientific Office Requests</h1> */}
        
      </div>

      {/* Classification Filter */}
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
          {(user?.role === 'BL' || user?.role === 'BM') && (
          <Link to="/requests/new" className="new-request-btn">
            + New Request
          </Link>
        )}
        </div>
      </div>

      {/* Filter Bar */}
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
                <th>Region</th>
                <th>Territory</th>
                <th>Doctor</th>
                <th>Objective(s)</th>
                {/* <th>Priority</th> */}
                <th>RX Status (Brand 1)</th>
                <th>RX Status (Brand 2)</th>
                <th>Brand(s)</th>
                <th>Assigned To</th>
                <th>Number Of Visits</th>
                <th>Requested By</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id}>
                  <td>#{request.id}</td>
                  <td>{request.region}</td>
                  <td>{request.territory}</td>
                  <td className="doctor-name">{request.doctor_name}</td>
                  <td className="objective-cell">
                    {request.objective?.substring(0, 50)}
                    {request.objective?.length > 50 ? '...' : ''}
                    {request.brand2 && request.objective2 && (
                      <>
                        <br />
                        <em>{request.objective2?.substring(0, 50)}</em>
                        {request.objective2?.length > 50 ? '...' : ''}
                      </>
                    )}
                  </td>
                  {/* <td>
                    {request.brand && request.priority && (
                      <span className={`priority-badge ${request.priority?.toLowerCase()}`}>
                        {request.priority}
                      </span>
                    )}
                    {request.brand2 && request.priority2 && (
                      <span className={`priority-badge ${request.priority2?.toLowerCase()}`} style={{ marginTop: '5px', display: 'block' }}>
                        {request.priority2}
                      </span>
                    )}
                    {(!request.brand || !request.priority) && (!request.brand2 || !request.priority2) && '—'}
                  </td> */}
                  <td>
                    {request.brand ? (
                      <span className={`status-badge ${(request.rx_status_brand1 || 'default')?.toLowerCase().replace(' ', '-')}`}>
                        {request.rx_status_brand1 === 'potential'
                          ? 'Potential User'
                          : request.rx_status_brand1 === 'non-potential'
                            ? 'Not a Potential User'
                            : request.rx_status_brand1 || 'Default'}
                      </span>
                    ) : (
                      <span className="no-brand">—</span>
                    )}
                  </td>
                  <td>
                    {request.brand2 ? (
                      <span className={`status-badge ${(request.rx_status_brand2 || 'default')?.toLowerCase().replace(' ', '-')}`}>
                        {request.rx_status_brand2 === 'potential'
                          ? 'Potential User'
                          : request.rx_status_brand2 === 'non-potential'
                            ? 'Not a Potential User'
                            : request.rx_status_brand2 || 'Default'}
                      </span>
                    ) : (
                      <span className="no-brand">—</span>
                    )}
                  </td>
                  <td>
                    {request.brand && <div>{request.brand}</div>}
                    {request.brand2 && <div>{request.brand2}</div>}
                    {!request.brand && !request.brand2 && '—'}
                  </td>
                  <td>
                    {request.assigned_msl ? (
                      <span className="assigned-badge">{request.assigned_msl}</span>
                    ) : (
                      <span className="unassigned-badge">Unassigned</span>
                    )}
                  </td>
                  <td>
                    <span className="visits-count">{request.num_visits ?? 0}</span>
                  </td>
                  <td>{request.requested_by}</td>
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
