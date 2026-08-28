import { useEffect, useState, useMemo } from 'react';
import {
  X, User, Phone, GraduationCap, Calendar, CheckCircle2,
  AlertTriangle, Clock, Award, Bell, TrendingUp, BookOpen, ShieldCheck,
  Activity, Sparkles, Send
} from 'lucide-react';
import { databaseService } from '../data/database';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { computeStudentCorrelationProfile, generatePredictiveParentAlert } from '../data/correlationEngine';
import type { Student, AttendanceRecord, TermMark, SchoolClass, ParentNotification, TimetableSlot } from '../data/models';

interface StudentProfileModalProps {
  studentId: string;
  onClose: () => void;
}

export default function StudentProfileModal({ studentId, onClose }: StudentProfileModalProps) {
  const { language } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'marks' | 'notifications'>('overview');

  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [marks, setMarks] = useState<TermMark[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [classObj, setClassObj] = useState<SchoolClass | null>(null);
  const [parentNotifications, setParentNotifications] = useState<ParentNotification[]>([]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    Promise.all([
      databaseService.getStudentCompleteProfile(studentId),
      databaseService.getTimetable(),
    ])
      .then(([data, tt]) => {
        if (!isMounted) return;
        setStudent(data.student);
        setAttendance(data.attendance);
        setMarks(data.marks);
        setClassObj(data.classObj);
        setParentNotifications(data.parentNotifications);
        setTimetable(tt);
      })
      .catch((err) => {
        console.error('Failed to load student complete profile:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [studentId]);

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: '600px', textAlign: 'center', padding: '50px 20px' }} onClick={e => e.stopPropagation()}>
          <span className="spinner spinner-lg" />
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Loading student profile...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="modal-title">Student Not Found</h3>
            <button className="modal-close" onClick={onClose}><X size={18} /></button>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Could not find a student with ID: <code>{studentId}</code>.
          </p>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  // Attendance metrics
  const totalAtt = attendance.length;
  const presentCount = attendance.filter(a => a.status === 'present').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;
  const excusedCount = attendance.filter(a => a.status === 'excused').length;
  const effectivePresent = presentCount + lateCount;
  const attendanceRate = totalAtt > 0 ? Math.round((effectivePresent / totalAtt) * 100) : 100;

  // Risk Level
  const isHighRisk = attendanceRate < 75;
  const isModerateRisk = attendanceRate >= 75 && attendanceRate < 85;

  // Marks metrics
  const terms = [1, 2, 3];
  const avgMarks = marks.length > 0
    ? Math.round(marks.reduce((acc, m) => acc + (m.marks / (m.maxMarks || 100)) * 100, 0) / marks.length)
    : 0;

  const highestMarkObj = marks.length > 0
    ? marks.reduce((prev, curr) => (curr.marks > prev.marks ? curr : prev), marks[0])
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{
          maxWidth: '850px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 'var(--radius-lg)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header Hero Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 50%, #4f46e5 100%)',
          padding: '24px 28px',
          color: '#ffffff',
          position: 'relative',
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 800,
              color: '#ffffff',
              boxShadow: '0 8px 16px rgba(0,0,0,0.25)',
              border: '3px solid rgba(255,255,255,0.3)',
            }}>
              {student.name.charAt(0).toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <span style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  padding: '3px 10px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  fontFamily: 'monospace',
                }}>
                  {student.id}
                </span>
                <span style={{
                  background: isHighRisk ? '#ef4444' : isModerateRisk ? '#f59e0b' : '#10b981',
                  padding: '3px 10px',
                  borderRadius: '16px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}>
                  {isHighRisk ? '🚨 High Absenteeism Risk' : isModerateRisk ? '⚠️ Moderate Risk' : '✓ Good Standing'}
                </span>
              </div>

              <h2 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: 700, color: '#ffffff' }}>
                {student.name}
              </h2>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GraduationCap size={15} /> Class {student.classRoom} ({classObj?.stream === 'al' ? 'A/L Stream' : 'O/L Stream'})
                </span>
                {student.parentContact && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={14} /> Parent: {student.parentContact}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-card)',
          padding: '0 20px',
          overflowX: 'auto',
        }}>
          {[
            { id: 'overview' as const, label: 'Overview', icon: User },
            { id: 'attendance' as const, label: `Attendance (${attendanceRate}%)`, icon: Calendar },
            { id: 'marks' as const, label: `Academic Marks (${avgMarks}%)`, icon: Award },
            { id: 'notifications' as const, label: `Parent Alerts (${parentNotifications.length})`, icon: Bell },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 18px',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, background: 'var(--bg-page)' }}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Metric Cards Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <div className="card" style={{ margin: 0, padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: attendanceRate >= 75 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: attendanceRate >= 75 ? 'var(--success)' : 'var(--danger)',
                  }}>
                    <Calendar size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: attendanceRate >= 75 ? 'var(--success)' : 'var(--danger)' }}>
                      {attendanceRate}%
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Attendance Rate</div>
                  </div>
                </div>

                <div className="card" style={{ margin: 0, padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'rgba(2,132,199,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)',
                  }}>
                    <Award size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }}>
                      {avgMarks > 0 ? `${avgMarks}%` : 'N/A'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Academic Average</div>
                  </div>
                </div>

                <div className="card" style={{ margin: 0, padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'rgba(245,158,11,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f59e0b',
                  }}>
                    <Bell size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#f59e0b' }}>
                      {parentNotifications.length}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Parent Alerts Sent</div>
                  </div>
                </div>
              </div>

              {/* Identity & Classroom Breakdown */}
              <div className="card" style={{ margin: 0 }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} style={{ color: 'var(--primary)' }} /> Student Information & Credentials
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Unique Student ID</span>
                    <p style={{ margin: '4px 0 0 0', fontWeight: 700, fontFamily: 'monospace', fontSize: '14px', color: 'var(--primary)' }}>{student.id}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Full Name</span>
                    <p style={{ margin: '4px 0 0 0', fontWeight: 600 }}>{student.name}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Assigned Homeroom</span>
                    <p style={{ margin: '4px 0 0 0', fontWeight: 600 }}>Grade {student.grade || student.classRoom} · Section {student.classRoom}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Parent / Emergency Phone</span>
                    <p style={{ margin: '4px 0 0 0', fontWeight: 600, color: 'var(--text-primary)' }}>{student.parentContact || 'Not registered'}</p>
                  </div>
                </div>
              </div>

              {/* Quick Summary Highlights */}
              <div className="card" style={{ margin: 0 }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Profile Summary</h4>
                <p style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>
                  <strong>{student.name}</strong> is currently enrolled in <strong>Class {student.classRoom}</strong>.
                  {totalAtt > 0 ? (
                    <>
                      {' '}Overall attendance is recorded at <strong>{attendanceRate}%</strong> across {totalAtt} recorded school days ({presentCount} present, {absentCount} absent, {lateCount} late, {excusedCount} excused).
                      {isHighRisk && ' 🚨 Attention is required due to high absenteeism.'}
                    </>
                  ) : (
                    ' No attendance records have been registered yet.'
                  )}
                  {highestMarkObj && (
                    <> Highest academic performance is in <strong>{highestMarkObj.subject}</strong> ({highestMarkObj.marks}/{highestMarkObj.maxMarks || 100}).</>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Breakdown Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ padding: '14px', background: 'rgba(16,185,129,0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.25)', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--success)' }}>{presentCount}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Present</div>
                </div>
                <div style={{ padding: '14px', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.25)', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--danger)' }}>{absentCount}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Absent</div>
                </div>
                <div style={{ padding: '14px', background: 'rgba(245,158,11,0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.25)', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--warning)' }}>{lateCount}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Late</div>
                </div>
                <div style={{ padding: '14px', background: 'rgba(6,182,212,0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(6,182,212,0.25)', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--info)' }}>{excusedCount}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Excused</div>
                </div>
              </div>

              {/* Attendance Log Table */}
              <div className="card" style={{ margin: 0 }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>Recorded Daily Attendance</h4>
                {attendance.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No attendance records recorded yet.</p>
                ) : (
                  <div className="table-wrapper" style={{ border: 'none', maxHeight: '320px', overflowY: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Indicator</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.map((rec, i) => {
                          const statusColor = rec.status === 'present'
                            ? 'var(--success)'
                            : rec.status === 'absent'
                              ? 'var(--danger)'
                              : rec.status === 'late'
                                ? 'var(--warning)'
                                : 'var(--info)';
                          return (
                            <tr key={rec.id || i}>
                              <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{rec.date}</td>
                              <td>
                                <span className={`badge ${
                                  rec.status === 'present'
                                    ? 'badge-success'
                                    : rec.status === 'absent'
                                      ? 'badge-danger'
                                      : rec.status === 'late'
                                        ? 'badge-warning'
                                        : 'badge-info'
                                }`} style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 700 }}>
                                  {rec.status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ACADEMIC MARKS */}
          {activeTab === 'marks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{ margin: 0 }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>Term Assessment Results</h4>
                {marks.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No term marks recorded for this student yet.</p>
                ) : (
                  <div className="table-wrapper" style={{ border: 'none' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th style={{ textAlign: 'center' }}>Term</th>
                          <th style={{ textAlign: 'center' }}>Score</th>
                          <th style={{ textAlign: 'center' }}>Percentage</th>
                          <th style={{ textAlign: 'center' }}>Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marks.map((m, i) => {
                          const pct = Math.round((m.marks / (m.maxMarks || 100)) * 100);
                          const gradeLetter = pct >= 75 ? 'A' : pct >= 65 ? 'B' : pct >= 50 ? 'C' : pct >= 35 ? 'S' : 'F';
                          const gradeBadge = pct >= 75 ? 'badge-success' : pct >= 65 ? 'badge-primary' : pct >= 50 ? 'badge-warning' : 'badge-danger';
                          return (
                            <tr key={i}>
                              <td style={{ fontWeight: 600 }}>{m.subject}</td>
                              <td style={{ textAlign: 'center' }}>Term {m.term}</td>
                              <td style={{ textAlign: 'center', fontWeight: 700 }}>{m.marks} / {m.maxMarks || 100}</td>
                              <td style={{ textAlign: 'center' }}>{pct}%</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`badge ${gradeBadge}`} style={{ minWidth: '28px', justifyContent: 'center', fontWeight: 800 }}>
                                  {gradeLetter}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}



          {/* TAB 4: PARENT NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="card" style={{ margin: 0 }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={18} style={{ color: 'var(--primary)' }} /> Parent Attendance Notification Stream
                </h4>
                {parentNotifications.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No parent notifications dispatched yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {parentNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        style={{
                          padding: '14px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>{notif.title}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{notif.date}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {notif.message}
                        </p>
                        {notif.teacherName && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Dispatched by: {notif.teacherName}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-card)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            EduNexus Digital Academic Record
          </span>
          <button className="btn btn-secondary" onClick={onClose}>
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
}
