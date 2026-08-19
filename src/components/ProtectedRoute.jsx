import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, permission }) => {
  const { isAuthenticated, hasPermission } = useAuth();

  if (!isAuthenticated || (permission && !hasPermission(permission))) {
    return <Navigate to="/requests" replace />;
  }

  return children;
};

export default ProtectedRoute;
