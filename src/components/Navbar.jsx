import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    setMobileMenuOpen(false);
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
      'Associate Vice President': 'Associate Vice President',
      'Admin': 'Administrator',
      'admin': 'Administrator'
    };
    return roles[role] || role;
  };

  const getInitial = (name) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  const canAccessActivities = ['MSL', 'Scientific Officer', 'Asst General Manager', 'Associate Vice President', 'Admin', 'admin'].includes(user?.role);
  const canAccessMonthlyReport = ['BM', 'Asst General Manager', 'Associate Vice President', 'Admin', 'admin'].includes(user?.role);
  const canAccessPlannedVisits = ['MSL', 'Scientific Officer', 'Asst General Manager', 'Associate Vice President', 'Admin', 'admin'].includes(user?.role);
  const canAccessTourPlan = ['Asst General Manager', 'Associate Vice President', 'Admin', 'admin', 'MSL', 'Scientific Officer', 'BL'].includes(user?.role);

  const getLandingPage = () => {
    if (['BM', 'Admin', 'admin'].includes(user?.role)) return '/monthly-report';
    return '/requests';
  };

  const isActive = (path) => {
    if (path === '/requests') {
      return location.pathname.startsWith('/requests');
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <header className="navbar-header">
        <nav className="navbar">
          {/* Brand Logo & Title */}
          <div className="navbar-brand">
            <Link to={getLandingPage()} className="brand-link">
              <span className="brand-logo-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </span>
              <div className="brand-text">
                <span className="brand-title">Scientific Office</span>
                <span className="brand-badge">Pulse</span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Menu */}
          <div className="navbar-menu">
            <Link
              to="/requests"
              className={`nav-link ${isActive('/requests') ? 'active' : ''}`}
            >
              <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>Requests</span>
            </Link>

            {canAccessActivities && (
              <Link
                to="/office-activities"
                className={`nav-link ${isActive('/office-activities') ? 'active' : ''}`}
              >
                <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                <span>Activities</span>
              </Link>
            )}

            {canAccessMonthlyReport && (
              <Link
                to="/monthly-report"
                className={`nav-link ${isActive('/monthly-report') ? 'active' : ''}`}
              >
                <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                <span>Reports</span>
              </Link>
            )}

            {canAccessPlannedVisits && (
              <Link
                to="/planned-visits"
                className={`nav-link ${isActive('/planned-visits') ? 'active' : ''}`}
              >
                <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>Planned Visits</span>
              </Link>
            )}

            {/* {canAccessTourPlan && (
              <Link
                to="/tour-plan"
                className={`nav-link ${isActive('/tour-plan') ? 'active' : ''}`}
              >
                <svg className="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>Tour Plan</span>
              </Link> 
            )} */}
          </div>

          {/* Desktop User Info & Actions */}
          <div className="navbar-user">
            <div className="user-profile-chip">
              <div className="user-avatar-circle" title={user?.username}>
                {getInitial(user?.username)}
              </div>
              <div className="user-meta">
                <span className="user-name">{user?.username}</span>
                <span className="user-role-badge">{getRoleLabel(user?.role)}</span>
              </div>
            </div>

            <button onClick={handleLogout} className="logout-btn" title="Sign out of account">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Logout</span>
            </button>
          </div>

          {/* Mobile Right Controls: User Avatar + Hamburger Button */}
          <div className="mobile-nav-toggle-wrap">
            <div className="mobile-user-avatar" onClick={() => setMobileMenuOpen(true)}>
              {getInitial(user?.username)}
            </div>

            <button
              type="button"
              className={`hamburger-btn ${mobileMenuOpen ? 'open' : ''}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              <span className="hamburger-bar"></span>
              <span className="hamburger-bar"></span>
              <span className="hamburger-bar"></span>
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Navigation Drawer */}
      <aside className={`mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <div className="drawer-brand">
            <span className="brand-logo-icon small">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </span>
            <span className="drawer-title">Scientific Office</span>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* User Card inside Drawer */}
        <div className="drawer-user-card">
          <div className="drawer-avatar">
            {getInitial(user?.username)}
          </div>
          <div className="drawer-user-info">
            <h4 className="drawer-username">{user?.username || 'User'}</h4>
            <span className="drawer-role">{getRoleLabel(user?.role)}</span>
            {(user?.division || user?.bl_region) && (
              <span className="drawer-subinfo">
                {[user.division, user.bl_region].filter(Boolean).join(' • ')}
              </span>
            )}
          </div>
        </div>

        {/* Drawer Navigation Links */}
        <div className="drawer-nav-list">
          <Link
            to="/requests"
            className={`drawer-link ${isActive('/requests') ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <span className="drawer-link-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </span>
            <div className="drawer-link-text">
              <span className="drawer-link-title">Requests</span>
              <span className="drawer-link-desc">Manage scientific requests</span>
            </div>
          </Link>

          {canAccessActivities && (
            <Link
              to="/office-activities"
              className={`drawer-link ${isActive('/office-activities') ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="drawer-link-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              </span>
              <div className="drawer-link-text">
                <span className="drawer-link-title">Activities</span>
                <span className="drawer-link-desc">Scientific office activities</span>
              </div>
            </Link>
          )}

          {canAccessMonthlyReport && (
            <Link
              to="/monthly-report"
              className={`drawer-link ${isActive('/monthly-report') ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="drawer-link-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </span>
              <div className="drawer-link-text">
                <span className="drawer-link-title">Reports</span>
                <span className="drawer-link-desc">Monthly activity & brand reports</span>
              </div>
            </Link>
          )}

          {canAccessPlannedVisits && (
            <Link
              to="/planned-visits"
              className={`drawer-link ${isActive('/planned-visits') ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="drawer-link-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
              <div className="drawer-link-text">
                <span className="drawer-link-title">Planned Visits</span>
                <span className="drawer-link-desc">Field visit schedule & doctor plans</span>
              </div>
            </Link>
          )}

          {canAccessTourPlan && (
            <Link
              to="/tour-plan"
              className={`drawer-link ${isActive('/tour-plan') ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="drawer-link-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <div className="drawer-link-text">
                <span className="drawer-link-title">Tour Plan</span>
                <span className="drawer-link-desc">Monthly tour plan and assignments</span>
              </div>
            </Link>
          )}
        </div>

        {/* Drawer Footer Logout */}
        <div className="drawer-footer">
          <button onClick={handleLogout} className="drawer-logout-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Navbar;
