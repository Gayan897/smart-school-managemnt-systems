import { useEffect, useState, useMemo } from 'react';
import {
  Save, Eye, Trophy, Award, GraduationCap, Sparkles, Check, BookOpen,
  UserCheck, Layers, FileSpreadsheet, BarChart2, RefreshCw, AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import type { Student, SchoolClass, TermMark } from '../data/models';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import StudentProfileModal from '../components/StudentProfileModal';

export interface SubjectOption {
  id: string;
  nameEn: string;
  category: 'core' | 'elective' | 'al';
}

export const SRI_LANKA_SUBJECTS: SubjectOption[] = [
  // 6 Core O/L Compulsory Subjects
  { id: 'Mathematics', nameEn: 'Mathematics', category: 'core' },
  { id: 'Science', nameEn: 'Science', category: 'core' },
  { id: 'Sinhala', nameEn: 'Sinhala (Mother Tongue)', category: 'core' },
  { id: 'English', nameEn: 'English Language', category: 'core' },
  { id: 'History', nameEn: 'History', category: 'core' },
  { id: 'Buddhism', nameEn: 'Buddhism / Religion', category: 'core' },

  // Elective & Basket Subjects (O/L Category Subjects)
  { id: 'ICT', nameEn: 'ICT (Information & Comm. Tech)', category: 'elective' },
  { id: 'English Literature', nameEn: 'English Literature', category: 'elective' },
  { id: 'Civics', nameEn: 'Civics & Citizenship Education', category: 'elective' },
  { id: 'Commerce', nameEn: 'Business & Accounting Studies (Commerce)', category: 'elective' },
  { id: 'Geography', nameEn: 'Geography', category: 'elective' },
  { id: 'Art', nameEn: 'Art', category: 'elective' },
  { id: 'Music', nameEn: 'Music (Eastern / Western)', category: 'elective' },
  { id: 'Drama', nameEn: 'Drama & Theatre', category: 'elective' },
  { id: 'Health', nameEn: 'Health & Physical Education', category: 'elective' },
  { id: 'Agriculture', nameEn: 'Agriculture & Food Technology', category: 'elective' },
  { id: 'Design Tech', nameEn: 'Design & Technology', category: 'elective' },
  { id: 'Home Economics', nameEn: 'Home Economics', category: 'elective' },

  // A/L Stream Subjects
  { id: 'Combined Maths', nameEn: 'Combined Mathematics (A/L)', category: 'al' },
  { id: 'Physics', nameEn: 'Physics (A/L)', category: 'al' },
  { id: 'Chemistry', nameEn: 'Chemistry (A/L)', category: 'al' },
  { id: 'Biology', nameEn: 'Biology (A/L)', category: 'al' },
  { id: 'Economics', nameEn: 'Economics (A/L)', category: 'al' },
  { id: 'Accounting', nameEn: 'Accounting (A/L)', category: 'al' },
  { id: 'Business Studies', nameEn: 'Business Studies (A/L)', category: 'al' },
  { id: 'Engineering Tech', nameEn: 'Engineering Technology (A/L)', category: 'al' },
  { id: 'Science for Tech', nameEn: 'Science for Technology (A/L)', category: 'al' },
];

const TERMS = [1, 2, 3];

export default function PerformanceScreen() {
  const { user, language } = useAuth();
  const isPrincipal = user?.role === 'principal' || user?.role === 'zonal_admin';

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<TermMark[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [selectedSubject, setSelectedSubject] = useState('Mathematics');

  // Teacher Mark Entry State (Subject-Wise)
  const [markInput, setMarkInput] = useState<Record<string, string>>({});

  // Teacher Mark Entry State (Student-Wise)
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentMarksheetInput, setStudentMarksheetInput] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  // Mode: 'by_subject' | 'by_student' | 'class_overview' | 'chart'
  const [activeTab, setActiveTab] = useState<'by_subject' | 'by_student' | 'class_overview' | 'chart'>('by_subject');
  const [selectedProfileStudentId, setSelectedProfileStudentId] = useState<string | null>(null);

  // Real-time synchronization of Classes, Students, and Marks
  useEffect(() => {
    Promise.all([
      databaseService.getClasses(),
      databaseService.getTeachers(),
    ]).then(([cls, tc]) => {
      setClasses(cls);

      if (!isPrincipal && cls.length > 0) {
        const teacherObj = tc?.find(t => t.id === user?.id || (user?.name && t.name.toLowerCase() === user.name.toLowerCase()));
        const assigned = cls.find(c =>
          (user?.id && c.homeroomTeacherId === user.id) ||
          (user?.name && c.homeroomTeacherName?.toLowerCase() === user.name.toLowerCase()) ||
          (teacherObj?.classRoom && teacherObj.classRoom !== 'Not assigned' && c.id === teacherObj.classRoom) ||
          (user?.classRoom && c.id === user.classRoom)
        );
        setSelectedClass(assigned ? assigned.id : cls[0].id);
      } else if (isPrincipal && cls.length > 0) {
        setSelectedClass(cls[0].id);
      }
    }).catch(err => console.error('Failed to load classes:', err));

    // Real-time students listener
    const unsubStudents = databaseService.subscribeToStudents((stu) => {
      setAllStudents(stu);
      setLoading(false);
    });

    // Real-time term marks listener
    const unsubMarks = databaseService.subscribeToTermMarks((m) => {
      setMarks(m);
    });

    return () => {
      unsubStudents();
      unsubMarks();
    };
  }, [isPrincipal, user]);

  // Current selected class object
  const currentClassObj = useMemo(() => {
    return classes.find(c => c.id === selectedClass);
  }, [classes, selectedClass]);

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

  // Filter students for the current selected class (Teacher: strictly their own class)
  useEffect(() => {
    if (!selectedClass) return;
    const filtered = allStudents.filter(s => s.classRoom === selectedClass);
    setStudents(filtered);

    // If selectedStudentId is not set or not in this class, default to first student
    if (filtered.length > 0) {
      if (!selectedStudentId || !filtered.some(s => s.id === selectedStudentId)) {
        setSelectedStudentId(filtered[0].id);
      }
    } else {
      setSelectedStudentId('');
    }

    // Pre-fill Subject-wise mark inputs
    const init: Record<string, string> = {};
    filtered.forEach(s => {
      const existing = marks.find(
        m => m.studentId === s.id && m.subject === selectedSubject && m.term === selectedTerm
      );
      init[s.id] = existing ? String(existing.marks) : '';
    });
    setMarkInput(init);
  }, [selectedClass, selectedSubject, selectedTerm, marks, allStudents]);

  // Pre-fill Student-wise marksheet inputs whenever selected student or term changes
  useEffect(() => {
    if (!selectedStudentId) {
      setStudentMarksheetInput({});
      return;
    }
    const stuMarks = marks.filter(m => m.studentId === selectedStudentId && m.term === selectedTerm);
    const marksheet: Record<string, string> = {};
    SRI_LANKA_SUBJECTS.forEach(sub => {
      const existing = stuMarks.find(m => m.subject === sub.id);
      marksheet[sub.id] = existing ? String(existing.marks) : '';
    });
    setStudentMarksheetInput(marksheet);
  }, [selectedStudentId, selectedTerm, marks]);

  // Save Subject-Wise Marks (For all students in class)
  async function handleSaveSubjectMarks() {
    if (isPrincipal) return;
    setSaving(true);
    try {
      const toSave: TermMark[] = students
        .filter(s => markInput[s.id] !== '' && markInput[s.id] !== undefined)
        .map(s => ({
          studentId: s.id,
          subject: selectedSubject,
          term: selectedTerm,
          marks: Math.min(100, Math.max(0, parseFloat(markInput[s.id]) || 0)),
          maxMarks: 100,
        }));

      await databaseService.saveTermMarksBatch(toSave);
      setSaved(true);
      setSuccessMsg(`✅ Marks saved successfully for ${selectedSubject} (Term ${selectedTerm})!`);
      setTimeout(() => { setSaved(false); setSuccessMsg(''); }, 3000);
    } catch (err) {
      console.error('Failed to save subject marks:', err);
    } finally {
      setSaving(false);
    }
  }

  // Save Student-Wise Marksheet (For all subjects of one student)
  async function handleSaveStudentMarksheet() {
    if (isPrincipal || !selectedStudentId) return;
    setSaving(true);
    try {
      const currentStu = students.find(s => s.id === selectedStudentId);
      const toSave: TermMark[] = Object.entries(studentMarksheetInput)
        .filter(([_, val]) => val !== '' && val !== undefined)
        .map(([subjId, val]) => ({
          studentId: selectedStudentId,
          subject: subjId,
          term: selectedTerm,
          marks: Math.min(100, Math.max(0, parseFloat(val) || 0)),
          maxMarks: 100,
        }));

      await databaseService.saveTermMarksBatch(toSave);
      setSaved(true);
      setSuccessMsg(`✅ Term ${selectedTerm} Marksheet saved for ${currentStu?.name || selectedStudentId}!`);
      setTimeout(() => { setSaved(false); setSuccessMsg(''); }, 3000);
    } catch (err) {
      console.error('Failed to save student marksheet:', err);
    } finally {
      setSaving(false);
    }
  }

  // Active student object for student-wise entry
  const currentStudentObj = useMemo(() => {
    return students.find(s => s.id === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  // Calculate live statistics for student-wise entry
  const studentMarksheetStats = useMemo(() => {
    const entered = Object.entries(studentMarksheetInput)
      .filter(([_, val]) => val !== '' && val !== undefined && !isNaN(parseFloat(val)))
      .map(([_, val]) => parseFloat(val));

    const total = entered.reduce((sum, v) => sum + v, 0);
    const count = entered.length;
    const avg = count > 0 ? Math.round((total / count) * 10) / 10 : 0;
    const grade = avg >= 75 ? 'A' : avg >= 65 ? 'B' : avg >= 55 ? 'C' : avg >= 35 ? 'S' : count > 0 ? 'F' : '—';
    return { total, count, avg, grade };
  }, [studentMarksheetInput]);

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

  const COLORS = ['#0284c7', '#0d9488', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899'];

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // PRINCIPAL VIEW — Class-wise summary, top performers
  // ═══════════════════════════════════════════════════════════════════
  if (isPrincipal) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('performance', language)}</h1>
            <p className="page-subtitle">{t('viewPerformance', language)}</p>
          </div>
        </div>

        {/* Principal Filters: Grade + Term */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t('selectGrade', language)}</label>
              <select className="form-control" value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}>
                <option value="all">{t('allGrades', language)}</option>
                {availableGrades.map(g => (
                  <option key={g} value={g.toString()}>{t('grade', language)} {g}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t('term', language)}</label>
              <select className="form-control" value={selectedTerm} onChange={e => setSelectedTerm(Number(e.target.value))}>
                {TERMS.map(tm => <option key={tm} value={tm}>{t('term', language)} {tm}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Class-wise Performance Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t('classWisePerformance', language)} ({selectedSubject} - Term {selectedTerm})</h3>
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
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // TEACHER VIEW — Scoped exclusively to Assigned Homeroom Class
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('performance', language)}</h1>
          <p className="page-subtitle">
            Class Examination Mark Entry & Performance Tracking
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'by_subject' && (
            <button
              className="btn btn-primary"
              onClick={handleSaveSubjectMarks}
              disabled={saving || students.length === 0}
            >
              {saving ? <span className="spinner" /> : <Save size={15} />}
              {saved ? '✓ Saved!' : 'Save Subject Marks'}
            </button>
          )}
          {activeTab === 'by_student' && (
            <button
              className="btn btn-primary"
              onClick={handleSaveStudentMarksheet}
              disabled={saving || !selectedStudentId}
            >
              {saving ? <span className="spinner" /> : <Save size={15} />}
              {saved ? '✓ Saved!' : 'Save Student Marksheet'}
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1.5px solid rgba(16, 185, 129, 0.4)',
          color: '#10b981',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 600,
          fontSize: '13px'
        }}>
          <Sparkles size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Teacher's Locked Assigned Class Banner & Term Selector */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', alignItems: 'center' }}>
          {/* Assigned Class Banner (Teacher is scoped ONLY to their class) */}
          <div>
            <label className="form-label" style={{ marginBottom: '8px' }}>{t('assignedClass', language)}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', minHeight: '44px' }}>
              <GraduationCap size={20} style={{ color: 'var(--primary-color)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                  {currentClassObj ? `${t('grade', language)} ${currentClassObj.grade}${currentClassObj.section}` : (selectedClass || 'My Class')}
                </span>
                {currentClassObj && (
                  <span className="badge badge-primary" style={{ fontSize: '11px', padding: '2px 8px' }}>
                    {currentClassObj.stream === 'ol' ? t('olStream', language) : t('alStream', language)}
                  </span>
                )}
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {students.length} Student{students.length !== 1 ? 's' : ''} in Roster
                </span>
              </div>
            </div>
          </div>

          {/* Term Selector */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ marginBottom: '8px' }}>Academic Term</label>
            <select
              className="form-control"
              value={selectedTerm}
              onChange={e => setSelectedTerm(Number(e.target.value))}
              style={{ minHeight: '44px', fontWeight: 600 }}
            >
              {TERMS.map(tm => (
                <option key={tm} value={tm}>Term {tm} Examination</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs for Mark Entry Modes */}
      <div className="tabs" style={{ marginBottom: '18px' }}>
        <button
          className={`tab ${activeTab === 'by_subject' ? 'active' : ''}`}
          onClick={() => setActiveTab('by_subject')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <BookOpen size={15} /> Enter Marks By Subject
        </button>
        <button
          className={`tab ${activeTab === 'by_student' ? 'active' : ''}`}
          onClick={() => setActiveTab('by_student')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <UserCheck size={15} /> Enter Marks By Student
        </button>
        <button
          className={`tab ${activeTab === 'class_overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('class_overview')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <FileSpreadsheet size={15} /> Class Performance Marksheet
        </button>
        <button
          className={`tab ${activeTab === 'chart' ? 'active' : ''}`}
          onClick={() => setActiveTab('chart')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <BarChart2 size={15} /> Performance Radar Chart
        </button>
      </div>

      {/* ─── TAB 1: SUBJECT-WISE MARK ENTRY ─── */}
      {activeTab === 'by_subject' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ minWidth: '280px', flex: 1 }}>
              <label className="form-label" style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '6px' }}>
                Select Subject for Mark Entry
              </label>
              <select
                className="form-control"
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
                style={{ fontWeight: 600, fontSize: '14px' }}
              >
                <optgroup label="Core O/L Compulsory Subjects (6 Mains)">
                  {SRI_LANKA_SUBJECTS.filter(s => s.category === 'core').map(s => (
                    <option key={s.id} value={s.id}>📘 {s.nameEn}</option>
                  ))}
                </optgroup>
                <optgroup label="Elective & Category Subjects (ICT, Lit, Civics, Commerce, etc.)">
                  {SRI_LANKA_SUBJECTS.filter(s => s.category === 'elective').map(s => (
                    <option key={s.id} value={s.id}>📙 {s.nameEn}</option>
                  ))}
                </optgroup>
                <optgroup label="Advanced Level (A/L) Stream Subjects">
                  {SRI_LANKA_SUBJECTS.filter(s => s.category === 'al').map(s => (
                    <option key={s.id} value={s.id}>🎓 {s.nameEn}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="badge badge-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                Term {selectedTerm} Examination
              </span>
              <span className="badge badge-muted" style={{ padding: '6px 12px', fontSize: '12px' }}>
                Class {selectedClass}
              </span>
            </div>
          </div>

          {students.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>{t('noStudents', language)}. Add students from the Attendance page to start entering marks.</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('student', language)}</th>
                    <th>Admission #</th>
                    <th style={{ width: '150px' }}>Marks (0 - 100)</th>
                    <th style={{ textAlign: 'center', width: '90px' }}>Grade</th>
                    <th style={{ textAlign: 'center' }}>Quick Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const val = parseFloat(markInput[s.id] || '0') || 0;
                    const hasVal = markInput[s.id] !== '' && markInput[s.id] !== undefined;
                    const grade = val >= 75 ? 'A' : val >= 65 ? 'B' : val >= 55 ? 'C' : val >= 35 ? 'S' : 'F';
                    const gradeColor = grade === 'A' ? 'var(--success)' : grade === 'B' ? 'var(--primary-light)' : grade === 'C' ? 'var(--info)' : grade === 'S' ? 'var(--warning)' : 'var(--danger)';

                    return (
                      <tr key={s.id}>
                        <td style={{ color: 'var(--text-muted)', width: '36px' }}>{i + 1}</td>
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
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {s.id}</div>
                          </button>
                        </td>
                        <td>
                          <span className="badge badge-primary" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                            {s.admissionNumber || s.id}
                          </span>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="form-control"
                            style={{ width: '110px', fontWeight: 700, fontSize: '14px', textAlign: 'center' }}
                            value={markInput[s.id] ?? ''}
                            onChange={e => setMarkInput(prev => ({ ...prev, [s.id]: e.target.value }))}
                            placeholder="0 - 100"
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {hasVal ? (
                            <span className="badge" style={{ background: `${gradeColor}22`, color: gradeColor, borderColor: `${gradeColor}44`, fontWeight: 800, minWidth: '32px' }}>
                              {grade}
                            </span>
                          ) : (
                            <span className="badge badge-muted">—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                            onClick={() => {
                              setSelectedStudentId(s.id);
                              setActiveTab('by_student');
                            }}
                          >
                            👤 Full Marksheet
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: STUDENT-WISE MARKSHEET ENTRY ─── */}
      {activeTab === 'by_student' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Student Selector Card */}
          <div className="card" style={{ height: 'fit-content' }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <UserCheck size={18} style={{ color: 'var(--primary)' }} /> Select Student for Marksheet
            </h3>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Student in Class {selectedClass}</label>
              <select
                className="form-control"
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
                style={{ fontWeight: 600, fontSize: '14px' }}
              >
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.admissionNumber || s.id})
                  </option>
                ))}
              </select>
            </div>

            {currentStudentObj && (
              <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '16px', fontSize: '13px' }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {currentStudentObj.name}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '4px' }}>
                  Admission #: <code style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{currentStudentObj.admissionNumber || currentStudentObj.id}</code>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  Class: {currentStudentObj.classRoom} (Grade {currentStudentObj.grade})
                </div>
              </div>
            )}

            {/* Live Marksheet Summary */}
            <div style={{ background: 'linear-gradient(135deg, rgba(2,132,199,0.1) 0%, rgba(99,102,241,0.08) 100%)', border: '1.5px solid rgba(2, 132, 199, 0.25)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0284c7', fontWeight: 700, marginBottom: '10px' }}>
                Term {selectedTerm} Marksheet Summary
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', textAlign: 'center' }}>
                <div style={{ background: 'var(--bg-card)', padding: '8px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)' }}>{studentMarksheetStats.total}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Total Marks</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '8px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: studentMarksheetStats.avg >= 60 ? 'var(--success)' : 'var(--warning)' }}>
                    {studentMarksheetStats.avg}%
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Average</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '8px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)' }}>{studentMarksheetStats.grade}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Overall Grade</div>
                </div>
              </div>
            </div>
          </div>

          {/* Marksheet Entry Form */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 className="card-title" style={{ margin: 0 }}>Subject Marks Entry</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Enter marks (0-100) for Core and Elective subjects
                </p>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveStudentMarksheet}
                disabled={saving || !selectedStudentId}
              >
                {saving ? <span className="spinner" /> : <Save size={14} />}
                {saved ? '✓ Saved!' : 'Save Marksheet'}
              </button>
            </div>

            {/* Core Subjects Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={14} /> 6 Core O/L Subjects (Compulsory)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {SRI_LANKA_SUBJECTS.filter(s => s.category === 'core').map(subj => {
                  const val = parseFloat(studentMarksheetInput[subj.id] || '0') || 0;
                  const hasVal = studentMarksheetInput[subj.id] !== '' && studentMarksheetInput[subj.id] !== undefined;
                  const grade = val >= 75 ? 'A' : val >= 65 ? 'B' : val >= 55 ? 'C' : val >= 35 ? 'S' : 'F';
                  const gradeColor = grade === 'A' ? 'var(--success)' : grade === 'B' ? 'var(--primary-light)' : grade === 'C' ? 'var(--info)' : grade === 'S' ? 'var(--warning)' : 'var(--danger)';

                  return (
                    <div
                      key={subj.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{subj.nameEn}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="form-control"
                          style={{ width: '70px', padding: '6px', textAlign: 'center', fontWeight: 700 }}
                          value={studentMarksheetInput[subj.id] ?? ''}
                          onChange={e => setStudentMarksheetInput(prev => ({ ...prev, [subj.id]: e.target.value }))}
                          placeholder="—"
                        />
                        {hasVal && (
                          <span className="badge" style={{ background: `${gradeColor}22`, color: gradeColor, padding: '3px 6px', fontWeight: 800 }}>
                            {grade}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Elective Subjects Section */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} /> Elective & Category Subjects (ICT, Lit, Civics, Commerce, etc.)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {SRI_LANKA_SUBJECTS.filter(s => s.category === 'elective').map(subj => {
                  const val = parseFloat(studentMarksheetInput[subj.id] || '0') || 0;
                  const hasVal = studentMarksheetInput[subj.id] !== '' && studentMarksheetInput[subj.id] !== undefined;
                  const grade = val >= 75 ? 'A' : val >= 65 ? 'B' : val >= 55 ? 'C' : val >= 35 ? 'S' : 'F';
                  const gradeColor = grade === 'A' ? 'var(--success)' : grade === 'B' ? 'var(--primary-light)' : grade === 'C' ? 'var(--info)' : grade === 'S' ? 'var(--warning)' : 'var(--danger)';

                  return (
                    <div
                      key={subj.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <span style={{ fontWeight: 500, fontSize: '12.5px' }}>{subj.nameEn}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="form-control"
                          style={{ width: '70px', padding: '6px', textAlign: 'center', fontWeight: 700 }}
                          value={studentMarksheetInput[subj.id] ?? ''}
                          onChange={e => setStudentMarksheetInput(prev => ({ ...prev, [subj.id]: e.target.value }))}
                          placeholder="—"
                        />
                        {hasVal && (
                          <span className="badge" style={{ background: `${gradeColor}22`, color: gradeColor, padding: '3px 6px', fontWeight: 800 }}>
                            {grade}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: CLASS MARKSHEET SPREADSHEET OVERVIEW ─── */}
      {activeTab === 'class_overview' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Class {selectedClass} Marksheet (Term {selectedTerm})</h3>
          </div>
          {students.length === 0 ? (
            <div className="empty-state"><p>{t('noStudents', language)}</p></div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none', overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student</th>
                    <th>Admission #</th>
                    {SRI_LANKA_SUBJECTS.slice(0, 8).map(s => (
                      <th key={s.id} style={{ textAlign: 'center', fontSize: '11px' }}>{s.id}</th>
                    ))}
                    <th style={{ textAlign: 'center', fontWeight: 700 }}>Average</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, idx) => {
                    const stuMarks = marks.filter(m => m.studentId === s.id && m.term === selectedTerm);
                    const avgVal = stuMarks.length > 0
                      ? Math.round((stuMarks.reduce((sum, m) => sum + m.marks, 0) / stuMarks.length) * 10) / 10
                      : null;

                    return (
                      <tr key={s.id}>
                        <td style={{ color: 'var(--text-muted)', width: '32px' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td>
                          <span className="badge badge-primary" style={{ fontFamily: 'monospace' }}>
                            {s.admissionNumber || s.id}
                          </span>
                        </td>
                        {SRI_LANKA_SUBJECTS.slice(0, 8).map(sub => {
                          const markObj = stuMarks.find(m => m.subject === sub.id);
                          return (
                            <td key={sub.id} style={{ textAlign: 'center', fontWeight: markObj ? 600 : 400 }}>
                              {markObj ? markObj.marks : '—'}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {avgVal !== null ? (
                            <span style={{ color: avgVal >= 60 ? 'var(--success)' : 'var(--warning)' }}>
                              {avgVal}%
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
      )}

      {/* ─── TAB 4: PERFORMANCE RADAR CHART ─── */}
      {activeTab === 'chart' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{selectedSubject} Performance Chart (Class {selectedClass} - Term {selectedTerm})</h3>
          </div>
          {chartData.length === 0 ? (
            <div className="empty-state"><p>{t('noData', language)}</p></div>
          ) : (
            <div className="chart-container" style={{ height: '380px' }}>
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
