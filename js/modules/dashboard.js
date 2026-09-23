/**
 * Dashboard Overview Module (Command Center)
 * Centralizes:
 * 1. Next Class Real-time Countdown
 * 2. Nearest Exam Alert & Countdown
 * 3. Deadlines & Tasks with Quick Complete & Undo
 * 4. Academic Progress per Subject
 * 5. Focus Time Summary (Pomodoro)
 * 6. GPA & Academic Achievements
 * 7. Today's Class Schedule
 * 8. Quick Navigation Shortcuts & Schedule Notifications
 */

import { getAll, getById, saveItem, getSetting } from '../db.js';
import {
  getCurrentVnDay,
  getDayNameVietnamese,
  getDayShortVietnamese,
  formatDateVietnamese,
  formatTimeHM,
  timeToMinutes,
  getColorById,
  escapeHtml
} from '../utils/helpers.js';
import { openScheduleFormModal } from './schedule.js';
import { openTaskFormModal } from './tasks.js';
import { openSubjectDetailModal } from './subjects.js';
import { calculateSubjectFinal, convertScoreToGrade } from './grades.js';
import { isNotificationEnabled, toggleNotifications } from './notification.js';
import { showToast } from '../components/toast.js';

let countdownTimer = null;
let activeNavigateFn = null;
let activeDeadlineTab = 'today'; // 'today' | 'tomorrow' | 'week' | 'overdue'

export async function initDashboardModule(onNavigate) {
  activeNavigateFn = onNavigate;
  await renderDashboard(onNavigate);
}

export async function renderDashboard(onNavigate) {
  if (onNavigate) activeNavigateFn = onNavigate;
  const container = document.getElementById('dashboard-view');
  if (!container) return;

  // 1. Fetch all required entities from IndexedDB
  const [
    schedules,
    subjects,
    tasks,
    exams,
    grades,
    studySessions,
    notes,
    mindmaps,
    imageNotes
  ] = await Promise.all([
    getAll('schedules'),
    getAll('subjects'),
    getAll('tasks'),
    getAll('exams'),
    getAll('grades'),
    getAll('studySessions'),
    getAll('notes'),
    getAll('mindmaps'),
    getAll('imageNotes')
  ]);

  const notifActive = await isNotificationEnabled();
  const lastBackupStr = await getSetting('last_backup_timestamp');
  let backupStatusText = 'Chưa sao lưu';
  if (lastBackupStr) {
    const daysAgo = Math.floor((Date.now() - parseInt(lastBackupStr, 10)) / (1000 * 60 * 60 * 24));
    backupStatusText = daysAgo === 0 ? 'Hôm nay' : `${daysAgo} ngày trước`;
  }

  const currentVnDay = getCurrentVnDay();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMinutes = timeToMinutes(formatTimeHM(now));

  // 2. Class calculations
  const todayClasses = schedules
    .filter(s => s.dayOfWeek === currentVnDay)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  let ongoingClass = null;
  let nextClass = null;

  for (const c of todayClasses) {
    const sMin = timeToMinutes(c.startTime);
    const eMin = timeToMinutes(c.endTime);

    if (currentMinutes >= sMin && currentMinutes <= eMin) {
      ongoingClass = c;
      break;
    } else if (currentMinutes < sMin && !nextClass) {
      nextClass = c;
    }
  }

  let nextUpcomingAnyDay = null;
  if (!ongoingClass && !nextClass && schedules.length > 0) {
    for (let offset = 1; offset <= 7; offset++) {
      let targetDay = currentVnDay + offset;
      if (targetDay > 8) targetDay = targetDay - 7;
      const classesOnDay = schedules
        .filter(s => s.dayOfWeek === targetDay)
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

      if (classesOnDay.length > 0) {
        nextUpcomingAnyDay = { classItem: classesOnDay[0], dayOfWeek: targetDay };
        break;
      }
    }
  }

  // 3. Nearest Exam calculation
  const upcomingExams = exams
    .map(e => {
      const eDate = e.examDate || e.date;
      const eTime = e.examTime || e.startTime || '00:00';
      const eRoom = e.room || e.location || '';
      const fullDateStr = `${eDate}T${eTime}`;
      const examTimeMs = new Date(fullDateStr).getTime();
      return { ...e, eDate, eTime, eRoom, examTimeMs };
    })
    .filter(e => e.eDate && (e.eDate >= todayStr || e.examTimeMs >= now.getTime()))
    .sort((a, b) => a.examTimeMs - b.examTimeMs);
  const nearestExam = upcomingExams[0] || null;

  // 4. Focus Time calculations (Today & This Week)
  let todayFocusMinutes = 0;
  let weekFocusMinutes = 0;
  const currentDayOfWeek = now.getDay(); // 0 is Sunday
  const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const mondayDate = new Date(now);
  mondayDate.setDate(now.getDate() + mondayOffset);
  mondayDate.setHours(0, 0, 0, 0);
  const mondayStr = mondayDate.toISOString().split('T')[0];

  studySessions.forEach(s => {
    const sDate = s.date || (s.startedAt ? s.startedAt.split('T')[0] : '');
    const sDur = Number(s.durationMinutes || s.duration) || 0;
    if (sDate === todayStr) {
      todayFocusMinutes += sDur;
    }
    if (sDate >= mondayStr && sDate <= todayStr) {
      weekFocusMinutes += sDur;
    }
  });

  // 5. GPA calculation
  let totalGradePoints = 0;
  let totalGradedCredits = 0;
  let completedSubjectCount = 0;

  subjects.forEach(sub => {
    const subGrade = grades.find(g => g.subjectId === sub.id);
    if (subGrade && subGrade.components && subGrade.components.length > 0) {
      const calc = calculateSubjectFinal(subGrade.components);
      if (calc.isComplete && calc.final10 != null) {
        const gradeConv = convertScoreToGrade(calc.final10);
        if (gradeConv.gpa4 != null) {
          const creds = Number(sub.credits) || 3;
          totalGradePoints += gradeConv.gpa4 * creds;
          totalGradedCredits += creds;
          completedSubjectCount++;
        }
      }
    }
  });

  const semesterGpa = totalGradedCredits > 0 ? (totalGradePoints / totalGradedCredits).toFixed(2) : null;

  // 6. Deadlines tabs filtering
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const in7Days = new Date(now);
  in7Days.setDate(now.getDate() + 7);
  const in7DaysStr = in7Days.toISOString().split('T')[0];

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const todayTasks = tasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) === todayStr);
  const tomorrowTasks = tasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) === tomorrowStr);
  const weekTasks = tasks.filter(t => {
    const dStr = t.dueDate ? t.dueDate.slice(0, 10) : '';
    return dStr > tomorrowStr && dStr <= in7DaysStr;
  });
  const overdueTasks = tasks.filter(t => {
    const dStr = t.dueDate ? t.dueDate.slice(0, 10) : '';
    return dStr && dStr < todayStr && t.status !== 'completed';
  });

  let activeTabTasks = [];
  if (activeDeadlineTab === 'today') activeTabTasks = todayTasks;
  else if (activeDeadlineTab === 'tomorrow') activeTabTasks = tomorrowTasks;
  else if (activeDeadlineTab === 'week') activeTabTasks = weekTasks;
  else if (activeDeadlineTab === 'overdue') activeTabTasks = overdueTasks;

  // Render HTML
  container.innerHTML = `
    <!-- Top Greeting Banner -->
    <div class="mb-6 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-indigo-500/15 relative overflow-hidden">
      <div class="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
      <div class="absolute right-20 -top-10 w-32 h-32 rounded-full bg-purple-400/20 blur-xl pointer-events-none"></div>

      <div class="relative z-10 max-w-2xl">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold mb-3">
          <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
          Command Center Học tập Toàn diện
        </span>
        <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight">
          Hôm nay là ${formatDateVietnamese(now)}
        </h2>
        <p class="text-xs md:text-sm text-indigo-100 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>Lịch học hôm nay: <strong class="text-white underline decoration-amber-400 decoration-2">${todayClasses.length} buổi</strong></span>
          <span>•</span>
          <span>Hạn nộp cần xử lý: <strong class="text-white underline decoration-rose-400 decoration-2">${pendingTasks.length} nhiệm vụ</strong></span>
          ${overdueTasks.length > 0 ? `<span>•</span><span class="text-rose-200 font-bold bg-rose-500/30 px-2 py-0.5 rounded-full text-xs animate-pulse">⚠️ ${overdueTasks.length} nhiệm vụ quá hạn</span>` : ''}
        </p>
      </div>
    </div>

    <!-- Top Highlight Row: Next Class Widget + Nearest Exam Countdown -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
      <!-- 1. Next Class Widget -->
      ${renderNextClassWidget(ongoingClass, nextClass, nextUpcomingAnyDay, currentMinutes)}

      <!-- 2. Nearest Exam Countdown Widget -->
      ${renderNearestExamWidget(nearestExam, subjects, now)}
    </div>

    <!-- Quick Stats Grid (4 items) -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
      <div class="bg-white dark:bg-slate-800 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
        <div class="p-2.5 sm:p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
          <i data-lucide="book-open" class="w-5 h-5"></i>
        </div>
        <div class="min-w-0">
          <div class="text-lg sm:text-xl font-black text-slate-900 dark:text-white">${subjects.length}</div>
          <div class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">Môn học kỳ này</div>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
        <div class="p-2.5 sm:p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex-shrink-0">
          <i data-lucide="check-square" class="w-5 h-5"></i>
        </div>
        <div class="min-w-0">
          <div class="text-lg sm:text-xl font-black text-slate-900 dark:text-white">${pendingTasks.length}</div>
          <div class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">Nhiệm vụ chưa xong</div>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
        <div class="p-2.5 sm:p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex-shrink-0">
          <i data-lucide="award" class="w-5 h-5"></i>
        </div>
        <div class="min-w-0">
          <div class="text-lg sm:text-xl font-black text-slate-900 dark:text-white">${upcomingExams.length}</div>
          <div class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">Kỳ thi sắp tới</div>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
        <div class="p-2.5 sm:p-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex-shrink-0">
          <i data-lucide="timer" class="w-5 h-5"></i>
        </div>
        <div class="min-w-0">
          <div class="text-lg sm:text-xl font-black text-slate-900 dark:text-white">${formatMinutesDisplay(todayFocusMinutes)}</div>
          <div class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">Tập trung hôm nay</div>
        </div>
      </div>
    </div>

    <!-- Main Content Grid (Left 2 cols, Right 1 col) -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- LEFT 2 COLS -->
      <div class="lg:col-span-2 space-y-6">
        <!-- 1. Today's Classes Schedule Preview -->
        <div class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 md:p-6 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <i data-lucide="calendar" class="w-4 h-4 text-indigo-500"></i>
                Lịch học hôm nay
              </h3>
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 font-semibold text-slate-600 dark:text-slate-300">
                ${getDayNameVietnamese(currentVnDay)}
              </span>
            </div>
            <button id="btn-dash-view-schedule" class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer">
              Xem cả tuần
              <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>

          ${todayClasses.length === 0 ? `
            <div class="py-10 text-center">
              <div class="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 dark:bg-slate-700/60 flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-2">
                <i data-lucide="coffee" class="w-6 h-6"></i>
              </div>
              <h4 class="text-sm font-bold text-slate-800 dark:text-slate-200">Không có tiết học nào trong ngày hôm nay!</h4>
              <p class="text-xs text-slate-400 mt-1">Chúc bạn một ngày tự học và hoàn thành các bài tập hiệu quả.</p>
            </div>
          ` : `
            <div class="space-y-2.5">
              ${todayClasses.map(item => {
                const color = getColorById(item.color);
                const startMin = timeToMinutes(item.startTime);
                const endMin = timeToMinutes(item.endTime);
                const isOngoing = currentMinutes >= startMin && currentMinutes <= endMin;

                return `
                  <div class="flex items-center justify-between p-3 rounded-2xl border ${color.bgLight} ${color.darkBg} transition hover:shadow-xs">
                    <div class="flex items-center gap-3">
                      <div class="w-2.5 h-10 rounded-full ${color.badge}"></div>
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="text-xs font-extrabold text-slate-800 dark:text-slate-100">${escapeHtml(item.subjectName)}</span>
                          ${item.subjectCode ? `<span class="text-[10px] font-mono px-1.5 py-0.2 bg-black/5 dark:bg-white/10 rounded font-semibold">${escapeHtml(item.subjectCode)}</span>` : ''}
                          ${isOngoing ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>Đang diễn ra</span>` : ''}
                        </div>
                        <div class="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                          <span class="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                            <i data-lucide="clock" class="w-3.5 h-3.5"></i>
                            ${escapeHtml(item.startTime)} - ${escapeHtml(item.endTime)}
                          </span>
                          <span class="flex items-center gap-1">
                            <i data-lucide="map-pin" class="w-3.5 h-3.5"></i>
                            ${escapeHtml(item.room || 'Phòng chưa cập nhật')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="hidden sm:block text-right text-xs text-slate-500 dark:text-slate-400">
                      <div>${escapeHtml(item.lecturer || '')}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- 2. Deadlines & Tasks Widget (with Tabs & Instant Checkbox) -->
        <div class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 md:p-6 shadow-sm">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div class="flex items-center gap-2">
              <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <i data-lucide="check-square" class="w-4 h-4 text-amber-500"></i>
                Nhiệm vụ & Deadline
              </h3>
            </div>
            <button id="btn-dash-view-all-tasks" class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer">
              Xem tất cả nhiệm vụ
              <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>

          <!-- Deadline Tabs -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
            <button data-tab="today" class="tab-deadline-btn px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${activeDeadlineTab === 'today' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}">
              Hôm nay
              <span class="px-1.5 py-0.2 rounded-full text-[10px] ${activeDeadlineTab === 'today' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200'}">${todayTasks.length}</span>
            </button>
            <button data-tab="tomorrow" class="tab-deadline-btn px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${activeDeadlineTab === 'tomorrow' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}">
              Ngày mai
              <span class="px-1.5 py-0.2 rounded-full text-[10px] ${activeDeadlineTab === 'tomorrow' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200'}">${tomorrowTasks.length}</span>
            </button>
            <button data-tab="week" class="tab-deadline-btn px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${activeDeadlineTab === 'week' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}">
              7 ngày tới
              <span class="px-1.5 py-0.2 rounded-full text-[10px] ${activeDeadlineTab === 'week' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200'}">${weekTasks.length}</span>
            </button>
            <button data-tab="overdue" class="tab-deadline-btn px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${activeDeadlineTab === 'overdue' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}">
              Quá hạn
              <span class="px-1.5 py-0.2 rounded-full text-[10px] ${activeDeadlineTab === 'overdue' ? 'bg-white/20 text-white' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300'}">${overdueTasks.length}</span>
            </button>
          </div>

          <!-- Tasks List in Active Tab -->
          <div id="dash-tasks-container">
            ${renderDeadlineTasksList(activeTabTasks, subjects, todayStr)}
          </div>
        </div>

        <!-- 3. Academic Progress by Subject -->
        <div class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 md:p-6 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <i data-lucide="trending-up" class="w-4 h-4 text-emerald-500"></i>
              Tiến độ học tập theo môn
            </h3>
            <button id="btn-dash-view-all-progress" class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer">
              Xem báo cáo toàn diện
              <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            ${subjects.slice(0, 4).map(sub => {
              const subTasks = tasks.filter(t => t.subjectId === sub.id);
              const doneTasks = subTasks.filter(t => t.status === 'completed');
              const subSessions = studySessions.filter(s => s.subjectId === sub.id);
              const totalFocusMin = subSessions.reduce((acc, s) => acc + (Number(s.durationMinutes) || 0), 0);
              const subSchedules = schedules.filter(s => s.subjectId === sub.id || s.subjectName?.toLowerCase() === sub.name?.toLowerCase());

              // Composite progress calculation
              let score = 0;
              if (subSchedules.length > 0) score += 20;
              if (subTasks.length > 0) score += Math.round((doneTasks.length / subTasks.length) * 50);
              if (totalFocusMin > 0) score += Math.min(30, Math.round(totalFocusMin / 10));
              const progressPct = Math.min(100, score);
              const color = getColorById(sub.color);

              return `
                <div class="dash-subject-card p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30 hover:border-indigo-200 dark:hover:border-indigo-800 transition cursor-pointer" data-subject-id="${sub.id}">
                  <div class="flex items-center justify-between gap-2 mb-2">
                    <span class="text-xs font-mono font-bold px-1.5 py-0.5 rounded ${color.badge}">${escapeHtml(sub.code)}</span>
                    <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400">${progressPct}%</span>
                  </div>
                  <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate mb-2">${escapeHtml(sub.name)}</h4>
                  <div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div class="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500" style="width: ${progressPct}%"></div>
                  </div>
                  <div class="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-medium">
                    <span>${doneTasks.length}/${subTasks.length} bài tập</span>
                    <span>${formatMinutesDisplay(totalFocusMin)} học</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- RIGHT 1 COL -->
      <div class="space-y-6">
        <!-- 1. GPA & Điểm số Widget -->
        <div class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 md:p-6 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <i data-lucide="graduation-cap" class="w-4 h-4 text-indigo-500"></i>
              Điểm số & GPA
            </h3>
            <button id="btn-dash-view-grades" class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
              Bảng điểm
            </button>
          </div>

          ${semesterGpa ? `
            <div class="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900/60 text-center">
              <div class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">GPA Tích lũy Học kỳ</div>
              <div class="text-3xl font-black text-indigo-700 dark:text-indigo-300 font-mono">${semesterGpa} <span class="text-sm font-semibold text-slate-400">/ 4.0</span></div>
              <div class="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                Đã hoàn thành ${completedSubjectCount} môn (${totalGradedCredits} tín chỉ)
              </div>
            </div>
          ` : `
            <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700 text-center">
              <div class="w-10 h-10 mx-auto rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2">
                <i data-lucide="edit-3" class="w-5 h-5"></i>
              </div>
              <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200">Chưa có dữ liệu điểm học phần</h4>
              <p class="text-[11px] text-slate-400 mt-1 mb-3">Nhập các cột điểm chuyên cần, giữa kỳ & thi để tính GPA chuẩn xác.</p>
              <button id="btn-dash-enter-grades" class="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition cursor-pointer">
                Nhập điểm học phần
              </button>
            </div>
          `}
        </div>

        <!-- 2. Focus Time (Thời gian tập trung) -->
        <div class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 md:p-6 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <i data-lucide="target" class="w-4 h-4 text-purple-500"></i>
              Thời gian tập trung
            </h3>
            <span class="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold">
              Pomodoro
            </span>
          </div>

          <div class="grid grid-cols-2 gap-3 mb-3.5">
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700/80">
              <div class="text-[11px] text-slate-400 font-medium">Hôm nay</div>
              <div class="text-lg font-black text-slate-800 dark:text-slate-100 font-mono mt-0.5">${formatMinutesDisplay(todayFocusMinutes)}</div>
            </div>
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700/80">
              <div class="text-[11px] text-slate-400 font-medium">Tuần này</div>
              <div class="text-lg font-black text-slate-800 dark:text-slate-100 font-mono mt-0.5">${formatMinutesDisplay(weekFocusMinutes)}</div>
            </div>
          </div>

          <button id="btn-dash-start-timer" class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 transition cursor-pointer">
            <i data-lucide="play" class="w-4 h-4 fill-current"></i>
            <span>Bắt đầu Pomodoro ngay</span>
          </button>
        </div>

        <!-- 3. Quick Shortcuts -->
        <div class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <i data-lucide="zap" class="w-4 h-4 text-amber-500"></i>
            Thao tác nhanh
          </h3>
          <div class="space-y-2">
            <button id="btn-quick-add-task" class="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition text-xs font-semibold cursor-pointer">
              <span class="flex items-center gap-2.5">
                <i data-lucide="plus-circle" class="w-4 h-4 text-indigo-500"></i>
                Thêm deadline / nhiệm vụ
              </span>
              <i data-lucide="plus" class="w-4 h-4"></i>
            </button>

            <button id="btn-quick-add-class" class="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition text-xs font-semibold cursor-pointer">
              <span class="flex items-center gap-2.5">
                <i data-lucide="calendar-plus" class="w-4 h-4 text-emerald-500"></i>
                Thêm buổi học mới
              </span>
              <i data-lucide="plus" class="w-4 h-4"></i>
            </button>

            <button id="btn-quick-goto-notes" class="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 transition text-xs font-semibold cursor-pointer">
              <span class="flex items-center gap-2.5">
                <i data-lucide="file-plus" class="w-4 h-4 text-sky-500"></i>
                Ghi chú bài học
              </span>
              <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>

            <button id="btn-quick-goto-mindmap" class="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 transition text-xs font-semibold cursor-pointer">
              <span class="flex items-center gap-2.5">
                <i data-lucide="git-merge" class="w-4 h-4 text-amber-500"></i>
                Sơ đồ tư duy (Mindmap)
              </span>
              <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- 4. Schedule Notifications Widget -->
        <div class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <i data-lucide="bell" class="w-4 h-4 text-indigo-500"></i>
              Chuông báo lịch học
            </h3>
            <button id="btn-toggle-notifications" type="button" class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${notifActive ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}" title="Bật/Tắt chuông báo lịch học">
              <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifActive ? 'translate-x-6' : 'translate-x-1'}"></span>
            </button>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Tự động báo chuông âm thanh trước <strong class="text-slate-700 dark:text-slate-200">10-15 phút</strong> trước mỗi tiết học hôm nay.
          </p>
        </div>

        <!-- 5. Data Backup Status -->
        <div class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <i data-lucide="database" class="w-4 h-4 text-emerald-500"></i>
              Sao lưu dữ liệu
            </h3>
            <span class="text-xs text-slate-500 dark:text-slate-400 font-mono">${backupStatusText}</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Định kỳ tải file JSON sao lưu giúp bảo toàn toàn bộ 11 phân hệ học tập của bạn.
          </p>
          <div class="space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <button id="btn-dash-export-backup" type="button" class="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 transition cursor-pointer" title="Xuất file JSON sao lưu">
                <i data-lucide="download" class="w-3.5 h-3.5"></i>
                <span>Tải file</span>
              </button>
              <button id="btn-dash-import-backup" type="button" class="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 transition cursor-pointer" title="Chọn file JSON từ máy tính">
                <i data-lucide="upload" class="w-3.5 h-3.5"></i>
                <span>Chọn file</span>
              </button>
            </div>
            <button id="btn-dash-sync-default" type="button" class="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-bold text-indigo-600 dark:text-indigo-400 transition cursor-pointer" title="Nạp dữ liệu mẫu mới nhất từ máy chủ">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
              <span>Nạp dữ liệu mới nhất</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach events
  setupDashboardEvents(container, onNavigate, tasks, subjects);

  if (window.lucide) {
    window.lucide.createIcons({ root: container });
  }

  // Start countdown ticker for classes
  startCountdownTicker(container, ongoingClass, nextClass);
}

/**
 * Render Next Class Widget (Ongoing or Upcoming)
 */
function renderNextClassWidget(ongoingClass, nextClass, nextUpcomingAnyDay, currentMinutes) {
  if (ongoingClass) {
    const endMin = timeToMinutes(ongoingClass.endTime);
    const remainingMin = Math.max(0, endMin - currentMinutes);

    return `
      <div class="bg-emerald-600 text-white rounded-3xl p-5 md:p-6 shadow-lg shadow-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
            <i data-lucide="radio" class="w-6 h-6 animate-pulse"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full bg-white text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                Đang diễn ra
              </span>
              <span class="text-xs text-emerald-100 font-semibold">
                Còn lại ~${remainingMin} phút
              </span>
            </div>
            <h3 class="text-lg md:text-xl font-black mt-1">${escapeHtml(ongoingClass.subjectName)}</h3>
            <p class="text-xs text-emerald-100 flex items-center gap-3 mt-1">
              <span>Phòng: <strong class="text-white">${escapeHtml(ongoingClass.room || 'Chưa có')}</strong></span>
              <span>•</span>
              <span>GV: <strong class="text-white">${escapeHtml(ongoingClass.lecturer || 'Chưa có')}</strong></span>
            </p>
          </div>
        </div>

        <div class="self-end sm:self-auto text-right">
          <div class="text-xl md:text-2xl font-black font-mono tracking-tight">${escapeHtml(ongoingClass.startTime)} - ${escapeHtml(ongoingClass.endTime)}</div>
          <div class="text-xs text-emerald-100">Khung giờ học</div>
        </div>
      </div>
    `;
  }

  if (nextClass) {
    const startMin = timeToMinutes(nextClass.startTime);
    const diffMinutes = Math.max(0, startMin - currentMinutes);
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    const timeDisplay = hours > 0 ? `${hours} giờ ${mins} phút` : `${mins} phút`;

    return `
      <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 md:p-6 border-2 border-indigo-500/40 dark:border-indigo-500/60 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
            <i data-lucide="alarm-clock" class="w-6 h-6"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                Tiết học tiếp theo
              </span>
              <span class="text-xs font-bold text-amber-600 dark:text-amber-400">
                Sau ${timeDisplay}
              </span>
            </div>
            <h3 class="text-base md:text-lg font-bold text-slate-900 dark:text-white mt-1">${escapeHtml(nextClass.subjectName)}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 mt-1">
              <span>Phòng: <strong class="text-slate-700 dark:text-slate-200">${escapeHtml(nextClass.room || 'Chưa có')}</strong></span>
              <span>•</span>
              <span>GV: <strong class="text-slate-700 dark:text-slate-200">${escapeHtml(nextClass.lecturer || 'Chưa có')}</strong></span>
            </p>
          </div>
        </div>

        <div class="self-end sm:self-auto text-right">
          <div class="text-xl md:text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">${escapeHtml(nextClass.startTime)}</div>
          <div class="text-xs text-slate-400">Giờ vào lớp</div>
        </div>
      </div>
    `;
  }

  if (nextUpcomingAnyDay) {
    const { classItem, dayOfWeek } = nextUpcomingAnyDay;
    return `
      <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 md:p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 flex items-center justify-center flex-shrink-0">
            <i data-lucide="calendar" class="w-6 h-6"></i>
          </div>
          <div>
            <div class="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Buổi học kế tiếp: <strong class="text-indigo-600 dark:text-indigo-400">${getDayNameVietnamese(dayOfWeek)}</strong>
            </div>
            <h3 class="text-base md:text-lg font-bold text-slate-900 dark:text-white mt-1">${escapeHtml(classItem.subjectName)}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 mt-1">
              <span>Phòng: <strong>${escapeHtml(classItem.room || 'Chưa có')}</strong></span>
              <span>•</span>
              <span>Giờ: <strong>${escapeHtml(classItem.startTime)} - ${escapeHtml(classItem.endTime)}</strong></span>
            </p>
          </div>
        </div>

        <div class="self-end sm:self-auto">
          <span class="text-xs px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
            ${getDayShortVietnamese(dayOfWeek)} lúc ${escapeHtml(classItem.startTime)}
          </span>
        </div>
      </div>
    `;
  }

  return `
    <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
      <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Chưa có buổi học nào trong tuần</p>
      <p class="text-xs text-slate-400 mt-1">Hãy bấm "Thêm buổi học" để lên lịch thời khóa biểu!</p>
    </div>
  `;
}

/**
 * Render Nearest Exam Countdown Widget
 */
function renderNearestExamWidget(nearestExam, subjects, now) {
  if (!nearestExam) {
    return `
      <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 md:p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <i data-lucide="check-circle-2" class="w-6 h-6"></i>
          </div>
          <div>
            <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">Không có kỳ thi sắp tới</span>
            <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">Lịch thi hiện đang trống</h4>
            <p class="text-[11px] text-slate-400">Bạn có thể thoải mái ôn tập và chuẩn bị bài vở.</p>
          </div>
        </div>
        <button id="btn-dash-goto-exams" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition flex-shrink-0 cursor-pointer">
          Lịch thi
        </button>
      </div>
    `;
  }

  const subject = subjects.find(s => s.id === nearestExam.subjectId);
  const examDateStr = nearestExam.eDate || nearestExam.examDate || nearestExam.date || '';
  const examTimeStr = nearestExam.eTime || nearestExam.examTime || nearestExam.startTime || '';
  const examRoomStr = nearestExam.eRoom || nearestExam.room || nearestExam.location || '';
  const examDateObj = new Date(`${examDateStr}T${examTimeStr || '00:00'}`);
  const diffMs = examDateObj.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isUrgent = diffDays <= 7;

  return `
    <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 md:p-6 border-2 ${isUrgent ? 'border-rose-500/50 bg-rose-50/20 dark:bg-rose-950/10' : 'border-indigo-500/30'} shadow-md flex items-center justify-between gap-4">
      <div class="flex items-center gap-4 min-w-0">
        <div class="w-14 h-14 rounded-2xl ${isUrgent ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300' : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'} flex flex-col items-center justify-center flex-shrink-0 border ${isUrgent ? 'border-rose-200 dark:border-rose-800' : 'border-indigo-100 dark:border-indigo-800'}">
          <div class="text-xl font-black font-mono leading-none">${Math.max(0, diffDays)}</div>
          <div class="text-[9px] font-bold uppercase tracking-wider mt-0.5">Ngày nữa</div>
        </div>

        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isUrgent ? 'bg-rose-500 text-white animate-pulse' : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'}">
              ${isUrgent ? '⚠️ Sắp thi' : 'Kỳ thi kế tiếp'} • ${escapeHtml(nearestExam.type || 'Cuối kỳ')}
            </span>
            ${examRoomStr ? `<span class="text-[11px] text-slate-500 dark:text-slate-400">Phòng ${escapeHtml(examRoomStr)}</span>` : ''}
          </div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white mt-1 truncate">${escapeHtml(subject ? subject.name : (nearestExam.title || 'Kỳ thi môn học'))}</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ngày thi: <strong class="text-slate-700 dark:text-slate-200">${examDateStr} ${examTimeStr ? `(${examTimeStr})` : ''}</strong>
          </p>
        </div>
      </div>

      <button id="btn-dash-goto-exams" class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition flex-shrink-0 cursor-pointer">
        Xem chi tiết
      </button>
    </div>
  `;
}

/**
 * Render Deadline Tasks in active tab
 */
function renderDeadlineTasksList(tasksList, subjects, todayStr) {
  if (tasksList.length === 0) {
    return `
      <div class="py-8 text-center bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
        <p class="text-xs font-bold text-slate-600 dark:text-slate-300">Không có nhiệm vụ nào trong mục này</p>
        <p class="text-[11px] text-slate-400 mt-0.5">Bạn đã xử lý hết các hạn nộp này hoặc chưa thêm bài tập mới.</p>
      </div>
    `;
  }

  return `
    <div class="space-y-2">
      ${tasksList.map(task => {
        const subject = subjects.find(s => s.id === task.subjectId);
        const color = getColorById(subject?.color || 'indigo');
        const isDone = task.status === 'completed';
        const isOverdue = task.dueDate && task.dueDate < todayStr && !isDone;

        // Due badge text
        let dueText = task.dueDate || 'Không có hạn';
        if (task.dueDate === todayStr) dueText = 'Hôm nay';
        else if (isOverdue) dueText = `Quá hạn (${task.dueDate})`;

        return `
          <div class="group flex items-center justify-between p-3 rounded-2xl border ${isDone ? 'bg-slate-50/60 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800 opacity-60' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'} hover:border-indigo-300 transition">
            <div class="flex items-center gap-3 min-w-0">
              <input
                type="checkbox"
                data-task-id="${task.id}"
                class="dash-task-check w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                ${isDone ? 'checked' : ''}
              />
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate ${isDone ? 'line-through text-slate-400' : ''}">
                    ${escapeHtml(task.title)}
                  </span>
                  ${subject ? `<span class="text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${color.badge}">${escapeHtml(subject.code)}</span>` : ''}
                </div>
                <div class="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                  <span class="${isOverdue ? 'text-rose-500 font-bold' : ''}">
                    <i data-lucide="clock" class="w-3 h-3 inline mr-0.5"></i>
                    ${dueText}
                  </span>
                  <span>•</span>
                  <span class="capitalize text-slate-500 dark:text-slate-400">
                    ${getPriorityLabel(task.priority)}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1.5 flex-shrink-0">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusBadge(task.status)}">
                ${getStatusLabel(task.status)}
              </span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function getPriorityLabel(priority) {
  switch (priority) {
    case 'urgent': return 'Khẩn cấp';
    case 'high': return 'Ưu tiên cao';
    case 'medium': return 'Trung bình';
    case 'low': return 'Thấp';
    default: return 'Bình thường';
  }
}

function getStatusBadge(status) {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
    case 'in_progress': return 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300';
    case 'overdue': return 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'completed': return 'Đã xong';
    case 'in_progress': return 'Đang làm';
    case 'overdue': return 'Quá hạn';
    default: return 'Chờ nộp';
  }
}

function formatMinutesDisplay(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return '0 phút';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0 && mins > 0) return `${hours}g ${mins}p`;
  if (hours > 0) return `${hours} giờ`;
  return `${mins} phút`;
}

function setupDashboardEvents(container, onNavigate, tasks, subjects) {
  // Navigation buttons
  container.querySelector('#btn-dash-view-schedule')?.addEventListener('click', () => onNavigate?.('schedule'));
  container.querySelector('#btn-dash-view-all-tasks')?.addEventListener('click', () => onNavigate?.('tasks'));
  container.querySelector('#btn-dash-goto-exams')?.addEventListener('click', () => onNavigate?.('exams'));
  container.querySelector('#btn-dash-view-all-progress')?.addEventListener('click', () => onNavigate?.('progress'));
  container.querySelector('#btn-dash-view-grades')?.addEventListener('click', () => onNavigate?.('grades'));
  container.querySelector('#btn-dash-enter-grades')?.addEventListener('click', () => onNavigate?.('grades'));
  container.querySelector('#btn-dash-start-timer')?.addEventListener('click', () => onNavigate?.('timer'));

  // Quick actions
  container.querySelector('#btn-quick-add-task')?.addEventListener('click', () => openTaskFormModal());
  container.querySelector('#btn-quick-add-class')?.addEventListener('click', () => openScheduleFormModal());
  container.querySelector('#btn-quick-goto-notes')?.addEventListener('click', () => onNavigate?.('notes'));
  container.querySelector('#btn-quick-goto-mindmap')?.addEventListener('click', () => onNavigate?.('mindmap'));

  // Notification toggle
  container.querySelector('#btn-toggle-notifications')?.addEventListener('click', async () => {
    const current = await isNotificationEnabled();
    await toggleNotifications(!current);
    renderDashboard(onNavigate);
  });

  // Export backup
  container.querySelector('#btn-dash-export-backup')?.addEventListener('click', () => {
    document.getElementById('btn-backup-data')?.click();
  });

  // Import backup file
  container.querySelector('#btn-dash-import-backup')?.addEventListener('click', () => {
    document.getElementById('input-restore-data')?.click();
  });

  // Sync latest default backup from cloud
  container.querySelector('#btn-dash-sync-default')?.addEventListener('click', async () => {
    if (window.studyHubApp && window.studyHubApp.syncLatestPublicData) {
      await window.studyHubApp.syncLatestPublicData();
    }
  });

  // Subject mini card click -> open subject detail modal
  container.querySelectorAll('.dash-subject-card').forEach(card => {
    card.addEventListener('click', () => {
      const subId = card.getAttribute('data-subject-id');
      if (subId) openSubjectDetailModal(subId);
    });
  });

  // Deadline tabs
  container.querySelectorAll('.tab-deadline-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeDeadlineTab = btn.getAttribute('data-tab');
      renderDashboard(onNavigate);
    });
  });

  // Task quick complete checkbox with Toast Undo
  container.querySelectorAll('.dash-task-check').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const taskId = chk.getAttribute('data-task-id');
      const isChecked = chk.checked;
      const task = await getById('tasks', taskId);
      if (!task) return;

      const previousStatus = task.status;
      task.status = isChecked ? 'completed' : 'pending';
      task.updatedAt = new Date().toISOString();
      await saveItem('tasks', task);

      showToast(
        isChecked ? `Đã đánh dấu hoàn thành: "${task.title}"` : `Đã chuyển sang chưa hoàn thành: "${task.title}"`,
        'success',
        4500,
        {
          label: 'Hoàn tác',
          onClick: async () => {
            task.status = previousStatus;
            task.updatedAt = new Date().toISOString();
            await saveItem('tasks', task);
            renderDashboard(onNavigate);
          }
        }
      );

      renderDashboard(onNavigate);
    });
  });
}

function startCountdownTicker(container, ongoingClass, nextClass) {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
  countdownTimer = setInterval(() => {
    const view = document.getElementById('dashboard-view');
    if (view && !view.classList.contains('hidden')) {
      renderDashboard(activeNavigateFn);
    }
  }, 30000);
}
