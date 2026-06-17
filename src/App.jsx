import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RequestList from './pages/RequestList';
import RequestForm from './pages/RequestForm';
import RequestDetail from './pages/RequestDetail';
import DoctorManagement from './pages/DoctorManagement';
import OfficeActivities from './pages/OfficeActivities';
import MonthlyReport from './pages/MonthlyReport';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Route */}
          <Route path="/" element={<Login />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="requests" element={<RequestList />} />
            {/* Dashboard removed - role-based landing: BM → Monthly Report, Others → Requests */}
            {/* <Route path="dashboard" element={<Navigate to="/requests" replace />} /> */}
            <Route path="requests/new" element={<RequestForm />} />
            <Route path="requests/:id" element={<RequestDetail />} />
            <Route path="doctors" element={<DoctorManagement />} />
            <Route path="office-activities" element={<OfficeActivities />} />
            <Route path="monthly-report" element={<MonthlyReport />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
