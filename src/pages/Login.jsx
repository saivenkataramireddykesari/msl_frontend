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
     if (!dataParam && isAuthenticated && user) {
       if (user.role === 'BM') {
         navigate('/monthly-report', { replace: true });
       } else {
         navigate('/requests', { replace: true });
       }
     }
   }, [dataParam, isAuthenticated, user, navigate]);

   useEffect(() => {
     if (!dataParam || loading) {
       return;
     }

     const performUrlLogin = async () => {
       setError('');
       setLoading(true);

       let employeeId = '';
       try {
         const decoded = atob(dataParam.trim()).trim();
         if (/^[a-zA-Z0-9]+$/.test(decoded)) {
           employeeId = decoded;
         } else {
           throw new Error('Invalid employee ID format after decoding');
         }
       } catch (err) {
         setError('Invalid login link: Employee ID must be base64 encoded.');
         setLoading(false);
         return;
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
           employee_id: data.employee_id,
           bl_territory: data.bl_territory,
           bl_region: data.bl_region,
           division: data.division
         });

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
   }, [dataParam, login, navigate, loading]);

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
