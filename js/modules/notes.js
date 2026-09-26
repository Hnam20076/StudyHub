/**
 * Notes (Ghi chú bài học) Module — Microsoft OneNote Style
 * Features:
 * - Master-Detail 2-Column Layout (Notes Sidebar & Rich Text Editor Workspace)
 * - Rich Text Formatting (Bold, Italic, Underline, Strikethrough, Headings, Lists, Quotes, Undo/Redo, Links)
 * - Image Insertion (File Picker, Drag & Drop, Clipboard Paste Ctrl+V) with Base64 & Attachments store
 * - Interactive To-do Checklists
 * - Realtime Autosave with Debounce and Status Badge
 * - Backwards Compatibility with Legacy Markdown Notes
 * - Fast Search & Filter (Subject, Topic, Tags)
 * - Responsive Desktop & Mobile with Drawer/Back Navigation
 */

import { getAll, saveItem, deleteItem, getById, softDeleteItem, restoreItem } from '../db.js';
import {
  generateId,
  SUBJECT_COLORS,
  getColorById,
  escapeHtml,
  formatDateVietnamese
} from '../utils/helpers.js';
import { confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

// Module State
let currentNotesData = [];
let availableSubjects = [];
let searchQuery = '';
let selectedSubject = 'all';
let selectedTopic = 'all';
let selectedTag = 'all';
let activeNoteId = null;
let autosaveTimer = null;
let lastSavedTime = null;
let isMobileEditorActive = false; // Controls mobile view: false = list, true = editor

/**
 * Initialize Notes Module
 */
export async function initNotesModule() {
  await loadNotesAndSubjects();
  // If there are notes and none is active, pick the first note
  if (!activeNoteId && currentNotesData.length > 0) {
    activeNoteId = currentNotesData[0].id;
  }
  renderNotesView();
}

/**
 * Load Notes and Subject catalog
 */
export async function loadNotesAndSubjects() {
  const allNotes = await getAll('notes');
  currentNotesData = allNotes.filter(n => !n.deletedAt);

  const [schedules, subjects] = await Promise.all([
    getAll('schedules'),
    getAll('subjects')
  ]);

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

/**
 * Render the OneNote Master-Detail Layout
 */
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
    if (selectedSubject !== 'all' && item.subjectName !== selectedSubject) return false;
    if (selectedTopic !== 'all' && item.topic !== selectedTopic) return false;
    if (selectedTag !== 'all' && (!item.tags || !item.tags.includes(selectedTag))) return false;

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

  // Verify active note exists
  let activeNote = currentNotesData.find(n => n.id === activeNoteId);
  if (!activeNote && filtered.length > 0) {
    activeNote = filtered[0];
    activeNoteId = activeNote.id;
  }

  container.innerHTML = `
    <!-- OneNote 2-Column Container -->
    <div class="h-[calc(100vh-6.5rem)] md:h-[calc(100vh-6rem)] flex flex-col md:flex-row bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden select-none">
      
      <!-- ==================== LEFT COLUMN: Notes Sidebar ==================== -->
      <aside id="notes-sidebar-panel" class="${isMobileEditorActive ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex-shrink-0 h-full overflow-hidden">
        
        <!-- Sidebar Top Header -->
        <div class="p-3.5 pb-2 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <i data-lucide="file-text" class="w-4 h-4"></i>
            </div>
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-white leading-tight">Ghi chú</h2>
              <span class="text-[11px] font-medium text-slate-400">${filtered.length} trang</span>
            </div>
          </div>

          <button id="btn-create-new-note" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-xs shadow-xs transition" title="Tạo trang ghi chú mới">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>Thêm mới</span>
          </button>
        </div>

        <!-- Search Bar -->
        <div class="p-3 pb-2 space-y-2">
          <div class="relative">
            <i data-lucide="search" class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
            <input
              type="text"
              id="sidebar-search-box"
              placeholder="Tìm kiếm ghi chú..."
              value="${escapeHtml(searchQuery)}"
              class="w-full pl-9 pr-7 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:border-emerald-500 transition"
            />
            ${searchQuery ? `
              <button id="btn-sidebar-clear-search" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5">
                <i data-lucide="x" class="w-3 h-3"></i>
              </button>
            ` : ''}
          </div>

          <!-- Quick Filters Row -->
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
            <select id="sidebar-filter-subject" class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-2 py-1 outline-none text-[11px] max-w-[130px] truncate">
              <option value="all">Tất cả môn</option>
              ${availableSubjects.map(s => `<option value="${escapeHtml(s)}" ${selectedSubject === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
            </select>

            ${topicsList.length > 0 ? `
              <select id="sidebar-filter-topic" class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-2 py-1 outline-none text-[11px] max-w-[110px] truncate">
                <option value="all">Chủ đề</option>
                ${topicsList.map(t => `<option value="${escapeHtml(t)}" ${selectedTopic === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
              </select>
            ` : ''}

            ${(selectedSubject !== 'all' || selectedTopic !== 'all' || selectedTag !== 'all' || searchQuery) ? `
              <button id="btn-sidebar-reset-filters" class="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 flex-shrink-0" title="Xóa bộ lọc">
                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Scrollable Notes List -->
        <div id="notes-sidebar-list" class="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 px-2 py-1 space-y-1">
          ${filtered.length === 0 ? `
            <div class="p-8 text-center text-slate-400 text-xs">
              <i data-lucide="file-x" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
              <p>Không có ghi chú phù hợp</p>
            </div>
          ` : filtered.map(item => {
            const isActive = activeNote && activeNote.id === item.id;
            const color = getColorById(item.color || 'emerald');
            const previewText = extractSnippetFromNote(item);
            const dateStr = formatDateVietnamese(new Date(item.updatedAt || item.createdAt || Date.now()));

            return `
              <div
                data-note-id="${item.id}"
                class="note-list-item cursor-pointer p-3 rounded-2xl transition-all select-none ${
                  isActive
                    ? 'bg-white dark:bg-slate-800 shadow-sm border border-emerald-500/30 ring-1 ring-emerald-500/20'
                    : 'hover:bg-white/60 dark:hover:bg-slate-800/50 border border-transparent'
                }"
              >
                <!-- Title & Pin icon -->
                <div class="flex items-center justify-between gap-1 mb-1">
                  <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate flex-1 ${isActive ? 'text-emerald-700 dark:text-emerald-400' : ''}">
                    ${escapeHtml(item.title || 'Ghi chú chưa đặt tên')}
                  </h4>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    ${item.isPinned ? `<i data-lucide="pin" class="w-3 h-3 text-amber-500 fill-amber-500"></i>` : ''}
                    <button data-action="delete-note-sidebar" data-id="${item.id}" class="btn-sidebar-delete-note opacity-0 hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 transition" title="Xóa vào thùng rác">
                      <i data-lucide="trash-2" class="w-3 h-3"></i>
                    </button>
                  </div>
                </div>

                <!-- Preview text -->
                <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-2">
                  ${escapeHtml(previewText)}
                </p>

                <!-- Footer: Badge & Date -->
                <div class="flex items-center justify-between text-[10px] text-slate-400">
                  <span class="px-2 py-0.5 rounded font-bold ${color.badge} text-white truncate max-w-[120px]">
                    ${escapeHtml(item.subjectName || 'Tự do')}
                  </span>
                  <span>${dateStr}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </aside>

      <!-- ==================== RIGHT COLUMN: OneNote Editor Workspace ==================== -->
      <main id="notes-editor-panel" class="${isMobileEditorActive ? 'flex' : 'hidden md:flex'} flex-1 flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
        ${activeNote ? renderNoteEditor(activeNote) : renderEmptyEditorPlaceholder()}
      </main>
    </div>
  `;

  // Attach event handlers
  setupOneNoteEvents(container);

  if (window.lucide) {
    window.lucide.createIcons({ root: container });
  }
}

/**
 * Render the Note Editor Workspace for a given note
 */
function renderNoteEditor(note) {
  const color = getColorById(note.color || 'emerald');
  const now = new Date(note.updatedAt || Date.now());
  const initialTimeStr = lastSavedTime || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Content resolution: prefer contentHtml, or convert markdown if legacy
  let initialHtml = note.contentHtml;
  if (!initialHtml && note.content) {
    initialHtml = convertMarkdownToRichHtml(note.content, note.id);
  }
  if (!initialHtml) {
    initialHtml = '<p><br></p>';
  }

  const tagsString = Array.isArray(note.tags) ? note.tags.join(', ') : (note.tags || '');

  return `
    <!-- Editor Header Toolbar (Back button, Autosave status, Quick Actions) -->
    <div class="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40 flex-shrink-0">
      <div class="flex items-center gap-2">
        <!-- Mobile Back Button -->
        <button id="btn-mobile-back-to-list" class="md:hidden flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-300 transition">
          <i data-lucide="chevron-left" class="w-4 h-4"></i>
          <span>Danh sách</span>
        </button>

        <!-- Autosave Status Badge -->
        <div id="editor-save-status" class="flex items-center gap-1.5 text-xs text-slate-400">
          <i data-lucide="check" class="w-3.5 h-3.5 text-emerald-500"></i>
          <span>Đã lưu lúc ${initialTimeStr}</span>
        </div>
      </div>

      <div class="flex items-center gap-1.5">
        <!-- Pin Toggle -->
        <button id="btn-editor-toggle-pin" class="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-slate-800 transition" title="${note.isPinned ? 'Bỏ ghim' : 'Ghim lên đầu'}">
          <i data-lucide="pin" class="w-4 h-4 ${note.isPinned ? 'fill-amber-500 text-amber-500' : ''}"></i>
        </button>

        <!-- Delete Note -->
        <button id="btn-editor-delete-note" class="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition" title="Xóa vào thùng rác">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    </div>

    <!-- Note Metadata Row -->
    <div class="px-6 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800/80 space-y-3 flex-shrink-0">
      <!-- Title Input -->
      <input
        type="text"
        id="note-editor-title"
        placeholder="Tiêu đề bài ghi chép..."
        value="${escapeHtml(note.title || '')}"
        class="w-full text-xl md:text-2xl font-black text-slate-900 dark:text-white bg-transparent outline-none border-b border-transparent focus:border-emerald-500/50 transition pb-1"
      />

      <!-- Meta selectors (Subject, Topic, Tags, Color) -->
      <div class="flex items-center gap-3 flex-wrap text-xs">
        <!-- Subject selector -->
        <div class="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <i data-lucide="book-open" class="w-3.5 h-3.5 text-slate-400"></i>
          <select id="note-editor-subject" class="bg-transparent text-slate-800 dark:text-slate-200 font-semibold outline-none text-xs">
            <option value="">Chọn môn học</option>
            ${availableSubjects.map(s => `<option value="${escapeHtml(s)}" ${note.subjectName === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
          </select>
        </div>

        <!-- Topic input -->
        <div class="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <i data-lucide="tag" class="w-3.5 h-3.5 text-slate-400"></i>
          <input
            type="text"
            id="note-editor-topic"
            placeholder="Chủ đề / Bài học..."
            value="${escapeHtml(note.topic || '')}"
            class="bg-transparent text-slate-800 dark:text-slate-200 text-xs outline-none w-28 md:w-36"
          />
        </div>

        <!-- Tags input -->
        <div class="flex items-center gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <i data-lucide="hash" class="w-3.5 h-3.5 text-slate-400"></i>
          <input
            type="text"
            id="note-editor-tags"
            placeholder="Thẻ tag (#toan, #onthi)..."
            value="${escapeHtml(tagsString)}"
            class="bg-transparent text-slate-800 dark:text-slate-200 text-xs outline-none w-32 md:w-44"
          />
        </div>

        <!-- Color selector -->
        <div class="flex items-center gap-1 ml-auto">
          ${SUBJECT_COLORS.slice(0, 5).map(c => `
            <button
              type="button"
              data-color="${c.id}"
              class="btn-note-color-picker w-4 h-4 rounded-full ${c.badge} transition transform hover:scale-125 ${note.color === c.id ? 'ring-2 ring-offset-2 ring-emerald-500' : ''}"
              title="${c.name}"
            ></button>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Rich Text Formatting Toolbar -->
    <div class="px-4 py-1.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700/80 flex items-center gap-1 flex-wrap text-xs overflow-x-auto no-scrollbar flex-shrink-0">
      <!-- Text formatting -->
      <button type="button" data-cmd="bold" class="rich-btn p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold" title="In đậm (Ctrl+B)">
        <i data-lucide="bold" class="w-3.5 h-3.5"></i>
      </button>
      <button type="button" data-cmd="italic" class="rich-btn p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200" title="In nghiêng (Ctrl+I)">
        <i data-lucide="italic" class="w-3.5 h-3.5"></i>
      </button>
      <button type="button" data-cmd="underline" class="rich-btn p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200" title="Gạch chân (Ctrl+U)">
        <i data-lucide="underline" class="w-3.5 h-3.5"></i>
      </button>
      <button type="button" data-cmd="strikeThrough" class="rich-btn p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200" title="Gạch ngang">
        <i data-lucide="strikethrough" class="w-3.5 h-3.5"></i>
      </button>

      <span class="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-1"></span>

      <!-- Headings & Block Formats -->
      <button type="button" data-cmd="formatBlock" data-val="h1" class="rich-btn px-2 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 font-black text-xs" title="Tiêu đề 1">
        H1
      </button>
      <button type="button" data-cmd="formatBlock" data-val="h2" class="rich-btn px-2 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs" title="Tiêu đề 2">
        H2
      </button>
      <button type="button" data-cmd="formatBlock" data-val="h3" class="rich-btn px-2 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-xs" title="Tiêu đề 3">
        H3
      </button>
      <button type="button" data-cmd="formatBlock" data-val="p" class="rich-btn px-1.5 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-xs" title="Đoạn văn">
        P
      </button>
      <button type="button" data-cmd="formatBlock" data-val="blockquote" class="rich-btn p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200" title="Trích dẫn">
        <i data-lucide="quote" class="w-3.5 h-3.5"></i>
      </button>

      <span class="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-1"></span>

      <!-- Lists -->
      <button type="button" data-cmd="insertUnorderedList" class="rich-btn p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200" title="Danh sách gạch đầu dòng">
        <i data-lucide="list" class="w-3.5 h-3.5"></i>
      </button>
      <button type="button" data-cmd="insertOrderedList" class="rich-btn p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200" title="Danh sách số thứ tự">
        <i data-lucide="list-ordered" class="w-3.5 h-3.5"></i>
      </button>

      <!-- Checklist (To-do) -->
      <button type="button" id="btn-insert-checklist" class="rich-btn flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-semibold transition" title="Chèn việc cần làm">
        <i data-lucide="check-square" class="w-3.5 h-3.5"></i>
        <span>To-do</span>
      </button>

      <span class="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-1"></span>

      <!-- Link & Image Insert -->
      <button type="button" id="btn-insert-link" class="rich-btn p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200" title="Chèn liên kết">
        <i data-lucide="link" class="w-3.5 h-3.5"></i>
      </button>

      <!-- Insert Image Button -->
      <button type="button" id="btn-trigger-upload-image" class="rich-btn flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-semibold transition" title="Chèn hình ảnh bài giảng">
        <i data-lucide="image" class="w-3.5 h-3.5"></i>
        <span>Chèn ảnh</span>
      </button>
      <input type="file" id="note-hidden-image-input" accept="image/png,image/jpeg,image/jpg,image/webp" class="hidden" />

      <span class="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-1"></span>

      <!-- Undo / Redo -->
      <button type="button" data-cmd="undo" class="rich-btn p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200" title="Hoàn tác (Ctrl+Z)">
        <i data-lucide="undo" class="w-3.5 h-3.5"></i>
      </button>
      <button type="button" data-cmd="redo" class="rich-btn p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200" title="Làm lại (Ctrl+Y)">
        <i data-lucide="redo" class="w-3.5 h-3.5"></i>
      </button>
    </div>

    <!-- Rich Text Editable Canvas Area -->
    <div class="flex-1 overflow-y-auto p-6 md:p-8 relative">
      <div
        id="note-editor-body"
        contenteditable="true"
        data-placeholder="Bắt đầu ghi chép nội dung bài học tại đây (có thể kéo thả hoặc dán Ctrl+V ảnh trực tiếp)..."
        class="note-editor-content min-h-[420px] outline-none text-slate-800 dark:text-slate-100 text-sm leading-relaxed"
      >${initialHtml}</div>
    </div>
  `;
}

/**
 * Placeholder when no note is selected
 */
function renderEmptyEditorPlaceholder() {
  return `
    <div class="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 select-none">
      <div class="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mb-4">
        <i data-lucide="file-edit" class="w-8 h-8"></i>
      </div>
      <h3 class="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">Không có trang ghi chú nào được chọn</h3>
      <p class="text-xs text-slate-400 max-w-sm mb-6">Chọn một ghi chú ở cột bên trái hoặc bấm nút bên dưới để tạo trang ghi chú bài học mới.</p>
      <button id="btn-placeholder-create" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-xs shadow-sm transition">
        + Tạo trang ghi chú mới
      </button>
    </div>
  `;
}

/**
 * Setup All OneNote Events (Sidebar clicks, Editor typing, Toolbar actions, Drag & Drop, Paste)
 */
function setupOneNoteEvents(container) {
  // 1. Create New Note button
  const createNewNote = async () => {
    const defaultSubject = availableSubjects[0] || 'Kỹ thuật số';
    const nowIso = new Date().toISOString();
    const newNote = {
      id: generateId(),
      title: 'Ghi chú mới',
      subjectId: '',
      subjectName: defaultSubject,
      topic: '',
      tags: [],
      content: '',
      contentHtml: '<p><br></p>',
      isPinned: false,
      color: 'emerald',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await saveItem('notes', newNote);
    await loadNotesAndSubjects();
    activeNoteId = newNote.id;
    isMobileEditorActive = true;
    renderNotesView();

    // Auto focus title input
    setTimeout(() => {
      const titleInput = document.getElementById('note-editor-title');
      if (titleInput) {
        titleInput.focus();
        titleInput.select();
      }
    }, 100);
  };

  const btnCreateNew = container.querySelector('#btn-create-new-note');
  if (btnCreateNew) btnCreateNew.addEventListener('click', createNewNote);

  const btnPlaceholderCreate = container.querySelector('#btn-placeholder-create');
  if (btnPlaceholderCreate) btnPlaceholderCreate.addEventListener('click', createNewNote);

  // 2. Select Note from sidebar
  container.querySelectorAll('.note-list-item').forEach(itemEl => {
    itemEl.addEventListener('click', (e) => {
      // If clicking delete button, don't select
      if (e.target.closest('[data-action="delete-note-sidebar"]')) return;

      const noteId = itemEl.getAttribute('data-note-id');
      if (noteId && noteId !== activeNoteId) {
        activeNoteId = noteId;
        isMobileEditorActive = true;
        renderNotesView();
      } else {
        isMobileEditorActive = true;
        renderNotesView();
      }
    });
  });

  // 3. Delete Note from sidebar
  container.querySelectorAll('[data-action="delete-note-sidebar"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      await deleteNoteWithUndo(id);
    });
  });

  // 4. Sidebar Search Box
  const searchBox = container.querySelector('#sidebar-search-box');
  if (searchBox) {
    searchBox.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderNotesView();
    });
  }

  const btnClearSearch = container.querySelector('#btn-sidebar-clear-search');
  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      searchQuery = '';
      renderNotesView();
    });
  }

  // 5. Sidebar Filters
  const filterSubject = container.querySelector('#sidebar-filter-subject');
  if (filterSubject) {
    filterSubject.addEventListener('change', (e) => {
      selectedSubject = e.target.value;
      renderNotesView();
    });
  }

  const filterTopic = container.querySelector('#sidebar-filter-topic');
  if (filterTopic) {
    filterTopic.addEventListener('change', (e) => {
      selectedTopic = e.target.value;
      renderNotesView();
    });
  }

  const btnResetFilters = container.querySelector('#btn-sidebar-reset-filters');
  if (btnResetFilters) {
    btnResetFilters.addEventListener('click', () => {
      searchQuery = '';
      selectedSubject = 'all';
      selectedTopic = 'all';
      selectedTag = 'all';
      renderNotesView();
    });
  }

  // 6. Mobile Back button (< Danh sách)
  const btnMobileBack = container.querySelector('#btn-mobile-back-to-list');
  if (btnMobileBack) {
    btnMobileBack.addEventListener('click', () => {
      isMobileEditorActive = false;
      renderNotesView();
    });
  }

  // ==================== EDITOR WORKSPACE EVENTS ====================
  const activeNote = currentNotesData.find(n => n.id === activeNoteId);
  if (!activeNote) return;

  const titleInput = container.querySelector('#note-editor-title');
  const subjectSelect = container.querySelector('#note-editor-subject');
  const topicInput = container.querySelector('#note-editor-topic');
  const tagsInput = container.querySelector('#note-editor-tags');
  const editorBody = container.querySelector('#note-editor-body');

  // Helper to trigger autosave debounce
  const triggerAutosave = () => {
    setAutosaveStatus('Đang lưu...');
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      await saveCurrentActiveNote();
    }, 600);
  };

  // Input listeners for metadata
  if (titleInput) titleInput.addEventListener('input', triggerAutosave);
  if (subjectSelect) subjectSelect.addEventListener('change', triggerAutosave);
  if (topicInput) topicInput.addEventListener('input', triggerAutosave);
  if (tagsInput) tagsInput.addEventListener('input', triggerAutosave);

  // Color picker
  container.querySelectorAll('.btn-note-color-picker').forEach(btn => {
    btn.addEventListener('click', () => {
      const col = btn.getAttribute('data-color');
      activeNote.color = col;
      container.querySelectorAll('.btn-note-color-picker').forEach(b => b.classList.remove('ring-2', 'ring-offset-2', 'ring-emerald-500'));
      btn.classList.add('ring-2', 'ring-offset-2', 'ring-emerald-500');
      triggerAutosave();
    });
  });

  // Pin toggle in editor
  const btnPin = container.querySelector('#btn-editor-toggle-pin');
  if (btnPin) {
    btnPin.addEventListener('click', async () => {
      activeNote.isPinned = !activeNote.isPinned;
      await saveCurrentActiveNote();
      renderNotesView();
      showToast(activeNote.isPinned ? 'Đã ghim ghi chú lên đầu' : 'Đã bỏ ghim ghi chú', 'info');
    });
  }

  // Delete note in editor
  const btnDelete = container.querySelector('#btn-editor-delete-note');
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      await deleteNoteWithUndo(activeNote.id);
    });
  }

  // ==================== RICH TEXT TOOLBAR COMMANDS ====================
  container.querySelectorAll('.rich-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cmd = btn.getAttribute('data-cmd');
      const val = btn.getAttribute('data-val') || null;

      if (cmd === 'formatBlock' && val) {
        document.execCommand('formatBlock', false, `<${val}>`);
      } else {
        document.execCommand(cmd, false, val);
      }
      editorBody.focus();
      triggerAutosave();
    });
  });

  // Link button
  const btnLink = container.querySelector('#btn-insert-link');
  if (btnLink) {
    btnLink.addEventListener('click', () => {
      const url = prompt('Nhập địa chỉ liên kết (URL):', 'https://');
      if (url && url !== 'https://') {
        document.execCommand('createLink', false, url);
        editorBody.focus();
        triggerAutosave();
      }
    });
  }

  // Checklist insertion button
  const btnChecklist = container.querySelector('#btn-insert-checklist');
  if (btnChecklist) {
    btnChecklist.addEventListener('click', () => {
      const todoHtml = `
        <div class="note-todo-item flex items-start gap-2 my-1" contenteditable="true">
          <input type="checkbox" class="note-checkbox mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" contenteditable="false">
          <span class="todo-text flex-1 outline-none">Nhiệm vụ mới</span>
        </div>
        <p><br></p>
      `;
      document.execCommand('insertHTML', false, todoHtml);
      editorBody.focus();
      triggerAutosave();
    });
  }

  // Image Upload trigger button
  const btnTriggerImage = container.querySelector('#btn-trigger-upload-image');
  const hiddenImageInput = container.querySelector('#note-hidden-image-input');
  if (btnTriggerImage && hiddenImageInput) {
    btnTriggerImage.addEventListener('click', () => {
      hiddenImageInput.click();
    });

    hiddenImageInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        await insertImageIntoEditor(file, editorBody, activeNote.id);
      }
      hiddenImageInput.value = '';
      triggerAutosave();
    });
  }

  // ==================== EDITOR INTERACTION (Typing, Checkbox, Drag & Drop, Paste) ====================
  if (editorBody) {
    // Typing in editor
    editorBody.addEventListener('input', triggerAutosave);

    // Interactive Checkbox click inside editor
    editorBody.addEventListener('click', (e) => {
      const checkbox = e.target.closest('.note-checkbox');
      if (checkbox) {
        const isChecked = checkbox.checked;
        if (isChecked) {
          checkbox.setAttribute('checked', 'checked');
        } else {
          checkbox.removeAttribute('checked');
        }
        const todoText = checkbox.closest('.note-todo-item')?.querySelector('.todo-text');
        if (todoText) {
          todoText.classList.toggle('line-through', isChecked);
          todoText.classList.toggle('text-slate-400', isChecked);
          todoText.classList.toggle('dark:text-slate-500', isChecked);
        }
        triggerAutosave();
      }
    });

    // Clipboard Paste (Ctrl+V) with image detection
    editorBody.addEventListener('paste', async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await insertImageIntoEditor(file, editorBody, activeNote.id);
            triggerAutosave();
          }
          return;
        }
      }
    });

    // Drag & Drop image files
    editorBody.addEventListener('dragover', (e) => {
      e.preventDefault();
      editorBody.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50/10');
    });

    editorBody.addEventListener('dragleave', () => {
      editorBody.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-50/10');
    });

    editorBody.addEventListener('drop', async (e) => {
      e.preventDefault();
      editorBody.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-50/10');
      const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type && f.type.startsWith('image/'));
      for (const file of files) {
        await insertImageIntoEditor(file, editorBody, activeNote.id);
      }
      if (files.length > 0) {
        triggerAutosave();
      }
    });
  }
}

/**
 * Save current active note to IndexedDB
 */
async function saveCurrentActiveNote() {
  const note = currentNotesData.find(n => n.id === activeNoteId);
  if (!note) return;

  const titleInput = document.getElementById('note-editor-title');
  const subjectSelect = document.getElementById('note-editor-subject');
  const topicInput = document.getElementById('note-editor-topic');
  const tagsInput = document.getElementById('note-editor-tags');
  const editorBody = document.getElementById('note-editor-body');

  if (titleInput) note.title = titleInput.value.trim() || 'Ghi chú chưa đặt tên';
  if (subjectSelect) note.subjectName = subjectSelect.value;
  if (topicInput) note.topic = topicInput.value.trim();

  if (tagsInput) {
    const raw = tagsInput.value.trim();
    note.tags = raw
      ? raw.split(',').map(t => {
          let clean = t.trim();
          if (clean && !clean.startsWith('#')) clean = '#' + clean;
          return clean;
        }).filter(Boolean)
      : [];
  }

  if (editorBody) {
    note.contentHtml = editorBody.innerHTML;
    note.content = extractSnippetFromHtml(editorBody.innerHTML);
  }

  note.updatedAt = new Date().toISOString();

  await saveItem('notes', note);

  // Update last saved time
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  lastSavedTime = timeStr;
  setAutosaveStatus(`Đã lưu lúc ${timeStr}`);

  // Update item in sidebar without breaking user focus in editor
  updateSidebarItem(note);
}

/**
 * Update single sidebar item text/badges smoothly without full re-render
 */
function updateSidebarItem(note) {
  const itemEl = document.querySelector(`.note-list-item[data-note-id="${note.id}"]`);
  if (!itemEl) return;

  const titleEl = itemEl.querySelector('h4');
  if (titleEl) titleEl.textContent = note.title;

  const previewEl = itemEl.querySelector('p');
  if (previewEl) previewEl.textContent = extractSnippetFromNote(note);

  const subjectBadge = itemEl.querySelector('span.rounded');
  if (subjectBadge) {
    subjectBadge.textContent = note.subjectName || 'Tự do';
    const col = getColorById(note.color || 'emerald');
    subjectBadge.className = `px-2 py-0.5 rounded font-bold ${col.badge} text-white truncate max-w-[120px]`;
  }
}

/**
 * Set Autosave Status text
 */
function setAutosaveStatus(text) {
  const statusEl = document.getElementById('editor-save-status');
  if (!statusEl) return;

  if (text.includes('Đang lưu')) {
    statusEl.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span> <span class="text-amber-500 font-medium">Đang lưu...</span>`;
  } else {
    statusEl.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-500"></i> <span class="text-slate-400 dark:text-slate-500">${text}</span>`;
    if (window.lucide) window.lucide.createIcons({ root: statusEl });
  }
}

/**
 * Delete note with 30-day soft delete and Undo Toast
 */
async function deleteNoteWithUndo(noteId) {
  const note = currentNotesData.find(n => n.id === noteId);
  if (!note) return;

  await softDeleteItem('notes', noteId);
  await loadNotesAndSubjects();

  if (activeNoteId === noteId) {
    activeNoteId = currentNotesData.length > 0 ? currentNotesData[0].id : null;
  }

  renderNotesView();

  showToast(`Đã chuyển ghi chú "${note.title}" vào thùng rác`, 'info', 5000, {
    label: 'Hoàn tác',
    onClick: async () => {
      await restoreItem('notes', noteId);
      await loadNotesAndSubjects();
      activeNoteId = noteId;
      renderNotesView();
      showToast(`Đã khôi phục ghi chú "${note.title}" thành công!`, 'success');
    }
  });
}

/**
 * Read image file, save in attachments store, and insert into editor
 */
async function insertImageIntoEditor(file, editorBody, noteId) {
  if (!file || !file.type.startsWith('image/')) return;

  const MAX_SIZE = 15 * 1024 * 1024; // 15MB
  if (file.size > MAX_SIZE) {
    showToast(`Ảnh "${file.name}" vượt quá giới hạn 15MB!`, 'error');
    return;
  }

  try {
    const base64Data = await readFileAsDataURL(file);
    const imageId = `att_img_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Save image to attachments store
    await saveItem('attachments', {
      id: imageId,
      name: file.name || 'image.png',
      size: file.size,
      type: file.type || 'image/png',
      entityType: 'note-image',
      entityId: String(noteId),
      data: base64Data,
      createdAt: new Date().toISOString()
    });

    // Create image container in editor
    const imgHtml = `
      <div class="note-image-container my-3 select-none text-center" contenteditable="false">
        <img src="${base64Data}" data-attachment-id="${imageId}" class="note-embedded-image rounded-2xl max-w-full h-auto inline-block border border-slate-200 dark:border-slate-700/80 shadow-sm" alt="${escapeHtml(file.name || 'Slide')}" />
      </div>
      <p><br></p>
    `;

    editorBody.focus();
    document.execCommand('insertHTML', false, imgHtml);
    showToast('Đã chèn ảnh bài giảng thành công!', 'success');
  } catch (err) {
    console.error('Image upload error:', err);
    showToast('Lỗi khi tải ảnh lên!', 'error');
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Backward compatibility: Convert Markdown text from old notes into Rich Text HTML
 */
function convertMarkdownToRichHtml(rawContent, noteId) {
  if (!rawContent) return '<p><br></p>';

  const lines = rawContent.split('\n');
  let html = '';

  lines.forEach((line) => {
    const trimmed = line.trim();

    // Checkbox unchecked
    if (trimmed.startsWith('- [ ] ')) {
      const taskText = escapeHtml(trimmed.substring(6));
      html += `
        <div class="note-todo-item flex items-start gap-2 my-1" contenteditable="true">
          <input type="checkbox" class="note-checkbox mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" contenteditable="false" />
          <span class="todo-text flex-1 outline-none">${taskText}</span>
        </div>
      `;
      return;
    }

    // Checkbox checked
    if (trimmed.startsWith('- [x] ') || trimmed.startsWith('- [X] ')) {
      const taskText = escapeHtml(trimmed.substring(6));
      html += `
        <div class="note-todo-item flex items-start gap-2 my-1" contenteditable="true">
          <input type="checkbox" checked class="note-checkbox mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" contenteditable="false" />
          <span class="todo-text flex-1 outline-none line-through text-slate-400 dark:text-slate-500">${taskText}</span>
        </div>
      `;
      return;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      html += `<h3 class="text-base font-bold my-1 text-slate-900 dark:text-white">${escapeHtml(trimmed.substring(4))}</h3>`;
      return;
    }
    if (trimmed.startsWith('## ')) {
      html += `<h2 class="text-lg font-bold my-1.5 text-slate-900 dark:text-white">${escapeHtml(trimmed.substring(3))}</h2>`;
      return;
    }
    if (trimmed.startsWith('# ')) {
      html += `<h1 class="text-xl font-bold my-2 text-slate-900 dark:text-white">${escapeHtml(trimmed.substring(2))}</h1>`;
      return;
    }

    // Bullet list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      html += `<p class="flex items-start gap-1.5 ml-2 my-0.5 text-slate-700 dark:text-slate-300"><span class="text-emerald-500 font-bold">•</span><span>${formatInlineMarkdown(trimmed.substring(2))}</span></p>`;
      return;
    }

    // Blank line
    if (trimmed.length === 0) {
      html += `<p><br></p>`;
      return;
    }

    // Regular line
    html += `<p class="my-0.5 leading-relaxed text-slate-700 dark:text-slate-300">${formatInlineMarkdown(trimmed)}</p>`;
  });

  return html;
}

function formatInlineMarkdown(text) {
  let str = escapeHtml(text);
  str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  str = str.replace(/`(.*?)`/g, '<code class="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs text-indigo-600 dark:text-indigo-400">$1</code>');
  return str;
}

/**
 * Extract plain text summary from Note for preview in sidebar & search
 */
function extractSnippetFromNote(note) {
  if (note.content) {
    return note.content.replace(/#+\s+/g, '').replace(/-\s+\[[ xX]\]\s+/g, '').replace(/[*_`]/g, '').trim().slice(0, 120);
  }
  if (note.contentHtml) {
    return extractSnippetFromHtml(note.contentHtml).slice(0, 120);
  }
  return 'Không có nội dung';
}

function extractSnippetFromHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.innerText || tmp.textContent || '').trim();
}

/**
 * Compatibility Export: openNoteFormModal(editingItem)
 * When called from outside (e.g. mobile quick-add button in app.js or dashboard links),
 * switches to that note and activates the editor view.
 */
export function openNoteFormModal(editingItem = null) {
  if (editingItem && editingItem.id) {
    activeNoteId = editingItem.id;
    isMobileEditorActive = true;
    renderNotesView();
  } else {
    // Create new blank note
    const btnNew = document.getElementById('btn-create-new-note');
    if (btnNew) {
      btnNew.click();
    } else {
      initNotesModule().then(() => {
        const b = document.getElementById('btn-create-new-note');
        if (b) b.click();
      });
    }
  }
}
