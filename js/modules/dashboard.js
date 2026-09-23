/**
 * Dashboard Overview Module
 * Includes Next Class Widget with real-time countdown, quick stats, and today's schedule preview.
 */

import { getAll } from '../db.js';
import {
  getCurrentVnDay,
  getDayNameVietnamese,
  formatDateVietnamese,
  formatTimeHM,
  timeToMinutes,
  getColorById,
  escapeHtml
} from '../utils/helpers.js';
import { openScheduleFormModal } from './schedule.js';

let countdownTimer = null;

export async function initDashboardModule(onNavigate) {
  renderDashboard(onNavigate);
}

export async function renderDashboard(onNavigate) {
  const container = document.getElementById('dashboard-view');
  if (!container) return;

  const schedules = await getAll('schedules');
  const notes = await getAll('notes');
  const mindmaps = await getAll('mindmaps');
  const imageNotes = await getAll('imageNotes');

  const currentVnDay = getCurrentVnDay();
  const now = new Date();
  const currentMinutes = timeToMinutes(formatTimeHM(now));

  // Today's classes sorted by start time
  const todayClasses = schedules
    .filter(s => s.dayOfWeek === currentVnDay)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  // Find ongoing class or next upcoming class today
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

  // If no upcoming class today, find the earliest class on the next closest day
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

  container.innerHTML = `
    <!-- Greeting Banner -->
    <div class="mb-6 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-indigo-500/15 relative overflow-hidden">
      <!-- Decorative background circles -->
      <div class="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
      <div class="absolute right-20 -top-10 w-32 h-32 rounded-full bg-purple-400/20 blur-xl pointer-events-none"></div>

      <div class="relative z-10 max-w-2xl">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold mb-3">
          <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
          Chào mừng bạn đến với StudyHub
        </span>
        <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight">
          Hôm nay là ${formatDateVietnamese(now)}
        </h2>
        <p class="text-sm md:text-base text-indigo-100 mt-2">
          Bạn có <strong class="text-white font-bold underline decoration-amber-400 decoration-2">${todayClasses.length} buổi học</strong> được lên lịch trong ngày hôm nay.
        </p>
      </div>
    </div>

    <!-- Live Status / Next Class Countdown Widget -->
    <div class="mb-8">
      ${renderNextClassWidget(ongoingClass, nextClass, nextUpcomingAnyDay, currentMinutes)}
    </div>

    <!-- Quick Stats Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
        <div class="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
          <i data-lucide="calendar" class="w-5 h-5"></i>
        </div>
        <div>
          <div class="text-xl font-black text-slate-900 dark:text-white">${schedules.length}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400 font-medium">Buổi học trong tuần</div>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
        <div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
          <i data-lucide="file-text" class="w-5 h-5"></i>
        </div>
        <div>
          <div class="text-xl font-black text-slate-900 dark:text-white">${notes.length}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400 font-medium">Ghi chú bài học</div>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
        <div class="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
          <i data-lucide="git-merge" class="w-5 h-5"></i>
        </div>
        <div>
          <div class="text-xl font-black text-slate-900 dark:text-white">${mindmaps.length}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400 font-medium">Sơ đồ tư duy</div>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
        <div class="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
          <i data-lucide="image" class="w-5 h-5"></i>
        </div>
        <div>
          <div class="text-xl font-black text-slate-900 dark:text-white">${imageNotes.length}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400 font-medium">Ảnh slide chú thích</div>
        </div>
      </div>
    </div>

    <!-- Today's Classes List & Quick Actions -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left 2 Cols: Today's Schedule -->
      <div class="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 md:p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Lịch học hôm nay</h3>
            <span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 font-semibold text-slate-600 dark:text-slate-300">
              ${getDayNameVietnamese(currentVnDay)}
            </span>
          </div>
          <button id="btn-dash-view-schedule" class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
            Xem cả tuần
            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        ${todayClasses.length === 0 ? `
          <div class="py-12 text-center">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-slate-700/60 flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-3">
              <i data-lucide="coffee" class="w-7 h-7"></i>
            </div>
            <h4 class="text-sm font-bold text-slate-800 dark:text-slate-200">Không có tiết học nào trong ngày hôm nay!</h4>
            <p class="text-xs text-slate-400 mt-1">Chúc bạn có một ngày nghỉ ngơi hoặc ôn tập hiệu quả.</p>
          </div>
        ` : `
          <div class="space-y-3">
            ${todayClasses.map(item => {
              const color = getColorById(item.color);
              const startMin = timeToMinutes(item.startTime);
              const endMin = timeToMinutes(item.endTime);
              const isOngoing = currentMinutes >= startMin && currentMinutes <= endMin;

              return `
                <div class="flex items-center justify-between p-3.5 rounded-2xl border ${color.bgLight} ${color.darkBg} transition hover:shadow-xs">
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

      <!-- Right 1 Col: Quick Shortcut Cards -->
      <div class="space-y-4">
        <div class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <i data-lucide="zap" class="w-4 h-4 text-amber-500"></i>
            Thao tác nhanh
          </h3>
          <div class="space-y-2">
            <button id="btn-quick-add-class" class="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition text-xs font-semibold">
              <span class="flex items-center gap-2.5">
                <i data-lucide="calendar-plus" class="w-4 h-4 text-indigo-500"></i>
                Thêm buổi học mới
              </span>
              <i data-lucide="plus" class="w-4 h-4"></i>
            </button>

            <button id="btn-quick-goto-notes" class="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition text-xs font-semibold">
              <span class="flex items-center gap-2.5">
                <i data-lucide="file-plus" class="w-4 h-4 text-emerald-500"></i>
                Viết ghi chú bài học
              </span>
              <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>

            <button id="btn-quick-goto-mindmap" class="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 transition text-xs font-semibold">
              <span class="flex items-center gap-2.5">
                <i data-lucide="git-merge" class="w-4 h-4 text-amber-500"></i>
                Vẽ sơ đồ tư duy (Mind Map)
              </span>
              <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>

            <button id="btn-quick-goto-images" class="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 transition text-xs font-semibold">
              <span class="flex items-center gap-2.5">
                <i data-lucide="image-plus" class="w-4 h-4 text-rose-500"></i>
                Tải ảnh slide & chú thích
              </span>
              <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Tip for student -->
        <div class="bg-indigo-50 dark:bg-indigo-950/40 rounded-3xl border border-indigo-100 dark:border-indigo-800/60 p-4">
          <div class="flex items-start gap-2.5">
            <i data-lucide="lightbulb" class="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5"></i>
            <div>
              <h4 class="text-xs font-bold text-indigo-900 dark:text-indigo-200">Mẹo học tập</h4>
              <p class="text-[11px] text-indigo-700 dark:text-indigo-300 mt-1">
                Dữ liệu của StudyHub được lưu tự động và an toàn trong trình duyệt (IndexedDB). Bạn không bao giờ sợ mất bài khi tải lại trang!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach dashboard navigation buttons
  setupDashboardEvents(container, onNavigate);

  if (window.lucide) {
    window.lucide.createIcons({ root: container });
  }

  // Start real-time countdown timer tick
  startCountdownTicker(container, ongoingClass, nextClass);
}

/**
 * Render Next Class Widget (Ongoing or Upcoming)
 */
function renderNextClassWidget(ongoingClass, nextClass, nextUpcomingAnyDay, currentMinutes) {
  if (ongoingClass) {
    const endMin = timeToMinutes(ongoingClass.endTime);
    const remainingMin = Math.max(0, endMin - currentMinutes);
    const color = getColorById(ongoingClass.color);

    return `
      <div class="bg-emerald-500 text-white rounded-3xl p-5 md:p-6 shadow-lg shadow-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
            <i data-lucide="radio" class="w-6 h-6 animate-pulse"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full bg-white text-emerald-700 text-xs font-black uppercase tracking-wider">
                Đang diễn ra
              </span>
              <span class="text-xs text-emerald-100 font-semibold">
                Còn lại khoảng ${remainingMin} phút
              </span>
            </div>
            <h3 class="text-xl font-black mt-1">${escapeHtml(ongoingClass.subjectName)}</h3>
            <p class="text-xs text-emerald-100 flex items-center gap-3 mt-1">
              <span>Phòng: <strong class="text-white">${escapeHtml(ongoingClass.room || 'Chưa cập nhật')}</strong></span>
              <span>•</span>
              <span>GV: <strong class="text-white">${escapeHtml(ongoingClass.lecturer || 'Chưa cập nhật')}</strong></span>
            </p>
          </div>
        </div>

        <div class="self-end sm:self-auto text-right">
          <div class="text-2xl font-black font-mono tracking-tight">${escapeHtml(ongoingClass.startTime)} - ${escapeHtml(ongoingClass.endTime)}</div>
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
              <span class="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider">
                Tiết học tiếp theo hôm nay
              </span>
              <span class="text-xs font-bold text-amber-600 dark:text-amber-400">
                Bắt đầu sau ${timeDisplay}
              </span>
            </div>
            <h3 class="text-lg md:text-xl font-bold text-slate-900 dark:text-white mt-1">${escapeHtml(nextClass.subjectName)}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 mt-1">
              <span>Phòng: <strong class="text-slate-700 dark:text-slate-200">${escapeHtml(nextClass.room || 'Chưa cập nhật')}</strong></span>
              <span>•</span>
              <span>GV: <strong class="text-slate-700 dark:text-slate-200">${escapeHtml(nextClass.lecturer || 'Chưa cập nhật')}</strong></span>
            </p>
          </div>
        </div>

        <div class="self-end sm:self-auto text-right">
          <div class="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">${escapeHtml(nextClass.startTime)}</div>
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
              Buổi học sắp tới gần nhất: <strong class="text-indigo-600 dark:text-indigo-400">${getDayNameVietnamese(dayOfWeek)}</strong>
            </div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white mt-1">${escapeHtml(classItem.subjectName)}</h3>
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
      <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Chưa có buổi học nào trong thời khóa biểu</p>
      <p class="text-xs text-slate-400 mt-1">Hãy bấm "Thêm buổi học" để bắt đầu lên lịch học tập!</p>
    </div>
  `;
}

function setupDashboardEvents(container, onNavigate) {
  const btnViewSched = container.querySelector('#btn-dash-view-schedule');
  if (btnViewSched && onNavigate) {
    btnViewSched.addEventListener('click', () => onNavigate('schedule'));
  }

  const btnAddClass = container.querySelector('#btn-quick-add-class');
  if (btnAddClass) {
    btnAddClass.addEventListener('click', () => {
      openScheduleFormModal();
    });
  }

  const btnNotes = container.querySelector('#btn-quick-goto-notes');
  if (btnNotes && onNavigate) {
    btnNotes.addEventListener('click', () => onNavigate('notes'));
  }

  const btnMindmap = container.querySelector('#btn-quick-goto-mindmap');
  if (btnMindmap && onNavigate) {
    btnMindmap.addEventListener('click', () => onNavigate('mindmap'));
  }

  const btnImages = container.querySelector('#btn-quick-goto-images');
  if (btnImages && onNavigate) {
    btnImages.addEventListener('click', () => onNavigate('imageNotes'));
  }
}

function startCountdownTicker(container, ongoingClass, nextClass) {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
  // Refresh every 30 seconds
  countdownTimer = setInterval(() => {
    // Only refresh if dashboard is currently visible
    if (document.getElementById('dashboard-view') && !document.getElementById('dashboard-view').classList.contains('hidden')) {
      renderDashboard();
    }
  }, 30000);
}
