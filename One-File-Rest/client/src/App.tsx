import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';

// Layout
import AdminSidebar from './components/layout/AdminSidebar';
import { CustomerNav, BottomNav, ToastProvider, PageTransition, LoadingSpinner } from './components/customer';

// Client Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cases from './pages/Cases';
import CaseDetail from './pages/CaseDetail';
import NewCase from './pages/NewCase';
import Messages from './pages/Messages';
import PolicyAlerts from './pages/PolicyAlerts';
import ViolationTimeline from './pages/ViolationTimeline';
import Subscription from './pages/Subscription';
import KnowledgeBase from './pages/KnowledgeBase';
import KbArticle from './pages/KbArticle';
import Specialists from './pages/Specialists';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import KnowledgeBaseAdmin from './pages/admin/KnowledgeBaseAdmin';
import ClientList from './pages/admin/ClientList';
import ClientProfile from './pages/admin/ClientProfile';
import CaseWorkspace from './pages/admin/CaseWorkspace';
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
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
    <CustomerNav />
    <main style={{ flex: 1, paddingBottom: 0 }}>{children}</main>
    <BottomNav />
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

  if (isLoading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}><LoadingSpinner /></div>;
  if (!user) return <Navigate to="/login" replace />;

  if (requiredRole === 'staff' && !STAFF_ROLES.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  if (requiredRole === 'owner' && !ADMIN_ROLES.includes(user.role)) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

const AnimatedRoutes: React.FC<{ isStaff: boolean }> = ({ isStaff }) => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const wrap = (el: React.ReactNode) => isAdminRoute ? el : <PageTransition>{el}</PageTransition>;

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* ── Client Routes ── */}
        <Route path="/dashboard"   element={<ProtectedRoute><ClientLayout>{wrap(<Dashboard />)}</ClientLayout></ProtectedRoute>} />
        <Route path="/cases"       element={<ProtectedRoute><ClientLayout>{wrap(<Cases />)}</ClientLayout></ProtectedRoute>} />
        <Route path="/cases/new"   element={<ProtectedRoute><ClientLayout>{wrap(<NewCase />)}</ClientLayout></ProtectedRoute>} />
        <Route path="/cases/:id"   element={<ProtectedRoute><ClientLayout>{wrap(<CaseDetail />)}</ClientLayout></ProtectedRoute>} />
        <Route path="/messages"    element={<ProtectedRoute><ClientLayout>{wrap(<Messages />)}</ClientLayout></ProtectedRoute>} />
        <Route path="/policies"    element={<ProtectedRoute><ClientLayout>{wrap(<PolicyAlerts />)}</ClientLayout></ProtectedRoute>} />
        <Route path="/timeline"    element={<ProtectedRoute><ClientLayout>{wrap(<ViolationTimeline />)}</ClientLayout></ProtectedRoute>} />
        <Route path="/subscription" element={<ProtectedRoute><ClientLayout>{wrap(<Subscription />)}</ClientLayout></ProtectedRoute>} />
        <Route path="/kb"           element={<ProtectedRoute><ClientLayout>{wrap(<KnowledgeBase />)}</ClientLayout></ProtectedRoute>} />
        <Route path="/kb/:slug"     element={<ProtectedRoute><ClientLayout>{wrap(<KbArticle />)}</ClientLayout></ProtectedRoute>} />
        <Route path="/specialists"  element={<ProtectedRoute><ClientLayout>{wrap(<Specialists />)}</ClientLayout></ProtectedRoute>} />

        {/* ── Admin Routes ── */}
        <Route path="/admin"             element={<ProtectedRoute requiredRole="staff"><AdminLayout><AdminDashboard /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/cases"       element={<ProtectedRoute requiredRole="staff"><AdminLayout><CaseWorkspace /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/cases/:id"   element={<ProtectedRoute requiredRole="staff"><AdminLayout><CaseWorkspace /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/clients"     element={<ProtectedRoute requiredRole="staff"><AdminLayout><ClientList /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/clients/:id" element={<ProtectedRoute requiredRole="staff"><AdminLayout><ClientProfile /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/analytics"   element={<ProtectedRoute requiredRole="staff"><AdminLayout><Analytics /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/broadcast"   element={<ProtectedRoute requiredRole="staff"><AdminLayout><BulkBroadcast /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/templates"   element={<ProtectedRoute requiredRole="staff"><AdminLayout><TemplateBuilder /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/policies"    element={<ProtectedRoute requiredRole="staff"><AdminLayout><PolicyManagement /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/ai"          element={<ProtectedRoute requiredRole="staff"><AdminLayout><AITools /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/kb"          element={<ProtectedRoute requiredRole="staff"><AdminLayout><KnowledgeBaseAdmin /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/settings"    element={<ProtectedRoute requiredRole="owner"><AdminLayout><AdminSettings /></AdminLayout></ProtectedRoute>} />
        <Route path="/admin/staff"       element={<ProtectedRoute requiredRole="owner"><AdminLayout><StaffManagement /></AdminLayout></ProtectedRoute>} />

        {/* ── Root redirect ── */}
        <Route path="/" element={<Navigate to={isStaff ? '/admin' : '/dashboard'} replace />} />
        <Route path="*" element={<Navigate to={isStaff ? '/admin' : '/dashboard'} replace />} />
      </Routes>
    </AnimatePresence>
  );
};

export default function App() {
  const { user, isLoading } = useAuth();
  useSocket();

  if (isLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <LoadingSpinner label="Loading..." />
    </div>
  );

  if (!user) {
    return (
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    );
  }

  const isStaff = STAFF_ROLES.includes(user.role);

  return (
    <ToastProvider>
      <Router>
        <AnimatedRoutes isStaff={isStaff} />
      </Router>
    </ToastProvider>
  );
}
