import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, GraduationCap, FileText, CheckCircle, Bell, ArrowRight, UserCheck, Sparkles, Activity, Key, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import type { Notice, Student, Teacher, LeaveRequest, AttendanceRecord, ProxyAssignment, ZonalKeyRequest } from '../data/models';

export default function DashboardScreen() {
  const { user, language } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [leaveReqs, setLeaveReqs] = useState<LeaveRequest[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [proxyAssignments, setProxyAssignments] = useState<ProxyAssignment[]>([]);
  const [pendingKeyRequests, setPendingKeyRequests] = useState<ZonalKeyRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch students, teachers, leave requests once
    Promise.all([
      databaseService.getStudents(),
      databaseService.getTeachers(),
      databaseService.getLeaveRequests(),
      databaseService.getProxyAssignments(),
    ]).then(([s, tc, l, p]) => {
      setStudents(s);
      setTeachers(tc);
      setLeaveReqs(l);
      setProxyAssignments(p);
    });

    // Real-time attendance subscription
    const unsubAtt = databaseService.subscribeToAttendance((records) => {
      setAttendance(records);
      setLoading(false);
    });

    // Real-time notices subscription
    const unsubNotices = databaseService.subscribeToNotices((data) => {
      setNotices(data.slice(0, 5));
    });

    // Real-time proxy subscription
    const unsubProxy = databaseService.subscribeToProxyAssignments((data) => {
      setProxyAssignments(data);
    });

    // Real-time zonal key requests subscription for zonal admin
    const unsubKeyReqs = databaseService.subscribeToZonalKeyRequests((requests) => {
      setPendingKeyRequests(requests.filter(r => r.status === 'pending'));
    });

    return () => {
      unsubAtt();
      unsubNotices();
      unsubProxy();
      unsubKeyReqs();
    };
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const presentToday = attendance.filter(a =>
    a.date.startsWith(today) && a.status === 'present'
  ).length;
  const pendingLeave = leaveReqs.filter(l => l.status === 'pending').length;

  const stats = [
    {
      label: t('totalStudents', language),
      value: students.length,
      icon: GraduationCap,
      color: '#0284c7',
      bg: 'rgba(2,132,199,0.15)',
    },
    {
      label: t('totalTeachers', language),
      value: teachers.length,
      icon: Users,
      color: '#0d9488',
      bg: 'rgba(13,148,136,0.15)',
    },
    {
      label: t('pendingLeave', language),
      value: pendingLeave,
      icon: FileText,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.15)',
    },
    {
      label: t('presentToday', language),
      value: presentToday,
      icon: CheckCircle,
      color: '#10b981',
      bg: 'rgba(16,185,129,0.15)',
    },
  ];

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  const myDutiesToday = proxyAssignments.filter(
    p => p.date === today && (p.substituteTeacherId === user?.id || p.substituteTeacherName === user?.name)
  );

  const totalProxiesToday = proxyAssignments.filter(p => p.date === today).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('welcome', language)}, {user?.name?.split(' ')[0] ?? ''}! </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
            <p className="page-subtitle" style={{ margin: 0 }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#10b981', borderRadius: '20px', fontSize: '11px',
              fontWeight: 700, padding: '2px 10px', letterSpacing: '0.3px',
            }}>
              <span style={{
                display: 'inline-block', width: 7, height: 7,
                borderRadius: '50%', background: '#10b981',
                animation: 'pulse-live 1.8s ease-in-out infinite',
              }} />
              LIVE
            </span>
          </div>
        </div>
      </div>

      {/* Zonal Admin Pending Key Requests Alert Banner */}
      {user?.role === 'zonal_admin' && pendingKeyRequests.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.18) 0%, rgba(76, 29, 149, 0.25) 100%)',
          border: '2px solid #7c3aed',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 4px 20px rgba(124, 58, 237, 0.15)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#a78bfa', fontSize: '15px' }}>
              <Key size={18} color="#c084fc" />
              🔔 {pendingKeyRequests.length} Pending Principal Zonal Key {pendingKeyRequests.length === 1 ? 'Request' : 'Requests'} Waiting for Approval!
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {pendingKeyRequests.map(r => `${r.principalName} (${r.schoolName})`).join(' • ')}
            </div>
          </div>
          <Link
            to="/admin"
            className="btn btn-primary btn-sm"
            style={{
              background: '#7c3aed',
              borderColor: '#7c3aed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Shield size={14} />
            Open Zonal Admin Panel
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg }}>
              <s.icon size={22} color={s.color} />
            </div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Recent notices */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="card-title">
              <Bell size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              {t('recentNotices', language)}
            </h2>
            <Link to="/notifications" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
              <span>View All</span>
              <ArrowRight size={14} />
            </Link>
          </div>
          {notices.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <Bell size={32} style={{ marginBottom: '8px', opacity: 0.3 }} />
              <p>{t('noNotices', language)}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {notices.map(n => (
                <div key={n.id} style={{
                  padding: '14px',
                  background: 'var(--bg-hover)',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: '3px solid var(--primary)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{n.title}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.body}</div>
                    </div>
                    <span className="badge badge-primary" style={{ flexShrink: 0 }}>{n.category}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    {new Date(n.date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
