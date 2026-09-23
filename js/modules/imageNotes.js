/**
 * Image Notes (Chú thích ảnh Slide / Bảng viết) Module
 * Upload, Drag & Drop, Clipboard Paste (Ctrl+V), Interactive Pins & Annotations, Dual-Pane View, and Auto-save.
 */

import { getAll, saveItem, deleteItem, getById } from '../db.js';
import {
  generateId,
  SUBJECT_COLORS,
  getColorById,
  escapeHtml,
  formatDateVietnamese
} from '../utils/helpers.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';

let currentImageNotes = [];
let activeImageNote = null; // Currently open image note, null = gallery
let activePinId = null;
let currentTool = 'pin'; // 'pin' | 'view'
let imageZoom = 1;

export async function initImageNotesModule() {
  await loadImageNotes();
  renderImageNotesView();
}

export async function loadImageNotes() {
  currentImageNotes = await getAll('imageNotes');
  currentImageNotes.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  return currentImageNotes;
}

export function renderImageNotesView() {
  const container = document.getElementById('image-notes-view');
  if (!container) return;

  if (activeImageNote) {
    renderAnnotationStudio(container);
  } else {
    renderImageNotesGallery(container);
  }

  if (window.lucide) {
    window.lucide.createIcons({ root: container });
  }
}

/**
 * 1. Image Notes Gallery View
 */
function renderImageNotesGallery(container) {
  container.innerHTML = `
    <!-- Gallery Header -->
    <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Chú thích ảnh Slide / Bảng viết</h2>
          <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
            ${currentImageNotes.length} bài giảng
          </span>
        </div>
        <p class="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Tải ảnh bài giảng, cắm mốc ghim đánh số và ghi chép chi tiết từng vị trí slide
        </p>
      </div>

      <div>
        <button id="btn-upload-image-note" class="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-medium text-xs md:text-sm rounded-xl shadow-sm transition">
          <i data-lucide="upload" class="w-4 h-4"></i>
          <span>Tải ảnh bài giảng mới</span>
        </button>
      </div>
    </div>

    <!-- Gallery Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      ${currentImageNotes.length === 0 ? `
        <div class="col-span-full bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center max-w-md mx-auto shadow-sm">
          <div class="w-16 h-16 mx-auto rounded-3xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
            <i data-lucide="image" class="w-8 h-8"></i>
          </div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white">Chưa có ảnh bài giảng nào</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5 mb-6">Tải lên ảnh chụp slide hoặc ảnh chụp bảng viết để bắt đầu gắn chú thích!</p>
          <button id="btn-upload-empty" class="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-semibold shadow-sm transition">
            + Tải ảnh lên ngay
          </button>
        </div>
      ` : currentImageNotes.map(item => {
        const pinCount = (item.annotations || []).length;
        const formattedDate = formatDateVietnamese(new Date(item.updatedAt || item.createdAt || Date.now()));

        return `
          <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
            <div>
              <div class="flex items-center justify-between gap-2 mb-3">
                <span class="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                  ${escapeHtml(item.subjectName || 'Chung')}
                </span>
                <span class="text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                  <i data-lucide="map-pin" class="w-3.5 h-3.5"></i>
                  ${pinCount} điểm chú thích
                </span>
              </div>

              <!-- Image Thumbnail Preview -->
              <div class="w-full h-40 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 overflow-hidden mb-3.5 relative flex items-center justify-center">
                ${item.imageData ? `
                  <img src="${item.imageData}" alt="${escapeHtml(item.title)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                ` : `
                  <i data-lucide="image" class="w-8 h-8 text-slate-400"></i>
                `}
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-2.5">
                  <span class="text-[10px] text-white/90 font-medium">${pinCount} ghim ghi chú trên ảnh</span>
                </div>
              </div>

              <h4 class="text-base font-bold text-slate-900 dark:text-white line-clamp-1 mb-1">
                ${escapeHtml(item.title)}
              </h4>
              <p class="text-xs text-slate-400">Cập nhật: ${formattedDate}</p>
            </div>

            <!-- Card Actions -->
            <div class="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between gap-2">
              <button data-action="open" data-id="${item.id}" class="btn-open-image-note flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition">
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                Xem &amp; Gắn chú thích
              </button>

              <div class="flex items-center gap-1">
                <button data-action="delete" data-id="${item.id}" class="btn-delete-image-note p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 transition" title="Xóa">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Events
  const btnUpload = container.querySelector('#btn-upload-image-note');
  if (btnUpload) btnUpload.addEventListener('click', () => openUploadImageModal());

  const btnUploadEmpty = container.querySelector('#btn-upload-empty');
  if (btnUploadEmpty) btnUploadEmpty.addEventListener('click', () => openUploadImageModal());

  container.querySelectorAll('.btn-open-image-note').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const item = currentImageNotes.find(n => n.id === id);
      if (item) {
        activeImageNote = JSON.parse(JSON.stringify(item));
        activePinId = (activeImageNote.annotations[0] && activeImageNote.annotations[0].id) || null;
        imageZoom = 1;
        currentTool = 'pin';
        renderImageNotesView();
      }
    });
  });

  container.querySelectorAll('.btn-delete-image-note').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const item = currentImageNotes.find(n => n.id === id);
      if (!item) return;

      const confirmed = await confirmDialog({
        title: 'Xóa bài giảng ảnh',
        message: `Bạn có chắc chắn muốn xóa bài ảnh "${item.title}" cùng toàn bộ chú thích?`,
        confirmText: 'Xóa vĩnh viễn'
      });

      if (confirmed) {
        await deleteItem('imageNotes', id);
        await loadImageNotes();
        renderImageNotesView();
        showToast(`Đã xóa bài ảnh "${item.title}"`, 'success');
      }
    });
  });
}

/**
 * 2. Annotation Studio (Dual-Pane Interactive View)
 */
function renderAnnotationStudio(container) {
  const annotations = activeImageNote.annotations || [];

  container.innerHTML = `
    <!-- Top Toolbar -->
    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 mb-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <button id="btn-back-img-gallery" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition">
          <i data-lucide="arrow-left" class="w-4 h-4"></i>
          <span>Danh sách ảnh</span>
        </button>

        <div>
          <h3 class="text-sm md:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>${escapeHtml(activeImageNote.title)}</span>
            <span class="text-[10px] px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-semibold">${escapeHtml(activeImageNote.subjectName || '')}</span>
          </h3>
        </div>
      </div>

      <!-- Tools -->
      <div class="flex items-center gap-2 flex-wrap text-xs">
        <!-- Pin Tool Indicator -->
        <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-medium">
          <i data-lucide="map-pin" class="w-4 h-4 text-rose-600"></i>
          <span>Click vào ảnh để cắm ghim mới</span>
        </div>

        <!-- Zoom Controls -->
        <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <button id="btn-img-zoom-out" class="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Thu nhỏ">
            <i data-lucide="zoom-out" class="w-3.5 h-3.5"></i>
          </button>
          <span id="img-zoom-label" class="px-1 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">100%</span>
          <button id="btn-img-zoom-in" class="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Phóng to">
            <i data-lucide="zoom-in" class="w-3.5 h-3.5"></i>
          </button>
          <button id="btn-img-zoom-reset" class="px-2 py-1 text-[10px] font-bold rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Đặt lại">
            100%
          </button>
        </div>

        <!-- Save Button -->
        <button id="btn-save-img-note" class="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-semibold transition shadow-sm">
          <i data-lucide="save" class="w-3.5 h-3.5"></i>
          <span>Lưu chú thích</span>
        </button>
      </div>
    </div>

    <!-- Dual-Pane Workspace (Desktop: Side-by-Side, Mobile: Stacked) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <!-- Left Pane: Image Canvas with Interactive Pinpoints (Col 1 to 7) -->
      <div class="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col justify-between">
        <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
          <span class="text-slate-500 font-semibold flex items-center gap-1">
            <i data-lucide="image" class="w-4 h-4"></i>
            Khu vực xem ảnh bài giảng
          </span>
          <span class="text-slate-400 text-[11px]">Click để thêm điểm chú thích</span>
        </div>

        <!-- Scrollable/Zoomable Image Container -->
        <div id="image-canvas-viewport" class="relative w-full rounded-2xl bg-slate-950 overflow-auto flex items-center justify-center p-2 min-h-[380px] max-h-[580px]">
          <div id="image-wrapper" class="relative inline-block select-none" style="transform: scale(${imageZoom}); transform-origin: center center; transition: transform 0.15s ease-out;">
            <img
              id="annotated-image"
              src="${activeImageNote.imageData}"
              alt="${escapeHtml(activeImageNote.title)}"
              class="max-w-full h-auto block rounded-lg cursor-crosshair shadow-lg pointer-events-auto"
            />

            <!-- Pins Layer Overlay -->
            <div id="pins-overlay" class="absolute inset-0 pointer-events-none">
              ${renderPinsOverlay(annotations)}
            </div>
          </div>
        </div>

        <div class="pt-3 text-[11px] text-slate-400 flex items-center justify-between">
          <span>📌 ${annotations.length} vị trí đã được đánh dấu</span>
          <span>Bấm vào ghim số để nhảy tới phần giải thích</span>
        </div>
      </div>

      <!-- Right Pane: Annotations List & Editor (Col 8 to 12) -->
      <div class="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col h-[650px]">
        <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-2">
            <i data-lucide="list-checks" class="w-4 h-4 text-rose-600"></i>
            <h4 class="text-sm font-bold text-slate-900 dark:text-white">
              Bảng chú thích chi tiết (${annotations.length})
            </h4>
          </div>

          <button id="btn-add-pin-manual" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition flex items-center gap-1">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            Thêm chú thích
          </button>
        </div>

        <!-- Annotations Scrollable List -->
        <div id="annotations-list" class="flex-1 overflow-y-auto space-y-3 pr-1">
          ${annotations.length === 0 ? `
            <div class="h-64 flex flex-col items-center justify-center text-center p-6">
              <div class="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center mb-3">
                <i data-lucide="map-pin" class="w-6 h-6"></i>
              </div>
              <p class="text-xs font-bold text-slate-700 dark:text-slate-300">Chưa có chú thích nào trên ảnh</p>
              <p class="text-[11px] text-slate-400 mt-1 max-w-[200px]">Hãy nhấp chuột vào một điểm bất kỳ trên ảnh slide để cắm ghim số 1!</p>
            </div>
          ` : annotations.map(anno => renderAnnotationCard(anno, anno.id === activePinId)).join('')}
        </div>
      </div>
    </div>
  `;

  // Attach Studio Events
  setupAnnotationStudioEvents(container);
}

/**
 * Render Pin Markers on top of image
 */
function renderPinsOverlay(annotations) {
  return annotations.map(anno => {
    const isActive = anno.id === activePinId;

    return `
      <div
        data-id="${anno.id}"
        class="pin-marker absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-125 select-none ${
          isActive ? 'scale-125 z-30' : 'z-20'
        }"
        style="left: ${anno.xPercent}%; top: ${anno.yPercent}%;"
        title="${escapeHtml(anno.title || `Điểm ${anno.number}`)}"
      >
        <div class="relative flex items-center justify-center">
          ${isActive ? '<span class="absolute w-8 h-8 rounded-full bg-rose-500/40 animate-ping"></span>' : ''}
          <div class="w-7 h-7 rounded-full bg-rose-600 text-white font-extrabold text-xs flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-900 ${
            isActive ? 'ring-2 ring-amber-400 bg-rose-700' : ''
          }">
            ${anno.number}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render Annotation Card in the right pane
 */
function renderAnnotationCard(anno, isActive = false) {
  return `
    <div
      id="card-anno-${anno.id}"
      data-id="${anno.id}"
      class="anno-card bg-slate-50 dark:bg-slate-800/80 rounded-2xl border transition-all duration-150 p-3.5 cursor-pointer ${
        isActive
          ? 'border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20 shadow-md bg-white dark:bg-slate-800'
          : 'border-slate-200 dark:border-slate-700/80 hover:border-rose-300'
      }"
    >
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-full bg-rose-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0">
            ${anno.number}
          </span>
          <span class="font-bold text-xs md:text-sm text-slate-900 dark:text-white truncate">
            ${escapeHtml(anno.title || `Vị trí #${anno.number}`)}
          </span>
        </div>

        <div class="flex items-center gap-1 flex-shrink-0">
          <button data-action="edit" data-id="${anno.id}" class="btn-edit-anno p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="Chỉnh sửa nội dung">
            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
          </button>
          <button data-action="delete" data-id="${anno.id}" class="btn-delete-anno p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="Xóa ghim">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>

      <div class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-8">
        ${escapeHtml(anno.comment || 'Chưa có nội dung chú thích. Bấm nút sửa để thêm.')}
      </div>

      <div class="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400 pl-8">
        <span>Tọa độ: (${Math.round(anno.xPercent)}%, ${Math.round(anno.yPercent)}%)</span>
        <button class="btn-focus-pin text-rose-600 dark:text-rose-400 font-bold hover:underline" data-id="${anno.id}">
          Định vị trên ảnh →
        </button>
      </div>
    </div>
  `;
}

/**
 * Setup Studio Interaction Events
 */
function setupAnnotationStudioEvents(container) {
  // Back to Gallery
  container.querySelector('#btn-back-img-gallery').addEventListener('click', async () => {
    await autoSaveActiveImageNote();
    activeImageNote = null;
    await loadImageNotes();
    renderImageNotesView();
  });

  // Save Button
  container.querySelector('#btn-save-img-note').addEventListener('click', async () => {
    await autoSaveActiveImageNote();
    showToast('Đã lưu các điểm chú thích trên ảnh thành công!', 'success');
  });

  // Zoom handling
  const imgWrapper = container.querySelector('#image-wrapper');
  const zoomLabel = container.querySelector('#img-zoom-label');
  const setZoom = (z) => {
    imageZoom = Math.min(2.5, Math.max(0.5, z));
    if (imgWrapper) imgWrapper.style.transform = `scale(${imageZoom})`;
    if (zoomLabel) zoomLabel.textContent = `${Math.round(imageZoom * 100)}%`;
  };

  container.querySelector('#btn-img-zoom-in').addEventListener('click', () => setZoom(imageZoom + 0.2));
  container.querySelector('#btn-img-zoom-out').addEventListener('click', () => setZoom(imageZoom - 0.2));
  container.querySelector('#btn-img-zoom-reset').addEventListener('click', () => setZoom(1.0));

  // Click on Image to ADD PINPOINT
  const imgEl = container.querySelector('#annotated-image');
  if (imgEl) {
    imgEl.addEventListener('click', (e) => {
      const rect = imgEl.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Calculate percentage coordinate
      const xPercent = Math.max(1, Math.min(99, (clickX / rect.width) * 100));
      const yPercent = Math.max(1, Math.min(99, (clickY / rect.height) * 100));

      const newNumber = (activeImageNote.annotations || []).length + 1;
      const newPin = {
        id: generateId(),
        type: 'pin',
        number: newNumber,
        xPercent,
        yPercent,
        title: `Chú thích vị trí #${newNumber}`,
        comment: 'Nội dung giải thích slide hoặc ghi chú lời giảng viên...'
      };

      activeImageNote.annotations = activeImageNote.annotations || [];
      activeImageNote.annotations.push(newPin);
      activePinId = newPin.id;

      autoSaveActiveImageNote();
      renderAnnotationStudio(container);

      // Open edit modal directly for the newly created pin
      openEditAnnotationModal(newPin);
    });
  }

  // Pin overlay click handlers
  container.querySelectorAll('.pin-marker').forEach(marker => {
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = marker.getAttribute('data-id');
      selectPin(id, container);
    });
  });

  // Card click handlers
  container.querySelectorAll('.anno-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const id = card.getAttribute('data-id');
      selectPin(id, container);
    });
  });

  // Edit annotation button
  container.querySelectorAll('.btn-edit-anno').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const anno = (activeImageNote.annotations || []).find(a => a.id === id);
      if (anno) openEditAnnotationModal(anno);
    });
  });

  // Delete annotation button
  container.querySelectorAll('.btn-delete-anno').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const anno = (activeImageNote.annotations || []).find(a => a.id === id);
      if (!anno) return;

      const confirmed = await confirmDialog({
        title: 'Xóa điểm chú thích',
        message: `Bạn có chắc muốn xóa điểm chú thích số ${anno.number}?`,
        confirmText: 'Xóa ghim'
      });

      if (confirmed) {
        activeImageNote.annotations = activeImageNote.annotations.filter(a => a.id !== id);
        // Re-number remaining pins
        activeImageNote.annotations.forEach((a, idx) => { a.number = idx + 1; });
        activePinId = (activeImageNote.annotations[0] && activeImageNote.annotations[0].id) || null;
        await autoSaveActiveImageNote();
        renderAnnotationStudio(container);
        showToast('Đã xóa điểm chú thích', 'info');
      }
    });
  });

  // Focus pin button
  container.querySelectorAll('.btn-focus-pin').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      selectPin(id, container);
    });
  });

  // Add pin manual button
  const btnAddManual = container.querySelector('#btn-add-pin-manual');
  if (btnAddManual) {
    btnAddManual.addEventListener('click', () => {
      showToast('Hãy nhấp chuột trực tiếp lên vị trí bạn muốn gắn chú thích trên ảnh!', 'info');
    });
  }
}

function selectPin(pinId, container) {
  activePinId = pinId;

  // Update pin markers classes
  container.querySelectorAll('.pin-marker').forEach(m => {
    const isThis = m.getAttribute('data-id') === pinId;
    m.classList.toggle('scale-125', isThis);
    m.classList.toggle('z-30', isThis);
    const inner = m.querySelector('.w-7');
    if (inner) {
      inner.classList.toggle('ring-2', isThis);
      inner.classList.toggle('ring-amber-400', isThis);
    }
  });

  // Update card highlights and scroll into view
  container.querySelectorAll('.anno-card').forEach(c => {
    const isThis = c.getAttribute('data-id') === pinId;
    if (isThis) {
      c.className = 'anno-card bg-white dark:bg-slate-800 rounded-2xl border border-rose-500 ring-2 ring-rose-500/20 shadow-md p-3.5 cursor-pointer';
      c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      c.className = 'anno-card bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 hover:border-rose-300 p-3.5 cursor-pointer';
    }
  });
}

function openEditAnnotationModal(anno) {
  const modalHtml = `
    <div class="p-6">
      <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
        <h3 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span class="w-6 h-6 rounded-full bg-rose-600 text-white font-black text-xs flex items-center justify-center">
            ${anno.number}
          </span>
          <span>Chỉnh sửa chú thích #${anno.number}</span>
        </h3>
        <button id="modal-close-anno" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="form-anno" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Tiêu đề điểm chú thích <span class="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="anno-title-input"
            required
            placeholder="VD: Cấu trúc Header HTTP Request"
            value="${escapeHtml(anno.title || '')}"
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold outline-none focus:border-rose-500 transition"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Nội dung chi tiết / Lời giải thích của giảng viên <span class="text-rose-500">*</span>
          </label>
          <textarea
            id="anno-comment-input"
            rows="5"
            required
            placeholder="Ghi chú chi tiết về vị trí này trên slide, công thức hoặc lưu ý câu hỏi thi..."
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs md:text-sm leading-relaxed outline-none focus:border-rose-500 transition"
          >${escapeHtml(anno.comment || '')}</textarea>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button type="button" id="btn-cancel-anno" class="px-4 py-2 rounded-xl text-xs md:text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Hủy
          </button>
          <button type="submit" class="px-5 py-2 rounded-xl text-xs md:text-sm font-semibold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white transition shadow-sm">
            Lưu chú thích
          </button>
        </div>
      </form>
    </div>
  `;

  const modal = openModal(modalHtml, { size: 'max-w-md' });
  const wrapper = modal.wrapper;

  wrapper.querySelector('#modal-close-anno').addEventListener('click', () => modal.close());
  wrapper.querySelector('#btn-cancel-anno').addEventListener('click', () => modal.close());

  const form = wrapper.querySelector('#form-anno');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    anno.title = wrapper.querySelector('#anno-title-input').value.trim();
    anno.comment = wrapper.querySelector('#anno-comment-input').value.trim();

    await autoSaveActiveImageNote();
    const container = document.getElementById('image-notes-view');
    if (container) renderAnnotationStudio(container);
    modal.close();
    showToast(`Đã lưu chú thích điểm ${anno.number}`, 'success');
  });

  if (window.lucide) {
    window.lucide.createIcons({ root: wrapper });
  }
}

async function autoSaveActiveImageNote() {
  if (!activeImageNote) return;
  activeImageNote.updatedAt = new Date().toISOString();
  await saveItem('imageNotes', activeImageNote);
}

/**
 * Open Modal to Upload New Slide Image
 */
export function openUploadImageModal() {
  let loadedImageData = null;

  const modalHtml = `
    <div class="p-6">
      <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
        <h3 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <i data-lucide="image-plus" class="w-5 h-5 text-rose-500"></i>
          <span>Tải ảnh bài giảng / slide mới</span>
        </h3>
        <button id="modal-close-upload" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="form-upload-image" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Tiêu đề bài giảng / Slide <span class="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="upload-title-input"
            required
            placeholder="VD: Slide Chương 4: Cây cân bằng AVL"
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-rose-500 transition"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Môn học liên quan
          </label>
          <input
            type="text"
            id="upload-subject-input"
            placeholder="VD: Lập trình Web, Cấu trúc Dữ liệu..."
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-rose-500 transition"
          />
        </div>

        <!-- Drag & Drop Zone -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Chọn tệp ảnh hoặc Dán ảnh (Ctrl+V) <span class="text-rose-500">*</span>
          </label>

          <div
            id="dropzone"
            class="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-rose-500 rounded-2xl p-6 text-center transition cursor-pointer bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center min-h-[160px]"
          >
            <div id="dropzone-empty" class="space-y-2">
              <div class="w-12 h-12 mx-auto rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center">
                <i data-lucide="upload-cloud" class="w-6 h-6"></i>
              </div>
              <p class="text-xs font-bold text-slate-800 dark:text-slate-200">
                Nhấp để chọn tệp hoặc kéo thả ảnh vào đây
              </p>
              <p class="text-[11px] text-slate-400">
                Hỗ trợ PNG, JPG, WebP. Hoặc nhấn <kbd class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-bold">Ctrl + V</kbd> khi chụp màn hình.
              </p>
            </div>

            <!-- Preview image when loaded -->
            <img id="upload-preview" class="hidden max-h-48 rounded-xl object-contain shadow-md" alt="Preview" />
          </div>

          <input type="file" id="file-input-image" accept="image/*" class="hidden" />
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button type="button" id="btn-cancel-upload" class="px-4 py-2 rounded-xl text-xs md:text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Hủy
          </button>
          <button type="submit" class="px-5 py-2 rounded-xl text-xs md:text-sm font-semibold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white transition shadow-sm">
            Tạo &amp; Bắt đầu chú thích
          </button>
        </div>
      </form>
    </div>
  `;

  const modal = openModal(modalHtml, { size: 'max-w-lg' });
  const wrapper = modal.wrapper;

  wrapper.querySelector('#modal-close-upload').addEventListener('click', () => modal.close());
  wrapper.querySelector('#btn-cancel-upload').addEventListener('click', () => modal.close());

  const dropzone = wrapper.querySelector('#dropzone');
  const fileInput = wrapper.querySelector('#file-input-image');
  const emptyState = wrapper.querySelector('#dropzone-empty');
  const previewImg = wrapper.querySelector('#upload-preview');

  const processFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Vui lòng chọn đúng tệp hình ảnh!', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      loadedImageData = e.target.result;
      previewImg.src = loadedImageData;
      previewImg.classList.remove('hidden');
      emptyState.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  };

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  });

  // Drag & drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-rose-500', 'bg-rose-50/30');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-rose-500', 'bg-rose-50/30');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-rose-500', 'bg-rose-50/30');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  });

  // Paste from clipboard (Ctrl+V)
  const handlePaste = (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        processFile(file);
        showToast('Đã dán ảnh từ clipboard!', 'info');
        break;
      }
    }
  };
  document.addEventListener('paste', handlePaste);

  // Submit
  const form = wrapper.querySelector('#form-upload-image');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = wrapper.querySelector('#upload-title-input').value.trim();
    const subjectName = wrapper.querySelector('#upload-subject-input').value.trim();

    if (!title) {
      showToast('Vui lòng nhập tiêu đề bài giảng!', 'warning');
      return;
    }
    if (!loadedImageData) {
      showToast('Vui lòng chọn hoặc dán hình ảnh bài giảng!', 'warning');
      return;
    }

    const newImageNote = {
      id: generateId(),
      title,
      subjectName,
      imageData: loadedImageData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      annotations: []
    };

    await saveItem('imageNotes', newImageNote);
    activeImageNote = newImageNote;
    activePinId = null;

    document.removeEventListener('paste', handlePaste);
    await loadImageNotes();
    renderImageNotesView();
    modal.close();
    showToast(`Đã tải ảnh "${title}" thành công!`, 'success');
  });

  if (window.lucide) {
    window.lucide.createIcons({ root: wrapper });
  }
}
