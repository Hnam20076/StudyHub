/**
 * Notes (Ghi chú bài học) Module
 * Supports Create/Edit/Delete, Search, Filter by Subject/Topic/Tag, Pinned notes, and Interactive Checklists.
 */

import { getAll, saveItem, deleteItem, getById, softDeleteItem, restoreItem } from '../db.js';
import {
  generateId,
  SUBJECT_COLORS,
  getColorById,
  escapeHtml,
  formatDateVietnamese
} from '../utils/helpers.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

let currentNotesData = [];
let availableSubjects = [];
let searchQuery = '';
let selectedSubject = 'all';
let selectedTopic = 'all';
let selectedTag = 'all';
let viewLayout = 'grid'; // 'grid' | 'list'

export async function initNotesModule() {
  await loadNotesAndSubjects();
  renderNotesView();
}

export async function loadNotesAndSubjects() {
  const allNotes = await getAll('notes');
  currentNotesData = allNotes.filter(n => !n.deletedAt);
  const [schedules, subjects] = await Promise.all([
    getAll('schedules'),
    getAll('subjects')
  ]);

  // Combine unique subject names from subjects store, schedules and existing notes
  const set = new Set();
  subjects.forEach(s => { if (s.name) set.add(s.name); });
  schedules.forEach(s => { if (s.subjectName) set.add(s.subjectName); });
  currentNotesData.forEach(n => { if (n.subjectName) set.add(n.subjectName); });
  availableSubjects = Array.from(set).sort();

  // Sort notes: pinned first, then by updatedAt descending
  currentNotesData.sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });

  return currentNotesData;
}

export function renderNotesView() {
  const container = document.getElementById('notes-view');
  if (!container) return;

  // Extract unique topics and tags for filters
  const topicsSet = new Set();
  const tagsSet = new Set();
  currentNotesData.forEach(n => {
    if (n.topic) topicsSet.add(n.topic);
    if (Array.isArray(n.tags)) {
      n.tags.forEach(t => tagsSet.add(t));
    }
  });
  const topicsList = Array.from(topicsSet);
  const tagsList = Array.from(tagsSet);

  // Filter notes
  const filtered = currentNotesData.filter(item => {
    // Subject filter
    if (selectedSubject !== 'all' && item.subjectName !== selectedSubject) {
      return false;
    }
    // Topic filter
    if (selectedTopic !== 'all' && item.topic !== selectedTopic) {
      return false;
    }
    // Tag filter
    if (selectedTag !== 'all' && (!item.tags || !item.tags.includes(selectedTag))) {
      return false;
    }
    // Search query (case insensitive search across title, content, topic, subject, tags)
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = (item.title || '').toLowerCase().includes(q);
      const contentMatch = (item.content || '').toLowerCase().includes(q);
      const subjectMatch = (item.subjectName || '').toLowerCase().includes(q);
      const topicMatch = (item.topic || '').toLowerCase().includes(q);
      const tagMatch = (item.tags || []).some(t => t.toLowerCase().includes(q));

      if (!titleMatch && !contentMatch && !subjectMatch && !topicMatch && !tagMatch) {
        return false;
      }
    }
    return true;
  });

  const pinnedNotes = filtered.filter(n => n.isPinned);
  const otherNotes = filtered.filter(n => !n.isPinned);

  container.innerHTML = `
    <!-- Top Notes Header Bar -->
    <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Ghi chú bài học</h2>
          <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            ${filtered.length} / ${currentNotesData.length} ghi chú
          </span>
        </div>
        <p class="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Hệ thống ghi chép môn học, checklist bài tập và ôn thi có cấu trúc
        </p>
      </div>

      <div class="flex items-center gap-2.5 flex-wrap">
        <!-- Layout Switcher (Grid / List) -->
        <div class="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center border border-slate-200 dark:border-slate-700">
          <button id="btn-layout-grid" class="p-1.5 rounded-lg text-xs transition ${viewLayout === 'grid' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}" title="Xem dạng lưới">
            <i data-lucide="layout-grid" class="w-4 h-4"></i>
          </button>
          <button id="btn-layout-list" class="p-1.5 rounded-lg text-xs transition ${viewLayout === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}" title="Xem dạng danh sách">
            <i data-lucide="list" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- Add Note Button -->
        <button id="btn-create-note" class="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-medium text-xs md:text-sm rounded-xl shadow-sm transition">
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>Tạo ghi chú mới</span>
        </button>
      </div>
    </div>

    <!-- Search & Filter Controls Panel -->
    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 mb-6 shadow-sm space-y-3">
      <!-- Search Input Bar -->
      <div class="relative">
        <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"></i>
        <input
          type="text"
          id="notes-search-box"
          placeholder="Tìm kiếm theo tiêu đề, nội dung, môn học hoặc #tag..."
          value="${escapeHtml(searchQuery)}"
          class="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-xs md:text-sm outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition"
        />
        ${searchQuery ? `
          <button id="btn-clear-search" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        ` : ''}
      </div>

      <!-- Filters Grid (Mobile: 1 col, Desktop: 3 cols) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1 text-xs">
        <!-- Subject Filter -->
        <div class="flex items-center gap-2">
          <span class="text-slate-400 font-medium w-16 flex-shrink-0">Môn học:</span>
          <select id="filter-notes-subject" class="flex-1 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs rounded-xl px-2.5 py-2 outline-none focus:border-indigo-500">
            <option value="all">Tất cả môn học</option>
            ${availableSubjects.map(sub => `<option value="${escapeHtml(sub)}" ${selectedSubject === sub ? 'selected' : ''}>${escapeHtml(sub)}</option>`).join('')}
          </select>
        </div>

        <!-- Topic Filter -->
        <div class="flex items-center gap-2">
          <span class="text-slate-400 font-medium w-16 flex-shrink-0">Chủ đề:</span>
          <select id="filter-notes-topic" class="flex-1 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs rounded-xl px-2.5 py-2 outline-none focus:border-indigo-500">
            <option value="all">Tất cả chủ đề</option>
            ${topicsList.map(top => `<option value="${escapeHtml(top)}" ${selectedTopic === top ? 'selected' : ''}>${escapeHtml(top)}</option>`).join('')}
          </select>
        </div>

        <!-- Tag Filter -->
        ${tagsList.length > 0 ? `
          <div class="flex items-center gap-2">
            <span class="text-slate-400 font-medium w-16 flex-shrink-0">Thẻ tag:</span>
            <select id="filter-notes-tag" class="flex-1 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs rounded-xl px-2.5 py-2 outline-none focus:border-indigo-500">
              <option value="all">Tất cả thẻ tag</option>
              ${tagsList.map(tag => `<option value="${escapeHtml(tag)}" ${selectedTag === tag ? 'selected' : ''}>${escapeHtml(tag)}</option>`).join('')}
            </select>
          </div>
        ` : ''}
      </div>

      ${(selectedSubject !== 'all' || selectedTopic !== 'all' || selectedTag !== 'all' || searchQuery) ? `
        <div class="pt-1 flex justify-end">
          <button id="btn-reset-filters" class="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold flex items-center gap-1">
            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            Xóa tất cả bộ lọc
          </button>
        </div>
      ` : ''}
    </div>

    <!-- Notes Content Area -->
    <div id="notes-content" class="space-y-8">
      ${filtered.length === 0 ? renderEmptyNotes() : `
        <!-- Pinned Notes Section -->
        ${pinnedNotes.length > 0 ? `
          <div>
            <div class="flex items-center gap-2 mb-3.5">
              <i data-lucide="pin" class="w-4 h-4 text-amber-500 fill-amber-500"></i>
              <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Đã ghim lên đầu (${pinnedNotes.length})
              </h3>
            </div>
            <div class="${viewLayout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}">
              ${pinnedNotes.map(item => renderNoteCard(item, viewLayout)).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Other Notes Section -->
        ${otherNotes.length > 0 ? `
          <div>
            ${pinnedNotes.length > 0 ? `
              <div class="flex items-center gap-2 mb-3.5">
                <i data-lucide="file-text" class="w-4 h-4 text-slate-400"></i>
                <h3 class="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Ghi chú khác (${otherNotes.length})
                </h3>
              </div>
            ` : ''}
            <div class="${viewLayout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}">
              ${otherNotes.map(item => renderNoteCard(item, viewLayout)).join('')}
            </div>
          </div>
        ` : ''}
      `}
    </div>
  `;

  // Attach event handlers
  setupNotesEvents(container);

  if (window.lucide) {
    window.lucide.createIcons({ root: container });
  }
}

/**
 * Render Empty State
 */
function renderEmptyNotes() {
  const hasFilter = searchQuery || selectedSubject !== 'all' || selectedTopic !== 'all' || selectedTag !== 'all';

  return `
    <div class="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center max-w-md mx-auto shadow-sm">
      <div class="w-16 h-16 mx-auto rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
        <i data-lucide="${hasFilter ? 'search-x' : 'edit-3'}" class="w-8 h-8"></i>
      </div>
      <h3 class="text-base font-bold text-slate-900 dark:text-white">
        ${hasFilter ? 'Không tìm thấy ghi chú phù hợp' : 'Chưa có ghi chú nào'}
      </h3>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5 mb-6">
        ${hasFilter ? 'Thử xóa bộ lọc hoặc tìm với từ khóa khác xem sao!' : 'Tạo ghi chú bài học đầu tiên để hệ thống hóa kiến thức hiệu quả hơn.'}
      </p>
      <button id="btn-empty-action" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold shadow-sm transition">
        ${hasFilter ? 'Xóa tất cả bộ lọc' : '+ Tạo ghi chú mới'}
      </button>
    </div>
  `;
}

/**
 * Render Single Note Card
 */
function renderNoteCard(item, layout = 'grid') {
  const color = getColorById(item.color || 'indigo');
  const formattedDate = formatDateVietnamese(new Date(item.updatedAt || item.createdAt || Date.now()));

  // Render content snippet & parse markdown checklist
  const parsedContentHtml = parseMarkdownSnippet(item.content, item.id);

  if (layout === 'list') {
    return `
      <div class="note-card bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-xs hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4 group">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-1.5">
            ${item.isPinned ? `
              <span class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <i data-lucide="pin" class="w-3.5 h-3.5 fill-amber-500 text-amber-500"></i>
                Đã ghim
              </span>
            ` : ''}
            <span class="px-2 py-0.5 text-[11px] font-bold rounded-md ${color.badge} text-white">
              ${escapeHtml(item.subjectName || 'Chưa gắn môn')}
            </span>
            ${item.topic ? `
              <span class="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                ${escapeHtml(item.topic)}
              </span>
            ` : ''}
          </div>

          <h4 class="text-base font-bold text-slate-900 dark:text-white truncate mb-1">
            ${escapeHtml(item.title)}
          </h4>

          <div class="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
            ${parsedContentHtml}
          </div>

          ${item.tags && item.tags.length > 0 ? `
            <div class="flex items-center gap-1.5 flex-wrap mt-2">
              ${item.tags.map(t => `<span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 font-medium">${escapeHtml(t)}</span>`).join('')}
            </div>
          ` : ''}
        </div>

        <div class="flex items-center justify-between md:flex-col md:items-end gap-2 flex-shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 dark:border-slate-700">
          <span class="text-[11px] text-slate-400">${formattedDate}</span>
          <div class="flex items-center gap-1">
            <button data-action="toggle-pin" data-id="${item.id}" class="btn-pin-note p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-slate-700 transition" title="${item.isPinned ? 'Bỏ ghim' : 'Ghim lên đầu'}">
              <i data-lucide="pin" class="w-4 h-4 ${item.isPinned ? 'fill-amber-500 text-amber-500' : ''}"></i>
            </button>
            <button data-action="edit" data-id="${item.id}" class="btn-edit-note p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 transition" title="Chỉnh sửa">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button data-action="delete" data-id="${item.id}" class="btn-delete-note p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 transition" title="Xóa">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Grid Card Layout
  return `
    <div class="note-card bg-white dark:bg-slate-800 rounded-2xl border ${item.isPinned ? 'border-amber-300 dark:border-amber-500/50 shadow-sm ring-1 ring-amber-400/20' : 'border-slate-200 dark:border-slate-700/80 shadow-xs'} p-5 hover:shadow-md transition-all duration-150 flex flex-col justify-between group">
      <div>
        <!-- Top Row: Subject & Pin Action -->
        <div class="flex items-center justify-between gap-2 mb-2.5">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="px-2.5 py-0.5 text-[11px] font-bold rounded-lg ${color.badge} text-white">
              ${escapeHtml(item.subjectName || 'Tự do')}
            </span>
            ${item.topic ? `
              <span class="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                ${escapeHtml(item.topic)}
              </span>
            ` : ''}
          </div>

          <div class="flex items-center gap-1">
            <button data-action="toggle-pin" data-id="${item.id}" class="btn-pin-note p-1 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-slate-700 transition" title="${item.isPinned ? 'Bỏ ghim' : 'Ghim lên đầu'}">
              <i data-lucide="pin" class="w-4 h-4 ${item.isPinned ? 'fill-amber-500 text-amber-500' : ''}"></i>
            </button>
            <button data-action="edit" data-id="${item.id}" class="btn-edit-note p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 transition" title="Sửa">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button data-action="delete" data-id="${item.id}" class="btn-delete-note p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 transition" title="Xóa">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Note Title -->
        <h4 class="text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 mb-2.5">
          ${escapeHtml(item.title)}
        </h4>

        <!-- Content Preview / Checklists -->
        <div class="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 mb-4 max-h-48 overflow-y-auto pr-1">
          ${parsedContentHtml}
        </div>
      </div>

      <!-- Card Bottom Footer -->
      <div class="pt-3 border-t border-slate-100 dark:border-slate-700/80 flex flex-col gap-2">
        <!-- Tags -->
        ${item.tags && item.tags.length > 0 ? `
          <div class="flex items-center gap-1 flex-wrap">
            ${item.tags.map(t => `<button data-tag="${escapeHtml(t)}" class="btn-click-tag text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 transition">${escapeHtml(t)}</button>`).join('')}
          </div>
        ` : ''}

        <!-- Timestamp -->
        <div class="flex items-center justify-between text-[11px] text-slate-400">
          <span class="flex items-center gap-1">
            <i data-lucide="clock" class="w-3 h-3"></i>
            ${formattedDate}
          </span>
          <button data-action="view-full" data-id="${item.id}" class="btn-view-full text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-0.5 text-xs">
            Chi tiết
            <i data-lucide="arrow-up-right" class="w-3 h-3"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Lightweight Markdown & Interactive Checklist Parser
 */
function parseMarkdownSnippet(rawContent, noteId) {
  if (!rawContent) return '<span class="text-slate-400 italic">Không có nội dung</span>';

  const lines = rawContent.split('\n');
  let html = '';
  let inChecklist = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Checkbox unchecked
    if (trimmed.startsWith('- [ ] ')) {
      const taskText = escapeHtml(trimmed.substring(6));
      html += `
        <div class="flex items-start gap-2 py-0.5">
          <input type="checkbox" data-note-id="${noteId}" data-line-index="${index}" class="note-checklist-box mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
          <span class="text-xs text-slate-700 dark:text-slate-300 leading-tight">${taskText}</span>
        </div>
      `;
      inChecklist = true;
      return;
    }

    // Checkbox checked
    if (trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
      const taskText = escapeHtml(trimmed.substring(6));
      html += `
        <div class="flex items-start gap-2 py-0.5 opacity-75">
          <input type="checkbox" checked data-note-id="${noteId}" data-line-index="${index}" class="note-checklist-box mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
          <span class="text-xs line-through text-slate-400 dark:text-slate-500 leading-tight">${taskText}</span>
        </div>
      `;
      inChecklist = true;
      return;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      html += `<div class="font-bold text-xs text-slate-900 dark:text-white pt-1">${escapeHtml(trimmed.substring(4))}</div>`;
      return;
    }
    if (trimmed.startsWith('## ')) {
      html += `<div class="font-bold text-sm text-slate-900 dark:text-white pt-1.5">${escapeHtml(trimmed.substring(3))}</div>`;
      return;
    }

    // Bullet point
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      html += `<div class="flex items-start gap-1.5 pl-1 text-xs text-slate-600 dark:text-slate-300"><span class="text-indigo-500 font-bold">•</span><span>${formatInlineMarkdown(trimmed.substring(2))}</span></div>`;
      return;
    }

    // Regular line
    if (trimmed.length > 0) {
      html += `<div class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">${formatInlineMarkdown(trimmed)}</div>`;
    }
  });

  return html;
}

function formatInlineMarkdown(text) {
  let str = escapeHtml(text);
  // Bold **text**
  str = str.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>');
  // Inline code `code`
  str = str.replace(/`(.*?)`/g, '<code class="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700/80 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">$1</code>');
  return str;
}

/**
 * Setup Event Listeners
 */
function setupNotesEvents(container) {
  // Search box realtime
  const searchBox = container.querySelector('#notes-search-box');
  if (searchBox) {
    searchBox.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderNotesView();
    });
  }

  // Clear search button
  const clearSearchBtn = container.querySelector('#btn-clear-search');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchQuery = '';
      renderNotesView();
    });
  }

  // Filter subject
  const filterSubject = container.querySelector('#filter-notes-subject');
  if (filterSubject) {
    filterSubject.addEventListener('change', (e) => {
      selectedSubject = e.target.value;
      renderNotesView();
    });
  }

  // Filter topic
  const filterTopic = container.querySelector('#filter-notes-topic');
  if (filterTopic) {
    filterTopic.addEventListener('change', (e) => {
      selectedTopic = e.target.value;
      renderNotesView();
    });
  }

  // Filter tag
  const filterTag = container.querySelector('#filter-notes-tag');
  if (filterTag) {
    filterTag.addEventListener('change', (e) => {
      selectedTag = e.target.value;
      renderNotesView();
    });
  }

  // Reset filters
  const resetBtn = container.querySelector('#btn-reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      searchQuery = '';
      selectedSubject = 'all';
      selectedTopic = 'all';
      selectedTag = 'all';
      renderNotesView();
    });
  }

  // Empty state action
  const emptyActionBtn = container.querySelector('#btn-empty-action');
  if (emptyActionBtn) {
    emptyActionBtn.addEventListener('click', () => {
      if (searchQuery || selectedSubject !== 'all' || selectedTopic !== 'all' || selectedTag !== 'all') {
        searchQuery = '';
        selectedSubject = 'all';
        selectedTopic = 'all';
        selectedTag = 'all';
        renderNotesView();
      } else {
        openNoteFormModal();
      }
    });
  }

  // Layout switcher
  const btnGrid = container.querySelector('#btn-layout-grid');
  const btnList = container.querySelector('#btn-layout-list');
  if (btnGrid) {
    btnGrid.addEventListener('click', () => {
      viewLayout = 'grid';
      renderNotesView();
    });
  }
  if (btnList) {
    btnList.addEventListener('click', () => {
      viewLayout = 'list';
      renderNotesView();
    });
  }

  // Create note button
  const btnCreate = container.querySelector('#btn-create-note');
  if (btnCreate) {
    btnCreate.addEventListener('click', () => {
      openNoteFormModal();
    });
  }

  // Interactive Checklist Checkboxes
  container.querySelectorAll('.note-checklist-box').forEach(box => {
    box.addEventListener('change', async (e) => {
      const noteId = box.getAttribute('data-note-id');
      const lineIndex = parseInt(box.getAttribute('data-line-index'), 10);
      const isChecked = box.checked;

      const note = currentNotesData.find(n => n.id === noteId);
      if (!note || !note.content) return;

      const lines = note.content.split('\n');
      if (lines[lineIndex] !== undefined) {
        if (isChecked) {
          lines[lineIndex] = lines[lineIndex].replace('- [ ] ', '- [x] ');
        } else {
          lines[lineIndex] = lines[lineIndex].replace(/- \[[xX]\] /, '- [ ] ');
        }
        note.content = lines.join('\n');
        note.updatedAt = new Date().toISOString();

        await saveItem('notes', note);
        await loadNotesAndSubjects();
        renderNotesView();
      }
    });
  });

  // Click on tags in card
  container.querySelectorAll('.btn-click-tag').forEach(tagBtn => {
    tagBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tag = tagBtn.getAttribute('data-tag');
      selectedTag = tag;
      renderNotesView();
    });
  });

  // Pin toggle
  container.querySelectorAll('.btn-pin-note').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const note = currentNotesData.find(n => n.id === id);
      if (!note) return;

      note.isPinned = !note.isPinned;
      note.updatedAt = new Date().toISOString();
      await saveItem('notes', note);
      await loadNotesAndSubjects();
      renderNotesView();
      showToast(note.isPinned ? `Đã ghim ghi chú "${note.title}" lên đầu` : `Đã bỏ ghim ghi chú "${note.title}"`, 'info');
    });
  });

  // Edit / View note
  container.querySelectorAll('.btn-edit-note, .btn-view-full').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const note = currentNotesData.find(n => n.id === id);
      if (note) {
        openNoteFormModal(note);
      }
    });
  });

  // Delete note (Soft delete to trash with 30-day retention and undo)
  container.querySelectorAll('.btn-delete-note').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const note = currentNotesData.find(n => n.id === id);
      if (!note) return;

      await softDeleteItem('notes', id);
      await loadNotesAndSubjects();
      renderNotesView();

      showToast(`Đã chuyển ghi chú "${note.title}" vào thùng rác`, 'info', 5000, {
        label: 'Hoàn tác',
        onClick: async () => {
          await restoreItem('notes', id);
          await loadNotesAndSubjects();
          renderNotesView();
          showToast(`Đã khôi phục ghi chú "${note.title}" thành công!`, 'success');
        }
      });
    });
  });
}

/**
 * Open Note Create / Edit Modal
 */
export function openNoteFormModal(editingItem = null) {
  const isEditing = Boolean(editingItem);
  const defaultColor = editingItem ? (editingItem.color || 'emerald') : 'emerald';
  const defaultSubject = editingItem ? (editingItem.subjectName || '') : (availableSubjects[0] || '');
  const defaultTags = editingItem && Array.isArray(editingItem.tags) ? editingItem.tags.join(', ') : '';

  const modalHtml = `
    <div class="p-6 overflow-y-auto max-h-[88vh] flex flex-col">
      <!-- Modal Header -->
      <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <i data-lucide="${isEditing ? 'edit-3' : 'file-plus'}" class="w-5 h-5"></i>
          </div>
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">
            ${isEditing ? 'Chỉnh sửa ghi chú bài học' : 'Tạo ghi chú bài học mới'}
          </h3>
        </div>
        <button id="modal-note-close" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- Form -->
      <form id="form-note" class="space-y-4">
        <!-- Title Input -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Tiêu đề ghi chú <span class="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="note-title-input"
            required
            placeholder="VD: Cấu trúc Cây AVL & Các thuật toán xoay"
            value="${escapeHtml(editingItem ? editingItem.title : '')}"
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition"
          />
        </div>

        <!-- Subject & Topic Dropdowns -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Môn học liên kết
            </label>
            <div class="relative">
              <input
                type="text"
                id="note-subject-input"
                list="subjects-datalist"
                placeholder="Chọn hoặc nhập môn học..."
                value="${escapeHtml(defaultSubject)}"
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs md:text-sm outline-none focus:border-emerald-500 transition"
              />
              <datalist id="subjects-datalist">
                ${availableSubjects.map(s => `<option value="${escapeHtml(s)}">`).join('')}
              </datalist>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Chủ đề / Phân loại
            </label>
            <input
              type="text"
              id="note-topic-input"
              placeholder="VD: Lý thuyết, Ôn thi, Đồ án..."
              value="${escapeHtml(editingItem ? editingItem.topic || '' : '')}"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs md:text-sm outline-none focus:border-emerald-500 transition"
            />
          </div>
        </div>

        <!-- Tags & Color & Pin -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Thẻ tag (cách nhau bởi dấu phẩy)
            </label>
            <input
              type="text"
              id="note-tags-input"
              placeholder="VD: #AVL, #ThiGiuaKy, #GiaiThuat"
              value="${escapeHtml(defaultTags)}"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs md:text-sm outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div class="flex items-center justify-between pb-1">
            <!-- Pin Checkbox -->
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                id="note-pinned-input"
                ${editingItem && editingItem.isPinned ? 'checked' : ''}
                class="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300 cursor-pointer"
              />
              <span class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <i data-lucide="pin" class="w-3.5 h-3.5 text-amber-500 fill-amber-500"></i>
                Ghim lên đầu
              </span>
            </label>

            <!-- Color Palette Dropdown/Pick -->
            <div class="flex items-center gap-1.5" id="note-color-picker">
              ${SUBJECT_COLORS.slice(0, 5).map(c => `
                <button
                  type="button"
                  data-color="${c.id}"
                  class="btn-note-color w-6 h-6 rounded-full ${c.badge} transition transform hover:scale-110 ${c.id === defaultColor ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}"
                  title="${c.name}"
                ></button>
              `).join('')}
              <input type="hidden" id="note-color-value" value="${defaultColor}" />
            </div>
          </div>
        </div>

        <!-- Note Content Tabs & Toolbar -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nội dung bài học & Công việc cần làm
            </label>

            <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button type="button" id="tab-edit" class="px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs">
                Soạn thảo
              </button>
              <button type="button" id="tab-preview" class="px-2.5 py-1 text-xs font-medium rounded-md text-slate-500 dark:text-slate-400">
                Xem trước
              </button>
            </div>
          </div>

          <!-- Quick Format Buttons Toolbar -->
          <div id="formatting-toolbar" class="flex items-center gap-1.5 p-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 mb-2 overflow-x-auto no-scrollbar text-xs">
            <button type="button" data-insert="## " class="toolbar-btn px-2 py-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:text-emerald-600 font-bold" title="Tiêu đề H2">
              H2
            </button>
            <button type="button" data-insert="### " class="toolbar-btn px-2 py-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:text-emerald-600 font-bold" title="Tiêu đề H3">
              H3
            </button>
            <button type="button" data-insert="**in đậm**" class="toolbar-btn px-2 py-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:text-emerald-600 font-bold" title="In đậm">
              B
            </button>
            <button type="button" data-insert="- [ ] " class="toolbar-btn px-2 py-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:text-emerald-600 flex items-center gap-1" title="Thêm việc cần làm">
              <i data-lucide="check-square" class="w-3.5 h-3.5 text-emerald-500"></i>
              <span>To-do</span>
            </button>
            <button type="button" data-insert="- " class="toolbar-btn px-2 py-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:text-emerald-600" title="Danh sách gạch đầu dòng">
              • List
            </button>
            <button type="button" data-insert="\`code\`" class="toolbar-btn px-2 py-1 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:text-emerald-600 font-mono text-[11px]" title="Đoạn mã code">
              &lt;/&gt;
            </button>
          </div>

          <!-- Editor Textarea -->
          <textarea
            id="note-content-input"
            rows="8"
            placeholder="Nhập nội dung bài học, công thức, định dạng markdown hoặc dùng '- [ ] việc cần làm'..."
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs md:text-sm leading-relaxed outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition font-mono"
          >${escapeHtml(editingItem ? editingItem.content || '' : '')}</textarea>

          <!-- Live Preview Pane (hidden by default) -->
          <div id="note-preview-pane" class="hidden min-h-[190px] p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-xs md:text-sm space-y-2 overflow-y-auto max-h-[300px]"></div>
        </div>

        <!-- Form Actions -->
        <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            id="btn-cancel-note"
            class="px-4 py-2 rounded-xl text-xs md:text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Hủy
          </button>
          <button
            type="submit"
            class="px-5 py-2 rounded-xl text-xs md:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition shadow-sm"
          >
            ${isEditing ? 'Lưu cập nhật' : 'Tạo ghi chú'}
          </button>
        </div>
      </form>
    </div>
  `;

  const modal = openModal(modalHtml, { size: 'max-w-2xl' });
  const wrapper = modal.wrapper;

  // Close handlers
  wrapper.querySelector('#modal-note-close').addEventListener('click', () => modal.close());
  wrapper.querySelector('#btn-cancel-note').addEventListener('click', () => modal.close());

  // Color picker
  const colorInput = wrapper.querySelector('#note-color-value');
  wrapper.querySelectorAll('.btn-note-color').forEach(btn => {
    btn.addEventListener('click', () => {
      const col = btn.getAttribute('data-color');
      colorInput.value = col;
      wrapper.querySelectorAll('.btn-note-color').forEach(b => b.classList.remove('ring-2', 'ring-offset-2', 'ring-indigo-500'));
      btn.classList.add('ring-2', 'ring-offset-2', 'ring-indigo-500');
    });
  });

  // Editor vs Preview Tab Switching
  const tabEdit = wrapper.querySelector('#tab-edit');
  const tabPreview = wrapper.querySelector('#tab-preview');
  const contentInput = wrapper.querySelector('#note-content-input');
  const previewPane = wrapper.querySelector('#note-preview-pane');
  const toolbar = wrapper.querySelector('#formatting-toolbar');

  tabEdit.addEventListener('click', () => {
    tabEdit.className = 'px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs';
    tabPreview.className = 'px-2.5 py-1 text-xs font-medium rounded-md text-slate-500 dark:text-slate-400';
    contentInput.classList.remove('hidden');
    toolbar.classList.remove('hidden');
    previewPane.classList.add('hidden');
  });

  tabPreview.addEventListener('click', () => {
    tabPreview.className = 'px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs';
    tabEdit.className = 'px-2.5 py-1 text-xs font-medium rounded-md text-slate-500 dark:text-slate-400';
    contentInput.classList.add('hidden');
    toolbar.classList.add('hidden');
    previewPane.classList.remove('hidden');
    previewPane.innerHTML = parseMarkdownSnippet(contentInput.value, 'preview');
    if (window.lucide) {
      window.lucide.createIcons({ root: previewPane });
    }
  });

  // Toolbar Insert helper
  wrapper.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const textToInsert = btn.getAttribute('data-insert');
      const start = contentInput.selectionStart;
      const end = contentInput.selectionEnd;
      const text = contentInput.value;
      contentInput.value = text.substring(0, start) + textToInsert + text.substring(end);
      contentInput.focus();
      contentInput.selectionStart = contentInput.selectionEnd = start + textToInsert.length;
    });
  });

  // Submit Handler
  const form = wrapper.querySelector('#form-note');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = wrapper.querySelector('#note-title-input').value.trim();
    const subjectName = wrapper.querySelector('#note-subject-input').value.trim();
    const topic = wrapper.querySelector('#note-topic-input').value.trim();
    const rawTags = wrapper.querySelector('#note-tags-input').value.trim();
    const content = contentInput.value.trim();
    const isPinned = wrapper.querySelector('#note-pinned-input').checked;
    const color = colorInput.value;

    if (!title) {
      showToast('Vui lòng nhập tiêu đề ghi chú!', 'warning');
      return;
    }

    // Format tags array with leading '#'
    const tags = rawTags
      ? rawTags.split(',').map(t => {
          let clean = t.trim();
          if (clean && !clean.startsWith('#')) clean = '#' + clean;
          return clean;
        }).filter(Boolean)
      : [];

    const subjectCodeMap = {
      'Kỹ thuật số': '71ELEC30083',
      'Kỹ năng công dân toàn cầu': '71SSK110023',
      'Hệ thống và điều khiển': '71ELEC30163',
      'Cơ học vật liệu': '71MECA30023',
      'Tư tưởng Hồ Chí Minh': '71POLH10042'
    };
    const subjectId = subjectCodeMap[subjectName] || (editingItem ? editingItem.subjectId : '') || '';

    const nowIso = new Date().toISOString();
    const noteToSave = {
      id: editingItem ? editingItem.id : generateId(),
      title,
      subjectId,
      subjectName,
      topic,
      tags,
      content,
      isPinned,
      color,
      createdAt: editingItem ? (editingItem.createdAt || nowIso) : nowIso,
      updatedAt: nowIso
    };

    await saveItem('notes', noteToSave);
    await loadNotesAndSubjects();
    renderNotesView();
    modal.close();

    showToast(isEditing ? `Đã cập nhật ghi chú "${title}"` : `Đã tạo ghi chú "${title}" thành công!`, 'success');
  });

  if (window.lucide) {
    window.lucide.createIcons({ root: wrapper });
  }
}
