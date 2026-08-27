import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import type { AttendanceRecord, LeaveRequest, TermMark, SchoolClass } from '../data/models';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Sparkles, BarChart2, Clock, ShieldCheck } from 'lucide-react';

export default function ReportsScreen() {
  const { user, language } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveReqs, setLeaveReqs] = useState<LeaveRequest[]>([]);
  const [marks, setMarks] = useState<TermMark[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [activeTab, setActiveTab] = useState<'attendance' | 'leave' | 'performance'>('attendance');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      databaseService.getAttendance(),
      databaseService.getLeaveRequests(),
      databaseService.getTermMarks(),
      databaseService.getClasses(),
    ]).then(([a, l, m, c]) => {
      setAttendance(a);
      setLeaveReqs(l);
      setMarks(m);
      setClasses(c);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  // Zonal Admin view: Display as Upcoming Feature
  if (user?.role === 'zonal_admin') {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('reports', language)}</h1>
            <p className="page-subtitle">Zonal Education Office Analytics Portal</p>
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--bg-card)', border: '1px dashed var(--primary)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(124, 58, 237, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Sparkles size={32} color="#7c3aed" />
          </div>
          <span className="badge badge-primary" style={{ background: '#7c3aed', color: '#fff', padding: '6px 14px', fontSize: '12px', marginBottom: '12px', display: 'inline-block' }}>
            🚀 UPCOMING FEATURE
          </span>
          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0 12px', color: 'var(--text-main)' }}>
            Zone-Wide Analytics & Advanced Reporting
          </h2>
          <p style={{ maxWidth: '560px', margin: '0 auto 24px', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6 }}>
            The Zonal District Reports engine is currently under development. Soon, Zonal Officers will be able to generate multi-school comparative performance matrices, district attendance trends, and automated Ministry summary reports.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', maxWidth: '720px', margin: '0 auto', textAlign: 'left' }}>
            <div style={{ background: 'var(--bg-hover)', padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', color: '#7c3aed' }}>
                <BarChart2 size={16} /> District Performance Matrix
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Comparative O/L & A/L performance across all registered zonal schools.</div>
            </div>
            <div style={{ background: 'var(--bg-hover)', padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0284c7' }}>
                <Clock size={16} /> Attendance Heatmap
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Real-time student & teacher attendance averages by school division.</div>
            </div>
            <div style={{ background: 'var(--bg-hover)', padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
                <ShieldCheck size={16} /> Automated Ministry Audits
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>One-click PDF generation for Ministry of Education reporting.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const attByStatus = {
    present: attendance.filter(a => a.status === 'present').length,
    absent: attendance.filter(a => a.status === 'absent').length,
    late: attendance.filter(a => a.status === 'late').length,
    excused: attendance.filter(a => a.status === 'excused').length,
  };

  const attPieData = [
    { name: t('present', language), value: attByStatus.present, color: 'var(--success)' },
    { name: t('absent', language), value: attByStatus.absent, color: 'var(--danger)' },
    { name: t('late', language), value: attByStatus.late, color: 'var(--warning)' },
    { name: t('excused', language), value: attByStatus.excused, color: 'var(--info)' },
  ].filter(d => d.value > 0);

  const leaveTypes: ('casual' | 'medical' | 'annual' | 'duty')[] = ['casual', 'medical', 'annual', 'duty'];
  const leaveByType = leaveTypes.map(type => ({
    type: type.toUpperCase(),
    approved: leaveReqs.filter(r => r.type === type && r.status === 'approved').length,
    pending: leaveReqs.filter(r => r.type === type && r.status === 'pending').length,
    rejected: leaveReqs.filter(r => r.type === type && r.status === 'rejected').length,
  }));

  const subjectMap = marks.reduce((acc, m) => {
    if (!acc[m.subject]) acc[m.subject] = [];
    acc[m.subject].push(m.marks);
    return acc;
  }, {} as Record<string, number[]>);

  const perfData = Object.entries(subjectMap).map(([subject, scores]) => ({
    subject,
    avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('reports', language)}</h1>
        </div>
      </div>

      {/* Summary stats */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {attendance.length > 0
                ? Math.round((attByStatus.present / attendance.length) * 100)
                : 0}%
            </div>
            <div className="stat-label">Attendance Rate</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-value" style={{ color: 'var(--warning)' }}>
              {leaveReqs.filter(r => r.status === 'pending').length}
            </div>
            <div className="stat-label">{t('pendingLeave', language)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-value" style={{ color: 'var(--primary-light)' }}>
              {marks.length > 0
                ? Math.round(marks.reduce((s, m) => s + m.marks, 0) / marks.length)
                : 0}
            </div>
            <div className="stat-label">Avg. Score</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-value" style={{ color: 'var(--accent)' }}>
              {classes.length}
            </div>
            <div className="stat-label">Classes</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
          {t('attendanceReport', language)}
        </button>
        <button className={`tab ${activeTab === 'leave' ? 'active' : ''}`} onClick={() => setActiveTab('leave')}>
          {t('leaveReport', language)}
        </button>
        <button className={`tab ${activeTab === 'performance' ? 'active' : ''}`} onClick={() => setActiveTab('performance')}>
          {t('performanceReport', language)}
        </button>
      </div>

      {activeTab === 'attendance' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: '16px' }}>Attendance Distribution</h2>
            {attPieData.length === 0 ? (
              <div className="empty-state"><p>{t('noData', language)}</p></div>
            ) : (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={attPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {attPieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="card">
            <h2 className="card-title" style={{ marginBottom: '16px' }}>Attendance Summary</h2>
            {[
              { label: t('present', language), val: attByStatus.present, color: 'var(--success)' },
              { label: t('absent', language), val: attByStatus.absent, color: 'var(--danger)' },
              { label: t('late', language), val: attByStatus.late, color: 'var(--warning)' },
              { label: t('excused', language), val: attByStatus.excused, color: 'var(--info)' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                <span style={{ fontWeight: 700, color: row.color, fontSize: '18px' }}>{row.val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', marginTop: '4px' }}>
              <span style={{ fontWeight: 600 }}>Total</span>
              <span style={{ fontWeight: 700, fontSize: '18px' }}>{attendance.length}</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leave' && (
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: '16px' }}>Leave by Type</h2>
          {leaveReqs.length === 0 ? (
            <div className="empty-state"><p>{t('noData', language)}</p></div>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leaveByType} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="type" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="approved" name={t('approved', language)} fill="var(--success)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" name={t('pending', language)} fill="var(--warning)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rejected" name={t('rejected', language)} fill="var(--danger)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: '16px' }}>Average Marks by Subject</h2>
          {perfData.length === 0 ? (
            <div className="empty-state"><p>{t('noData', language)}</p></div>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perfData} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="subject" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Bar dataKey="avg" name="Average" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
