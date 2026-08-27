import { useEffect, useState, useMemo } from 'react';
import {
  Sparkles,
  Calendar,
  Clock,
  UserX,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Send,
  Trash2,
  Plus,
  RefreshCw,
  Award,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import {
  getDayOfWeekFromDate,
  findAffectedPeriods,
  rankProxyCandidates,
  runAutoAllocationPipeline,
} from '../data/proxyEngine';
import type {
  Teacher,
  TimetableSlot,
  LeaveRequest,
  ProxyAssignment,
  SchoolClass,
} from '../data/models';

export default function ProxyEngineScreen() {
  const { user, language } = useAuth();

  // State
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [proxyAssignments, setProxyAssignments] = useState<ProxyAssignment[]>([]);
  const [, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modals & UI Controls
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyTeacherId, setEmergencyTeacherId] = useState('');
  const [emergencyNotes, setEmergencyNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'hub' | 'fairness' | 'myDuties'>('hub');
  const [candidateModalSlot, setCandidateModalSlot] = useState<{
    dayOfWeek: number;
    period: number;
    classRoom: string;
    subject: string;
    absentTeacherId: string;
    absentTeacherName: string;
    lessonPlanNotes?: string;
    leaveRequestId?: string;
  } | null>(null);

  // Load all initial and reactive data
  useEffect(() => {
    async function loadInitial() {
      try {
        const [tList, ttList, lList, pList, cList] = await Promise.all([
          databaseService.getTeachers(),
          databaseService.getTimetable(),
          databaseService.getLeaveRequests(),
          databaseService.getProxyAssignments(),
          databaseService.getClasses(),
        ]);
        setTeachers(tList);
        setTimetable(ttList);
        setLeaveRequests(lList);
        setProxyAssignments(pList);
        setClasses(cList);
      } catch (err) {
        console.error('Failed to load proxy engine data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitial();

    // Subscribe to real-time proxy updates
    const unsub = databaseService.subscribeToProxyAssignments((updatedList) => {
      setProxyAssignments(updatedList);
    });

    return () => unsub();
  }, []);

  const dayOfWeek = useMemo(() => getDayOfWeekFromDate(selectedDate), [selectedDate]);

  // Determine all absent teachers on selected date
  const absentTeachersOnDate = useMemo(() => {
    const list: { id: string; name: string; lessonPlanNotes?: string; leaveRequestId?: string }[] = [];

    // From approved leaves
    for (const lr of leaveRequests) {
      if (lr.status === 'approved' && selectedDate >= lr.startDate && selectedDate <= lr.endDate) {
        list.push({
          id: lr.teacherId,
          name: lr.teacherName,
          lessonPlanNotes: lr.lessonPlanNotes || '',
          leaveRequestId: lr.id,
        });
      }
    }

    // Also include any teachers already substituted for today who might not have a formal leave form
    for (const p of proxyAssignments) {
      if (p.date === selectedDate) {
        if (!list.some(a => a.id === p.originalTeacherId || a.name === p.originalTeacherName)) {
          list.push({
            id: p.originalTeacherId,
            name: p.originalTeacherName,
            lessonPlanNotes: p.lessonPlanNotes,
          });
        }
      }
    }

    return list;
  }, [leaveRequests, proxyAssignments, selectedDate]);

  // Scan timetable for affected periods and gaps
  const { uncoveredSlots, alreadyCoveredSlots } = useMemo(() => {
    return findAffectedPeriods({
      date: selectedDate,
      dayOfWeek,
      absentTeachers: absentTeachersOnDate,
      timetable,
      existingAssignments: proxyAssignments,
    });
  }, [selectedDate, dayOfWeek, absentTeachersOnDate, timetable, proxyAssignments]);

  // Coverage statistics
  const totalScheduledToday = useMemo(() => {
    return timetable.filter(s => s.dayOfWeek === dayOfWeek).length;
  }, [timetable, dayOfWeek]);

  const totalImpactedSlots = uncoveredSlots.length + alreadyCoveredSlots.length;
  const coveragePercent = totalImpactedSlots === 0 ? 100 : Math.round((alreadyCoveredSlots.length / totalImpactedSlots) * 100);

  // Teacher specific proxy duties
  const myDuties = useMemo(() => {
    if (!user) return [];
    return proxyAssignments.filter(
      p => (p.substituteTeacherId === user.id || p.substituteTeacherName === user.name)
    ).sort((a, b) => b.date.localeCompare(a.date) || a.period - b.period);
  }, [proxyAssignments, user]);

  const myDutiesToday = useMemo(() => {
    return myDuties.filter(p => p.date === selectedDate);
  }, [myDuties, selectedDate]);

  // Workload Analytics Data
  const workloadData = useMemo(() => {
    const counts: Record<string, { teacher: Teacher; totalProxies: number; thisWeekProxies: number }> = {};

    teachers.forEach(t => {
      counts[t.id] = { teacher: t, totalProxies: 0, thisWeekProxies: 0 };
    });

    const curr = new Date(selectedDate);
    const dayOffset = (curr.getDay() + 6) % 7;
    const monday = new Date(curr);
    monday.setDate(curr.getDate() - dayOffset);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const monStr = monday.toISOString().slice(0, 10);
    const friStr = friday.toISOString().slice(0, 10);

    proxyAssignments.forEach(p => {
      if (counts[p.substituteTeacherId]) {
        counts[p.substituteTeacherId].totalProxies += 1;
        if (p.date >= monStr && p.date <= friStr) {
          counts[p.substituteTeacherId].thisWeekProxies += 1;
        }
      }
    });

    return Object.values(counts).sort((a, b) => b.totalProxies - a.totalProxies);
  }, [teachers, proxyAssignments, selectedDate]);

  // 1-Click AI Auto-Allocation Handler
  async function handleAutoAllocateAll() {
    if (uncoveredSlots.length === 0) return;
    setSubmitting(true);
    try {
      const { successAssignments } = runAutoAllocationPipeline({
        date: selectedDate,
        uncoveredSlots,
        allTeachers: teachers,
        timetable,
        allProxyAssignments: proxyAssignments,
        allLeaveRequests: leaveRequests,
        assignedBy: user?.name || 'Principal Office',
      });

      if (successAssignments.length > 0) {
        await databaseService.batchCreateProxyAssignments(successAssignments);
      }
    } catch (err) {
      console.error('Auto allocation failed:', err);
    } finally {
      setSubmitting(false);
    }
  }

  // Assign individual candidate
  async function handleAssignCandidate(
    slot: {
      dayOfWeek: number;
      period: number;
      classRoom: string;
      subject: string;
      absentTeacherId: string;
      absentTeacherName: string;
      lessonPlanNotes?: string;
      leaveRequestId?: string;
    },
    teacher: Teacher,
    matchScore: number,
    matchReason: string
  ) {
    setSubmitting(true);
    try {
      const assignment: ProxyAssignment = {
        id: `proxy_${selectedDate.replace(/-/g, '')}_p${slot.period}_${slot.classRoom}_${Date.now()}`,
        date: selectedDate,
        dayOfWeek: slot.dayOfWeek,
        period: slot.period,
        classRoom: slot.classRoom,
        originalTeacherId: slot.absentTeacherId,
        originalTeacherName: slot.absentTeacherName,
        originalSubject: slot.subject,
        substituteTeacherId: teacher.id,
        substituteTeacherName: teacher.name,
        substituteTeacherSubject: teacher.subject || 'General',
        leaveRequestId: slot.leaveRequestId,
        status: 'assigned',
        lessonPlanNotes: slot.lessonPlanNotes || '',
        matchScore,
        matchReason,
        assignedAt: new Date().toISOString(),
        assignedBy: user?.name || 'Principal Office',
      };

      await databaseService.createProxyAssignment(assignment);
      setCandidateModalSlot(null);
    } catch (err) {
      console.error('Assign candidate failed:', err);
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Emergency Morning Absence Submission
  async function handleEmergencyAbsenceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emergencyTeacherId) return;

    const teacherObj = teachers.find(t => t.id === emergencyTeacherId);
    if (!teacherObj) return;

    setSubmitting(true);
    try {
      // Find timetable slots for this teacher today
      const affectedTeacherSlots = timetable.filter(
        s => s.dayOfWeek === dayOfWeek && s.teacher.toLowerCase() === teacherObj.name.toLowerCase()
      );

      const slotsToSolve = affectedTeacherSlots.map(s => ({
        dayOfWeek,
        period: s.period,
        classRoom: s.classRoom,
        subject: s.subject,
        absentTeacherId: teacherObj.id,
        absentTeacherName: teacherObj.name,
        lessonPlanNotes: emergencyNotes.trim(),
      }));

      if (slotsToSolve.length > 0) {
        const { successAssignments } = runAutoAllocationPipeline({
          date: selectedDate,
          uncoveredSlots: slotsToSolve,
          allTeachers: teachers,
          timetable,
          allProxyAssignments: proxyAssignments,
          allLeaveRequests: leaveRequests,
          assignedBy: `${user?.name || 'Principal'} (Emergency Absence)`,
        });

        if (successAssignments.length > 0) {
          await databaseService.batchCreateProxyAssignments(successAssignments);
        }
      }

      setShowEmergencyModal(false);
      setEmergencyTeacherId('');
      setEmergencyNotes('');
    } catch (err) {
      console.error('Emergency absence failed:', err);
    } finally {
      setSubmitting(false);
    }
  }

  // Date stepper
  function stepDate(days: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
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
      {/* Header Banner */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
              color: '#fff',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Sparkles size={20} />
            </div>
            <h1 className="page-title">{t('proxyEngineTitle', language)}</h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {t('proxyEngineSubtitle', language)}
          </p>
        </div>

        {/* Date Selector and Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--card-bg, #1e293b)',
            borderRadius: '8px',
            padding: '4px',
            border: '1px solid var(--border-color, #334155)',
          }}>
            <button className="btn btn-ghost btn-sm" onClick={() => stepDate(-1)} title="Previous Day">
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main, #f8fafc)',
                fontWeight: 600,
                fontSize: '13px',
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => stepDate(1)} title="Next Day">
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
          >
            Today
          </button>

          {user?.role === 'principal' && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowEmergencyModal(true)}
              >
                <UserX size={15} />
                {t('quickAbsenceReport', language)}
              </button>

              {uncoveredSlots.length > 0 && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleAutoAllocateAll}
                  disabled={submitting}
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                  }}
                >
                  {submitting ? <span className="spinner" /> : <Sparkles size={15} />}
                  {t('autoAllocateAll', language)} ({uncoveredSlots.length})
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '20px' }}>
        <button
          className={`tab ${activeTab === 'hub' ? 'active' : ''}`}
          onClick={() => setActiveTab('hub')}
        >
          <Clock size={16} />
          {t('todayCoverage', language)}
          {uncoveredSlots.length > 0 && (
            <span style={{
              marginLeft: '6px',
              background: '#ef4444',
              color: '#fff',
              borderRadius: '10px',
              padding: '2px 7px',
              fontSize: '11px',
              fontWeight: 700,
            }}>
              {uncoveredSlots.length}
            </span>
          )}
        </button>

        <button
          className={`tab ${activeTab === 'myDuties' ? 'active' : ''}`}
          onClick={() => setActiveTab('myDuties')}
        >
          <UserCheck size={16} />
          {t('myProxyDuties', language)}
          {myDutiesToday.length > 0 && (
            <span style={{
              marginLeft: '6px',
              background: '#3b82f6',
              color: '#fff',
              borderRadius: '10px',
              padding: '2px 7px',
              fontSize: '11px',
              fontWeight: 700,
            }}>
              {myDutiesToday.length}
            </span>
          )}
        </button>

        {user?.role === 'principal' && (
          <button
            className={`tab ${activeTab === 'fairness' ? 'active' : ''}`}
            onClick={() => setActiveTab('fairness')}
          >
            <Award size={16} />
            {t('workloadAnalytics', language)}
          </button>
        )}
      </div>

      {/* ─── TAB 1: Hub & Daily Coverage ────────────────────────────────────── */}
      {activeTab === 'hub' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Key Metrics Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
          }}>
            {/* Metric 1: Coverage Rate */}
            <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: coveragePercent === 100 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: coveragePercent === 100 ? '#10b981' : '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {coveragePercent === 100 ? <CheckCircle2 size={26} /> : <AlertTriangle size={26} />}
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 800 }}>{coveragePercent}%</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('todayCoverage', language)}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {alreadyCoveredSlots.length}/{totalImpactedSlots} substitution slots filled
                </div>
              </div>
            </div>

            {/* Metric 2: Absent Teachers */}
            <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <UserX size={26} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 800 }}>{absentTeachersOnDate.length}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Absent Staff Today</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {absentTeachersOnDate.map(a => a.name).join(', ') || 'None reported'}
                </div>
              </div>
            </div>

            {/* Metric 3: Uncovered Periods */}
            <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: uncoveredSlots.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: uncoveredSlots.length > 0 ? '#ef4444' : '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Clock size={26} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 800 }}>{uncoveredSlots.length}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('uncoveredPeriods', language)}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {uncoveredSlots.length === 0 ? 'All scheduled classes active' : 'Action needed'}
                </div>
              </div>
            </div>

            {/* Metric 4: Total Routine Classes */}
            <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <BookOpen size={26} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 800 }}>{totalScheduledToday}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Classes Scheduled</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Day {dayOfWeek} Timetable Matrix
                </div>
              </div>
            </div>
          </div>

          {/* 1. Gaps / Uncovered Periods Section */}
          {uncoveredSlots.length > 0 && (
            <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.35)', background: 'var(--card-bg)' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '10px',
              }}>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} />
                    {t('uncoveredPeriods', language)} ({uncoveredSlots.length} Timetable Gaps)
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    The AI Engine has pre-evaluated free teachers with optimal subject affinity and workload equity.
                  </p>
                </div>

                {user?.role === 'principal' && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleAutoAllocateAll}
                    disabled={submitting}
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                      border: 'none',
                    }}
                  >
                    <Sparkles size={14} />
                    {t('autoAllocateAll', language)}
                  </button>
                )}
              </div>

              <div className="table-wrapper" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Class</th>
                      <th>Subject</th>
                      <th>{t('absentTeacher', language)}</th>
                      <th>AI Top Recommended Substitute</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uncoveredSlots.map((slot) => {
                      const candidates = rankProxyCandidates({
                        date: selectedDate,
                        dayOfWeek: slot.dayOfWeek,
                        period: slot.period,
                        classRoom: slot.classRoom,
                        originalSubject: slot.subject,
                        absentTeacherId: slot.absentTeacherId,
                        absentTeacherName: slot.absentTeacherName,
                        allTeachers: teachers,
                        timetable,
                        allProxyAssignments: proxyAssignments,
                        allLeaveRequests: leaveRequests,
                      });
                      const bestCandidate = candidates[0];

                      return (
                        <tr key={`uncovered_${slot.classRoom}_${slot.period}_${slot.absentTeacherId}`}>
                          <td>
                            <span className="badge badge-warning" style={{ fontWeight: 700 }}>
                              Period {slot.period}
                            </span>
                          </td>
                          <td><strong>{slot.classRoom}</strong></td>
                          <td>
                            <span className="badge badge-primary">{slot.subject}</span>
                            {slot.lessonPlanNotes && (
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '240px' }}>
                                📝 <em>"{slot.lessonPlanNotes}"</em>
                              </div>
                            )}
                          </td>
                          <td>
                            <span style={{ color: '#ef4444', fontWeight: 600 }}>
                              {slot.absentTeacherName}
                            </span>
                          </td>
                          <td>
                            {bestCandidate ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <strong style={{ color: '#10b981' }}>{bestCandidate.teacher.name}</strong>
                                  <span style={{
                                    background: 'rgba(16, 185, 129, 0.2)',
                                    color: '#10b981',
                                    borderRadius: '10px',
                                    padding: '1px 6px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                  }}>
                                    {bestCandidate.matchScore}% Match
                                  </span>
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {bestCandidate.matchReason}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                No free teachers available in this period
                              </span>
                            )}
                          </td>
                          <td>
                            {user?.role === 'principal' && bestCandidate && (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => handleAssignCandidate(
                                    slot,
                                    bestCandidate.teacher,
                                    bestCandidate.matchScore,
                                    bestCandidate.matchReason
                                  )}
                                  disabled={submitting}
                                >
                                  <CheckCircle2 size={13} />
                                  Assign Top
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setCandidateModalSlot(slot)}
                                  title="View and choose from all eligible candidates"
                                >
                                  <Filter size={13} />
                                  Candidates ({candidates.length})
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. Active Proxies / Covered Periods Table */}
          <div className="card">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '10px',
            }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCheck size={18} color="#10b981" />
                  {t('coveredPeriods', language)} on {selectedDate} ({alreadyCoveredSlots.length})
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Live proxy roster with instant WhatsApp alert dispatch and teacher acknowledgement status.
                </p>
              </div>
            </div>

            {alreadyCoveredSlots.length === 0 ? (
              <div className="empty-state">
                <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 12px' }} />
                <p>{uncoveredSlots.length === 0 ? t('allPeriodsCovered', language) : 'No substitutes assigned yet today. Click "AI Auto-Assign All" above.'}</p>
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: 'none' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Class</th>
                      <th>Subject</th>
                      <th>{t('substituteTeacher', language)}</th>
                      <th>{t('absentTeacher', language)}</th>
                      <th>{t('matchScore', language)}</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alreadyCoveredSlots.map((p) => {
                      const shareInfo = databaseService.generateProxyShareMessage(p);
                      return (
                        <tr key={p.id}>
                          <td>
                            <span className="badge badge-success" style={{ fontWeight: 700 }}>
                              Period {p.period}
                            </span>
                          </td>
                          <td><strong>{p.classRoom}</strong></td>
                          <td>
                            <span className="badge badge-primary">{p.originalSubject}</span>
                            {p.lessonPlanNotes && (
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '200px' }}>
                                📝 <em>"{p.lessonPlanNotes}"</em>
                              </div>
                            )}
                          </td>
                          <td>
                            <div>
                              <strong>{p.substituteTeacherName}</strong>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {p.substituteTeacherSubject}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              {p.originalTeacherName}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                background: 'rgba(99, 102, 241, 0.15)',
                                color: '#6366f1',
                                borderRadius: '10px',
                                padding: '2px 8px',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}>
                                {p.matchScore}%
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {p.matchReason.split('•')[0]}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${p.status === 'acknowledged' ? 'badge-success' : 'badge-warning'}`}>
                              {p.status === 'acknowledged' ? t('acknowledged', language) : 'Assigned (Pending)'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              {/* WhatsApp Direct Dispatch Link */}
                              <a
                                href={shareInfo.whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ color: '#25D366' }}
                                title="Send Instant WhatsApp Notice"
                              >
                                <Send size={13} />
                                Notify
                              </a>

                              {/* Unassign Button for Principal */}
                              {user?.role === 'principal' && (
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => databaseService.deleteProxyAssignment(p.id)}
                                  title="Unassign Substitute"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
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

      {/* ─── TAB 2: Teacher Personal View ("My Proxy Duties") ──────────────── */}
      {activeTab === 'myDuties' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              {t('myProxyDuties', language)}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              {t('myProxyDutiesDesc', language)}
            </p>

            {myDuties.length === 0 ? (
              <div className="empty-state">
                <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 12px' }} />
                <p>You have no substitute duties assigned.</p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px',
              }}>
                {myDuties.map((duty) => {
                  const isToday = duty.date === new Date().toISOString().slice(0, 10);
                  return (
                    <div
                      key={duty.id}
                      style={{
                        background: isToday ? 'rgba(99, 102, 241, 0.08)' : 'var(--card-bg)',
                        border: isToday ? '1px solid #6366f1' : '1px solid var(--border-color, #334155)',
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="badge badge-primary" style={{ fontSize: '12px', fontWeight: 700 }}>
                          Class {duty.classRoom} • Period {duty.period}
                        </span>
                        <span className={`badge ${duty.status === 'acknowledged' ? 'badge-success' : 'badge-warning'}`}>
                          {duty.status === 'acknowledged' ? t('acknowledged', language) : 'Action Required'}
                        </span>
                      </div>

                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700 }}>
                          {duty.originalSubject} (Covering for {duty.originalTeacherName})
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} /> Date: {duty.date} {isToday && '— (TODAY)'}
                        </div>
                      </div>

                      {duty.lessonPlanNotes && (
                        <div style={{
                          background: 'var(--bg-hover, rgba(255,255,255,0.04))',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          borderLeft: '3px solid #6366f1',
                          fontSize: '12px',
                        }}>
                          <strong style={{ color: '#818cf8', display: 'block', marginBottom: '2px' }}>
                            📝 Lesson Instructions:
                          </strong>
                          {duty.lessonPlanNotes}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Match Score: {duty.matchScore}%
                        </div>
                        {duty.status !== 'acknowledged' && (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={async () => {
                              await databaseService.updateProxyAssignmentStatus(duty.id, 'acknowledged');
                            }}
                          >
                            <CheckCircle2 size={14} />
                            {t('acknowledgeDuty', language)}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: Workload & Fairness Analytics (Principal Only) ─────────── */}
      {activeTab === 'fairness' && user?.role === 'principal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
              {t('workloadAnalytics', language)}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              The AI Engine automatically distributes substitute periods evenly across all staff members to prevent burnout.
            </p>

            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Teacher</th>
                    <th>Subject Specialty</th>
                    <th>Homeroom Class</th>
                    <th>Proxies This Week</th>
                    <th>Total Proxies (Term)</th>
                    <th>Workload Fairness Level</th>
                  </tr>
                </thead>
                <tbody>
                  {workloadData.map(({ teacher, totalProxies, thisWeekProxies }) => {
                    const fairnessRating = thisWeekProxies === 0 ? 'Optimal (Free)' : thisWeekProxies <= 2 ? 'Balanced' : 'High Load';
                    const badgeClass = thisWeekProxies === 0 ? 'badge-success' : thisWeekProxies <= 2 ? 'badge-primary' : 'badge-warning';

                    return (
                      <tr key={teacher.id}>
                        <td><strong>{teacher.name}</strong></td>
                        <td><span className="badge badge-secondary">{teacher.subject || 'General'}</span></td>
                        <td>{teacher.classRoom || '—'}</td>
                        <td><strong>{thisWeekProxies}</strong></td>
                        <td>{totalProxies}</td>
                        <td>
                          <span className={`badge ${badgeClass}`}>
                            {fairnessRating}
                          </span>
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

      {/* ─── MODAL 1: Emergency Morning Absence Reporter ────────────────────── */}
      {showEmergencyModal && (
        <div className="modal-overlay" onClick={() => setShowEmergencyModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserX size={20} color="#ef4444" />
              {t('quickAbsenceReport', language)}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Quickly record an absent teacher for today ({selectedDate}) and let the AI instantly scan and substitute all their periods.
            </p>

            <form onSubmit={handleEmergencyAbsenceSubmit}>
              <div className="form-group">
                <label className="form-label">{t('absentTeacher', language)}</label>
                <select
                  className="form-control"
                  value={emergencyTeacherId}
                  onChange={e => setEmergencyTeacherId(e.target.value)}
                  required
                >
                  <option value="">-- Select Absent Teacher --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subject})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t('lessonPlanNotes', language)}</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={emergencyNotes}
                  onChange={e => setEmergencyNotes(e.target.value)}
                  placeholder={t('lessonPlanNotesPlaceholder', language)}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEmergencyModal(false)}
                >
                  {t('cancel', language)}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !emergencyTeacherId}
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    border: 'none',
                  }}
                >
                  {submitting ? <span className="spinner" /> : <Sparkles size={15} />}
                  Scan & Auto-Substitute Today
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: Interactive Candidate Selector Modal ──────────────────── */}
      {candidateModalSlot && (
        <div className="modal-overlay" onClick={() => setCandidateModalSlot(null)}>
          <div className="modal" style={{ maxWidth: '650px' }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={18} />
              {t('candidateSelector', language)}
            </h2>
            <div style={{
              background: 'var(--bg-hover, rgba(255,255,255,0.05))',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
            }}>
              <strong>Target Class:</strong> {candidateModalSlot.classRoom} • <strong>Period:</strong> {candidateModalSlot.period} • <strong>Subject:</strong> {candidateModalSlot.subject} • <strong>Covering:</strong> {candidateModalSlot.absentTeacherName}
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rankProxyCandidates({
                date: selectedDate,
                dayOfWeek: candidateModalSlot.dayOfWeek,
                period: candidateModalSlot.period,
                classRoom: candidateModalSlot.classRoom,
                originalSubject: candidateModalSlot.subject,
                absentTeacherId: candidateModalSlot.absentTeacherId,
                absentTeacherName: candidateModalSlot.absentTeacherName,
                allTeachers: teachers,
                timetable,
                allProxyAssignments: proxyAssignments,
                allLeaveRequests: leaveRequests,
              }).map((candidate, idx) => (
                <div
                  key={candidate.teacher.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: idx === 0 ? '1px solid #10b981' : '1px solid var(--border-color, #334155)',
                    background: idx === 0 ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong>{candidate.teacher.name}</strong>
                      <span className="badge badge-secondary">{candidate.teacher.subject}</span>
                      {idx === 0 && <span className="badge badge-success">AI Recommended #1</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {candidate.matchReason}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontWeight: 700, color: '#6366f1', fontSize: '14px' }}>
                      {candidate.matchScore}%
                    </span>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAssignCandidate(
                        candidateModalSlot,
                        candidate.teacher,
                        candidate.matchScore,
                        candidate.matchReason
                      )}
                      disabled={submitting}
                    >
                      <Plus size={13} />
                      Assign
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-footer" style={{ marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCandidateModalSlot(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
