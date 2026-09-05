import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import type { AttendanceRecord, LeaveRequest, TermMark, SchoolClass, Student } from '../data/models';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  Sparkles, BarChart2, Clock, ShieldCheck, Users, TrendingUp,
  ChevronDown, ChevronUp, Award, Download, FileText, CheckCircle2, Loader2,
} from 'lucide-react';
import { exportAttendancePdf, exportPerformancePdf } from '../utils/reportsPdf';

export default function ReportsScreen() {
  const { user, language } = useAuth();
  const isPrincipal = user?.role === 'principal' || user?.role === 'zonal_admin';
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveReqs, setLeaveReqs] = useState<LeaveRequest[]>([]);
  const [marks, setMarks] = useState<TermMark[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState<'attendance' | 'leave' | 'performance'>('attendance');
  const [loading, setLoading] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedTerm, setSelectedTerm] = useState<number>(1);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      databaseService.getAttendance(),
      databaseService.getLeaveRequests(),
      databaseService.getTermMarks(),
      databaseService.getClasses(),
      databaseService.getStudents(),
    ]).then(([a, l, m, c, s]) => {
      setAttendance(a);
      setLeaveReqs(l);
      setMarks(m);
      setClasses(c);
      setAllStudents(s);
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

  // ── Principal view ──────────────────────────────────────────────────
  if (isPrincipal) {
    return <PrincipalReportsView
      classes={classes} allStudents={allStudents} attendance={attendance}
      marks={marks} leaveReqs={leaveReqs}
      activeTab={activeTab} setActiveTab={setActiveTab}
      selectedGrade={selectedGrade} setSelectedGrade={setSelectedGrade}
      selectedTerm={selectedTerm} setSelectedTerm={setSelectedTerm}
      expandedClass={expandedClass} setExpandedClass={setExpandedClass}
      language={language}
      schoolName={user?.schoolName}
      schoolCensusCode={user?.schoolCensusCode}
      principalName={user?.name}
    />;
  }

  // ── Teacher view ─────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════
// PrincipalReportsView — Class-wise Attendance & Performance
// ═══════════════════════════════════════════════════════════════════════════

interface PrincipalReportsProps {
  classes: SchoolClass[];
  allStudents: Student[];
  attendance: AttendanceRecord[];
  marks: TermMark[];
  leaveReqs: LeaveRequest[];
  activeTab: 'attendance' | 'leave' | 'performance';
  setActiveTab: (v: 'attendance' | 'leave' | 'performance') => void;
  selectedGrade: string;
  setSelectedGrade: (v: string) => void;
  selectedTerm: number;
  setSelectedTerm: (v: number) => void;
  expandedClass: string | null;
  setExpandedClass: (v: string | null) => void;
  language: string;
  schoolName?: string;
  schoolCensusCode?: string;
  principalName?: string;
}

function PrincipalReportsView({
  classes, allStudents, attendance, marks, leaveReqs,
  activeTab, setActiveTab, selectedGrade, setSelectedGrade,
  selectedTerm, setSelectedTerm, expandedClass, setExpandedClass, language,
  schoolName, schoolCensusCode, principalName,
}: PrincipalReportsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  const availableGrades = useMemo(() => [...new Set(classes.map(c => c.grade))].sort((a, b) => a - b), [classes]);

  const filteredClasses = useMemo(() => {
    if (selectedGrade === 'all') return classes;
    return classes.filter(c => c.grade.toString() === selectedGrade);
  }, [classes, selectedGrade]);

  // Class-wise attendance aggregation
  const classAttendance = useMemo(() => filteredClasses.map(cls => {
    const classStudents = allStudents.filter(s => s.classRoom === cls.id);
    const studentIds = new Set(classStudents.map(s => s.id));
    const recs = attendance.filter(a => studentIds.has(a.studentId));
    const total = recs.length;
    const present = recs.filter(a => a.status === 'present').length;
    const absent = recs.filter(a => a.status === 'absent').length;
    const late = recs.filter(a => a.status === 'late').length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    const studentBreakdown = classStudents.map(s => {
      const sRecs = recs.filter(a => a.studentId === s.id);
      const sTotal = sRecs.length;
      const sPresent = sRecs.filter(a => a.status === 'present').length;
      return {
        id: s.id, name: s.name, admNo: s.admissionNumber || s.id,
        total: sTotal, present: sPresent,
        absent: sRecs.filter(a => a.status === 'absent').length,
        late: sRecs.filter(a => a.status === 'late').length,
        rate: sTotal > 0 ? Math.round((sPresent / sTotal) * 100) : 0,
      };
    }).sort((a, b) => a.rate - b.rate);
    return { classId: cls.id, grade: cls.grade, section: cls.section, stream: cls.stream, totalStudents: classStudents.length, total, present, absent, late, rate, studentBreakdown };
  }), [filteredClasses, allStudents, attendance]);

  // Class-wise performance aggregation
  const classPerformance = useMemo(() => filteredClasses.map(cls => {
    const classStudents = allStudents.filter(s => s.classRoom === cls.id);
    const studentIds = new Set(classStudents.map(s => s.id));
    const termMarks = marks.filter(m => studentIds.has(m.studentId) && m.term === selectedTerm);
    const uniqueStudentsWithMarks = new Set(termMarks.map(m => m.studentId));
    const allMarkValues = termMarks.map(m => m.marks);
    const avgMarks = allMarkValues.length > 0 ? Math.round(allMarkValues.reduce((a, b) => a + b, 0) / allMarkValues.length) : 0;
    const passedCount = termMarks.filter(m => m.marks >= 35).length;
    const passRate = allMarkValues.length > 0 ? Math.round((passedCount / allMarkValues.length) * 100) : 0;
    const highestMark = allMarkValues.length > 0 ? Math.max(...allMarkValues) : 0;
    const topEntry = allMarkValues.length > 0 ? termMarks.reduce((a, b) => b.marks > a.marks ? b : a) : null;
    const topStudentName = topEntry ? (classStudents.find(s => s.id === topEntry.studentId)?.name || '—') : '—';
    const subjectMap: Record<string, number[]> = {};
    termMarks.forEach(m => { if (!subjectMap[m.subject]) subjectMap[m.subject] = []; subjectMap[m.subject].push(m.marks); });
    const subjectAvgs = Object.entries(subjectMap).map(([subject, vals]) => ({
      subject, avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    })).sort((a, b) => b.avg - a.avg);
    const studentPerf = classStudents.map(s => {
      const sMarks = termMarks.filter(m => m.studentId === s.id);
      const sVals = sMarks.map(m => m.marks);
      const sAvg = sVals.length > 0 ? Math.round(sVals.reduce((a, b) => a + b, 0) / sVals.length) : 0;
      const sGrade = sAvg >= 75 ? 'A' : sAvg >= 65 ? 'B' : sAvg >= 55 ? 'C' : sAvg >= 35 ? 'S' : sVals.length > 0 ? 'F' : '—';
      return { id: s.id, name: s.name, admNo: s.admissionNumber || s.id, subjects: sMarks.length, avg: sAvg, grade: sGrade };
    }).sort((a, b) => b.avg - a.avg);
    return { classId: cls.id, grade: cls.grade, section: cls.section, stream: cls.stream, totalStudents: classStudents.length, studentsWithMarks: uniqueStudentsWithMarks.size, avgMarks, passRate, highestMark, topStudentName, subjectAvgs, studentPerf };
  }), [filteredClasses, allStudents, marks, selectedTerm]);

  const totalStudents = allStudents.length;
  const overallAttRate = attendance.length > 0 ? Math.round((attendance.filter(a => a.status === 'present').length / attendance.length) * 100) : 0;
  const termMarksAll = marks.filter(m => m.term === selectedTerm);
  const overallAvgMark = termMarksAll.length > 0 ? Math.round(termMarksAll.reduce((s, m) => s + m.marks, 0) / termMarksAll.length) : 0;
  const COLORS = ['#0284c7', '#0d9488', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899'];

  const handleExportAttendance = async (detailed: boolean) => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 80));
      exportAttendancePdf({
        schoolName,
        schoolCensusCode,
        principalName,
        gradeFilter: selectedGrade,
        overallRate: overallAttRate,
        totalClasses: classes.length,
        totalStudents,
        classes: classAttendance,
        detailed,
      });
      setExportSuccessMsg(`Attendance Report (${detailed ? 'Full Roster' : 'Executive Summary'}) generated & downloaded!`);
      setTimeout(() => setExportSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error generating attendance PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPerformance = async (detailed: boolean) => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 80));
      exportPerformancePdf({
        schoolName,
        schoolCensusCode,
        principalName,
        gradeFilter: selectedGrade,
        selectedTerm,
        overallAvgMark,
        totalClasses: classes.length,
        totalStudents,
        classes: classPerformance,
        detailed,
      });
      setExportSuccessMsg(`Term ${selectedTerm} Performance Report (${detailed ? 'Full Rankings' : 'Executive Summary'}) generated & downloaded!`);
      setTimeout(() => setExportSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error generating performance PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">{t('reports', language)}</h1>
          <p className="page-subtitle">Class-wise Attendance &amp; Performance Analytics</p>
        </div>

        {activeTab !== 'leave' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
              {t('exportPdf', language)}:
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={isExporting}
              onClick={() => activeTab === 'attendance' ? handleExportAttendance(false) : handleExportPerformance(false)}
              title="Download clean 1-2 page summary table"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '12px' }}
            >
              {isExporting ? <Loader2 size={13} className="spin" /> : <FileText size={13} />}
              {t('summaryPdf', language)}
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={isExporting}
              onClick={() => activeTab === 'attendance' ? handleExportAttendance(true) : handleExportPerformance(true)}
              title="Download complete report including all student records"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '12px' }}
            >
              {isExporting ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
              {t('detailedPdf', language)}
            </button>
          </div>
        )}
      </div>

      {exportSuccessMsg && (
        <div style={{
          marginBottom: '20px',
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid var(--success)',
          color: 'var(--success)',
          padding: '10px 16px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
          fontWeight: 600,
        }}>
          <CheckCircle2 size={16} />
          <span>{exportSuccessMsg}</span>
        </div>
      )}

      {/* Summary Stats */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card"><div className="stat-info"><div className="stat-value" style={{ color: 'var(--primary-light)' }}>{classes.length}</div><div className="stat-label">Total Classes</div></div></div>
        <div className="stat-card"><div className="stat-info"><div className="stat-value" style={{ color: 'var(--accent)' }}>{totalStudents}</div><div className="stat-label">Total Students</div></div></div>
        <div className="stat-card"><div className="stat-info"><div className="stat-value" style={{ color: overallAttRate >= 75 ? 'var(--success)' : 'var(--warning)' }}>{overallAttRate}%</div><div className="stat-label">Overall Attendance</div></div></div>
        <div className="stat-card"><div className="stat-info"><div className="stat-value" style={{ color: 'var(--primary)' }}>{overallAvgMark}</div><div className="stat-label">Avg. Score (Term {selectedTerm})</div></div></div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('selectGrade', language)}</label>
            <select className="form-control" value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}>
              <option value="all">{t('allGrades', language)}</option>
              {availableGrades.map(g => <option key={g} value={g.toString()}>{t('grade', language)} {g}</option>)}
            </select>
          </div>
          {activeTab === 'performance' && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t('term', language)}</label>
              <select className="form-control" value={selectedTerm} onChange={e => setSelectedTerm(Number(e.target.value))}>
                {[1, 2, 3].map(tm => <option key={tm} value={tm}>{t('term', language)} {tm}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '20px' }}>
        <button className={`tab ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => { setActiveTab('attendance'); setExpandedClass(null); }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={14} /> {t('attendanceReport', language)}</span>
        </button>
        <button className={`tab ${activeTab === 'performance' ? 'active' : ''}`} onClick={() => { setActiveTab('performance'); setExpandedClass(null); }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingUp size={14} /> {t('performanceReport', language)}</span>
        </button>
        <button className={`tab ${activeTab === 'leave' ? 'active' : ''}`} onClick={() => { setActiveTab('leave'); setExpandedClass(null); }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> {t('leaveReport', language)}</span>
        </button>
      </div>

      {/* ─── ATTENDANCE TAB ─── */}
      {activeTab === 'attendance' && (
        <>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>Attendance Rate by Class</h3>
            {classAttendance.length === 0 ? <div className="empty-state"><p>{t('noData', language)}</p></div> : (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classAttendance.map(c => ({ name: `${c.grade}${c.section}`, rate: c.rate }))} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} stroke="var(--text-muted)" tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} formatter={(val: number) => [`${val}%`, 'Attendance Rate']} />
                    <Bar dataKey="rate" name="Attendance Rate" radius={[4, 4, 0, 0]}>
                      {classAttendance.map((entry, idx) => <Cell key={idx} fill={entry.rate >= 90 ? '#10b981' : entry.rate >= 75 ? '#f59e0b' : '#ef4444'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 className="card-title" style={{ margin: 0 }}>Class-wise Attendance Breakdown</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={isExporting}
                  onClick={() => handleExportAttendance(false)}
                  title="Download Attendance Summary PDF"
                  style={{ fontSize: '12px' }}
                >
                  <FileText size={13} /> {t('summaryPdf', language)}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={isExporting}
                  onClick={() => handleExportAttendance(true)}
                  title="Download Full Attendance PDF with student roster"
                  style={{ fontSize: '12px' }}
                >
                  <Download size={13} /> {t('detailedPdf', language)}
                </button>
              </div>
            </div>
            {classAttendance.length === 0 ? <div className="empty-state"><p>{t('noData', language)}</p></div> : (
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('class', language)}</th>
                      <th style={{ textAlign: 'center' }}>Students</th>
                      <th style={{ textAlign: 'center' }}>Present</th>
                      <th style={{ textAlign: 'center' }}>Absent</th>
                      <th style={{ textAlign: 'center' }}>Late</th>
                      <th style={{ textAlign: 'center' }}>Rate</th>
                      <th style={{ textAlign: 'center' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classAttendance.map(row => (
                      <>
                        <tr key={row.classId} style={{ cursor: 'pointer' }} onClick={() => setExpandedClass(expandedClass === row.classId ? null : row.classId)}>
                          <td style={{ fontWeight: 600, fontSize: '15px' }}>
                            {t('grade', language)} {row.grade}{row.section}
                            <span className="badge badge-primary" style={{ marginLeft: '8px', fontSize: '10px' }}>{row.stream === 'ol' ? 'O/L' : 'A/L'}</span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 500 }}>{row.totalStudents}</td>
                          <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 600 }}>{row.present}</td>
                          <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: 600 }}>{row.absent}</td>
                          <td style={{ textAlign: 'center', color: 'var(--warning)', fontWeight: 600 }}>{row.late}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${row.rate >= 90 ? 'badge-success' : row.rate >= 75 ? 'badge-warning' : 'badge-danger'}`} style={{ fontWeight: 700, fontSize: '13px', padding: '4px 10px' }}>
                              {row.total > 0 ? `${row.rate}%` : '—'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '3px 10px', fontSize: '11px' }}>
                              {expandedClass === row.classId ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          </td>
                        </tr>
                        {expandedClass === row.classId && (
                          <tr key={`${row.classId}_exp`}>
                            <td colSpan={7} style={{ padding: 0, background: 'var(--bg-secondary)' }}>
                              <div style={{ padding: '16px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Student Attendance — Grade {row.grade}{row.section}
                                </div>
                                {row.studentBreakdown.length === 0 ? (
                                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No students found in this class.</p>
                                ) : (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                                    {row.studentBreakdown.map(stu => (
                                      <div key={stu.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                        <div>
                                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{stu.name}</div>
                                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>#{stu.admNo} &bull; P:{stu.present} A:{stu.absent} L:{stu.late}</div>
                                        </div>
                                        <span className={`badge ${stu.rate >= 90 ? 'badge-success' : stu.rate >= 75 ? 'badge-warning' : 'badge-danger'}`} style={{ fontWeight: 700 }}>
                                          {stu.total > 0 ? `${stu.rate}%` : '—'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── PERFORMANCE TAB ─── */}
      {activeTab === 'performance' && (
        <>
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 className="card-title" style={{ marginBottom: '16px' }}>Average Marks by Class — Term {selectedTerm}</h3>
            {classPerformance.length === 0 ? <div className="empty-state"><p>{t('noData', language)}</p></div> : (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classPerformance.map(c => ({ name: `${c.grade}${c.section}`, avg: c.avgMarks }))} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                    <Bar dataKey="avg" name="Avg. Mark" radius={[4, 4, 0, 0]}>
                      {classPerformance.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 className="card-title" style={{ margin: 0 }}>Class-wise Performance — Term {selectedTerm}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={isExporting}
                  onClick={() => handleExportPerformance(false)}
                  title="Download Performance Summary PDF"
                  style={{ fontSize: '12px' }}
                >
                  <FileText size={13} /> {t('summaryPdf', language)}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={isExporting}
                  onClick={() => handleExportPerformance(true)}
                  title="Download Full Performance PDF with rankings & subject breakdowns"
                  style={{ fontSize: '12px' }}
                >
                  <Download size={13} /> {t('detailedPdf', language)}
                </button>
              </div>
            </div>
            {classPerformance.length === 0 ? <div className="empty-state"><p>{t('noData', language)}</p></div> : (
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('class', language)}</th>
                      <th style={{ textAlign: 'center' }}>Students</th>
                      <th style={{ textAlign: 'center' }}>Avg. Mark</th>
                      <th style={{ textAlign: 'center' }}>Pass Rate</th>
                      <th style={{ textAlign: 'center' }}>Highest</th>
                      <th>Top Performer</th>
                      <th style={{ textAlign: 'center' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classPerformance.map(row => (
                      <>
                        <tr key={row.classId} style={{ cursor: 'pointer' }} onClick={() => setExpandedClass(expandedClass === row.classId ? null : row.classId)}>
                          <td style={{ fontWeight: 600, fontSize: '15px' }}>
                            {t('grade', language)} {row.grade}{row.section}
                            <span className="badge badge-primary" style={{ marginLeft: '8px', fontSize: '10px' }}>{row.stream === 'ol' ? 'O/L' : 'A/L'}</span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 500 }}>{row.totalStudents}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, color: row.avgMarks >= 70 ? 'var(--success)' : row.avgMarks >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                              {row.studentsWithMarks > 0 ? `${row.avgMarks} / 100` : '—'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {row.studentsWithMarks > 0
                              ? <span className={`badge ${row.passRate >= 75 ? 'badge-success' : row.passRate >= 50 ? 'badge-warning' : 'badge-danger'}`} style={{ fontWeight: 700 }}>{row.passRate}%</span>
                              : <span className="badge badge-muted">—</span>}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary-light)' }}>{row.highestMark > 0 ? row.highestMark : '—'}</td>
                          <td>
                            {row.topStudentName !== '—'
                              ? <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Award size={14} style={{ color: '#f59e0b' }} /><span style={{ fontWeight: 500 }}>{row.topStudentName}</span></div>
                              : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '3px 10px', fontSize: '11px' }}>
                              {expandedClass === row.classId ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          </td>
                        </tr>
                        {expandedClass === row.classId && (
                          <tr key={`${row.classId}_perf_exp`}>
                            <td colSpan={7} style={{ padding: 0, background: 'var(--bg-secondary)' }}>
                              <div style={{ padding: '16px' }}>
                                {row.subjectAvgs.length > 0 && (
                                  <div style={{ marginBottom: '16px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subject Averages</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                      {row.subjectAvgs.map(s => (
                                        <div key={s.subject} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ fontSize: '12px', fontWeight: 600 }}>{s.subject}</span>
                                          <span style={{ fontWeight: 700, fontSize: '13px', color: s.avg >= 70 ? 'var(--success)' : s.avg >= 50 ? 'var(--warning)' : 'var(--danger)' }}>{s.avg}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Student Rankings</div>
                                {row.studentPerf.length === 0 ? (
                                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No students found in this class.</p>
                                ) : (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                                    {row.studentPerf.map((stu, idx) => (
                                      <div key={stu.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                        <div>
                                          <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {idx === 0 && stu.subjects > 0 && <Award size={12} style={{ color: '#f59e0b' }} />}
                                            {stu.name}
                                          </div>
                                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>#{stu.admNo} &bull; {stu.subjects} subjects</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                          <div style={{ fontWeight: 800, fontSize: '15px', color: stu.avg >= 70 ? 'var(--success)' : stu.avg >= 50 ? 'var(--warning)' : stu.subjects > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                                            {stu.subjects > 0 ? stu.avg : '—'}
                                          </div>
                                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{stu.grade}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── LEAVE TAB ─── */}
      {activeTab === 'leave' && (
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: '16px' }}>Leave by Type</h2>
          {leaveReqs.length === 0 ? <div className="empty-state"><p>{t('noData', language)}</p></div> : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(['casual', 'medical', 'annual', 'duty'] as const).map(type => ({
                  type: type.toUpperCase(),
                  approved: leaveReqs.filter(r => r.type === type && r.status === 'approved').length,
                  pending: leaveReqs.filter(r => r.type === type && r.status === 'pending').length,
                  rejected: leaveReqs.filter(r => r.type === type && r.status === 'rejected').length,
                }))} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
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
    </div>
  );
}
