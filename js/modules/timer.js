/**
 * Focus Timer Module (Module 10)
 * Pomodoro timer (25/5, 50/10, Custom), study session logging to IndexedDB,
 * and daily/weekly focus time metrics.
 */

import { getAll, getById, saveItem, softDeleteItem } from '../db.js';
import { showToast } from '../components/toast.js';
import { getColorById, escapeHtml } from '../utils/helpers.js';

let activeSubjectId = '';
let activeMode = '25_5'; // '25_5', '50_10', 'custom'
let customMinutes = 30;

let timerInterval = null;
let remainingSeconds = 25 * 60;
let totalSeconds = 25 * 60;
let isRunning = false;
let isPaused = false;
let isBreak = false;
let sessionStartTime = null;

let activeNavigateFn = null;

export async function initTimerModule(onNavigate) {
  activeNavigateFn = onNavigate;
  await renderTimer();
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatSeconds(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Format minutes to X giờ Y phút
 */
export function formatMinutesHuman(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return '0 phút';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins} phút`;
  if (mins === 0) return `${hours} giờ`;
  return `${hours} giờ ${mins} phút`;
}

/**
 * Main render function for Timer View
 */
export async function renderTimer() {
  const container = document.getElementById('timer-view');
  if (!container) return;

  const [allSubjects, allSessions] = await Promise.all([
    getAll('subjects'),
    getAll('studySessions')
  ]);

  const subjects = (allSubjects || []).filter(s => !s.deletedAt);
  const sessions = (allSessions || []).filter(s => !s.deletedAt);

  if (!activeSubjectId && subjects.length > 0) {
    activeSubjectId = subjects[0].id;
  }

  // Calculate focus stats
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = todayStart - 6 * 24 * 3600 * 1000;

  let todayMinutes = 0;
  let weekMinutes = 0;

  for (const s of sessions) {
    const started = new Date(s.startedAt || s.createdAt).getTime();
    const dur = Number(s.duration) || 0;
    if (started >= todayStart) {
      todayMinutes += dur;
    }
    if (started >= sevenDaysAgo) {
      weekMinutes += dur;
    }
  }

  // Recent sessions (sorted newest first)
  const recentSessions = [...sessions].sort((a, b) => {
    return new Date(b.startedAt || b.createdAt).getTime() - new Date(a.startedAt || a.createdAt).getTime();
  }).slice(0, 8);

  const selectedSub = subjects.find(s => s.id === activeSubjectId || s.code === activeSubjectId);
  const colorDef = getColorById(selectedSub?.color || 'indigo');

  container.innerHTML = `
    <!-- Header -->
    <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <i data-lucide="timer" class="w-6 h-6"></i>
          </span>
          <div>
            <h2 class="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Không gian Tập trung (Focus Timer)</h2>
            <p class="text-xs md:text-sm text-slate-500 dark:text-slate-400">
              Phương pháp Pomodoro khoa học giúp tập trung sâu và ghi lại thời gian học
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Stat Metric Boxes (Hôm nay & Tuần này) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      <!-- Hôm nay -->
      <div class="p-5 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
          <i data-lucide="sun" class="w-6 h-6"></i>
        </div>
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Tập trung hôm nay</span>
          <div class="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
            ${formatMinutesHuman(todayMinutes)}
          </div>
        </div>
      </div>

      <!-- Tuần này -->
      <div class="p-5 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
          <i data-lucide="calendar" class="w-6 h-6"></i>
        </div>
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Tập trung 7 ngày qua</span>
          <div class="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
            ${formatMinutesHuman(weekMinutes)}
          </div>
        </div>
      </div>

      <!-- Tổng số phiên -->
      <div class="p-5 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 sm:col-span-2 lg:col-span-1">
        <div class="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
          <i data-lucide="check-circle" class="w-6 h-6"></i>
        </div>
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Tổng phiên đã hoàn thành</span>
          <div class="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
            ${sessions.length} phiên
          </div>
        </div>
      </div>
    </div>

    <!-- Timer Control Center -->
    <div class="max-w-2xl mx-auto bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200 dark:border-slate-700/80 p-6 sm:p-10 shadow-lg text-center space-y-6">
      <!-- Mode Selection Pills -->
      <div class="inline-flex p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 gap-1 text-xs font-bold">
        <button data-mode="25_5" class="timer-mode-btn px-4 py-2 rounded-xl transition ${activeMode === '25_5' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}">
          Pomodoro (25/5)
        </button>
        <button data-mode="50_10" class="timer-mode-btn px-4 py-2 rounded-xl transition ${activeMode === '50_10' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}">
          Học sâu (50/10)
        </button>
        <button data-mode="custom" class="timer-mode-btn px-4 py-2 rounded-xl transition ${activeMode === 'custom' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}">
          Tùy chỉnh
        </button>
      </div>

      <!-- Subject Selector -->
      <div class="max-w-xs mx-auto">
        <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Môn học đang tập trung</label>
        <select id="select-timer-subject" class="w-full px-3.5 py-2 text-xs md:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500">
          ${subjects.map(s => `
            <option value="${s.id}" ${s.id === activeSubjectId ? 'selected' : ''}>${escapeHtml(s.name)} (${escapeHtml(s.code)})</option>
          `).join('')}
        </select>
      </div>

      <!-- Custom duration input (if custom mode) -->
      ${activeMode === 'custom' && !isRunning ? `
        <div class="flex items-center justify-center gap-2 text-xs">
          <span class="text-slate-500">Thời gian:</span>
          <input
            type="number"
            id="input-custom-minutes"
            min="1"
            max="180"
            value="${customMinutes}"
            class="w-20 px-2.5 py-1 text-center font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
          />
          <span class="text-slate-500">phút</span>
        </div>
      ` : ''}

      <!-- Timer Display Circle / Numbers -->
      <div class="py-4">
        <div class="inline-flex flex-col items-center justify-center w-56 h-56 sm:w-64 sm:h-64 rounded-full border-4 ${isBreak ? 'border-emerald-500 bg-emerald-50/20' : 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20'} relative shadow-inner">
          <span class="text-xs uppercase font-extrabold tracking-widest ${isBreak ? 'text-emerald-500' : 'text-indigo-600 dark:text-indigo-400'} mb-1">
            ${isBreak ? '☕ Giờ nghỉ ngơi' : isRunning ? '🎯 Đang tập trung' : 'Sẵn sàng'}
          </span>
          <span id="timer-digits" class="text-5xl sm:text-6xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
            ${formatSeconds(remainingSeconds)}
          </span>
          <span class="text-xs text-slate-400 mt-2 font-medium">
            ${selectedSub ? escapeHtml(selectedSub.name) : 'Học tập'}
          </span>
        </div>
      </div>

      <!-- Controls Buttons (Start, Pause, Resume, Reset) -->
      <div class="flex items-center justify-center gap-3 pt-2">
        ${!isRunning ? `
          <button id="btn-timer-start" class="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-lg shadow-indigo-500/25 transition transform active:scale-95 flex items-center gap-2">
            <i data-lucide="play" class="w-4 h-4 fill-white"></i>
            <span>Bắt đầu phiên</span>
          </button>
        ` : isPaused ? `
          <button id="btn-timer-resume" class="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition flex items-center gap-2">
            <i data-lucide="play" class="w-4 h-4 fill-white"></i>
            <span>Tiếp tục</span>
          </button>
          <button id="btn-timer-reset" class="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-sm transition flex items-center gap-2">
            <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
            <span>Đặt lại</span>
          </button>
        ` : `
          <button id="btn-timer-pause" class="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition flex items-center gap-2">
            <i data-lucide="pause" class="w-4 h-4 fill-white"></i>
            <span>Tạm dừng</span>
          </button>
          <button id="btn-timer-finish" class="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition flex items-center gap-2" title="Hoàn thành và lưu">
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Lưu phiên</span>
          </button>
          <button id="btn-timer-reset" class="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-sm transition" title="Hủy bỏ">
            <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
          </button>
        `}
      </div>
    </div>

    <!-- Recent Study Sessions Log -->
    <div class="max-w-2xl mx-auto mt-8 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <i data-lucide="history" class="w-4 h-4 text-indigo-500"></i>
          <span>Lịch sử các phiên học gần nhất</span>
        </h3>
        <span class="text-xs text-slate-400">${sessions.length} phiên</span>
      </div>

      ${recentSessions.length === 0 ? `
        <p class="text-xs text-slate-400 text-center py-4">Chưa có phiên học nào được ghi lại. Hãy bắt đầu phiên học đầu tiên!</p>
      ` : `
        <div class="divide-y divide-slate-100 dark:divide-slate-700/60">
          ${recentSessions.map(sess => {
            const sub = subjects.find(s => s.id === sess.subjectId || s.code === sess.subjectId);
            const dateStr = new Date(sess.startedAt || sess.createdAt).toLocaleDateString('vi-VN');
            const timeStr = new Date(sess.startedAt || sess.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

            return `
              <div class="py-2.5 flex items-center justify-between text-xs" data-session-id="${sess.id}">
                <div class="flex items-center gap-2.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(sub?.name || 'Môn học')}</span>
                  <span class="text-slate-400">• ${dateStr} (${timeStr})</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="font-mono font-extrabold text-indigo-600 dark:text-indigo-400">${sess.duration} phút</span>
                  <button type="button" class="text-slate-400 hover:text-rose-500 transition btn-delete-session" title="Xóa phiên học">
                    <i data-lucide="trash" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ root: container });

  // Event Listeners:
  // 1. Mode Buttons
  container.querySelectorAll('.timer-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (isRunning) return;
      activeMode = btn.getAttribute('data-mode');
      if (activeMode === '25_5') {
        totalSeconds = 25 * 60;
        remainingSeconds = totalSeconds;
      } else if (activeMode === '50_10') {
        totalSeconds = 50 * 60;
        remainingSeconds = totalSeconds;
      } else {
        totalSeconds = customMinutes * 60;
        remainingSeconds = totalSeconds;
      }
      isBreak = false;
      renderTimer();
    });
  });

  // 2. Custom minutes input
  container.querySelector('#input-custom-minutes')?.addEventListener('change', (e) => {
    customMinutes = Math.max(1, Math.min(180, parseInt(e.target.value, 10) || 30));
    totalSeconds = customMinutes * 60;
    remainingSeconds = totalSeconds;
    const digits = document.getElementById('timer-digits');
    if (digits) digits.textContent = formatSeconds(remainingSeconds);
  });

  // 3. Subject select
  container.querySelector('#select-timer-subject')?.addEventListener('change', (e) => {
    activeSubjectId = e.target.value;
  });

  // 4. Start
  container.querySelector('#btn-timer-start')?.addEventListener('click', () => {
    isRunning = true;
    isPaused = false;
    sessionStartTime = new Date().toISOString();
    startCountdown();
    renderTimer();
  });

  // 5. Pause
  container.querySelector('#btn-timer-pause')?.addEventListener('click', () => {
    isPaused = true;
    if (timerInterval) clearInterval(timerInterval);
    renderTimer();
  });

  // 6. Resume
  container.querySelector('#btn-timer-resume')?.addEventListener('click', () => {
    isPaused = false;
    startCountdown();
    renderTimer();
  });

  // 7. Finish session & Save to IndexedDB
  container.querySelector('#btn-timer-finish')?.addEventListener('click', async () => {
    await completeStudySession();
  });

  // 8. Reset
  container.querySelector('#btn-timer-reset')?.addEventListener('click', () => {
    if (timerInterval) clearInterval(timerInterval);
    isRunning = false;
    isPaused = false;
    isBreak = false;
    if (activeMode === '25_5') remainingSeconds = 25 * 60;
    else if (activeMode === '50_10') remainingSeconds = 50 * 60;
    else remainingSeconds = customMinutes * 60;
    renderTimer();
  });

  // 9. Delete session
  container.querySelectorAll('.btn-delete-session').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const row = btn.closest('[data-session-id]');
      const sessId = row?.getAttribute('data-session-id');
      if (sessId) {
        await softDeleteItem('studySessions', sessId);
        showToast('Đã xóa phiên học', 'info');
        renderTimer();
      }
    });
  });
}

function startCountdown() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(async () => {
    if (remainingSeconds > 0) {
      remainingSeconds--;
      const digits = document.getElementById('timer-digits');
      if (digits) digits.textContent = formatSeconds(remainingSeconds);
    } else {
      clearInterval(timerInterval);
      if (!isBreak) {
        // Study interval completed!
        await completeStudySession();
        // Trigger break time
        isBreak = true;
        const breakMins = activeMode === '50_10' ? 10 : 5;
        remainingSeconds = breakMins * 60;
        showToast(`Tuyệt vời! Bạn đã hoàn thành phiên tập trung. Hãy nghỉ ngơi ${breakMins} phút nhé!`, 'success', 8000);
        startCountdown();
        renderTimer();
      } else {
        // Break interval completed
        isBreak = false;
        isRunning = false;
        showToast('Hết giờ nghỉ! Bạn đã sẵn sàng cho phiên tập trung tiếp theo?', 'info');
        renderTimer();
      }
    }
  }, 1000);
}

async function completeStudySession() {
  if (timerInterval) clearInterval(timerInterval);
  isRunning = false;
  isPaused = false;

  const elapsedSecs = totalSeconds - remainingSeconds;
  const elapsedMinutes = Math.max(1, Math.round(elapsedSecs / 60));

  const newSession = {
    id: `sess_${Date.now()}`,
    subjectId: activeSubjectId,
    duration: elapsedMinutes,
    type: activeMode,
    startedAt: sessionStartTime || new Date(Date.now() - elapsedSecs * 1000).toISOString(),
    endedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  await saveItem('studySessions', newSession);
  showToast(`Đã lưu phiên tập trung ${elapsedMinutes} phút! 👏`, 'success');
  renderTimer();
}
