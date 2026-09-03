import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Save, UserPlus, Eye, AlertTriangle, GraduationCap,
  RefreshCw, UserCheck, MessageSquare, Send, PhoneCall, Check, ExternalLink, X,
  Trash2, Copy, Sparkles, Smartphone, Share2, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import type { Student, SchoolClass, AttendanceRecord, AttendanceStatus } from '../data/models';
import StudentProfileModal from '../components/StudentProfileModal';

const STATUS_OPTIONS: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

export default function AttendanceScreen() {
  const { user, language } = useAuth();
  const isPrincipal = user?.role === 'principal';

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [existing, setExisting] = useState<AttendanceRecord[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Student Profile Modal State
  const [selectedProfileStudentId, setSelectedProfileStudentId] = useState<string | null>(null);

  // Immediate Parent Alert Dispatch State (for Absent / Late)
  const [urgentDispatchAlerts, setUrgentDispatchAlerts] = useState<{
    student: Student;
    status: AttendanceStatus;
    payload: ReturnType<typeof databaseService.generateParentAlertMessage>;
    sent?: boolean;
  }[] | null>(null);

  // Principal filters
  const [selectedGrade, setSelectedGrade] = useState<string>('all');

  // Add student state (teacher only)
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudentId, setNewStudentId] = useState('');
  const [newAdmissionNumber, setNewAdmissionNumber] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('');
  const [newParentContact, setNewParentContact] = useState('');
  const [newParentEmail, setNewParentEmail] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState('');

  // Recently added student for immediate credential / admission sharing
  const [recentlyAddedStudent, setRecentlyAddedStudent] = useState<Student | null>(null);
  const [copiedAdmission, setCopiedAdmission] = useState(false);

  // Remove student confirmation state
  const [studentToRemove, setStudentToRemove] = useState<Student | null>(null);
  const [removingStudent, setRemovingStudent] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Load classes, students, teachers on mount; subscribe to attendance in real-time
  useEffect(() => {
    Promise.all([
      databaseService.getClasses(),
      databaseService.getStudents(),
      databaseService.getTeachers(),
    ]).then(([cls, stu, tc]) => {
      setClasses(cls);
      setAllStudents(stu);
      if (!isPrincipal && cls.length > 0) {
        const teacherObj = tc?.find(t => t.id === user?.id || (user?.name && t.name.toLowerCase() === user.name.toLowerCase()));
        const assigned = cls.find(c =>
          (user?.id && c.homeroomTeacherId === user.id) ||
          (user?.name && c.homeroomTeacherName?.toLowerCase() === user.name.toLowerCase()) ||
          (teacherObj?.classRoom && teacherObj.classRoom !== 'Not assigned' && c.id === teacherObj.classRoom)
        );
        setSelectedClass(assigned ? assigned.id : cls[0].id);
      }
    });

    // Real-time attendance subscription — fires immediately and on every teacher update
    const unsub = databaseService.subscribeToAttendance(
      (records) => {
        setExisting(records);
        setLoading(false);
      },
      (err) => {
        console.error('Real-time attendance error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [isPrincipal, user]);

  // Current class details (teacher view)
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

  // Filter students by selected class (teacher only)
  const loadStudents = useCallback(async () => {
    if (isPrincipal || !selectedClass) return;
    const filtered = allStudents.filter(s => s.classRoom === selectedClass);
    setStudents(filtered);

    // Pre-fill from existing records
    const init: Record<string, AttendanceStatus> = {};
    filtered.forEach(s => {
      const rec = existing.find(a =>
        a.studentId === s.id && a.date.startsWith(selectedDate)
      );
      init[s.id] = rec?.status ?? 'present';
    });
    setAttendance(init);
  }, [selectedClass, selectedDate, existing, allStudents, isPrincipal]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const recordsToSave: AttendanceRecord[] = students.map(s => {
        const existingRec = existing.find(
          a => a.studentId === s.id && a.date.startsWith(selectedDate)
        );
        const rec: AttendanceRecord = {
          studentId: s.id,
          date: selectedDate,
          status: attendance[s.id] ?? 'present',
        };
        if (existingRec?.id) {
          rec.id = existingRec.id;
        }
        return rec;
      });

      const studentMap: Record<string, Student> = {};
      allStudents.forEach(s => { studentMap[s.id] = s; });

      await databaseService.saveAttendanceWithParentNotifications(
        recordsToSave,
        user?.name || 'Class Teacher',
        studentMap
      );
      // Real-time subscribeToAttendance auto-refreshes existing records — no manual re-fetch needed

      // Trigger Immediate Parent Mobile Dispatch Center for Absent & Late students
      const urgentList = students
        .filter(s => attendance[s.id] === 'absent' || attendance[s.id] === 'late')
        .map(s => ({
          student: s,
          status: (attendance[s.id] || 'present') as AttendanceStatus,
          payload: databaseService.generateParentAlertMessage(
            s,
            (attendance[s.id] || 'present') as AttendanceStatus,
            selectedDate,
            user?.name || 'Class Teacher'
          ),
          sent: false,
        }));

      if (urgentList.length > 0) {
        setUrgentDispatchAlerts(urgentList);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save attendance and notify parents:', err);
    } finally {
      setSaving(false);
    }
  }

  function openAddModal() {
    const classToAssign = selectedClass || (classes.length > 0 ? classes[0].id : '10A');
    const autoId = databaseService.generateStudentId(classToAssign, allStudents);
    const randomAdm = databaseService.generateRandomAdmissionNumber(allStudents);
    setNewStudentId(autoId);
    setNewAdmissionNumber(randomAdm);
    setNewStudentName('');
    setNewStudentClass(classToAssign);
    setNewParentContact('');
    setNewParentEmail('');
    setAddStudentError('');
    setShowAddModal(true);
  }

  function handleRegenerateId() {
    const classToAssign = newStudentClass || selectedClass || (classes.length > 0 ? classes[0].id : '10A');
    const autoId = databaseService.generateStudentId(classToAssign, allStudents);
    setNewStudentId(autoId);
  }

  function handleRegenerateAdmission() {
    const randomAdm = databaseService.generateRandomAdmissionNumber(allStudents);
    setNewAdmissionNumber(randomAdm);
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    const classToAssign = newStudentClass || selectedClass;
    if (!newStudentId.trim() || !newAdmissionNumber.trim() || !newStudentName.trim() || !classToAssign || !newParentContact.trim()) {
      setAddStudentError('Please fill in all required fields (Student ID, Admission #, Name, and Parent Contact).');
      return;
    }
    setAddingStudent(true);
    setAddStudentError('');
    try {
      const cleanId = newStudentId.trim().toUpperCase();
      const cleanAdm = newAdmissionNumber.trim().toUpperCase();

      const idExists = allStudents.some(s => s.id.toUpperCase() === cleanId);
      if (idExists) {
        throw new Error(`Student ID ${cleanId} already exists in the system.`);
      }

      const admExists = allStudents.some(s => (s.admissionNumber || '').toUpperCase() === cleanAdm);
      if (admExists) {
        throw new Error(`Admission Number ${cleanAdm} already exists. Please click 'Generate New' to assign another.`);
      }

      const clsObj = classes.find(c => c.id === classToAssign);
      const gradeVal = clsObj ? clsObj.grade.toString() : '';

      const newStudent: Student = {
        id: cleanId,
        admissionNumber: cleanAdm,
        name: newStudentName.trim(),
        classRoom: classToAssign,
        grade: gradeVal,
        parentContact: newParentContact.trim(),
        ...(newParentEmail.trim() ? { parentEmail: newParentEmail.trim() } : {}),
        schoolCensusCode: user?.schoolCensusCode,
        schoolName: user?.schoolName,
        registeredAt: new Date().toISOString(),
        isStudentRegistered: false,
        isParentRegistered: false,
      };

      await databaseService.createStudent(newStudent);
      const updatedStudents = await databaseService.getStudents();
      setAllStudents(updatedStudents);
      setShowAddModal(false);
      setRecentlyAddedStudent(newStudent);
      setActionSuccessMsg(`✅ Student ${newStudent.name} added successfully with Admission #${cleanAdm}!`);
      setTimeout(() => setActionSuccessMsg(''), 5000);
    } catch (err: any) {
      setAddStudentError(err.message || 'Failed to add student');
    } finally {
      setAddingStudent(false);
    }
  }

  async function handleConfirmRemoveStudent() {
    if (!studentToRemove) return;
    setRemovingStudent(true);
    try {
      await databaseService.deleteStudent(studentToRemove.id);
      const updatedStudents = allStudents.filter(s => s.id !== studentToRemove.id);
      setAllStudents(updatedStudents);
      setStudents(prev => prev.filter(s => s.id !== studentToRemove.id));
      setAttendance(prev => {
        const next = { ...prev };
        delete next[studentToRemove.id];
        return next;
      });
      setActionSuccessMsg(`✓ Student ${studentToRemove.name} (Admission #${studentToRemove.admissionNumber || studentToRemove.id}) was removed.`);
      setTimeout(() => setActionSuccessMsg(''), 4000);
      setStudentToRemove(null);
    } catch (err) {
      console.error('Failed to remove student:', err);
      setActionSuccessMsg('❌ Failed to remove student. Please try again.');
    } finally {
      setRemovingStudent(false);
    }
  }

  function handleCopyAdmissionInfo(student: Student) {
    const text = `🏛️ *${user?.schoolName || 'Government School'} - Student Registration Credentials*\n\n• Student: *${student.name}*\n• School Admission Number: *${student.admissionNumber || student.id}*\n• Class: *${student.classRoom}* (Grade ${student.grade})\n• Student ID: *${student.id}*\n\n📱 *Mobile App Registration*:\n1. Open EduNexus Mobile App\n2. Select Register as *Student* or *Parent*\n3. Enter Admission Number: *${student.admissionNumber || student.id}*\n4. Complete your account password setup.`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedAdmission(true);
      setTimeout(() => setCopiedAdmission(false), 3000);
    }).catch(err => console.error('Copy failed:', err));
  }

  const statusClasses: Record<AttendanceStatus, string> = {
    present: 'active-present',
    absent: 'active-absent',
    late: 'active-late',
    excused: 'active-excused',
  };

  // ─── Principal: class-wise attendance summary for selected date ───
  const classWiseData = useMemo(() => {
    if (!isPrincipal) return [];

    const dateRecords = existing.filter(a => a.date.startsWith(selectedDate));

    return filteredClasses.map(cls => {
      const classStudents = allStudents.filter(s => s.classRoom === cls.id);
      const classStudentIds = new Set(classStudents.map(s => s.id));
      const classRecords = dateRecords.filter(r => classStudentIds.has(r.studentId));

      const present = classRecords.filter(r => r.status === 'present').length;
      const absent = classRecords.filter(r => r.status === 'absent').length;
      const late = classRecords.filter(r => r.status === 'late').length;
      const excused = classRecords.filter(r => r.status === 'excused').length;
      const total = classRecords.length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;

      return {
        classId: cls.id,
        grade: cls.grade,
        section: cls.section,
        stream: cls.stream,
        totalStudents: classStudents.length,
        present, absent, late, excused, total, rate,
      };
    });
  }, [isPrincipal, existing, selectedDate, filteredClasses, allStudents]);

  // ─── Principal: overall summary across all filtered classes ───
  const overallSummary = useMemo(() => {
    if (!isPrincipal) return null;
    const present = classWiseData.reduce((s, c) => s + c.present, 0);
    const absent = classWiseData.reduce((s, c) => s + c.absent, 0);
    const late = classWiseData.reduce((s, c) => s + c.late, 0);
    const excused = classWiseData.reduce((s, c) => s + c.excused, 0);
    const total = present + absent + late + excused;
    return { present, absent, late, excused, total };
  }, [isPrincipal, classWiseData]);

  // ─── Principal: low attendance students (< 75% attendance rate across all records) ───
  const lowAttendanceStudents = useMemo(() => {
    if (!isPrincipal) return [];

    const LOW_THRESHOLD = 75; // percentage

    // Only consider students in the filtered classes
    const classIds = new Set(filteredClasses.map(c => c.id));
    const relevantStudents = allStudents.filter(s => classIds.has(s.classRoom));

    const result: { student: Student; totalRecords: number; presentCount: number; rate: number }[] = [];

    for (const student of relevantStudents) {
      const studentRecords = existing.filter(r => r.studentId === student.id);
      if (studentRecords.length === 0) continue; // skip if no records at all

      const presentCount = studentRecords.filter(r => r.status === 'present').length;
      const rate = Math.round((presentCount / studentRecords.length) * 100);

      if (rate < LOW_THRESHOLD) {
        result.push({ student, totalRecords: studentRecords.length, presentCount, rate });
      }
    }

    // Sort by rate ascending (worst first)
    result.sort((a, b) => a.rate - b.rate);
    return result;
  }, [isPrincipal, filteredClasses, allStudents, existing]);

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // PRINCIPAL VIEW — class-wise summary only, no student names
  // ═══════════════════════════════════════════════════════════════════
  if (isPrincipal) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('attendance', language)}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <p className="page-subtitle" style={{ margin: 0 }}>{t('viewAttendance', language)}</p>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#10b981', borderRadius: '20px', fontSize: '11px',
                fontWeight: 700, padding: '2px 10px',
              }}>
                <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#10b981', animation: 'pulse-live 1.8s ease-in-out infinite' }} />
                LIVE
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
            <Eye size={16} />
            <span>{t('viewAttendance', language)}</span>
          </div>
        </div>

        {/* ── Overall Summary Stats ── */}
        {overallSummary && overallSummary.total > 0 && (
          <div className="stats-grid" style={{ marginBottom: '20px' }}>
            {([
              { key: 'present' as const, color: 'var(--success)', value: overallSummary.present },
              { key: 'absent' as const, color: 'var(--danger)', value: overallSummary.absent },
              { key: 'late' as const, color: 'var(--warning)', value: overallSummary.late },
              { key: 'excused' as const, color: 'var(--info)', value: overallSummary.excused },
            ]).map(item => (
              <div className="stat-card" key={item.key}>
                <div className="stat-icon" style={{ background: `${item.color}22` }}>
                  <span style={{ fontSize: '22px', color: item.color, fontWeight: 700 }}>
                    {item.value}
                  </span>
                </div>
                <div className="stat-info">
                  <div className="stat-value" style={{ color: item.color }}>{
                    overallSummary.total > 0
                      ? Math.round((item.value / overallSummary.total) * 100) + '%'
                      : '0%'
                  }</div>
                  <div className="stat-label">{t(item.key, language)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Filters: Grade + Date ── */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t('selectGrade', language)}</label>
              <select
                id="att-grade-select"
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
              <label className="form-label">{t('selectDate', language)}</label>
              <input
                id="att-date"
                type="date"
                className="form-control"
                value={selectedDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Class-wise Attendance Table ── */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h3 className="card-title">{t('classWiseSummary', language)}</h3>
          </div>
          {classWiseData.length === 0 ? (
            <div className="empty-state">
              <p>{t('noAttendanceRecords', language)}</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('class', language)}</th>
                    <th>{t('stream', language)}</th>
                    <th style={{ textAlign: 'center' }}>{t('totalStudents', language)}</th>
                    <th style={{ textAlign: 'center', color: 'var(--success)' }}>{t('present', language)}</th>
                    <th style={{ textAlign: 'center', color: 'var(--danger)' }}>{t('absent', language)}</th>
                    <th style={{ textAlign: 'center', color: 'var(--warning)' }}>{t('late', language)}</th>
                    <th style={{ textAlign: 'center', color: 'var(--info)' }}>{t('excused', language)}</th>
                    <th style={{ textAlign: 'center' }}>{t('attendanceRate', language)}</th>
                  </tr>
                </thead>
                <tbody>
                  {classWiseData.map(row => (
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
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>{row.present}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{row.absent}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{row.late}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--info)', fontWeight: 600 }}>{row.excused}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {row.total > 0 ? (
                          <span
                            className={`badge ${row.rate >= 75 ? 'badge-success' : row.rate >= 50 ? 'badge-warning' : 'badge-danger'}`}
                            style={{ fontSize: '12px', fontWeight: 700, minWidth: '48px', justifyContent: 'center' }}
                          >
                            {row.rate}%
                          </span>
                        ) : (
                          <span className="badge badge-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Low Attendance Students ── */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
              {t('lowAttendanceStudents', language)}
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>
                (&lt; 75%)
              </span>
            </h3>
          </div>
          {lowAttendanceStudents.length === 0 ? (
            <div className="empty-state">
              <p style={{ color: 'var(--success)' }}>✓ {t('noLowAttendance', language)}</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('student', language)}</th>
                    <th>{t('class', language)}</th>
                    <th style={{ textAlign: 'center' }}>{t('totalRecords', language)}</th>
                    <th style={{ textAlign: 'center' }}>{t('present', language)}</th>
                    <th style={{ textAlign: 'center' }}>{t('attendanceRate', language)}</th>
                  </tr>
                </thead>
                <tbody>
                  {lowAttendanceStudents.map((item, i) => (
                    <tr key={item.student.id}>
                      <td style={{ color: 'var(--text-muted)', width: '40px' }}>{i + 1}</td>
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
                          onClick={() => setSelectedProfileStudentId(item.student.id)}
                          title="Click to view full student profile"
                        >
                          <div style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                            {item.student.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.student.id}</div>
                        </button>
                      </td>
                      <td>
                        <span className="badge badge-primary">{item.student.classRoom}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.totalRecords}</td>
                      <td style={{ textAlign: 'center' }}>{item.presentCount}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`badge ${item.rate >= 50 ? 'badge-warning' : 'badge-danger'}`}
                          style={{ fontSize: '12px', fontWeight: 700, minWidth: '48px', justifyContent: 'center' }}
                        >
                          {item.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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

  // ═══════════════════════════════════════════════════════════════════
  // TEACHER VIEW — editable attendance + add student (Relevant Class only)
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('attendance', language)}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
            <p className="page-subtitle" style={{ margin: 0 }}>{t('markAttendance', language)}</p>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#10b981', borderRadius: '20px', fontSize: '11px',
              fontWeight: 700, padding: '2px 10px',
            }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#10b981', animation: 'pulse-live 1.8s ease-in-out infinite' }} />
              LIVE
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={openAddModal}
          >
            <UserPlus size={15} />
            {t('addStudent', language)}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || students.length === 0}
          >
            {saving ? <span className="spinner" /> : <Save size={15} />}
            {saved ? '✓ Saved!' : t('saveAttendance', language)}
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1.5px solid rgba(16, 185, 129, 0.4)',
          color: '#10b981',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 600,
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} />
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg('')}
            style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Relevant Class Information & Date Selection */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', alignItems: 'center' }}>
          <div>
            <label className="form-label" style={{ marginBottom: '8px' }}>{t('assignedClass', language)}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', minHeight: '44px' }}>
              <GraduationCap size={20} style={{ color: 'var(--primary-color)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                  {currentClassObj ? `${t('grade', language)} ${currentClassObj.grade}${currentClassObj.section}` : (selectedClass || t('noTeacherAssigned', language))}
                </span>
                {currentClassObj && (
                  <span className="badge badge-primary" style={{ fontSize: '11px', padding: '2px 8px' }}>
                    {currentClassObj.stream === 'ol' ? t('olStream', language) : t('alStream', language)}
                  </span>
                )}
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {students.length} Student{students.length !== 1 ? 's' : ''} Enrolled
                </span>
              </div>
            </div>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ marginBottom: '8px' }}>{t('selectDate', language)}</label>
            <input
              id="att-date"
              type="date"
              className="form-control"
              value={selectedDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ minHeight: '44px' }}
            />
          </div>
        </div>
      </div>

      {/* Student list */}
      <div className="card">
        {students.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <GraduationCap size={44} style={{ color: 'var(--text-muted)', marginBottom: '12px', opacity: 0.6 }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>{t('noStudents', language)}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
              No students are currently registered in Class {selectedClass}. You can add students using their School Admission Number.
            </p>
            <button className="btn btn-primary btn-sm" onClick={openAddModal}>
              <UserPlus size={14} /> {t('addStudent', language)}
            </button>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('student', language)}</th>
                  <th>{t('admissionNumber', language)}</th>
                  <th>{t('contact', language)}</th>
                  <th>Mobile Portal</th>
                  <th>{t('attendance', language)}</th>
                  <th style={{ textAlign: 'center' }}>{t('actions', language)}</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          className="badge badge-primary"
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                            background: 'rgba(2, 132, 199, 0.12)',
                            color: '#0284c7',
                            border: '1px solid rgba(2, 132, 199, 0.3)',
                            padding: '3px 8px',
                          }}
                        >
                          {s.admissionNumber || s.id}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 5px', height: 'auto', minWidth: 'unset', color: 'var(--text-muted)' }}
                          onClick={() => handleCopyAdmissionInfo(s)}
                          title="Copy Admission & Registration Info"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <PhoneCall size={12} style={{ color: 'var(--text-muted)' }} />
                        {s.parentContact || '—'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: s.isStudentRegistered ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                          color: s.isStudentRegistered ? '#10b981' : '#64748b',
                          fontWeight: 600,
                          width: 'fit-content'
                        }}>
                          Student: {s.isStudentRegistered ? '✓ Registered' : '⏳ Pending'}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: s.isParentRegistered ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                          color: s.isParentRegistered ? '#10b981' : '#64748b',
                          fontWeight: 600,
                          width: 'fit-content'
                        }}>
                          Parent: {s.isParentRegistered ? '✓ Registered' : '⏳ Pending'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="attendance-btn-group">
                        {STATUS_OPTIONS.map(st => (
                          <button
                            key={st}
                            className={`att-btn ${attendance[s.id] === st ? statusClasses[st] : ''}`}
                            onClick={() => setStatus(s.id, st)}
                          >
                            {t(st, language)}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 7px', minWidth: 'unset' }}
                          onClick={() => setSelectedProfileStudentId(s.id)}
                          title="View Profile"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{
                            padding: '4px 7px',
                            minWidth: 'unset',
                            color: '#ef4444',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.2)'
                          }}
                          onClick={() => setStudentToRemove(s)}
                          title="Remove Student from Class"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recently Added Student Modal / Card */}
      {recentlyAddedStudent && (
        <div className="modal-overlay" onClick={() => setRecentlyAddedStudent(null)}>
          <div className="modal" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '10px', borderRadius: '50%' }}>
                <Check size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Student Added Successfully!</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                  School Admission Number & Mobile Registration Credentials
                </p>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              border: '1.5px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              marginBottom: '18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 700 }}>
                  School Admission Number
                </span>
                <span className="badge badge-success">Active in Class {recentlyAddedStudent.classRoom}</span>
              </div>

              <div style={{
                fontSize: '24px',
                fontWeight: 900,
                fontFamily: 'monospace',
                color: 'var(--primary)',
                letterSpacing: '1px',
                marginBottom: '10px',
                background: 'var(--bg-card)',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                textAlign: 'center'
              }}>
                {recentlyAddedStudent.admissionNumber || recentlyAddedStudent.id}
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <div>👤 <strong>Student Name:</strong> {recentlyAddedStudent.name}</div>
                <div>🏷️ <strong>Student ID:</strong> <code style={{ fontFamily: 'monospace' }}>{recentlyAddedStudent.id}</code></div>
                <div>🏛️ <strong>Class:</strong> {recentlyAddedStudent.classRoom} (Grade {recentlyAddedStudent.grade})</div>
                <div>📱 <strong>Parent Mobile:</strong> {recentlyAddedStudent.parentContact}</div>
              </div>
            </div>

            <div style={{
              background: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              padding: '12px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              marginBottom: '20px',
              lineHeight: 1.4
            }}>
              💡 <strong>Next Step:</strong> Share this <strong>Admission Number</strong> ({recentlyAddedStudent.admissionNumber || recentlyAddedStudent.id}) with the student and parents. They can register directly on the EduNexus mobile & web app!
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRecentlyAddedStudent(null)}
                style={{ flex: 1 }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleCopyAdmissionInfo(recentlyAddedStudent)}
                style={{ flex: 1.4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {copiedAdmission ? <Check size={15} /> : <Copy size={15} />}
                {copiedAdmission ? '✓ Copied Details!' : t('copyAdmissionDetails', language)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Student Confirmation Modal */}
      {studentToRemove && (
        <div className="modal-overlay" onClick={() => !removingStudent && setStudentToRemove(null)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '12px', borderRadius: '50%' }}>
                <Trash2 size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {t('confirmRemoveStudent', language)}
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  Confirm deletion from class attendance roster
                </p>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              marginBottom: '16px',
              fontSize: '13px'
            }}>
              <div style={{ marginBottom: '6px' }}>
                <strong>Student:</strong> {studentToRemove.name}
              </div>
              <div style={{ marginBottom: '6px' }}>
                <strong>Admission #:</strong> <code style={{ fontFamily: 'monospace', fontWeight: 700 }}>{studentToRemove.admissionNumber || studentToRemove.id}</code>
              </div>
              <div style={{ marginBottom: '6px' }}>
                <strong>Class:</strong> {studentToRemove.classRoom} (Grade {studentToRemove.grade})
              </div>
              <div>
                <strong>Parent Contact:</strong> {studentToRemove.parentContact || 'None'}
              </div>
            </div>

            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#ef4444',
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              marginBottom: '20px',
              lineHeight: 1.4
            }}>
              ⚠️ {t('removeStudentWarning', language)} Associated attendance records for this student will also be removed.
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStudentToRemove(null)}
                disabled={removingStudent}
                style={{ flex: 1 }}
              >
                {t('cancel', language)}
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  flex: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontWeight: 600
                }}
                onClick={handleConfirmRemoveStudent}
                disabled={removingStudent}
              >
                {removingStudent ? <span className="spinner" /> : <Trash2 size={15} />}
                {removingStudent ? 'Removing...' : 'Yes, Remove Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" style={{ maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', padding: '10px', borderRadius: '50%' }}>
                <UserPlus size={22} />
              </div>
              <div>
                <h2 className="modal-title" style={{ margin: 0, fontSize: '18px' }}>{t('addStudent', language)}</h2>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  Assign School Admission Number & Register to Class {selectedClass || 'Assigned Class'}
                </p>
              </div>
            </div>

            {addStudentError && (
              <div className="badge badge-danger" style={{ display: 'block', padding: '10px', marginBottom: '16px', textTransform: 'none', letterSpacing: 'normal', borderRadius: 'var(--radius-sm)' }}>
                {addStudentError}
              </div>
            )}

            <form onSubmit={handleAddStudent}>
              {/* School Admission Number with Random Generator */}
              <div className="form-group" style={{ background: 'rgba(2, 132, 199, 0.05)', border: '1px solid rgba(2, 132, 199, 0.25)', padding: '14px', borderRadius: '10px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: 700, color: '#0284c7' }}>
                    {t('admissionNumber', language)} (Mobile App Registration Key)
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 9px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', borderColor: 'rgba(2, 132, 199, 0.3)' }}
                    onClick={handleRegenerateAdmission}
                    title="Generate a new random collision-free Admission Number"
                  >
                    <RefreshCw size={11} /> 🎲 {t('regenerateAdmissionNumber', language)}
                  </button>
                </div>
                <input
                  id="new-student-admission"
                  className="form-control"
                  value={newAdmissionNumber}
                  onChange={e => setNewAdmissionNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. ADM-84920"
                  required
                  style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '1px', fontSize: '15px' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px', display: 'block' }}>
                  💡 Unique school admission number assigned randomly. Students & Parents will use this to register their mobile app account.
                </span>
              </div>

              {/* Student Name */}
              <div className="form-group">
                <label className="form-label">{t('studentName', language)}</label>
                <input
                  id="new-student-name"
                  className="form-control"
                  value={newStudentName}
                  onChange={e => setNewStudentName(e.target.value)}
                  placeholder="e.g. Kasun Chamara Perera"
                  required
                />
              </div>

              {/* Assigned Class */}
              <div className="form-group">
                <label className="form-label">{t('assignedClass', language)}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                  <GraduationCap size={18} style={{ color: 'var(--primary-color)' }} />
                  <span style={{ fontWeight: 600 }}>
                    {currentClassObj ? `${t('grade', language)} ${currentClassObj.grade}${currentClassObj.section}` : (selectedClass || '—')}
                  </span>
                  {currentClassObj && (
                    <span className="badge badge-primary" style={{ fontSize: '11px' }}>
                      {currentClassObj.stream === 'ol' ? t('olStream', language) : t('alStream', language)}
                    </span>
                  )}
                </div>
              </div>

              {/* Student ID */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>{t('studentId', language)}</label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 6px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={handleRegenerateId}
                    title="Auto-generate Student ID"
                  >
                    <RefreshCw size={11} /> Auto-Generate ID
                  </button>
                </div>
                <input
                  id="new-student-id"
                  className="form-control"
                  value={newStudentId}
                  onChange={e => setNewStudentId(e.target.value.toUpperCase())}
                  placeholder="e.g. STU-2026-10A-001"
                  required
                  style={{ fontFamily: 'monospace', fontWeight: 600, letterSpacing: '0.5px' }}
                />
              </div>

              {/* Parent Contact Number */}
              <div className="form-group">
                <label className="form-label">{t('parentContact', language)} (Mobile / WhatsApp)</label>
                <input
                  id="new-parent-contact"
                  className="form-control"
                  value={newParentContact}
                  onChange={e => setNewParentContact(e.target.value)}
                  placeholder="e.g. +94771234567"
                  required
                />
              </div>

              {/* Parent Email (Optional) */}
              <div className="form-group">
                <label className="form-label">{t('parentEmail', language)}</label>
                <input
                  id="new-parent-email"
                  type="email"
                  className="form-control"
                  value={newParentEmail}
                  onChange={e => setNewParentEmail(e.target.value)}
                  placeholder="e.g. parent@gmail.com"
                />
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={addingStudent}
                >
                  {t('cancel', language)}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addingStudent}
                >
                  {addingStudent ? <span className="spinner" /> : null}
                  {addingStudent ? t('adding', language) : t('save', language)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Profile Modal */}
      {selectedProfileStudentId && (
        <StudentProfileModal
          studentId={selectedProfileStudentId}
          onClose={() => setSelectedProfileStudentId(null)}
        />
      )}

      {/* Immediate Parent Mobile Alert Dispatch Modal (Absent / Late) */}
      {urgentDispatchAlerts && (
        <div className="modal-overlay" onClick={() => setUrgentDispatchAlerts(null)}>
          <div
            className="modal"
            style={{ maxWidth: '680px', width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 50%, #dc2626 100%)',
              padding: '20px 24px',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className="badge" style={{ background: '#ffffff', color: '#dc2626', fontWeight: 800 }}>
                    🚨 IMMEDIATE ALERT
                  </span>
                  <span style={{ fontSize: '12px', opacity: 0.9 }}>
                    Attendance Saved on {selectedDate}
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>
                  Parent Mobile Dispatch Center
                </h3>
              </div>
              <button
                onClick={() => setUrgentDispatchAlerts(null)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
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
            </div>

            {/* Modal Content */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, background: 'var(--bg-page)' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                The following <strong>{urgentDispatchAlerts.length}</strong> student(s) were marked <strong>Absent</strong> or <strong>Late</strong>.
                Notifications have been pushed to their parent accounts in the mobile app. You can also dispatch instant <strong>WhatsApp</strong> or <strong>SMS</strong> messages below:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {urgentDispatchAlerts.map((item, idx) => {
                  const isAbsent = item.status === 'absent';
                  const statusBg = isAbsent ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)';
                  const statusBorder = isAbsent ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)';
                  const statusColor = isAbsent ? 'var(--danger)' : 'var(--warning)';

                  return (
                    <div
                      key={item.student.id}
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-card)',
                        border: `1px solid ${statusBorder}`,
                        boxShadow: 'var(--shadow-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '15px' }}>{item.student.name}</span>
                            <span className="badge" style={{ background: statusBg, color: statusColor, fontWeight: 700 }}>
                              {item.status.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            ID: <code style={{ fontFamily: 'monospace' }}>{item.student.id}</code> · Class {item.student.classRoom}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                          <PhoneCall size={14} style={{ color: 'var(--primary)' }} />
                          {item.student.parentContact || 'No contact registered'}
                        </div>
                      </div>

                      {/* Action Dispatch Buttons */}
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                        {item.payload.whatsappUrl ? (
                          <a
                            href={item.payload.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm"
                            style={{
                              background: '#25D366',
                              color: '#ffffff',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: 600,
                            }}
                            onClick={() => {
                              const updated = [...urgentDispatchAlerts];
                              updated[idx].sent = true;
                              setUrgentDispatchAlerts(updated);
                            }}
                          >
                            <MessageSquare size={14} /> Send WhatsApp Alert {item.sent ? '✓ Sent' : ''}
                          </a>
                        ) : null}

                        {item.payload.smsUrl ? (
                          <a
                            href={item.payload.smsUrl}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => {
                              const updated = [...urgentDispatchAlerts];
                              updated[idx].sent = true;
                              setUrgentDispatchAlerts(updated);
                            }}
                          >
                            <Send size={13} /> Send Direct SMS
                          </a>
                        ) : null}

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedProfileStudentId(item.student.id)}
                          style={{ marginLeft: 'auto' }}
                        >
                          View Student Profile
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 20px',
              background: 'var(--bg-card)',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                ✓ Database records & cloud parent notifications synchronized
              </span>
              <button
                className="btn btn-primary"
                onClick={() => setUrgentDispatchAlerts(null)}
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
