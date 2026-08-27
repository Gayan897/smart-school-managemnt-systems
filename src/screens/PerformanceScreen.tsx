import { useEffect, useState, useMemo } from 'react';
import { Save, Eye, Trophy, Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import type { Student, SchoolClass, TermMark } from '../data/models';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { db } from '../data/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import StudentProfileModal from '../components/StudentProfileModal';

const SUBJECTS = ['Maths', 'Science', 'English', 'Sinhala', 'History', 'Geography', 'ICT', 'Art'];
const TERMS = [1, 2, 3];

export default function PerformanceScreen() {
  const { user, language } = useAuth();
  const isPrincipal = user?.role === 'principal';

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<TermMark[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);
  const [markInput, setMarkInput] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'enter' | 'chart'>('enter');
  const [selectedProfileStudentId, setSelectedProfileStudentId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      databaseService.getClasses(),
      databaseService.getTermMarks(),
      databaseService.getStudents(),
    ]).then(([cls, m, stu]) => {
      setClasses(cls);
      setMarks(m);
      setAllStudents(stu);
      if (cls.length > 0) setSelectedClass(cls[0].id);
    }).finally(() => setLoading(false));
  }, []);

  // Filter students for teacher mode
  useEffect(() => {
    if (isPrincipal || !selectedClass) return;
    const filtered = allStudents.filter(s => s.classRoom === selectedClass);
    setStudents(filtered);
    const init: Record<string, string> = {};
    filtered.forEach(s => {
      const existing = marks.find(
        m => m.studentId === s.id && m.subject === selectedSubject && m.term === selectedTerm
      );
      init[s.id] = existing ? String(existing.marks) : '';
    });
    setMarkInput(init);
  }, [selectedClass, selectedSubject, selectedTerm, marks, allStudents, isPrincipal]);

  // Unique grades for principal filter
  const availableGrades = useMemo(() => {
    const grades = [...new Set(classes.map(c => c.grade))].sort((a, b) => a - b);
    return grades;
  }, [classes]);

  // Classes filtered by selected grade (for principal)
  const filteredClasses = useMemo(() => {
    if (selectedGrade === 'all') return classes;
    return classes.filter(c => c.grade.toString() === selectedGrade);
  }, [classes, selectedGrade]);

  async function handleSave() {
    if (isPrincipal) return;
    setSaving(true);
    const toSave: TermMark[] = students
      .filter(s => markInput[s.id] !== '' && markInput[s.id] !== undefined)
      .map(s => ({
        studentId: s.id,
        subject: selectedSubject,
        term: selectedTerm,
        marks: parseFloat(markInput[s.id]) || 0,
        maxMarks: 100,
      }));

    const col = collection(db, 'term_marks');
    await Promise.all(toSave.map(m => {
      const id = `${m.studentId}_${m.subject}_${m.term}`;
      return setDoc(doc(col, id), m);
    }));

    const updatedMarks = await databaseService.getTermMarks();
    setMarks(updatedMarks);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  }

  // ─── Principal: Class-wise Performance Aggregations ───
  const classWisePerformance = useMemo(() => {
    if (!isPrincipal) return [];

    return filteredClasses.map(cls => {
      const classStudents = allStudents.filter(s => s.classRoom === cls.id);
      const studentIds = new Set(classStudents.map(s => s.id));

      const classMarks = marks.filter(
        m => studentIds.has(m.studentId) && m.subject === selectedSubject && m.term === selectedTerm
      );

      const totalStudents = classStudents.length;
      const countWithMarks = classMarks.length;
      const totalMarks = classMarks.reduce((acc, curr) => acc + curr.marks, 0);
      const avgMarks = countWithMarks > 0 ? Math.round(totalMarks / countWithMarks) : 0;
      const passedCount = classMarks.filter(m => m.marks >= 35).length;
      const passRate = countWithMarks > 0 ? Math.round((passedCount / countWithMarks) * 100) : 0;

      // Find highest mark in class
      let highestMark = 0;
      let topStudentName = '—';
      if (classMarks.length > 0) {
        const sorted = [...classMarks].sort((a, b) => b.marks - a.marks);
        highestMark = sorted[0].marks;
        const topStu = classStudents.find(s => s.id === sorted[0].studentId);
        if (topStu) topStudentName = topStu.name;
      }

      return {
        classId: cls.id,
        grade: cls.grade,
        section: cls.section,
        stream: cls.stream,
        totalStudents,
        countWithMarks,
        avgMarks,
        passRate,
        highestMark,
        topStudentName,
      };
    });
  }, [isPrincipal, filteredClasses, allStudents, marks, selectedSubject, selectedTerm]);

  // ─── Principal: Best Performers Across Filtered Classes ───
  const bestPerformers = useMemo(() => {
    if (!isPrincipal) return [];

    const relevantClassIds = new Set(filteredClasses.map(c => c.id));
    const relevantStudents = allStudents.filter(s => relevantClassIds.has(s.classRoom));
    const relevantStudentIds = new Set(relevantStudents.map(s => s.id));

    const relevantMarks = marks.filter(
      m => relevantStudentIds.has(m.studentId) && m.subject === selectedSubject && m.term === selectedTerm
    );

    const sortedMarks = [...relevantMarks].sort((a, b) => b.marks - a.marks);

    // Get top 5 performing entries
    return sortedMarks.slice(0, 5).map(m => {
      const student = relevantStudents.find(s => s.id === m.studentId);
      return {
        studentId: m.studentId,
        name: student?.name ?? 'Unknown Student',
        classRoom: student?.classRoom ?? 'N/A',
        marks: m.marks,
      };
    });
  }, [isPrincipal, filteredClasses, allStudents, marks, selectedSubject, selectedTerm]);

  // Chart data
  const chartData = isPrincipal
    ? classWisePerformance.map(cp => ({
        name: `${cp.classId}`,
        marks: cp.avgMarks,
      }))
    : students.map(s => {
        const m = marks.find(
          mk => mk.studentId === s.id && mk.subject === selectedSubject && mk.term === selectedTerm
        );
        return { name: s.name.split(' ')[0], marks: m?.marks ?? 0 };
      });

  const COLORS = ['#0284c7', '#0d9488', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // PRINCIPAL VIEW — Class-wise summary, top performers, no student table
  // ═══════════════════════════════════════════════════════════════════
  if (isPrincipal) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('performance', language)}</h1>
            <p className="page-subtitle">{t('viewPerformance', language)}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
            <Eye size={16} />
            <span>{t('viewPerformance', language)}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t('selectGrade', language)}</label>
              <select
                id="perf-grade-select"
                className="form-control"
                value={selectedGrade}
                onChange={e => setSelectedGrade(e.target.value)}
              >
                <option value="all">{t('allGrades', language)}</option>
                {availableGrades.map(g => (
                  <option key={g} value={g.toString()}>
                    {t('grade', language)} {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t('term', language)}</label>
              <select
                className="form-control"
                value={selectedTerm}
                onChange={e => setSelectedTerm(Number(e.target.value))}
              >
                {TERMS.map(tm => <option key={tm} value={tm}>{t('term', language)} {tm}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t('subject', language)}</label>
              <select
                className="form-control"
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
              >
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab ${activeTab === 'enter' ? 'active' : ''}`} onClick={() => setActiveTab('enter')}>
            {t('classWisePerformance', language)}
          </button>
          <button className={`tab ${activeTab === 'chart' ? 'active' : ''}`} onClick={() => setActiveTab('chart')}>
            Chart View
          </button>
        </div>

        {activeTab === 'enter' ? (
          <>
            {/* Top Performers Highlight Section */}
            {bestPerformers.length > 0 && (
              <div className="card" style={{ marginBottom: '20px', background: 'linear-gradient(135deg, rgba(2,132,199,0.08) 0%, rgba(13,148,136,0.08) 100%)', border: '1px solid rgba(2,132,199,0.25)' }}>
                <div className="card-header" style={{ marginBottom: '12px' }}>
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-light)' }}>
                    <Trophy size={20} style={{ color: '#f59e0b' }} />
                    {t('bestPerformers', language)} — {selectedSubject} ({t('term', language)} {selectedTerm})
                  </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {bestPerformers.map((bp, idx) => {
                    const gradeChar = bp.marks >= 75 ? 'A' : bp.marks >= 65 ? 'B' : bp.marks >= 55 ? 'C' : bp.marks >= 35 ? 'S' : 'F';
                    return (
                      <div
                        key={bp.studentId}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                      >
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: idx === 0 ? 'rgba(245,158,11,0.2)' : idx === 1 ? 'rgba(156,163,175,0.2)' : 'rgba(180,83,9,0.2)',
                          color: idx === 0 ? '#f59e0b' : idx === 1 ? '#9ca3af' : '#b45309',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '14px'
                        }}>
                          #{idx + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {bp.name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {t('class', language)}: <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{bp.classRoom}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--success)' }}>
                            {bp.marks}
                          </div>
                          <span className="badge badge-success" style={{ fontSize: '10px' }}>
                            {gradeChar}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Class-wise Performance Summary Table */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{t('classWisePerformance', language)}</h3>
              </div>
              {classWisePerformance.length === 0 ? (
                <div className="empty-state"><p>{t('noData', language)}</p></div>
              ) : (
                <div className="table-wrapper" style={{ border: 'none' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('class', language)}</th>
                        <th>{t('stream', language)}</th>
                        <th style={{ textAlign: 'center' }}>{t('totalStudents', language)}</th>
                        <th style={{ textAlign: 'center' }}>{t('averageMarks', language)}</th>
                        <th style={{ textAlign: 'center' }}>{t('passRate', language)}</th>
                        <th style={{ textAlign: 'center' }}>{t('highestMark', language)}</th>
                        <th>{t('topPerformer', language)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classWisePerformance.map(row => (
                        <tr key={row.classId}>
                          <td style={{ fontWeight: 600, fontSize: '15px' }}>
                            {t('grade', language)} {row.grade}{row.section}
                          </td>
                          <td>
                            <span className="badge badge-primary">
                              {row.stream === 'ol' ? t('olStream', language) : t('alStream', language)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 500 }}>{row.totalStudents}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, color: row.avgMarks >= 70 ? 'var(--success)' : row.avgMarks >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                              {row.countWithMarks > 0 ? `${row.avgMarks} / 100` : '—'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {row.countWithMarks > 0 ? (
                              <span className={`badge ${row.passRate >= 75 ? 'badge-success' : row.passRate >= 50 ? 'badge-warning' : 'badge-danger'}`} style={{ fontWeight: 700 }}>
                                {row.passRate}%
                              </span>
                            ) : (
                              <span className="badge badge-muted">—</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary-light)' }}>
                            {row.highestMark > 0 ? row.highestMark : '—'}
                          </td>
                          <td>
                            {row.topStudentName !== '—' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Award size={14} style={{ color: '#f59e0b' }} />
                                <span style={{ fontWeight: 500 }}>{row.topStudentName}</span>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="card">
            {chartData.length === 0 ? (
              <div className="empty-state"><p>{t('noData', language)}</p></div>
            ) : (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                    />
                    <Bar dataKey="marks" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // TEACHER VIEW — Editable Mark Entry per Student
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('performance', language)}</h1>
          <p className="page-subtitle">{t('enterMarks', language)}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || students.length === 0 || activeTab !== 'enter'}
        >
          {saving ? <span className="spinner" /> : <Save size={15} />}
          {saved ? '✓ Saved!' : t('saveMarks', language)}
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('class', language)}</label>
            <select className="form-control" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              {classes.map(c => (
                <option key={c.id} value={c.id}>Grade {c.grade}{c.section}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('term', language)}</label>
            <select className="form-control" value={selectedTerm} onChange={e => setSelectedTerm(Number(e.target.value))}>
              {TERMS.map(tm => <option key={tm} value={tm}>{t('term', language)} {tm}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('subject', language)}</label>
            <select className="form-control" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'enter' ? 'active' : ''}`} onClick={() => setActiveTab('enter')}>
          {t('enterMarks', language)}
        </button>
        <button className={`tab ${activeTab === 'chart' ? 'active' : ''}`} onClick={() => setActiveTab('chart')}>
          Chart View
        </button>
      </div>

      {activeTab === 'enter' ? (
        <div className="card">
          {students.length === 0 ? (
            <div className="empty-state"><p>{t('noStudents', language)}</p></div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('student', language)}</th>
                    <th>{t('marks', language)} / 100</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const val = parseFloat(markInput[s.id] || '0') || 0;
                    const grade = val >= 75 ? 'A' : val >= 65 ? 'B' : val >= 55 ? 'C' : val >= 35 ? 'S' : 'F';
                    const gradeColor = grade === 'A' ? 'var(--success)' : grade === 'B' ? 'var(--primary-light)' : grade === 'C' ? 'var(--info)' : grade === 'S' ? 'var(--warning)' : 'var(--danger)';
                    return (
                      <tr key={s.id}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td>
                          <button
                            type="button"
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              textAlign: 'left',
                              cursor: 'pointer',
                              color: 'inherit',
                            }}
                            onClick={() => setSelectedProfileStudentId(s.id)}
                            title="Click to view full student profile"
                          >
                            <div style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                              {s.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.id}</div>
                          </button>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="form-control"
                            style={{ width: '100px' }}
                            value={markInput[s.id] ?? ''}
                            onChange={e => setMarkInput(prev => ({ ...prev, [s.id]: e.target.value }))}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          {markInput[s.id] ? (
                            <span className="badge" style={{ background: `${gradeColor}22`, color: gradeColor, borderColor: `${gradeColor}44` }}>
                              {grade}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          {chartData.length === 0 ? (
            <div className="empty-state"><p>{t('noData', language)}</p></div>
          ) : (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Bar dataKey="marks" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Student Profile Modal */}
      {selectedProfileStudentId && (
        <StudentProfileModal
          studentId={selectedProfileStudentId}
          onClose={() => setSelectedProfileStudentId(null)}
        />
      )}
    </div>
  );
}
