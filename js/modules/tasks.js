/**
 * Tasks & Deadlines Module (Module 7)
 * Handles assignments, projects, presentations, practice, with priorities, statuses, filters, and attachments.
 */

import { getAll, getById, saveItem, softDeleteItem } from '../db.js';
import { openModal, closeModal, confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { getColorById, escapeHtml } from '../utils/helpers.js';
import { renderAttachmentSection } from '../components/attachments.js';

let activeFilter = 'all'; // 'all', 'today', 'upcoming', 'overdue', 'completed'
let subjectFilter = 'all';
let priorityFilter = 'all';
let searchKeyword = '';
let activeNavigateFn = null;

export async function initTasksModule(onNavigate) {
  activeNavigateFn = onNavigate;
  await renderTasks();
}

/**
 * Main render function for Tasks View
 */
export async function renderTasks() {
  const container = document.getElementById('tasks-view');
  if (!container) return;

  const [allTasks, allSubjects, allAttachments] = await Promise.all([
    getAll('tasks'),
    getAll('subjects'),
    getAll('attachments')
  ]);

  const subjects = (allSubjects || []).filter(s => !s.deletedAt);
  const tasks = (allTasks || []).filter(t => !t.deletedAt);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;
  const sevenDaysLater = todayStart + 7 * 24 * 60 * 60 * 1000;

  // Auto update status to overdue if dueDate passed and not completed
  for (const t of tasks) {
    if (t.dueDate && t.status !== 'completed') {
      const dueTime = new Date(t.dueDate).getTime();
      if (dueTime < todayStart && t.status !== 'overdue') {
        t.status = 'overdue';
        await saveItem('tasks', t);
      }
    }
  }

  // Calculate task counts
  const totalCount = tasks.length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const overdueCount = tasks.filter(t => {
    if (t.status === 'completed') return false;
    if (t.status === 'overdue') return true;
    if (t.dueDate && new Date(t.dueDate).getTime() < todayStart) return true;
    return false;
  }).length;

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    // 1. Tab filter
    if (activeFilter === 'today') {
      if (!t.dueDate) return false;
      const dueTime = new Date(t.dueDate).getTime();
      if (dueTime < todayStart || dueTime > todayEnd) return false;
    } else if (activeFilter === 'upcoming') {
      if (!t.dueDate) return false;
      const dueTime = new Date(t.dueDate).getTime();
      if (dueTime < todayStart || dueTime > sevenDaysLater) return false;
      if (t.status === 'completed') return false;
    } else if (activeFilter === 'overdue') {
      if (t.status === 'completed') return false;
      if (t.status === 'overdue') return true;
      if (!t.dueDate) return false;
      if (new Date(t.dueDate).getTime() >= todayStart) return false;
    } else if (activeFilter === 'completed') {
      if (t.status !== 'completed') return false;
    }

    // 2. Subject filter
    if (subjectFilter !== 'all') {
      if (t.subjectId !== subjectFilter && t.subjectCode !== subjectFilter) return false;
    }

    // 3. Priority filter
    if (priorityFilter !== 'all') {
      if (t.priority !== priorityFilter) return false;
    }

    // 4. Keyword search
    if (searchKeyword) {
      const q = searchKeyword.toLowerCase();
      const matchTitle = t.title && t.title.toLowerCase().includes(q);
      const matchDesc = t.description && t.description.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }

    return true;
  });

  // Sort: Overdue & Urgent first, then by dueDate asc
  filteredTasks.sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
    const pDiff = (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1);
    if (pDiff !== 0) return pDiff;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  container.innerHTML = `
    <!-- Header -->
    <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <i data-lucide="check-square" class="w-6 h-6"></i>
          </span>
          <div>
            <h2 class="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Nhiệm vụ & Deadline</h2>
            <p class="text-xs md:text-sm text-slate-500 dark:text-slate-400">
              Quản lý bài tập, đồ án, báo cáo học tập với thời hạn thông minh
            </p>
          </div>
        </div>
      </div>

      <!-- Add Task Button -->
      <button
        id="btn-add-task"
        class="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs md:text-sm font-bold shadow-md shadow-indigo-500/20 transition cursor-pointer"
      >
        <i data-lucide="plus" class="w-4 h-4"></i>
        <span>Thêm nhiệm vụ</span>
      </button>
    </div>

    <!-- Stats Summary Row -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div class="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold">
          <i data-lucide="layers" class="w-5 h-5"></i>
        </div>
        <div>
          <div class="text-lg font-extrabold text-slate-900 dark:text-white">${totalCount}</div>
          <div class="text-xs text-slate-400">Tổng nhiệm vụ</div>
        </div>
      </div>

      <div class="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
          <i data-lucide="clock" class="w-5 h-5"></i>
        </div>
        <div>
          <div class="text-lg font-extrabold text-blue-600 dark:text-blue-400">${inProgressCount}</div>
          <div class="text-xs text-slate-400">Đang thực hiện</div>
        </div>
      </div>

      <div class="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
          <i data-lucide="alert-circle" class="w-5 h-5"></i>
        </div>
        <div>
          <div class="text-lg font-extrabold text-rose-600 dark:text-rose-400">${overdueCount}</div>
          <div class="text-xs text-slate-400">Quá hạn nộp</div>
        </div>
      </div>

      <div class="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
          <i data-lucide="check-circle-2" class="w-5 h-5"></i>
        </div>
        <div>
          <div class="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">${completedCount}</div>
          <div class="text-xs text-slate-400">Đã hoàn thành</div>
        </div>
      </div>
    </div>

    <!-- Filters & Search Toolbar -->
    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-3 md:p-4 mb-6 space-y-3">
      <!-- Tabs Filter -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold">
        <button data-filter="all" class="task-filter-tab px-3.5 py-1.5 rounded-xl transition ${activeFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}">
          Tất cả (${tasks.length})
        </button>
        <button data-filter="today" class="task-filter-tab px-3.5 py-1.5 rounded-xl transition ${activeFilter === 'today' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}">
          Hôm nay
        </button>
        <button data-filter="upcoming" class="task-filter-tab px-3.5 py-1.5 rounded-xl transition ${activeFilter === 'upcoming' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}">
          7 ngày tới
        </button>
        <button data-filter="overdue" class="task-filter-tab px-3.5 py-1.5 rounded-xl transition ${activeFilter === 'overdue' ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}">
          Quá hạn (${overdueCount})
        </button>
        <button data-filter="completed" class="task-filter-tab px-3.5 py-1.5 rounded-xl transition ${activeFilter === 'completed' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}">
          Hoàn thành (${completedCount})
        </button>
      </div>

      <!-- Dropdown Filters & Search -->
      <div class="flex flex-col sm:flex-row items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
        <!-- Search input -->
        <div class="relative flex-1 w-full">
          <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
          <input
            type="text"
            id="search-task-input"
            value="${escapeHtml(searchKeyword)}"
            placeholder="Tìm theo tiêu đề hoặc mô tả..."
            class="w-full pl-9 pr-3 py-1.5 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <!-- Subject Select -->
        <select
          id="select-filter-subject"
          class="w-full sm:w-48 px-3 py-1.5 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
        >
          <option value="all">Tất cả môn học</option>
          ${subjects.map(s => `
            <option value="${s.id}" ${subjectFilter === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>
          `).join('')}
        </select>

        <!-- Priority Select -->
        <select
          id="select-filter-priority"
          class="w-full sm:w-36 px-3 py-1.5 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200"
        >
          <option value="all">Mức ưu tiên</option>
          <option value="urgent" ${priorityFilter === 'urgent' ? 'selected' : ''}>Khẩn cấp</option>
          <option value="high" ${priorityFilter === 'high' ? 'selected' : ''}>Cao</option>
          <option value="medium" ${priorityFilter === 'medium' ? 'selected' : ''}>Trung bình</option>
          <option value="low" ${priorityFilter === 'low' ? 'selected' : ''}>Thấp</option>
        </select>
      </div>
    </div>

    <!-- Tasks List -->
    ${filteredTasks.length === 0 ? `
      <div class="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-12 text-center">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-500 flex items-center justify-center mb-3">
          <i data-lucide="check-square" class="w-6 h-6"></i>
        </div>
        <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">Không có nhiệm vụ nào trong mục này</h3>
        <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Bạn có thể tạo nhiệm vụ mới hoặc chuyển sang bộ lọc khác để kiểm tra.</p>
      </div>
    ` : `
      <div class="space-y-3">
        ${filteredTasks.map(task => {
          const sub = subjects.find(s => s.id === task.subjectId || s.code === task.subjectId);
          const colorDef = getColorById(sub?.color || 'indigo');
          const isDone = task.status === 'completed';

          // Due date calculation
          let dueLabel = 'Không có hạn';
          let dueColor = 'text-slate-400';
          if (task.dueDate) {
            const dueTime = new Date(task.dueDate).getTime();
            const diffDays = Math.ceil((dueTime - now.getTime()) / (24 * 60 * 60 * 1000));
            if (isDone) {
              dueLabel = `Hạn: ${new Date(task.dueDate).toLocaleDateString('vi-VN')}`;
              dueColor = 'text-slate-400';
            } else if (diffDays < 0) {
              dueLabel = `Quá hạn ${Math.abs(diffDays)} ngày`;
              dueColor = 'text-rose-600 font-bold';
            } else if (diffDays === 0) {
              dueLabel = 'Hạn hôm nay';
              dueColor = 'text-amber-600 font-bold';
            } else if (diffDays === 1) {
              dueLabel = 'Hạn ngày mai';
              dueColor = 'text-blue-600 font-bold';
            } else {
              dueLabel = `Còn ${diffDays} ngày (${new Date(task.dueDate).toLocaleDateString('vi-VN')})`;
              dueColor = 'text-slate-600 dark:text-slate-300';
            }
          }

          // Priority badge
          const priorityBadges = {
            urgent: '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-500/10 text-rose-600 border border-rose-500/20">Khẩn cấp</span>',
            high: '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/10 text-amber-600 border border-amber-500/20">Cao</span>',
            medium: '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">Trung bình</span>',
            low: '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-500/10 text-slate-600 border border-slate-500/20">Thấp</span>'
          };

          const taskAtts = (allAttachments || []).filter(a => a.entityType === 'task' && a.entityId === task.id);

          return `
            <div class="group bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm hover:shadow transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4 ${isDone ? 'opacity-70 bg-slate-50/60 dark:bg-slate-900/40' : ''}" data-task-id="${task.id}">
              <!-- Left: Checkbox & Info -->
              <div class="flex items-start gap-3 flex-1 min-w-0">
                <button type="button" class="mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition flex-shrink-0 btn-toggle-task ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500'}">
                  ${isDone ? '<i data-lucide="check" class="w-3.5 h-3.5 stroke-[3]"></i>' : ''}
                </button>

                <div class="min-w-0 flex-1 space-y-1">
                  <!-- Badges row -->
                  <div class="flex items-center gap-2 flex-wrap">
                    ${sub ? `
                      <span class="px-2 py-0.5 text-[10px] font-bold rounded ${colorDef.bg} ${colorDef.text} border ${colorDef.border}">
                        ${escapeHtml(sub.name)}
                      </span>
                    ` : ''}
                    ${priorityBadges[task.priority] || ''}
                    <span class="text-xs ${dueColor} flex items-center gap-1">
                      <i data-lucide="calendar" class="w-3 h-3"></i>
                      <span>${dueLabel}</span>
                    </span>
                    ${taskAtts.length > 0 ? `
                      <span class="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <i data-lucide="paperclip" class="w-3 h-3 text-indigo-500"></i> ${taskAtts.length}
                      </span>
                    ` : ''}
                  </div>

                  <!-- Title -->
                  <h3 class="text-sm md:text-base font-bold text-slate-900 dark:text-white cursor-pointer hover:text-indigo-600 transition truncate ${isDone ? 'line-through text-slate-400' : ''} btn-edit-task">
                    ${escapeHtml(task.title)}
                  </h3>

                  <!-- Description snippet -->
                  ${task.description ? `
                    <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">${escapeHtml(task.description)}</p>
                  ` : ''}
                </div>
              </div>

              <!-- Right: Progress bar & Actions -->
              <div class="flex items-center justify-between md:justify-end gap-4 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-700/60">
                <!-- Progress bar -->
                <div class="w-32 hidden sm:block">
                  <div class="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span>Tiến độ</span>
                    <span class="font-bold">${task.progress || 0}%</span>
                  </div>
                  <div class="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div class="h-full rounded-full bg-indigo-600" style="width: ${task.progress || 0}%"></div>
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-1">
                  <button type="button" class="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition btn-edit-task" title="Chỉnh sửa & Đính kèm">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                  </button>
                  <button type="button" class="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition btn-delete-task" title="Chuyển vào thùng rác">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  if (window.lucide) window.lucide.createIcons({ root: container });

  // Event Listeners
  // 1. Tab switching
  container.querySelectorAll('.task-filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeFilter = tab.getAttribute('data-filter');
      renderTasks();
    });
  });

  // 2. Search & Select Filters
  container.querySelector('#search-task-input')?.addEventListener('input', (e) => {
    searchKeyword = e.target.value.trim();
    renderTasks();
  });

  container.querySelector('#select-filter-subject')?.addEventListener('change', (e) => {
    subjectFilter = e.target.value;
    renderTasks();
  });

  container.querySelector('#select-filter-priority')?.addEventListener('change', (e) => {
    priorityFilter = e.target.value;
    renderTasks();
  });

  // 3. Add task button
  container.querySelector('#btn-add-task')?.addEventListener('click', () => openTaskFormModal());

  // 4. Toggle status checkbox
  container.querySelectorAll('.btn-toggle-task').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = btn.closest('[data-task-id]');
      const taskId = card?.getAttribute('data-task-id');
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      if (task.status === 'completed') {
        task.status = 'in_progress';
        task.progress = task.progress === 100 ? 50 : task.progress;
      } else {
        task.status = 'completed';
        task.progress = 100;
      }
      task.updatedAt = new Date().toISOString();
      await saveItem('tasks', task);
      showToast(task.status === 'completed' ? 'Đã hoàn thành nhiệm vụ! 🎉' : 'Đã chuyển sang đang thực hiện', 'success');
      renderTasks();
    });
  });

  // 5. Edit task
  container.querySelectorAll('.btn-edit-task').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('[data-task-id]');
      const taskId = card?.getAttribute('data-task-id');
      if (taskId) openTaskFormModal(taskId);
    });
  });

  // 6. Delete task (Soft delete)
  container.querySelectorAll('.btn-delete-task').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = btn.closest('[data-task-id]');
      const taskId = card?.getAttribute('data-task-id');
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const proceed = await confirmDialog({
        title: 'Chuyển nhiệm vụ vào thùng rác?',
        message: `Bạn có chắc muốn xóa nhiệm vụ "${task.title}" không? Có thể hoàn tác trong vòng 30 ngày.`,
        confirmText: 'Chuyển vào thùng rác',
        confirmVariant: 'danger'
      });

      if (proceed) {
        await softDeleteItem('tasks', taskId);
        if (window.studyHubApp?.updateTrashBadgeCounts) {
          window.studyHubApp.updateTrashBadgeCounts();
        }
        showToast(`Đã chuyển nhiệm vụ "${task.title}" vào thùng rác`, 'warning', 6000, {
          label: 'Hoàn tác',
          onClick: async () => {
            const { restoreItem } = await import('../db.js');
            await restoreItem('tasks', taskId);
            if (window.studyHubApp?.updateTrashBadgeCounts) {
              window.studyHubApp.updateTrashBadgeCounts();
            }
            showToast(`Đã khôi phục nhiệm vụ "${task.title}"`, 'success');
            renderTasks();
          }
        });
        renderTasks();
      }
    });
  });
}

/**
 * Task Form Modal (Add / Edit + File Attachments)
 */
export async function openTaskFormModal(taskId = null, preselectedSubjectId = null) {
  const isEdit = Boolean(taskId);
  let task = null;
  if (isEdit) {
    task = await getById('tasks', taskId);
  }

  const allSubjects = await getAll('subjects');
  const subjects = (allSubjects || []).filter(s => !s.deletedAt);

  const selectedSubId = task?.subjectId || preselectedSubjectId || (subjects[0]?.id || '');
  const newTaskId = isEdit ? task.id : `task_${Date.now()}`;

  const html = `
    <div class="p-6 max-w-xl w-full max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
        <h3 class="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <i data-lucide="${isEdit ? 'edit-3' : 'plus-circle'}" class="w-5 h-5 text-indigo-600"></i>
          <span>${isEdit ? 'Chỉnh sửa Nhiệm vụ' : 'Thêm Nhiệm vụ Mới'}</span>
        </h3>
        <button id="btn-close-task-modal" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="form-task" class="mt-4 space-y-4 overflow-y-auto flex-1 pr-1">
        <!-- Môn học liên kết -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Môn học liên quan *</label>
          <select id="task-subject" required class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500">
            ${subjects.map(s => `
              <option value="${s.id}" ${s.id === selectedSubId ? 'selected' : ''}>${escapeHtml(s.name)} (${escapeHtml(s.code)})</option>
            `).join('')}
          </select>
        </div>

        <!-- Tiêu đề nhiệm vụ -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tiêu đề nhiệm vụ *</label>
          <input
            type="text"
            id="task-title"
            required
            value="${escapeHtml(task?.title || '')}"
            placeholder="VD: Nộp báo cáo thí nghiệm chương 4..."
            class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <!-- Hạn nộp & Mức ưu tiên -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Hạn hoàn thành (Deadline)</label>
            <input
              type="datetime-local"
              id="task-due-date"
              value="${task?.dueDate ? task.dueDate.slice(0, 16) : ''}"
              class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mức độ ưu tiên</label>
            <select id="task-priority" class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500">
              <option value="low" ${(task?.priority || 'medium') === 'low' ? 'selected' : ''}>Thấp</option>
              <option value="medium" ${(task?.priority || 'medium') === 'medium' ? 'selected' : ''}>Trung bình</option>
              <option value="high" ${(task?.priority || 'medium') === 'high' ? 'selected' : ''}>Cao</option>
              <option value="urgent" ${(task?.priority || 'medium') === 'urgent' ? 'selected' : ''}>Khẩn cấp</option>
            </select>
          </div>
        </div>

        <!-- Trạng thái & Tiến độ % -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Trạng thái</label>
            <select id="task-status" class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500">
              <option value="pending" ${(task?.status || 'pending') === 'pending' ? 'selected' : ''}>Chưa làm</option>
              <option value="in_progress" ${(task?.status || 'pending') === 'in_progress' ? 'selected' : ''}>Đang làm</option>
              <option value="completed" ${(task?.status || 'pending') === 'completed' ? 'selected' : ''}>Hoàn thành</option>
              <option value="overdue" ${(task?.status || 'pending') === 'overdue' ? 'selected' : ''}>Quá hạn</option>
            </select>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Tiến độ</label>
              <span id="task-progress-val" class="text-xs font-bold text-indigo-600">${task?.progress || 0}%</span>
            </div>
            <input
              type="range"
              id="task-progress"
              min="0"
              max="100"
              step="5"
              value="${task?.progress || 0}"
              class="w-full accent-indigo-600 cursor-pointer"
            />
          </div>
        </div>

        <!-- Mô tả -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mô tả / Yêu cầu chi tiết</label>
          <textarea
            id="task-desc"
            rows="3"
            placeholder="Yêu cầu của giảng viên, link tham khảo, ghi chú..."
            class="w-full px-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
          >${escapeHtml(task?.description || '')}</textarea>
        </div>

        <!-- Tệp đính kèm -->
        <div id="task-modal-attachments-container" class="pt-2 border-t border-slate-100 dark:border-slate-800"></div>

        <!-- Footer -->
        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 flex-shrink-0">
          <button type="button" id="btn-cancel-task" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Hủy bỏ
          </button>
          <button type="submit" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition">
            ${isEdit ? 'Lưu thay đổi' : 'Tạo nhiệm vụ'}
          </button>
        </div>
      </form>
    </div>
  `;

  openModal(html, { size: 'max-w-xl' });
  if (window.lucide) window.lucide.createIcons();

  document.getElementById('btn-close-task-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-task')?.addEventListener('click', closeModal);

  // Update progress label on slider input
  const progressSlider = document.getElementById('task-progress');
  const progressVal = document.getElementById('task-progress-val');
  if (progressSlider && progressVal) {
    progressSlider.addEventListener('input', (e) => {
      progressVal.textContent = `${e.target.value}%`;
    });
  }

  // Render Attachments section for this task
  const attBox = document.getElementById('task-modal-attachments-container');
  if (attBox) {
    renderAttachmentSection(attBox, 'task', newTaskId, { canUpload: true });
  }

  // Form Submit
  document.getElementById('form-task')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subjectId = document.getElementById('task-subject').value;
    const title = document.getElementById('task-title').value.trim();
    const dueDate = document.getElementById('task-due-date').value;
    const priority = document.getElementById('task-priority').value;
    const status = document.getElementById('task-status').value;
    const progress = parseInt(document.getElementById('task-progress').value, 10) || 0;
    const description = document.getElementById('task-desc').value.trim();

    if (!title) {
      showToast('Vui lòng nhập tiêu đề nhiệm vụ!', 'error');
      return;
    }

    const nowIso = new Date().toISOString();
    const newTask = {
      ...(task || {}),
      id: newTaskId,
      subjectId,
      title,
      description,
      dueDate: dueDate || null,
      priority,
      status,
      progress,
      updatedAt: nowIso,
      createdAt: isEdit ? task.createdAt : nowIso
    };

    await saveItem('tasks', newTask);
    closeModal();
    showToast(isEdit ? 'Đã cập nhật nhiệm vụ' : 'Đã tạo nhiệm vụ mới thành công', 'success');
    renderTasks();
  });
}
