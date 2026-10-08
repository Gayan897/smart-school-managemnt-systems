// ─── Enums ───────────────────────────────────────────────────────────────────

export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type LeaveType = 'casual' | 'medical' | 'annual' | 'duty' | 'half_casual' | 'half_medical' | 'half_annual' | 'half_day';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export function calculateLeaveDays(startDate: string, endDate: string, type?: LeaveType | string, isHalfDay?: boolean): number {
  if (isHalfDay || (type && type.toString().startsWith('half'))) {
    return 0.5;
  }
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  if (isNaN(diffTime) || diffTime < 0) return 1;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 1;
}

export interface LeaveRequest {
  id: string;
  teacherId: string; // ID of applicant (teacher or principal)
  teacherName: string; // Name of applicant (teacher or principal)
  applicantRole?: UserRole; // 'principal' | 'teacher'
  teacherClass?: string; // Homeroom or assigned class of the teacher (e.g. "10A")
  type: LeaveType;
  isHalfDay?: boolean;
  halfDaySession?: 'morning' | 'afternoon';
  startDate: string; // ISO String (yyyy-MM-dd)
  endDate: string;   // ISO String (yyyy-MM-dd)
  reason: string;
  status: LeaveStatus;
  principalComment?: string | null;
  adminComment?: string | null; // Remarks from Zonal Admin upon review
  reviewedByRole?: 'principal' | 'zonal_admin';
  lessonPlanNotes?: string | null; // Study material or lesson instructions left for substitute teacher
  submittedAt: string; // ISO String
  schoolCensusCode?: string;
  schoolName?: string;
  remainingCasualAfterApproval?: number;
  remainingMedicalAfterApproval?: number;
  remainingAnnualAfterApproval?: number;
}
export type UserRole = 'zonal_admin' | 'principal' | 'teacher' | 'student' | 'parent';
export type ClassStream = 'ol' | 'al';
export type AppLanguage = 'english' | 'sinhala' | 'tamil';
export type ALStream = 'bioScience' | 'mathsScience' | 'commerce' | 'technology' | 'arts';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface GovernmentSchool {
  censusCode: string;       // e.g. "10421" (MoE Census Code)
  name: string;             // e.g. "Mahinda Rajapaksha College"
  zone: string;             // e.g. "Homagama"
  division: string;         // e.g. "Homagama"
  district: string;         // e.g. "Colombo"
  zonalSecretKey: string;   // Verification key issued by Zonal Admin (e.g. "HMG-MRC-8942")
  principalName?: string | null;
  principalId?: string | null;
  isRegistered: boolean;
  principalEmail?: string;
  principalPhone?: string;
  dispatchStatus?: 'pending' | 'dispatched';
  dispatchedAt?: string;
}

export const COLOMBO_GOVT_SCHOOLS: GovernmentSchool[] = [
  {
    censusCode: '10421',
    name: 'Mahinda Rajapaksha College',
    zone: 'Homagama',
    division: 'Homagama',
    district: 'Colombo',
    zonalSecretKey: 'HMG-MRC-8942',
    isRegistered: false,
    principalEmail: 'principal.mrc@moe.gov.lk',
    principalPhone: '+94 77 123 4567',
    dispatchStatus: 'pending',
  },
  {
    censusCode: '10001',
    name: 'Royal College',
    zone: 'Colombo',
    division: 'Colombo Central',
    district: 'Colombo',
    zonalSecretKey: 'COL-ROY-1001',
    isRegistered: false,
    principalEmail: 'principal@royalcollege.lk',
    principalPhone: '+94 71 987 6543',
    dispatchStatus: 'pending',
  },
  {
    censusCode: '10002',
    name: 'Ananda College',
    zone: 'Colombo',
    division: 'Colombo Central',
    district: 'Colombo',
    zonalSecretKey: 'COL-ANA-1002',
    isRegistered: false,
    principalEmail: 'principal@ananda.sch.lk',
    principalPhone: '+94 77 555 1234',
    dispatchStatus: 'pending',
  },
  {
    censusCode: '10003',
    name: 'Nalanda College',
    zone: 'Colombo',
    division: 'Colombo Central',
    district: 'Colombo',
    zonalSecretKey: 'COL-NAL-1003',
    isRegistered: false,
    principalEmail: 'principal@nalanda.sch.lk',
    principalPhone: '+94 71 444 5566',
    dispatchStatus: 'pending',
  },
  {
    censusCode: '10004',
    name: 'Visakha Vidyalaya',
    zone: 'Colombo',
    division: 'Colombo South',
    district: 'Colombo',
    zonalSecretKey: 'COL-VIS-1004',
    isRegistered: false,
    principalEmail: 'principal@visakhav.org',
    principalPhone: '+94 77 333 7788',
    dispatchStatus: 'pending',
  },
  {
    censusCode: '10422',
    name: 'Homagama Central College',
    zone: 'Homagama',
    division: 'Homagama',
    district: 'Colombo',
    zonalSecretKey: 'HMG-HCC-8943',
    isRegistered: false,
  },
];

export interface User {
  id: string;
  username: string;
  password?: string; // Optional for security on client, though Firestore has it
  name: string;
  email?: string;
  role: UserRole;
  schoolCensusCode?: string;
  schoolName?: string;
  admissionNumber?: string; // School admission number (for student & parent)
  studentId?: string;       // Linked student document ID
  parentContact?: string;
  studentGrade?: string;
  nicNumber?: string;
  sleasNumber?: string;
  nicFrontImage?: string;
  nicBackImage?: string;
  nicVerificationStatus?: 'pending' | 'verified' | 'rejected';
  verificationUnlockAt?: number; // timestamp in ms when login becomes enabled
  registeredAt?: string; // ISO string
  classRoom?: string; // Homeroom class assigned at registration (e.g. "10A")
  casualBalance?: number;
  medicalBalance?: number;
  annualBalance?: number;
  // Teacher subject profile
  subject?: string;          // Main teaching subject
  otherSubjects?: string[];  // Other subjects the teacher can also handle
  subjectSetupComplete?: boolean; // True after teacher has filled subject info post-login
  isClassTeacher?: boolean;  // True if assigned as homeroom/class teacher
  teacherType?: 'subject_teacher' | 'homeroom_teacher'; // 'subject_teacher' (rotates across classes) or 'homeroom_teacher' (owns a class)
}

export interface Student {
  id: string;
  admissionNumber?: string; // Unique school admission number (e.g. "ADM-74892" or "74892")
  name: string;
  classRoom: string; // e.g. "10A"
  grade: string;     // e.g. "10"
  parentContact: string;
  parentEmail?: string;
  schoolCensusCode?: string;
  schoolName?: string;
  registeredAt?: string;
  isStudentRegistered?: boolean;
  isParentRegistered?: boolean;
  smsDispatched?: boolean;
  smsDispatchedAt?: string;
  smsDeliveryStatus?: 'delivered' | 'pending' | 'failed';
  smsGatewayRef?: string;
}

export interface AdmissionSmsDispatch {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  classRoom: string;
  grade: string;
  parentContact: string;
  schoolName?: string;
  message: string;
  status: 'delivered' | 'pending' | 'failed';
  gateway: string;
  gatewayRef: string;
  dispatchedAt: string;
  teacherName?: string;
}

export interface Teacher {
  id: string;
  name: string;
  subject: string;         // Main teaching subject
  otherSubjects?: string[]; // Other subjects the teacher can handle
  classRoom: string;
  casualBalance: number;
  medicalBalance: number;
  annualBalance: number;
  schoolCensusCode?: string;
  schoolName?: string;
  isClassTeacher?: boolean;
  teacherType?: 'subject_teacher' | 'homeroom_teacher';
}

export interface SchoolClass {
  id: string;        // e.g. "10A"
  grade: number;     // 10, 11, 12, 13
  section: string;   // A, B, C
  stream: ClassStream;
  homeroomTeacherId?: string | null;
  homeroomTeacherName?: string | null;
}

export type ProxyStatus = 'assigned' | 'acknowledged' | 'completed' | 'declined';

export interface ProxyAssignment {
  id: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 1 (Mon) to 5 (Fri)
  period: number; // 1 to 7
  classRoom: string; // e.g. "10A"
  originalTeacherId: string;
  originalTeacherName: string;
  originalSubject: string;
  substituteTeacherId: string;
  substituteTeacherName: string;
  substituteTeacherSubject: string;
  leaveRequestId?: string | null;
  status: ProxyStatus;
  lessonPlanNotes?: string;
  studyMaterialUrl?: string;
  matchScore: number; // 0 - 100
  matchReason: string;
  assignedAt: string; // ISO String
  assignedBy?: string;
}

export interface ProxyCandidate {
  teacher: Teacher;
  matchScore: number;
  matchReason: string;
  subjectScore: number;
  workloadScore: number;
  gradeScore: number;
  weeklyProxyCount: number;
  todayPeriodsCount: number;
  isExactSubject: boolean;
  isRelatedSubject: boolean;
  isFree: boolean;
}

export interface AttendanceRecord {
  id?: string | null;
  studentId: string;
  date: string; // ISO Date String (yyyy-MM-dd or full ISO)
  status: AttendanceStatus;
}

export interface TermMark {
  studentId: string;
  subject: string;
  term: number;
  marks: number;
  maxMarks: number;
}

export interface TimetableSlot {
  classRoom: string;
  dayOfWeek: number; // 1 = Mon, 5 = Fri
  period: number;    // 1 to 8
  subject: string;
  teacher: string;
  teacherId?: string;
  academicYear?: number;
  startTime?: string;
  endTime?: string;
}

export interface SLPeriodScheduleItem {
  period: number;
  label: string;
  startTime: string; // e.g. "08:00 AM"
  endTime: string;   // e.g. "08:40 AM"
  durationMinutes: number;
  isInterval?: boolean;
}

/**
 * Official Sri Lankan Ministry of Education School Day Schedule
 * Total duration: 8:00 AM to 1:30 PM (330 minutes)
 * 8 Periods + 20-minute Interval strictly following Period 4
 */
export const SL_BELL_SCHEDULE: SLPeriodScheduleItem[] = [
  { period: 1, label: 'Period 1', startTime: '08:00 AM', endTime: '08:40 AM', durationMinutes: 40 },
  { period: 2, label: 'Period 2', startTime: '08:40 AM', endTime: '09:20 AM', durationMinutes: 40 },
  { period: 3, label: 'Period 3', startTime: '09:20 AM', endTime: '10:00 AM', durationMinutes: 40 },
  { period: 4, label: 'Period 4', startTime: '10:00 AM', endTime: '10:40 AM', durationMinutes: 40 },
  // Interval after 4th period
  { period: 0, label: 'Interval / Recess', startTime: '10:40 AM', endTime: '11:00 AM', durationMinutes: 20, isInterval: true },
  { period: 5, label: 'Period 5', startTime: '11:00 AM', endTime: '11:40 AM', durationMinutes: 40 },
  { period: 6, label: 'Period 6', startTime: '11:40 AM', endTime: '12:15 PM', durationMinutes: 35 },
  { period: 7, label: 'Period 7', startTime: '12:15 PM', endTime: '12:50 PM', durationMinutes: 35 },
  { period: 8, label: 'Period 8', startTime: '12:50 PM', endTime: '01:30 PM', durationMinutes: 40 },
];

export const SL_PERIOD_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * 8 Core Subjects in Sri Lankan Secondary / O-Level Schools (Grades 6–11)
 * Weighted allocation for 40 periods/week (5 days x 8 periods)
 */
export interface SLCurriculumSubject {
  id: string;
  nameEn: string;
  nameSi: string;
  nameTa: string;
  category: 'core' | 'language' | 'humanities' | 'practical' | 'aesthetic';
  color: string;
  weeklyPeriods: number; // Sums to 40 periods
}

export const SL_OL_8_SUBJECTS: SLCurriculumSubject[] = [
  {
    id: 'mathematics',
    nameEn: 'Mathematics',
    nameSi: 'ගණිතය',
    nameTa: 'கணிதம்',
    category: 'core',
    color: '#3b82f6', // Blue
    weeklyPeriods: 6,
  },
  {
    id: 'science',
    nameEn: 'Science',
    nameSi: 'විද්‍යාව',
    nameTa: 'அறிவியல்',
    category: 'core',
    color: '#10b981', // Emerald
    weeklyPeriods: 6,
  },
  {
    id: 'first_language',
    nameEn: 'Sinhala / Tamil Language & Lit',
    nameSi: 'මව්බස සහ සාහිත්‍යය',
    nameTa: 'தாய்மொழியும் இலக்கியமும்',
    category: 'language',
    color: '#8b5cf6', // Purple
    weeklyPeriods: 6,
  },
  {
    id: 'english_language',
    nameEn: 'English Language',
    nameSi: 'ඉංග්‍රීසි භාෂාව',
    nameTa: 'ஆங்கில மொழி',
    category: 'language',
    color: '#06b6d4', // Cyan
    weeklyPeriods: 5,
  },
  {
    id: 'religion',
    nameEn: 'Religion (Buddhism / Christianity / Hinduism / Islam)',
    nameSi: 'ආගම',
    nameTa: 'மதம்',
    category: 'humanities',
    color: '#f59e0b', // Amber
    weeklyPeriods: 4,
  },
  {
    id: 'history',
    nameEn: 'History',
    nameSi: 'ඉතිහාසය',
    nameTa: 'வரலாறு',
    category: 'humanities',
    color: '#ea580c', // Orange
    weeklyPeriods: 4,
  },
  {
    id: 'practical_studies',
    nameEn: 'Practical Studies (Commerce / ICT / Agriculture)',
    nameSi: 'ව්‍යවහාරික හා තාක්ෂණික විෂයයන්',
    nameTa: 'நடைமுறை மற்றும் தொழில்நுட்பக் கல்வி',
    category: 'practical',
    color: '#14b8a6', // Teal
    weeklyPeriods: 4,
  },
  {
    id: 'aesthetic_health',
    nameEn: 'Aesthetic & Health / PE',
    nameSi: 'සෞන්දර්යය සහ සෞඛ්‍ය හා ශාරීරික අධ්‍යාපනය',
    nameTa: 'அழகியல் மற்றும் உடற்கல்வி',
    category: 'aesthetic',
    color: '#ec4899', // Pink
    weeklyPeriods: 5,
  },
];


export type NoticeTargetRole = 'all' | 'teacher' | 'principal' | 'zonal_admin' | 'parent' | 'student';

export interface Notice {
  id: string;
  title: string;
  body: string;
  date: string; // ISO String
  category: string;
  targetRole?: NoticeTargetRole;
  targetClassRoom?: string;   // If set, notice is scoped to this class only (e.g. "11B")
  targetUserId?: string;      // If set, notice is strictly targeted to this user ID
  targetTeacherId?: string;   // If set, notice is strictly targeted to this teacher ID
  targetStudentId?: string;   // If set, notice is strictly targeted to this student ID
  authorName?: string;
  authorRole?: UserRole;
  priority?: 'normal' | 'high' | 'urgent';
  schoolCensusCode?: string;
  schoolName?: string;
}

export function isNoticeRelevantToUser(notice: Notice, user: User | null): boolean {
  if (!user) return false;

  const target = notice.targetRole || 'all';

  // 1. Zonal admin isolation:
  if (user.role === 'zonal_admin') {
    // Admin section is strictly confidential oversight. Zonal Admin only handles:
    // - Principal Key Requests / Registration approvals (Zonal Requests)
    // - Principal Leave Requests / Decisions
    // - Official Zonal Directives & Ministry of Education circulars
    //
    // Strictly HIDE:
    // - School class details (timetables, homeroom teacher assignments/removals, class notices)
    // - Teachers' leaves, approvals, and balances
    // - Internal staff duties (substitutes, proxy assignments)
    // - Student performance, attendance alerts, and parent notifications
    // - School-internal teacher announcements

    // 1a. Block all school class details & classroom-specific notices
    if (notice.targetClassRoom) return false;

    if (
      notice.id.startsWith('notice_timetable_') ||
      notice.id.startsWith('notice_class_assign_') ||
      notice.id.startsWith('notice_class_remove_') ||
      notice.title.toLowerCase().includes('timetable') ||
      notice.title.toLowerCase().includes('homeroom teacher') ||
      notice.body.toLowerCase().includes('homeroom teacher')
    ) {
      return false;
    }

    // 1b. Block teacher duties & internal staff substitution
    if (
      notice.category === 'Substitute Assignment' ||
      notice.id.startsWith('notice_proxy_') ||
      target === 'teacher'
    ) {
      return false;
    }

    // 1c. Block student/parent alerts & individual student academic details
    if (
      target === 'parent' ||
      target === 'student' ||
      notice.targetStudentId ||
      notice.id.startsWith('notice_low_marks_') ||
      notice.id.startsWith('pnotif_') ||
      notice.title.toLowerCase().includes('low performance alert') ||
      notice.title.toLowerCase().includes('absent alert') ||
      notice.title.toLowerCase().includes('late arrival') ||
      notice.body.toLowerCase().includes('dear parent')
    ) {
      return false;
    }

    // 1d. Leave Requests: Strictly show ONLY Principal leave requests!
    const isLeave =
      notice.category === 'Leave Request' ||
      notice.id.startsWith('notice_leave_') ||
      notice.title.toLowerCase().includes('leave request');

    if (isLeave) {
      const isPrincipalLeave =
        target === 'zonal_admin' ||
        notice.title.toLowerCase().includes('principal leave') ||
        (notice.authorRole === 'principal' && !notice.body.toLowerCase().includes('leave request for'));

      // If it's a teacher's leave or mentions teacher balances, block it
      if (!isPrincipalLeave || notice.body.toLowerCase().includes('updated remaining balances')) {
        return false;
      }
      return true;
    }

    // 1e. Allow official Zonal Requests (e.g. Principal Secret Key requests)
    if (notice.category === 'Zonal Request' || target === 'zonal_admin' || notice.id.startsWith('notice_key_req_')) {
      return true;
    }

    // 1f. Allow official Ministry of Education / Zonal Directives
    if (
      notice.authorRole === 'zonal_admin' ||
      notice.authorName === 'Ministry of Education' ||
      notice.authorName === 'EduPub Department' ||
      notice.authorName === 'Zonal Administration'
    ) {
      return true;
    }

    // 1g. High-level nationwide circulars with target 'all' that don't belong to any specific school
    if (target === 'all' && !notice.schoolCensusCode) {
      return true;
    }

    // Block all other school-specific operational notices
    return false;
  }

  // 2. Block zonal_admin-only notices from principals, teachers, parents, and students
  if (target === 'zonal_admin') return false;

  // 3. Strict School Census Code check:
  // If notice has a specific school census code, it MUST match user's school census code
  if (notice.schoolCensusCode && user.schoolCensusCode && notice.schoolCensusCode !== user.schoolCensusCode) {
    return false;
  }

  // 4. Direct User Targeting (targetUserId / targetTeacherId / targetStudentId)
  if (notice.targetUserId && notice.targetUserId !== user.id) {
    // If targeted to a specific user and current user is a teacher, student, or parent, block it
    if (user.role === 'teacher' || user.role === 'student' || user.role === 'parent') {
      return false;
    }
  }

  if (notice.targetTeacherId && notice.targetTeacherId !== user.id) {
    if (user.role === 'teacher') return false;
  }

  if (notice.targetStudentId && user.role === 'teacher') {
    return false;
  }

  // 5. PRIVACY FILTER: Leave Requests & Remaining Balances
  // As a teacher, strictly hide other teachers' leave requests and leave balances!
  const isLeaveNotice =
    notice.category === 'Leave Request' ||
    notice.id.startsWith('notice_leave_') ||
    notice.title.toLowerCase().includes('leave request');

  if (isLeaveNotice) {
    if (user.role === 'teacher') {
      // Allow general ministry/school circulars or policy guidelines
      const isGeneralGuideline =
        notice.id === 'notice_sys_03' ||
        notice.title.toLowerCase().includes('guidelines') ||
        notice.title.toLowerCase().includes('circular') ||
        notice.title.toLowerCase().includes('policy');

      if (!isGeneralGuideline) {
        // Individual leave request/approval/rejection/balance notice:
        // Must belong STRICTLY to this logged-in teacher!
        const matchesTargetUser = Boolean(notice.targetUserId && notice.targetUserId === user.id);
        const matchesTargetTeacher = Boolean(notice.targetTeacherId && notice.targetTeacherId === user.id);
        const matchesAuthor = Boolean(notice.authorName && user.name && notice.authorName.toLowerCase() === user.name.toLowerCase());

        const cleanUserName = user.name?.trim().toLowerCase() || '';
        const matchesNameInNotice =
          cleanUserName.length > 2 &&
          (notice.title.toLowerCase().includes(cleanUserName) || notice.body.toLowerCase().includes(cleanUserName));

        // If it does NOT match this teacher, strictly block!
        if (!matchesTargetUser && !matchesTargetTeacher && !matchesAuthor && !matchesNameInNotice) {
          return false;
        }
      }
    }
  }

  // 6. PRIVACY FILTER: Student Details & Parent/Student Alerts
  // Teachers must NOT see parent-targeted alerts, student low performance marks, weak subjects, or student private alerts in notifications
  if (user.role === 'teacher') {
    // Block parent and student targeted notices from teachers' notifications section
    if (target === 'parent' || target === 'student') {
      return false;
    }

    // Block notices containing individual student academic alerts or student personal details
    const hasStudentDetails =
      notice.id.startsWith('notice_low_marks_') ||
      notice.id.startsWith('pnotif_') ||
      notice.title.toLowerCase().includes('low performance alert') ||
      notice.title.toLowerCase().includes('absent alert') ||
      notice.title.toLowerCase().includes('late arrival') ||
      notice.body.toLowerCase().includes('dear parent') ||
      notice.body.toLowerCase().includes('weak subjects:') ||
      notice.body.toLowerCase().includes('below the expected threshold') ||
      notice.body.toLowerCase().includes('adm#:');

    if (hasStudentDetails) {
      return false;
    }
  }

  // 7. Proxy Duty / Substitute Assignment Isolation
  // Only the assigned substitute teacher (and the principal) should receive proxy assignment notices
  const isProxyNotice =
    notice.category === 'Substitute Assignment' ||
    notice.id.startsWith('notice_proxy_');

  if (isProxyNotice) {
    if (user.role === 'teacher') {
      if (notice.targetUserId && notice.targetUserId !== user.id) return false;
      if (notice.targetTeacherId && notice.targetTeacherId !== user.id) return false;
      if (!notice.targetUserId && !notice.targetTeacherId) {
        const cleanUserName = user.name?.trim().toLowerCase() || '';
        if (cleanUserName.length > 2 && !notice.body.toLowerCase().includes(cleanUserName)) {
          return false;
        }
      }
    }
  }

  // 8. Class-scoped notice: If notice targets a specific classroom, only show to:
  //    - The principal (supervises all)
  //    - Teachers/students whose classRoom matches the targetClassRoom
  if (notice.targetClassRoom) {
    if (user.role !== 'principal') {
      const userClass = user.classRoom || '';
      if (userClass !== notice.targetClassRoom) return false;
    }
  }

  // 9. Target Role check
  if (target === 'all') return true;
  if (user.role === 'principal' && (target === 'principal' || target === 'teacher' || isLeaveNotice || isProxyNotice)) return true;
  if (user.role === 'teacher' && target === 'teacher') return true;
  if (user.role === 'student' && target === 'student') return true;
  if (user.role === 'parent' && target === 'parent') return true;

  return false;
}

/**
 * Deduplicates an array of notices, retaining only the latest unique notice
 * based on unique ID or identical semantic content (same title, body, target, and classroom).
 */
export function deduplicateNotices(notices: Notice[]): Notice[] {
  if (!Array.isArray(notices) || notices.length === 0) return [];

  const seenIds = new Set<string>();
  const seenSemanticKeys = new Set<string>();
  const result: Notice[] = [];

  for (const n of notices) {
    if (!n || !n.id) continue;

    // 1. Direct ID check
    if (seenIds.has(n.id)) continue;
    seenIds.add(n.id);

    // 2. Semantic content key check
    const titleKey = (n.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const bodyKey = (n.body || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120);
    const classKey = (n.targetClassRoom || '').trim().toLowerCase();
    const roleKey = (n.targetRole || 'all').trim().toLowerCase();
    const categoryKey = (n.category || '').trim().toLowerCase();
    const censusKey = (n.schoolCensusCode || '').trim().toLowerCase();

    const semanticKey = `${titleKey}__${categoryKey}__${classKey}__${roleKey}__${censusKey}__${bodyKey}`;
    if (seenSemanticKeys.has(semanticKey)) {
      continue;
    }
    seenSemanticKeys.add(semanticKey);

    result.push(n);
  }

  return result;
}

/**
 * Deduplicates parent notifications, keeping only the newest unique notification per student and event.
 */
export function deduplicateParentNotifications(notifs: ParentNotification[]): ParentNotification[] {
  if (!Array.isArray(notifs) || notifs.length === 0) return [];

  const seenIds = new Set<string>();
  const seenSemanticKeys = new Set<string>();
  const result: ParentNotification[] = [];

  for (const pn of notifs) {
    if (!pn || !pn.id) continue;

    if (seenIds.has(pn.id)) continue;
    seenIds.add(pn.id);

    const titleKey = (pn.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const dateKey = (pn.date || '').trim();
    const studentKey = (pn.studentId || '').trim();
    const messageKey = (pn.message || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 100);

    const semanticKey = `${studentKey}__${dateKey}__${titleKey}__${messageKey}`;
    if (seenSemanticKeys.has(semanticKey)) {
      continue;
    }
    seenSemanticKeys.add(semanticKey);

    result.push(pn);
  }

  return result;
}

export function isUserSubjectSpecialist(user?: User | null): boolean {
  if (!user || user.role !== 'teacher') return false;
  if (user.teacherType === 'subject_teacher') return true;
  if (user.teacherType === 'homeroom_teacher') return false;
  return !user.isClassTeacher && (!user.classRoom || user.classRoom === 'Not assigned');
}

export interface ZonalKeyRequest {
  id: string;
  principalName: string;
  principalEmail: string;
  principalPhone: string;
  sleasNumber: string;
  nicNumber: string;
  censusCode: string;
  schoolName: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  nicFrontImage?: string; // base64 compressed JPEG data URL
  nicBackImage?: string;  // base64 compressed JPEG data URL
}

export interface ParentNotification {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  status: AttendanceStatus;
  title: string;
  message: string;
  timestamp: string; // ISO String
  read: boolean;
  teacherName?: string;
  type: 'attendance' | 'general';
  priority?: 'normal' | 'high' | 'urgent';
  parentContact?: string;
  actionRequired?: boolean;
}

// ─── University Pathway ─────────────────────────────────────────────────────

export interface UniversityPathway {
  degree: string;
  university: string;
  stream: ALStream;
  zScoreMin: number;
  zScoreMax: number;
  faculty: string;
  district?: string; // district quota note or campus location
  durationYears?: number; // 3, 4, 5
  degreeType?: 'Honours' | 'Special' | 'General' | 'Professional';
  intakeQuota?: string;
  careerProspects?: string[];
  minPrerequisites?: string;
}

// ─── Sri Lanka School Structure ──────────────────────────────────────────────

export interface ALStreamInfo {
  id: ALStream;
  nameEn: string;
  nameSi: string;
  nameTa: string;
  color: string;
  subjects: string[];
  description: string;
}

export const AL_STREAMS: ALStreamInfo[] = [
  {
    id: 'bioScience',
    nameEn: 'Bio Science',
    nameSi: 'ජෛව විද්‍යාව',
    nameTa: 'உயிரியல் அறிவியல்',
    color: '#059669',
    subjects: ['Biology', 'Chemistry', 'Physics / Agriculture'],
    description: 'For students aiming for Medicine, Dental, Veterinary, Pharmacy, Nursing, or Agriculture degrees.',
  },
  {
    id: 'mathsScience',
    nameEn: 'Physical Science (Maths)',
    nameSi: 'භෞතික විද්‍යාව (ගණිතය)',
    nameTa: 'இயற்பியல் அறிவியல் (கணிதம்)',
    color: '#0284c7',
    subjects: ['Combined Mathematics', 'Physics', 'Chemistry / ICT'],
    description: 'For Engineering, Artificial Intelligence, Computer Science, and Physical Science degrees.',
  },
  {
    id: 'commerce',
    nameEn: 'Commerce',
    nameSi: 'වාණිජ',
    nameTa: 'வணிகவியல்',
    color: '#d97706',
    subjects: ['Economics', 'Business Studies', 'Accounting'],
    description: 'For Management, Accountancy, Finance, Business Information Systems, and Marketing degrees.',
  },
  {
    id: 'technology',
    nameEn: 'Technology',
    nameSi: 'තාක්ෂණය',
    nameTa: 'தொழில்நுட்பம்',
    color: '#0891b2',
    subjects: ['Engineering Technology (ET)', 'Science for Technology (SFT)', 'ICT / Agro Technology / Drawing'],
    description: 'For Engineering Technology (BET), Biosystems Technology (BBST), and ICT (BICT) degrees.',
  },
  {
    id: 'arts',
    nameEn: 'Arts',
    nameSi: 'කලා',
    nameTa: 'கலை',
    color: '#db2777',
    subjects: ['History / Logic', 'Geography / Civic Ed.', 'Sinhala / Tamil / English Literature / Economics'],
    description: 'For Law (LLB), Humanities, Social Sciences, Mass Communication, and Languages degrees.',
  },
];

// ─── Real Sri Lanka University Pathways (Latest UGC 2024/2025 Admissions) ────

export const SL_UNIVERSITY_PATHWAYS: UniversityPathway[] = [
  // ── Bio Science Stream ──
  {
    degree: 'MBBS Medicine',
    university: 'University of Colombo',
    stream: 'bioScience',
    zScoreMin: 1.88,
    zScoreMax: 2.85,
    faculty: 'Faculty of Medicine (Kynsey Road)',
    district: 'Colombo Merit & District',
    durationYears: 5,
    degreeType: 'Professional',
    intakeQuota: 'Merit (40%) + District Quota (55%) + Underprivileged (5%)',
    careerProspects: ['Medical Doctor', 'Surgeon', 'Clinical Consultant', 'Medical Researcher'],
    minPrerequisites: '3 S passes in Chemistry, Biology & Physics in single attempt',
  },
  {
    degree: 'MBBS Medicine',
    university: 'University of Peradeniya',
    stream: 'bioScience',
    zScoreMin: 1.76,
    zScoreMax: 2.75,
    faculty: 'Faculty of Medicine',
    district: 'Kandy & Central Province',
    durationYears: 5,
    degreeType: 'Professional',
    careerProspects: ['Medical Officer', 'Specialist Physician', 'Clinical Academic'],
    minPrerequisites: '3 S passes in Chemistry, Biology & Physics',
  },
  {
    degree: 'MBBS Medicine',
    university: 'University of Sri Jayewardenepura',
    stream: 'bioScience',
    zScoreMin: 1.74,
    zScoreMax: 2.65,
    faculty: 'Faculty of Medical Sciences',
    district: 'Colombo & Gampaha',
    durationYears: 5,
    degreeType: 'Professional',
    careerProspects: ['Medical Doctor', 'Healthcare Administrator', 'Research Scientist'],
  },
  {
    degree: 'MBBS Medicine',
    university: 'University of Kelaniya',
    stream: 'bioScience',
    zScoreMin: 1.71,
    zScoreMax: 2.58,
    faculty: 'Faculty of Medicine (Ragama)',
    district: 'Gampaha & Western Province',
    durationYears: 5,
    degreeType: 'Professional',
    careerProspects: ['Medical Officer', 'Clinical Pharmacologist', 'Public Health Director'],
  },
  {
    degree: 'MBBS Medicine',
    university: 'University of Moratuwa',
    stream: 'bioScience',
    zScoreMin: 1.68,
    zScoreMax: 2.52,
    faculty: 'Faculty of Medicine (Nagoda/Kalutara)',
    district: 'Kalutara & Western Province',
    durationYears: 5,
    degreeType: 'Professional',
    careerProspects: ['Medical Doctor', 'Biomedical Engineer', 'Health Informatics Specialist'],
  },
  {
    degree: 'MBBS Medicine',
    university: 'University of Ruhuna',
    stream: 'bioScience',
    zScoreMin: 1.58,
    zScoreMax: 2.45,
    faculty: 'Faculty of Medicine (Karapitiya)',
    district: 'Southern Province',
    durationYears: 5,
    degreeType: 'Professional',
    careerProspects: ['Medical Officer', 'Clinical Specialist', 'Academic'],
  },
  {
    degree: 'MBBS Medicine',
    university: 'University of Jaffna',
    stream: 'bioScience',
    zScoreMin: 1.52,
    zScoreMax: 2.38,
    faculty: 'Faculty of Medicine',
    district: 'Northern Province & Quotas',
    durationYears: 5,
    degreeType: 'Professional',
    careerProspects: ['Medical Doctor', 'Community Health Specialist'],
  },
  {
    degree: 'MBBS Medicine',
    university: 'Rajarata University of Sri Lanka',
    stream: 'bioScience',
    zScoreMin: 1.45,
    zScoreMax: 2.28,
    faculty: 'Faculty of Medicine & Allied Sciences (Saliyapura)',
    district: 'North Central Province',
    durationYears: 5,
    degreeType: 'Professional',
    careerProspects: ['Medical Doctor', 'Tropical Health Specialist'],
  },
  {
    degree: 'MBBS Medicine',
    university: 'Wayamba University of Sri Lanka',
    stream: 'bioScience',
    zScoreMin: 1.48,
    zScoreMax: 2.32,
    faculty: 'Faculty of Medicine (Kuliyapitiya)',
    district: 'North Western Province',
    durationYears: 5,
    degreeType: 'Professional',
    careerProspects: ['Medical Officer', 'Clinical Researcher'],
  },
  {
    degree: 'MBBS Medicine',
    university: 'Sabaragamuwa University of Sri Lanka',
    stream: 'bioScience',
    zScoreMin: 1.46,
    zScoreMax: 2.30,
    faculty: 'Faculty of Medicine (Ratnapura)',
    district: 'Sabaragamuwa Province',
    durationYears: 5,
    degreeType: 'Professional',
    careerProspects: ['Medical Doctor', 'Emergency Physician'],
  },
  {
    degree: 'BDS Dental Surgery',
    university: 'University of Peradeniya',
    stream: 'bioScience',
    zScoreMin: 1.54,
    zScoreMax: 2.25,
    faculty: 'Faculty of Dental Sciences',
    district: 'All-Island / Central',
    durationYears: 5,
    degreeType: 'Professional',
    careerProspects: ['Dental Surgeon', 'Orthodontist', 'Oral & Maxillofacial Surgeon'],
    minPrerequisites: '3 S in Chemistry, Biology & Physics',
  },
  {
    degree: 'BVSc Veterinary Science',
    university: 'University of Peradeniya',
    stream: 'bioScience',
    zScoreMin: 1.38,
    zScoreMax: 2.05,
    faculty: 'Faculty of Veterinary Medicine & Animal Science',
    district: 'All-Island / Central',
    durationYears: 5,
    degreeType: 'Professional',
    careerProspects: ['Veterinary Surgeon', 'Livestock Development Officer', 'Wildlife Veterinarian'],
  },
  {
    degree: 'BPharm (Hons) Pharmacy',
    university: 'University of Colombo',
    stream: 'bioScience',
    zScoreMin: 1.28,
    zScoreMax: 1.95,
    faculty: 'Faculty of Medicine',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Hospital Pharmacist', 'Pharmaceutical R&D Specialist', 'Regulatory Affairs Manager'],
  },
  {
    degree: 'BSc (Hons) Nursing',
    university: 'University of Sri Jayewardenepura',
    stream: 'bioScience',
    zScoreMin: 0.92,
    zScoreMax: 1.65,
    faculty: 'Faculty of Allied Health Sciences',
    district: 'Western Province & All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Senior Nursing Officer', 'Critical Care Nurse', 'Clinical Nurse Educator'],
  },
  {
    degree: 'BSc (Hons) Medical Laboratory Science (MLS)',
    university: 'University of Sri Jayewardenepura',
    stream: 'bioScience',
    zScoreMin: 1.12,
    zScoreMax: 1.75,
    faculty: 'Faculty of Allied Health Sciences',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Clinical Laboratory Scientist', 'Biomedical Diagnostic Specialist', 'Pathology Lab Manager'],
  },
  {
    degree: 'BSc (Hons) Physiotherapy',
    university: 'University of Colombo',
    stream: 'bioScience',
    zScoreMin: 1.18,
    zScoreMax: 1.80,
    faculty: 'Faculty of Medicine',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Sports Physiotherapist', 'Neuro-Rehabilitation Specialist', 'Cardiopulmonary Therapist'],
  },
  {
    degree: 'BSc (Hons) Molecular Biology & Biotechnology',
    university: 'University of Colombo',
    stream: 'bioScience',
    zScoreMin: 1.15,
    zScoreMax: 1.85,
    faculty: 'Faculty of Science',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Biotechnology Scientist', 'Genomics Researcher', 'Bioinformatics Specialist'],
  },
  {
    degree: 'BSc (Hons) Food Science & Nutrition',
    university: 'Wayamba University of Sri Lanka',
    stream: 'bioScience',
    zScoreMin: 0.48,
    zScoreMax: 1.25,
    faculty: 'Faculty of Livestock, Fisheries & Nutrition',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Food Technologist', 'Dietetic Consultant', 'Quality Assurance Auditor'],
  },
  {
    degree: 'BSc (Hons) Agriculture',
    university: 'University of Peradeniya',
    stream: 'bioScience',
    zScoreMin: 0.42,
    zScoreMax: 1.18,
    faculty: 'Faculty of Agriculture',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Agricultural Officer', 'Agronomist', 'Agribusiness Consultant', 'Crop Geneticist'],
  },
  {
    degree: 'BSc (Hons) Fisheries & Marine Sciences',
    university: 'University of Ruhuna',
    stream: 'bioScience',
    zScoreMin: 0.28,
    zScoreMax: 0.95,
    faculty: 'Faculty of Fisheries & Marine Sciences & Technology',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Marine Biologist', 'Aquaculture Specialist', 'Oceanographic Researcher'],
  },
  {
    degree: 'BSc (Hons) Animal Science & Export Agriculture',
    university: 'Uva Wellassa University',
    stream: 'bioScience',
    zScoreMin: 0.22,
    zScoreMax: 0.88,
    faculty: 'Faculty of Animal Science & Export Agriculture',
    district: 'All-Island / Badulla',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Export Commodity Manager', 'Livestock Specialist', 'Agro-Enterprise Developer'],
  },

  // ── Physical Science (Maths) Stream ──
  {
    degree: 'BSc (Hons) Engineering',
    university: 'University of Moratuwa',
    stream: 'mathsScience',
    zScoreMin: 1.75,
    zScoreMax: 2.70,
    faculty: 'Faculty of Engineering (Katubedda)',
    district: 'Western Province & All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    intakeQuota: 'Merit (40%) + District Quota (55%)',
    careerProspects: ['Software Architect', 'Civil Engineer', 'Electrical & Electronic Engineer', 'Mechanical Engineer'],
    minPrerequisites: '3 S in Combined Maths, Physics & Chemistry/ICT',
  },
  {
    degree: 'BSc (Hons) Engineering',
    university: 'University of Peradeniya',
    stream: 'mathsScience',
    zScoreMin: 1.58,
    zScoreMax: 2.40,
    faculty: 'Faculty of Engineering',
    district: 'Central Province & All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Civil Engineer', 'Mechanical Engineer', 'Chemical Engineer', 'Computer Engineer'],
    minPrerequisites: '3 S in Combined Maths, Physics & Chemistry/ICT',
  },
  {
    degree: 'BSc (Hons) Engineering',
    university: 'University of Sri Jayewardenepura',
    stream: 'mathsScience',
    zScoreMin: 1.50,
    zScoreMax: 2.30,
    faculty: 'Faculty of Engineering (Mattegoda)',
    district: 'Western Province',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Mechanical Engineer', 'Civil Engineer', 'Computer Systems Engineer'],
  },
  {
    degree: 'BSc (Hons) Engineering',
    university: 'University of Ruhuna',
    stream: 'mathsScience',
    zScoreMin: 1.40,
    zScoreMax: 2.18,
    faculty: 'Faculty of Engineering (Hapugala, Galle)',
    district: 'Southern Province',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Civil Engineer', 'Electrical Engineer', 'Marine & Mechanical Engineer'],
  },
  {
    degree: 'BSc (Hons) Engineering',
    university: 'University of Jaffna',
    stream: 'mathsScience',
    zScoreMin: 1.28,
    zScoreMax: 2.05,
    faculty: 'Faculty of Engineering (Kilinochchi)',
    district: 'Northern Province & Quotas',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Civil Engineer', 'Electrical & Electronic Engineer', 'Computer Engineer'],
  },
  {
    degree: 'BSc (Hons) Engineering',
    university: 'South Eastern University of Sri Lanka',
    stream: 'mathsScience',
    zScoreMin: 1.18,
    zScoreMax: 1.95,
    faculty: 'Faculty of Engineering (Oluvil)',
    district: 'Eastern Province & Quotas',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Civil & Environmental Engineer', 'Mechanical Engineer', 'Electrical Engineer'],
  },
  {
    degree: 'BSc (Hons) Artificial Intelligence',
    university: 'University of Moratuwa',
    stream: 'mathsScience',
    zScoreMin: 1.62,
    zScoreMax: 2.45,
    faculty: 'Faculty of Information Technology',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['AI Engineer', 'Machine Learning Scientist', 'NLP & Computer Vision Specialist', 'Robotics Architect'],
    minPrerequisites: '3 S in Combined Maths, Physics & Chemistry/ICT',
  },
  {
    degree: 'BSc (Hons) Computer Science',
    university: 'University of Colombo',
    stream: 'mathsScience',
    zScoreMin: 1.48,
    zScoreMax: 2.25,
    faculty: 'School of Computing (UCSC)',
    district: 'All-Island Merit',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Lead Software Engineer', 'Systems Architect', 'Security Engineer', 'Cloud Architect'],
  },
  {
    degree: 'BSc (Hons) Software Engineering',
    university: 'University of Kelaniya',
    stream: 'mathsScience',
    zScoreMin: 1.44,
    zScoreMax: 2.20,
    faculty: 'Faculty of Computing & Technology',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Full-Stack Engineer', 'DevOps Specialist', 'Software Product Lead'],
  },
  {
    degree: 'BSc (Hons) Data Science',
    university: 'University of Sri Jayewardenepura',
    stream: 'mathsScience',
    zScoreMin: 1.38,
    zScoreMax: 2.15,
    faculty: 'Faculty of Computing',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Data Scientist', 'Big Data Architect', 'Quantitative Researcher', 'Business Intelligence Lead'],
  },
  {
    degree: 'BSc (Hons) Information Systems',
    university: 'University of Colombo',
    stream: 'mathsScience',
    zScoreMin: 0.92,
    zScoreMax: 1.68,
    faculty: 'School of Computing (UCSC)',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['IT Business Analyst', 'Enterprise Solution Architect', 'Project Manager'],
  },
  {
    degree: 'BSc (Hons) Computer Science & Technology',
    university: 'Uva Wellassa University',
    stream: 'mathsScience',
    zScoreMin: 0.88,
    zScoreMax: 1.62,
    faculty: 'Faculty of Applied Sciences',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Software Developer', 'Mobile Application Engineer', 'System Administrator'],
  },
  {
    degree: 'BSc (Hons) Statistics & Operations Research',
    university: 'University of Peradeniya',
    stream: 'mathsScience',
    zScoreMin: 0.85,
    zScoreMax: 1.72,
    faculty: 'Faculty of Science',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Data Analyst', 'Operations Researcher', 'Risk Modeler', 'Supply Chain Analyst'],
  },
  {
    degree: 'BSc (Hons) Financial Mathematics & Industrial Statistics',
    university: 'University of Colombo',
    stream: 'mathsScience',
    zScoreMin: 1.08,
    zScoreMax: 1.88,
    faculty: 'Faculty of Science',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Actuary', 'Financial Quantitative Analyst', 'Risk Consultant', 'Investment Modeler'],
  },
  {
    degree: 'BSc Physical Science',
    university: 'University of Sri Jayewardenepura',
    stream: 'mathsScience',
    zScoreMin: 0.65,
    zScoreMax: 1.48,
    faculty: 'Faculty of Applied Sciences',
    district: 'Western Province & All-Island',
    durationYears: 3,
    degreeType: 'General',
    careerProspects: ['Scientific Officer', 'Educator', 'Laboratory Analyst', 'Data Specialist'],
  },
  {
    degree: 'BSc Physical Science',
    university: 'University of Kelaniya',
    stream: 'mathsScience',
    zScoreMin: 0.60,
    zScoreMax: 1.42,
    faculty: 'Faculty of Science',
    district: 'Western Province',
    durationYears: 3,
    degreeType: 'General',
    careerProspects: ['Quality Control Specialist', 'Data Analyst', 'Secondary Science Educator'],
  },

  // ── Commerce Stream ──
  {
    degree: 'BSc (Hons) Business Administration',
    university: 'University of Sri Jayewardenepura',
    stream: 'commerce',
    zScoreMin: 1.54,
    zScoreMax: 2.15,
    faculty: 'Faculty of Management Studies & Commerce',
    district: 'Colombo & All-Island Merit',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Corporate Executive', 'Strategy Consultant', 'Managing Director', 'Entrepreneur'],
    minPrerequisites: '3 S in Economics, Business Studies & Accounting',
  },
  {
    degree: 'BBA (Hons) Business Administration',
    university: 'University of Colombo',
    stream: 'commerce',
    zScoreMin: 1.50,
    zScoreMax: 2.10,
    faculty: 'Faculty of Management & Finance',
    district: 'Colombo & All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Management Consultant', 'Commercial Banking Executive', 'Corporate Planner'],
  },
  {
    degree: 'BCom (Hons) Accountancy & Finance',
    university: 'University of Kelaniya',
    stream: 'commerce',
    zScoreMin: 1.42,
    zScoreMax: 1.95,
    faculty: 'Faculty of Commerce & Management Studies',
    district: 'Gampaha & All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Chartered Accountant', 'Financial Controller', 'Auditor', 'Tax Consultant'],
  },
  {
    degree: 'BSc (Hons) Accounting',
    university: 'University of Sri Jayewardenepura',
    stream: 'commerce',
    zScoreMin: 1.52,
    zScoreMax: 2.12,
    faculty: 'Faculty of Management Studies & Commerce',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Chief Financial Officer (CFO)', 'Senior Audit Partner', 'Forensic Accountant'],
  },
  {
    degree: 'BSc (Hons) Finance',
    university: 'University of Sri Jayewardenepura',
    stream: 'commerce',
    zScoreMin: 1.48,
    zScoreMax: 2.05,
    faculty: 'Faculty of Management Studies & Commerce',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Investment Banker', 'Portfolio Manager', 'Equity Research Analyst', 'Treasury Officer'],
  },
  {
    degree: 'BSc (Hons) Business Information Systems (BIS)',
    university: 'University of Sri Jayewardenepura',
    stream: 'commerce',
    zScoreMin: 1.25,
    zScoreMax: 1.80,
    faculty: 'Faculty of Management Studies & Commerce',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['ERP Consultant', 'Fintech Specialist', 'Business Systems Analyst'],
  },
  {
    degree: 'BBA (Hons) Marketing',
    university: 'University of Kelaniya',
    stream: 'commerce',
    zScoreMin: 1.18,
    zScoreMax: 1.72,
    faculty: 'Faculty of Commerce & Management Studies',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Brand Manager', 'Chief Marketing Officer', 'Digital Marketing Director'],
  },
  {
    degree: 'BBA (Hons) Human Resource Management',
    university: 'University of Sri Jayewardenepura',
    stream: 'commerce',
    zScoreMin: 1.20,
    zScoreMax: 1.75,
    faculty: 'Faculty of Management Studies & Commerce',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Chief People Officer (CPO)', 'Talent Acquisition Director', 'HR Business Partner'],
  },
  {
    degree: 'BSc (Hons) Banking & Insurance',
    university: 'Wayamba University of Sri Lanka',
    stream: 'commerce',
    zScoreMin: 0.88,
    zScoreMax: 1.48,
    faculty: 'Faculty of Business Studies & Finance',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Commercial Banking Manager', 'Underwriting Manager', 'Risk & Compliance Officer'],
  },
  {
    degree: 'BSc (Hons) Tourism & Hospitality Management',
    university: 'Sabaragamuwa University of Sri Lanka',
    stream: 'commerce',
    zScoreMin: 0.58,
    zScoreMax: 1.30,
    faculty: 'Faculty of Management Studies',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Hospitality Director', 'Tourism Development Officer', 'Resort Operations Manager'],
  },
  {
    degree: 'BSc (Hons) International Business',
    university: 'University of Sri Jayewardenepura',
    stream: 'commerce',
    zScoreMin: 1.32,
    zScoreMax: 1.88,
    faculty: 'Faculty of Management Studies & Commerce',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Global Supply Chain Manager', 'Export-Import Director', 'Trade Advisor'],
  },

  // ── Technology Stream ──
  {
    degree: 'BET (Hons) Engineering Technology',
    university: 'University of Moratuwa',
    stream: 'technology',
    zScoreMin: 1.05,
    zScoreMax: 1.85,
    faculty: 'Faculty of Technology',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Production Engineer', 'Automation Specialist', 'Plant Operations Technologist'],
    minPrerequisites: '3 S in Engineering Tech, Science for Tech & ICT/Drawing',
  },
  {
    degree: 'BET (Hons) Engineering Technology',
    university: 'University of Sri Jayewardenepura',
    stream: 'technology',
    zScoreMin: 0.98,
    zScoreMax: 1.78,
    faculty: 'Faculty of Technology (Pitipana/Homagama)',
    district: 'Colombo & All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Mechatronics Technologist', 'Robotics Specialist', 'Industrial Systems Engineer'],
  },
  {
    degree: 'BET (Hons) Engineering Technology',
    university: 'University of Kelaniya',
    stream: 'technology',
    zScoreMin: 0.88,
    zScoreMax: 1.68,
    faculty: 'Faculty of Computing & Technology',
    district: 'Gampaha & All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Electronic Systems Engineer', 'Automotive Technologist', 'Smart Grid Specialist'],
  },
  {
    degree: 'BET (Hons) Engineering Technology',
    university: 'University of Ruhuna',
    stream: 'technology',
    zScoreMin: 0.78,
    zScoreMax: 1.55,
    faculty: 'Faculty of Technology (Karagoda Uyangoda)',
    district: 'Southern Province',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Mechanical Technologist', 'Renewable Energy Specialist', 'Marine Systems Technologist'],
  },
  {
    degree: 'BET (Hons) Engineering Technology',
    university: 'Rajarata University of Sri Lanka',
    stream: 'technology',
    zScoreMin: 0.58,
    zScoreMax: 1.35,
    faculty: 'Faculty of Technology',
    district: 'North Central Province',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Civil Technologist', 'Construction Works Engineer', 'Water Resource Technologist'],
  },
  {
    degree: 'BET (Hons) Engineering Technology',
    university: 'Uva Wellassa University',
    stream: 'technology',
    zScoreMin: 0.52,
    zScoreMax: 1.28,
    faculty: 'Faculty of Technological Studies',
    district: 'Badulla & All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Instrumentation Technologist', 'Industrial Automation Specialist'],
  },
  {
    degree: 'BET (Hons) Engineering Technology',
    university: 'UNIVOTEC (Univ of Vocational Technology)',
    stream: 'technology',
    zScoreMin: 0.38,
    zScoreMax: 1.18,
    faculty: 'Faculty of Industrial Technology',
    district: 'All-Island / NVQ',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Industrial Plant Manager', 'Technical Operations Director'],
  },
  {
    degree: 'BBST (Hons) Biosystems Technology',
    university: 'University of Sri Jayewardenepura',
    stream: 'technology',
    zScoreMin: 0.82,
    zScoreMax: 1.58,
    faculty: 'Faculty of Technology',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Bioprocess Technologist', 'Bio-fertilizer Specialist', 'Food Processing Technologist'],
    minPrerequisites: '3 S in Biosystems Tech, Science for Tech & Agro Tech/ICT',
  },
  {
    degree: 'BBST (Hons) Biosystems Technology',
    university: 'University of Colombo',
    stream: 'technology',
    zScoreMin: 0.74,
    zScoreMax: 1.48,
    faculty: 'Institute of Agro-Technology & Rural Sciences',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Agri-Tech Solutions Architect', 'Post-Harvest Technologist'],
  },
  {
    degree: 'BBST (Hons) Biosystems Technology',
    university: 'University of Ruhuna',
    stream: 'technology',
    zScoreMin: 0.62,
    zScoreMax: 1.38,
    faculty: 'Faculty of Technology',
    district: 'Southern Province',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Fisheries Technologist', 'Environmental Quality Officer'],
  },
  {
    degree: 'BBST (Hons) Biosystems Technology',
    university: 'Wayamba University of Sri Lanka',
    stream: 'technology',
    zScoreMin: 0.52,
    zScoreMax: 1.28,
    faculty: 'Faculty of Technology',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Commercial Plantation Technologist', 'Horticulture Specialist'],
  },
  {
    degree: 'BICT (Hons) Information & Communication Technology',
    university: 'University of Sri Jayewardenepura',
    stream: 'technology',
    zScoreMin: 1.12,
    zScoreMax: 1.85,
    faculty: 'Faculty of Technology',
    district: 'All-Island Merit',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Network Security Engineer', 'Mobile App Developer', 'Cloud Infrastructure Technologist'],
    minPrerequisites: '3 S in Engineering/Biosystems Tech, Science for Tech & ICT',
  },
  {
    degree: 'BICT (Hons) Information & Communication Technology',
    university: 'University of Kelaniya',
    stream: 'technology',
    zScoreMin: 1.02,
    zScoreMax: 1.75,
    faculty: 'Faculty of Computing & Technology',
    district: 'Gampaha & All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Cyber Security Analyst', 'Database Administrator', 'Full-Stack Developer'],
  },
  {
    degree: 'BICT (Hons) Information & Communication Technology',
    university: 'Rajarata University of Sri Lanka',
    stream: 'technology',
    zScoreMin: 0.68,
    zScoreMax: 1.45,
    faculty: 'Faculty of Technology',
    district: 'North Central & Quotas',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Software Developer', 'Systems Engineer', 'IT Project Officer'],
  },
  {
    degree: 'BSc (Hons) Quantity Surveying',
    university: 'University of Moratuwa',
    stream: 'technology',
    zScoreMin: 1.25,
    zScoreMax: 2.05,
    faculty: 'Faculty of Architecture',
    district: 'All-Island (Tech & Maths Streams)',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Chartered Quantity Surveyor', 'Cost Consultant', 'Contract Administrator', 'Project Manager'],
  },
  {
    degree: 'BSc (Hons) Facilities Management',
    university: 'University of Moratuwa',
    stream: 'technology',
    zScoreMin: 0.88,
    zScoreMax: 1.65,
    faculty: 'Faculty of Architecture',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Facilities Operations Director', 'Commercial Real Estate Asset Manager'],
  },
  {
    degree: 'BSc (Hons) Town & Country Planning',
    university: 'University of Moratuwa',
    stream: 'technology',
    zScoreMin: 0.78,
    zScoreMax: 1.55,
    faculty: 'Faculty of Architecture',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Urban Planning Officer', 'City Architect', 'Environmental Impact Assessor'],
  },

  // ── Arts Stream ──
  {
    degree: 'LLB Bachelor of Laws',
    university: 'University of Colombo',
    stream: 'arts',
    zScoreMin: 1.70,
    zScoreMax: 2.45,
    faculty: 'Faculty of Law (Reid Avenue)',
    district: 'Colombo & All-Island Merit',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Attorney-at-Law', 'State Counsel', 'Corporate Legal Counsel', 'Judicial Officer'],
    minPrerequisites: 'Passing mark in Law Entrance Aptitude Test & General English',
  },
  {
    degree: 'LLB Bachelor of Laws',
    university: 'University of Peradeniya',
    stream: 'arts',
    zScoreMin: 1.55,
    zScoreMax: 2.25,
    faculty: 'Department of Law',
    district: 'Central Province & All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Legal Practitioner', 'Human Rights Advocate', 'Legal Academic'],
  },
  {
    degree: 'LLB Bachelor of Laws',
    university: 'University of Jaffna',
    stream: 'arts',
    zScoreMin: 1.40,
    zScoreMax: 2.10,
    faculty: 'Faculty of Law',
    district: 'Northern Province & Quotas',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Attorney-at-Law', 'Civil Rights Lawyer', 'Magistrate'],
  },
  {
    degree: 'BA (Hons) English & Linguistics',
    university: 'University of Kelaniya',
    stream: 'arts',
    zScoreMin: 0.95,
    zScoreMax: 1.80,
    faculty: 'Faculty of Humanities',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['University English Lecturer', 'Diplomatic Service Officer', 'Publishing Editor'],
  },
  {
    degree: 'BA (Hons) Economics & Demography',
    university: 'University of Colombo',
    stream: 'arts',
    zScoreMin: 0.88,
    zScoreMax: 1.70,
    faculty: 'Faculty of Arts',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Economic Policy Analyst', 'Central Bank Executive', 'Socio-Demographic Researcher'],
  },
  {
    degree: 'BA (Hons) International Relations',
    university: 'University of Colombo',
    stream: 'arts',
    zScoreMin: 0.90,
    zScoreMax: 1.75,
    faculty: 'Faculty of Arts',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Foreign Service Attaché', 'UN/NGO Program Specialist', 'Geopolitical Analyst'],
  },
  {
    degree: 'BA (Hons) Mass Communication',
    university: 'University of Kelaniya',
    stream: 'arts',
    zScoreMin: 0.68,
    zScoreMax: 1.45,
    faculty: 'Faculty of Social Sciences',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Broadcast Journalist', 'Media Production Executive', 'Public Relations Director'],
  },
  {
    degree: 'BA (Hons) Psychology',
    university: 'University of Peradeniya',
    stream: 'arts',
    zScoreMin: 0.85,
    zScoreMax: 1.60,
    faculty: 'Faculty of Arts',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Counseling Psychologist', 'Organizational Behaviorist', 'Mental Health Program Officer'],
  },
  {
    degree: 'BA (Hons) Political Science & Public Policy',
    university: 'University of Peradeniya',
    stream: 'arts',
    zScoreMin: 0.52,
    zScoreMax: 1.30,
    faculty: 'Faculty of Arts',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Public Administrator (SLAS)', 'Policy Research Officer', 'Parliamentary Affairs Executive'],
  },
  {
    degree: 'BA (Hons) Archaeology & Heritage Management',
    university: 'Rajarata University of Sri Lanka',
    stream: 'arts',
    zScoreMin: 0.38,
    zScoreMax: 1.15,
    faculty: 'Faculty of Social Sciences & Humanities',
    district: 'All-Island',
    durationYears: 4,
    degreeType: 'Honours',
    careerProspects: ['Archaeological Officer', 'Cultural Heritage Director', 'Museum Curator'],
  },
  {
    degree: 'BA (General) Social Sciences',
    university: 'University of Kelaniya',
    stream: 'arts',
    zScoreMin: 0.25,
    zScoreMax: 1.00,
    faculty: 'Faculty of Social Sciences',
    district: 'All-Island',
    durationYears: 3,
    degreeType: 'General',
    careerProspects: ['Administrative Officer', 'Community Development Facilitator', 'Teacher'],
  },
  {
    degree: 'BA Eastern Languages & Translation Studies',
    university: 'University of Jaffna',
    stream: 'arts',
    zScoreMin: 0.15,
    zScoreMax: 0.85,
    faculty: 'Faculty of Arts',
    district: 'All-Island',
    durationYears: 3,
    degreeType: 'General',
    careerProspects: ['Official State Translator', 'Linguistic Researcher', 'Bilingual Communications Officer'],
  },
];

// ─── Default Classes ─────────────────────────────────────────────────────────

export const defaultClasses: SchoolClass[] = [
  // O/L — Grade 10
  { id: '10A', grade: 10, section: 'A', stream: 'ol', homeroomTeacherId: null, homeroomTeacherName: null },
  { id: '10B', grade: 10, section: 'B', stream: 'ol', homeroomTeacherId: null, homeroomTeacherName: null },
  { id: '10C', grade: 10, section: 'C', stream: 'ol', homeroomTeacherId: null, homeroomTeacherName: null },
  // O/L — Grade 11
  { id: '11A', grade: 11, section: 'A', stream: 'ol', homeroomTeacherId: null, homeroomTeacherName: null },
  { id: '11B', grade: 11, section: 'B', stream: 'ol', homeroomTeacherId: null, homeroomTeacherName: null },
  { id: '11C', grade: 11, section: 'C', stream: 'ol', homeroomTeacherId: null, homeroomTeacherName: null },
  // A/L — Grade 12
  { id: '12A', grade: 12, section: 'A', stream: 'al', homeroomTeacherId: null, homeroomTeacherName: null },
  { id: '12B', grade: 12, section: 'B', stream: 'al', homeroomTeacherId: null, homeroomTeacherName: null },
  { id: '12C', grade: 12, section: 'C', stream: 'al', homeroomTeacherId: null, homeroomTeacherName: null },
  // A/L — Grade 13
  { id: '13A', grade: 13, section: 'A', stream: 'al', homeroomTeacherId: null, homeroomTeacherName: null },
  { id: '13B', grade: 13, section: 'B', stream: 'al', homeroomTeacherId: null, homeroomTeacherName: null },
  { id: '13C', grade: 13, section: 'C', stream: 'al', homeroomTeacherId: null, homeroomTeacherName: null },
];
