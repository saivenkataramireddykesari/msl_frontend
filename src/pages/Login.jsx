import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import '../styles/Login.css';

const Login = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const [searchParams] = useSearchParams();
  const dataParam = searchParams.get('data');

  useEffect(() => {
    const performUrlLogin = async () => {
      // If there is no data param, check if the user is already authenticated
      if (!dataParam) {
        if (isAuthenticated && user) {
          if (user.role === 'BM') {
            navigate('/monthly-report', { replace: true });
          } else {
            navigate('/requests', { replace: true });
          }
        }
        return;
      }

      setError('');
      setLoading(true);

      let employeeId = '';
      try {
        // Robust check: try decoding from base64 first.
        // We'll see if the raw param looks like a clean employee ID directly.
        if (/^[a-zA-Z]\d+$/.test(dataParam.trim())) {
          employeeId = dataParam.trim();
        } else {
          const decoded = atob(dataParam.trim()).trim();
          // Check if decoded value is a printable string and matches basic pattern or looks like a valid ID
          if (/^[\x20-\x7E]+$/.test(decoded)) {
            employeeId = decoded;
          } else {
            employeeId = dataParam.trim();
          }
        }
      } catch (err) {
        // Fallback to raw param directly if base64 decoding fails (e.g. not padded correctly or contains invalid chars)
        employeeId = dataParam.trim();
      }

      if (!employeeId) {
        setError('Invalid login link: Employee ID is empty.');
        setLoading(false);
        return;
      }

      try {
        console.log('Attempting passwordless login for Employee ID:', employeeId);
        const response = await authService.loginByEmployeeId(employeeId);
        const data = response.data;

        login({
          username: data.username,
          role: data.role,
          employee_id: data.employee_id
        });

        // Redirect based on role: BM goes to monthly-report, others go to requests
        // Use replace: true so that search query parameter is replaced/removed from history
        if (data.role === 'BM') {
          navigate('/monthly-report', { replace: true });
        } else {
          navigate('/requests', { replace: true });
        }
      } catch (err) {
        console.error('Passwordless login failed:', err);
        setError(err.response?.data?.detail || 'Authentication failed. Please verify your employee ID link.');
      } finally {
        setLoading(false);
      }
    };

    performUrlLogin();
  }, [dataParam, login, navigate, isAuthenticated, user]);

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>MSL Engagement System</h1>
          <p>Medical Science Liaison Management Platform</p>
        </div>

        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
              <div className="spinner" style={{
                width: '40px',
                height: '40px',
                border: '4px solid rgba(102, 126, 234, 0.1)',
                borderTop: '4px solid #667eea',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#667eea' }}>Verifying Credentials...</h2>
              <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
                Please wait while we secure your session.
              </p>
            </div>
          ) : error ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
              <div style={{ fontSize: '48px' }}>⚠️</div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#dc2626' }}>Access Denied</h2>
              <div className="error-message" style={{ width: '100%', boxSizing: 'border-box' }}>{error}</div>
              <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
                Please use a valid personalized link to access this application.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
              <div style={{ fontSize: '48px' }}>🔒</div>
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#333' }}>Authentication Required</h2>
              <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.5', margin: 0 }}>
                This platform uses passwordless authentication. Please access it using your personalized link containing the employee credentials.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
