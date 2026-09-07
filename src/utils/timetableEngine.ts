import type {
  TimetableSlot,
  SchoolClass,
  Teacher,
} from '../data/models';
import {
  SL_BELL_SCHEDULE,
  SL_PERIOD_NUMBERS,
  SL_OL_8_SUBJECTS,
  AL_STREAMS,
} from '../data/models';

export interface SubjectTeacherMapping {
  subjectId: string;
  subjectName: string;
  teacherId?: string;
  teacherName: string;
  category: string;
  weeklyPeriods: number;
}

/**
 * Maps school teachers to subjects for a specific class.
 * Tries to find matching subject teachers, then homeroom teacher, then general staff.
 */
export function buildSubjectTeacherMappings(
  schoolClass: SchoolClass,
  allTeachers: Teacher[]
): SubjectTeacherMapping[] {
  const isAL = schoolClass.stream === 'al';

  if (!isAL) {
    // 8 Core O/L Subjects
    return SL_OL_8_SUBJECTS.map((sub) => {
      // Find teacher whose subject matches or relates
      const matchedTeacher = allTeachers.find((t) => {
        const tSub = (t.subject || '').toLowerCase();
        if (sub.id === 'mathematics' && (tSub.includes('math') || tSub.includes('ගණිත'))) return true;
        if (sub.id === 'science' && (tSub.includes('scien') || tSub.includes('විද්‍යා'))) return true;
        if (sub.id === 'first_language' && (tSub.includes('sinhal') || tSub.includes('tamil') || tSub.includes('භාෂා'))) return true;
        if (sub.id === 'english_language' && (tSub.includes('eng') || tSub.includes('ඉංග්‍රීසි'))) return true;
        if (sub.id === 'religion' && (tSub.includes('relig') || tSub.includes('buddh') || tSub.includes('ආගම'))) return true;
        if (sub.id === 'history' && (tSub.includes('hist') || tSub.includes('ඉතිහාස'))) return true;
        if (sub.id === 'practical_studies' && (tSub.includes('ict') || tSub.includes('comm') || tSub.includes('agri') || tSub.includes('ව්‍යවහාරික'))) return true;
        if (sub.id === 'aesthetic_health' && (tSub.includes('art') || tSub.includes('music') || tSub.includes('pe') || tSub.includes('health') || tSub.includes('සෞන්දර්ය'))) return true;
        return false;
      });

      const fallbackTeacher = matchedTeacher?.name || schoolClass.homeroomTeacherName || (allTeachers.length > 0 ? allTeachers[0].name : 'Assigned Teacher');
      const fallbackId = matchedTeacher?.id || schoolClass.homeroomTeacherId || (allTeachers.length > 0 ? allTeachers[0].id : undefined);

      return {
        subjectId: sub.id,
        subjectName: sub.nameEn,
        teacherId: fallbackId || undefined,
        teacherName: fallbackTeacher,
        category: sub.category,
        weeklyPeriods: sub.weeklyPeriods,
      };
    });
  } else {
    // A/L Stream Curriculum
    const streamInfo = AL_STREAMS[0]; // fallback
    const subjects = [
      { id: 'al_sub_1', name: streamInfo.subjects[0] || 'Main Stream Subject 1', periods: 9, cat: 'core' },
      { id: 'al_sub_2', name: streamInfo.subjects[1] || 'Main Stream Subject 2', periods: 9, cat: 'core' },
      { id: 'al_sub_3', name: streamInfo.subjects[2] || 'Main Stream Subject 3', periods: 9, cat: 'core' },
      { id: 'al_english', name: 'General English', periods: 5, cat: 'language' },
      { id: 'al_git', name: 'Common General Test / GIT', periods: 4, cat: 'practical' },
      { id: 'al_practical', name: 'Practical Lab / Library', periods: 4, cat: 'aesthetic' },
    ];

    return subjects.map((s, idx) => {
      const assignedT = allTeachers[idx % Math.max(1, allTeachers.length)];
      return {
        subjectId: s.id,
        subjectName: s.name,
        teacherId: assignedT?.id,
        teacherName: assignedT?.name || schoolClass.homeroomTeacherName || 'Subject Specialist',
        category: s.cat,
        weeklyPeriods: s.periods,
      };
    });
  }
}

/**
 * Generates a full weekly timetable (5 days x 8 periods = 40 periods) for a single class.
 * Respects Sri Lankan bell schedule (8:00 AM - 1:30 PM with Interval after Period 4).
 * Optionally checks busy teacher slots to prevent clashes.
 */
export function generateClassTimetable(params: {
  schoolClass: SchoolClass;
  academicYear: number;
  mappings: SubjectTeacherMapping[];
  existingSchoolSlots?: TimetableSlot[];
}): TimetableSlot[] {
  const { schoolClass, academicYear, mappings, existingSchoolSlots = [] } = params;

  // Build a pool of 40 periods matching subject weekly weights
  const subjectPool: SubjectTeacherMapping[] = [];
  mappings.forEach((m) => {
    for (let i = 0; i < m.weeklyPeriods; i++) {
      subjectPool.push(m);
    }
  });

  // Ensure pool has exactly 40 periods (5 days * 8 periods)
  while (subjectPool.length < 40) {
    subjectPool.push(mappings[0]);
  }
  if (subjectPool.length > 40) {
    subjectPool.length = 40;
  }

  // Define period bell timing lookup
  const bellTimeMap: Record<number, { start: string; end: string }> = {};
  SL_BELL_SCHEDULE.forEach((b) => {
    if (!b.isInterval) {
      bellTimeMap[b.period] = { start: b.startTime, end: b.endTime };
    }
  });

  const slots: TimetableSlot[] = [];

  // Track daily counts per subject to prevent exceeding 2 periods/day
  // and track teacher busy matrix from existing school slots
  const busyTeacherSlots = new Set<string>();
  existingSchoolSlots.forEach((s) => {
    if (s.teacher) {
      busyTeacherSlots.add(`${s.teacher.toLowerCase()}_${s.dayOfWeek}_${s.period}`);
    }
  });

  // Priority layout for Sri Lankan schools:
  // Days 1 to 5 (Mon to Fri)
  // Periods 1 to 8
  // Morning (Periods 1 - 4): Core Mathematics, Science, First Language, English
  // Afternoon (Periods 5 - 8): Aesthetics, PE, Practical Studies, History, Religion, Revision

  const morningPool = subjectPool.filter((s) => s.category === 'core' || s.category === 'language');
  const afternoonPool = subjectPool.filter((s) => s.category !== 'core' && s.category !== 'language');

  function pickSubject(
    day: number,
    period: number,
    preferMorning: boolean,
    daySubjectCount: Record<string, number>
  ): SubjectTeacherMapping | null {
    const primaryPool = preferMorning ? morningPool : afternoonPool;
    const secondaryPool = preferMorning ? afternoonPool : morningPool;

    for (let i = 0; i < primaryPool.length; i++) {
      const candidate = primaryPool[i];
      const countToday = daySubjectCount[candidate.subjectId] || 0;
      if (countToday >= 2) continue;

      const teacherKey = `${candidate.teacherName.toLowerCase()}_${day}_${period}`;
      if (busyTeacherSlots.has(teacherKey)) continue;

      daySubjectCount[candidate.subjectId] = countToday + 1;
      primaryPool.splice(i, 1);
      return candidate;
    }

    for (let i = 0; i < secondaryPool.length; i++) {
      const candidate = secondaryPool[i];
      const countToday = daySubjectCount[candidate.subjectId] || 0;
      if (countToday >= 2) continue;

      const teacherKey = `${candidate.teacherName.toLowerCase()}_${day}_${period}`;
      if (busyTeacherSlots.has(teacherKey)) continue;

      daySubjectCount[candidate.subjectId] = countToday + 1;
      secondaryPool.splice(i, 1);
      return candidate;
    }

    const remaining = primaryPool.length > 0 ? primaryPool : secondaryPool;
    if (remaining.length > 0) {
      return remaining.shift() || null;
    }
    return mappings[0] || null;
  }

  for (let day = 1; day <= 5; day++) {
    const daySubjectCount: Record<string, number> = {};

    for (const period of SL_PERIOD_NUMBERS) {
      const isMorning = period <= 4;
      const chosen = pickSubject(day, period, isMorning, daySubjectCount);

      if (chosen) {
        const time = bellTimeMap[period] || { start: '08:00 AM', end: '08:40 AM' };
        const slot: TimetableSlot = {
          classRoom: schoolClass.id,
          dayOfWeek: day,
          period,
          subject: chosen.subjectName,
          teacher: chosen.teacherName,
          teacherId: chosen.teacherId,
          academicYear,
          startTime: time.start,
          endTime: time.end,
        };
        slots.push(slot);

        busyTeacherSlots.add(`${chosen.teacherName.toLowerCase()}_${day}_${period}`);
      }
    }
  }

  return slots;
}

/**
 * Batch generates timetable for all school classes with cross-class teacher conflict avoidance.
 */
export function generateSchoolTimetables(params: {
  classes: SchoolClass[];
  teachers: Teacher[];
  academicYear: number;
}): TimetableSlot[] {
  const { classes, teachers, academicYear } = params;
  const allSlots: TimetableSlot[] = [];

  for (const cls of classes) {
    const mappings = buildSubjectTeacherMappings(cls, teachers);
    const classSlots = generateClassTimetable({
      schoolClass: cls,
      academicYear,
      mappings,
      existingSchoolSlots: allSlots,
    });
    allSlots.push(...classSlots);
  }

  return allSlots;
}

/**
 * Generates an official Sri Lankan MoE formatted WhatsApp schedule text.
 */
export function formatTimetableWhatsAppMessage(params: {
  schoolName: string;
  censusCode?: string;
  className: string;
  academicYear: number;
  slots: TimetableSlot[];
}): string {
  const { schoolName, censusCode, className, academicYear, slots } = params;

  const dayNames: Record<number, string> = {
    1: 'Monday (සඳුදා / திங்கள்)',
    2: 'Tuesday (අඟහරුවාදා / செவ்வாய்)',
    3: 'Wednesday (බදාදා / புதன்)',
    4: 'Thursday (බ්‍රහස්පතින්දා / வியாழன்)',
    5: 'Friday (සිකුරාදා / வெள்ளி)',
  };

  let message = `🏛️ *${schoolName.toUpperCase()}*\n`;
  if (censusCode) message += `*MoE Census Code*: ${censusCode}\n`;
  message += `📅 *Official Academic Timetable — Year ${academicYear}*\n`;
  message += `🏫 *Class*: ${className}\n`;
  message += `⏰ *School Hours*: 08:00 AM – 01:30 PM (8 Periods)\n`;
  message += `🥪 *Interval*: 10:40 AM – 11:00 AM (After Period 4)\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (let day = 1; day <= 5; day++) {
    message += `📌 *${dayNames[day]}*\n`;
    const daySlots = slots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.period - b.period);

    daySlots.forEach((s) => {
      if (s.period === 5) {
        message += `  ☕ *10:40 AM - 11:00 AM: INTERVAL / RECESS*\n`;
      }
      const timeStr = s.startTime && s.endTime ? `(${s.startTime} - ${s.endTime})` : `P${s.period}`;
      message += `  • Period ${s.period} ${timeStr}: *${s.subject}* (${s.teacher})\n`;
    });
    message += `\n`;
  }

  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📢 *Ministry of Education Circular Compliance*\n`;
  message += `Issued by Office of the Principal, ${schoolName}.\n`;
  message += `_EduNexus Smart Academic Management System_`;

  return message;
}

/**
 * Generates CSV content for export.
 */
export function generateTimetableCsv(slots: TimetableSlot[], className: string): string {
  const headers = ['Academic Year', 'Class', 'Day of Week', 'Period', 'Start Time', 'End Time', 'Subject', 'Teacher'];
  const dayLabels: Record<number, string> = {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
  };

  const rows = slots.map((s) => [
    s.academicYear || new Date().getFullYear(),
    className || s.classRoom,
    dayLabels[s.dayOfWeek] || `Day ${s.dayOfWeek}`,
    s.period,
    s.startTime || '',
    s.endTime || '',
    `"${s.subject}"`,
    `"${s.teacher}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
