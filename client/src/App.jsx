import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CreateExam from './pages/CreateExam.jsx';
import AdminMonitor from './pages/AdminMonitor.jsx';
import ExamRoom from './pages/ExamRoom.jsx';
import MobileCam from './pages/MobileCam.jsx';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exams/create"
            element={
              <ProtectedRoute requiredRole="admin">
                <CreateExam />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exams/edit/:id"
            element={
              <ProtectedRoute requiredRole="admin">
                <CreateExam />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exams/:id/monitor"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminMonitor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exam/:id"
            element={
              <ProtectedRoute>
                <ExamRoom />
              </ProtectedRoute>
            }
          />
          <Route path="/mobile-cam/:sessionId" element={<MobileCam />} />

          {/* Catch-all → login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
