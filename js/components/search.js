/**
 * Global Search Command Palette (Ctrl+K / Cmd+K)
 * Fast client-side fuzzy search across Notes, Mindmaps, Image Notes, and Schedules.
 */

import { getAll } from '../db.js';
import { escapeHtml } from '../utils/helpers.js';

let isPaletteOpen = false;
let searchModalElement = null;
let currentResults = [];
let selectedResultIndex = 0;

export function initGlobalSearch() {
  // Listen for Ctrl+K / Cmd+K
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleSearchPalette();
    } else if (e.key === 'Escape' && isPaletteOpen) {
      closeSearchPalette();
    }
  });

  // Attach button triggers
  const btnTrigger = document.getElementById('btn-global-search');
  if (btnTrigger) {
    btnTrigger.addEventListener('click', openSearchPalette);
  }

  const btnMobileTrigger = document.getElementById('btn-global-search-mobile');
  if (btnMobileTrigger) {
    btnMobileTrigger.addEventListener('click', openSearchPalette);
  }
}

export function toggleSearchPalette() {
  if (isPaletteOpen) {
    closeSearchPalette();
  } else {
    openSearchPalette();
  }
}

export function openSearchPalette() {
  if (isPaletteOpen) return;
  isPaletteOpen = true;

  // Create Palette overlay
  searchModalElement = document.createElement('div');
  searchModalElement.id = 'global-search-modal';
  searchModalElement.className = 'fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-24 px-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in select-none';

  searchModalElement.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] animate-scale-up" onclick="event.stopPropagation()">
      <!-- Search Input Bar -->
      <div class="p-3 md:p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <i data-lucide="search" class="w-5 h-5 text-indigo-500 flex-shrink-0"></i>
        <input
          id="global-search-input"
          type="text"
          placeholder="Tìm kiếm môn học, ghi chú, sơ đồ tư duy, ảnh slide..."
          class="flex-1 bg-transparent border-none outline-none text-sm md:text-base text-slate-900 dark:text-white placeholder-slate-400"
          autocomplete="off"
        />
        <div class="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
          <kbd class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">ESC</kbd>
          <span>để đóng</span>
        </div>
        <button id="btn-close-palette" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 sm:hidden">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <!-- Search Results Area -->
      <div id="search-results-container" class="flex-1 overflow-y-auto p-3 space-y-4 max-h-[60vh]">
        <div class="py-12 text-center text-slate-400 text-xs">
          <div class="w-10 h-10 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mb-2">
            <i data-lucide="compass" class="w-5 h-5"></i>
          </div>
          <p class="font-semibold text-slate-600 dark:text-slate-300">Nhập từ khóa để tìm kiếm trong StudyHub</p>
          <p class="text-[11px] mt-0.5">Hỗ trợ tìm kiếm theo tên môn, phòng học, nội dung bài ghi, nút sơ đồ...</p>
        </div>
      </div>

      <!-- Footer Help Hints -->
      <div class="px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div class="flex items-center gap-3">
          <span><kbd class="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">↑</kbd> <kbd class="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">↓</kbd> Di chuyển</span>
          <span><kbd class="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">↵</kbd> Mở</span>
        </div>
        <span id="search-result-count" class="font-medium"></span>
      </div>
    </div>
  `;

  // Close on backdrop click
  searchModalElement.addEventListener('click', (e) => {
    if (e.target === searchModalElement) {
      closeSearchPalette();
    }
  });

  document.body.appendChild(searchModalElement);

  if (window.lucide) {
    window.lucide.createIcons({ root: searchModalElement });
  }

  const input = searchModalElement.querySelector('#global-search-input');
  const closeBtn = searchModalElement.querySelector('#btn-close-palette');
  if (closeBtn) closeBtn.addEventListener('click', closeSearchPalette);

  if (input) {
    input.focus();
    let debounceTimer = null;
    input.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        executeGlobalSearch(e.target.value.trim());
      }, 150);
    });

    input.addEventListener('keydown', handleKeyNavigation);
  }
}

export function closeSearchPalette() {
  if (!isPaletteOpen) return;
  isPaletteOpen = false;
  if (searchModalElement && searchModalElement.parentNode) {
    searchModalElement.parentNode.removeChild(searchModalElement);
  }
  searchModalElement = null;
  currentResults = [];
  selectedResultIndex = 0;
}

function handleKeyNavigation(e) {
  if (currentResults.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedResultIndex = (selectedResultIndex + 1) % currentResults.length;
    updateSelectionHighlight();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedResultIndex = (selectedResultIndex - 1 + currentResults.length) % currentResults.length;
    updateSelectionHighlight();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const target = currentResults[selectedResultIndex];
    if (target) {
      selectResultItem(target);
    }
  }
}

function updateSelectionHighlight() {
  if (!searchModalElement) return;
  const items = searchModalElement.querySelectorAll('.search-result-row');
  items.forEach((item, index) => {
    if (index === selectedResultIndex) {
      item.classList.add('bg-indigo-50', 'dark:bg-slate-800', 'border-indigo-400');
      item.classList.remove('border-transparent');
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      item.classList.remove('bg-indigo-50', 'dark:bg-slate-800', 'border-indigo-400');
      item.classList.add('border-transparent');
    }
  });
}

function highlightMatch(text, query) {
  if (!text || !query) return escapeHtml(text || '');
  const str = String(text);
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escapeHtml(str).replace(regex, '<mark class="bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 rounded px-0.5 font-bold">$1</mark>');
}

async function executeGlobalSearch(query) {
  const container = searchModalElement?.querySelector('#search-results-container');
  const countEl = searchModalElement?.querySelector('#search-result-count');
  if (!container) return;

  if (!query) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400 text-xs">
        <div class="w-10 h-10 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mb-2">
          <i data-lucide="compass" class="w-5 h-5"></i>
        </div>
        <p class="font-semibold text-slate-600 dark:text-slate-300">Nhập từ khóa để tìm kiếm trong StudyHub</p>
        <p class="text-[11px] mt-0.5">Hỗ trợ tìm kiếm theo tên môn, phòng học, nội dung bài ghi, nút sơ đồ...</p>
      </div>
    `;
    if (countEl) countEl.textContent = '';
    currentResults = [];
    if (window.lucide) window.lucide.createIcons({ root: container });
    return;
  }

  const qLower = query.toLowerCase();

  const [schedules, notes, mindmaps, imageNotes] = await Promise.all([
    getAll('schedules'),
    getAll('notes'),
    getAll('mindmaps'),
    getAll('imageNotes')
  ]);

  // 1. Schedules
  const matchedSchedules = (schedules || []).filter(s => {
    return (s.subjectName && s.subjectName.toLowerCase().includes(qLower)) ||
      (s.subjectCode && s.subjectCode.toLowerCase().includes(qLower)) ||
      (s.room && s.room.toLowerCase().includes(qLower)) ||
      (s.lecturer && s.lecturer.toLowerCase().includes(qLower));
  }).map(s => ({
    type: 'schedule',
    typeLabel: 'Thời khóa biểu',
    icon: 'calendar',
    color: 'indigo',
    viewId: 'schedule',
    id: s.id,
    title: s.subjectName,
    subtitle: `${s.subjectCode || ''} • Thứ ${s.dayOfWeek === 8 ? 'CN' : s.dayOfWeek} (${s.startTime} - ${s.endTime}) • Phòng ${s.room || 'Chưa rõ'}`,
    matchedSnippet: s.lecturer ? `Giảng viên: ${s.lecturer}` : ''
  }));

  // 2. Notes
  const matchedNotes = (notes || []).filter(n => !n.deletedAt).filter(n => {
    return (n.title && n.title.toLowerCase().includes(qLower)) ||
      (n.content && n.content.toLowerCase().includes(qLower)) ||
      (n.subjectName && n.subjectName.toLowerCase().includes(qLower)) ||
      (n.topic && n.topic.toLowerCase().includes(qLower)) ||
      (n.tags && Array.isArray(n.tags) && n.tags.some(t => t.toLowerCase().includes(qLower)));
  }).map(n => ({
    type: 'notes',
    typeLabel: 'Ghi chú bài học',
    icon: 'file-text',
    color: 'emerald',
    viewId: 'notes',
    id: n.id,
    title: n.title,
    subtitle: `Môn: ${n.subjectName || 'Chung'} ${n.topic ? `• Chủ đề: ${n.topic}` : ''}`,
    matchedSnippet: (n.content || '').slice(0, 120)
  }));

  // 3. Mindmaps
  const matchedMindmaps = (mindmaps || []).filter(m => !m.deletedAt).filter(m => {
    const titleMatch = m.title && m.title.toLowerCase().includes(qLower);
    const nodesMatch = (m.nodes || []).some(node => node.text && node.text.toLowerCase().includes(qLower));
    return titleMatch || nodesMatch;
  }).map(m => {
    const matchedNode = (m.nodes || []).find(n => n.text && n.text.toLowerCase().includes(qLower));
    return {
      type: 'mindmap',
      typeLabel: 'Sơ đồ tư duy',
      icon: 'git-merge',
      color: 'amber',
      viewId: 'mindmap',
      id: m.id,
      title: m.title,
      subtitle: `Môn: ${m.subjectName || 'Chung'} • ${(m.nodes || []).length} nút khái niệm`,
      matchedSnippet: matchedNode ? `Nút khớp: "${matchedNode.text}"` : ''
    };
  });

  // 4. Image Notes
  const matchedImageNotes = (imageNotes || []).filter(img => !img.deletedAt).filter(img => {
    const titleMatch = img.title && img.title.toLowerCase().includes(qLower);
    const annoMatch = (img.annotations || []).some(a =>
      (a.title && a.title.toLowerCase().includes(qLower)) ||
      (a.comment && a.comment.toLowerCase().includes(qLower))
    );
    return titleMatch || annoMatch;
  }).map(img => {
    const matchedAnno = (img.annotations || []).find(a =>
      (a.title && a.title.toLowerCase().includes(qLower)) ||
      (a.comment && a.comment.toLowerCase().includes(qLower))
    );
    return {
      type: 'imageNotes',
      typeLabel: 'Chú thích ảnh',
      icon: 'image',
      color: 'rose',
      viewId: 'imageNotes',
      id: img.id,
      title: img.title,
      subtitle: `Môn: ${img.subjectName || 'Chung'} • ${(img.annotations || []).length} điểm đánh dấu`,
      matchedSnippet: matchedAnno ? `Chú thích: "${matchedAnno.comment || matchedAnno.title}"` : ''
    };
  });

  currentResults = [
    ...matchedSchedules,
    ...matchedNotes,
    ...matchedMindmaps,
    ...matchedImageNotes
  ];

  selectedResultIndex = 0;

  if (countEl) {
    countEl.textContent = `${currentResults.length} kết quả tìm thấy`;
  }

  if (currentResults.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400 text-xs">
        <div class="w-10 h-10 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
          <i data-lucide="search-x" class="w-5 h-5"></i>
        </div>
        <p class="font-semibold text-slate-700 dark:text-slate-300">Không tìm thấy kết quả nào cho "${escapeHtml(query)}"</p>
        <p class="text-[11px] mt-0.5 text-slate-400">Hãy thử tìm với từ khóa ngắn gọn hơn hoặc tên môn học.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons({ root: container });
    return;
  }

  // Render grouped results
  const groups = [
    { type: 'schedule', title: '📅 Thời khóa biểu', items: matchedSchedules },
    { type: 'notes', title: '📝 Ghi chú bài học', items: matchedNotes },
    { type: 'mindmap', title: '🧠 Sơ đồ tư duy', items: matchedMindmaps },
    { type: 'imageNotes', title: '🖼️ Chú thích ảnh Slide', items: matchedImageNotes }
  ].filter(g => g.items.length > 0);

  let html = '';
  let globalIndex = 0;

  groups.forEach(group => {
    html += `
      <div class="space-y-1">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
          ${group.title} (${group.items.length})
        </div>
        <div class="space-y-1">
          ${group.items.map(item => {
            const isSelected = globalIndex === selectedResultIndex;
            const rowHtml = `
              <div
                class="search-result-row flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                  isSelected ? 'bg-indigo-50 dark:bg-slate-800 border-indigo-400' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }"
                data-index="${globalIndex}"
              >
                <div class="p-2 rounded-lg bg-${item.color}-50 dark:bg-${item.color}-950/60 text-${item.color}-600 dark:text-${item.color}-400 flex-shrink-0 mt-0.5">
                  <i data-lucide="${item.icon}" class="w-4 h-4"></i>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs md:text-sm font-bold text-slate-900 dark:text-white truncate">
                    ${highlightMatch(item.title, query)}
                  </div>
                  <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    ${escapeHtml(item.subtitle)}
                  </div>
                  ${item.matchedSnippet ? `
                    <div class="text-[11px] text-slate-400 dark:text-slate-500 italic mt-1 line-clamp-1">
                      ${highlightMatch(item.matchedSnippet, query)}
                    </div>
                  ` : ''}
                </div>
                <span class="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 flex-shrink-0">
                  ${item.typeLabel}
                </span>
              </div>
            `;
            globalIndex++;
            return rowHtml;
          }).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  if (window.lucide) {
    window.lucide.createIcons({ root: container });
  }

  // Click handlers
  container.querySelectorAll('.search-result-row').forEach(row => {
    row.addEventListener('click', () => {
      const idx = parseInt(row.getAttribute('data-index'), 10);
      const target = currentResults[idx];
      if (target) {
        selectResultItem(target);
      }
    });
  });
}

function selectResultItem(item) {
  closeSearchPalette();
  if (window.studyHubApp && window.studyHubApp.switchView) {
    window.studyHubApp.switchView(item.viewId);
  }
}
