import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';

// Layout
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import AdminSidebar from './components/layout/AdminSidebar';

// Client Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CaseDetail from './pages/CaseDetail';
import NewCase from './pages/NewCase';
import Messages from './pages/Messages';
import PolicyAlerts from './pages/PolicyAlerts';
import ViolationTimeline from './pages/ViolationTimeline';
import Subscription from './pages/Subscription';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import ClientList from './pages/admin/ClientList';
import ClientProfile from './pages/admin/ClientProfile';
import CaseManagement from './pages/admin/CaseManagement';
import TemplateBuilder from './pages/admin/TemplateBuilder';
import BulkBroadcast from './pages/admin/BulkBroadcast';
import Analytics from './pages/admin/Analytics';
import StaffManagement from './pages/admin/StaffManagement';
import PolicyManagement from './pages/admin/PolicyManagement';
import AdminSettings from './pages/admin/AdminSettings';
import AITools from './pages/admin/AITools';

import './App.css';

const STAFF_ROLES = ['support', 'case_manager', 'owner', 'admin'];
const ADMIN_ROLES = ['owner', 'admin'];

const ClientLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="app-layout">
    <Sidebar />
    <div className="main-content">
      <Header />
      <div className="page-content">{children}</div>
    </div>
  </div>
);

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a' }}>
    <AdminSidebar />
    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
      {children}
    </div>
  </div>
);

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requiredRole?: 'staff' | 'owner';
}> = ({ children, requiredRole }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  if (requiredRole === 'staff' && !STAFF_ROLES.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  if (requiredRole === 'owner' && !ADMIN_ROLES.includes(user.role)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  const { user, isLoading } = useAuth();
  useSocket();

  if (isLoading) return <div className="loading">Loading...</div>;

  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  const isStaff = STAFF_ROLES.includes(user.role);

  return (
    <Router>
      <Routes>
        {/* ── Client Routes ── */}
        <Route path="/dashboard" element={<ProtectedRoute><ClientLayout><Dashboard /></ClientLayout></ProtectedRoute>} />
        <Route path="/cases/new" element={<ProtectedRoute><ClientLayout><NewCase /></ClientLayout></ProtectedRoute>} />
        <Route path="/cases/:id" element={<ProtectedRoute><ClientLayout><CaseDetail /></ClientLayout></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><ClientLayout><Messages /></ClientLayout></ProtectedRoute>} />
        <Route path="/policies" element={<ProtectedRoute><ClientLayout><PolicyAlerts /></ClientLayout></ProtectedRoute>} />
        <Route path="/timeline" element={<ProtectedRoute><ClientLayout><ViolationTimeline /></ClientLayout></ProtectedRoute>} />
        <Route path="/subscription" element={<ProtectedRoute><ClientLayout><Subscription /></ClientLayout></ProtectedRoute>} />

        {/* ── Admin Routes ── */}
        <Route path="/admin" element={<ProtectedRoute requiredRole="staff"><AdminLayout><AdminDashboard /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/cases" element={<ProtectedRoute requiredRole="staff"><AdminLayout><CaseManagement /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/clients" element={<ProtectedRoute requiredRole="staff"><AdminLayout><ClientList /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/clients/:id" element={<ProtectedRoute requiredRole="staff"><AdminLayout><ClientProfile /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/analytics" element={<ProtectedRoute requiredRole="staff"><AdminLayout><Analytics /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/broadcast" element={<ProtectedRoute requiredRole="staff"><AdminLayout><BulkBroadcast /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/templates" element={<ProtectedRoute requiredRole="staff"><AdminLayout><TemplateBuilder /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/policies" element={<ProtectedRoute requiredRole="staff"><AdminLayout><PolicyManagement /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/ai" element={<ProtectedRoute requiredRole="staff"><AdminLayout><AITools /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute requiredRole="owner"><AdminLayout><AdminSettings /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/staff" element={<ProtectedRoute requiredRole="owner"><AdminLayout><StaffManagement /></AdminLayout></ProtectedRoute>} />

        {/* ── Root redirect ── */}
        <Route path="/" element={<Navigate to={isStaff ? '/admin' : '/dashboard'} replace />} />
        <Route path="*" element={<Navigate to={isStaff ? '/admin' : '/dashboard'} replace />} />
      </Routes>
    </Router>
  );
}
