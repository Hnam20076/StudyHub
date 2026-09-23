/**
 * Progress Module (Module 11)
 * Aggregates objective learning data across the entire system:
 * Schedule weeks, Tasks completion, Notes, Mindmaps, Exams, and Study Time per subject.
 */

import { getAll } from '../db.js';
import { getColorById, escapeHtml } from '../utils/helpers.js';
import { formatMinutesHuman } from './timer.js';

let activeNavigateFn = null;

export async function initProgressModule(onNavigate) {
  activeNavigateFn = onNavigate;
  await renderProgress();
}

/**
 * Main render function for Progress View
 */
export async function renderProgress() {
  const container = document.getElementById('progress-view');
  if (!container) return;

  const [
    allSubjects,
    allSchedules,
    allTasks,
    allNotes,
    allMindmaps,
    allExams,
    allSessions
  ] = await Promise.all([
    getAll('subjects'),
    getAll('schedules'),
    getAll('tasks'),
    getAll('notes'),
    getAll('mindmaps'),
    getAll('exams'),
    getAll('studySessions')
  ]);

  const subjects = (allSubjects || []).filter(s => !s.deletedAt);
  const schedules = (allSchedules || []).filter(s => !s.deletedAt);
  const tasks = (allTasks || []).filter(t => !t.deletedAt);
  const notes = (allNotes || []).filter(n => !n.deletedAt);
  const mindmaps = (allMindmaps || []).filter(m => !m.deletedAt);
  const exams = (allExams || []).filter(e => !e.deletedAt);
  const sessions = (allSessions || []).filter(s => !s.deletedAt);

  // Compute progress per subject
  const subjectProgressList = subjects.map(sub => {
    // 1. Schedules
    const subSchedules = schedules.filter(s => s.subjectCode === sub.code || s.subjectId === sub.id);
    const uniqueWeeks = new Set(subSchedules.map(s => s.week)).size;
    const totalWeeks = 16;
    // Estimated current week based on date (assuming semester started Sept 2026)
    const currentWeekEst = 1; // Học kỳ 1 tuần 1

    // 2. Tasks
    const subTasks = tasks.filter(t => t.subjectId === sub.id || t.subjectId === sub.code);
    const completedTasks = subTasks.filter(t => t.status === 'completed');
    const taskPercent = subTasks.length > 0 ? (completedTasks.length / subTasks.length) * 100 : 0;

    // 3. Notes & Mindmaps
    const subNotes = notes.filter(n => n.subjectId === sub.id || n.subjectId === sub.code);
    const subMindmaps = mindmaps.filter(m => m.subjectId === sub.id || m.subjectId === sub.code);
    const totalDocs = subNotes.length + subMindmaps.length;

    // 4. Exams
    const subExams = exams.filter(e => e.subjectId === sub.id || e.subjectId === sub.code);

    // 5. Study Sessions & Time
    const subSessions = sessions.filter(s => s.subjectId === sub.id || s.subjectId === sub.code);
    const totalStudyMinutes = subSessions.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);

    // Composite objective progress score
    // Weighting: Tasks (50%), Study weeks elapsed (30%), Notes & Docs (20%)
    const weekRatio = Math.min(1, currentWeekEst / totalWeeks);
    const docRatio = Math.min(1, totalDocs / 3);
    const overallProgress = subTasks.length > 0
      ? Math.round((taskPercent * 0.5) + (weekRatio * 100 * 0.3) + (docRatio * 100 * 0.2))
      : Math.round((weekRatio * 100 * 0.5) + (docRatio * 100 * 0.5));

    return {
      subject: sub,
      overallProgress: Math.min(100, Math.max(0, overallProgress)),
      scheduleInfo: {
        weeksHeld: currentWeekEst,
        totalWeeks: 16,
        sessionsCount: subSchedules.length
      },
      taskInfo: {
        completed: completedTasks.length,
        total: subTasks.length,
        percent: Math.round(taskPercent)
      },
      docInfo: {
        notesCount: subNotes.length,
        mindmapsCount: subMindmaps.length,
        total: totalDocs
      },
      examInfo: {
        count: subExams.length
      },
      studyInfo: {
        minutes: totalStudyMinutes,
        human: formatMinutesHuman(totalStudyMinutes)
      }
    };
  });

  // Calculate overall semester average progress
  const avgProgress = subjectProgressList.length > 0
    ? Math.round(subjectProgressList.reduce((acc, p) => acc + p.overallProgress, 0) / subjectProgressList.length)
    : 0;

  const totalStudySemesterMinutes = sessions.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);

  container.innerHTML = `
    <!-- Header -->
    <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
            <i data-lucide="trending-up" class="w-6 h-6"></i>
          </span>
          <div>
            <h2 class="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Tiến độ Học tập Toàn diện</h2>
            <p class="text-xs md:text-sm text-slate-500 dark:text-slate-400">
              Tổng hợp dữ liệu khách quan từ thời khóa biểu, bài tập, ghi chú, kỳ thi và thời gian tập trung
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Overall Semester Progress Card -->
    <div class="mb-8 p-6 md:p-8 rounded-3xl bg-gradient-to-r from-teal-600 via-indigo-600 to-indigo-700 text-white shadow-xl shadow-teal-500/15 relative overflow-hidden">
      <div class="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>

      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="space-y-2 max-w-xl">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold">
            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
            Học kỳ 1 • Năm học 2026-2027
          </span>
          <h3 class="text-2xl md:text-3xl font-black tracking-tight">Tiến độ hoàn thành học kỳ: ${avgProgress}%</h3>
          <p class="text-xs md:text-sm text-indigo-100 leading-relaxed">
            Dữ liệu tổng hợp từ <strong>${subjects.length} môn học</strong>, <strong>${tasks.filter(t => t.status === 'completed').length}/${tasks.length} nhiệm vụ</strong> đã nộp và <strong>${formatMinutesHuman(totalStudySemesterMinutes)}</strong> thời gian tự học.
          </p>
        </div>

        <div class="w-full md:w-64 flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs font-bold text-indigo-100">
            <span>Tổng thể</span>
            <span>${avgProgress}%</span>
          </div>
          <div class="w-full h-3 rounded-full bg-white/20 overflow-hidden backdrop-blur-sm">
            <div class="h-full rounded-full bg-white transition-all duration-500" style="width: ${avgProgress}%"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Subject Progress List -->
    <div class="space-y-4">
      <h3 class="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
        <i data-lucide="layers" class="w-4 h-4 text-indigo-500"></i>
        <span>Tiến độ chi tiết từng môn học (${subjects.length})</span>
      </h3>

      ${subjectProgressList.map(item => {
        const sub = item.subject;
        const colorDef = getColorById(sub.color || 'indigo');

        return `
          <div class="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm space-y-4" data-subject-id="${sub.id}">
            <!-- Subject Header & Progress Bar -->
            <div class="space-y-2">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div class="flex items-center gap-2.5">
                  <span class="px-2.5 py-1 text-xs font-mono font-bold rounded-lg ${colorDef.bg} ${colorDef.text} border ${colorDef.border}">
                    ${escapeHtml(sub.code)}
                  </span>
                  <h4 class="text-base font-extrabold text-slate-900 dark:text-white">${escapeHtml(sub.name)}</h4>
                  <span class="text-xs text-slate-400">(${sub.credits} Tín chỉ)</span>
                </div>

                <div class="flex items-center gap-2 self-end sm:self-auto">
                  <span class="text-sm font-black text-indigo-600 dark:text-indigo-400">${item.overallProgress}%</span>
                  <button type="button" class="text-xs text-slate-400 hover:text-indigo-600 transition btn-view-sub" data-sub-id="${sub.id}">
                    <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>

              <!-- Visual Progress Bar -->
              <div class="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div class="h-full rounded-full bg-gradient-to-r from-teal-500 to-indigo-600 transition-all duration-300" style="width: ${item.overallProgress}%"></div>
              </div>
            </div>

            <!-- 5 Objective Academic Metrics -->
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
              <!-- Metric 1: Lịch học -->
              <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 flex flex-col justify-between">
                <div class="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                  <i data-lucide="calendar" class="w-3 h-3 text-indigo-500"></i>
                  <span>LỊCH HỌC</span>
                </div>
                <div class="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-1">
                  ${item.scheduleInfo.weeksHeld} / ${item.scheduleInfo.totalWeeks} <span class="text-[10px] text-slate-400 font-normal">tuần</span>
                </div>
              </div>

              <!-- Metric 2: Nhiệm vụ -->
              <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 flex flex-col justify-between">
                <div class="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                  <i data-lucide="check-square" class="w-3 h-3 text-blue-500"></i>
                  <span>NHIỆM VỤ</span>
                </div>
                <div class="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-1">
                  ${item.taskInfo.completed} / ${item.taskInfo.total} <span class="text-[10px] text-slate-400 font-normal">bài</span>
                </div>
              </div>

              <!-- Metric 3: Ghi chú & Sơ đồ -->
              <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 flex flex-col justify-between">
                <div class="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                  <i data-lucide="file-text" class="w-3 h-3 text-emerald-500"></i>
                  <span>GHI CHÚ</span>
                </div>
                <div class="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-1">
                  ${item.docInfo.total} <span class="text-[10px] text-slate-400 font-normal">tài liệu</span>
                </div>
              </div>

              <!-- Metric 4: Kỳ thi -->
              <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 flex flex-col justify-between">
                <div class="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                  <i data-lucide="award" class="w-3 h-3 text-purple-500"></i>
                  <span>KỲ THI</span>
                </div>
                <div class="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-1">
                  ${item.examInfo.count} <span class="text-[10px] text-slate-400 font-normal">kỳ thi</span>
                </div>
              </div>

              <!-- Metric 5: Thời gian học -->
              <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 flex flex-col justify-between col-span-2 sm:col-span-1">
                <div class="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                  <i data-lucide="timer" class="w-3 h-3 text-amber-500"></i>
                  <span>TẬP TRUNG</span>
                </div>
                <div class="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-1">
                  ${item.studyInfo.human}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ root: container });

  // Quick navigation to subject detail
  container.querySelectorAll('.btn-view-sub').forEach(btn => {
    btn.addEventListener('click', async () => {
      const subId = btn.getAttribute('data-sub-id');
      if (subId) {
        const { openSubjectDetailModal } = await import('./subjects.js');
        openSubjectDetailModal(subId);
      }
    });
  });
}
