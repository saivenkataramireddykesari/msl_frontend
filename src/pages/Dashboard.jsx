import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestService } from '../services/api';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalRequests: 0,
  });
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const getRoleLabel = (role) => {
    const roles = {
      'BL': 'Business Leader',
      'BM': 'Business Manager',
      'MSL': 'Medical Science Liaison',
      'Scientific Officer': 'Medical Science Liaison',
      'SBUH/BH': 'SBUH/BH',
      'Asst General Manager': 'Asst General Manager',
      'Associate Vice President': 'Associate Vice President'
    };
    return roles[role] || role;
  };



  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params = {
        role: user?.role,
        username: user?.username
      };

      const response = await requestService.getRequests(params);
      const requests = response.data;

      setStats({
        totalRequests: requests.length,
      });

      setRecentRequests(requests.slice(0, 5));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };





  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome, {user?.username}</h1>
        <p className="role-badge">{getRoleLabel(user?.role)}</p>
      </div>



      <div className="stats-grid">
        <div className="stat-card">
          <h3>{stats.totalRequests}</h3>
          <p>Total Requests</p>
        </div>
      </div>

      <div className="recent-section">
        <h2>Recent Requests</h2>
        {recentRequests.length === 0 ? (
          <div className="empty-state">
            <p>No requests found. Get started by creating a new request.</p>
          </div>
        ) : (
          <div className="recent-list">
            {recentRequests.map((request) => (
              <Link
                to={`/requests/${request.id}`}
                key={request.id}
                className="recent-item"
              >
                <div className="recent-info">
                  <h4>{request.doctor_name}</h4>
                  <p>{request.therapy_area} • {request.objective?.substring(0, 50)}...</p>
                </div>
                <div className="recent-meta">
                  <span className="priority-badge">{request.priority}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;