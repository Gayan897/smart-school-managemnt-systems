import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  limit,
  writeBatch,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import type {
  DocumentData,
  CollectionReference,
  Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import {
  enqueueOperation,
  dequeueAll,
  requeueOperation,
  getQueueLength,
  type QueuedOperation,
} from './offlineQueue';
import { defaultClasses, COLOMBO_GOVT_SCHOOLS } from './models';
import type {
  User,
  Student,
  Teacher,
  SchoolClass,
  LeaveRequest,
  AttendanceRecord,
  AttendanceStatus,
  TermMark,
  TimetableSlot,
  Notice,
  ParentNotification,
  ProxyAssignment,
  GovernmentSchool,
  ZonalKeyRequest,
} from './models';

// Helpers to get collection references with types
const getColRef = <T extends DocumentData>(collectionName: string) => {
  return collection(db, collectionName) as CollectionReference<T, DocumentData>;
};

const usersCol = getColRef<User>('users');
const studentsCol = getColRef<Student>('students');
const teachersCol = getColRef<Teacher>('teachers');
const leaveRequestsCol = getColRef<LeaveRequest>('leave_requests');
const attendanceCol = getColRef<AttendanceRecord>('attendance');
const termMarksCol = getColRef<TermMark>('term_marks');
const timetableCol = getColRef<TimetableSlot>('timetable');
const noticesCol = getColRef<Notice>('notices');
const classesCol = getColRef<SchoolClass>('classes');
const parentNotificationsCol = getColRef<ParentNotification>('parent_notifications');
const proxyAssignmentsCol = getColRef<ProxyAssignment>('proxy_assignments');
const schoolsCol = getColRef<GovernmentSchool>('schools');
const keyRequestsCol = getColRef<ZonalKeyRequest>('key_requests');

/**
 * Recursively removes keys with `undefined` values from an object,
 * preventing Firestore `setDoc`/`batch.set` unsupported field value errors.
 */
export function cleanData<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanData(item)) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        cleaned[key] = cleanData(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned as T;
}

export const PERMANENT_ZONAL_ADMIN: User = {
  id: 'zonal_admin_permanent_master',
  username: 'admin',
  password: 'admin',
  name: 'Zonal Master Administrator',
  role: 'zonal_admin',
  schoolCensusCode: 'ZONAL-MOE',
  schoolName: 'Colombo / Homagama Zonal Education Office',
  nicNumber: '198000000000',
  sleasNumber: 'SLEAS-DIR-001',
};

export const defaultNotices: Notice[] = [
  {
    id: 'notice_sys_01',
    title: '📘 Ministry of Education Circular 2026/01: Academic Term & Exam Schedule',
    body: 'Official Announcement: All provincial and zonal schools in Sri Lanka must adhere to the 2026 Academic Calendar. Term 1 examinations will commence as per Ministry instructions. School heads must ensure attendance logging and proxy assignment accuracy.',
    date: new Date(Date.now() - 3600000 * 2).toISOString(),
    category: 'Academic',
    targetRole: 'all',
    priority: 'high',
    authorName: 'Ministry of Education',
    authorRole: 'zonal_admin',
  },
  {
    id: 'notice_sys_02',
    title: '📚 EduPub Textbook & Teacher Guide Distribution Notice',
    body: 'Educational Publications Department (edupub.gov.lk) digital textbooks and teacher guides for Grades 1 to 13 are now accessible directly within EduNexus via the EduPub Portal tab. Teachers are advised to verify syllabus coverage.',
    date: new Date(Date.now() - 3600000 * 8).toISOString(),
    category: 'General',
    targetRole: 'all',
    priority: 'normal',
    authorName: 'EduPub Department',
    authorRole: 'zonal_admin',
  },
  {
    id: 'notice_sys_03',
    title: '🚨 Teacher Attendance & Leave Application Guidelines',
    body: 'Teachers applying for Casual, Medical, Annual, or Half-Day leave must submit requests at least 24 hours prior to leave start date whenever possible. Lesson plan instructions for substitute teachers should be attached in the Leave portal.',
    date: new Date(Date.now() - 3600000 * 24).toISOString(),
    category: 'Administrative',
    targetRole: 'teacher',
    priority: 'urgent',
    authorName: 'Principal Office',
    authorRole: 'principal',
  },
  {
    id: 'notice_sys_04',
    title: '🎓 University Z-Score & Stream Selection Advisor Tool Activated',
    body: 'The EduNexus University Advisor module is live. O/L and A/L stream coordinators can utilize the pathway analyzer for student career guidance across Sri Lankan public universities.',
    date: new Date(Date.now() - 3600000 * 48).toISOString(),
    category: 'Academic',
    targetRole: 'all',
    priority: 'normal',
    authorName: 'Zonal Administration',
    authorRole: 'zonal_admin',
  },
];

export const databaseService = {
  async createUser(user: User): Promise<void> {
    await setDoc(doc(usersCol, user.id), cleanData(user));
  },

  async updateUserProfile(userId: string, updates: Partial<User> & { subject?: string; classRoom?: string }): Promise<User> {
    const userRef = doc(usersCol, userId);
    const userSnapshot = await getDocs(query(usersCol, where('id', '==', userId), limit(1)));
    let currentUser: User | null = null;
    if (!userSnapshot.empty) {
      currentUser = userSnapshot.docs[0].data();
    }

    const { subject, classRoom, ...userUpdates } = updates;

    // Update users collection
    await setDoc(userRef, cleanData(userUpdates), { merge: true });

    // Update teachers collection if applicable
    if (currentUser?.role === 'teacher' || subject !== undefined || classRoom !== undefined) {
      const teacherRef = doc(teachersCol, userId);
      await setDoc(teacherRef, cleanData({
        name: updates.name,
        subject,
        classRoom,
      }), { merge: true });
    }

    const updatedUser: User = {
      ...(currentUser || {} as User),
      ...userUpdates,
      ...(classRoom ? { classRoom } : {}),
    };

    return updatedUser;
  },

  async getUserByUsername(username: string): Promise<User | null> {
    const clean = username.trim();
    if (clean.toLowerCase() === 'admin' || clean.toLowerCase() === 'zonal_admin') {
      try {
        await setDoc(doc(usersCol, PERMANENT_ZONAL_ADMIN.id), cleanData(PERMANENT_ZONAL_ADMIN), { merge: true });
      } catch (e) {
        console.warn('Failed to seed permanent admin:', e);
      }
      return PERMANENT_ZONAL_ADMIN;
    }
    const q = query(usersCol, where('username', '==', clean), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const u = snapshot.docs[0].data();
      if (u.role === 'teacher' && u.nicVerificationStatus === 'pending' && u.verificationUnlockAt && Date.now() >= u.verificationUnlockAt) {
        u.nicVerificationStatus = 'verified';
        try {
          await setDoc(doc(usersCol, u.id), cleanData<Partial<User>>({ nicVerificationStatus: 'verified' }), { merge: true });
        } catch (e) {
          console.warn('Failed to update verification status in firestore:', e);
        }
      }
      return u;
    }

    // Secondary check: look up user by NIC number
    const qNic = query(usersCol, where('nicNumber', '==', clean.toUpperCase()), limit(1));
    const snapshotNic = await getDocs(qNic);
    if (!snapshotNic.empty) {
      const u = snapshotNic.docs[0].data();
      if (u.role === 'teacher' && u.nicVerificationStatus === 'pending' && u.verificationUnlockAt && Date.now() >= u.verificationUnlockAt) {
        u.nicVerificationStatus = 'verified';
        try {
          await setDoc(doc(usersCol, u.id), cleanData<Partial<User>>({ nicVerificationStatus: 'verified' }), { merge: true });
        } catch (e) {
          console.warn('Failed to update verification status in firestore:', e);
        }
      }
      return u;
    }

    return null;
  },

  async getUserByNic(nicNumber: string): Promise<User | null> {
    const clean = nicNumber.trim().toUpperCase();
    if (!clean) return null;
    try {
      const q = query(usersCol, where('nicNumber', '==', clean), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs[0].data();
      }
    } catch (e) {
      console.warn('Error querying user by NIC:', e);
    }
    return null;
  },

  async updateUserVerificationStatus(userId: string, status: 'pending' | 'verified' | 'rejected'): Promise<void> {
    try {
      await setDoc(doc(usersCol, userId), cleanData<Partial<User>>({ nicVerificationStatus: status }), { merge: true });
    } catch (e) {
      console.warn('Failed to update user verification status:', e);
    }
  },

  async createTeacherProfile(user: User): Promise<void> {
    const teacher: Teacher = {
      id: user.id,
      name: user.name,
      subject: 'Not assigned',
      classRoom: user.classRoom || 'Not assigned',
      casualBalance: 7,
      medicalBalance: 14,
      annualBalance: 21,
      schoolCensusCode: user.schoolCensusCode,
      schoolName: user.schoolName,
    };
    await setDoc(doc(teachersCol, user.id), cleanData(teacher));
  },

  async getTeachers(schoolCensusCode?: string): Promise<Teacher[]> {
    const userSnap = await getDocs(query(usersCol, where('role', '==', 'teacher')));
    const teacherSnap = await getDocs(teachersCol);

    const teacherDocs: Record<string, Teacher> = {};
    teacherSnap.forEach((doc) => {
      teacherDocs[doc.id] = doc.data();
    });

    const teachers = userSnap.docs.map((doc) => {
      const u = doc.data();
      const t = teacherDocs[doc.id];
      return {
        id: doc.id,
        name: u.name || 'Unknown Teacher',
        subject: t?.subject || 'Not assigned',
        classRoom: t?.classRoom || 'Not assigned',
        casualBalance: t?.casualBalance ?? 7,
        medicalBalance: t?.medicalBalance ?? 14,
        annualBalance: t?.annualBalance ?? 21,
        schoolCensusCode: u.schoolCensusCode || t?.schoolCensusCode || undefined,
        schoolName: u.schoolName || t?.schoolName || undefined,
      };
    });

    if (schoolCensusCode) {
      return teachers.filter(t => t.schoolCensusCode === schoolCensusCode);
    }

    return teachers;
  },

  resolveStudentRegistrationStatus(students: Student[], users: DocumentData[]): Student[] {
    const studentUsers = users.filter(u => u.role === 'student');
    const parentUsers = users.filter(u => u.role === 'parent');

    return students.map(s => {
      const sId = (s.id || '').trim().toUpperCase();
      const sAdm = (s.admissionNumber || '').trim().toUpperCase();
      const sName = (s.name || '').trim().toLowerCase();
      const sPhoneDigits = (s.parentContact || '').replace(/[^0-9]/g, '');

      const hasStudentUser = studentUsers.some(u => {
        const uId = (u.id || '').trim().toUpperCase();
        const uUsername = (u.username || '').trim().toLowerCase();
        const uAdm = (u.admissionNumber || u.studentId || '').trim().toUpperCase();
        const uName = (u.name || '').trim().toLowerCase();

        return (
          uId === sId ||
          (sAdm && (uAdm === sAdm || uUsername === sAdm.toLowerCase())) ||
          uUsername === sId.toLowerCase() ||
          (sName && (uName === sName || uUsername === sName))
        );
      });

      const hasParentUser = parentUsers.some(u => {
        const uLinkedId = (u.studentId || u.admissionNumber || u.studentAdmission || '').trim().toUpperCase();
        const uPhoneDigits = (u.parentContact || u.phone || u.mobile || '').replace(/[^0-9]/g, '');

        const matchesId = uLinkedId && (uLinkedId === sId || (sAdm && uLinkedId === sAdm));
        const matchesPhone = sPhoneDigits && sPhoneDigits.length >= 7 && uPhoneDigits && uPhoneDigits.length >= 7 &&
          (sPhoneDigits.endsWith(uPhoneDigits.slice(-7)) || uPhoneDigits.endsWith(sPhoneDigits.slice(-7)));

        return matchesId || matchesPhone;
      });

      return {
        ...s,
        isStudentRegistered: s.isStudentRegistered === true || hasStudentUser,
        isParentRegistered: s.isParentRegistered === true || hasParentUser,
      };
    });
  },

  async getStudents(schoolCensusCode?: string): Promise<Student[]> {
    const [snapshot, usersSnapshot] = await Promise.all([
      getDocs(studentsCol),
      getDocs(usersCol),
    ]);
    const rawStudents = snapshot.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.data().id || docSnap.id }));
    const rawUsers = usersSnapshot.docs.map(d => ({ ...d.data(), id: d.id }));

    const students = this.resolveStudentRegistrationStatus(rawStudents, rawUsers);

    // Auto-heal Firestore if missing flags
    for (const s of students) {
      const orig = rawStudents.find(r => r.id === s.id);
      if (orig && ((s.isStudentRegistered && !orig.isStudentRegistered) || (s.isParentRegistered && !orig.isParentRegistered))) {
        setDoc(doc(studentsCol, s.id), cleanData({
          isStudentRegistered: s.isStudentRegistered,
          isParentRegistered: s.isParentRegistered,
        }), { merge: true }).catch(() => {});
      }
    }

    if (schoolCensusCode) {
      return students.filter(s => s.schoolCensusCode === schoolCensusCode);
    }

    return students;
  },

  async createStudent(student: Student): Promise<void> {
    const existing = await this.getStudents();
    const adm = student.admissionNumber?.trim() || this.generateRandomAdmissionNumber(existing);
    const dataToSave: Student = {
      ...student,
      admissionNumber: adm.toUpperCase(),
      registeredAt: student.registeredAt || new Date().toISOString(),
    };
    await setDoc(doc(studentsCol, student.id), cleanData(dataToSave));
  },

  async deleteStudent(studentId: string): Promise<void> {
    // 1. Delete student doc
    await deleteDoc(doc(studentsCol, studentId));

    // 2. Cleanup associated attendance records in Firestore
    try {
      const q = query(attendanceCol, where('studentId', '==', studentId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach(d => {
          batch.delete(d.ref);
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn('Failed to cleanup student attendance records on delete:', e);
    }
  },

  generateRandomAdmissionNumber(existingStudents: Student[] = []): string {
    const allAdmissions = new Set(
      existingStudents.map(s => (s.admissionNumber || s.id || '').toUpperCase())
    );
    let candidate = '';
    let attempts = 0;
    do {
      // 5-digit random admission number format: e.g. ADM-84920
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      candidate = `ADM-${randomNum}`;
      attempts++;
    } while (allAdmissions.has(candidate.toUpperCase()) && attempts < 100);

    return candidate;
  },

  async getStudentByAdmissionNumber(admissionNumber: string, schoolCensusCode?: string): Promise<Student | null> {
    const clean = (admissionNumber || '').trim().toUpperCase();
    if (!clean) return null;

    const allStudents = await this.getStudents();
    const matched = allStudents.find(s => {
      const sAdm = (s.admissionNumber || '').toUpperCase();
      const sId = (s.id || '').toUpperCase();
      const matchesAdm = sAdm === clean || sId === clean || sAdm.replace(/[^0-9]/g, '') === clean.replace(/[^0-9]/g, '');
      if (!matchesAdm) return false;
      if (schoolCensusCode && s.schoolCensusCode && s.schoolCensusCode !== schoolCensusCode) {
        return false;
      }
      return true;
    });

    return matched || null;
  },

  async updateStudentRegistrationStatus(studentId: string, role: 'student' | 'parent', registered = true): Promise<void> {
    try {
      const updateData = role === 'student' ? { isStudentRegistered: registered } : { isParentRegistered: registered };
      await setDoc(doc(studentsCol, studentId), cleanData(updateData), { merge: true });
    } catch (e) {
      console.warn('Failed to update student registration status:', e);
    }
  },

  generateStudentId(classRoom: string, existingStudents: Student[] = []): string {
    const year = new Date().getFullYear();
    const cleanClass = (classRoom || 'GEN').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const prefix = `STU-${year}-${cleanClass}-`;
    const classStudents = existingStudents.filter(s => s.id && s.id.toUpperCase().startsWith(prefix));

    let nextSeq = classStudents.length + 1;
    let candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;

    const allIds = new Set(existingStudents.map(s => (s.id || '').toUpperCase()));
    while (allIds.has(candidate.toUpperCase())) {
      nextSeq++;
      candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
    }
    return candidate;
  },

  async getStudentCompleteProfile(studentId: string) {
    const [students, allAttendance, allMarks, allParentNotifs, classes] = await Promise.all([
      this.getStudents(),
      this.getAttendance(),
      this.getTermMarks(),
      this.getParentNotifications(studentId),
      this.getClasses(),
    ]);

    const student = students.find(s => s.id === studentId) || null;
    const attendance = allAttendance
      .filter(a => a.studentId === studentId)
      .sort((a, b) => b.date.localeCompare(a.date));
    const marks = allMarks.filter(m => m.studentId === studentId);
    const classObj = student ? classes.find(c => c.id === student.classRoom) || null : null;

    return {
      student,
      attendance,
      marks,
      parentNotifications: allParentNotifs,
      classObj,
    };
  },

  async getLeaveRequests(schoolCensusCode?: string): Promise<LeaveRequest[]> {
    const snapshot = await getDocs(leaveRequestsCol);
    const rawRequests = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));

    // Build teacherId -> schoolCensusCode map from users collection
    const userSnap = await getDocs(query(usersCol, where('role', '==', 'teacher')));
    const teacherSchoolMap: Record<string, string> = {};
    userSnap.forEach((doc) => {
      const u = doc.data();
      if (u.id && u.schoolCensusCode) {
        teacherSchoolMap[u.id] = u.schoolCensusCode;
      }
    });

    const requests = rawRequests.map(r => ({
      ...r,
      schoolCensusCode: r.schoolCensusCode || teacherSchoolMap[r.teacherId] || undefined,
    }));

    if (schoolCensusCode) {
      const filtered = requests.filter(r => r.schoolCensusCode === schoolCensusCode);
      return filtered.sort((a, b) => new Date(b.submittedAt || b.startDate).getTime() - new Date(a.submittedAt || a.startDate).getTime());
    }

    return requests.sort((a, b) => new Date(b.submittedAt || b.startDate).getTime() - new Date(a.submittedAt || a.startDate).getTime());
  },

  async insertLeaveRequest(request: LeaveRequest): Promise<void> {
    // ── Offline-safe ──
    if (!navigator.onLine) {
      enqueueOperation({ type: 'insertLeaveRequest', request });
      console.info('[OfflineQueue] Leave request queued for later sync (device offline).');
      return;
    }

    try {
      await setDoc(doc(leaveRequestsCol, request.id), cleanData(request));

      const isPrincipal = request.applicantRole === 'principal';

      // If Principal applied, notify Zonal Admin. If Teacher applied, notify Principal.
      const notice: Notice = {
        id: `notice_leave_${request.id}`,
        title: isPrincipal
          ? `🏛️ Principal Leave Request: ${request.teacherName} (${request.schoolName || 'School'})`
          : `Leave Request: ${request.teacherName}`,
        body: isPrincipal
          ? `Principal ${request.teacherName} of ${request.schoolName || 'School'} has submitted a ${request.type.toUpperCase()} leave request from ${request.startDate} to ${request.endDate}.\nReason: ${request.reason}\n\nPlease review and approve in the Zonal Admin Command Center.`
          : `${request.teacherName} has submitted a ${request.type.toUpperCase()} leave request from ${request.startDate} to ${request.endDate}.\nReason: ${request.reason}`,
        date: new Date().toISOString(),
        category: 'Leave Request',
        targetRole: isPrincipal ? 'zonal_admin' : 'principal',
        authorName: request.teacherName,
        authorRole: isPrincipal ? 'principal' : 'teacher',
        priority: 'urgent',
        schoolCensusCode: request.schoolCensusCode,
        schoolName: request.schoolName,
      };
      await setDoc(doc(noticesCol, notice.id), cleanData(notice));
    } catch (err) {
      enqueueOperation({ type: 'insertLeaveRequest', request });
      console.warn('[OfflineQueue] Leave request write failed, queued for sync. Error:', err);
    }
  },

  async updateLeaveRequest(request: LeaveRequest): Promise<LeaveRequest> {
    // ── Offline-safe: if offline, queue the update ──
    if (!navigator.onLine) {
      enqueueOperation({ type: 'updateLeaveRequest', request });
      console.info('[OfflineQueue] Leave update queued for later sync (device offline).');
      return request;
    }

    let updatedReq = { ...request };
    const isPrincipal = request.applicantRole === 'principal';

    // If approved, deduct leave from applicant's balances and record remaining balances
    if (request.status === 'approved' && request.teacherId) {
      try {
        // Calculate days to deduct
        const isHalf = request.isHalfDay || request.type.toString().startsWith('half');
        let days = 1;
        if (isHalf) {
          days = 0.5;
        } else if (request.startDate && request.endDate) {
          const start = new Date(request.startDate);
          const end = new Date(request.endDate);
          const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          days = diff > 0 ? diff : 1;
        }

        const baseType = request.type.toString().replace(/^half_/, '');

        if (isPrincipal) {
          // ── PRINCIPAL LEAVE DEDUCTION (Stored in users collection) ──
          const userRef = doc(usersCol, request.teacherId);
          const userSnap = await getDoc(userRef);
          const uData = userSnap.exists() ? userSnap.data() as User : null;

          const currentCasual = uData?.casualBalance ?? 7;
          const currentMedical = uData?.medicalBalance ?? 14;
          const currentAnnual = uData?.annualBalance ?? 21;

          let newCasual = currentCasual;
          let newMedical = currentMedical;
          let newAnnual = currentAnnual;

          if (baseType === 'casual') {
            newCasual = Math.max(0, currentCasual - days);
          } else if (baseType === 'medical') {
            newMedical = Math.max(0, currentMedical - days);
          } else if (baseType === 'annual') {
            newAnnual = Math.max(0, currentAnnual - days);
          }

          updatedReq = {
            ...updatedReq,
            remainingCasualAfterApproval: newCasual,
            remainingMedicalAfterApproval: newMedical,
            remainingAnnualAfterApproval: newAnnual,
            reviewedByRole: 'zonal_admin',
          };

          await setDoc(userRef, cleanData<Partial<User>>({
            casualBalance: newCasual,
            medicalBalance: newMedical,
            annualBalance: newAnnual,
          }), { merge: true });

        } else {
          // ── TEACHER LEAVE DEDUCTION (Stored in teachers collection) ──
          const teacherRef = doc(teachersCol, request.teacherId);
          const allTeachers = await this.getTeachers();
          const tObj = allTeachers.find(t => t.id === request.teacherId);

          const currentCasual = tObj?.casualBalance ?? 7;
          const currentMedical = tObj?.medicalBalance ?? 14;
          const currentAnnual = tObj?.annualBalance ?? 21;

          let newCasual = currentCasual;
          let newMedical = currentMedical;
          let newAnnual = currentAnnual;

          if (baseType === 'casual') {
            newCasual = Math.max(0, currentCasual - days);
          } else if (baseType === 'medical') {
            newMedical = Math.max(0, currentMedical - days);
          } else if (baseType === 'annual') {
            newAnnual = Math.max(0, currentAnnual - days);
          }

          updatedReq = {
            ...updatedReq,
            remainingCasualAfterApproval: newCasual,
            remainingMedicalAfterApproval: newMedical,
            remainingAnnualAfterApproval: newAnnual,
            reviewedByRole: 'principal',
          };

          await setDoc(teacherRef, cleanData<Partial<Teacher>>({
            casualBalance: newCasual,
            medicalBalance: newMedical,
            annualBalance: newAnnual,
          }), { merge: true });
        }
      } catch (e) {
        console.warn('Failed to update leave balance on Firestore:', e);
      }
    }

    await setDoc(doc(leaveRequestsCol, request.id), cleanData(updatedReq), { merge: true });

    const remInfo = updatedReq.remainingCasualAfterApproval !== undefined
      ? `\nUpdated Remaining Balances -> Casual: ${updatedReq.remainingCasualAfterApproval} days, Medical: ${updatedReq.remainingMedicalAfterApproval} days, Annual: ${updatedReq.remainingAnnualAfterApproval} days.`
      : '';

    // Automatically generate notification for applicant
    const approverTitle = isPrincipal ? 'Zonal Education Office / Admin' : 'Principal Office';
    const comment = isPrincipal ? (request.adminComment || request.principalComment) : request.principalComment;

    const notice: Notice = {
      id: `notice_leave_decision_${request.id}_${Date.now()}`,
      title: `Leave Request ${request.status.toUpperCase()}: ${request.type.toString().replace('_', ' ').toUpperCase()} Leave`,
      body: `Leave request for ${request.teacherName} (${request.startDate} to ${request.endDate}${request.isHalfDay ? ' [Half Day]' : ''}) has been ${request.status.toUpperCase()} by ${approverTitle}.${comment ? `\nRemark: ${comment}` : ''}${remInfo}`,
      date: new Date().toISOString(),
      category: 'Leave Request',
      targetRole: isPrincipal ? 'principal' : 'teacher',
      authorName: approverTitle,
      authorRole: isPrincipal ? 'zonal_admin' : 'principal',
      priority: request.status === 'approved' ? 'high' : 'urgent',
      schoolCensusCode: request.schoolCensusCode,
      schoolName: request.schoolName,
    };
    await setDoc(doc(noticesCol, notice.id), cleanData(notice));
    return updatedReq;
  },

  async getAttendance(): Promise<AttendanceRecord[]> {
    const snapshot = await getDocs(attendanceCol);
    return snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id
    }));
  },

  async saveAttendance(record: AttendanceRecord): Promise<void> {
    if (record.id) {
      const docRef = doc(attendanceCol, record.id);
      await setDoc(docRef, cleanData(record), { merge: true });
    } else {
      const newDocRef = doc(collection(db, 'attendance'));
      const data = { ...record, id: newDocRef.id };
      await setDoc(newDocRef, cleanData(data));
    }
  },

  async saveAttendanceWithParentNotifications(
    records: AttendanceRecord[],
    teacherName: string,
    studentMap: Record<string, Student>
  ): Promise<void> {
    // ── Offline-safe: if offline or Firestore unavailable, queue locally ──
    if (!navigator.onLine) {
      enqueueOperation({ type: 'saveAttendance', records, teacherName, studentMap });
      console.info('[OfflineQueue] Attendance queued for later sync (device offline).');
      return;
    }

    try {
      const batch = writeBatch(db);
      const nowIso = new Date().toISOString();

      for (const record of records) {
        // 1. Save or update attendance record
        let attDocRef;
        if (record.id) {
          attDocRef = doc(attendanceCol, record.id);
          batch.set(attDocRef, cleanData(record), { merge: true });
        } else {
          attDocRef = doc(collection(db, 'attendance'));
          batch.set(attDocRef, cleanData({ ...record, id: attDocRef.id }));
        }

        // 2. Generate real-time Parent Notification document
        const stu = studentMap[record.studentId];
        const studentName = stu ? stu.name : record.studentId;
        const statusTitle = record.status.toUpperCase();
        const parentPhone = stu ? stu.parentContact : '';

        const priorityVal: 'normal' | 'high' | 'urgent' =
          record.status === 'absent' ? 'urgent' : record.status === 'late' ? 'high' : 'normal';

        const statusMessageMap: Record<string, string> = {
          present: `${studentName} was marked PRESENT for school on ${record.date}.`,
          absent: `🚨 URGENT NOTICE: ${studentName} (Class: ${stu?.classRoom || ''}) was marked ABSENT from school on ${record.date}. If this absence was unexcused, please contact the school immediately.`,
          late: `⚠️ ATTENDANCE ALERT: ${studentName} arrived LATE to school on ${record.date}. Recorded by ${teacherName || 'Class Teacher'}.`,
          excused: `${studentName} attendance was marked EXCUSED on ${record.date}.`,
        };

        const notifId = `pnotif_${record.studentId}_${record.date.replace(/-/g, '')}_${Date.now()}`;
        const notifDocRef = doc(parentNotificationsCol, notifId);

        const parentNotif: ParentNotification = {
          id: notifId,
          studentId: record.studentId,
          studentName: studentName,
          date: record.date,
          status: record.status,
          title: record.status === 'absent' ? `🚨 ABSENT ALERT: ${studentName}` : record.status === 'late' ? `⚠️ LATE ARRIVAL: ${studentName}` : `Attendance Update: ${statusTitle}`,
          message: statusMessageMap[record.status] || `${studentName} was marked ${statusTitle} on ${record.date}.`,
          timestamp: nowIso,
          read: false,
          teacherName: teacherName || 'Class Teacher',
          type: 'attendance',
          priority: priorityVal,
          parentContact: parentPhone,
          actionRequired: record.status === 'absent' || record.status === 'late',
        };

        batch.set(notifDocRef, parentNotif);
      }

      await batch.commit();
    } catch (err) {
      // Firestore unavailable — queue for later sync
      enqueueOperation({ type: 'saveAttendance', records, teacherName, studentMap });
      console.warn('[OfflineQueue] Attendance write failed, queued for sync. Error:', err);
    }
  },

  generateParentAlertMessage(student: Student, status: AttendanceStatus, date: string, teacherName: string) {
    const studentName = student.name;
    const cleanPhone = (student.parentContact || '').replace(/[^0-9+]/g, '');

    let alertText = '';
    if (status === 'absent') {
      alertText = `🚨 *EDUNEXUS URGENT ALERT* 🚨\n\nDear Parent/Guardian,\n\nYour child *${studentName}* (ID: ${student.id}, Class: ${student.classRoom}) was marked *ABSENT* from school today (${date}).\n\nRecorded by: ${teacherName || 'Homeroom Teacher'}\n\nIf this absence is unexcused, please contact the school immediately or reply with the reason for absence.\n\n— EduNexus School Administration`;
    } else if (status === 'late') {
      alertText = `⚠️ *EDUNEXUS ATTENDANCE NOTICE* ⚠️\n\nDear Parent/Guardian,\n\nYour child *${studentName}* (Class: ${student.classRoom}) arrived *LATE* to school on ${date}.\n\nRecorded by: ${teacherName || 'Homeroom Teacher'}\n\n— EduNexus School Administration`;
    } else {
      alertText = `ℹ️ *EduNexus Attendance Notice*: ${studentName} was marked ${status.toUpperCase()} on ${date}.`;
    }

    const encodedText = encodeURIComponent(alertText);
    const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodedText}` : '';
    const smsUrl = cleanPhone ? `sms:${cleanPhone}?body=${encodedText}` : '';

    return {
      messageText: alertText,
      whatsappUrl,
      smsUrl,
      parentPhone: cleanPhone,
    };
  },

  async getParentNotifications(studentId: string): Promise<ParentNotification[]> {
    const q = query(
      parentNotificationsCol,
      where('studentId', '==', studentId)
    );
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
    list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return list;
  },

  async getTermMarks(): Promise<TermMark[]> {
    const snapshot = await getDocs(termMarksCol);
    return snapshot.docs.map((doc) => doc.data());
  },

  async saveTermMarksBatch(marks: TermMark[]): Promise<void> {
    if (marks.length === 0) return;

    // ── Offline-safe ──
    if (!navigator.onLine) {
      enqueueOperation({ type: 'saveTermMarks', marks });
      console.info('[OfflineQueue] Term marks queued for later sync (device offline).');
      return;
    }

    try {
      const batch = writeBatch(db);
      for (const m of marks) {
        const cleanSub = m.subject.replace(/[^a-zA-Z0-9]/g, '_');
        const docId = `${m.studentId}_${cleanSub}_${m.term}`;
        const docRef = doc(termMarksCol, docId);
        batch.set(docRef, cleanData(m), { merge: true });
      }
      await batch.commit();
    } catch (err) {
      enqueueOperation({ type: 'saveTermMarks', marks });
      console.warn('[OfflineQueue] Term marks write failed, queued for sync. Error:', err);
    }
  },

  subscribeToStudents(
    callback: (students: Student[]) => void,
    schoolCensusCode?: string,
    onError?: (err: Error) => void
  ): Unsubscribe {
    return onSnapshot(
      studentsCol,
      async (snap) => {
        const rawStudents = snap.docs.map((d) => ({ ...d.data(), id: d.data().id || d.id }));
        try {
          const usersSnap = await getDocs(usersCol);
          const rawUsers = usersSnap.docs.map(d => ({ ...d.data(), id: d.id }));
          let list = this.resolveStudentRegistrationStatus(rawStudents, rawUsers);
          if (schoolCensusCode) {
            list = list.filter(s => s.schoolCensusCode === schoolCensusCode);
          }
          callback(list);
        } catch {
          let list = rawStudents;
          if (schoolCensusCode) {
            list = list.filter(s => s.schoolCensusCode === schoolCensusCode);
          }
          callback(list);
        }
      },
      (err) => {
        console.error('[EduNexus] subscribeToStudents error:', err);
        onError?.(err);
      }
    );
  },

  subscribeToTermMarks(
    callback: (marks: TermMark[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    return onSnapshot(
      termMarksCol,
      (snap) => {
        const marks = snap.docs.map((d) => d.data());
        callback(marks);
      },
      (err) => {
        console.error('[EduNexus] subscribeToTermMarks error:', err);
        onError?.(err);
      }
    );
  },

  subscribeToLeaveRequests(
    callback: (requests: LeaveRequest[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    return onSnapshot(
      leaveRequestsCol,
      (snap) => {
        const requests = snap.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })).sort((a, b) => new Date(b.submittedAt || b.startDate).getTime() - new Date(a.submittedAt || a.startDate).getTime());
        callback(requests);
      },
      (err) => {
        console.error('[EduNexus] subscribeToLeaveRequests error:', err);
        onError?.(err);
      }
    );
  },

  async getTimetable(): Promise<TimetableSlot[]> {
    const snapshot = await getDocs(timetableCol);
    return snapshot.docs.map((doc) => doc.data());
  },
  async getNotices(): Promise<Notice[]> {
    const snapshot = await getDocs(noticesCol);
    if (snapshot.empty) {
      // Seed default system notices
      try {
        const batch = writeBatch(db);
        for (const n of defaultNotices) {
          batch.set(doc(noticesCol, n.id), cleanData(n));
        }
        await batch.commit();
      } catch (e) {
        console.warn('Failed to seed default notices:', e);
      }
      return defaultNotices;
    }

    const notices: Notice[] = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
    return notices.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  },

  async createNotice(notice: Notice): Promise<void> {
    await setDoc(doc(noticesCol, notice.id), cleanData(notice));
  },

  async deleteNotice(noticeId: string): Promise<void> {
    await deleteDoc(doc(noticesCol, noticeId));
  },

  async getClasses(): Promise<SchoolClass[]> {
    const snapshot = await getDocs(classesCol);
    if (!snapshot.empty) {
      return snapshot.docs.map((doc) => doc.data());
    }
    // Seed default classes on first run
    const batch = writeBatch(db);
    for (const cls of defaultClasses) {
      batch.set(doc(classesCol, cls.id), cls);
    }
    await batch.commit();
    return defaultClasses;
  },

  async assignTeacherToClass(
    classId: string,
    teacherId: string | null,
    teacherName: string | null
  ): Promise<void> {
    const classDocRef = doc(classesCol, classId);
    await setDoc(classDocRef, cleanData({
      homeroomTeacherId: teacherId,
      homeroomTeacherName: teacherName
    }), { merge: true });

    if (teacherId) {
      const teacherDocRef = doc(teachersCol, teacherId);
      await setDoc(teacherDocRef, cleanData({
        classRoom: classId
      }), { merge: true });

      const notice: Notice = {
        id: `notice_class_assign_${classId}_${Date.now()}`,
        title: `Homeroom Teacher Assigned: Class ${classId}`,
        body: `${teacherName || 'Teacher'} has been assigned as homeroom teacher for Class ${classId}.`,
        date: new Date().toISOString(),
        category: 'Administrative',
        targetRole: 'teacher',
        authorName: 'Principal Office',
        authorRole: 'principal',
        priority: 'normal',
      };
      await setDoc(doc(noticesCol, notice.id), cleanData(notice));
    }
  },

  async removeTeacherFromClass(classId: string): Promise<void> {
    const classDocRef = doc(classesCol, classId);
    await setDoc(classDocRef, cleanData({
      homeroomTeacherId: null,
      homeroomTeacherName: null
    }), { merge: true });

    const notice: Notice = {
      id: `notice_class_remove_${classId}_${Date.now()}`,
      title: `Homeroom Teacher Unassigned: Class ${classId}`,
      body: `Homeroom teacher assignment for Class ${classId} has been removed by the Principal Office.`,
      date: new Date().toISOString(),
      category: 'Administrative',
      targetRole: 'teacher',
      authorName: 'Principal Office',
      authorRole: 'principal',
      priority: 'normal',
    };
    await setDoc(doc(noticesCol, notice.id), cleanData(notice));
  },

  /**
   * Subscribe to real-time updates for the notices collection.
   * Fires immediately with current data, then again on every change.
   * @returns Unsubscribe function — call it on component unmount.
   */
  subscribeToNotices(
    callback: (notices: Notice[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    return onSnapshot(
      noticesCol,
      async (snap) => {
        if (snap.empty) {
          try {
            const batch = writeBatch(db);
            for (const n of defaultNotices) {
              batch.set(doc(noticesCol, n.id), cleanData(n));
            }
            await batch.commit();
          } catch (e) {
            console.warn('Failed to seed default notices on snapshot:', e);
          }
          callback(defaultNotices);
          return;
        }
        const notices: Notice[] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        notices.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        callback(notices);
      },
      (err) => {
        console.error('[EduNexus] subscribeToNotices error:', err);
        onError?.(err);
      }
    );
  },

  /**
   * Subscribe to real-time updates for the attendance collection.
   * Fires immediately with current data, then again on every change.
   * @returns Unsubscribe function — call it on component unmount.
   */
  subscribeToAttendance(
    callback: (records: AttendanceRecord[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    return onSnapshot(
      attendanceCol,
      (snap) => {
        const records = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        callback(records);
      },
      (err) => {
        console.error('[EduNexus] subscribeToAttendance error:', err);
        onError?.(err);
      }
    );
  },

  /**
   * Subscribe to real-time parent notifications for a specific student.
   * Fires immediately with current data, then again on every change.
   * @returns Unsubscribe function — call it on component unmount.
   */
  subscribeToParentNotifications(
    studentId: string,
    callback: (notifications: ParentNotification[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    const q = query(
      parentNotificationsCol,
      where('studentId', '==', studentId),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        callback(list);
      },
      (err) => {
        console.error('[EduNexus] subscribeToParentNotifications error:', err);
        onError?.(err);
      }
    );
  },

  // ─── Proxy Assignment Services ────────────────────────────────────────────

  async getProxyAssignments(date?: string): Promise<ProxyAssignment[]> {
    const q = date
      ? query(proxyAssignmentsCol, where('date', '==', date))
      : query(proxyAssignmentsCol);
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    return list.sort((a, b) => a.period - b.period);
  },

  async createProxyAssignment(assignment: ProxyAssignment): Promise<void> {
    await setDoc(doc(proxyAssignmentsCol, assignment.id), cleanData(assignment));

    // Push notice to substitute teacher
    const notice: Notice = {
      id: `notice_proxy_${assignment.id}_${Date.now()}`,
      title: `⚡ Proxy Duty Assigned: Period ${assignment.period} (${assignment.classRoom})`,
      body: `You have been assigned as Smart Substitute for ${assignment.originalTeacherName} in Class ${assignment.classRoom} (Period ${assignment.period}, Subject: ${assignment.originalSubject}) on ${assignment.date}.${assignment.lessonPlanNotes ? `\n\n📝 Lesson Plan / Notes: ${assignment.lessonPlanNotes}` : ''}`,
      date: new Date().toISOString(),
      category: 'Substitute Assignment',
      targetRole: 'teacher',
      authorName: assignment.assignedBy || 'Principal Office',
      authorRole: 'principal',
      priority: 'urgent',
    };
    await setDoc(doc(noticesCol, notice.id), cleanData(notice));
  },

  async batchCreateProxyAssignments(assignments: ProxyAssignment[]): Promise<void> {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();

    for (const assignment of assignments) {
      const docRef = doc(proxyAssignmentsCol, assignment.id);
      batch.set(docRef, cleanData(assignment));

      // Create Notice
      const noticeId = `notice_proxy_${assignment.id}_${Date.now()}`;
      const noticeDocRef = doc(noticesCol, noticeId);
      const notice: Notice = {
        id: noticeId,
        title: `⚡ Proxy Duty Assigned: Period ${assignment.period} (${assignment.classRoom})`,
        body: `You have been assigned as Smart Substitute for ${assignment.originalTeacherName} in Class ${assignment.classRoom} (Period ${assignment.period}, Subject: ${assignment.originalSubject}) on ${assignment.date}.${assignment.lessonPlanNotes ? `\n\n📝 Lesson Plan / Notes: ${assignment.lessonPlanNotes}` : ''}`,
        date: nowIso,
        category: 'Substitute Assignment',
        targetRole: 'teacher',
        authorName: assignment.assignedBy || 'Principal Office',
        authorRole: 'principal',
        priority: 'urgent',
      };
      batch.set(noticeDocRef, cleanData(notice));
    }

    await batch.commit();
  },

  async updateProxyAssignmentStatus(id: string, status: ProxyAssignment['status']): Promise<void> {
    const docRef = doc(proxyAssignmentsCol, id);
    await setDoc(docRef, cleanData({ status }), { merge: true });
  },

  async deleteProxyAssignment(id: string): Promise<void> {
    await deleteDoc(doc(proxyAssignmentsCol, id));
  },

  subscribeToProxyAssignments(
    callback: (assignments: ProxyAssignment[]) => void,
    date?: string,
    onError?: (err: Error) => void
  ): Unsubscribe {
    const q = date
      ? query(proxyAssignmentsCol, where('date', '==', date))
      : query(proxyAssignmentsCol);

    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        callback(list.sort((a, b) => a.period - b.period));
      },
      (err) => {
        console.error('[EduNexus] subscribeToProxyAssignments error:', err);
        onError?.(err);
      }
    );
  },

  generateProxyShareMessage(assignment: ProxyAssignment, teacherPhone?: string) {
    const cleanPhone = (teacherPhone || '').replace(/[^0-9+]/g, '');
    const text = `🚨 *EDUNEXUS SMART SUBSTITUTE ALERT* 🚨\n\nDear *${assignment.substituteTeacherName}*,\n\nYou have been assigned as *Proxy Teacher* today (${assignment.date}).\n\n📌 *Details*:\n• *Class*: ${assignment.classRoom}\n• *Period*: Period ${assignment.period}\n• *Subject*: ${assignment.originalSubject}\n• *Covering For*: ${assignment.originalTeacherName}\n• *Match Score*: ${assignment.matchScore}% (${assignment.matchReason})\n${assignment.lessonPlanNotes ? `\n📝 *Lesson Instructions*:\n"${assignment.lessonPlanNotes}"\n` : ''}\nPlease arrive at classroom ${assignment.classRoom} on time.\n\n— EduNexus Automated Substitute Dispatcher`;

    const encoded = encodeURIComponent(text);
    const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone.replace('+', '')}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    const smsUrl = cleanPhone ? `sms:${cleanPhone}?body=${encoded}` : `sms:?body=${encoded}`;

    return { messageText: text, whatsappUrl, smsUrl };
  },

  // ─── Zonal Education Admin & School Verification Services ────────────────

  async getZonalSchools(): Promise<GovernmentSchool[]> {
    try {
      const snapshot = await getDocs(schoolsCol);
      if (snapshot.empty) {
        // Seed default Colombo district schools
        const batch = writeBatch(db);
        for (const sch of COLOMBO_GOVT_SCHOOLS) {
          batch.set(doc(schoolsCol, sch.censusCode), sch);
        }
        await batch.commit();
        return COLOMBO_GOVT_SCHOOLS;
      }
      const map: Record<string, GovernmentSchool> = {};
      COLOMBO_GOVT_SCHOOLS.forEach(s => { map[s.censusCode] = { ...s }; });
      snapshot.docs.forEach(d => {
        map[d.id] = { ...map[d.id], ...d.data() };
      });
      return Object.values(map);
    } catch (err) {
      console.warn('Using default COLOMBO_GOVT_SCHOOLS fallback:', err);
      return COLOMBO_GOVT_SCHOOLS;
    }
  },

  async verifyZonalPrincipalKey(censusCode: string, secretKey: string, skipRegisteredCheck = false): Promise<{ valid: boolean; school?: GovernmentSchool; error?: string }> {
    const schools = await this.getZonalSchools();
    const school = schools.find(s => s.censusCode === censusCode);

    if (!school) {
      return { valid: false, error: 'School Census Code not found in Colombo District Registry.' };
    }

    if (!skipRegisteredCheck && school.isRegistered && school.principalId) {
      return { valid: false, error: `A principal (${school.principalName || 'Registered User'}) has already been verified for ${school.name}.` };
    }

    if (school.zonalSecretKey.trim().toUpperCase() !== secretKey.trim().toUpperCase()) {
      return { valid: false, error: 'Invalid Zonal Master Security Key provided. Please contact Homagama / Colombo Zonal Education Office.' };
    }

    return { valid: true, school };
  },

  async resetPrincipalPassword(
    censusCode: string,
    zonalSecretKey: string,
    newPassword: string
  ): Promise<{ success: boolean; username: string; name: string; schoolName: string }> {
    if (!censusCode || !zonalSecretKey.trim() || !newPassword) {
      throw new Error('School Census Code, Zonal Master Security Key, and New Password are required.');
    }
    if (newPassword.length < 6) {
      throw new Error('New Password must be at least 6 characters long.');
    }

    const schools = await this.getZonalSchools();
    const school = schools.find(s => s.censusCode === censusCode);

    if (!school) {
      throw new Error('School Census Code not found in district registry.');
    }

    if (school.zonalSecretKey.trim().toUpperCase() !== zonalSecretKey.trim().toUpperCase()) {
      throw new Error('Invalid Zonal Master Security Key for this school. Verification failed.');
    }

    const q = query(
      usersCol,
      where('schoolCensusCode', '==', censusCode),
      where('role', '==', 'principal'),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error(`No registered Principal account was found for ${school.name}. Please contact Zonal Education Office.`);
    }

    const principalDoc = snapshot.docs[0];
    const principalUser = principalDoc.data();

    await setDoc(doc(usersCol, principalUser.id), cleanData({ password: newPassword }), { merge: true });

    return {
      success: true,
      username: principalUser.username,
      name: principalUser.name,
      schoolName: school.name,
    };
  },

  async updateSchoolZonalKey(censusCode: string, newKey: string): Promise<void> {
    const schoolDocRef = doc(schoolsCol, censusCode);
    await setDoc(schoolDocRef, cleanData({ zonalSecretKey: newKey.trim().toUpperCase() }), { merge: true });
  },

  async dispatchZonalKey(censusCode: string, principalEmail: string, principalPhone?: string): Promise<{ success: boolean; inviteUrl: string; dispatchedAt: string }> {
    const schools = await this.getZonalSchools();
    const school = schools.find(s => s.censusCode === censusCode);
    if (!school) throw new Error('School not found in district registry.');

    const dispatchedAt = new Date().toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    const schoolDocRef = doc(schoolsCol, censusCode);
    await setDoc(schoolDocRef, cleanData({
      principalEmail: principalEmail.trim(),
      principalPhone: principalPhone ? principalPhone.trim() : undefined,
      dispatchStatus: 'dispatched',
      dispatchedAt,
    }), { merge: true });

    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const inviteUrl = `${origin}/signup?censusCode=${encodeURIComponent(censusCode)}&key=${encodeURIComponent(school.zonalSecretKey)}&email=${encodeURIComponent(principalEmail.trim())}&invite=true`;

    return {
      success: true,
      inviteUrl,
      dispatchedAt,
    };
  },

  async registerSchoolPrincipal(censusCode: string, principalUser: User): Promise<void> {
    const schoolDocRef = doc(schoolsCol, censusCode);
    await setDoc(schoolDocRef, cleanData({
      principalId: principalUser.id,
      principalName: principalUser.name,
      isRegistered: true,
    }), { merge: true });
  },

  async requestZonalMasterKey(req: Omit<ZonalKeyRequest, 'id' | 'requestedAt' | 'status'>): Promise<ZonalKeyRequest> {
    const requestedAt = new Date().toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
    const keyReq: ZonalKeyRequest = {
      id: `key_req_${Date.now()}`,
      principalName: req.principalName || '',
      principalEmail: req.principalEmail || '',
      principalPhone: req.principalPhone || '',
      sleasNumber: req.sleasNumber || '',
      nicNumber: req.nicNumber || '',
      censusCode: req.censusCode || '',
      schoolName: req.schoolName || '',
      requestedAt,
      status: 'pending',
      ...(req.nicFrontImage ? { nicFrontImage: req.nicFrontImage } : {}),
      ...(req.nicBackImage ? { nicBackImage: req.nicBackImage } : {}),
    };

    // 1. Write to Firestore key_requests collection
    let firestoreError: Error | null = null;
    try {
      await setDoc(doc(keyRequestsCol, keyReq.id), cleanData(keyReq));
    } catch (err) {
      console.error('[EduNexus] Error saving key request to Firestore:', err);
      firestoreError = err instanceof Error ? err : new Error(String(err));
    }

    // 2. Broadcast an official system Notice targeted to zonal_admin
    const notice: Notice = {
      id: `notice_key_req_${Date.now()}`,
      title: `🔑 [KEY REQUEST] ${keyReq.principalName} requested Zonal Key for ${keyReq.schoolName}`,
      body: `Principal: ${keyReq.principalName}\nSchool: ${keyReq.schoolName} (${keyReq.censusCode})\nEmail: ${keyReq.principalEmail}\nPhone: ${keyReq.principalPhone}\nSLEAS ID: ${keyReq.sleasNumber}\nNIC: ${keyReq.nicNumber}\n\nPlease review and approve key dispatch in the Zonal Command Center.`,
      date: new Date().toISOString(),
      category: 'Zonal Request',
      targetRole: 'zonal_admin',
      authorName: keyReq.principalName,
      authorRole: 'principal',
      priority: 'urgent',
    };

    try {
      await setDoc(doc(noticesCol, notice.id), cleanData(notice));
    } catch (err) {
      console.error('[EduNexus] Error saving key request notice to Firestore:', err);
    }

    // 3. Local fallback caching
    try {
      const existing = JSON.parse(localStorage.getItem('edunexus_key_requests') || localStorage.getItem('sams_key_requests') || '[]') as ZonalKeyRequest[];
      existing.unshift(keyReq);
      localStorage.setItem('edunexus_key_requests', JSON.stringify(existing));

      const existingNotices = JSON.parse(localStorage.getItem('edunexus_notices') || localStorage.getItem('sams_notices') || '[]') as Notice[];
      existingNotices.unshift(notice);
      localStorage.setItem('edunexus_notices', JSON.stringify(existingNotices));
    } catch (e) {
      console.warn('[EduNexus] LocalStorage cache write failed:', e);
    }

    if (firestoreError) {
      const msg = firestoreError.message.toLowerCase();
      if (msg.includes('permission') || msg.includes('insufficient')) {
        throw new Error(
          'Firebase permission denied. Please update Firestore security rules in Firebase Console to allow read/write.'
        );
      }
      throw firestoreError;
    }

    return keyReq;
  },

  async getZonalKeyRequests(): Promise<ZonalKeyRequest[]> {
    const local: ZonalKeyRequest[] = JSON.parse(localStorage.getItem('edunexus_key_requests') || localStorage.getItem('sams_key_requests') || '[]');

    try {
      const snap = await getDocs(keyRequestsCol);
      const remote = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      // Merge: prefer remote (Firestore is authoritative), deduplicate by id
      const merged = [...remote];
      for (const localReq of local) {
        if (!merged.find(r => r.id === localReq.id)) {
          merged.push(localReq);
        }
      }
      return merged.sort((a, b) => b.id.localeCompare(a.id));
    } catch (err) {
      console.error('[EduNexus] Error fetching key requests from Firestore:', err);
      return local;
    }
  },

  /**
   * Subscribe to real-time updates for Zonal Key Requests.
   */
  subscribeToZonalKeyRequests(
    callback: (requests: ZonalKeyRequest[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    return onSnapshot(
      keyRequestsCol,
      (snap) => {
        const local: ZonalKeyRequest[] = JSON.parse(localStorage.getItem('edunexus_key_requests') || localStorage.getItem('sams_key_requests') || '[]');
        const remote = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        const merged = [...remote];
        for (const localReq of local) {
          if (!merged.find(r => r.id === localReq.id)) {
            merged.push(localReq);
          }
        }
        callback(merged.sort((a, b) => b.id.localeCompare(a.id)));
      },
      (err) => {
        console.error('[EduNexus] subscribeToZonalKeyRequests error:', err);
        onError?.(err);
      }
    );
  },

  async updateZonalKeyRequestStatus(id: string, status: 'approved' | 'rejected'): Promise<void> {
    try {
      await setDoc(doc(keyRequestsCol, id), cleanData({ status }), { merge: true });
    } catch (err) {
      console.error('[EduNexus] Error updating key request in Firestore:', err);
    }

    try {
      const existing: ZonalKeyRequest[] = JSON.parse(localStorage.getItem('edunexus_key_requests') || localStorage.getItem('sams_key_requests') || '[]');
      const updated = existing.map(r => r.id === id ? { ...r, status } : r);
      localStorage.setItem('edunexus_key_requests', JSON.stringify(updated));
    } catch { /* ignore */ }
  },

  async deleteZonalKeyRequest(id: string): Promise<void> {
    try {
      await deleteDoc(doc(keyRequestsCol, id));
    } catch (err) {
      console.error('[EduNexus] Error deleting key request in Firestore:', err);
    }

    try {
      const existing: ZonalKeyRequest[] = JSON.parse(localStorage.getItem('edunexus_key_requests') || localStorage.getItem('sams_key_requests') || '[]');
      localStorage.setItem('edunexus_key_requests', JSON.stringify(existing.filter(r => r.id !== id)));
    } catch { /* ignore */ }
  },

  /**
   * Sends a real SMS via the Firebase Cloud Function `sendSms`,
   * which calls the Twilio REST API server-side.
   * Returns { success: boolean; sid?: string; error?: string }
   */
  async sendParentSms(toPhone: string, messageText: string): Promise<{ success: boolean; sid?: string; error?: string }> {
    try {
      const sendSms = httpsCallable<
        { to: string; body: string },
        { success: boolean; sid: string }
      >(functions, 'sendSms');
      const result = await sendSms({ to: toPhone, body: messageText });
      return { success: true, sid: result.data.sid };
    } catch (err: any) {
      console.error('[EduNexus] sendParentSms error:', err);
      return { success: false, error: err?.message || 'SMS delivery failed.' };
    }
  },

  // ─── Offline Queue Replay ─────────────────────────────────────────────────

  /**
   * Drains the offline queue and re-submits all pending operations to Firestore.
   * Called automatically by `useNetworkStatus` the moment the device comes back online.
   *
   * Any operation that fails again (e.g., transient error) is re-enqueued so it
   * won't be silently lost. Operations that succeed are consumed permanently.
   *
   * Returns a summary of results.
   */
  async replayOfflineQueue(): Promise<{ replayed: number; failed: number }> {
    if (!navigator.onLine) {
      console.info('[OfflineQueue] Replay skipped — still offline.');
      return { replayed: 0, failed: 0 };
    }

    const pending = dequeueAll();
    if (pending.length === 0) return { replayed: 0, failed: 0 };

    console.info(`[OfflineQueue] Replaying ${pending.length} queued operation(s)…`);

    let replayed = 0;
    let failed = 0;

    for (const op of pending) {
      try {
        await this._executeQueuedOp(op);
        replayed++;
        console.info(`[OfflineQueue] ✅ Replayed: ${op.payload.type} (id=${op.id})`);
      } catch (err) {
        failed++;
        console.warn(`[OfflineQueue] ❌ Replay failed for ${op.payload.type} (id=${op.id}):`, err);
        // Re-enqueue failed ops so they are not lost
        requeueOperation(op);
      }
    }

    console.info(`[OfflineQueue] Replay complete — ${replayed} succeeded, ${failed} re-queued.`);
    return { replayed, failed };
  },

  /**
   * Execute a single queued operation against Firestore.
   * This is a private helper used only by `replayOfflineQueue`.
   */
  async _executeQueuedOp(op: QueuedOperation): Promise<void> {
    const { payload } = op;

    switch (payload.type) {
      case 'saveAttendance': {
        // Temporarily bypass the offline guard for replay
        const batch = writeBatch(db);
        const nowIso = new Date().toISOString();
        for (const record of payload.records) {
          let attDocRef;
          if (record.id) {
            attDocRef = doc(attendanceCol, record.id);
            batch.set(attDocRef, cleanData(record), { merge: true });
          } else {
            attDocRef = doc(collection(db, 'attendance'));
            batch.set(attDocRef, cleanData({ ...record, id: attDocRef.id }));
          }
          // Rebuild and queue parent notification
          const stu = payload.studentMap[record.studentId];
          const studentName = stu ? stu.name : record.studentId;
          const statusTitle = record.status.toUpperCase();
          const parentPhone = stu ? stu.parentContact : '';
          const priorityVal: 'normal' | 'high' | 'urgent' =
            record.status === 'absent' ? 'urgent' : record.status === 'late' ? 'high' : 'normal';
          const msgMap: Record<string, string> = {
            present: `${studentName} was marked PRESENT for school on ${record.date}.`,
            absent: `🚨 URGENT NOTICE: ${studentName} (Class: ${stu?.classRoom || ''}) was marked ABSENT from school on ${record.date}.`,
            late: `⚠️ ATTENDANCE ALERT: ${studentName} arrived LATE to school on ${record.date}. Recorded by ${payload.teacherName || 'Class Teacher'}.`,
            excused: `${studentName} attendance was marked EXCUSED on ${record.date}.`,
          };
          const notifId = `pnotif_${record.studentId}_${record.date.replace(/-/g, '')}_replay_${Date.now()}`;
          const notifDocRef = doc(parentNotificationsCol, notifId);
          const parentNotif: ParentNotification = {
            id: notifId,
            studentId: record.studentId,
            studentName,
            date: record.date,
            status: record.status,
            title: record.status === 'absent' ? `🚨 ABSENT ALERT: ${studentName}` : record.status === 'late' ? `⚠️ LATE ARRIVAL: ${studentName}` : `Attendance Update: ${statusTitle}`,
            message: msgMap[record.status] || `${studentName} was marked ${statusTitle} on ${record.date}.`,
            timestamp: nowIso,
            read: false,
            teacherName: payload.teacherName || 'Class Teacher',
            type: 'attendance',
            priority: priorityVal,
            parentContact: parentPhone,
            actionRequired: record.status === 'absent' || record.status === 'late',
          };
          batch.set(notifDocRef, parentNotif);
        }
        await batch.commit();
        break;
      }

      case 'saveTermMarks': {
        const batch = writeBatch(db);
        for (const m of payload.marks) {
          const cleanSub = m.subject.replace(/[^a-zA-Z0-9]/g, '_');
          const docId = `${m.studentId}_${cleanSub}_${m.term}`;
          const docRef = doc(termMarksCol, docId);
          batch.set(docRef, cleanData(m), { merge: true });
        }
        await batch.commit();
        break;
      }

      case 'insertLeaveRequest': {
        await setDoc(doc(leaveRequestsCol, payload.request.id), cleanData(payload.request));
        const isPrincipal = payload.request.applicantRole === 'principal';
        const notice: Notice = {
          id: `notice_leave_${payload.request.id}`,
          title: isPrincipal
            ? `🏛️ Principal Leave Request: ${payload.request.teacherName}`
            : `Leave Request: ${payload.request.teacherName}`,
          body: `${payload.request.teacherName} has submitted a ${payload.request.type.toUpperCase()} leave request from ${payload.request.startDate} to ${payload.request.endDate}.\nReason: ${payload.request.reason}`,
          date: new Date().toISOString(),
          category: 'Leave Request',
          targetRole: isPrincipal ? 'zonal_admin' : 'principal',
          authorName: payload.request.teacherName,
          authorRole: isPrincipal ? 'principal' : 'teacher',
          priority: 'urgent',
          schoolCensusCode: payload.request.schoolCensusCode,
          schoolName: payload.request.schoolName,
        };
        await setDoc(doc(noticesCol, notice.id), cleanData(notice));
        break;
      }

      case 'updateLeaveRequest': {
        await setDoc(doc(leaveRequestsCol, payload.request.id), cleanData(payload.request), { merge: true });
        break;
      }

      default: {
        console.warn('[OfflineQueue] Unknown operation type, skipping.');
      }
    }
  },

  /** Returns the number of operations currently in the offline queue. */
  getOfflineQueueLength(): number {
    return getQueueLength();
  },
};
