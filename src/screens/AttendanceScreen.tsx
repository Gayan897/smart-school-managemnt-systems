import React, { useEffect, useState, useCallback, useMemo, Fragment } from 'react';
import {
  Save, UserPlus, Eye, AlertTriangle, GraduationCap,
  RefreshCw, UserCheck, Send, PhoneCall, Check, ExternalLink, X,
  Trash2, Copy, Sparkles, Smartphone, Share2, ShieldCheck, QrCode, Laptop,
  Calendar, Clock, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Users, Search, AlertCircle, Filter, MessageCircle, BarChart2
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
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

  // SMS sent tracking per student
  const [smsSent, setSmsSent] = useState<Record<string, boolean>>({});

  // Desktop SMS Dispatch Modal State
  const [activeSmsModalItem, setActiveSmsModalItem] = useState<{
    student: Student;
    status: AttendanceStatus;
    payload: ReturnType<typeof databaseService.generateParentAlertMessage>;
  } | null>(null);
  const [copiedSmsAlert, setCopiedSmsAlert] = useState(false);
  const [copiedQuickId, setCopiedQuickId] = useState<string | null>(null);

  // Safe SMS Dispatch Handler: avoids unhandled sms: protocol triggering Bing search in Windows / Edge
  function handleSendSms(item: {
    student: Student;
    status: AttendanceStatus;
    payload: ReturnType<typeof databaseService.generateParentAlertMessage>;
  }) {
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const cleanPhone = (item.payload.parentPhone || '').replace(/[^\d+]/g, '');
    const isApple = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile) {
      // Mobile device: native SMS app handles sms: URI natively without Bing redirection
      const smsUri = `sms:${cleanPhone}${isApple ? '&' : '?'}body=${encodeURIComponent(item.payload.messageText)}`;
      window.location.href = smsUri;
      setSmsSent(prev => ({ ...prev, [item.student.id]: true }));
    } else {
      // Desktop (Windows/Mac): NEVER navigate directly to sms: because Edge/Windows redirects unhandled protocols to Bing search!
      // Instead, open our interactive Desktop SMS Dispatch Console with QR Code, Copy, and Web Messages options
      setActiveSmsModalItem(item);
    }
  }

  // 1-Click quick copy of alert and phone number
  async function handleQuickCopySms(item: {
    student: Student;
    payload: ReturnType<typeof databaseService.generateParentAlertMessage>;
  }) {
    const textToCopy = `To: ${item.payload.parentPhone}\n\n${item.payload.messageText}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedQuickId(item.student.id);
      setTimeout(() => setCopiedQuickId(null), 3000);
    } catch {
      // fallback
    }
  }

  // Safely trigger Windows Phone Link / SMS via hidden iframe without opening Bing
  function handleSafePhoneLink(phone: string, text: string) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = `sms:${phone}?body=${encodeURIComponent(text)}`;
    document.body.appendChild(iframe);
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch {}
    }, 1200);
  }

  // Principal filters & period selection
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [periodType, setPeriodType] = useState<'term' | 'monthly' | 'weekly' | 'daily'>('term');
  const [selectedTerm, setSelectedTerm] = useState<number>(3); // Default to Term 3 (Sep - Dec) for current month
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedWeekDate, setSelectedWeekDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Low Attendance tracking state
  const [lowAttendanceThreshold, setLowAttendanceThreshold] = useState<number>(75);
  const [lowAttendanceScope, setLowAttendanceScope] = useState<'period' | 'all_time'>('period');
  const [lowAttSearch, setLowAttSearch] = useState<string>('');

  // Expandable class row state in Principal class table
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);

  // Demo seeding state
  const [seedingData, setSeedingData] = useState(false);
  const [seedSuccessMsg, setSeedSuccessMsg] = useState<string | null>(null);

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

    // Real-time students subscription — updates immediately when students or parents register / login via mobile
    const unsubStudents = databaseService.subscribeToStudents(
      (liveStudents) => {
        setAllStudents(liveStudents);
      },
      undefined,
      (err) => console.error('Real-time students error:', err)
    );

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
    return () => {
      unsub();
      unsubStudents();
    };
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

  // ─── Week Range Calculation Helpers ───
  function getWeekBounds(dateStr: string) {
    const base = new Date(dateStr + 'T00:00:00');
    const day = base.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(base);
    mon.setDate(base.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return {
      startDate: mon.toISOString().split('T')[0],
      endDate: sun.toISOString().split('T')[0],
      mon,
      sun,
    };
  }

  function handleShiftWeek(direction: -1 | 1) {
    const d = new Date(selectedWeekDate + 'T00:00:00');
    d.setDate(d.getDate() + (direction * 7));
    setSelectedWeekDate(d.toISOString().split('T')[0]);
  }

  // ─── Principal: Active Period Date Bounds & Labels ───
  const periodDateRange = useMemo(() => {
    if (periodType === 'daily') {
      const d = new Date(selectedDate + 'T00:00:00');
      const formatted = isNaN(d.getTime())
        ? selectedDate
        : d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      return {
        startDate: selectedDate,
        endDate: selectedDate,
        label: formatted,
        badgeText: `Single Day: ${selectedDate}`,
      };
    }

    if (periodType === 'weekly') {
      const { startDate, endDate, mon, sun } = getWeekBounds(selectedWeekDate);
      const monStr = mon.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const sunStr = sun.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      return {
        startDate,
        endDate,
        label: `${monStr} – ${sunStr}`,
        badgeText: `Weekly Window: ${startDate} to ${endDate}`,
      };
    }

    if (periodType === 'monthly') {
      const [yStr, mStr] = selectedMonth.split('-');
      const y = parseInt(yStr, 10) || new Date().getFullYear();
      const m = parseInt(mStr, 10) || (new Date().getMonth() + 1);
      const lastDay = new Date(y, m, 0).getDate();
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const monthName = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      return {
        startDate,
        endDate,
        label: monthName,
        badgeText: `Monthly Window: ${startDate} to ${endDate}`,
      };
    }

    // Term-wise (Sri Lankan School Academic Calendar)
    const y = selectedAcademicYear;
    let startDate = `${y}-01-01`;
    let endDate = `${y}-04-30`;
    let termName = `Term 1 (First Term, ${y})`;
    if (selectedTerm === 2) {
      startDate = `${y}-05-01`;
      endDate = `${y}-08-31`;
      termName = `Term 2 (Second Term, ${y})`;
    } else if (selectedTerm === 3) {
      startDate = `${y}-09-01`;
      endDate = `${y}-12-31`;
      termName = `Term 3 (Third Term, ${y})`;
    }
    return {
      startDate,
      endDate,
      label: termName,
      badgeText: `Term Window: ${startDate} to ${endDate}`,
    };
  }, [periodType, selectedDate, selectedWeekDate, selectedMonth, selectedTerm, selectedAcademicYear]);

  // ─── Filtered Attendance Records for Active Period ───
  const periodRecords = useMemo(() => {
    if (!isPrincipal) return [];
    const { startDate, endDate } = periodDateRange;
    return existing.filter(a => {
      const d = a.date.split('T')[0];
      return d >= startDate && d <= endDate;
    });
  }, [isPrincipal, existing, periodDateRange]);

  // ─── Principal: Class-wise Attendance & Percentages for Selected Period ───
  const classWiseData = useMemo(() => {
    if (!isPrincipal) return [];

    return filteredClasses.map(cls => {
      const classStudents = allStudents.filter(s => s.classRoom === cls.id);
      const classStudentIds = new Set(classStudents.map(s => s.id));
      const classRecords = periodRecords.filter(r => classStudentIds.has(r.studentId));

      const present = classRecords.filter(r => r.status === 'present').length;
      const absent = classRecords.filter(r => r.status === 'absent').length;
      const late = classRecords.filter(r => r.status === 'late').length;
      const excused = classRecords.filter(r => r.status === 'excused').length;
      const total = classRecords.length;

      // Percentage calculations
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      const absentRate = total > 0 ? Math.round((absent / total) * 100) : 0;
      const lateRate = total > 0 ? Math.round((late / total) * 100) : 0;
      const excusedRate = total > 0 ? Math.round((excused / total) * 100) : 0;

      // Individual student breakdown for this class in this period
      const studentBreakdown = classStudents.map(s => {
        const sRecs = classRecords.filter(r => r.studentId === s.id);
        const sTotal = sRecs.length;
        const sPresent = sRecs.filter(r => r.status === 'present').length;
        const sAbsent = sRecs.filter(r => r.status === 'absent').length;
        const sLate = sRecs.filter(r => r.status === 'late').length;
        const sExcused = sRecs.filter(r => r.status === 'excused').length;
        const sRate = sTotal > 0 ? Math.round((sPresent / sTotal) * 100) : 0;
        return {
          student: s,
          total: sTotal,
          present: sPresent,
          absent: sAbsent,
          late: sLate,
          excused: sExcused,
          rate: sRate,
        };
      }).sort((a, b) => a.rate - b.rate);

      return {
        classId: cls.id,
        grade: cls.grade,
        section: cls.section,
        stream: cls.stream,
        homeroomTeacherName: cls.homeroomTeacherName,
        totalStudents: classStudents.length,
        present,
        absent,
        late,
        excused,
        total,
        rate,
        absentRate,
        lateRate,
        excusedRate,
        studentBreakdown,
      };
    });
  }, [isPrincipal, periodRecords, filteredClasses, allStudents]);

  // ─── Principal: Overall Summary across Filtered Classes ───
  const overallSummary = useMemo(() => {
    if (!isPrincipal) return null;
    const present = classWiseData.reduce((s, c) => s + c.present, 0);
    const absent = classWiseData.reduce((s, c) => s + c.absent, 0);
    const late = classWiseData.reduce((s, c) => s + c.late, 0);
    const excused = classWiseData.reduce((s, c) => s + c.excused, 0);
    const total = present + absent + late + excused;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    const totalStudents = classWiseData.reduce((s, c) => s + c.totalStudents, 0);
    return { present, absent, late, excused, total, rate, totalStudents };
  }, [isPrincipal, classWiseData]);

  // ─── Principal: Low Attendance Students (< threshold %) ───
  const lowAttendanceStudents = useMemo(() => {
    if (!isPrincipal) return [];

    const classIds = new Set(filteredClasses.map(c => c.id));
    const relevantStudents = allStudents.filter(s => classIds.has(s.classRoom));

    // Choose target record pool based on scope
    const targetPool = lowAttendanceScope === 'period' ? periodRecords : existing;

    const result: {
      student: Student;
      totalRecords: number;
      presentCount: number;
      absentCount: number;
      lateCount: number;
      rate: number;
      riskLevel: 'critical' | 'at_risk';
    }[] = [];

    for (const student of relevantStudents) {
      const studentRecords = targetPool.filter(r => r.studentId === student.id);
      if (studentRecords.length === 0) continue; // skip if student has no records in this timeframe

      const presentCount = studentRecords.filter(r => r.status === 'present').length;
      const absentCount = studentRecords.filter(r => r.status === 'absent').length;
      const lateCount = studentRecords.filter(r => r.status === 'late').length;
      const rate = Math.round((presentCount / studentRecords.length) * 100);

      if (rate < lowAttendanceThreshold) {
        result.push({
          student,
          totalRecords: studentRecords.length,
          presentCount,
          absentCount,
          lateCount,
          rate,
          riskLevel: rate < 50 ? 'critical' : 'at_risk',
        });
      }
    }

    // Filter by search query if entered
    const query = lowAttSearch.trim().toLowerCase();
    const filtered = query
      ? result.filter(r =>
          r.student.name.toLowerCase().includes(query) ||
          r.student.id.toLowerCase().includes(query) ||
          (r.student.admissionNumber && r.student.admissionNumber.toLowerCase().includes(query)) ||
          r.student.classRoom.toLowerCase().includes(query)
        )
      : result;

    // Sort by rate ascending (worst attendance first)
    return filtered.sort((a, b) => a.rate - b.rate);
  }, [isPrincipal, filteredClasses, allStudents, periodRecords, existing, lowAttendanceScope, lowAttendanceThreshold, lowAttSearch]);

  // ─── Demonstration / Benchmark Attendance Generator for Principal Testing ───
  async function handleSeedDemoAttendance() {
    if (allStudents.length === 0) return;
    setSeedingData(true);
    try {
      const datesToGenerate = [
        // Term 1 (Feb, Mar, Apr 2026)
        '2026-02-02', '2026-02-09', '2026-02-16', '2026-03-02', '2026-03-16', '2026-04-06',
        // Term 2 (Jun, Jul, Aug 2026)
        '2026-06-01', '2026-06-15', '2026-07-06', '2026-07-20', '2026-08-03', '2026-08-17',
        // Term 3 (Sep 2026)
        '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'
      ];

      const records: AttendanceRecord[] = [];
      for (let i = 0; i < allStudents.length; i++) {
        const student = allStudents[i];
        // Create realistic profiles: high, moderate, and low attendance
        const profileRate = i === 0 ? 0.95 : i === 1 ? 0.62 : i === 2 ? 0.44 : 0.85;

        for (const d of datesToGenerate) {
          const rand = Math.random();
          let status: AttendanceStatus = 'present';
          if (rand > profileRate) {
            status = rand > (profileRate + 0.15) ? 'absent' : 'late';
          }
          records.push({
            id: `seed_${student.id}_${d.replace(/-/g, '')}`,
            studentId: student.id,
            date: d,
            status,
          });
        }
      }

      for (const rec of records) {
        await databaseService.saveAttendance(rec);
      }
      setSeedSuccessMsg(`✓ Generated ${records.length} sample attendance records across Terms 1, 2, and 3!`);
      setTimeout(() => setSeedSuccessMsg(null), 5000);
    } catch (e) {
      console.error('Failed to populate demo attendance records:', e);
    } finally {
      setSeedingData(false);
    }
  }

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <span className="spinner spinner-lg" />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // PRINCIPAL VIEW — Term-wise, Monthly, Weekly with Percentages & Low Attendance
  // ═══════════════════════════════════════════════════════════════════
  if (isPrincipal) {
    const chartData = classWiseData
      .filter(c => c.total > 0)
      .map(c => ({
        name: `Gr ${c.grade}${c.section}`,
        rate: c.rate,
        present: c.present,
        total: c.total,
      }));

    return (
      <div className="page">
        {/* ── Page Header ── */}
        <div className="page-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 className="page-title">{t('attendance', language)}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <p className="page-subtitle" style={{ margin: 0 }}>
                Principal Academic Governance & Attendance Intelligence
              </p>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {existing.length < 15 && (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSeedDemoAttendance}
                disabled={seedingData || allStudents.length === 0}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', border: 'none' }}
                title="Populate realistic attendance records for Term 1, Term 2, and Term 3"
              >
                <Sparkles size={14} />
                {seedingData ? 'Populating...' : '⚡ Seed Demo Term Data'}
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-card)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <Users size={15} color="var(--primary)" />
              <span><strong>{allStudents.length}</strong> Enrolled Students</span>
            </div>
          </div>
        </div>

        {/* Demo feedback toast */}
        {seedSuccessMsg && (
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', color: '#10b981', padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={16} />
            {seedSuccessMsg}
          </div>
        )}

        {/* ── Period Selector & Control Center ── */}
        <div className="card" style={{ marginBottom: '20px', border: '1px solid var(--border)' }}>
          {/* Period Tabs: Term-wise | Monthly | Weekly | Daily */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingBottom: '16px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
            {[
              { id: 'term' as const, label: t('termWise', language), icon: Calendar, desc: '3 Sri Lankan School Terms' },
              { id: 'monthly' as const, label: t('monthly', language), icon: BarChart2, desc: 'Full Calendar Month' },
              { id: 'weekly' as const, label: t('weekly', language), icon: Clock, desc: '7-Day Academic Week' },
              { id: 'daily' as const, label: t('daily', language), icon: Eye, desc: 'Single Specific Day' },
            ].map(tab => {
              const active = periodType === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setPeriodType(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: active ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-hover)',
                    color: active ? 'var(--primary)' : 'var(--text-color)',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={16} color={active ? 'var(--primary)' : 'var(--text-muted)'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sub-controls based on active period */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
            {/* 1. Grade Selector (Always visible) */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>{t('selectGrade', language)}</label>
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

            {/* 2. Controls when TERM-WISE */}
            {periodType === 'term' && (
              <>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Academic Term</label>
                  <select
                    className="form-control"
                    value={selectedTerm}
                    onChange={e => setSelectedTerm(Number(e.target.value))}
                    style={{ fontWeight: 600 }}
                  >
                    <option value={1}>{t('term1', language)}</option>
                    <option value={2}>{t('term2', language)}</option>
                    <option value={3}>{t('term3', language)}</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Academic Year</label>
                  <select
                    className="form-control"
                    value={selectedAcademicYear}
                    onChange={e => setSelectedAcademicYear(Number(e.target.value))}
                  >
                    {[2026, 2025, 2024].map(y => (
                      <option key={y} value={y}>{y} Academic Year</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* 3. Controls when MONTHLY */}
            {periodType === 'monthly' && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Select Month & Year</label>
                <input
                  type="month"
                  className="form-control"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                />
              </div>
            )}

            {/* 4. Controls when WEEKLY */}
            {periodType === 'weekly' && (
              <>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Week Containing Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={selectedWeekDate}
                    onChange={e => setSelectedWeekDate(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleShiftWeek(-1)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', border: '1px solid var(--border)' }}
                    title="Previous Week"
                  >
                    <ChevronLeft size={14} /> {t('prevWeek', language)}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedWeekDate(new Date().toISOString().split('T')[0])}
                    style={{ border: '1px solid var(--border)', fontSize: '11px', fontWeight: 600 }}
                  >
                    {t('currentWeek', language)}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleShiftWeek(1)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', border: '1px solid var(--border)' }}
                    title="Next Week"
                  >
                    {t('nextWeek', language)} <ChevronRight size={14} />
                  </button>
                </div>
              </>
            )}

            {/* 5. Controls when DAILY */}
            {periodType === 'daily' && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>{t('selectDate', language)}</label>
                <input
                  id="att-date"
                  type="date"
                  className="form-control"
                  value={selectedDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setSelectedDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Active Period Date Bounds Badge */}
          <div style={{
            marginTop: '16px',
            padding: '10px 14px',
            background: 'var(--bg-hover)',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={15} color="var(--primary)" />
              <span style={{ fontWeight: 700, color: 'var(--text-color)' }}>
                {periodDateRange.label}
              </span>
              <span className="badge" style={{ fontSize: '10px', background: 'rgba(2, 132, 199, 0.15)', color: 'var(--primary)' }}>
                {periodDateRange.badgeText}
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              Logged Attendance Records in Scope: <strong style={{ color: 'var(--text-color)' }}>{periodRecords.length}</strong>
            </div>
          </div>
        </div>

        {/* ── Overall Summary Stats (As Percentages) ── */}
        <div className="stats-grid" style={{ marginBottom: '20px' }}>
          {/* Main Attendance Rate Card */}
          <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)', position: 'relative' }}>
            <div className="stat-icon" style={{ background: 'rgba(2, 132, 199, 0.15)' }}>
              <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }}>%</span>
            </div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: 'var(--primary)' }}>
                {overallSummary && overallSummary.total > 0 ? `${overallSummary.rate}%` : '0%'}
              </div>
              <div className="stat-label">{t('overallAttendanceRate', language)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {overallSummary?.total || 0} total sessions recorded
              </div>
            </div>
          </div>

          {/* Present */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
              <UserCheck size={20} color="var(--success)" />
            </div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: 'var(--success)' }}>
                {overallSummary && overallSummary.total > 0
                  ? `${Math.round((overallSummary.present / overallSummary.total) * 100)}%`
                  : '0%'}
              </div>
              <div className="stat-label">{t('present', language)} ({overallSummary?.present || 0})</div>
            </div>
          </div>

          {/* Absent */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
              <AlertTriangle size={20} color="var(--danger)" />
            </div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: 'var(--danger)' }}>
                {overallSummary && overallSummary.total > 0
                  ? `${Math.round((overallSummary.absent / overallSummary.total) * 100)}%`
                  : '0%'}
              </div>
              <div className="stat-label">{t('absent', language)} ({overallSummary?.absent || 0})</div>
            </div>
          </div>

          {/* Late */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
              <Clock size={20} color="var(--warning)" />
            </div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: 'var(--warning)' }}>
                {overallSummary && overallSummary.total > 0
                  ? `${Math.round((overallSummary.late / overallSummary.total) * 100)}%`
                  : '0%'}
              </div>
              <div className="stat-label">{t('late', language)} ({overallSummary?.late || 0})</div>
            </div>
          </div>

          {/* Excused */}
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>
              <ShieldCheck size={20} color="var(--info)" />
            </div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: 'var(--info)' }}>
                {overallSummary && overallSummary.total > 0
                  ? `${Math.round((overallSummary.excused / overallSummary.total) * 100)}%`
                  : '0%'}
              </div>
              <div className="stat-label">{t('excused', language)} ({overallSummary?.excused || 0})</div>
            </div>
          </div>
        </div>

        {/* ── Visual Class Comparison Bar Chart ── */}
        {chartData.length > 0 && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={18} color="var(--primary)" />
                Class Attendance Percentage Comparison ({periodDateRange.label})
              </h3>
              <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} /> &ge; 80% High
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} /> 65-79% Fair
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> &lt; 65% Low
                </span>
              </div>
            </div>
            <div style={{ width: '100%', height: 220, marginTop: '12px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} stroke="var(--text-muted)" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(val: any) => [`${val}% Attendance Rate`, 'Rate']}
                  />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => {
                      const fill = entry.rate >= 80 ? '#10b981' : entry.rate >= 65 ? '#f59e0b' : '#ef4444';
                      return <Cell key={`cell-${index}`} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Class-wise Attendance Table with Percentages & Expandable Rosters ── */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">{t('classWiseSummary', language)} — {periodDateRange.label}</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Click row or expand icon to view individual student percentages
            </span>
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
                    <th style={{ width: '40px' }}></th>
                    <th>{t('class', language)}</th>
                    <th>{t('stream', language)}</th>
                    <th>Teacher</th>
                    <th style={{ textAlign: 'center' }}>{t('totalStudents', language)}</th>
                    <th style={{ textAlign: 'center' }}>Sessions</th>
                    <th style={{ textAlign: 'center', color: 'var(--success)' }}>{t('present', language)} (%)</th>
                    <th style={{ textAlign: 'center', color: 'var(--danger)' }}>{t('absent', language)} (%)</th>
                    <th style={{ textAlign: 'center', color: 'var(--warning)' }}>{t('late', language)} (%)</th>
                    <th style={{ textAlign: 'center', minWidth: '130px' }}>{t('attendanceRate', language)}</th>
                  </tr>
                </thead>
                <tbody>
                  {classWiseData.map(row => {
                    const isExpanded = expandedClassId === row.classId;
                    const badgeClass = row.total > 0
                      ? row.rate >= 80 ? 'badge-success' : row.rate >= 65 ? 'badge-warning' : 'badge-danger'
                      : 'badge-muted';

                    return (
                      <React.Fragment key={row.classId}>
                        <tr
                          style={{ cursor: 'pointer', background: isExpanded ? 'var(--bg-hover)' : undefined }}
                          onClick={() => setExpandedClassId(isExpanded ? null : row.classId)}
                        >
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </td>
                          <td style={{ fontWeight: 700, fontSize: '14px' }}>
                            Grade {row.grade}{row.section}
                          </td>
                          <td>
                            <span className="badge badge-primary" style={{ fontSize: '10px' }}>
                              {row.stream === 'ol' ? t('olStream', language) : t('alStream', language)}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {row.homeroomTeacherName || '—'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.totalStudents}</td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{row.total}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                              {row.present} <span style={{ fontSize: '11px', opacity: 0.8 }}>({row.rate}%)</span>
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                              {row.absent} <span style={{ fontSize: '11px', opacity: 0.8 }}>({row.absentRate}%)</span>
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                              {row.late} <span style={{ fontSize: '11px', opacity: 0.8 }}>({row.lateRate}%)</span>
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {row.total > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                <span className={`badge ${badgeClass}`} style={{ fontSize: '12px', fontWeight: 800, minWidth: '54px', justifyContent: 'center' }}>
                                  {row.rate}%
                                </span>
                                <div style={{ width: '100%', maxWidth: '80px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      width: `${row.rate}%`,
                                      height: '100%',
                                      background: row.rate >= 80 ? '#10b981' : row.rate >= 65 ? '#f59e0b' : '#ef4444',
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="badge badge-muted" style={{ fontSize: '11px' }}>No Data</span>
                            )}
                          </td>
                        </tr>

                        {/* Expandable student roster for this class */}
                        {isExpanded && (
                          <tr style={{ background: 'var(--bg-hover)' }}>
                            <td colSpan={10} style={{ padding: '16px 20px' }}>
                              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Users size={15} color="var(--primary)" />
                                Student Attendance Breakdown for Grade {row.grade}{row.section} ({periodDateRange.label})
                              </div>

                              {row.studentBreakdown.length === 0 ? (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' }}>
                                  No enrolled students in this class.
                                </div>
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                                  {row.studentBreakdown.map(item => {
                                    const sRateBadge = item.total > 0
                                      ? item.rate >= 80 ? 'badge-success' : item.rate >= 65 ? 'badge-warning' : 'badge-danger'
                                      : 'badge-muted';

                                    return (
                                      <div
                                        key={item.student.id}
                                        style={{
                                          background: 'var(--bg-card)',
                                          border: '1px solid var(--border)',
                                          borderRadius: '8px',
                                          padding: '10px 12px',
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                        }}
                                      >
                                        <div>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setSelectedProfileStudentId(item.student.id); }}
                                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                                          >
                                            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--primary)', textDecoration: 'underline' }}>
                                              {item.student.name}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                              Adm: {item.student.admissionNumber || item.student.id}
                                            </div>
                                          </button>
                                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            Present: {item.present} / {item.total} | Absent: {item.absent}
                                          </div>
                                        </div>

                                        <div style={{ textAlign: 'right' }}>
                                          {item.total > 0 ? (
                                            <span className={`badge ${sRateBadge}`} style={{ fontWeight: 800, fontSize: '12px' }}>
                                              {item.rate}%
                                            </span>
                                          ) : (
                                            <span className="badge badge-muted" style={{ fontSize: '11px' }}>—</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Low Attendance Students Panel (< 75% or custom threshold) ── */}
        <div className="card" style={{ border: '2px solid rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.02)' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="card-title" style={{ margin: 0, color: '#ef4444' }}>
                  {t('lowAttendanceStudents', language)}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  Students requiring academic attendance intervention & parental notification
                </p>
              </div>
            </div>

            {/* Threshold & Scope controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Scope Toggle: Period vs All-time */}
              <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setLowAttendanceScope('period')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: lowAttendanceScope === 'period' ? 700 : 500,
                    background: lowAttendanceScope === 'period' ? 'var(--primary)' : 'transparent',
                    color: lowAttendanceScope === 'period' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {t('inSelectedPeriod', language)}
                </button>
                <button
                  type="button"
                  onClick={() => setLowAttendanceScope('all_time')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: lowAttendanceScope === 'all_time' ? 700 : 500,
                    background: lowAttendanceScope === 'all_time' ? 'var(--primary)' : 'transparent',
                    color: lowAttendanceScope === 'all_time' ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {t('allTimeYtd', language)}
                </button>
              </div>

              {/* Threshold Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Threshold:</span>
                <select
                  className="form-control"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '12px', height: '32px' }}
                  value={lowAttendanceThreshold}
                  onChange={e => setLowAttendanceThreshold(Number(e.target.value))}
                >
                  <option value={75}>&lt; 75% (Ministry Standard)</option>
                  <option value={80}>&lt; 80% (Strict)</option>
                  <option value={70}>&lt; 70% (Severe At-Risk)</option>
                  <option value={60}>&lt; 60% (Critical Only)</option>
                </select>
              </div>

              {/* Counter Badge */}
              <span
                className="badge"
                style={{
                  background: lowAttendanceStudents.length > 0 ? '#ef4444' : '#10b981',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '11px',
                  padding: '4px 10px',
                }}
              >
                {lowAttendanceStudents.length} Students
              </span>
            </div>
          </div>

          {/* Search bar within low attendance */}
          {lowAttendanceStudents.length > 0 && (
            <div style={{ padding: '0 16px 12px' }}>
              <div style={{ position: 'relative', maxWidth: '360px' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Filter student name, admission # or class..."
                  value={lowAttSearch}
                  onChange={e => setLowAttSearch(e.target.value)}
                  style={{ paddingLeft: '32px', fontSize: '12px', height: '34px' }}
                />
              </div>
            </div>
          )}

          {lowAttendanceStudents.length === 0 ? (
            <div className="empty-state" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: '#10b981' }}>
                <Check size={24} />
              </div>
              <h4 style={{ margin: '0 0 4px', color: '#10b981', fontWeight: 700 }}>
                {t('noLowAttendance', language)}
              </h4>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                All enrolled students maintained attendance rates at or above {lowAttendanceThreshold}% {lowAttendanceScope === 'period' ? `during ${periodDateRange.label}` : 'across all records'}.
              </p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>{t('student', language)}</th>
                    <th>{t('class', language)}</th>
                    <th style={{ textAlign: 'center' }}>Sessions</th>
                    <th style={{ textAlign: 'center', color: 'var(--success)' }}>{t('present', language)}</th>
                    <th style={{ textAlign: 'center', color: 'var(--danger)' }}>{t('absent', language)}</th>
                    <th style={{ textAlign: 'center' }}>{t('attendanceRate', language)}</th>
                    <th>Risk Category</th>
                    <th>Parent Contact</th>
                    <th style={{ textAlign: 'center' }}>Direct Alert Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lowAttendanceStudents.map((item, i) => {
                    const cleanPhone = (item.student.parentContact || '').replace(/[^0-9+]/g, '');
                    const alertMsg = `Dear Parent,\nYour child ${item.student.name} (Class: ${item.student.classRoom}) has a low attendance rate of ${item.rate}% in school (${item.presentCount} present of ${item.totalRecords} sessions). Please ensure regular school attendance.\n— ${user?.schoolName || 'Principal Office'}`;
                    const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(alertMsg)}` : '';

                    return (
                      <tr key={item.student.id}>
                        <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
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
                            <div style={{ fontWeight: 700, color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                              {item.student.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              Adm: {item.student.admissionNumber || item.student.id}
                            </div>
                          </button>
                        </td>
                        <td>
                          <span className="badge badge-primary">{item.student.classRoom}</span>
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{item.totalRecords}</td>
                        <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 600 }}>{item.presentCount}</td>
                        <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: 600 }}>{item.absentCount}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge ${item.riskLevel === 'critical' ? 'badge-danger' : 'badge-warning'}`}
                            style={{ fontSize: '13px', fontWeight: 800, minWidth: '54px', justifyContent: 'center' }}
                          >
                            {item.rate}%
                          </span>
                        </td>
                        <td>
                          {item.riskLevel === 'critical' ? (
                            <span className="badge badge-danger" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              🚨 {t('criticalRisk', language)}
                            </span>
                          ) : (
                            <span className="badge badge-warning" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              ⚠️ {t('atRisk', language)}
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                          {item.student.parentContact ? (
                            <span>📱 {item.student.parentContact}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Not registered</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            {cleanPhone && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => {
                                    handleSendSms({
                                      student: item.student,
                                      status: 'absent',
                                      payload: {
                                        messageText: alertMsg,
                                        whatsappUrl,
                                        smsUrl: `sms:${cleanPhone}?body=${encodeURIComponent(alertMsg)}`,
                                        parentPhone: cleanPhone,
                                      },
                                    });
                                  }}
                                  title="Send Official SMS Warning to Parent"
                                >
                                  <Smartphone size={12} /> SMS
                                </button>

                                {whatsappUrl && (
                                  <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-success btn-sm"
                                    style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                                    title="Send WhatsApp Low Attendance Alert"
                                  >
                                    <MessageCircle size={12} /> WhatsApp
                                  </a>
                                )}
                              </>
                            )}

                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid var(--border)' }}
                              onClick={() => setSelectedProfileStudentId(item.student.id)}
                              title="Open Student Profile Dossier"
                            >
                              <ExternalLink size={12} /> Profile
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
                Notifications have been pushed to their parent accounts in the mobile app. Click <strong>Send Direct SMS</strong> to open your phone's SMS app pre-filled — tap Send to deliver the alert instantly to the parent's number:
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

                        {/* Direct SMS Button — Safe Mobile/Desktop Handler */}
                        {item.payload.parentPhone ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{
                                background: smsSent[item.student.id] ? '#10b981' : '#0ea5e9',
                                color: '#ffffff',
                                border: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontWeight: 600,
                                minWidth: '150px',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                              onClick={() => handleSendSms(item)}
                            >
                              {smsSent[item.student.id] ? (
                                <><Check size={14} /> SMS Dispatched ✓</>
                              ) : (
                                <><Send size={14} /> Send Direct SMS</>
                              )}
                            </button>

                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '12px',
                                cursor: 'pointer',
                              }}
                              onClick={() => handleQuickCopySms(item)}
                              title="Copy SMS text and parent phone number"
                            >
                              {copiedQuickId === item.student.id ? (
                                <><Check size={13} color="#10b981" /> Copied ✓</>
                              ) : (
                                <><Copy size={13} /> Copy SMS</>
                              )}
                            </button>
                          </>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>
                            ⚠ No contact number registered
                          </span>
                        )}

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

      {/* Desktop Direct SMS Dispatch Console Modal */}
      {activeSmsModalItem && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '20px',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border)',
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              padding: '18px 22px',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Smartphone size={22} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>
                    Direct SMS Dispatch Console
                  </h3>
                  <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
                    Recipient: <strong>{activeSmsModalItem.student.name}</strong>'s Parent ({activeSmsModalItem.payload.parentPhone})
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveSmsModalItem(null)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Desktop Notice */}
              <div style={{
                background: 'rgba(14, 165, 233, 0.08)',
                border: '1px solid rgba(14, 165, 233, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '12.5px',
                lineHeight: 1.5,
              }}>
                <Laptop size={18} color="#0ea5e9" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Desktop Computer Detected:</strong> Web browsers on Windows cannot send cellular SMS directly through PC motherboard hardware. Choose one of the instant dispatch options below:
                </div>
              </div>

              {/* Method 1: QR Code Dispatch (Scan with mobile camera) */}
              <div style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                background: 'var(--bg-page)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>
                  <QrCode size={18} color="#10b981" />
                  <span>Method 1: Scan QR to Send from Phone (Instant)</span>
                  <span className="badge" style={{ background: '#10b981', color: '#fff', fontSize: '10px', padding: '2px 6px' }}>Recommended</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                  Point your smartphone camera at the QR code below. Tap <strong>"Send SMS"</strong> on your phone screen to send this pre-filled alert immediately to the parent!
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{
                    background: '#ffffff',
                    padding: '8px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    display: 'inline-flex',
                  }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(`SMSTO:${activeSmsModalItem.payload.parentPhone}:${activeSmsModalItem.payload.messageText}`)}`}
                      alt="SMS Dispatch QR Code"
                      width="130"
                      height="130"
                      style={{ display: 'block' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '180px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ marginBottom: '6px' }}><strong>Parent Phone:</strong> {activeSmsModalItem.payload.parentPhone}</div>
                    <div style={{ marginBottom: '6px' }}><strong>Attendance:</strong> {activeSmsModalItem.status.toUpperCase()}</div>
                    <div style={{ color: '#10b981', fontWeight: 600 }}>✓ Works on any iPhone & Android camera</div>
                  </div>
                </div>
              </div>

              {/* Method 2: Copy Text & Phone Number */}
              <div style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                background: 'var(--bg-page)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px' }}>
                    <Copy size={16} color="#0ea5e9" />
                    <span>Method 2: Copy SMS Alert</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{
                      background: copiedSmsAlert ? '#10b981' : 'var(--primary)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '12px',
                      padding: '4px 10px',
                      cursor: 'pointer',
                    }}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`To: ${activeSmsModalItem.payload.parentPhone}\n\n${activeSmsModalItem.payload.messageText}`);
                        setCopiedSmsAlert(true);
                        setTimeout(() => setCopiedSmsAlert(false), 3000);
                      } catch {}
                    }}
                  >
                    {copiedSmsAlert ? <><Check size={13} /> Copied to Clipboard!</> : <><Copy size={13} /> Copy All</>}
                  </button>
                </div>
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '100px',
                  overflowY: 'auto',
                }}>
                  {activeSmsModalItem.payload.messageText}
                </div>
              </div>

              {/* Method 3: Desktop Messaging Integrations */}
              <div style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
              }}>
                <a
                  href="https://messages.google.com/web"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{
                    flex: 1,
                    minWidth: '200px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    textDecoration: 'none',
                  }}
                >
                  <ExternalLink size={13} /> Open Google Messages Web
                </a>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{
                    flex: 1,
                    minWidth: '200px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleSafePhoneLink(activeSmsModalItem.payload.parentPhone, activeSmsModalItem.payload.messageText)}
                  title="Safely launches Windows Phone Link without opening Bing"
                >
                  <Laptop size={13} /> Open Windows Phone Link
                </button>
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
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveSmsModalItem(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ background: '#10b981', borderColor: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                onClick={() => {
                  setSmsSent(prev => ({ ...prev, [activeSmsModalItem.student.id]: true }));
                  setActiveSmsModalItem(null);
                }}
              >
                <Check size={14} /> Mark as SMS Dispatched ✓
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
