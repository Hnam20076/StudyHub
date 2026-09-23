/**
 * Exams Module (Module 8)
 * Manages Quiz, Midterm, Final, Practice, Presentation exams with nearest countdown, weights, and study materials.
 */

import { getAll, getById, saveItem, softDeleteItem } from '../db.js';
import { openModal, closeModal, confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { getColorById, escapeHtml } from '../utils/helpers.js';
import { renderAttachmentSection } from '../components/attachments.js';

let activeTypeFilter = 'all';
let activeSubjectFilter = 'all';
let countdownInterval = null;
let activeNavigateFn = null;

export async function initExamsModule(onNavigate) {
  activeNavigateFn = onNavigate;
  if (countdownInterval) clearInterval(countdownInterval);
  await renderExams();

  // 1-second live countdown ticker
  countdownInterval = setInterval(() => {
    updateCountdownClocks();
  }, 1000);
}

/**
 * Main render function for Exams View
 */
export async function renderExams() {
  const container = document.getElementById('exams-view');
  if (!container) return;

  const [allExams, allSubjects, allAttachments] = await Promise.all([
    getAll('exams'),
    getAll('subjects'),
    getAll('attachments')
  ]);

  const subjects = (allSubjects || []).filter(s => !s.deletedAt);
  const exams = (allExams || []).filter(e => !e.deletedAt);

  const now = new Date();
  const nowMs = now.getTime();

  // Find nearest upcoming exam
  const upcomingExams = exams
    .map(e => {
      const examDateStr = `${e.date}T${e.startTime || '00:00'}`;
      const examTime = new Date(examDateStr).getTime();
      return { ...e, examTime };
    })
    .filter(e => e.examTime >= nowMs)
    .sort((a, b) => a.examTime - b.examTime);

  const nearestExam = upcomingExams[0] || null;

  // Filter exams
  const filteredExams = exams.filter(e => {
    if (activeTypeFilter !== 'all' && e.type !== activeTypeFilter) return false;
    if (activeSubjectFilter !== 'all' && e.subjectId !== activeSubjectFilter && e.subjectCode !== activeSubjectFilter) return false;
    return true;
  });

  // Sort: upcoming exams first, then past exams
  filteredExams.sort((a, b) => {
    const timeA = new Date(`${a.date}T${a.startTime || '00:00'}`).getTime();
    const timeB = new Date(`${b.date}T${b.startTime || '00:00'}`).getTime();
    return timeA - timeB;
  });

  const typeLabels = {
    quiz: { label: 'Quiz', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    midterm: { label: 'Giữa kỳ', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    final: { label: 'Cuối kỳ', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
    practice: { label: 'Thực hành', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    presentation: { label: 'Thuyết trình', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' }
  };

  container.innerHTML = `
    <!-- Header -->
    <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <i data-lucide="calendar-check" class="w-6 h-6"></i>
          </span>
          <div>
            <h2 class="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Kỳ thi & Lịch kiểm tra</h2>
            <p class="text-xs md:text-sm text-slate-500 dark:text-slate-400">
              Đếm ngược ngày thi, phòng thi, trọng số và tài liệu ôn tập
            </p>
          </div>
        </div>
      </div>

      <!-- Add Exam Button -->
      <button
        id="btn-add-exam"
        class="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs md:text-sm font-bold shadow-md shadow-indigo-500/20 transition cursor-pointer"
      >
        <i data-lucide="plus" class="w-4 h-4"></i>
        <span>Thêm kỳ thi</span>
      </button>
    </div>

    <!-- Nearest Exam Countdown Banner (if any upcoming) -->
    ${nearestExam ? (() => {
      const sub = subjects.find(s => s.id === nearestExam.subjectId || s.code === nearestExam.subjectId);
      const diffMs = nearestExam.examTime - nowMs;
      const days = Math.floor(diffMs / (24 * 3600 * 1000));
      const hours = Math.floor((diffMs % (24 * 3600 * 1000)) / (3600 * 1000));
      const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
      const secs = Math.floor((diffMs % (60 * 1000)) / 1000);

      return `
        <div class="mb-6 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-indigo-500/15 relative overflow-hidden">
          <div class="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-white/10 blur-xl pointer-events-none"></div>

          <div class="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div class="space-y-2">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold">
                <i data-lucide="flame" class="w-3.5 h-3.5 text-amber-300"></i>
                Kỳ thi gần nhất sắp tới
              </span>
              <h3 class="text-2xl md:text-3xl font-black">${escapeHtml(nearestExam.title)}</h3>
              <div class="flex items-center gap-3 text-sm text-indigo-100 flex-wrap">
                <span>Môn: <strong>${escapeHtml(sub?.name || 'Môn học')}</strong></span>
                <span>•</span>
                <span>Ngày: <strong>${nearestExam.date}</strong> (${nearestExam.startTime} - ${nearestExam.endTime})</span>
                <span>•</span>
                <span>Phòng: <strong>${escapeHtml(nearestExam.location || 'Chưa cập nhật')}</strong></span>
                <span>•</span>
                <span class="px-2 py-0.5 rounded bg-white/20 font-bold">Trọng số: ${nearestExam.weight || 0}%</span>
              </div>
            </div>

            <!-- Live Countdown Timer Boxes -->
            <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0" id="nearest-exam-clock" data-exam-time="${nearestExam.examTime}">
              <div class="flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 backdrop-blur border border-white/20 text-center">
                <span class="text-xl sm:text-2xl font-black leading-none clock-days">${days}</span>
                <span class="text-[10px] sm:text-xs text-indigo-200 mt-1 uppercase font-semibold">Ngày</span>
              </div>
              <div class="flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 backdrop-blur border border-white/20 text-center">
                <span class="text-xl sm:text-2xl font-black leading-none clock-hours">${hours}</span>
                <span class="text-[10px] sm:text-xs text-indigo-200 mt-1 uppercase font-semibold">Giờ</span>
              </div>
              <div class="flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 backdrop-blur border border-white/20 text-center">
                <span class="text-xl sm:text-2xl font-black leading-none clock-mins">${mins}</span>
                <span class="text-[10px] sm:text-xs text-indigo-200 mt-1 uppercase font-semibold">Phút</span>
              </div>
              <div class="flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 backdrop-blur border border-white/20 text-center">
                <span class="text-xl sm:text-2xl font-black leading-none clock-secs text-amber-300">${secs}</span>
                <span class="text-[10px] sm:text-xs text-indigo-200 mt-1 uppercase font-semibold">Giây</span>
              </div>
            </div>
          </div>
        </div>
      `;
    })() : ''}

    <!-- Filters Toolbar -->
    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-3 md:p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
      <!-- Type Filter Tabs -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto text-xs font-bold">
        <button data-type="all" class="exam-type-tab px-3 py-1.5 rounded-xl transition ${activeTypeFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300'}">
          Tất cả (${exams.length})
        </button>
        <button data-type="midterm" class="exam-type-tab px-3 py-1.5 rounded-xl transition ${activeTypeFilter === 'midterm' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300'}">
          Giữa kỳ
        </button>
        <button data-type="final" class="exam-type-tab px-3 py-1.5 rounded-xl transition ${activeTypeFilter === 'final' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300'}">
          Cuối kỳ
        </button>
        <button data-type="quiz" class="exam-type-tab px-3 py-1.5 rounded-xl transition ${activeTypeFilter === 'quiz' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300'}">
          Quiz
        </button>
      </div>

      <!-- Subject Select Filter -->
      <select
        id="select-exam-subject"
        class="w-full sm:w-56 px-3 py-1.5 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
      >
        <option value="all">Tất cả môn học</option>
        ${subjects.map(s => `
          <option value="${s.id}" ${activeSubjectFilter === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>
        `).join('')}
      </select>
    </div>

    <!-- Exam Cards Grid -->
    ${filteredExams.length === 0 ? `
      <div class="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-12 text-center">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-500 flex items-center justify-center mb-3">
          <i data-lucide="calendar-check" class="w-6 h-6"></i>
        </div>
        <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">Chưa có kỳ thi nào</h3>
        <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Bấm "+ Thêm kỳ thi" ở trên để ghi nhận lịch thi Quiz, giữa kỳ hoặc cuối kỳ.</p>
      </div>
    ` : `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${filteredExams.map(exam => {
          const sub = subjects.find(s => s.id === exam.subjectId || s.code === exam.subjectId);
          const colorDef = getColorById(sub?.color || 'indigo');
          const typeMeta = typeLabels[exam.type] || { label: 'Kỳ thi', color: 'bg-slate-100 text-slate-600' };

          const examDateStr = `${exam.date}T${exam.startTime || '00:00'}`;
          const examTime = new Date(examDateStr).getTime();
          const isPast = examTime < nowMs;

          let diffDays = Math.ceil((examTime - nowMs) / (24 * 3600 * 1000));
          let countdownText = isPast ? 'Đã diễn ra' : (diffDays === 0 ? 'Hôm nay thi!' : `Còn ${diffDays} ngày`);

          const examAtts = (allAttachments || []).filter(a => a.entityType === 'exam' && a.entityId === exam.id);

          return `
            <div class="group bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 ${isPast ? 'opacity-70' : ''}" data-exam-id="${exam.id}">
              <div class="space-y-3">
                <!-- Top row: Subject, Type, Actions -->
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-2 flex-wrap">
                    ${sub ? `
                      <span class="px-2 py-0.5 text-xs font-bold rounded ${colorDef.bg} ${colorDef.text} border ${colorDef.border}">
                        ${escapeHtml(sub.name)}
                      </span>
                    ` : ''}
                    <span class="px-2 py-0.5 text-xs font-bold rounded border ${typeMeta.color}">
                      ${typeMeta.label}
                    </span>
                    <span class="px-2 py-0.5 text-xs font-bold rounded bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                      Trọng số: ${exam.weight || 0}%
                    </span>
                  </div>

                  <div class="flex items-center gap-1 flex-shrink-0">
                    <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition btn-edit-exam" title="Chỉnh sửa kỳ thi">
                      <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition btn-delete-exam" title="Xóa kỳ thi">
                      <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                  </div>
                </div>

                <!-- Exam Title -->
                <h3 class="text-base font-extrabold text-slate-900 dark:text-white cursor-pointer hover:text-indigo-600 transition btn-edit-exam">
                  ${escapeHtml(exam.title)}
                </h3>

                <!-- Date & Room Info -->
                <div class="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <div class="flex items-center gap-2">
                    <i data-lucide="calendar" class="w-4 h-4 text-indigo-500"></i>
                    <span>Ngày: <strong>${exam.date}</strong> (${exam.startTime || '00:00'} - ${exam.endTime || '00:00'})</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <i data-lucide="map-pin" class="w-4 h-4 text-rose-500"></i>
                    <span>Phòng thi: <strong>${escapeHtml(exam.location || 'Chưa cập nhật')}</strong></span>
                  </div>
                </div>

                <!-- Description / Scope -->
                ${exam.description ? `
                  <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl">
                    ${escapeHtml(exam.description)}
                  </p>
                ` : ''}
              </div>

              <!-- Footer: Countdown & Attachments count -->
              <div class="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span class="font-extrabold ${isPast ? 'text-slate-400' : 'text-purple-600 dark:text-purple-400'} flex items-center gap-1.5">
                  <i data-lucide="clock" class="w-3.5 h-3.5"></i>
                  <span>${countdownText}</span>
                </span>

                <button type="button" class="flex items-center gap-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition font-semibold btn-edit-exam">
                  <i data-lucide="paperclip" class="w-3.5 h-3.5 text-indigo-500"></i>
                  <span>${examAtts.length} đề cương/tệp</span>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  if (window.lucide) window.lucide.createIcons({ root: container });

  // Event Listeners
  // 1. Type Tabs
  container.querySelectorAll('.exam-type-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTypeFilter = tab.getAttribute('data-type');
      renderExams();
    });
  });

  // 2. Subject select
  container.querySelector('#select-exam-subject')?.addEventListener('change', (e) => {
    activeSubjectFilter = e.target.value;
    renderExams();
  });

  // 3. Add exam button
  container.querySelector('#btn-add-exam')?.addEventListener('click', () => openExamFormModal());

  // 4. Edit exam
  container.querySelectorAll('.btn-edit-exam').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('[data-exam-id]');
      const examId = card?.getAttribute('data-exam-id');
      if (examId) openExamFormModal(examId);
    });
  });

  // 5. Delete exam (Soft delete)
  container.querySelectorAll('.btn-delete-exam').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = btn.closest('[data-exam-id]');
      const examId = card?.getAttribute('data-exam-id');
      const exam = exams.find(ex => ex.id === examId);
      if (!exam) return;

      const proceed = await confirmDialog({
        title: 'Chuyển kỳ thi vào thùng rác?',
        message: `Bạn có chắc muốn xóa kỳ thi "${exam.title}" không? Có thể hoàn tác trong vòng 30 ngày.`,
        confirmText: 'Chuyển vào thùng rác',
        confirmVariant: 'danger'
      });

      if (proceed) {
        await softDeleteItem('exams', examId);
        if (window.studyHubApp?.updateTrashBadgeCounts) {
          window.studyHubApp.updateTrashBadgeCounts();
        }
        showToast(`Đã chuyển kỳ thi "${exam.title}" vào thùng rác`, 'warning', 6000, {
          label: 'Hoàn tác',
          onClick: async () => {
            const { restoreItem } = await import('../db.js');
            await restoreItem('exams', examId);
            if (window.studyHubApp?.updateTrashBadgeCounts) {
              window.studyHubApp.updateTrashBadgeCounts();
            }
            showToast(`Đã khôi phục kỳ thi "${exam.title}"`, 'success');
            renderExams();
          }
        });
        renderExams();
      }
    });
  });
}

function updateCountdownClocks() {
  const clock = document.getElementById('nearest-exam-clock');
  if (!clock) return;
  const examTime = parseInt(clock.getAttribute('data-exam-time'), 10);
  if (!examTime) return;

  const nowMs = Date.now();
  const diffMs = examTime - nowMs;
  if (diffMs <= 0) {
    clock.innerHTML = '<span class="text-lg font-bold text-amber-300">Đang diễn ra hoặc đã kết thúc!</span>';
    return;
  }

  const days = Math.floor(diffMs / (24 * 3600 * 1000));
  const hours = Math.floor((diffMs % (24 * 3600 * 1000)) / (3600 * 1000));
  const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
  const secs = Math.floor((diffMs % (60 * 1000)) / 1000);

  const dEl = clock.querySelector('.clock-days');
  const hEl = clock.querySelector('.clock-hours');
  const mEl = clock.querySelector('.clock-mins');
  const sEl = clock.querySelector('.clock-secs');

  if (dEl) dEl.textContent = days;
  if (hEl) hEl.textContent = hours;
  if (mEl) mEl.textContent = mins;
  if (sEl) sEl.textContent = secs;
}

/**
 * Exam Form Modal (Add / Edit + Study Materials Attachment)
 */
export async function openExamFormModal(examId = null) {
  const isEdit = Boolean(examId);
  let exam = null;
  if (isEdit) {
    exam = await getById('exams', examId);
  }

  const allSubjects = await getAll('subjects');
  const subjects = (allSubjects || []).filter(s => !s.deletedAt);
  const selectedSubId = exam?.subjectId || (subjects[0]?.id || '');
  const newExamId = isEdit ? exam.id : `exam_${Date.now()}`;

  const html = `
    <div class="p-6 max-w-xl w-full max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
        <h3 class="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <i data-lucide="${isEdit ? 'edit-3' : 'plus-circle'}" class="w-5 h-5 text-indigo-600"></i>
          <span>${isEdit ? 'Chỉnh sửa Kỳ thi' : 'Thêm Kỳ thi Mới'}</span>
        </h3>
        <button id="btn-close-exam-modal" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="form-exam" class="mt-4 space-y-4 overflow-y-auto flex-1 pr-1">
        <!-- Môn thi -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Môn thi *</label>
          <select id="exam-subject" required class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500">
            ${subjects.map(s => `
              <option value="${s.id}" ${s.id === selectedSubId ? 'selected' : ''}>${escapeHtml(s.name)} (${escapeHtml(s.code)})</option>
            `).join('')}
          </select>
        </div>

        <!-- Tiêu đề kỳ thi -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tiêu đề kỳ thi *</label>
          <input
            type="text"
            id="exam-title"
            required
            value="${escapeHtml(exam?.title || '')}"
            placeholder="VD: Kiểm tra giữa kỳ Hệ thống & Điều khiển"
            class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <!-- Loại kỳ thi & Trọng số % -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Loại kỳ thi</label>
            <select id="exam-type" class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500">
              <option value="quiz" ${(exam?.type || 'midterm') === 'quiz' ? 'selected' : ''}>Quiz / Kiểm tra 15p</option>
              <option value="midterm" ${(exam?.type || 'midterm') === 'midterm' ? 'selected' : ''}>Thi Giữa kỳ</option>
              <option value="final" ${(exam?.type || 'midterm') === 'final' ? 'selected' : ''}>Thi Cuối kỳ</option>
              <option value="practice" ${(exam?.type || 'midterm') === 'practice' ? 'selected' : ''}>Thi Thực hành</option>
              <option value="presentation" ${(exam?.type || 'midterm') === 'presentation' ? 'selected' : ''}>Báo cáo / Thuyết trình</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Trọng số vào điểm (%)</label>
            <input
              type="number"
              id="exam-weight"
              min="0"
              max="100"
              value="${exam?.weight ?? 20}"
              placeholder="VD: 20 hoặc 50"
              class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <!-- Ngày thi, Giờ bắt đầu, Giờ kết thúc -->
        <div class="grid grid-cols-3 gap-2.5">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Ngày thi *</label>
            <input
              type="date"
              id="exam-date"
              required
              value="${exam?.date || ''}"
              class="w-full px-2.5 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Bắt đầu</label>
            <input
              type="time"
              id="exam-start"
              value="${exam?.startTime || '07:30'}"
              class="w-full px-2 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Kết thúc</label>
            <input
              type="time"
              id="exam-end"
              value="${exam?.endTime || '09:30'}"
              class="w-full px-2 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <!-- Phòng thi / Địa điểm -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phòng thi / Địa điểm</label>
          <input
            type="text"
            id="exam-location"
            value="${escapeHtml(exam?.location || '')}"
            placeholder="VD: CS3.F.06.11"
            class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <!-- Phạm vi ôn tập / Ghi chú -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phạm vi ôn tập & Dặn dò</label>
          <textarea
            id="exam-desc"
            rows="3"
            placeholder="Nội dung chương 1 đến chương 3, được mang tài liệu giấy 1 tờ A4..."
            class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
          >${escapeHtml(exam?.description || '')}</textarea>
        </div>

        <!-- Đính kèm đề cương / tài liệu -->
        <div id="exam-modal-attachments-container" class="pt-2 border-t border-slate-100 dark:border-slate-800"></div>

        <!-- Footer -->
        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 flex-shrink-0">
          <button type="button" id="btn-cancel-exam" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Hủy bỏ
          </button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition">
            ${isEdit ? 'Lưu thay đổi' : 'Tạo kỳ thi'}
          </button>
        </div>
      </form>
    </div>
  `;

  openModal(html, { size: 'max-w-xl' });
  if (window.lucide) window.lucide.createIcons();

  document.getElementById('btn-close-exam-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-exam')?.addEventListener('click', closeModal);

  // Render Attachments for Exam
  const attBox = document.getElementById('exam-modal-attachments-container');
  if (attBox) {
    renderAttachmentSection(attBox, 'exam', newExamId, { canUpload: true });
  }

  // Form Submit
  document.getElementById('form-exam')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subjectId = document.getElementById('exam-subject').value;
    const title = document.getElementById('exam-title').value.trim();
    const type = document.getElementById('exam-type').value;
    const weight = parseInt(document.getElementById('exam-weight').value, 10) || 0;
    const date = document.getElementById('exam-date').value;
    const startTime = document.getElementById('exam-start').value;
    const endTime = document.getElementById('exam-end').value;
    const location = document.getElementById('exam-location').value.trim();
    const description = document.getElementById('exam-desc').value.trim();

    if (!title || !date) {
      showToast('Vui lòng nhập tiêu đề và ngày thi!', 'error');
      return;
    }

    const nowIso = new Date().toISOString();
    const newExam = {
      ...(exam || {}),
      id: newExamId,
      subjectId,
      title,
      type,
      weight,
      date,
      startTime,
      endTime,
      location,
      description,
      updatedAt: nowIso,
      createdAt: isEdit ? exam.createdAt : nowIso
    };

    await saveItem('exams', newExam);
    closeModal();
    showToast(isEdit ? 'Đã cập nhật kỳ thi' : 'Đã tạo lịch thi mới thành công', 'success');
    renderExams();
  });
}
