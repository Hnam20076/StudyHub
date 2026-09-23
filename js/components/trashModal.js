/**
 * Trash (Thùng rác) Modal Component
 * Displays soft-deleted items across all modules:
 * Subjects, Tasks, Exams, Notes, Mindmaps, Image Notes, Grades, Study Sessions.
 * Allows restoration or permanent deletion within 30 days.
 */

import { getTrashItems, restoreItem, deleteItem, emptyTrash } from '../db.js';
import { openModal, confirmDialog } from './modal.js';
import { showToast } from './toast.js';
import { escapeHtml } from '../utils/helpers.js';

let currentFilter = 'all';

export async function openTrashModal(onUpdated = null) {
  let trashList = await getTrashItems();

  function renderContent(wrapper) {
    const filteredList = currentFilter === 'all'
      ? trashList
      : trashList.filter(item => item._storeName === currentFilter);

    // Filter categories definitions
    const categoryConfigs = [
      { key: 'all', label: 'Tất cả' },
      { key: 'subjects', label: 'Môn học' },
      { key: 'tasks', label: 'Nhiệm vụ' },
      { key: 'exams', label: 'Kỳ thi' },
      { key: 'notes', label: 'Ghi chú' },
      { key: 'mindmaps', label: 'Sơ đồ' },
      { key: 'imageNotes', label: 'Ảnh' }
    ];

    const counts = { all: trashList.length };
    trashList.forEach(item => {
      counts[item._storeName] = (counts[item._storeName] || 0) + 1;
    });

    wrapper.innerHTML = `
      <div class="p-5 md:p-6 select-none">
        <!-- Header -->
        <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs flex-shrink-0">
              <i data-lucide="trash-2" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-base md:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Thùng rác
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  ${trashList.length} mục
                </span>
              </h3>
              <p class="text-[11px] md:text-xs text-slate-400">Lưu giữ an toàn trong 30 ngày trước khi tự động dọn sạch</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            ${trashList.length > 0 ? `
              <button id="btn-empty-trash-all" class="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition cursor-pointer">
                Dọn sạch tất cả
              </button>
            ` : ''}
            <button id="btn-close-trash-modal" class="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
        </div>

        <!-- Filter Segmented Bar -->
        <div class="flex items-center gap-1.5 mt-4 mb-4 overflow-x-auto scrollbar-none pb-1">
          ${categoryConfigs.map(cat => {
            const count = counts[cat.key] || 0;
            if (cat.key !== 'all' && count === 0) return '';
            const isActive = currentFilter === cat.key;
            return `
              <button data-filter="${cat.key}" class="btn-trash-filter px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                isActive ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }">
                <span>${cat.label}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}">${count}</span>
              </button>
            `;
          }).join('')}
        </div>

        <!-- Items List -->
        <div class="max-h-[60vh] overflow-y-auto space-y-2.5 pr-1">
          ${filteredList.length === 0 ? `
            <div class="py-12 text-center">
              <div class="w-14 h-14 mx-auto rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <i data-lucide="sparkles" class="w-7 h-7"></i>
              </div>
              <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Thùng rác trống</p>
              <p class="text-xs text-slate-400 mt-1">Không có mục nào đang ở trong mục này.</p>
            </div>
          ` : filteredList.map(item => {
            const displayName = item.title || item.name || (item.code ? `${item.code} - ${item.name}` : '') || item.fileName || 'Mục không tên';
            const subtitle = item.subjectName || item.lecturer || item.code || item.type || item._typeName;

            return `
              <div class="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700 transition">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <div class="w-10 h-10 rounded-xl bg-${item._typeColor || 'indigo'}-50 dark:bg-${item._typeColor || 'indigo'}-950/60 text-${item._typeColor || 'indigo'}-600 dark:text-${item._typeColor || 'indigo'}-400 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="${item._typeIcon || 'file'}" class="w-5 h-5"></i>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        ${item._typeName}
                      </span>
                      <h4 class="text-xs md:text-sm font-bold text-slate-900 dark:text-white truncate">
                        ${escapeHtml(displayName)}
                      </h4>
                    </div>
                    <div class="flex items-center gap-2 text-[11px] text-slate-400 mt-1 truncate">
                      <span>${escapeHtml(subtitle)}</span>
                      <span>•</span>
                      <span class="text-amber-600 dark:text-amber-400 font-medium">Còn ${item._daysRemaining} ngày</span>
                    </div>
                  </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex items-center gap-1.5 ml-3 flex-shrink-0">
                  <button data-action="restore" data-store="${item._storeName}" data-id="${item.id}" class="btn-restore-item flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 text-xs font-semibold transition cursor-pointer" title="Khôi phục lại mục này">
                    <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                    <span>Khôi phục</span>
                  </button>
                  <button data-action="delete" data-store="${item._storeName}" data-id="${item.id}" class="btn-permanent-delete p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition cursor-pointer" title="Xóa vĩnh viễn">
                    <i data-lucide="trash" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Attach Event Listeners
    wrapper.querySelector('#btn-close-trash-modal')?.addEventListener('click', () => modal.close());

    // Empty All
    const btnEmpty = wrapper.querySelector('#btn-empty-trash-all');
    if (btnEmpty) {
      btnEmpty.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Dọn sạch thùng rác',
          message: 'Tất cả các mục trong thùng rác sẽ bị xóa vĩnh viễn và không thể khôi phục lại. Bạn có chắc chắn muốn dọn sạch?',
          confirmText: 'Dọn sạch ngay',
          confirmColor: 'bg-rose-600 hover:bg-rose-700 text-white'
        });

        if (ok) {
          await emptyTrash();
          trashList = [];
          renderContent(wrapper);
          showToast('Đã dọn sạch thùng rác thành công!', 'success');
          if (onUpdated) onUpdated();
          if (window.studyHubApp && window.studyHubApp.updateTrashBadgeCounts) {
            window.studyHubApp.updateTrashBadgeCounts();
          }
        }
      });
    }

    // Filter switching
    wrapper.querySelectorAll('.btn-trash-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilter = btn.getAttribute('data-filter');
        renderContent(wrapper);
      });
    });

    // Restore Item
    wrapper.querySelectorAll('.btn-restore-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const storeName = btn.getAttribute('data-store');
        const id = btn.getAttribute('data-id');
        const restored = await restoreItem(storeName, id);
        if (restored) {
          showToast(`Đã khôi phục thành công!`, 'success');
          trashList = await getTrashItems();
          renderContent(wrapper);
          if (onUpdated) onUpdated();
          if (window.studyHubApp && window.studyHubApp.updateTrashBadgeCounts) {
            window.studyHubApp.updateTrashBadgeCounts();
          }
        }
      });
    });

    // Permanent Delete Single Item
    wrapper.querySelectorAll('.btn-permanent-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const storeName = btn.getAttribute('data-store');
        const id = btn.getAttribute('data-id');
        const target = trashList.find(i => i.id === id && i._storeName === storeName);
        if (!target) return;

        const ok = await confirmDialog({
          title: 'Xóa vĩnh viễn',
          message: `Bạn có chắc chắn muốn xóa vĩnh viễn mục này? Thao tác này không thể hoàn tác.`,
          confirmText: 'Xóa vĩnh viễn'
        });

        if (ok) {
          await deleteItem(storeName, id);
          showToast(`Đã xóa vĩnh viễn mục đã chọn`, 'info');
          trashList = await getTrashItems();
          renderContent(wrapper);
          if (onUpdated) onUpdated();
          if (window.studyHubApp && window.studyHubApp.updateTrashBadgeCounts) {
            window.studyHubApp.updateTrashBadgeCounts();
          }
        }
      });
    });

    if (window.lucide) {
      window.lucide.createIcons({ root: wrapper });
    }
  }

  const modal = openModal('<div id="trash-modal-inner"></div>', { size: 'max-w-2xl' });
  const innerWrapper = modal.wrapper.querySelector('#trash-modal-inner');
  renderContent(innerWrapper);
}
