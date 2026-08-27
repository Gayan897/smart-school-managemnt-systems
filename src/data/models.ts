// ─── Enums ───────────────────────────────────────────────────────────────────

export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type LeaveType = 'casual' | 'medical' | 'annual' | 'duty';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type UserRole = 'zonal_admin' | 'principal' | 'teacher';
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
  nicNumber?: string;
  sleasNumber?: string;
}

export interface Student {
  id: string;
  name: string;
  classRoom: string; // e.g. "10A"
  grade: string;     // e.g. "10"
  parentContact: string;
}

export interface Teacher {
  id: string;
  name: string;
  subject: string;
  classRoom: string;
  casualBalance: number;
  medicalBalance: number;
  annualBalance: number;
}

export interface SchoolClass {
  id: string;        // e.g. "10A"
  grade: number;     // 10, 11, 12, 13
  section: string;   // A, B, C
  stream: ClassStream;
  homeroomTeacherId?: string | null;
  homeroomTeacherName?: string | null;
}

export interface LeaveRequest {
  id: string;
  teacherId: string;
  teacherName: string;
  type: LeaveType;
  startDate: string; // ISO String (yyyy-MM-dd)
  endDate: string;   // ISO String (yyyy-MM-dd)
  reason: string;
  status: LeaveStatus;
  principalComment?: string | null;
  lessonPlanNotes?: string | null; // Study material or lesson instructions left for substitute teacher
  submittedAt: string; // ISO String
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

// ─── Predictive Correlation Radar ──────────────────────────────────────────

export type SubjectRiskLevel = 'safe' | 'watch' | 'at_risk' | 'critical';

export interface SubjectRisk {
  subject: string;
  totalPeriodsScheduled: number;
  missedPeriods: number;
  attendanceRate: number; // 0 - 100%
  historicalMarks: number[]; // e.g. [Term 1, Term 2]
  latestMark: number;
  currentGrade: string; // A, B, C, S, F
  predictedMark: number;
  predictedGrade: string; // A, B, C, S, F
  predictedDrop: number; // e.g. -24
  gradeDropLabel: string; // e.g. "B (72%) → S (48%)"
  riskLevel: SubjectRiskLevel;
  riskScore: number; // 0 - 100
  regressionSlope: number; // marks lost per missed period
  regressionR2: number; // 0.0 - 1.0 (correlation strength)
  message: string;
  recommendation: string;
}

export interface AbsenteeismPattern {
  dayOfWeek: number; // 1 = Mon ... 5 = Fri
  dayName: string;
  period: number;
  subject: string;
  teacherName?: string;
  occurrences: number;
  severity: 'moderate' | 'high' | 'critical';
  description: string;
}

export interface StudentCorrelationProfile {
  student: Student;
  classRoom: string;
  overallAttendanceRate: number;
  totalAbsences: number;
  overallRiskLevel: SubjectRiskLevel;
  overallRiskScore: number; // 0 - 100
  subjectRisks: SubjectRisk[];
  patterns: AbsenteeismPattern[];
  predictedAverageMark: number;
  latestAverageMark: number;
  hasCriticalRisk: boolean;
}

export interface TimetableSlot {
  classRoom: string;
  dayOfWeek: number; // 1 = Mon, 5 = Fri
  period: number;    // 1 to 7
  subject: string;
  teacher: string;
}

export type NoticeTargetRole = 'all' | 'teacher' | 'principal' | 'zonal_admin' | 'parent' | 'student';

export interface Notice {
  id: string;
  title: string;
  body: string;
  date: string; // ISO String
  category: string;
  targetRole?: NoticeTargetRole;
  authorName?: string;
  authorRole?: UserRole;
  priority?: 'normal' | 'high' | 'urgent';
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
  district?: string; // district quota note
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
    description: 'For students aiming for Medicine, Nursing, Veterinary, or Agriculture degrees.',
  },
  {
    id: 'mathsScience',
    nameEn: 'Physical Science (Maths)',
    nameSi: 'භෞතික විද්‍යාව (ගණිතය)',
    nameTa: 'இயற்பியல் அறிவியல் (கணிதம்)',
    color: '#0284c7',
    subjects: ['Combined Mathematics', 'Physics', 'Chemistry / ICT'],
    description: 'For Engineering, Computer Science, and Physical Science degrees.',
  },
  {
    id: 'commerce',
    nameEn: 'Commerce',
    nameSi: 'වාණිජ',
    nameTa: 'வணிகவியல்',
    color: '#d97706',
    subjects: ['Economics', 'Business Studies', 'Accounting'],
    description: 'For Management, Finance, Economics, and Business degrees.',
  },
  {
    id: 'technology',
    nameEn: 'Technology',
    nameSi: 'තාක්ෂණය',
    nameTa: 'தொழில்நுட்பம்',
    color: '#0891b2',
    subjects: ['Engineering Technology', 'Science for Technology', 'ICT / Drawing'],
    description: 'For Technology, ICT, and Engineering Technology degrees.',
  },
  {
    id: 'arts',
    nameEn: 'Arts',
    nameSi: 'කලා',
    nameTa: 'கலை',
    color: '#db2777',
    subjects: ['History / Logic', 'Geography / Civic Ed.', 'Sinhala / Tamil Literature / Economics'],
    description: 'For Humanities, Law, Social Sciences, and Languages degrees.',
  },
];

// ─── Real Sri Lanka University Pathways (UGC 2022/2023) ──────────────────────

export const SL_UNIVERSITY_PATHWAYS: UniversityPathway[] = [
  // Bio Science
  { degree: 'MBBS Medicine', university: 'University of Colombo', stream: 'bioScience', zScoreMin: 1.8, zScoreMax: 3.0, faculty: 'Faculty of Medicine' },
  { degree: 'MBBS Medicine', university: 'University of Peradeniya', stream: 'bioScience', zScoreMin: 1.7, zScoreMax: 2.8, faculty: 'Faculty of Medicine' },
  { degree: 'MBBS Medicine', university: 'University of Ruhuna', stream: 'bioScience', zScoreMin: 1.5, zScoreMax: 2.5, faculty: 'Faculty of Medicine' },
  { degree: 'MBBS Medicine', university: 'Rajarata University', stream: 'bioScience', zScoreMin: 1.4, zScoreMax: 2.3, faculty: 'Faculty of Medicine & Allied Sciences' },
  { degree: 'MBBS Medicine', university: 'University of Jaffna', stream: 'bioScience', zScoreMin: 1.6, zScoreMax: 2.6, faculty: 'Faculty of Medicine' },
  { degree: 'BSc Nursing', university: 'University of Colombo', stream: 'bioScience', zScoreMin: 0.8, zScoreMax: 1.6, faculty: 'Faculty of Medicine' },
  { degree: 'BSc Agriculture', university: 'University of Peradeniya', stream: 'bioScience', zScoreMin: 0.3, zScoreMax: 1.0, faculty: 'Faculty of Agriculture' },
  { degree: 'BSc Food Science & Technology', university: 'Wayamba University', stream: 'bioScience', zScoreMin: 0.2, zScoreMax: 0.8, faculty: 'Faculty of Livestock, Fisheries & Nutrition' },
  { degree: 'BSc Animal Science', university: 'Uva Wellassa University', stream: 'bioScience', zScoreMin: 0.2, zScoreMax: 0.7, faculty: 'Faculty of Animal Science & Export Agriculture' },
  // Physical Science (Maths)
  { degree: 'BSc Engineering', university: 'University of Moratuwa', stream: 'mathsScience', zScoreMin: 1.6, zScoreMax: 2.5, faculty: 'Faculty of Engineering' },
  { degree: 'BSc Engineering', university: 'University of Peradeniya', stream: 'mathsScience', zScoreMin: 1.4, zScoreMax: 2.2, faculty: 'Faculty of Engineering' },
  { degree: 'BSc Engineering', university: 'University of Ruhuna', stream: 'mathsScience', zScoreMin: 1.2, zScoreMax: 2.0, faculty: 'Faculty of Engineering' },
  { degree: 'BSc Computer Science', university: 'University of Colombo', stream: 'mathsScience', zScoreMin: 1.0, zScoreMax: 1.8, faculty: 'Faculty of Science' },
  { degree: 'BSc Information Technology', university: 'University of Kelaniya', stream: 'mathsScience', zScoreMin: 0.8, zScoreMax: 1.6, faculty: 'Faculty of Computing & Technology' },
  { degree: 'BSc Physical Science', university: 'University of Sri Jayewardenepura', stream: 'mathsScience', zScoreMin: 0.6, zScoreMax: 1.4, faculty: 'Faculty of Applied Sciences' },
  { degree: 'BSc Statistics', university: 'University of Colombo', stream: 'mathsScience', zScoreMin: 0.5, zScoreMax: 1.2, faculty: 'Faculty of Science' },
  // Commerce
  { degree: 'BBA Business Administration', university: 'University of Sri Jayewardenepura', stream: 'commerce', zScoreMin: 0.5, zScoreMax: 1.4, faculty: 'Faculty of Management Studies' },
  { degree: 'BCom Accountancy & Finance', university: 'University of Kelaniya', stream: 'commerce', zScoreMin: 0.4, zScoreMax: 1.2, faculty: 'Faculty of Commerce & Management' },
  { degree: 'BSc Economics', university: 'University of Colombo', stream: 'commerce', zScoreMin: 0.6, zScoreMax: 1.5, faculty: 'Faculty of Arts' },
  { degree: 'BBA Marketing', university: 'University of Kelaniya', stream: 'commerce', zScoreMin: 0.3, zScoreMax: 1.0, faculty: 'Faculty of Commerce & Management' },
  { degree: 'BSc Business Management', university: 'Sabaragamuwa University', stream: 'commerce', zScoreMin: 0.2, zScoreMax: 0.9, faculty: 'Faculty of Management Studies' },
  // Technology
  { degree: 'BSc Technology (Engineering)', university: 'UNIVOTEC', stream: 'technology', zScoreMin: 0.3, zScoreMax: 1.2, faculty: 'Faculty of Technology' },
  { degree: 'BSc Engineering Technology', university: 'Uva Wellassa University', stream: 'technology', zScoreMin: 0.2, zScoreMax: 1.0, faculty: 'Faculty of Science & Technology' },
  { degree: 'BSc ICT', university: 'University of Moratuwa', stream: 'technology', zScoreMin: 0.8, zScoreMax: 1.5, faculty: 'Faculty of Information Technology' },
  { degree: 'BSc Quantity Surveying', university: 'University of Moratuwa', stream: 'technology', zScoreMin: 0.6, zScoreMax: 1.3, faculty: 'Faculty of Architecture' },
  // Arts
  { degree: 'BA Law (LLB)', university: 'University of Colombo', stream: 'arts', zScoreMin: 0.8, zScoreMax: 1.8, faculty: 'Faculty of Law' },
  { degree: 'BA Social Sciences', university: 'University of Kelaniya', stream: 'arts', zScoreMin: 0.1, zScoreMax: 0.8, faculty: 'Faculty of Social Sciences' },
  { degree: 'BA Mass Communication', university: 'University of Kelaniya', stream: 'arts', zScoreMin: 0.2, zScoreMax: 1.0, faculty: 'Faculty of Humanities' },
  { degree: 'BA Political Science', university: 'University of Peradeniya', stream: 'arts', zScoreMin: 0.1, zScoreMax: 0.7, faculty: 'Faculty of Arts' },
  { degree: 'BA Eastern Languages', university: 'University of Jaffna', stream: 'arts', zScoreMin: 0.1, zScoreMax: 0.6, faculty: 'Faculty of Arts' },
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
