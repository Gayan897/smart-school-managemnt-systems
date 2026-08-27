import { useEffect, useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Send,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Search,
  BookOpen,
  Calendar,
  Sparkles,
  Award,
  Layers,
  Clock,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import {
  computeStudentCorrelationProfile,
  computeClassRiskMatrix,
  generatePredictiveParentAlert,
  DEFAULT_SUBJECTS,
} from '../data/correlationEngine';
import type {
  Student,
  SchoolClass,
  AttendanceRecord,
  TermMark,
  TimetableSlot,
  StudentCorrelationProfile,
  SubjectRiskLevel,
} from '../data/models';

export default function CorrelationRadarScreen() {
  const { user, language } = useAuth();
  const isPrincipal = user?.role === 'principal';

  // Data states
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [marks, setMarks] = useState<TermMark[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);

  // UI / Filter states
  const [activeTab, setActiveTab] = useState<'principal' | 'teacher' | 'student'>(
    isPrincipal ? 'principal' : 'teacher'
  );
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'at_risk_only'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [simulatedExtraAbsences, setSimulatedExtraAbsences] = useState<number>(0);
  const [contactedParents, setContactedParents] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadData() {
      try {
        const [clsList, stuList, attList, marksList, ttList] = await Promise.all([
          databaseService.getClasses(),
          databaseService.getStudents(),
          databaseService.getAttendance(),
          databaseService.getTermMarks(),
          databaseService.getTimetable(),
        ]);
        setClasses(clsList);
        setStudents(stuList);
        setAttendance(attList);
        setMarks(marksList);
        setTimetable(ttList);

        if (clsList.length > 0) {
          setSelectedClassId(clsList[0].id);
        }
        if (stuList.length > 0) {
          setSelectedStudentId(stuList[0].id);
        }
      } catch (err) {
        console.error('Failed to load correlation radar data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute all profiles
  const studentProfiles = useMemo<StudentCorrelationProfile[]>(() => {
    return students.map(s =>
      computeStudentCorrelationProfile({
        student: s,
        attendance,
        marks,
        timetable,
      })
    );
  }, [students, attendance, marks, timetable]);

  // Profile Map for fast lookup
  const profileMap = useMemo(() => {
    const map = new Map<string, StudentCorrelationProfile>();
    studentProfiles.forEach(p => map.set(p.student.id, p));
    return map;
  }, [studentProfiles]);

  // Filtered profiles for teacher class view
  const classProfiles = useMemo(() => {
    let list = studentProfiles.filter(p => p.classRoom === selectedClassId);
    if (riskFilter === 'at_risk_only') {
      list = list.filter(p => p.overallRiskLevel === 'at_risk' || p.overallRiskLevel === 'critical');
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.student.name.toLowerCase().includes(q) || p.student.id.toLowerCase().includes(q));
    }
    // Sort critical and at-risk first
    return list.sort((a, b) => b.overallRiskScore - a.overallRiskScore);
  }, [studentProfiles, selectedClassId, riskFilter, searchQuery]);

  // School-wide statistics & Top at-risk students for principal
  const topAtRiskStudents = useMemo(() => {
    return [...studentProfiles]
      .sort((a, b) => b.overallRiskScore - a.overallRiskScore)
      .slice(0, 10);
  }, [studentProfiles]);

  const classRiskMatrix = useMemo(() => {
    return computeClassRiskMatrix({
      classes,
      students,
      attendance,
      marks,
      timetable,
    });
  }, [classes, students, attendance, marks, timetable]);

  // Selected student profile for Student / Parent tab
  const activeStudentProfile = useMemo(() => {
    return profileMap.get(selectedStudentId) || (studentProfiles.length > 0 ? studentProfiles[0] : null);
  }, [profileMap, selectedStudentId, studentProfiles]);

  // Radar chart data for active student
  const radarChartData = useMemo(() => {
    if (!activeStudentProfile) return [];
    return activeStudentProfile.subjectRisks.map(r => {
      // Calculate simulated mark if extra absences applied
      const simulatedDrop = Math.round(simulatedExtraAbsences * r.regressionSlope);
      const simulatedMark = Math.max(10, r.latestMark - (r.predictedDrop + simulatedDrop));

      return {
        subject: r.subject,
        'Attendance Rate %': r.attendanceRate,
        'Latest Mark %': r.latestMark,
        'Predicted Mark %': simulatedExtraAbsences > 0 ? simulatedMark : r.predictedMark,
      };
    });
  }, [activeStudentProfile, simulatedExtraAbsences]);

  // Risk badge helper
  function getRiskBadge(level: SubjectRiskLevel) {
    switch (level) {
      case 'critical':
        return <span className="badge badge-danger" style={{ fontWeight: 700 }}>🚨 {t('criticalRisk', language)}</span>;
      case 'at_risk':
        return <span className="badge badge-warning" style={{ fontWeight: 700 }}>⚠️ {t('atRisk', language)}</span>;
      case 'watch':
        return <span className="badge badge-secondary">👀 {t('watchRisk', language)}</span>;
      default:
        return <span className="badge badge-success">✅ {t('safeRisk', language)}</span>;
    }
  }

  function getRiskColor(level: SubjectRiskLevel) {
    switch (level) {
      case 'critical': return '#ef4444';
      case 'at_risk': return '#f59e0b';
      case 'watch': return '#3b82f6';
      default: return '#10b981';
    }
  }

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #ef4444 0%, #ec4899 100%)',
              color: '#fff',
              padding: '7px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Activity size={22} />
            </div>
            <h1 className="page-title">{t('correlationRadarTitle', language)}</h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {t('correlationRadarSubtitle', language)}
          </p>
        </div>
      </div>

      {/* Perspective Tabs */}
      <div className="tabs" style={{ marginBottom: '20px' }}>
        {isPrincipal && (
          <button
            className={`tab ${activeTab === 'principal' ? 'active' : ''}`}
            onClick={() => setActiveTab('principal')}
          >
            <Layers size={16} />
            {t('principalSchoolRadar', language)}
          </button>
        )}

        <button
          className={`tab ${activeTab === 'teacher' ? 'active' : ''}`}
          onClick={() => setActiveTab('teacher')}
        >
          <AlertCircle size={16} />
          {t('teacherClassEarlyWarning', language)}
        </button>

        <button
          className={`tab ${activeTab === 'student' ? 'active' : ''}`}
          onClick={() => setActiveTab('student')}
        >
          <TrendingDown size={16} />
          {t('studentParentRadar', language)}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: PRINCIPAL — SCHOOL-WIDE HEATMAP & TOP AT-RISK
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'principal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Key Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
          }}>
            <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <AlertTriangle size={26} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 800 }}>
                  {studentProfiles.filter(p => p.overallRiskLevel === 'critical').length}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Critical Academic Risk</div>
                <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px' }}>
                  Predicted grade drop to F/S
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <TrendingDown size={26} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 800 }}>
                  {studentProfiles.filter(p => p.overallRiskLevel === 'at_risk').length}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>At-Risk Watchlist</div>
                <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '2px' }}>
                  $10-19$ mark trajectory loss
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Sparkles size={26} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 800 }}>
                  {studentProfiles.filter(p => p.patterns.length > 0).length}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Chronic Pattern Skips</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Period-specific absenteeism
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.15)', color: '#10b981',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <CheckCircle2 size={26} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 800 }}>
                  {studentProfiles.filter(p => p.overallRiskLevel === 'safe').length}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Safe (On-Track)</div>
                <div style={{ fontSize: '11px', color: '#10b981', marginTop: '2px' }}>
                  Stable grade progression
                </div>
              </div>
            </div>
          </div>

          {/* 1. School-Wide Class Risk Heatmap */}
          <div className="card">
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="#6366f1" />
              {t('principalSchoolRadar', language)} (Class × Subject Matrix)
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Color-coded by average predicted mark drop per subject. Red indicates high subject vulnerability to absenteeism.
            </p>

            <div className="table-wrapper" style={{ border: 'none', overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Attendance %</th>
                    <th>At Risk</th>
                    {DEFAULT_SUBJECTS.slice(0, 7).map(s => (
                      <th key={s} style={{ textAlign: 'center' }}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classRiskMatrix.map(row => (
                    <tr key={row.classId}>
                      <td><strong>Grade {row.grade}{row.section}</strong></td>
                      <td>
                        <span style={{ fontWeight: 600, color: row.averageAttendanceRate < 80 ? '#ef4444' : '#10b981' }}>
                          {row.averageAttendanceRate}%
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${row.criticalCount > 0 ? 'badge-danger' : row.atRiskCount > 0 ? 'badge-warning' : 'badge-success'}`}>
                          {row.atRiskCount} / {row.totalStudents}
                        </span>
                      </td>
                      {DEFAULT_SUBJECTS.slice(0, 7).map(subj => {
                        const cell = row.subjectRiskAverages[subj] || { avgRiskScore: 10, avgDrop: 2, atRiskStudents: 0 };
                        const isSevere = cell.avgDrop >= 12 || cell.atRiskStudents >= 2;
                        const isMod = cell.avgDrop >= 6 || cell.atRiskStudents >= 1;

                        const bgColor = isSevere ? 'rgba(239, 68, 68, 0.18)' : isMod ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.08)';
                        const textColor = isSevere ? '#ef4444' : isMod ? '#f59e0b' : '#10b981';

                        return (
                          <td key={subj} style={{ textAlign: 'center', background: bgColor, borderRadius: '4px' }}>
                            <div style={{ fontWeight: 700, color: textColor, fontSize: '13px' }}>
                              -{cell.avgDrop} pts
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              {cell.atRiskStudents > 0 ? `${cell.atRiskStudents} at risk` : 'Stable'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Top At-Risk Students Cross-School Leaderboard */}
          <div className="card">
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} color="#ef4444" />
              {t('highRiskStudents', language)} Across All Grades
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Students requiring immediate administrative or counselling intervention.
            </p>

            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Class</th>
                    <th>Attendance %</th>
                    <th>Predicted Drop</th>
                    <th>Highest Risk Subject</th>
                    <th>Patterns</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {topAtRiskStudents.map(p => {
                    const worstSubject = [...p.subjectRisks].sort((a, b) => b.riskScore - a.riskScore)[0];
                    const alertData = generatePredictiveParentAlert(p);

                    return (
                      <tr key={p.student.id}>
                        <td>
                          <strong>{p.student.name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.student.id}</div>
                        </td>
                        <td><strong>{p.classRoom}</strong></td>
                        <td>
                          <span style={{ color: p.overallAttendanceRate < 80 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                            {p.overallAttendanceRate}%
                          </span>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.totalAbsences} days missed</div>
                        </td>
                        <td>
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>
                            {p.latestAverageMark}% → {p.predictedAverageMark}%
                          </span>
                        </td>
                        <td>
                          {worstSubject && (
                            <div>
                              <strong>{worstSubject.subject}</strong>
                              <div style={{ fontSize: '11px', color: '#ef4444' }}>
                                {worstSubject.gradeDropLabel}
                              </div>
                            </div>
                          )}
                        </td>
                        <td>
                          {p.patterns.length > 0 ? (
                            <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                              ⚠️ {p.patterns[0].dayName} P{p.patterns[0].period} ({p.patterns[0].occurrences}x)
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                          )}
                        </td>
                        <td>{getRiskBadge(p.overallRiskLevel)}</td>
                        <td>
                          <a
                            href={alertData.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#25D366', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Send size={12} />
                            Alert Parent
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: TEACHER — CLASS EARLY WARNING & INTERVENTION HUB
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'teacher' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Controls Bar */}
          <div className="card" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0, minWidth: '220px' }}>
              <label className="form-label">{t('selectClass', language)}</label>
              <select
                className="form-control"
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    Grade {c.grade}{c.section} ({c.stream === 'ol' ? 'O/L' : 'A/L'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
              <label className="form-label">{t('riskLevel', language)} Filter</label>
              <select
                className="form-control"
                value={riskFilter}
                onChange={e => setRiskFilter(e.target.value as any)}
              >
                <option value="all">All Students ({studentProfiles.filter(p => p.classRoom === selectedClassId).length})</option>
                <option value="at_risk_only">🚨 At Risk & Critical Only</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '200px' }}>
              <label className="form-label">Search Student</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-control"
                  placeholder="Type student name or ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <Search size={16} style={{ position: 'absolute', right: '10px', top: '10px', color: 'var(--text-muted)' }} />
              </div>
            </div>
          </div>

          {/* Student Risk Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px',
          }}>
            {classProfiles.map(p => {
              const alertData = generatePredictiveParentAlert(p);
              const isContacted = contactedParents[p.student.id] || false;

              return (
                <div
                  key={p.student.id}
                  style={{
                    background: 'var(--card-bg)',
                    border: `1px solid ${p.overallRiskLevel === 'critical' ? '#ef4444' : p.overallRiskLevel === 'at_risk' ? '#f59e0b' : 'var(--border-color, #334155)'}`,
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: p.overallRiskLevel === 'critical' ? '0 4px 14px rgba(239, 68, 68, 0.15)' : undefined,
                  }}
                >
                  {/* Top Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '15px' }}>{p.student.name}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {p.student.id}</div>
                    </div>
                    {getRiskBadge(p.overallRiskLevel)}
                  </div>

                  {/* Attendance & Overall Grade Trajectory */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    background: 'var(--bg-hover, rgba(255,255,255,0.04))',
                    padding: '10px',
                    borderRadius: '8px',
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Attendance Rate</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: p.overallAttendanceRate < 80 ? '#ef4444' : '#10b981' }}>
                        {p.overallAttendanceRate}% <span style={{ fontSize: '11px', fontWeight: 400 }}>({p.totalAbsences}d absent)</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Predicted Term Avg</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: p.predictedAverageMark < p.latestAverageMark ? '#ef4444' : '#10b981' }}>
                        {p.latestAverageMark}% → {p.predictedAverageMark}%
                      </div>
                    </div>
                  </div>

                  {/* Chronic Pattern Alerts */}
                  {p.patterns.length > 0 && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      borderLeft: '3px solid #ef4444',
                      padding: '8px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                    }}>
                      <strong style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> Pattern Detected:
                      </strong>
                      <div style={{ marginTop: '2px', color: 'var(--text-main)' }}>
                        {p.patterns[0].description}
                      </div>
                    </div>
                  )}

                  {/* High Risk Subjects List */}
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Subject Risk Projections:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {p.subjectRisks.slice(0, 3).map(sr => (
                        <div
                          key={sr.subject}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '12px',
                            background: 'var(--card-bg)',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color, #334155)',
                          }}
                        >
                          <div>
                            <strong>{sr.subject}</strong>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              Missed {sr.missedPeriods} periods
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{
                              fontWeight: 700,
                              color: sr.riskLevel === 'critical' ? '#ef4444' : sr.riskLevel === 'at_risk' ? '#f59e0b' : '#10b981'
                            }}>
                              {sr.gradeDropLabel}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Action / WhatsApp Dispatch */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 'auto',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-color, #334155)',
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isContacted}
                        onChange={e => setContactedParents(prev => ({ ...prev, [p.student.id]: e.target.checked }))}
                      />
                      <span>Parent Contacted</span>
                    </label>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setSelectedStudentId(p.student.id);
                          setActiveTab('student');
                        }}
                      >
                        Deep Dive
                      </button>
                      <a
                        href={alertData.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm"
                        style={{ color: '#fff', background: '#25D366', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Send size={12} />
                        WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3: STUDENT / PARENT — PERFORMANCE TRAJECTORY & RADAR WEB
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'student' && activeStudentProfile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Student Selector Card */}
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '16px'
              }}>
                {activeStudentProfile.student.name.charAt(0)}
              </div>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  {activeStudentProfile.student.name}
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Class: {activeStudentProfile.classRoom} • Overall Attendance: {activeStudentProfile.overallAttendanceRate}% ({activeStudentProfile.totalAbsences} days absent)
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                className="form-control"
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
                style={{ minWidth: '220px' }}
              >
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.classRoom})
                  </option>
                ))}
              </select>
              {getRiskBadge(activeStudentProfile.overallRiskLevel)}
            </div>
          </div>

          {/* Interactive What-If Absence Simulator Slider */}
          <div className="card" style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%)',
            border: '1px solid #6366f1',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <strong style={{ fontSize: '14px', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} />
                  AI "What-If" Absence Impact Simulator
                </strong>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Simulate what happens to {activeStudentProfile.student.name.split(' ')[0]}'s exam marks if they miss more classes this term.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  +{simulatedExtraAbsences} Extra Absences:
                </span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={simulatedExtraAbsences}
                  onChange={e => setSimulatedExtraAbsences(Number(e.target.value))}
                  style={{ width: '140px', cursor: 'pointer' }}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSimulatedExtraAbsences(0)}
                  disabled={simulatedExtraAbsences === 0}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Visual Grid: Radar Chart + Pattern Alerts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {/* Hexagonal Radar Web Chart */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px', alignSelf: 'flex-start' }}>
                Subject Performance & Attendance Radar Web
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', alignSelf: 'flex-start' }}>
                Compares Current Mark, Attendance Rate, and AI Predicted Exam Outcome across all subjects.
              </p>

              <div style={{ width: '100%', height: '320px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarChartData}>
                    <PolarGrid stroke="var(--border-color, #334155)" />
                    <PolarAngleAxis dataKey="subject" stroke="var(--text-muted)" fontSize={11} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="var(--text-muted)" fontSize={10} />
                    <Radar name="Attendance %" dataKey="Attendance Rate %" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                    <Radar name="Current Mark %" dataKey="Latest Mark %" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                    <Radar name="Predicted Mark %" dataKey="Predicted Mark %" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pattern Detection Box & Trajectory Line Chart */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                {t('detectedPatterns', language)}
              </h3>

              {activeStudentProfile.patterns.length === 0 ? (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid #10b981',
                  padding: '14px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <CheckCircle2 size={22} color="#10b981" />
                  <div style={{ fontSize: '13px', color: '#10b981' }}>
                    {t('noPatternsDetected', language)}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeStudentProfile.patterns.map((pat, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        borderLeft: '4px solid #ef4444',
                        padding: '12px 14px',
                        borderRadius: '6px',
                      }}
                    >
                      <strong style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <Clock size={14} /> Pattern #{idx + 1}: Skipping Period {pat.period} on {pat.dayName}s
                      </strong>
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>
                        {pat.description}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Impact: Student misses key core syllabus concepts taught during Thursday afternoon slots.
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Trajectory comparison bar */}
              <div style={{ marginTop: 'auto' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                  Overall Average Grade Projection:
                </h4>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  padding: '12px',
                  background: 'var(--bg-hover, rgba(255,255,255,0.04))',
                  borderRadius: '8px',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Latest Term Mark</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#6366f1' }}>
                      {activeStudentProfile.latestAverageMark}%
                    </div>
                  </div>
                  <div style={{ fontSize: '20px', color: 'var(--text-muted)' }}>➔</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Predicted Term Mark</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: activeStudentProfile.predictedAverageMark < activeStudentProfile.latestAverageMark ? '#ef4444' : '#10b981' }}>
                      {activeStudentProfile.predictedAverageMark}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Subject-By-Subject Risk Cards & Remedial Recommendations */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              {t('remedialRecommendation', language)}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Specific linear regression impact per subject and targeted remedial advice.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px',
            }}>
              {activeStudentProfile.subjectRisks.map(r => (
                <div
                  key={r.subject}
                  style={{
                    border: `1px solid ${getRiskColor(r.riskLevel)}`,
                    borderRadius: '10px',
                    padding: '14px',
                    background: 'var(--card-bg)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '14px' }}>{r.subject}</strong>
                    {getRiskBadge(r.riskLevel)}
                  </div>

                  <div style={{ fontSize: '13px', color: r.riskLevel === 'critical' ? '#ef4444' : 'var(--text-main)' }}>
                    {r.message}
                  </div>

                  <div style={{
                    background: 'var(--bg-hover, rgba(255,255,255,0.04))',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    borderLeft: `3px solid ${getRiskColor(r.riskLevel)}`,
                  }}>
                    <strong style={{ color: getRiskColor(r.riskLevel), display: 'block', marginBottom: '2px' }}>
                      💡 Remedial Action:
                    </strong>
                    {r.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
