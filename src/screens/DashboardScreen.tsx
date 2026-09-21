import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, GraduationCap, FileText, CheckCircle, Bell, ArrowRight, UserCheck, Sparkles, Activity, Key, Shield, Clock, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import { isNoticeRelevantToUser, isUserSubjectSpecialist, type Notice, type Student, type Teacher, type LeaveRequest, type AttendanceRecord, type ZonalKeyRequest, type SchoolClass } from '../data/models';

export default function DashboardScreen() {
  const { user, language } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [leaveReqs, setLeaveReqs] = useState<LeaveRequest[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pendingKeyRequests, setPendingKeyRequests] = useState<ZonalKeyRequest[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);

  const userSchoolCode = user?.role === 'zonal_admin' ? undefined : user?.schoolCensusCode;

  useEffect(() => {
    // Fetch students, teachers, leave requests, classes once
    Promise.all([
      databaseService.getStudents(userSchoolCode),
      databaseService.getTeachers(userSchoolCode),
      databaseService.getLeaveRequests(userSchoolCode),
      databaseService.getClasses(),
    ]).then(([s, tc, l, cls]) => {
      setStudents(s);
      setTeachers(tc);
      setLeaveReqs(l);
      setClasses(cls || []);
    });

    // Real-time attendance subscription
    const unsubAtt = databaseService.subscribeToAttendance((records) => {
      setAttendance(records);
      setLoading(false);
    });

    // Real-time notices subscription
    const unsubNotices = databaseService.subscribeToNotices((data) => {
      setNotices(data);
    });

    // Real-time zonal key requests subscription for zonal admin
    const unsubKeyReqs = databaseService.subscribeToZonalKeyRequests((requests) => {
      setPendingKeyRequests(requests.filter(r => r.status === 'pending'));
    });

    return () => {
      unsubAtt();
      unsubNotices();
      unsubKeyReqs();
    };
  }, [userSchoolCode]);

  const isZonalAdmin = user?.role === 'zonal_admin';
  const isTeacher = user?.role === 'teacher';
  const currentSchoolCode = user?.schoolCensusCode;

  const today = new Date().toISOString().split('T')[0];
  const presentToday = attendance.filter(a =>
    a.date.startsWith(today) && a.status === 'present'
  ).length;

  const displayLeaveReqs = isZonalAdmin
    ? leaveReqs
    : leaveReqs.filter(l => l.schoolCensusCode === currentSchoolCode);

  // Teachers: show only their own pending leave count
  // Principals: show pending requests from staff they need to approve
  // Zonal admins: show all pending requests
  const pendingLeave = isTeacher
    ? displayLeaveReqs.filter(l => l.status === 'pending' && l.teacherId === user?.id).length
    : displayLeaveReqs.filter(l => l.status === 'pending').length;

  const displayStudents = isZonalAdmin
    ? students
    : students.filter(s => s.schoolCensusCode === currentSchoolCode);

  const displayTeachers = isZonalAdmin
    ? teachers
    : teachers.filter(t => t.schoolCensusCode === currentSchoolCode);


  const teacherObj = teachers.find(t =>
    (user?.id && t.id === user.id) ||
    (user?.name && t.name.toLowerCase() === user.name.toLowerCase()) ||
    (user?.username && t.id === user.username)
  );

  const homeroomClassObj = classes.find(c =>
    (user?.id && c.homeroomTeacherId === user.id) ||
    (user?.name && c.homeroomTeacherName?.toLowerCase() === user.name.toLowerCase())
  );

  const studentObj = (user?.studentId || user?.admissionNumber)
    ? students.find(s => s.id === user.studentId || (user.admissionNumber && s.admissionNumber === user.admissionNumber))
    : undefined;

  const rawClass =
    user?.classRoom ||
    (teacherObj?.classRoom && teacherObj.classRoom !== 'Not assigned' ? teacherObj.classRoom : undefined) ||
    homeroomClassObj?.id ||
    studentObj?.classRoom;

  const assignedClassRoom = rawClass && rawClass !== 'Not assigned' ? rawClass : null;

  const relevantNotices = notices
    .filter(n => {
      if (!isNoticeRelevantToUser(n, user ?? null)) return false;

      // Teachers: Recent notices are valid for only 24 hours. After 24 hours, they disappear from recent notices.
      if (isTeacher) {
        const noticeTime = new Date(n.date).getTime();
        if (isNaN(noticeTime)) return false;
        const diffMs = Date.now() - noticeTime;
        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
        // Keep notices posted within the last 24 hours (with 1-hour grace for client clock skew)
        return diffMs >= -3600000 && diffMs <= TWENTY_FOUR_HOURS_MS;
      }

      return true;
    })
    .slice(0, 5);

  function formatNoticeTime(dateStr: string): string {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }

  const isSubjectSpecialist = isUserSubjectSpecialist(user);

  const stats = isSubjectSpecialist
    ? [
        {
          label: 'Specialist Subject',
          value: user?.subject || teacherObj?.subject || 'Multi-Class Specialist',
          icon: BookOpen,
          color: '#8b5cf6',
          bg: 'rgba(139,92,246,0.15)',
        },
        {
          label: 'Teaching Scope',
          value: `${classes.length || 12} Classes`,
          icon: GraduationCap,
          color: '#0284c7',
          bg: 'rgba(2,132,199,0.15)',
        },
        {
          label: t('totalTeachers', language),
          value: displayTeachers.length,
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
      ]
    : [
        {
          label: t('totalStudents', language),
          value: displayStudents.length,
          icon: GraduationCap,
          color: '#0284c7',
          bg: 'rgba(2,132,199,0.15)',
        },
        {
          label: t('totalTeachers', language),
          value: displayTeachers.length,
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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span>{t('welcome', language)}, {user?.name?.split(' ')[0] ?? ''}!</span>
            {assignedClassRoom ? (
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '3px 12px',
                  borderRadius: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(2, 132, 199, 0.12)',
                  color: 'var(--primary)',
                  border: '1px solid rgba(2, 132, 199, 0.28)',
                  letterSpacing: '0.2px',
                }}
              >
                <GraduationCap size={15} />
                {assignedClassRoom.toLowerCase().startsWith('class') ? assignedClassRoom : `Class ${assignedClassRoom}`}
              </span>
            ) : isTeacher ? (
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '3px 12px',
                  borderRadius: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.28)',
                  letterSpacing: '0.2px',
                }}
              >
                <BookOpen size={15} />
                {user?.subject ? `Specialist: ${user.subject}` : 'Subject Specialist'}
              </span>
            ) : null}
          </h1>
          {user?.schoolName && user.role !== 'zonal_admin' && (
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span>🏫 {user.schoolName}</span>
              {user.schoolCensusCode && <span style={{ opacity: 0.8 }}>(Census Code: {user.schoolCensusCode})</span>}
              {assignedClassRoom ? (
                <>
                  <span style={{ opacity: 0.4 }}>•</span>
                  <span>🏛️ {t('assignedClass', language)}: <strong>{assignedClassRoom}</strong></span>
                </>
              ) : isTeacher ? (
                <>
                  <span style={{ opacity: 0.4 }}>•</span>
                  <span>📚 Subject Specialist: <strong>{user?.subject || teacherObj?.subject || 'Multi-class Faculty'}</strong></span>
                </>
              ) : null}
            </div>
          )}
          {!user?.schoolName && assignedClassRoom && (
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🏛️ {t('assignedClass', language)}: <strong>{assignedClassRoom}</strong></span>
            </div>
          )}
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

      {/* Subject Specialist Quick Workspaces */}
      {isSubjectSpecialist && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="var(--primary)" />
              Specialist Quick Workspaces
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Rotational subject faculty portal • Homeroom duties handled by class teachers
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <Link
              to="/timetable"
              className="card"
              style={{
                padding: '16px',
                textDecoration: 'none',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.05) 0%, rgba(2, 132, 199, 0.01) 100%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7' }}>
                  <Clock size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>My Teaching Timetable</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>View rotational class schedule</div>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                View Schedule <ArrowRight size={13} />
              </div>
            </Link>

            <Link
              to="/leave"
              className="card"
              style={{
                padding: '16px',
                textDecoration: 'none',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(245, 158, 11, 0.01) 100%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Leave & Proxy Notes</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Submit leave & lesson plans</div>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                Manage Leave <ArrowRight size={13} />
              </div>
            </Link>

            <Link
              to="/notifications"
              className="card"
              style={{
                padding: '16px',
                textDecoration: 'none',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(139, 92, 246, 0.01) 100%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
                  <Bell size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Staff Bulletins</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>School notices & circulars</div>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                Read Bulletins <ArrowRight size={13} />
              </div>
            </Link>

            <Link
              to="/profile"
              className="card"
              style={{
                padding: '16px',
                textDecoration: 'none',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.01) 100%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                  <Users size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Specialist Profile</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Qualifications & credentials</div>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                My Profile <ArrowRight size={13} />
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Recent notices */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="card-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={16} style={{ verticalAlign: 'middle' }} />
              {t('recentNotices', language)}
              {isTeacher && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  background: 'var(--bg-hover)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                }}>
                  Valid for 24h
                </span>
              )}
            </h2>
            <Link to="/notifications" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
              <span>View All</span>
              <ArrowRight size={14} />
            </Link>
          </div>
          {relevantNotices.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <Bell size={32} style={{ marginBottom: '8px', opacity: 0.3 }} />
              <p>{t('noNotices', language)}</p>
              {isTeacher && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  No notices posted in the last 24 hours. Older announcements can be viewed in{' '}
                  <Link to="/notifications" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                    All Notifications
                  </Link>.
                </p>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {relevantNotices.map(n => {
                const hoursAgo = Math.max(0, Math.floor((Date.now() - new Date(n.date).getTime()) / (1000 * 60 * 60)));
                const hoursLeft = Math.max(1, 24 - hoursAgo);

                return (
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        {formatNoticeTime(n.date)} · {new Date(n.date).toLocaleDateString()}
                      </span>
                      {isTeacher && (
                        <span style={{ color: '#0ea5e9', fontWeight: 600, fontSize: '11px' }}>
                          Expires in ~{hoursLeft}h
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
