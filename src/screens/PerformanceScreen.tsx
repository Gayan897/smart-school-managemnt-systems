import { useEffect, useState, useMemo } from 'react';
import {
  Save, Eye, Trophy, Award, GraduationCap, Sparkles, Check, BookOpen,
  UserCheck, Layers, FileSpreadsheet, BarChart2, RefreshCw, AlertCircle,
  FileDown, Download, Medal, Calendar, Search, CheckCircle2, Plus, Sliders
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../i18n/strings';
import { databaseService } from '../data/database';
import type { Student, SchoolClass, TermMark, AttendanceRecord, Teacher } from '../data/models';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import StudentProfileModal from '../components/StudentProfileModal';
import OfflineBanner from '../components/OfflineBanner';
import { useNetworkStatus } from '../utils/useNetworkStatus';
import { exportStudentReportCardPdf } from '../utils/reportsPdf';

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

export interface StudentRankingItem {
  student: Student;
  rank: number | null;
  totalMarks: number;
  subjectsCount: number;
  avgMarks: number;
  grade: string;
  marksBySubject: Record<string, number>;
  hasMarks: boolean;
}

export default function PerformanceScreen() {
  const { user, language } = useAuth();
  const isPrincipal = user?.role === 'principal' || user?.role === 'zonal_admin';

  // Network status — drives the offline banner and auto-sync on reconnect
  const networkStatus = useNetworkStatus(() => databaseService.replayOfflineQueue());

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<TermMark[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [selectedSubject, setSelectedSubject] = useState('Mathematics');

  // Teacher Mark Entry State (Subject-Wise)
  const [markInput, setMarkInput] = useState<Record<string, string>>({});

  // Teacher Mark Entry State (Student-Wise)
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentMarksheetInput, setStudentMarksheetInput] = useState<Record<string, string>>({});

  // Search filter for rankings & marksheet table
  const [rankingsSearch, setRankingsSearch] = useState('');

  // Report card PDF downloading state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [batchDownloading, setBatchDownloading] = useState(false);

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
      setTeachers(tc || []);

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

    // Real-time attendance listener for student report cards
    const unsubAttendance = databaseService.subscribeToAttendance(
      (att) => {
        setAttendance(att);
      },
      (err) => console.error('Attendance subscription error:', err)
    );

    return () => {
      unsubStudents();
      unsubMarks();
      unsubAttendance();
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

  // ─── Class-wise Rankings & Places (1st, 2nd, 3rd and all other places) ───
  const classRankings = useMemo<StudentRankingItem[]>(() => {
    if (students.length === 0) return [];

    const computed = students.map(s => {
      const stuMarks = marks.filter(m => m.studentId === s.id && m.term === selectedTerm);
      const marksBySubject: Record<string, number> = {};
      stuMarks.forEach(m => {
        marksBySubject[m.subject] = m.marks;
      });

      const totalMarks = stuMarks.reduce((sum, m) => sum + m.marks, 0);
      const subjectsCount = stuMarks.length;
      const avgMarks = subjectsCount > 0 ? Math.round((totalMarks / subjectsCount) * 10) / 10 : 0;
      const grade = avgMarks >= 75 ? 'A' : avgMarks >= 65 ? 'B' : avgMarks >= 55 ? 'C' : avgMarks >= 35 ? 'S' : subjectsCount > 0 ? 'F' : '—';

      return {
        student: s,
        totalMarks,
        subjectsCount,
        avgMarks,
        grade,
        marksBySubject,
        hasMarks: subjectsCount > 0,
      };
    });

    // Sort students with marks: higher average first, then higher total marks, then name
    const withMarks = computed
      .filter(c => c.hasMarks)
      .sort((a, b) => {
        if (b.avgMarks !== a.avgMarks) return b.avgMarks - a.avgMarks;
        if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
        return a.student.name.localeCompare(b.student.name);
      });

    // Assign places (1st, 2nd, 3rd, 4th...) with clean tie support
    let currentRank = 1;
    const rankedWithMarks: StudentRankingItem[] = withMarks.map((item, index) => {
      if (index > 0) {
        const prev = withMarks[index - 1];
        if (item.avgMarks === prev.avgMarks && item.totalMarks === prev.totalMarks) {
          return { ...item, rank: currentRank };
        } else {
          currentRank = index + 1;
          return { ...item, rank: currentRank };
        }
      }
      return { ...item, rank: 1 };
    });

    // Students with no marks entered yet are listed at the bottom as unranked
    const withoutMarks: StudentRankingItem[] = computed
      .filter(c => !c.hasMarks)
      .map(item => ({ ...item, rank: null }));

    return [...rankedWithMarks, ...withoutMarks];
  }, [students, marks, selectedTerm]);

  // Top 3 Best Performers of the class
  const firstPlace = useMemo(() => classRankings.find(s => s.rank === 1) || null, [classRankings]);
  const secondPlace = useMemo(() => classRankings.find(s => s.rank === 2) || null, [classRankings]);
  const thirdPlace = useMemo(() => classRankings.find(s => s.rank === 3) || null, [classRankings]);

  // Current selected student's ranking item (for student-wise tab)
  const selectedStudentRanking = useMemo(() => {
    return classRankings.find(r => r.student.id === selectedStudentId) || null;
  }, [classRankings, selectedStudentId]);

  // Filtered rankings by search query
  const filteredRankings = useMemo(() => {
    if (!rankingsSearch.trim()) return classRankings;
    const q = rankingsSearch.toLowerCase().trim();
    return classRankings.filter(r =>
      r.student.name.toLowerCase().includes(q) ||
      (r.student.admissionNumber && r.student.admissionNumber.toLowerCase().includes(q)) ||
      r.student.id.toLowerCase().includes(q)
    );
  }, [classRankings, rankingsSearch]);

  // ─── Download Student Term Report Card ───
  function handleDownloadReportCard(rankingItem: StudentRankingItem) {
    const stu = rankingItem.student;
    setDownloadingId(stu.id);

    try {
      const stuMarks = marks.filter(m => m.studentId === stu.id && m.term === selectedTerm);

      // Student attendance metrics
      const stuAtt = attendance.filter(a => a.studentId === stu.id);
      const totalDays = stuAtt.length;
      const presentDays = stuAtt.filter(a => a.status === 'present' || a.status === 'late').length;
      const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : undefined;

      // Subject breakdown with class averages
      const subjectsList = stuMarks.map(m => {
        const subObj = SRI_LANKA_SUBJECTS.find(s => s.id === m.subject);
        const classSubMarks = marks.filter(
          mk => students.some(s => s.id === mk.studentId) && mk.subject === m.subject && mk.term === selectedTerm
        );
        const classAvg = classSubMarks.length > 0
          ? Math.round((classSubMarks.reduce((acc, c) => acc + c.marks, 0) / classSubMarks.length) * 10) / 10
          : undefined;

        const gr = m.marks >= 75 ? 'A' : m.marks >= 65 ? 'B' : m.marks >= 55 ? 'C' : m.marks >= 35 ? 'S' : 'F';

        return {
          subjectId: m.subject,
          subjectName: subObj ? subObj.nameEn : m.subject,
          marks: m.marks,
          maxMarks: m.maxMarks || 100,
          grade: gr,
          classAverage: classAvg,
          category: subObj?.category,
        };
      });

      exportStudentReportCardPdf({
        schoolName: user?.schoolName || 'Government National School',
        schoolCensusCode: user?.schoolCensusCode,
        principalName: currentClassObj?.homeroomTeacherName || user?.name || 'Principal',
        teacherName: currentClassObj?.homeroomTeacherName || (user?.role === 'teacher' ? user.name : 'Homeroom Teacher'),
        academicYear: new Date().getFullYear(),
        term: selectedTerm,
        student: {
          id: stu.id,
          name: stu.name,
          admissionNumber: stu.admissionNumber,
          grade: currentClassObj ? currentClassObj.grade : stu.grade,
          section: currentClassObj ? currentClassObj.section : '',
          stream: currentClassObj?.stream,
        },
        rank: rankingItem.rank,
        totalStudentsInClass: students.length,
        subjects: subjectsList,
        totalMarks: rankingItem.totalMarks,
        maxPossibleMarks: Math.max(stuMarks.length * 100, 100),
        averageMarks: rankingItem.avgMarks,
        overallGrade: rankingItem.grade,
        attendanceRate,
        attendancePresent: presentDays,
        attendanceTotal: totalDays,
      });

      setSuccessMsg(`📄 Official Report Card downloaded for ${stu.name} (Term ${selectedTerm})!`);
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Failed to generate report card:', err);
    } finally {
      setDownloadingId(null);
    }
  }

  // ─── Batch Download All Report Cards for the Class ───
  async function handleBatchDownloadReportCards() {
    const studentsWithMarks = classRankings.filter(s => s.subjectsCount > 0);
    if (studentsWithMarks.length === 0) return;

    setBatchDownloading(true);
    try {
      for (const item of studentsWithMarks) {
        handleDownloadReportCard(item);
        await new Promise(res => setTimeout(res, 280));
      }
      setSuccessMsg(`✅ Generated ${studentsWithMarks.length} student report cards for Term ${selectedTerm}!`);
      setTimeout(() => setSuccessMsg(''), 4500);
    } finally {
      setBatchDownloading(false);
    }
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

  // Predefined + any custom / school-specific subjects found in marks or teachers
  const allAvailableSubjects = useMemo(() => {
    const knownIds = new Set(SRI_LANKA_SUBJECTS.map(s => s.id.toLowerCase()));
    const customList: SubjectOption[] = [];

    // Check marks
    marks.forEach(m => {
      if (m.subject && !knownIds.has(m.subject.toLowerCase())) {
        knownIds.add(m.subject.toLowerCase());
        customList.push({
          id: m.subject,
          nameEn: m.subject,
          category: 'elective',
        });
      }
    });

    // Check teachers
    teachers.forEach(t => {
      if (t.subject && t.subject !== 'Not assigned' && !knownIds.has(t.subject.toLowerCase())) {
        knownIds.add(t.subject.toLowerCase());
        customList.push({
          id: t.subject,
          nameEn: t.subject,
          category: 'elective',
        });
      }
      if (t.otherSubjects) {
        t.otherSubjects.forEach(sub => {
          if (sub && !knownIds.has(sub.toLowerCase())) {
            knownIds.add(sub.toLowerCase());
            customList.push({
              id: sub,
              nameEn: sub,
              category: 'elective',
            });
          }
        });
      }
    });

    return [...SRI_LANKA_SUBJECTS, ...customList];
  }, [marks, teachers]);

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
        {/* ── Offline / Sync Status Banner ── */}
        <OfflineBanner networkStatus={networkStatus} />

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
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Subject</label>
              <select className="form-control" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                <optgroup label="Core O/L Compulsory Subjects">
                  {allAvailableSubjects.filter(s => s.category === 'core').map(s => (
                    <option key={s.id} value={s.id}>📘 {s.nameEn}</option>
                  ))}
                </optgroup>
                <optgroup label="Elective & Category Subjects">
                  {allAvailableSubjects.filter(s => s.category === 'elective').map(s => (
                    <option key={s.id} value={s.id}>📙 {s.nameEn}</option>
                  ))}
                </optgroup>
                <optgroup label="Advanced Level (A/L) Stream Subjects">
                  {allAvailableSubjects.filter(s => s.category === 'al').map(s => (
                    <option key={s.id} value={s.id}>🎓 {s.nameEn}</option>
                  ))}
                </optgroup>
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
      {/* ── Offline / Sync Status Banner ── */}
      <OfflineBanner networkStatus={networkStatus} />

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
              {saved
                ? (networkStatus.isOnline ? '✓ Saved!' : '✓ Saved Locally')
                : 'Save Subject Marks'}
            </button>
          )}
          {activeTab === 'by_student' && (
            <button
              className="btn btn-primary"
              onClick={handleSaveStudentMarksheet}
              disabled={saving || !selectedStudentId}
            >
              {saving ? <span className="spinner" /> : <Save size={15} />}
              {saved
                ? (networkStatus.isOnline ? '✓ Saved!' : '✓ Saved Locally')
                : 'Save Student Marksheet'}
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

          {/* Term Selector (1st Term, 2nd Term, 3rd Term) */}
          <div>
            <label className="form-label" style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} style={{ color: 'var(--primary)' }} /> Select Academic Term
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {TERMS.map(tm => {
                const isSelected = selectedTerm === tm;
                const label = tm === 1 ? '1st Term' : tm === 2 ? '2nd Term' : '3rd Term';
                return (
                  <button
                    key={tm}
                    type="button"
                    onClick={() => setSelectedTerm(tm)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(37,99,235,0.18) 0%, rgba(99,102,241,0.12) 100%)'
                        : 'var(--bg-secondary)',
                      color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: isSelected ? 800 : 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '2px',
                      boxShadow: isSelected ? '0 2px 8px rgba(37,99,235,0.18)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{label}</span>
                    <span style={{ fontSize: '10px', opacity: isSelected ? 1 : 0.65, fontWeight: isSelected ? 700 : 400 }}>
                      {isSelected ? '● Active' : 'Select'}
                    </span>
                  </button>
                );
              })}
            </div>
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
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: activeTab === 'class_overview' ? 700 : 500 }}
        >
          <Trophy size={15} style={{ color: activeTab === 'class_overview' ? '#f59e0b' : 'inherit' }} />
          Class Rankings & Report Cards
        </button>
        <button
          className={`tab ${activeTab === 'chart' ? 'active' : ''}`}
          onClick={() => setActiveTab('chart')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <BarChart2 size={15} /> Performance Chart
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
                  {allAvailableSubjects.filter(s => s.category === 'core').map(s => (
                    <option key={s.id} value={s.id}>📘 {s.nameEn}</option>
                  ))}
                </optgroup>
                <optgroup label="Elective & Category Subjects (ICT, Lit, Civics, Commerce, etc.)">
                  {allAvailableSubjects.filter(s => s.category === 'elective').map(s => (
                    <option key={s.id} value={s.id}>📙 {s.nameEn}</option>
                  ))}
                </optgroup>
                <optgroup label="Advanced Level (A/L) Stream Subjects">
                  {allAvailableSubjects.filter(s => s.category === 'al').map(s => (
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
                    <th>Class Standing</th>
                    <th>Admission #</th>
                    <th style={{ width: '150px' }}>Marks (0 - 100)</th>
                    <th style={{ textAlign: 'center', width: '90px' }}>Grade</th>
                    <th style={{ textAlign: 'center' }}>Quick Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const val = parseFloat(markInput[s.id] || '0') || 0;
                    const hasVal = markInput[s.id] !== '' && markInput[s.id] !== undefined;
                    const grade = val >= 75 ? 'A' : val >= 65 ? 'B' : val >= 55 ? 'C' : val >= 35 ? 'S' : 'F';
                    const gradeColor = grade === 'A' ? 'var(--success)' : grade === 'B' ? 'var(--primary-light)' : grade === 'C' ? 'var(--info)' : grade === 'S' ? 'var(--warning)' : 'var(--danger)';
                    const rankItem = classRankings.find(r => r.student.id === s.id);

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
                          {rankItem?.rank === 1 ? (
                            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.18)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.4)', fontWeight: 800 }}>
                              🥇 1st Place
                            </span>
                          ) : rankItem?.rank === 2 ? (
                            <span className="badge" style={{ background: 'rgba(148, 163, 184, 0.2)', color: '#475569', border: '1px solid rgba(148, 163, 184, 0.4)', fontWeight: 800 }}>
                              🥈 2nd Place
                            </span>
                          ) : rankItem?.rank === 3 ? (
                            <span className="badge" style={{ background: 'rgba(217, 119, 6, 0.18)', color: '#9a3412', border: '1px solid rgba(217, 119, 6, 0.4)', fontWeight: 800 }}>
                              🥉 3rd Place
                            </span>
                          ) : rankItem?.rank ? (
                            <span className="badge badge-muted" style={{ fontWeight: 700 }}>
                              #{rankItem.rank} in Class
                            </span>
                          ) : (
                            <span className="badge badge-muted" style={{ opacity: 0.6 }}>—</span>
                          )}
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
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '11px', padding: '3px 8px' }}
                              onClick={() => {
                                setSelectedStudentId(s.id);
                                setActiveTab('by_student');
                              }}
                              title="Open student marksheet"
                            >
                              👤 Marksheet
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => rankItem && handleDownloadReportCard(rankItem)}
                              disabled={!rankItem || rankItem.subjectsCount === 0 || downloadingId === s.id}
                              title="Download Term Report Card (PDF)"
                            >
                              <FileDown size={12} />
                              {downloadingId === s.id ? '...' : 'PDF'}
                            </button>
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
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px' }}>
                  Class: {currentStudentObj.classRoom} (Grade {currentStudentObj.grade})
                </div>

                {/* Live Class Standing Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)' }}>
                  <Trophy size={15} style={{ color: selectedStudentRanking?.rank === 1 ? '#f59e0b' : selectedStudentRanking?.rank === 2 ? '#64748b' : selectedStudentRanking?.rank === 3 ? '#b45309' : 'var(--primary)' }} />
                  <span style={{ fontWeight: 700, fontSize: '12px' }}>
                    {selectedStudentRanking?.rank === 1 ? '🥇 1st Place (Class Champion)'
                      : selectedStudentRanking?.rank === 2 ? '🥈 2nd Place (Runner-Up)'
                      : selectedStudentRanking?.rank === 3 ? '🥉 3rd Place'
                      : selectedStudentRanking?.rank ? `#${selectedStudentRanking.rank} in Class (${selectedStudentRanking.rank} of ${students.length})`
                      : 'Unranked (Awaiting marks)'}
                  </span>
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

              {/* One-Click Student Report Card Download Button */}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => selectedStudentRanking && handleDownloadReportCard(selectedStudentRanking)}
                disabled={!selectedStudentRanking || selectedStudentRanking.subjectsCount === 0 || downloadingId === selectedStudentId}
                style={{
                  width: '100%',
                  marginTop: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  padding: '10px 14px',
                }}
              >
                <FileDown size={16} />
                {downloadingId === selectedStudentId ? 'Generating PDF Report Card...' : `Download Term ${selectedTerm} Report Card`}
              </button>
            </div>
          </div>

          {/* Marksheet Entry Form */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 className="card-title" style={{ margin: 0 }}>Subject Marks Entry</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Enter marks (0-100) for Core and Elective subjects
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => selectedStudentRanking && handleDownloadReportCard(selectedStudentRanking)}
                  disabled={!selectedStudentRanking || selectedStudentRanking.subjectsCount === 0 || downloadingId === selectedStudentId}
                  title="Download Report Card"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FileDown size={14} />
                  Report Card
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveStudentMarksheet}
                  disabled={saving || !selectedStudentId}
                >
                  {saving ? <span className="spinner" /> : <Save size={14} />}
                  {saved ? '✓ Saved!' : 'Save Marksheet'}
                </button>
              </div>
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

      {/* ─── TAB 3: CLASS RANKINGS, BEST PERFORMERS & REPORT CARDS ─── */}
      {activeTab === 'class_overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* ── BEST PERFORMERS PODIUM (1st, 2nd, 3rd Places) ── */}
          <div className="card" style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%)', border: '1.5px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                  <Trophy size={22} style={{ color: '#f59e0b' }} />
                  Class Champions & Best Performers — Term {selectedTerm}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Top 3 academic places of Class {currentClassObj ? `${currentClassObj.grade}${currentClassObj.section}` : selectedClass} based on Term {selectedTerm} average
                </p>
              </div>

              {classRankings.some(s => s.subjectsCount > 0) && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleBatchDownloadReportCards}
                  disabled={batchDownloading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, padding: '8px 14px' }}
                >
                  <Download size={14} />
                  {batchDownloading ? 'Downloading All PDFs...' : `Download All Report Cards (Term ${selectedTerm})`}
                </button>
              )}
            </div>

            {/* 3 Podium Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* 🥇 1st Place Card (Gold) */}
              <div style={{
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(251, 191, 36, 0.05) 100%)',
                border: '2px solid rgba(245, 158, 11, 0.5)',
                padding: '18px 20px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 6px 20px rgba(245, 158, 11, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: '#ffffff',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.5px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
                    }}>
                      🥇 1st Place • Class Champion
                    </span>
                    <Trophy size={26} style={{ color: '#f59e0b' }} />
                  </div>

                  {firstPlace ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedProfileStudentId(firstPlace.student.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          textAlign: 'left',
                          cursor: 'pointer',
                          color: 'inherit',
                          display: 'block',
                          marginBottom: '4px',
                        }}
                        title="Click to view full student profile"
                      >
                        <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                          {firstPlace.student.name}
                        </h4>
                      </button>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', fontFamily: 'monospace' }}>
                        Adm No: <span style={{ fontWeight: 700, color: '#d97706' }}>{firstPlace.student.admissionNumber || firstPlace.student.id}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px', background: 'var(--bg-card)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '19px', fontWeight: 900, color: '#d97706' }}>{firstPlace.avgMarks}%</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Average</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--text-primary)' }}>{firstPlace.totalMarks}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '19px', fontWeight: 900, color: '#10b981' }}>{firstPlace.grade}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Grade</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <p style={{ margin: 0, fontSize: '13px' }}>Awaiting mark submissions for Term {selectedTerm}</p>
                    </div>
                  )}
                </div>

                {firstPlace && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => handleDownloadReportCard(firstPlace)}
                    disabled={downloadingId === firstPlace.student.id}
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                    }}
                  >
                    <FileDown size={14} />
                    {downloadingId === firstPlace.student.id ? 'Generating...' : 'Download Report Card (PDF)'}
                  </button>
                )}
              </div>

              {/* 🥈 2nd Place Card (Silver) */}
              <div style={{
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.12) 0%, rgba(203, 213, 225, 0.05) 100%)',
                border: '2px solid rgba(148, 163, 184, 0.45)',
                padding: '18px 20px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 6px 20px rgba(100, 116, 139, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{
                      background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                      color: '#ffffff',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.5px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 8px rgba(100, 116, 139, 0.3)',
                    }}>
                      🥈 2nd Place • Runner-Up
                    </span>
                    <Medal size={26} style={{ color: '#94a3b8' }} />
                  </div>

                  {secondPlace ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedProfileStudentId(secondPlace.student.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          textAlign: 'left',
                          cursor: 'pointer',
                          color: 'inherit',
                          display: 'block',
                          marginBottom: '4px',
                        }}
                        title="Click to view full student profile"
                      >
                        <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                          {secondPlace.student.name}
                        </h4>
                      </button>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', fontFamily: 'monospace' }}>
                        Adm No: <span style={{ fontWeight: 700, color: '#64748b' }}>{secondPlace.student.admissionNumber || secondPlace.student.id}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px', background: 'var(--bg-card)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(148, 163, 184, 0.25)' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '19px', fontWeight: 900, color: '#64748b' }}>{secondPlace.avgMarks}%</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Average</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--text-primary)' }}>{secondPlace.totalMarks}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '19px', fontWeight: 900, color: '#10b981' }}>{secondPlace.grade}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Grade</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <p style={{ margin: 0, fontSize: '13px' }}>Awaiting mark submissions</p>
                    </div>
                  )}
                </div>

                {secondPlace && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => handleDownloadReportCard(secondPlace)}
                    disabled={downloadingId === secondPlace.student.id}
                    style={{
                      background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '0 2px 8px rgba(100, 116, 139, 0.25)',
                    }}
                  >
                    <FileDown size={14} />
                    {downloadingId === secondPlace.student.id ? 'Generating...' : 'Download Report Card (PDF)'}
                  </button>
                )}
              </div>

              {/* 🥉 3rd Place Card (Bronze) */}
              <div style={{
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.1) 0%, rgba(180, 83, 9, 0.04) 100%)',
                border: '2px solid rgba(217, 119, 6, 0.4)',
                padding: '18px 20px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 6px 20px rgba(217, 119, 6, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{
                      background: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)',
                      color: '#ffffff',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.5px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 8px rgba(180, 83, 9, 0.3)',
                    }}>
                      🥉 3rd Place
                    </span>
                    <Medal size={26} style={{ color: '#b45309' }} />
                  </div>

                  {thirdPlace ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedProfileStudentId(thirdPlace.student.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          textAlign: 'left',
                          cursor: 'pointer',
                          color: 'inherit',
                          display: 'block',
                          marginBottom: '4px',
                        }}
                        title="Click to view full student profile"
                      >
                        <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                          {thirdPlace.student.name}
                        </h4>
                      </button>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', fontFamily: 'monospace' }}>
                        Adm No: <span style={{ fontWeight: 700, color: '#b45309' }}>{thirdPlace.student.admissionNumber || thirdPlace.student.id}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px', background: 'var(--bg-card)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(217, 119, 6, 0.25)' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '19px', fontWeight: 900, color: '#b45309' }}>{thirdPlace.avgMarks}%</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Average</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--text-primary)' }}>{thirdPlace.totalMarks}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '19px', fontWeight: 900, color: '#10b981' }}>{thirdPlace.grade}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Grade</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <p style={{ margin: 0, fontSize: '13px' }}>Awaiting mark submissions</p>
                    </div>
                  )}
                </div>

                {thirdPlace && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => handleDownloadReportCard(thirdPlace)}
                    disabled={downloadingId === thirdPlace.student.id}
                    style={{
                      background: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '0 2px 8px rgba(180, 83, 9, 0.25)',
                    }}
                  >
                    <FileDown size={14} />
                    {downloadingId === thirdPlace.student.id ? 'Generating...' : 'Download Report Card (PDF)'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── COMPLETE CLASS RANKINGS LEADERBOARD & MARKSHEET ── */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={18} style={{ color: 'var(--primary)' }} />
                  Class {selectedClass} Complete Rankings & Academic Marksheet
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Showing 1st, 2nd, 3rd, and all respective student places for Term {selectedTerm} Examination ({classRankings.filter(s => s.subjectsCount > 0).length} of {students.length} graded)
                </p>
              </div>

              {/* Search & Filter Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '260px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search student or admission #..."
                    value={rankingsSearch}
                    onChange={e => setRankingsSearch(e.target.value)}
                    style={{ paddingLeft: '32px', fontSize: '13px', height: '36px' }}
                  />
                </div>
              </div>
            </div>

            {students.length === 0 ? (
              <div className="empty-state"><p>{t('noStudents', language)}</p></div>
            ) : filteredRankings.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 20px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>No student matched "{rankingsSearch}"</p>
              </div>
            ) : (
              <div className="table-wrapper" style={{ border: 'none', overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center', width: '90px' }}>Class Place</th>
                      <th>Student Name</th>
                      <th>Admission #</th>
                      {SRI_LANKA_SUBJECTS.slice(0, 6).map(s => (
                        <th key={s.id} style={{ textAlign: 'center', fontSize: '11px' }}>{s.id}</th>
                      ))}
                      <th style={{ textAlign: 'center', width: '70px' }}>Subjects</th>
                      <th style={{ textAlign: 'center', width: '80px', fontWeight: 700 }}>Total</th>
                      <th style={{ textAlign: 'center', width: '85px', fontWeight: 700 }}>Average</th>
                      <th style={{ textAlign: 'center', width: '60px' }}>Grade</th>
                      <th style={{ textAlign: 'center', width: '160px' }}>Report Card Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRankings.map((item) => {
                      const s = item.student;
                      const hasMarks = item.subjectsCount > 0;
                      const rank = item.rank;

                      return (
                        <tr key={s.id} style={{ background: rank === 1 ? 'rgba(245, 158, 11, 0.04)' : rank === 2 ? 'rgba(148, 163, 184, 0.04)' : rank === 3 ? 'rgba(217, 119, 6, 0.04)' : undefined }}>
                          {/* Class Standing / Place Badge */}
                          <td style={{ textAlign: 'center' }}>
                            {rank === 1 ? (
                              <span className="badge" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#ffffff', fontWeight: 900, padding: '4px 8px', fontSize: '11px', boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)' }}>
                                🥇 1st
                              </span>
                            ) : rank === 2 ? (
                              <span className="badge" style={{ background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)', color: '#ffffff', fontWeight: 900, padding: '4px 8px', fontSize: '11px', boxShadow: '0 2px 6px rgba(100, 116, 139, 0.3)' }}>
                                🥈 2nd
                              </span>
                            ) : rank === 3 ? (
                              <span className="badge" style={{ background: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)', color: '#ffffff', fontWeight: 900, padding: '4px 8px', fontSize: '11px', boxShadow: '0 2px 6px rgba(180, 83, 9, 0.3)' }}>
                                🥉 3rd
                              </span>
                            ) : rank !== null ? (
                              <span className="badge badge-muted" style={{ fontWeight: 800, minWidth: '42px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                                #{rank}
                              </span>
                            ) : (
                              <span className="badge badge-muted" style={{ opacity: 0.5 }}>—</span>
                            )}
                          </td>

                          {/* Student Name */}
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

                          {/* Admission Number */}
                          <td>
                            <span className="badge badge-primary" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                              {s.admissionNumber || s.id}
                            </span>
                          </td>

                          {/* 6 Core Subjects Marks Columns */}
                          {SRI_LANKA_SUBJECTS.slice(0, 6).map(sub => {
                            const subMark = item.marksBySubject[sub.id];
                            return (
                              <td key={sub.id} style={{ textAlign: 'center', fontWeight: subMark !== undefined ? 600 : 400 }}>
                                {subMark !== undefined ? (
                                  <span style={{ color: subMark >= 75 ? 'var(--success)' : subMark >= 50 ? 'var(--text-primary)' : 'var(--danger)' }}>
                                    {subMark}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Subjects Count */}
                          <td style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                            {item.subjectsCount > 0 ? `${item.subjectsCount} subs` : '—'}
                          </td>

                          {/* Total Marks */}
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {hasMarks ? item.totalMarks : '—'}
                          </td>

                          {/* Average Marks */}
                          <td style={{ textAlign: 'center', fontWeight: 800 }}>
                            {hasMarks ? (
                              <span style={{ color: item.avgMarks >= 75 ? 'var(--success)' : item.avgMarks >= 60 ? 'var(--primary-light)' : item.avgMarks >= 35 ? 'var(--warning)' : 'var(--danger)' }}>
                                {item.avgMarks}%
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>

                          {/* Overall Grade */}
                          <td style={{ textAlign: 'center' }}>
                            {hasMarks ? (
                              <span className={`badge ${item.grade === 'A' ? 'badge-success' : item.grade === 'B' ? 'badge-primary' : item.grade === 'C' ? 'badge-info' : item.grade === 'S' ? 'badge-warning' : 'badge-danger'}`} style={{ fontWeight: 800 }}>
                                {item.grade}
                              </span>
                            ) : (
                              <span className="badge badge-muted">—</span>
                            )}
                          </td>

                          {/* Report Card Action Buttons */}
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleDownloadReportCard(item)}
                                disabled={!hasMarks || downloadingId === s.id}
                                style={{
                                  fontSize: '11px',
                                  padding: '4px 10px',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: hasMarks ? 'rgba(37,99,235,0.1)' : undefined,
                                  color: hasMarks ? 'var(--primary)' : undefined,
                                  border: hasMarks ? '1px solid rgba(37,99,235,0.3)' : undefined,
                                }}
                                title={hasMarks ? 'Download official report card PDF' : 'Enter marks before downloading report card'}
                              >
                                <FileDown size={13} />
                                {downloadingId === s.id ? 'Generating...' : 'Report Card'}
                              </button>

                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setSelectedStudentId(s.id);
                                  setActiveTab('by_student');
                                }}
                                style={{ fontSize: '11px', padding: '4px 8px' }}
                                title="Edit marksheet for this student"
                              >
                                ✏️ Edit
                              </button>
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

      {/* ─── TAB 4: PERFORMANCE CHART ─── */}
      {activeTab === 'chart' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            paddingBottom: '16px',
            marginBottom: '20px',
            borderBottom: '1px solid var(--border)'
          }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px', margin: 0 }}>
                <BarChart2 size={20} style={{ color: 'var(--primary)' }} />
                <span>{selectedSubject} Performance Chart</span>
                <span className="badge badge-primary" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Class {selectedClass} • Term {selectedTerm}
                </span>
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                Individual student mark distribution and score visualization for {selectedSubject}.
              </p>
            </div>

            {/* Subject Selector to choose other subjects */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Select Subject:
              </label>
              <select
                className="form-control"
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
                style={{ fontSize: '14px', fontWeight: 600, minWidth: '240px', padding: '8px 14px' }}
              >
                <optgroup label="Core O/L Compulsory Subjects (6 Mains)">
                  {allAvailableSubjects.filter(s => s.category === 'core').map(s => (
                    <option key={s.id} value={s.id}>📘 {s.nameEn}</option>
                  ))}
                </optgroup>
                <optgroup label="Elective & Category Subjects (ICT, Commerce, Lit, etc.)">
                  {allAvailableSubjects.filter(s => s.category === 'elective').map(s => (
                    <option key={s.id} value={s.id}>📙 {s.nameEn}</option>
                  ))}
                </optgroup>
                <optgroup label="Advanced Level (A/L) Stream Subjects">
                  {allAvailableSubjects.filter(s => s.category === 'al').map(s => (
                    <option key={s.id} value={s.id}>🎓 {s.nameEn}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="empty-state" style={{ padding: '50px 20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>{t('noData', language)}</p>
            </div>
          ) : (
            <div className="chart-container" style={{ height: '400px' }}>
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
