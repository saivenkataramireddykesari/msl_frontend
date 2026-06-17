import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import '../styles/Navbar.css';


const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getRoleLabel = (role) => {
    const roles = {
      'BL': 'Business Leader',
      'BM': 'Business Manager',
      'MSL': 'Scientific Officer',
      'Scientific Officer': 'Scientific Officer',
      'SBUH/BH': 'SBUH/BH',
      'Asst General Manager': 'Asst General Manager',
      'Associate Vice President': 'Associate Vice President'
    };
    return roles[role] || role;
  };

  const canAccessActivities = ['MSL', 'Scientific Officer', 'Asst General Manager', 'Associate Vice President'].includes(user?.role);
  const canAccessMonthlyReport = ['BM', 'Asst General Manager', 'Associate Vice President'].includes(user?.role);

  // Determine landing page based on role
  const getLandingPage = () => {
    if (user?.role === 'BM') return '/monthly-report';
    return '/requests';
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to={getLandingPage()}>Scientific Office</Link>
      </div>

      <div className="navbar-menu">
        {/* <Link to="/dashboard" className="nav-link">Dashboard</Link> */}
        {user?.role !== 'BM' && (
          <Link to="/requests" className="nav-link">Requests</Link>
        )}
        {canAccessActivities && (
          <Link to="/office-activities" className="nav-link">Activities</Link>
        )}
        {canAccessMonthlyReport && (
          <Link to="/monthly-report" className="nav-link">Monthly Report</Link>
        )}
      </div>

      <div className="navbar-user">
        <div className="user-info">
          <span className="user-name">{user?.username}</span>
          <span className="user-role">{getRoleLabel(user?.role)}</span>
        </div>

        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
