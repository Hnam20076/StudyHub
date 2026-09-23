/**
 * Subjects Management Module (Module 6)
 * Central entity connecting Schedule, Notes, Mindmaps, Image Notes, Attachments, Tasks, Exams, Grades, Study Sessions.
 */

import { getAll, getById, saveItem, softDeleteItem } from '../db.js';
import { openModal, closeModal, confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { getColorById, escapeHtml } from '../utils/helpers.js';
import { renderAttachmentSection } from '../components/attachments.js';

let currentFilter = '';
let currentSearch = '';
let activeNavigateFn = null;

export async function initSubjectsModule(onNavigate) {
  activeNavigateFn = onNavigate;
  await renderSubjects();
}

/**
 * Main render function for Subjects View
 */
export async function renderSubjects() {
  const container = document.getElementById('subjects-view');
  if (!container) return;

  const [
    allSubjects,
    schedules,
    notes,
    mindmaps,
    imageNotes,
    tasks,
    exams,
    attachments,
    grades
  ] = await Promise.all([
    getAll('subjects'),
    getAll('schedules'),
    getAll('notes'),
    getAll('mindmaps'),
    getAll('imageNotes'),
    getAll('tasks'),
    getAll('exams'),
    getAll('attachments'),
    getAll('grades')
  ]);

  const subjects = (allSubjects || []).filter(s => !s.deletedAt);
  const activeSchedules = (schedules || []).filter(s => !s.deletedAt);
  const activeNotes = (notes || []).filter(n => !n.deletedAt);
  const activeMindmaps = (mindmaps || []).filter(m => !m.deletedAt);
  const activeImageNotes = (imageNotes || []).filter(i => !i.deletedAt);
  const activeTasks = (tasks || []).filter(t => !t.deletedAt);
  const activeExams = (exams || []).filter(e => !e.deletedAt);

  // Calculate totals
  const totalCredits = subjects.reduce((sum, s) => sum + (Number(s.credits) || 0), 0);

  // Filter subjects by search keyword
  const filteredSubjects = subjects.filter(s => {
    if (!currentSearch) return true;
    const q = currentSearch.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.code && s.code.toLowerCase().includes(q)) ||
      (s.lecturer && s.lecturer.toLowerCase().includes(q))
    );
  });

  container.innerHTML = `
    <!-- Header & Controls -->
    <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <i data-lucide="book-open" class="w-6 h-6"></i>
          </span>
          <div>
            <h2 class="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Quản lý Môn học</h2>
            <p class="text-xs md:text-sm text-slate-500 dark:text-slate-400">
              Tổng hợp <strong>${subjects.length}</strong> môn học • <strong>${totalCredits}</strong> tín chỉ học kỳ 1
            </p>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Search box -->
        <div class="relative flex-1 sm:w-64">
          <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
          <input
            type="text"
            id="search-subject-input"
            value="${escapeHtml(currentSearch)}"
            placeholder="Tìm theo tên, mã môn, GV..."
            class="w-full pl-9 pr-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <!-- Add Subject Button -->
        <button
          id="btn-add-subject"
          class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs md:text-sm font-bold shadow-md shadow-indigo-500/20 transition cursor-pointer"
        >
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>Thêm môn học</span>
        </button>
      </div>
    </div>

    <!-- Subjects Grid -->
    ${filteredSubjects.length === 0 ? `
      <div class="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-12 text-center">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mb-3">
          <i data-lucide="book-open" class="w-6 h-6"></i>
        </div>
        <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">Không tìm thấy môn học nào</h3>
        <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Thử tìm kiếm với từ khóa khác hoặc bấm nút "Thêm môn học" ở trên để tạo môn mới.</p>
      </div>
    ` : `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        ${filteredSubjects.map(sub => {
          const colorDef = getColorById(sub.color || 'indigo');
          
          // Compute metric counts
          const subNotes = activeNotes.filter(n => n.subjectId === sub.id || n.subjectId === sub.code);
          const subMindmaps = activeMindmaps.filter(m => m.subjectId === sub.id || m.subjectId === sub.code);
          const subTasks = activeTasks.filter(t => t.subjectId === sub.id || t.subjectId === sub.code);
          const completedTasks = subTasks.filter(t => t.status === 'completed');
          const taskProgress = subTasks.length > 0 ? Math.round((completedTasks.length / subTasks.length) * 100) : 0;
          const subAtts = (attachments || []).filter(a => a.entityType === 'subject' && (a.entityId === sub.id || a.entityId === sub.code));
          const subExams = activeExams.filter(e => e.subjectId === sub.id || e.subjectId === sub.code);
          
          // Grade status
          const subGrade = (grades || []).find(g => (g.subjectId === sub.id || g.subjectId === sub.code) && !g.deletedAt);
          const gradeScore = subGrade?.finalScore4 != null ? `${subGrade.finalScore4.toFixed(1)}/4.0` : (subGrade?.finalScore10 != null ? `${subGrade.finalScore10.toFixed(1)}/10` : null);

          return `
            <div class="group bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col" data-subject-id="${sub.id}">
              <!-- Top Banner with Subject Color -->
              <div class="p-4 border-b border-slate-100 dark:border-slate-700/60 flex items-start justify-between gap-3 ${colorDef.bg}">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1 flex-wrap">
                    <span class="px-2 py-0.5 text-[11px] font-mono font-bold rounded-md bg-white/80 dark:bg-slate-900/80 ${colorDef.text} border ${colorDef.border}">
                      ${escapeHtml(sub.code)}
                    </span>
                    <span class="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-white/60 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300">
                      ${sub.credits || 0} Tín chỉ
                    </span>
                    ${gradeScore ? `
                      <span class="px-2 py-0.5 text-[11px] font-bold rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        GPA ${gradeScore}
                      </span>
                    ` : ''}
                  </div>
                  <h3 class="text-base font-extrabold text-slate-900 dark:text-white truncate cursor-pointer hover:underline btn-view-detail" title="${escapeHtml(sub.name)}">
                    ${escapeHtml(sub.name)}
                  </h3>
                </div>

                <div class="flex items-center gap-1 flex-shrink-0">
                  <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white/80 dark:hover:bg-slate-700 transition btn-edit-subject" title="Chỉnh sửa môn học">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                  </button>
                  <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-white/80 dark:hover:bg-slate-700 transition btn-delete-subject" title="Xóa môn học">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>

              <!-- Body Content -->
              <div class="p-4 flex-1 flex flex-col justify-between gap-3.5">
                <!-- Lecturer & Description -->
                <div class="space-y-1.5">
                  <div class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <i data-lucide="user" class="w-3.5 h-3.5 text-slate-400"></i>
                    <span>GV: <strong class="text-slate-800 dark:text-slate-200">${escapeHtml(sub.lecturer || 'Chưa cập nhật')}</strong></span>
                  </div>
                  ${sub.description ? `
                    <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">${escapeHtml(sub.description)}</p>
                  ` : ''}
                </div>

                <!-- Progress Bar -->
                <div>
                  <div class="flex items-center justify-between text-xs mb-1">
                    <span class="text-slate-500 dark:text-slate-400 font-medium">Tiến độ nhiệm vụ</span>
                    <span class="font-bold text-slate-700 dark:text-slate-200">${taskProgress}% (${completedTasks.length}/${subTasks.length})</span>
                  </div>
                  <div class="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300" style="width: ${taskProgress}%"></div>
                  </div>
                </div>

                <!-- Academic Entity Badges -->
                <div class="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-center">
                  <div class="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                    <div class="text-[11px] font-bold text-slate-700 dark:text-slate-200">${subNotes.length + subMindmaps.length}</div>
                    <div class="text-[9px] text-slate-400 flex items-center justify-center gap-0.5">
                      <i data-lucide="file-text" class="w-2.5 h-2.5 text-emerald-500"></i> Ghi chú
                    </div>
                  </div>
                  <div class="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                    <div class="text-[11px] font-bold text-slate-700 dark:text-slate-200">${subTasks.length}</div>
                    <div class="text-[9px] text-slate-400 flex items-center justify-center gap-0.5">
                      <i data-lucide="check-square" class="w-2.5 h-2.5 text-blue-500"></i> Task
                    </div>
                  </div>
                  <div class="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                    <div class="text-[11px] font-bold text-slate-700 dark:text-slate-200">${subExams.length}</div>
                    <div class="text-[9px] text-slate-400 flex items-center justify-center gap-0.5">
                      <i data-lucide="calendar-check" class="w-2.5 h-2.5 text-purple-500"></i> Thi
                    </div>
                  </div>
                  <div class="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                    <div class="text-[11px] font-bold text-slate-700 dark:text-slate-200">${subAtts.length}</div>
                    <div class="text-[9px] text-slate-400 flex items-center justify-center gap-0.5">
                      <i data-lucide="paperclip" class="w-2.5 h-2.5 text-amber-500"></i> Tệp
                    </div>
                  </div>
                </div>

                <!-- Footer Action -->
                <button
                  type="button"
                  class="w-full mt-1 py-2 px-3 rounded-xl bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition flex items-center justify-center gap-1.5 btn-view-detail"
                >
                  <span>Xem chi tiết môn học</span>
                  <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
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
  // 1. Search input
  const searchInput = container.querySelector('#search-subject-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim();
      renderSubjects();
    });
  }

  // 2. Add subject button
  const addBtn = container.querySelector('#btn-add-subject');
  if (addBtn) {
    addBtn.addEventListener('click', () => openSubjectFormModal());
  }

  // 3. Card click / View detail
  container.querySelectorAll('.btn-view-detail').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('[data-subject-id]');
      const subId = card?.getAttribute('data-subject-id');
      if (subId) openSubjectDetailModal(subId);
    });
  });

  // 4. Edit subject button
  container.querySelectorAll('.btn-edit-subject').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('[data-subject-id]');
      const subId = card?.getAttribute('data-subject-id');
      if (subId) openSubjectFormModal(subId);
    });
  });

  // 5. Delete subject button (Soft delete)
  container.querySelectorAll('.btn-delete-subject').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = btn.closest('[data-subject-id]');
      const subId = card?.getAttribute('data-subject-id');
      if (!subId) return;

      const sub = subjects.find(s => s.id === subId);
      if (!sub) return;

      const proceed = await confirmDialog({
        title: 'Chuyển môn học vào Thùng rác?',
        message: `Bạn có chắc muốn xóa môn "${sub.name}"? Dữ liệu sẽ được lưu trong thùng rác 30 ngày và có thể khôi phục bất cứ lúc nào.`,
        confirmText: 'Chuyển vào thùng rác',
        confirmVariant: 'danger'
      });

      if (proceed) {
        await softDeleteItem('subjects', subId);
        if (window.studyHubApp?.updateTrashBadgeCounts) {
          window.studyHubApp.updateTrashBadgeCounts();
        }
        showToast(`Đã chuyển môn "${sub.name}" vào thùng rác`, 'warning', 6000, {
          label: 'Hoàn tác',
          onClick: async () => {
            const { restoreItem } = await import('../db.js');
            await restoreItem('subjects', subId);
            if (window.studyHubApp?.updateTrashBadgeCounts) {
              window.studyHubApp.updateTrashBadgeCounts();
            }
            showToast(`Đã khôi phục môn "${sub.name}"`, 'success');
            renderSubjects();
          }
        });
        renderSubjects();
      }
    });
  });
}

/**
 * Subject Form Modal (Add / Edit)
 */
export async function openSubjectFormModal(subjectId = null) {
  const isEdit = Boolean(subjectId);
  let subject = null;
  if (isEdit) {
    subject = await getById('subjects', subjectId);
  }

  const colors = [
    { id: 'sky', label: 'Xanh dương' },
    { id: 'indigo', label: 'Chàm Indigo' },
    { id: 'purple', label: 'Tím mộng mơ' },
    { id: 'emerald', label: 'Xanh lục' },
    { id: 'amber', label: 'Hổ phách' },
    { id: 'rose', label: 'Hồng Rose' }
  ];

  const html = `
    <div class="p-6 max-w-lg w-full">
      <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <h3 class="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <i data-lucide="${isEdit ? 'edit-3' : 'plus-circle'}" class="w-5 h-5 text-indigo-600"></i>
          <span>${isEdit ? 'Chỉnh sửa Môn học' : 'Thêm Môn học Mới'}</span>
        </h3>
        <button id="btn-close-sub-modal" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="form-subject" class="mt-4 space-y-4">
        <!-- Mã môn & Tín chỉ -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mã môn học *</label>
            <input
              type="text"
              id="sub-code"
              required
              value="${escapeHtml(subject?.code || '')}"
              placeholder="VD: 71ELEC30083"
              class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Số tín chỉ *</label>
            <input
              type="number"
              id="sub-credits"
              min="1"
              max="15"
              required
              value="${subject?.credits ?? 3}"
              class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <!-- Tên môn học -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tên môn học *</label>
          <input
            type="text"
            id="sub-name"
            required
            value="${escapeHtml(subject?.name || '')}"
            placeholder="VD: Kỹ thuật số"
            class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <!-- Giảng viên & Mục tiêu -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Giảng viên</label>
            <input
              type="text"
              id="sub-lecturer"
              value="${escapeHtml(subject?.lecturer || '')}"
              placeholder="VD: ThS. Lê Nguyễn Hòa Bình"
              class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mục tiêu điểm số</label>
            <input
              type="text"
              id="sub-goals"
              value="${escapeHtml(subject?.goals || 'A')}"
              placeholder="VD: A hoặc 8.5"
              class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <!-- Màu nhận diện -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Màu nhận diện</label>
          <div class="flex items-center gap-2">
            ${colors.map(c => `
              <label class="cursor-pointer">
                <input type="radio" name="sub-color" value="${c.id}" ${(subject?.color || 'indigo') === c.id ? 'checked' : ''} class="sr-only peer" />
                <div class="w-8 h-8 rounded-xl border-2 peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-indigo-500 transition-all flex items-center justify-center ${getColorById(c.id).bg} ${getColorById(c.id).border}">
                  <span class="sr-only">${c.label}</span>
                </div>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Mô tả -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mô tả học phần</label>
          <textarea
            id="sub-desc"
            rows="3"
            placeholder="Nội dung tóm tắt, mục tiêu môn học..."
            class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
          >${escapeHtml(subject?.description || '')}</textarea>
        </div>

        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button type="button" id="btn-cancel-sub" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Hủy bỏ
          </button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition">
            ${isEdit ? 'Lưu thay đổi' : 'Tạo môn học'}
          </button>
        </div>
      </form>
    </div>
  `;

  openModal(html);
  if (window.lucide) window.lucide.createIcons();

  document.getElementById('btn-close-sub-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-sub')?.addEventListener('click', closeModal);

  document.getElementById('form-subject')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('sub-code').value.trim();
    const name = document.getElementById('sub-name').value.trim();
    const credits = parseInt(document.getElementById('sub-credits').value, 10) || 3;
    const lecturer = document.getElementById('sub-lecturer').value.trim();
    const goals = document.getElementById('sub-goals').value.trim();
    const description = document.getElementById('sub-desc').value.trim();
    const colorEl = document.querySelector('input[name="sub-color"]:checked');
    const color = colorEl ? colorEl.value : 'indigo';

    if (!code || !name) {
      showToast('Vui lòng điền đầy đủ mã môn và tên môn!', 'error');
      return;
    }

    const now = new Date().toISOString();
    const newSubject = {
      ...(subject || {}),
      id: isEdit ? subject.id : `sub_${code.replace(/[^a-zA-Z0-9]/g, '_')}`,
      code,
      name,
      credits,
      lecturer,
      goals,
      description,
      color,
      updatedAt: now,
      createdAt: isEdit ? subject.createdAt : now
    };

    await saveItem('subjects', newSubject);
    closeModal();
    showToast(isEdit ? `Đã cập nhật môn "${name}"` : `Đã thêm môn học "${name}"`, 'success');
    renderSubjects();
  });
}

/**
 * Subject Detail Modal (Overview, Tasks, Attachments, Notes, Mindmaps, Schedule, Exams)
 */
export async function openSubjectDetailModal(subjectId) {
  const subject = await getById('subjects', subjectId);
  if (!subject) return;

  const [
    allTasks,
    allNotes,
    allMindmaps,
    allSchedules,
    allExams,
    allGrades
  ] = await Promise.all([
    getAll('tasks'),
    getAll('notes'),
    getAll('mindmaps'),
    getAll('schedules'),
    getAll('exams'),
    getAll('grades')
  ]);

  const subTasks = (allTasks || []).filter(t => !t.deletedAt && (t.subjectId === subject.id || t.subjectId === subject.code));
  const subNotes = (allNotes || []).filter(n => !n.deletedAt && (n.subjectId === subject.id || n.subjectId === subject.code));
  const subMindmaps = (allMindmaps || []).filter(m => !m.deletedAt && (m.subjectId === subject.id || m.subjectId === subject.code));
  const subSchedules = (allSchedules || []).filter(s => !s.deletedAt && (s.subjectCode === subject.code || s.subjectId === subject.id));
  const subExams = (allExams || []).filter(e => !e.deletedAt && (e.subjectId === subject.id || e.subjectId === subject.code));
  const subGrade = (allGrades || []).find(g => !g.deletedAt && (g.subjectId === subject.id || g.subjectId === subject.code));

  const colorDef = getColorById(subject.color || 'indigo');

  const html = `
    <div class="max-w-2xl w-full flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="p-6 border-b border-slate-100 dark:border-slate-800 ${colorDef.bg} flex items-start justify-between">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2 py-0.5 text-xs font-mono font-bold rounded bg-white/80 dark:bg-slate-900/80 ${colorDef.text}">
              ${escapeHtml(subject.code)}
            </span>
            <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">
              ${subject.credits} Tín chỉ
            </span>
            ${subject.goals ? `
              <span class="px-2 py-0.5 text-xs font-bold rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                Mục tiêu: ${escapeHtml(subject.goals)}
              </span>
            ` : ''}
          </div>
          <h2 class="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
            ${escapeHtml(subject.name)}
          </h2>
          <p class="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Giảng viên: <strong>${escapeHtml(subject.lecturer || 'Chưa cập nhật')}</strong>
          </p>
        </div>

        <button id="btn-close-sub-detail" class="p-2 rounded-xl bg-white/80 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- Tab Navigation -->
      <div class="flex items-center border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50 dark:bg-slate-900/40 overflow-x-auto text-xs font-bold">
        <button class="sub-tab-btn px-4 py-3 border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400" data-tab="tab-overview">
          Tổng quan
        </button>
        <button class="sub-tab-btn px-4 py-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" data-tab="tab-tasks">
          Nhiệm vụ (${subTasks.length})
        </button>
        <button class="sub-tab-btn px-4 py-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" data-tab="tab-files">
          Tài liệu & Tệp
        </button>
        <button class="sub-tab-btn px-4 py-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" data-tab="tab-notes">
          Ghi chú & Sơ đồ (${subNotes.length + subMindmaps.length})
        </button>
        <button class="sub-tab-btn px-4 py-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" data-tab="tab-exams">
          Kỳ thi & Điểm số
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="p-6 overflow-y-auto flex-1 space-y-4">
        <!-- 1. Overview Tab -->
        <div id="tab-overview" class="sub-tab-content space-y-4">
          <div class="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl space-y-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400">Mô tả học phần</h4>
            <p class="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
              ${escapeHtml(subject.description || 'Chưa có thông tin mô tả chi tiết cho môn học này.')}
            </p>
          </div>

          <!-- Lịch học trong tuần -->
          <div>
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Lịch học trong tuần</h4>
            ${subSchedules.length > 0 ? `
              <div class="space-y-2">
                ${subSchedules.slice(0, 3).map(s => `
                  <div class="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-xs">
                    <div class="flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span class="font-bold text-slate-800 dark:text-slate-200">Thứ ${s.dayOfWeek} (${s.startTime} - ${s.endTime})</span>
                      <span class="text-slate-400">• ${escapeHtml(s.period || '')}</span>
                    </div>
                    <span class="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-mono font-semibold">
                      Phòng: ${escapeHtml(s.room || 'Chưa cập nhật')}
                    </span>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p class="text-xs text-slate-400">Chưa có lịch học định kỳ trong hệ thống.</p>
            `}
          </div>
        </div>

        <!-- 2. Tasks Tab -->
        <div id="tab-tasks" class="sub-tab-content hidden space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-bold text-slate-700 dark:text-slate-300">Nhiệm vụ của môn</h4>
            <button id="btn-quick-add-task-sub" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i> Thêm nhiệm vụ
            </button>
          </div>
          ${subTasks.length > 0 ? `
            <div class="space-y-2">
              ${subTasks.map(t => `
                <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex items-center justify-between gap-3 text-xs">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-2 h-2 rounded-full ${t.status === 'completed' ? 'bg-emerald-500' : t.status === 'overdue' ? 'bg-rose-500' : 'bg-blue-500'}"></span>
                    <span class="font-semibold text-slate-800 dark:text-slate-200 truncate ${t.status === 'completed' ? 'line-through text-slate-400' : ''}">${escapeHtml(t.title)}</span>
                  </div>
                  <span class="text-[11px] text-slate-400 font-mono flex-shrink-0">
                    Hạn: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : 'Không hạn'}
                  </span>
                </div>
              `).join('')}
            </div>
          ` : `
            <p class="text-center py-6 text-xs text-slate-400">Chưa có bài tập hay nhiệm vụ nào cho môn này.</p>
          `}
        </div>

        <!-- 3. Files & Attachments Tab -->
        <div id="tab-files" class="sub-tab-content hidden">
          <div id="sub-detail-attachments-container"></div>
        </div>

        <!-- 4. Notes & Mindmaps Tab -->
        <div id="tab-notes" class="sub-tab-content hidden space-y-4">
          <div>
            <h4 class="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Ghi chú (${subNotes.length})</h4>
            ${subNotes.length > 0 ? `
              <div class="space-y-1.5">
                ${subNotes.map(n => `
                  <div class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex items-center justify-between text-xs">
                    <span class="font-semibold text-slate-800 dark:text-slate-200 truncate">${escapeHtml(n.title)}</span>
                    <span class="text-[10px] text-slate-400">${new Date(n.updatedAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-xs text-slate-400">Chưa có ghi chú nào.</p>'}
          </div>

          <div>
            <h4 class="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Sơ đồ tư duy (${subMindmaps.length})</h4>
            ${subMindmaps.length > 0 ? `
              <div class="space-y-1.5">
                ${subMindmaps.map(m => `
                  <div class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex items-center justify-between text-xs">
                    <span class="font-semibold text-slate-800 dark:text-slate-200 truncate">${escapeHtml(m.title)}</span>
                    <span class="text-[10px] text-slate-400">${new Date(m.updatedAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-xs text-slate-400">Chưa có sơ đồ tư duy nào.</p>'}
          </div>
        </div>

        <!-- 5. Exams & Grades Tab -->
        <div id="tab-exams" class="sub-tab-content hidden space-y-4">
          <div>
            <h4 class="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Lịch thi</h4>
            ${subExams.length > 0 ? `
              <div class="space-y-2">
                ${subExams.map(ex => `
                  <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(ex.title)}</span>
                      <div class="text-[11px] text-slate-400 mt-0.5">Ngày thi: ${ex.date} (${ex.startTime} - ${ex.endTime}) • Phòng: ${escapeHtml(ex.location || 'Chưa xếp')}</div>
                    </div>
                    <span class="px-2 py-1 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-bold">
                      Trọng số ${ex.weight || 0}%
                    </span>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-xs text-slate-400">Chưa có lịch thi nào được tạo.</p>'}
          </div>

          <div>
            <h4 class="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Điểm thành phần</h4>
            ${subGrade && subGrade.components?.length > 0 ? `
              <div class="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                <table class="w-full text-left">
                  <thead class="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold">
                    <tr>
                      <th class="p-2.5">Thành phần</th>
                      <th class="p-2.5">Trọng số</th>
                      <th class="p-2.5 text-right">Điểm hệ 10</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    ${subGrade.components.map(c => `
                      <tr>
                        <td class="p-2.5 font-medium text-slate-800 dark:text-slate-200">${escapeHtml(c.name)}</td>
                        <td class="p-2.5 text-slate-500">${c.weight}%</td>
                        <td class="p-2.5 text-right font-bold ${c.score != null ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}">
                          ${c.score != null ? c.score : 'Chưa có'}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<p class="text-xs text-slate-400">Chưa nhập bảng điểm cho môn học này.</p>'}
          </div>
        </div>
      </div>
    </div>
  `;

  openModal(html);
  if (window.lucide) window.lucide.createIcons();

  document.getElementById('btn-close-sub-detail')?.addEventListener('click', closeModal);

  // Wire Attachment Section in Tab Files
  const attContainer = document.getElementById('sub-detail-attachments-container');
  if (attContainer) {
    renderAttachmentSection(attContainer, 'subject', subject.id, {
      canUpload: true,
      onChanged: () => renderSubjects()
    });
  }

  // Quick add task button inside subject modal
  document.getElementById('btn-quick-add-task-sub')?.addEventListener('click', async () => {
    closeModal();
    if (activeNavigateFn) activeNavigateFn('tasks');
    const { openTaskFormModal } = await import('./tasks.js');
    openTaskFormModal(null, subject.id);
  });

  // Tab switching logic
  const tabBtns = document.querySelectorAll('.sub-tab-btn');
  const tabContents = document.querySelectorAll('.sub-tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabBtns.forEach(b => {
        b.classList.remove('border-indigo-600', 'text-indigo-600', 'dark:text-indigo-400');
        b.classList.add('border-transparent', 'text-slate-500');
      });
      btn.classList.remove('border-transparent', 'text-slate-500');
      btn.classList.add('border-indigo-600', 'text-indigo-600', 'dark:text-indigo-400');

      tabContents.forEach(c => {
        if (c.id === targetId) {
          c.classList.remove('hidden');
        } else {
          c.classList.add('hidden');
        }
      });
    });
  });
}
