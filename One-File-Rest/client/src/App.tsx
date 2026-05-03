import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import { useNativeBridge } from './hooks/useNativeBridge';
import { isNative, SharedIntent, attachAppUrlOpen, closeInAppBrowser, biometricUnlock, prefGet, prefSet } from './lib/native';
import StaffOnly from './pages/StaffOnly';
import SharedFileSheet from './components/admin/SharedFileSheet';

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
  const [sharedIntent, setSharedIntent] = React.useState<SharedIntent | null>(null);
  useNativeBridge({ isStaff, onSharedItem: setSharedIntent });

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
      <SharedFileSheet intent={sharedIntent} onClose={() => setSharedIntent(null)} />
    </AnimatePresence>
  );
};

// Mounted at the app root, BEFORE the auth check, so the OAuth callback
// (returned via the club.elitetok.admin:// custom scheme) is never lost
// during the unauthenticated→authenticated transition. Notification taps
// that arrive while the app was killed are also caught via getLaunchUrl
// inside attachAppUrlOpen.
function useAppLevelDeepLinks(refetchAuth: () => void) {
  React.useEffect(() => {
    if (!isNative()) return;
    let cleanup: (() => void) | null = null;
    (async () => {
      cleanup = await attachAppUrlOpen((raw) => {
        // OAuth callback returns to club.elitetok.admin://auth/complete?next=...
        if (/^club\.elitetok\.admin:\/\/auth\//.test(raw)) {
          closeInAppBrowser();
          refetchAuth();
          // Pull `next` out and route the WebView there once we're authed.
          try {
            const u = new URL(raw);
            const next = u.searchParams.get('next') || '/admin';
            // Soft navigate after auth re-fetches succeed.
            setTimeout(() => { window.location.replace(next); }, 200);
          } catch {
            window.location.replace('/admin');
          }
          return;
        }
        // Other deep links (notification taps, etc.) are routed by
        // useNativeBridge once it mounts. Buffer through window for it
        // to pick up if it hasn't mounted yet.
        (window as any).__pendingDeepLink = raw;
      });
    })();
    return () => { cleanup?.(); };
  }, [refetchAuth]);
}

// Blocks rendering of the admin tree until biometric verification succeeds.
// While locked, only a neutral lock screen is mounted — no fetches, no
// case data, no notifications UI.
function BiometricGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = React.useState(false);
  const [denied, setDenied] = React.useState(false);
  const TTL_MS = 30 * 60 * 1000;
  const KEY = 'biometric:lastUnlock';

  const tryUnlock = React.useCallback(async () => {
    setDenied(false);
    const last = await prefGet(KEY);
    const ts = last ? parseInt(last, 10) : 0;
    if (ts && Date.now() - ts < TTL_MS) { setUnlocked(true); return; }
    const ok = await biometricUnlock('Unlock Elite Tok Admin');
    if (ok) { await prefSet(KEY, String(Date.now())); setUnlocked(true); }
    else setDenied(true);
  }, []);

  React.useEffect(() => { tryUnlock(); }, [tryUnlock]);

  if (unlocked) return <>{children}</>;
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--bg-primary)', padding: 24 }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Locked</div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 320 }}>
        {denied ? 'Authentication failed. Tap to try again.' : 'Confirm your identity to continue.'}
      </div>
      <button onClick={tryUnlock} style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600 }}>
        Unlock
      </button>
    </div>
  );
}

export default function App() {
  const { user, isLoading, refetch } = useAuth();
  useSocket();
  useAppLevelDeepLinks(refetch || (() => {}));

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

  // Inside the native APK we only ship the admin portal — block clients with
  // a friendly "use the website" screen instead of dropping them into a UI
  // that has no client routes.
  if (isNative() && !isStaff) {
    return <ToastProvider><StaffOnly /></ToastProvider>;
  }

  // BLOCKING biometric gate — must complete BEFORE the admin tree mounts so
  // no protected case data can flash on screen. 30-min Preferences TTL keeps
  // it from prompting on every focus.
  if (isNative() && isStaff) {
    return (
      <ToastProvider>
        <BiometricGate>
          <Router>
            <AnimatedRoutes isStaff={isStaff} />
          </Router>
        </BiometricGate>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <Router>
        <AnimatedRoutes isStaff={isStaff} />
      </Router>
    </ToastProvider>
  );
}
