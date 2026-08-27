import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, FileText, BarChart2,
  Clock, LogOut, Menu, X, Globe, ChevronDown, GraduationCap,
  Sun, Moon, BookOpen, Bell, Sparkles, Activity, Building2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import type { AppLanguage } from '../data/models';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/admin', icon: Building2, key: 'zonalAdmin', label: 'Zonal Admin Panel', zonalAdminOnly: true },
  { to: '/notifications', icon: Bell, key: 'notifications' },
  { to: '/attendance', icon: Calendar, key: 'attendance' },
  { to: '/leave', icon: FileText, key: 'leave' },
  { to: '/performance', icon: BarChart2, key: 'performance' },
  { to: '/correlation-radar', icon: Activity, key: 'correlationRadar' },
  { to: '/reports', icon: BarChart2, key: 'reports' },
  { to: '/timetable', icon: Clock, key: 'timetable' },
  { to: '/substitutes', icon: Sparkles, key: 'proxyEngine' },
  { to: '/edupub', icon: BookOpen, key: 'edupub' },
  { to: '/university-advisor', icon: GraduationCap, key: 'universityAdvisor' },
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
    databaseService.getNotices().then(notices => {
      const relevantCount = notices.filter(
        n => (n.targetRole || 'all') === 'all' ||
             n.targetRole === user?.role ||
             user?.role === 'principal' ||
             user?.role === 'zonal_admin'
      ).length;
      setNotifCount(relevantCount);
    }).catch(err => console.error('Failed to load notice count:', err));
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

  const items = NAV_ITEMS.filter(item => {
    if (user?.role === 'zonal_admin') {
      return item.zonalAdminOnly || item.key === 'notifications' || item.key === 'reports';
    }
    if (item.zonalAdminOnly) return false;
    if (item.principalOnly) return user?.role === 'principal';
    return true;
  });

  const roleLabel =
    user?.role === 'zonal_admin' ? '🏛️ Zonal Admin' :
    user?.role === 'principal' ? '🏫 Principal' : '👩‍🏫 Teacher';

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
            <span>SAMS</span>
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
          <div className="user-info">
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
            <span>{user?.schoolName ? `SAMS | ${user.schoolName}` : t('appName', language)}</span>
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
