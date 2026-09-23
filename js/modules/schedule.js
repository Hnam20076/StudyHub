/**
 * Schedule (Thời khóa biểu) Module - 16 Tuần Học Kỳ 1 (2025-2026)
 * Supports 16-Week Navigator, Week view, Day view, Subject filters, E-Learning/MS-Teams badges, and Add/Edit/Delete.
 */

import { getAll, saveItem, deleteItem } from '../db.js';
import {
  generateId,
  getCurrentVnDay,
  getDayNameVietnamese,
  getDayShortVietnamese,
  formatDateVietnamese,
  formatTimeHM,
  timeToMinutes,
  isTimeOverlapping,
  SUBJECT_COLORS,
  getColorById,
  escapeHtml
} from '../utils/helpers.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

export const WEEK_DATE_RANGES = {
  1: '07/09/2026 - 13/09/2026',
  2: '14/09/2026 - 20/09/2026',
  3: '21/09/2026 - 27/09/2026',
  4: '28/09/2026 - 04/10/2026',
  5: '05/10/2026 - 11/10/2026',
  6: '12/10/2026 - 18/10/2026',
  7: '19/10/2026 - 25/10/2026',
  8: '26/10/2026 - 01/11/2026',
  9: '02/11/2026 - 08/11/2026',
  10: '09/11/2026 - 15/11/2026',
  11: '16/11/2026 - 22/11/2026',
  12: '23/11/2026 - 29/11/2026',
  13: '30/11/2026 - 06/12/2026',
  14: '07/12/2026 - 13/12/2026',
  15: '14/12/2026 - 20/12/2026',
  16: '21/12/2026 - 27/12/2026'
};

let currentScheduleData = [];
let linkedNotes = [];
let linkedMindmaps = [];
let currentViewMode = 'week'; // 'week' | 'day'
let currentWeekNumber = 1; // 1 to 16, or 'all'
let currentSelectedDay = getCurrentVnDay(); // 2 to 8
let currentSubjectFilter = 'all';

export async function initScheduleModule() {
  await loadSchedules();
  renderSchedule();
  setupKeyboardShortcuts();
}

export async function loadSchedules() {
  currentScheduleData = await getAll('schedules');
  try {
    const [notes, mindmaps] = await Promise.all([
      getAll('notes'),
      getAll('mindmaps')
    ]);
    linkedNotes = (notes || []).filter(n => !n.deletedAt);
    linkedMindmaps = (mindmaps || []).filter(m => !m.deletedAt);
  } catch (err) {
    console.warn('Không thể nạp dữ liệu liên kết:', err);
  }

  // Sort by dayOfWeek then by startTime
  currentScheduleData.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) {
      return a.dayOfWeek - b.dayOfWeek;
    }
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });
  return currentScheduleData;
}

export function getLinkedItemsForClass(item) {
  const code = (item.subjectCode || '').trim().toLowerCase();
  const name = (item.subjectName || '').trim().toLowerCase();

  const notes = linkedNotes.filter(n => {
    const nCode = (n.subjectId || '').trim().toLowerCase();
    const nName = (n.subjectName || '').trim().toLowerCase();
    if (code && nCode && code === nCode) return true;
    if (name && nName && (name === nName || name.includes(nName) || nName.includes(name))) return true;
    return false;
  });

  const mindmaps = linkedMindmaps.filter(m => {
    const mCode = (m.subjectId || '').trim().toLowerCase();
    const mName = (m.subjectName || '').trim().toLowerCase();
    if (code && mCode && code === mCode) return true;
    if (name && mName && (name === mName || name.includes(mName) || mName.includes(name))) return true;
    return false;
  });

  return { notes, mindmaps, count: notes.length + mindmaps.length };
}

export function renderSchedule() {
  const container = document.getElementById('schedule-view');
  if (!container) return;

  const currentVnDay = getCurrentVnDay();
  const currentMinutes = timeToMinutes(formatTimeHM(new Date()));

  // Extract unique subjects across all schedules
  const uniqueSubjects = Array.from(new Set(currentScheduleData.map(s => s.subjectName).filter(Boolean)));

  // Filter items by week and subject
  const filteredData = currentScheduleData.filter(item => {
    // Week filter
    if (currentWeekNumber !== 'all') {
      if (item.week !== undefined && item.week !== currentWeekNumber) {
        return false;
      }
    }
    // Subject filter
    if (currentSubjectFilter !== 'all' && item.subjectName !== currentSubjectFilter) {
      return false;
    }
    return true;
  });

  // Calculate count per week for tabs
  const weekCounts = {};
  for (let w = 1; w <= 16; w++) {
    weekCounts[w] = currentScheduleData.filter(s => s.week === w).length;
  }

  container.innerHTML = `
    <!-- Schedule Header Bar -->
    <div class="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <i data-lucide="calendar" class="w-5 h-5"></i>
          </div>
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Thời khóa biểu 16 Tuần</h2>
          <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
            Học kỳ 1 • 2026-2027
          </span>
        </div>
        <p class="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Hôm nay: <strong class="text-slate-700 dark:text-slate-200">${formatDateVietnamese(new Date())}</strong>
          • Đang xem: <span class="text-indigo-600 dark:text-indigo-400 font-bold">${currentWeekNumber === 'all' ? 'Tất cả các tuần (16 tuần)' : `Tuần ${currentWeekNumber} (${WEEK_DATE_RANGES[currentWeekNumber] || ''})`}</span> (${filteredData.length} buổi học)
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <!-- View Mode Segmented Controls -->
        <div class="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center border border-slate-200 dark:border-slate-700">
          <button id="btn-view-week" class="px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition ${currentViewMode === 'week' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400'}">
            <span class="flex items-center gap-1.5">
              <i data-lucide="grid" class="w-3.5 h-3.5"></i>
              Theo tuần
            </span>
          </button>
          <button id="btn-view-day" class="px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition ${currentViewMode === 'day' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400'}">
            <span class="flex items-center gap-1.5">
              <i data-lucide="calendar-days" class="w-3.5 h-3.5"></i>
              Theo ngày
            </span>
          </button>
        </div>

        <!-- Filter by Subject -->
        <select id="filter-subject" class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs md:text-sm rounded-xl px-3 py-2 outline-none focus:border-indigo-500">
          <option value="all">Tất cả môn học (5 môn)</option>
          ${uniqueSubjects.map(sub => `<option value="${escapeHtml(sub)}" ${currentSubjectFilter === sub ? 'selected' : ''}>${escapeHtml(sub)}</option>`).join('')}
        </select>

        <!-- Add Class Button -->
        <button id="btn-add-class" class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-medium text-xs md:text-sm rounded-xl shadow-sm transition">
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>Thêm buổi học</span>
        </button>
      </div>
    </div>

    <!-- 16-Week Navigation Bar -->
    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 mb-6 shadow-sm overflow-hidden">
      <div class="flex items-center justify-between px-2 pb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <span class="flex items-center gap-1.5">
          <i data-lucide="calendar-range" class="w-3.5 h-3.5 text-indigo-500"></i>
          Chọn tuần học (Phím mũi tên ← → để chuyển tuần nhanh):
        </span>
        <button id="btn-week-all" class="px-2.5 py-1 rounded-lg text-xs font-bold transition ${currentWeekNumber === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800'}">
          Tất cả 16 tuần (${currentScheduleData.length})
        </button>
      </div>

      <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1" id="week-tabs-container">
        ${Array.from({ length: 16 }, (_, i) => i + 1).map(w => {
          const isActive = currentWeekNumber === w;
          const count = weekCounts[w] || 0;

          return `
            <button
              data-week="${w}"
              title="Tuần ${w}: ${WEEK_DATE_RANGES[w]}"
              class="btn-week-tab flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 scale-105'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
              }"
            >
              <span>Tuần ${w}</span>
              <span class="ml-1 text-[10px] ${isActive ? 'text-indigo-100' : 'text-slate-400 font-normal'}">(${count})</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Main Schedule Content Area -->
    <div id="schedule-content">
      ${currentViewMode === 'week' ? renderWeekView(filteredData, currentVnDay, currentMinutes) : renderDayView(filteredData, currentVnDay, currentMinutes)}
    </div>
  `;

  // Attach event handlers
  setupScheduleEvents(container);

  if (window.lucide) {
    window.lucide.createIcons({ root: container });
  }

  // Scroll active week tab into view
  setTimeout(() => {
    const activeTab = container.querySelector('.btn-week-tab.bg-indigo-600');
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, 50);
}

/**
 * Render Week View:
 * On Desktop (>= 768px): 7 columns (Thứ Hai -> Chủ Nhật)
 * On Mobile (< 768px): Quick Day Selector tabs + Selected Day cards
 */
function renderWeekView(data, currentVnDay, currentMinutes) {
  const days = [2, 3, 4, 5, 6, 7, 8];

  // Group classes by day
  const groupedByDay = {};
  days.forEach(day => { groupedByDay[day] = []; });
  data.forEach(item => {
    if (groupedByDay[item.dayOfWeek]) {
      groupedByDay[item.dayOfWeek].push(item);
    }
  });

  return `
    <!-- Mobile Day Selector (Visible on Mobile only) -->
    <div class="md:hidden mb-4">
      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
        ${days.map(day => {
          const isToday = day === currentVnDay;
          const isSelected = day === currentSelectedDay;
          const count = groupedByDay[day].length;
          return `
            <button data-day="${day}" class="mobile-day-tab flex-shrink-0 flex flex-col items-center justify-center w-14 py-2 px-1 rounded-2xl border transition-all ${
              isSelected
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }">
              <span class="text-xs font-bold">${getDayShortVietnamese(day)}</span>
              <span class="text-[10px] opacity-80">${isToday ? 'Hôm nay' : `Thứ ${day === 8 ? 'CN' : day}`}</span>
              ${count > 0 ? `<span class="mt-1 w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-500'}"></span>` : '<span class="mt-1 w-2 h-2 opacity-0">•</span>'}
            </button>
          `;
        }).join('')}
      </div>

      <!-- Mobile Selected Day Content -->
      <div class="mt-3">
        <div class="flex items-center justify-between mb-3 px-1">
          <h3 class="font-bold text-slate-900 dark:text-white text-base">
            ${getDayNameVietnamese(currentSelectedDay)}
            ${currentSelectedDay === currentVnDay ? '<span class="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">Hôm nay</span>' : ''}
          </h3>
          <span class="text-xs text-slate-500">${groupedByDay[currentSelectedDay].length} môn</span>
        </div>

        ${groupedByDay[currentSelectedDay].length === 0 ? `
          <div class="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-8 text-center">
            <div class="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 mb-3">
              <i data-lucide="coffee" class="w-6 h-6"></i>
            </div>
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Không có lịch học</p>
            <p class="text-xs text-slate-400 mt-1">Tận hưởng ngày nghỉ hoặc tự học nhé!</p>
          </div>
        ` : `
          <div class="space-y-3">
            ${groupedByDay[currentSelectedDay].map(item => renderClassCard(item, currentVnDay, currentMinutes)).join('')}
          </div>
        `}
      </div>
    </div>

    <!-- Desktop 7-Day Grid (Visible on Desktop >= 768px) -->
    <div class="hidden md:grid grid-cols-7 gap-3.5">
      ${days.map(day => {
        const isToday = day === currentVnDay;
        const classes = groupedByDay[day];

        return `
          <div class="flex flex-col bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border ${isToday ? 'border-indigo-400 dark:border-indigo-500/80 ring-2 ring-indigo-400/20' : 'border-slate-200 dark:border-slate-800'} overflow-hidden min-h-[580px]">
            <!-- Column Header -->
            <div class="p-3 text-center border-b ${isToday ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/80' : 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80'}">
              <div class="text-xs font-bold uppercase tracking-wider ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}">
                ${getDayShortVietnamese(day)}
              </div>
              <div class="text-sm font-extrabold mt-0.5 ${isToday ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-800 dark:text-slate-200'}">
                ${getDayNameVietnamese(day)}
              </div>
              ${isToday ? `
                <div class="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-semibold">
                  <span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                  Hôm nay
                </div>
              ` : `
                <div class="text-[11px] text-slate-400 mt-1">${classes.length} buổi</div>
              `}
            </div>

            <!-- Column Classes List -->
            <div class="p-2.5 flex-1 space-y-2.5 overflow-y-auto">
              ${classes.length === 0 ? `
                <div class="h-32 flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 text-xs">
                  <span>Trống</span>
                </div>
              ` : classes.map(item => renderClassCard(item, currentVnDay, currentMinutes, true)).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Render Day View
 */
function renderDayView(data, currentVnDay, currentMinutes) {
  const days = [2, 3, 4, 5, 6, 7, 8];
  const dayClasses = data.filter(item => item.dayOfWeek === currentSelectedDay);

  return `
    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 md:p-6 shadow-sm">
      <!-- Day Switcher Banner -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-700 gap-4">
        <div class="flex items-center gap-3">
          <div class="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <i data-lucide="calendar" class="w-6 h-6"></i>
          </div>
          <div>
            <h3 class="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              ${getDayNameVietnamese(currentSelectedDay)}
              ${currentSelectedDay === currentVnDay ? '<span class="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">Hôm nay</span>' : ''}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Có ${dayClasses.length} buổi học trong ${currentWeekNumber === 'all' ? 'học kỳ' : `Tuần ${currentWeekNumber}`}</p>
          </div>
        </div>

        <!-- Day Selector Buttons -->
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          ${days.map(d => {
            const isSelected = d === currentSelectedDay;
            const isToday = d === currentVnDay;
            return `
              <button data-day="${d}" class="day-view-tab px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
              }">
                ${getDayShortVietnamese(d)} ${isToday ? '•' : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Day Classes Timeline -->
      <div class="mt-6">
        ${dayClasses.length === 0 ? `
          <div class="py-16 text-center">
            <div class="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 dark:bg-slate-700/60 flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-4">
              <i data-lucide="sun" class="w-8 h-8"></i>
            </div>
            <h4 class="text-base font-bold text-slate-800 dark:text-slate-200">Không có buổi học nào vào ${getDayNameVietnamese(currentSelectedDay)} trong ${currentWeekNumber === 'all' ? 'các tuần' : `Tuần ${currentWeekNumber}`}</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">Bạn có thể chọn tuần khác hoặc bấm nút "Thêm buổi học" ở góc trên.</p>
          </div>
        ` : `
          <div class="relative pl-6 md:pl-8 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-6">
            ${dayClasses.map(item => {
              const color = getColorById(item.color);
              const startMin = timeToMinutes(item.startTime);
              const endMin = timeToMinutes(item.endTime);
              const isToday = item.dayOfWeek === currentVnDay;
              const isOngoing = isToday && currentMinutes >= startMin && currentMinutes <= endMin;
              const linked = getLinkedItemsForClass(item);

              return `
                <div class="relative group">
                  <!-- Timeline Dot -->
                  <div class="absolute -left-[31px] md:-left-[39px] top-4 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${color.badge} ${isOngoing ? 'ring-4 ring-emerald-400 animate-pulse' : ''}"></div>

                  <!-- Card -->
                  <div class="bg-white dark:bg-slate-800/90 rounded-2xl border ${color.bgLight.split(' ')[1]} ${color.darkBg.split(' ')[1]} p-4 md:p-5 shadow-sm hover:shadow-md transition">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div class="flex items-center gap-2 flex-wrap">
                        ${item.period ? `<span class="px-2 py-0.5 rounded-lg text-xs font-extrabold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">${escapeHtml(item.period)}</span>` : ''}
                        <span class="px-2.5 py-1 rounded-lg text-xs font-bold text-white ${color.badge}">
                          ${escapeHtml(item.startTime)} - ${escapeHtml(item.endTime)}
                        </span>
                        ${item.subjectCode ? `<span class="px-2 py-0.5 rounded-md text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">${escapeHtml(item.subjectCode)}</span>` : ''}
                        ${item.classCode ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-100 dark:bg-slate-700 text-slate-500 font-medium">${escapeHtml(item.classCode)}</span>` : ''}
                        ${isOngoing ? `<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>Đang diễn ra</span>` : ''}
                        ${renderOnlineBadge(item.room)}
                        ${linked.count > 0 ? `
                          <button type="button" class="btn-linked-resources inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold border border-indigo-200 dark:border-slate-600 transition cursor-pointer" data-id="${item.id}" title="Xem ghi chú và sơ đồ liên quan">
                            ${linked.notes.length > 0 ? `<span>📝 ${linked.notes.length} ghi chú</span>` : ''}
                            ${linked.notes.length > 0 && linked.mindmaps.length > 0 ? `<span class="opacity-40">•</span>` : ''}
                            ${linked.mindmaps.length > 0 ? `<span>🧠 ${linked.mindmaps.length} sơ đồ</span>` : ''}
                          </button>
                        ` : ''}
                      </div>

                      <div class="flex items-center gap-1 self-end sm:self-auto">
                        <button data-action="edit" data-id="${item.id}" class="btn-edit-class p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 transition" title="Chỉnh sửa">
                          <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button data-action="delete" data-id="${item.id}" class="btn-delete-class p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 transition" title="Xóa">
                          <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                      </div>
                    </div>

                    <h4 class="text-lg font-bold text-slate-900 dark:text-white mb-2">
                      ${escapeHtml(item.subjectName)}
                    </h4>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 mb-3">
                      <div class="flex items-center gap-1.5">
                        <i data-lucide="map-pin" class="w-4 h-4 text-slate-400"></i>
                        <span>Phòng: <strong class="text-slate-800 dark:text-slate-100 font-mono">${escapeHtml(item.room || 'Chưa cập nhật')}</strong></span>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <i data-lucide="user" class="w-4 h-4 text-slate-400"></i>
                        <span>Giảng viên: <strong class="text-slate-800 dark:text-slate-100">${escapeHtml(item.lecturer || 'Chưa cập nhật')}</strong></span>
                      </div>
                    </div>

                    ${item.notes ? `
                      <div class="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                        <i data-lucide="info" class="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400"></i>
                        <span>${escapeHtml(item.notes)}</span>
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

/**
 * Render individual class card (used in Week Grid & Mobile list)
 */
function renderClassCard(item, currentVnDay, currentMinutes, isCompact = false) {
  const color = getColorById(item.color);
  const startMin = timeToMinutes(item.startTime);
  const endMin = timeToMinutes(item.endTime);
  const isToday = item.dayOfWeek === currentVnDay;
  const isOngoing = isToday && currentMinutes >= startMin && currentMinutes <= endMin;
  const isOnline = item.room === 'E-LEARNING' || item.room === 'MS-TEAMS';
  const linked = getLinkedItemsForClass(item);

  return `
    <div class="class-card group relative rounded-xl border ${color.bgLight} ${color.darkBg} p-3 shadow-xs hover:shadow-md transition-all duration-150 ${isOngoing ? 'ring-2 ring-emerald-400 dark:ring-emerald-500 animate-pulse-subtle' : ''}">
      ${isOngoing ? `
        <div class="absolute -top-2 right-2 px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[9px] font-bold shadow-xs flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
          Đang học
        </div>
      ` : ''}

      <!-- Top Row: Time, Period & Action Buttons -->
      <div class="flex items-center justify-between gap-1 mb-1.5">
        <div class="flex items-center gap-1 text-[11px] font-bold">
          ${item.period ? `<span class="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-black/10 dark:bg-white/20">${escapeHtml(item.period)}</span>` : ''}
          <span>${escapeHtml(item.startTime)} - ${escapeHtml(item.endTime)}</span>
        </div>

        <div class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button data-action="edit" data-id="${item.id}" class="btn-edit-class p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition" title="Sửa">
            <i data-lucide="edit-2" class="w-3 h-3"></i>
          </button>
          <button data-action="delete" data-id="${item.id}" class="btn-delete-class p-1 rounded hover:bg-rose-500 hover:text-white transition" title="Xóa">
            <i data-lucide="trash" class="w-3 h-3"></i>
          </button>
        </div>
      </div>

      <!-- Subject Title -->
      <div class="font-bold text-sm leading-tight text-slate-900 dark:text-white line-clamp-2 mb-1">
        ${escapeHtml(item.subjectName)}
      </div>

      <!-- Subject Code & Class Code Tags -->
      <div class="flex items-center gap-1 flex-wrap mb-1.5">
        ${item.subjectCode ? `
          <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-bold">
            ${escapeHtml(item.subjectCode)}
          </span>
        ` : ''}
        ${renderOnlineBadge(item.room, true)}
      </div>

      <!-- Details: Room & Lecturer -->
      <div class="space-y-0.5 text-[11px] opacity-90">
        <div class="flex items-center gap-1 truncate ${isOnline ? 'font-bold text-rose-600 dark:text-rose-400' : ''}" title="${escapeHtml(item.room)}">
          <i data-lucide="${isOnline ? 'wifi' : 'map-pin'}" class="w-3 h-3 flex-shrink-0 opacity-70"></i>
          <span class="truncate font-mono">${escapeHtml(item.room || 'Chưa có phòng')}</span>
        </div>
        <div class="flex items-center gap-1 truncate" title="${escapeHtml(item.lecturer)}">
          <i data-lucide="user" class="w-3 h-3 flex-shrink-0 opacity-70"></i>
          <span class="truncate">${escapeHtml(item.lecturer || 'Chưa có GV')}</span>
        </div>
      </div>

      <!-- Linked Notes & Mindmaps Badge -->
      ${linked.count > 0 ? `
        <div class="mt-2 pt-1.5 border-t border-black/10 dark:border-white/10 flex items-center justify-between">
          <button type="button" class="btn-linked-resources inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-50/90 dark:bg-slate-700/80 hover:bg-indigo-100 dark:hover:bg-slate-600 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold border border-indigo-200/80 dark:border-slate-600 transition shadow-2xs cursor-pointer" data-id="${item.id}" title="Xem ghi chú và sơ đồ liên quan">
            ${linked.notes.length > 0 ? `<span>📝 ${linked.notes.length}</span>` : ''}
            ${linked.notes.length > 0 && linked.mindmaps.length > 0 ? `<span class="opacity-40">•</span>` : ''}
            ${linked.mindmaps.length > 0 ? `<span>🧠 ${linked.mindmaps.length}</span>` : ''}
          </button>
        </div>
      ` : ''}

      ${item.notes && !isCompact ? `
        <div class="mt-2 pt-1.5 border-t border-black/10 dark:border-white/10 text-[10px] italic opacity-80 line-clamp-1">
          ${escapeHtml(item.notes)}
        </div>
      ` : ''}
    </div>
  `;
}

function renderOnlineBadge(room, compact = false) {
  if (room === 'E-LEARNING') {
    return `<span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>E-Learning</span>`;
  }
  if (room === 'MS-TEAMS') {
    return `<span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 flex items-center gap-1">MS Teams</span>`;
  }
  return '';
}

/**
 * Setup Event Listeners
 */
function setupScheduleEvents(container) {
  // Week tabs
  container.querySelectorAll('.btn-week-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentWeekNumber = parseInt(btn.getAttribute('data-week'), 10);
      renderSchedule();
    });
  });

  const btnAllWeeks = container.querySelector('#btn-week-all');
  if (btnAllWeeks) {
    btnAllWeeks.addEventListener('click', () => {
      currentWeekNumber = 'all';
      renderSchedule();
    });
  }

  // Switch view mode
  const btnWeek = container.querySelector('#btn-view-week');
  const btnDay = container.querySelector('#btn-view-day');

  if (btnWeek) {
    btnWeek.addEventListener('click', () => {
      currentViewMode = 'week';
      renderSchedule();
    });
  }

  if (btnDay) {
    btnDay.addEventListener('click', () => {
      currentViewMode = 'day';
      renderSchedule();
    });
  }

  // Filter subject
  const filterSelect = container.querySelector('#filter-subject');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      currentSubjectFilter = e.target.value;
      renderSchedule();
    });
  }

  // Add class button
  const btnAdd = container.querySelector('#btn-add-class');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      openScheduleFormModal();
    });
  }

  // Mobile day selector tabs
  container.querySelectorAll('.mobile-day-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSelectedDay = parseInt(btn.getAttribute('data-day'), 10);
      renderSchedule();
    });
  });

  // Day view tabs
  container.querySelectorAll('.day-view-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSelectedDay = parseInt(btn.getAttribute('data-day'), 10);
      renderSchedule();
    });
  });

  // Edit / Delete buttons (Delegation)
  container.querySelectorAll('.btn-edit-class').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const item = currentScheduleData.find(s => s.id === id);
      if (item) {
        openScheduleFormModal(item);
      }
    });
  });

  container.querySelectorAll('.btn-delete-class').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const item = currentScheduleData.find(s => s.id === id);
      if (!item) return;

      const confirmed = await confirmDialog({
        title: 'Xóa buổi học',
        message: `Bạn có chắc chắn muốn xóa môn "${item.subjectName}" (${getDayNameVietnamese(item.dayOfWeek)}, ${item.startTime} - ${item.endTime}) khỏi thời khóa biểu?`,
        confirmText: 'Xóa ngay'
      });

      if (confirmed) {
        await deleteItem('schedules', id);
        await loadSchedules();
        renderSchedule();
        showToast(`Đã xóa buổi học "${item.subjectName}"`, 'success');
      }
    });
  });

  // Linked resources modal
  container.querySelectorAll('.btn-linked-resources').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const item = currentScheduleData.find(s => s.id === id);
      if (!item) return;
      const linked = getLinkedItemsForClass(item);
      openLinkedResourcesModal(item, linked);
    });
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
      return;
    }

    if (e.key === 'ArrowLeft') {
      if (typeof currentWeekNumber === 'number' && currentWeekNumber > 1) {
        currentWeekNumber--;
        renderSchedule();
      }
    } else if (e.key === 'ArrowRight') {
      if (typeof currentWeekNumber === 'number' && currentWeekNumber < 16) {
        currentWeekNumber++;
        renderSchedule();
      }
    }
  });
}

/**
 * Open Modal to Add or Edit a Class
 */
export function openScheduleFormModal(editingItem = null) {
  const isEditing = Boolean(editingItem);
  const days = [2, 3, 4, 5, 6, 7, 8];

  const defaultDay = editingItem ? editingItem.dayOfWeek : currentSelectedDay;
  const defaultColor = editingItem ? editingItem.color : 'indigo';
  const defaultWeek = editingItem ? (editingItem.week || 1) : (currentWeekNumber === 'all' ? 1 : currentWeekNumber);

  const modalHtml = `
    <div class="p-6 overflow-y-auto max-h-[85vh]">
      <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <i data-lucide="${isEditing ? 'edit-2' : 'plus-circle'}" class="w-5 h-5"></i>
          </div>
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">
            ${isEditing ? 'Chỉnh sửa buổi học' : 'Thêm buổi học mới'}
          </h3>
        </div>
        <button id="modal-close-btn" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="form-schedule" class="space-y-4">
        <!-- Subject Name -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Tên môn học <span class="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="input-subject-name"
            required
            placeholder="VD: Kỹ thuật số"
            value="${escapeHtml(editingItem ? editingItem.subjectName : '')}"
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
          />
        </div>

        <!-- Subject Code & Class Code -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mã môn học
            </label>
            <input
              type="text"
              id="input-subject-code"
              placeholder="VD: 71ELEC30083"
              value="${escapeHtml(editingItem ? editingItem.subjectCode || '' : '')}"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mã lớp học
            </label>
            <input
              type="text"
              id="input-class-code"
              placeholder="VD: 261_71ELEC30083_01"
              value="${escapeHtml(editingItem ? editingItem.classCode || '' : '')}"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
            />
          </div>
        </div>

        <!-- Week & Day of Week -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tuần học (1 - 16)
            </label>
            <select
              id="select-week"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
            >
              ${Array.from({ length: 16 }, (_, i) => i + 1).map(w => `<option value="${w}" ${w === defaultWeek ? 'selected' : ''}>Tuần ${w}</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Thứ trong tuần <span class="text-rose-500">*</span>
            </label>
            <select
              id="select-day"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
            >
              ${days.map(d => `<option value="${d}" ${d === defaultDay ? 'selected' : ''}>${getDayNameVietnamese(d)}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Period & Time Range -->
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tiết học
            </label>
            <input
              type="text"
              id="input-period"
              placeholder="VD: Tiết 4-6"
              value="${escapeHtml(editingItem ? editingItem.period || '' : 'Tiết 4-6')}"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Giờ bắt đầu <span class="text-rose-500">*</span>
            </label>
            <input
              type="time"
              id="input-start-time"
              required
              value="${editingItem ? editingItem.startTime : '09:30'}"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Giờ kết thúc <span class="text-rose-500">*</span>
            </label>
            <input
              type="time"
              id="input-end-time"
              required
              value="${editingItem ? editingItem.endTime : '11:45'}"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>

        <!-- Room & Lecturer -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Phòng học (hoặc E-LEARNING / MS-TEAMS)
            </label>
            <input
              type="text"
              id="input-room"
              placeholder="VD: CS3.F.06.11"
              value="${escapeHtml(editingItem ? editingItem.room || '' : '')}"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Giảng viên
            </label>
            <input
              type="text"
              id="input-lecturer"
              placeholder="VD: Lê Nguyễn Hòa Bình"
              value="${escapeHtml(editingItem ? editingItem.lecturer || '' : '')}"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>

        <!-- Color Palette Picker -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Màu sắc đại diện
          </label>
          <div class="flex items-center gap-2.5 flex-wrap" id="color-picker-container">
            ${SUBJECT_COLORS.map(c => `
              <button
                type="button"
                data-color="${c.id}"
                class="btn-color-choice w-7 h-7 rounded-full flex items-center justify-center transition transform hover:scale-110 ${c.badge} ${c.id === defaultColor ? 'ring-3 ring-offset-2 ring-indigo-500' : ''}"
                title="${c.name}"
              >
                ${c.id === defaultColor ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="input-color" value="${defaultColor}" />
        </div>

        <!-- Notes -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Ghi chú thêm
          </label>
          <textarea
            id="input-notes"
            rows="2"
            placeholder="Ghi chú bài học, link phòng học trực tuyến..."
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 transition"
          >${escapeHtml(editingItem ? editingItem.notes || '' : '')}</textarea>
        </div>

        <!-- Form Action Buttons -->
        <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            id="btn-cancel-modal"
            class="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Hủy
          </button>
          <button
            type="submit"
            class="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white transition shadow-sm"
          >
            ${isEditing ? 'Lưu thay đổi' : 'Thêm vào lịch'}
          </button>
        </div>
      </form>
    </div>
  `;

  const modal = openModal(modalHtml, { size: 'max-w-md' });
  const wrapper = modal.wrapper;

  // Close button
  wrapper.querySelector('#modal-close-btn').addEventListener('click', () => modal.close());
  wrapper.querySelector('#btn-cancel-modal').addEventListener('click', () => modal.close());

  // Color picker handling
  const colorInput = wrapper.querySelector('#input-color');
  wrapper.querySelectorAll('.btn-color-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedColorId = btn.getAttribute('data-color');
      colorInput.value = selectedColorId;

      wrapper.querySelectorAll('.btn-color-choice').forEach(b => {
        b.classList.remove('ring-3', 'ring-offset-2', 'ring-indigo-500');
        b.innerHTML = '';
      });

      btn.classList.add('ring-3', 'ring-offset-2', 'ring-indigo-500');
      btn.innerHTML = '<i data-lucide="check" class="w-4 h-4 text-white"></i>';
      if (window.lucide) {
        window.lucide.createIcons({ root: btn });
      }
    });
  });

  // Form Submit
  const form = wrapper.querySelector('#form-schedule');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const subjectName = wrapper.querySelector('#input-subject-name').value.trim();
    const subjectCode = wrapper.querySelector('#input-subject-code').value.trim();
    const classCode = wrapper.querySelector('#input-class-code').value.trim();
    const week = parseInt(wrapper.querySelector('#select-week').value, 10);
    const dayOfWeek = parseInt(wrapper.querySelector('#select-day').value, 10);
    const period = wrapper.querySelector('#input-period').value.trim();
    const startTime = wrapper.querySelector('#input-start-time').value;
    const endTime = wrapper.querySelector('#input-end-time').value;
    const room = wrapper.querySelector('#input-room').value.trim();
    const lecturer = wrapper.querySelector('#input-lecturer').value.trim();
    const color = colorInput.value;
    const notes = wrapper.querySelector('#input-notes').value.trim();

    if (!subjectName || !startTime || !endTime) {
      showToast('Vui lòng điền đầy đủ các thông tin bắt buộc!', 'warning');
      return;
    }

    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      showToast('Giờ bắt đầu phải trước giờ kết thúc!', 'error');
      return;
    }

    // Check conflict with other classes on the same day and week
    const conflicts = currentScheduleData.filter(s => {
      if (editingItem && s.id === editingItem.id) return false;
      if (s.week !== week || s.dayOfWeek !== dayOfWeek) return false;
      return isTimeOverlapping(startTime, endTime, s.startTime, s.endTime);
    });

    if (conflicts.length > 0) {
      const conflictSubject = conflicts[0];
      const proceed = await confirmDialog({
        title: 'Cảnh báo trùng lịch học!',
        message: `Môn "${subjectName}" bị trùng giờ với môn "${conflictSubject.subjectName}" (${conflictSubject.startTime} - ${conflictSubject.endTime}) ở Tuần ${week}. Bạn vẫn muốn lưu lịch này?`,
        confirmText: 'Vẫn lưu',
        confirmColor: 'bg-amber-600 hover:bg-amber-700 text-white'
      });

      if (!proceed) return;
    }

    const itemToSave = {
      id: editingItem ? editingItem.id : generateId(),
      week,
      subjectName,
      subjectCode,
      classCode,
      dayOfWeek,
      period,
      startTime,
      endTime,
      room,
      lecturer,
      color,
      notes
    };

    await saveItem('schedules', itemToSave);
    await loadSchedules();
    renderSchedule();
    modal.close();

    showToast(isEditing ? `Đã cập nhật môn "${subjectName}"` : `Đã thêm môn "${subjectName}" thành công!`, 'success');
  });

  if (window.lucide) {
    window.lucide.createIcons({ root: wrapper });
  }
}

/**
 * Open Modal to view linked notes & mindmaps for a class
 */
export function openLinkedResourcesModal(item, linked) {
  const content = `
    <div class="space-y-4">
      <div class="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between">
        <div>
          <span class="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">${escapeHtml(item.subjectCode || '')}</span>
          <h4 class="text-base font-bold text-slate-900 dark:text-white">${escapeHtml(item.subjectName)}</h4>
        </div>
        <span class="text-xs px-2.5 py-1 rounded-full bg-indigo-600 text-white font-semibold">${linked.count} tài liệu liên kết</span>
      </div>

      <!-- Notes Section -->
      <div>
        <h5 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
          <span>📝 Ghi chú bài học</span>
          <span class="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-mono">${linked.notes.length}</span>
        </h5>
        ${linked.notes.length === 0 ? `
          <p class="text-xs text-slate-400 italic py-2">Chưa có ghi chú nào liên kết với môn này.</p>
        ` : `
          <div class="space-y-2 max-h-48 overflow-y-auto">
            ${linked.notes.map(n => `
              <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 hover:border-indigo-300 transition">
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">${escapeHtml(n.title)}</div>
                  <div class="text-[10px] text-slate-400 truncate">${formatDateVietnamese(n.updatedAt || n.createdAt)}</div>
                </div>
                <button class="btn-open-linked-note px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shrink-0" data-note-id="${n.id}">
                  Mở xem
                </button>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Mindmaps Section -->
      <div>
        <h5 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
          <span>🧠 Sơ đồ tư duy</span>
          <span class="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-mono">${linked.mindmaps.length}</span>
        </h5>
        ${linked.mindmaps.length === 0 ? `
          <p class="text-xs text-slate-400 italic py-2">Chưa có sơ đồ tư duy nào liên kết với môn này.</p>
        ` : `
          <div class="space-y-2 max-h-48 overflow-y-auto">
            ${linked.mindmaps.map(m => `
              <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 hover:border-indigo-300 transition">
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">${escapeHtml(m.title)}</div>
                  <div class="text-[10px] text-slate-400 truncate">${(m.nodes || []).length} nút khái niệm</div>
                </div>
                <button class="btn-open-linked-mindmap px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition shrink-0" data-mindmap-id="${m.id}">
                  Mở xem
                </button>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  const html = `
    <div class="p-6">
      <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
        <h3 class="text-base md:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <i data-lucide="folder-symlink" class="w-5 h-5 text-indigo-600"></i>
          <span>Tài liệu liên kết môn học</span>
        </h3>
        <button id="btn-close-linked-modal" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      ${content}
    </div>
  `;

  const modal = openModal(html, { size: 'max-w-lg' });
  const modalBody = modal ? modal.wrapper : null;
  if (modalBody) {
    const closeBtn = modalBody.querySelector('#btn-close-linked-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.close());

    modalBody.querySelectorAll('.btn-open-linked-note').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.close();
        if (window.studyHubApp && window.studyHubApp.switchView) {
          window.studyHubApp.switchView('notes');
        }
      });
    });

    modalBody.querySelectorAll('.btn-open-linked-mindmap').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.close();
        if (window.studyHubApp && window.studyHubApp.switchView) {
          window.studyHubApp.switchView('mindmap');
        }
      });
    });
  }
}

