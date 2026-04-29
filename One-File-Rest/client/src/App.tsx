import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import { ErrorBoundary } from './components/ErrorBoundary';

// Layout
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import AdminSidebar from './components/layout/AdminSidebar';

// Pages
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

import './App.css';

interface LayoutProps {
  children: React.ReactNode;
  isAdmin?: boolean;
}

const ClientLayout: React.FC<LayoutProps> = ({ children }) => (
  <div className="app-layout">
    <Sidebar />
    <div className="main-content">
      <Header />
      <div className="page-content">
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    </div>
  </div>
);

const AdminLayout: React.FC<LayoutProps> = ({ children }) => (
  <div className="app-layout admin">
    <AdminSidebar />
    <div className="main-content">
      <Header isAdmin />
      <div className="page-content">
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: string }> = ({
  children,
  requiredRole,
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !['support', 'case_manager', 'owner'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  const { user, isLoading } = useAuth();
  const { socket } = useSocket();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

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

  const isAdmin = ['support', 'case_manager', 'owner'].includes(user.role);

  return (
    <Router>
      <Routes>
        {/* Client Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <ClientLayout>
                <Dashboard />
              </ClientLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases/:id"
          element={
            <ProtectedRoute>
              <ClientLayout>
                <CaseDetail />
              </ClientLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases/new"
          element={
            <ProtectedRoute>
              <ClientLayout>
                <NewCase />
              </ClientLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <ClientLayout>
                <Messages />
              </ClientLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/policies"
          element={
            <ProtectedRoute>
              <ClientLayout>
                <PolicyAlerts />
              </ClientLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/timeline"
          element={
            <ProtectedRoute>
              <ClientLayout>
                <ViolationTimeline />
              </ClientLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscription"
          element={
            <ProtectedRoute>
              <ClientLayout>
                <Subscription />
              </ClientLayout>
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="staff">
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/clients"
          element={
            <ProtectedRoute requiredRole="staff">
              <AdminLayout>
                <ClientList />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/clients/:id"
          element={
            <ProtectedRoute requiredRole="staff">
              <AdminLayout>
                <ClientProfile />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/cases"
          element={
            <ProtectedRoute requiredRole="staff">
              <AdminLayout>
                <CaseManagement />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/templates"
          element={
            <ProtectedRoute requiredRole="staff">
              <AdminLayout>
                <TemplateBuilder />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/broadcast"
          element={
            <ProtectedRoute requiredRole="staff">
              <AdminLayout>
                <BulkBroadcast />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute requiredRole="staff">
              <AdminLayout>
                <Analytics />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute requiredRole="owner">
              <AdminLayout>
                <StaffManagement />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/policies"
          element={
            <ProtectedRoute requiredRole="staff">
              <AdminLayout>
                <PolicyManagement />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {/* Catch all */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
