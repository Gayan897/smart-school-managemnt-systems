import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, FileText, BarChart2,
  Clock, LogOut, Menu, X, Globe, ChevronDown, GraduationCap,
  Sun, Moon, BookOpen, Bell, Sparkles, Activity, Building2, User as UserIcon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import { isNoticeRelevantToUser, isUserSubjectSpecialist, deduplicateNotices, type AppLanguage } from '../data/models';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/profile', icon: UserIcon, key: 'profile' },
  { to: '/admin', icon: Building2, key: 'zonalAdmin', label: 'Zonal Admin Panel', zonalAdminOnly: true },
  { to: '/notifications', icon: Bell, key: 'notifications' },
  { to: '/attendance', icon: Calendar, key: 'attendance' },
  { to: '/leave', icon: FileText, key: 'leave' },
  { to: '/performance', icon: BarChart2, key: 'performance' },
  { to: '/reports', icon: BarChart2, key: 'reports' },
  { to: '/timetable', icon: Clock, key: 'timetable' },
  { to: '/edupub', icon: BookOpen, key: 'edupub' },
  { to: '/university-advisor', icon: GraduationCap, key: 'universityAdvisor', hideForTeacher: true },
  { to: '/class-management', icon: Users, key: 'classManagement', principalOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, language, logout, setLanguage } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [notifCount, setNotifCount] = useState<number>(0);

  useEffect(() => {
    const unsub = databaseService.subscribeToNotices(
      (notices) => {
        const unique = deduplicateNotices(notices);
        const relevantCount = unique.filter(n => isNoticeRelevantToUser(n, user ?? null)).length;
        setNotifCount(relevantCount);
      },
      (err) => console.error('Failed to subscribe to notice count:', err)
    );

    return () => unsub();
  }, [user]);

  const langs: { value: AppLanguage; label: string }[] = [
    { value: 'english', label: 'English' },
    { value: 'sinhala', label: 'සිංහල' },
    { value: 'tamil', label: 'தமிழ்' },
  ];

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const isSubjectSpecialist = isUserSubjectSpecialist(user);

  const items = NAV_ITEMS.filter(item => {
    if (user?.role === 'zonal_admin') {
      return item.zonalAdminOnly || item.key === 'notifications' || item.key === 'reports' || item.key === 'leave';
    }
    if (item.zonalAdminOnly) return false;
    if (item.principalOnly) return user?.role === 'principal';
    if (item.hideForTeacher && user?.role === 'teacher') return false;
    // Subject Specialist: Exclude attendance, performance, reports, and edupub
    if (isSubjectSpecialist && (item.key === 'attendance' || item.key === 'performance' || item.key === 'reports' || item.key === 'edupub')) {
      return false;
    }
    return true;
  });

  const roleLabel =
    user?.role === 'zonal_admin' ? '🏛️ Zonal Admin' :
    user?.role === 'principal' ? '🏫 Principal' :
    isSubjectSpecialist ? '📚 Subject Specialist' : '👩‍🏫 Class Teacher';

  return (
    <div className="shell">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <GraduationCap size={22} />
            <span>EduNexus</span>
          </div>
          <button
            className="btn btn-ghost btn-icon sidebar-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {items.map(({ to, icon: Icon, key, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={18} />
              <span>{label || t(key, language)}</span>
              {key === 'notifications' && notifCount > 0 && (
                <span
                  style={{
                    marginLeft: 'auto',
                    background: '#e11d48',
                    color: '#fff',
                    borderRadius: '12px',
                    padding: '2px 7px',
                    fontSize: '11px',
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {notifCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div
            className="user-info"
            onClick={() => { navigate('/profile'); setSidebarOpen(false); }}
            style={{ cursor: 'pointer', borderRadius: '8px', padding: '6px', transition: 'background 0.2s' }}
            title="Click to view & edit profile"
          >
            <div className="user-avatar">{user?.name?.[0]?.toUpperCase() ?? 'U'}</div>
            <div className="user-details">
              <div className="user-name">{user?.name}</div>
              <div className="user-role" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary-color)' }}>
                {roleLabel}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="main-area">
        {/* Header */}
        <header className="top-header">
          <button
            className="btn btn-ghost btn-icon menu-btn"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          <div className="header-title">
            <GraduationCap size={18} />
            <span>{user?.schoolName ? `EduNexus | ${user.schoolName}` : t('appName', language)}</span>
          </div>

          <div className="header-actions">
            {/* Header Notification Bell Icon with arrived count badge */}
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => navigate('/notifications')}
              title={t('notifications', language)}
              style={{ position: 'relative', borderRadius: '50%' }}
            >
              <Bell size={18} />
              {notifCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: '#e11d48',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    borderRadius: '50%',
                    minWidth: '16px',
                    height: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 2px',
                    border: '2px solid var(--bg-card)',
                  }}
                >
                  {notifCount}
                </span>
              )}
            </button>

            {/* Theme switcher */}
            <button
              className="btn btn-ghost btn-icon"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              style={{ borderRadius: '50%' }}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            {/* Language switcher */}
            <div className="lang-switcher">
              <button
                className="btn btn-ghost btn-sm lang-btn"
                onClick={() => setLangOpen(o => !o)}
              >
                <Globe size={15} />
                <span>{langs.find(l => l.value === language)?.label}</span>
                <ChevronDown size={13} />
              </button>
              {langOpen && (
                <div className="lang-dropdown">
                  {langs.map(l => (
                    <button
                      key={l.value}
                      className={`lang-option ${language === l.value ? 'lang-active' : ''}`}
                      onClick={() => { setLanguage(l.value); setLangOpen(false); }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              <LogOut size={15} />
              <span className="hide-sm">{t('logout', language)}</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  );
}
