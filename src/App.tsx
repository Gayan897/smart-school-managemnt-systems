import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppShell } from './components/AppShell';
import { TeacherSubjectSetupModal } from './components/TeacherSubjectSetupModal';
import { isUserSubjectSpecialist } from './data/models';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import DashboardScreen from './screens/DashboardScreen';
import NotificationScreen from './screens/NotificationScreen';
import AttendanceScreen from './screens/AttendanceScreen';
import LeaveScreen from './screens/LeaveScreen';
import PerformanceScreen from './screens/PerformanceScreen';
import ReportsScreen from './screens/ReportsScreen';
import TimetableScreen from './screens/TimetableScreen';
import ClassManagementScreen from './screens/ClassManagementScreen';
import EduPubScreen from './screens/EduPubScreen';
import UniversityAdvisorScreen from './screens/UniversityAdvisorScreen';
import ZonalAdminScreen from './screens/ZonalAdminScreen';
import AdminLoginScreen from './screens/AdminLoginScreen';
import ProfileScreen from './screens/ProfileScreen';
import './index.css';


function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg-dark)'
    }}>
      <span className="spinner spinner-lg" />
    </div>
  );
}

function SignupRoute() {
  const { user } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const isInvite = searchParams.get('invite') === 'true' || (searchParams.has('censusCode') && searchParams.has('key'));

  if (user && !isInvite) {
    return <Navigate to={user.role === 'zonal_admin' ? '/admin' : '/dashboard'} replace />;
  }

  return <SignupScreen />;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  // Show subject setup modal only once for teachers who haven't filled or been shown subjects yet
  const hasSeenSubjectPrompt =
    Boolean(user?.subjectSetupComplete) ||
    (user?.id ? localStorage.getItem(`sams_subject_seen_${user.id}`) === 'true' : false) ||
    Boolean(user?.subject && user.subject !== 'Not assigned');

  const needsSubjectSetup =
    user?.role === 'teacher' &&
    !hasSeenSubjectPrompt;

  const isSubjectSpecialist = isUserSubjectSpecialist(user);

  return (
    <>
      {needsSubjectSetup && <TeacherSubjectSetupModal />}
      <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={user ? <Navigate to={user.role === 'zonal_admin' ? '/admin' : '/dashboard'} replace /> : <LoginScreen />}
      />
      <Route
        path="/signup"
        element={<SignupRoute />}
      />

      {/* Protected routes inside shell */}
      {user ? (
        <Route element={<AppShell><Navigate to={user.role === 'zonal_admin' ? '/admin' : '/dashboard'} replace /></AppShell>}>
          {/* These are rendered as children of AppShell via Outlet */}
        </Route>
      ) : null}

      <Route
        path="/admin"
        element={
          !user || user.role !== 'zonal_admin' ? (
            <AdminLoginScreen />
          ) : (
            <AppShell><ZonalAdminScreen /></AppShell>
          )
        }
      />
      <Route
        path="/zonal-admin"
        element={<Navigate to="/admin" replace />}
      />
      <Route
        path="/dashboard"
        element={
          !user ? <Navigate to="/login" replace /> :
          <AppShell><DashboardScreen /></AppShell>
        }
      />
      <Route
        path="/notifications"
        element={
          !user ? <Navigate to="/login" replace /> :
          <AppShell><NotificationScreen /></AppShell>
        }
      />
      <Route
        path="/attendance"
        element={
          !user ? <Navigate to="/login" replace /> :
          isSubjectSpecialist ? <Navigate to="/dashboard" replace /> :
          <AppShell><AttendanceScreen /></AppShell>
        }
      />
      <Route
        path="/leave"
        element={
          !user ? <Navigate to="/login" replace /> :
          <AppShell><LeaveScreen /></AppShell>
        }
      />
      <Route
        path="/performance"
        element={
          !user ? <Navigate to="/login" replace /> :
          isSubjectSpecialist ? <Navigate to="/dashboard" replace /> :
          <AppShell><PerformanceScreen /></AppShell>
        }
      />
      <Route
        path="/reports"
        element={
          !user ? <Navigate to="/login" replace /> :
          isSubjectSpecialist ? <Navigate to="/dashboard" replace /> :
          <AppShell><ReportsScreen /></AppShell>
        }
      />
      <Route
        path="/timetable"
        element={
          !user ? <Navigate to="/login" replace /> :
          <AppShell><TimetableScreen /></AppShell>
        }
      />
      <Route
        path="/substitutes"
        element={
          !user ? <Navigate to="/login" replace /> :
          <Navigate to="/dashboard" replace />
        }
      />
      <Route
        path="/edupub"
        element={
          !user ? <Navigate to="/login" replace /> :
          isSubjectSpecialist ? <Navigate to="/dashboard" replace /> :
          <AppShell><EduPubScreen /></AppShell>
        }
      />
      <Route
        path="/class-management"
        element={
          !user ? <Navigate to="/login" replace /> :
          user.role !== 'principal' ? <Navigate to="/dashboard" replace /> :
          <AppShell><ClassManagementScreen /></AppShell>
        }
      />
      <Route
        path="/university-advisor"
        element={
          !user ? <Navigate to="/login" replace /> :
          user.role === 'teacher' ? <Navigate to="/dashboard" replace /> :
          <AppShell><UniversityAdvisorScreen /></AppShell>
        }
      />
      <Route
        path="/profile"
        element={
          !user ? <Navigate to="/login" replace /> :
          <AppShell><ProfileScreen /></AppShell>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
