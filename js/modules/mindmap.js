/**
 * Mind Map (Sơ đồ tư duy) Module
 * Visual recursive tree, draggable nodes, bezier connections, inline editing, zoom/pan, auto-save, and PNG export.
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

let currentMindmaps = [];
let activeMindmap = null; // Currently open mindmap in editor, null means gallery view
let selectedNodeId = null;
let scale = 1;
let panOffset = { x: 0, y: 0 };
let isPanning = false;
let startPanPos = { x: 0, y: 0 };
let draggedNode = null;
let dragStartPos = { x: 0, y: 0 };

export async function initMindMapModule() {
  await loadMindmaps();
  renderMindMapView();
}

export async function loadMindmaps() {
  const allMindmaps = await getAll('mindmaps');
  currentMindmaps = allMindmaps.filter(m => !m.deletedAt);
  currentMindmaps.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  return currentMindmaps;
}

export function renderMindMapView() {
  const container = document.getElementById('mindmap-view');
  if (!container) return;

  if (activeMindmap) {
    renderMindMapStudio(container);
  } else {
    renderMindMapGallery(container);
  }

  if (window.lucide) {
    window.lucide.createIcons({ root: container });
  }
}

/**
 * 1. Mind Map Gallery View (List of diagrams)
 */
function renderMindMapGallery(container) {
  container.innerHTML = `
    <!-- Gallery Header -->
    <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Sơ đồ tư duy (Mind Map)</h2>
          <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            ${currentMindmaps.length} sơ đồ
          </span>
        </div>
        <p class="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Tổ chức kiến thức trực quan, kéo-thả nhánh, kết nối ý tưởng và ghi nhớ lâu dài
        </p>
      </div>

      <div>
        <button id="btn-create-mindmap" class="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-medium text-xs md:text-sm rounded-xl shadow-sm transition">
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>Tạo sơ đồ mới</span>
        </button>
      </div>
    </div>

    <!-- Gallery Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      ${currentMindmaps.length === 0 ? `
        <div class="col-span-full bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center max-w-md mx-auto shadow-sm">
          <div class="w-16 h-16 mx-auto rounded-3xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
            <i data-lucide="git-merge" class="w-8 h-8"></i>
          </div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white">Chưa có sơ đồ tư duy nào</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5 mb-6">Bấm vào nút bên dưới để tạo sơ đồ tư duy bài học đầu tiên!</p>
          <button id="btn-create-mindmap-empty" class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-semibold shadow-sm transition">
            + Bắt đầu vẽ sơ đồ
          </button>
        </div>
      ` : currentMindmaps.map(item => {
        const rootNode = (item.nodes || []).find(n => n.isRoot) || item.nodes[0] || { text: item.title };
        const nodeCount = (item.nodes || []).length;
        const formattedDate = formatDateVietnamese(new Date(item.updatedAt || item.createdAt || Date.now()));

        return `
          <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group">
            <div>
              <div class="flex items-center justify-between gap-2 mb-3">
                <span class="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                  ${escapeHtml(item.subjectName || 'Chung')}
                </span>
                <span class="text-xs text-slate-400 flex items-center gap-1">
                  <i data-lucide="network" class="w-3.5 h-3.5"></i>
                  ${nodeCount} nhánh
                </span>
              </div>

              <!-- Canvas Preview Thumbnail Placeholder -->
              <div class="w-full h-32 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center justify-center mb-3.5 relative overflow-hidden group-hover:border-amber-400/50 transition">
                <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-xs max-w-[85%] truncate">
                  <i data-lucide="git-commit" class="w-3.5 h-3.5 text-amber-500 flex-shrink-0"></i>
                  <span class="truncate">${escapeHtml(rootNode.text)}</span>
                </div>
              </div>

              <h4 class="text-base font-bold text-slate-900 dark:text-white line-clamp-1 mb-1">
                ${escapeHtml(item.title)}
              </h4>
              <p class="text-xs text-slate-400">Cập nhật: ${formattedDate}</p>
            </div>

            <!-- Card Actions -->
            <div class="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between gap-2">
              <button data-action="open" data-id="${item.id}" class="btn-open-mindmap flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-semibold shadow-xs transition">
                <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                Mở chỉnh sửa
              </button>

              <div class="flex items-center gap-1">
                <button data-action="rename" data-id="${item.id}" class="btn-rename-mindmap p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 transition" title="Đổi tên">
                  <i data-lucide="edit-2" class="w-4 h-4"></i>
                </button>
                <button data-action="delete" data-id="${item.id}" class="btn-delete-mindmap p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 transition" title="Xóa">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Gallery Events
  const btnCreate = container.querySelector('#btn-create-mindmap');
  if (btnCreate) btnCreate.addEventListener('click', () => openCreateMindMapModal());

  const btnCreateEmpty = container.querySelector('#btn-create-mindmap-empty');
  if (btnCreateEmpty) btnCreateEmpty.addEventListener('click', () => openCreateMindMapModal());

  container.querySelectorAll('.btn-open-mindmap').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const mm = currentMindmaps.find(m => m.id === id);
      if (mm) {
        activeMindmap = JSON.parse(JSON.stringify(mm)); // Deep clone for editing
        selectedNodeId = (activeMindmap.nodes[0] && activeMindmap.nodes[0].id) || null;
        panOffset = { x: 0, y: 0 };
        scale = 1;
        renderMindMapView();
      }
    });
  });

  container.querySelectorAll('.btn-rename-mindmap').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const mm = currentMindmaps.find(m => m.id === id);
      if (mm) openCreateMindMapModal(mm);
    });
  });

  container.querySelectorAll('.btn-delete-mindmap').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const mm = currentMindmaps.find(m => m.id === id);
      if (!mm) return;

      await softDeleteItem('mindmaps', id);
      await loadMindmaps();
      renderMindMapView();

      showToast(`Đã chuyển sơ đồ "${mm.title}" vào thùng rác`, 'info', 5000, {
        label: 'Hoàn tác',
        onClick: async () => {
          await restoreItem('mindmaps', id);
          await loadMindmaps();
          renderMindMapView();
          showToast(`Đã khôi phục sơ đồ "${mm.title}" thành công!`, 'success');
        }
      });
    });
  });
}

/**
 * 2. Mind Map Studio / Canvas View (Interactive Editor)
 */
function renderMindMapStudio(container) {
  const selectedNode = activeMindmap.nodes.find(n => n.id === selectedNodeId) || activeMindmap.nodes[0];

  container.innerHTML = `
    <!-- Studio Header Toolbar -->
    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 mb-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <!-- Back & Title -->
      <div class="flex items-center gap-3">
        <button id="btn-back-gallery" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition">
          <i data-lucide="arrow-left" class="w-4 h-4"></i>
          <span>Danh sách</span>
        </button>

        <div>
          <h3 class="text-sm md:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>${escapeHtml(activeMindmap.title)}</span>
            <span class="text-[10px] px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-semibold">${escapeHtml(activeMindmap.subjectName || '')}</span>
          </h3>
        </div>
      </div>

      <!-- Action Tools -->
      <div class="flex items-center gap-2 flex-wrap text-xs">
        <!-- Add child node -->
        <button id="btn-add-child" class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition shadow-xs" title="Thêm nhánh con (Phím Tab)">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          <span>+ Nhánh con (Tab)</span>
        </button>

        <!-- Add sibling node -->
        <button id="btn-add-sibling" class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition shadow-xs" title="Thêm nhánh ngang hàng (Phím Enter)">
          <i data-lucide="corner-down-right" class="w-3.5 h-3.5"></i>
          <span>+ Cùng cấp (Enter)</span>
        </button>

        <!-- Color selector for selected node -->
        <div class="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <span class="text-[11px] text-slate-400 font-medium mr-1">Màu:</span>
          ${SUBJECT_COLORS.slice(0, 5).map(c => `
            <button data-color="${c.id}" class="btn-change-node-color w-4 h-4 rounded-full ${c.badge} transition transform hover:scale-125 ${selectedNode && selectedNode.color === c.id ? 'ring-2 ring-offset-1 ring-indigo-500' : ''}" title="${c.name}"></button>
          `).join('')}
        </div>

        <!-- Delete selected node -->
        <button id="btn-delete-node" class="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 transition" title="Xóa nhánh đã chọn (Phím Delete)">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>

        <!-- Zoom Controls -->
        <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
          <button id="btn-zoom-out" class="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Thu nhỏ">
            <i data-lucide="zoom-out" class="w-3.5 h-3.5"></i>
          </button>
          <span id="zoom-label" class="px-1 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">100%</span>
          <button id="btn-zoom-in" class="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Phóng to">
            <i data-lucide="zoom-in" class="w-3.5 h-3.5"></i>
          </button>
          <button id="btn-zoom-reset" class="px-2 py-1 text-[10px] font-bold rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300" title="Căn giữa">
            Giữa
          </button>
        </div>

        <!-- Export PNG -->
        <button id="btn-export-png" class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition" title="Xuất file ảnh PNG">
          <i data-lucide="image-down" class="w-3.5 h-3.5"></i>
          <span>Xuất PNG</span>
        </button>

        <!-- Save Button -->
        <button id="btn-save-mindmap" class="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-semibold transition shadow-sm">
          <i data-lucide="save" class="w-3.5 h-3.5"></i>
          <span>Lưu</span>
        </button>
      </div>
    </div>

    <!-- Canvas Workspace Viewport -->
    <div id="mindmap-viewport" class="relative w-full h-[620px] bg-slate-100/80 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden cursor-grab active:cursor-grabbing select-none shadow-inner" style="background-image: radial-gradient(rgba(148, 163, 184, 0.25) 1px, transparent 1px); background-size: 24px 24px;">
      <!-- Transform Canvas Container -->
      <div id="mindmap-canvas" class="absolute origin-top-left" style="transform: translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale}); width: 3000px; height: 3000px;">
        <!-- SVG Connections Layer -->
        <svg id="mindmap-svg" class="absolute inset-0 w-full h-full pointer-events-none"></svg>

        <!-- HTML Nodes Layer -->
        <div id="mindmap-nodes-layer" class="absolute inset-0"></div>
      </div>

      <!-- Instruction hints banner at bottom -->
      <div class="absolute bottom-3 left-3 right-3 sm:right-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-3 shadow-md pointer-events-none">
        <span class="flex items-center gap-1"><kbd class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-bold">Tab</kbd> Nhánh con</span>
        <span class="flex items-center gap-1"><kbd class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-bold">Enter</kbd> Cùng cấp</span>
        <span class="flex items-center gap-1"><kbd class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-bold">Kéo chuột</kbd> Di chuyển</span>
        <span class="flex items-center gap-1"><kbd class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px] font-bold">Nhấp đúp</kbd> Sửa chữ</span>
      </div>
    </div>
  `;

  // Draw nodes & connections
  drawMindMapContent();

  // Setup Canvas Interactions
  setupMindMapStudioEvents(container);
}

/**
 * Draw all nodes and connecting bezier curves
 */
function drawMindMapContent() {
  const svg = document.getElementById('mindmap-svg');
  const nodesLayer = document.getElementById('mindmap-nodes-layer');
  if (!svg || !nodesLayer || !activeMindmap) return;

  // Render SVG Paths
  let pathsHtml = '';
  activeMindmap.nodes.forEach(node => {
    if (node.parentId) {
      const parent = activeMindmap.nodes.find(n => n.id === node.parentId);
      if (parent) {
        const startX = parent.x + 90;
        const startY = parent.y + 20;
        const endX = node.x;
        const endY = node.y + 20;

        // Cubic Bezier curve
        const dx = Math.abs(endX - startX) * 0.5;
        const cp1x = startX + dx;
        const cp1y = startY;
        const cp2x = endX - dx;
        const cp2y = endY;

        const colorObj = getColorById(node.color || 'indigo');
        pathsHtml += `
          <path
            d="M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}"
            fill="none"
            stroke="${colorObj.hex}"
            stroke-width="2.5"
            stroke-linecap="round"
            opacity="0.85"
          />
        `;
      }
    }
  });
  svg.innerHTML = pathsHtml;

  // Render HTML Nodes
  nodesLayer.innerHTML = activeMindmap.nodes.map(node => {
    const isSelected = node.id === selectedNodeId;
    const isRoot = node.isRoot;
    const colorObj = getColorById(node.color || (isRoot ? 'indigo' : 'sky'));

    return `
      <div
        id="node-${node.id}"
        data-id="${node.id}"
        class="mindmap-node absolute cursor-move select-none transition-shadow ${
          isRoot
            ? 'px-5 py-3 rounded-2xl bg-indigo-600 text-white font-extrabold text-sm md:text-base shadow-lg shadow-indigo-500/25 border-2 border-indigo-400'
            : `px-3.5 py-2 rounded-xl ${colorObj.bgLight} ${colorObj.darkBg} font-bold text-xs md:text-sm shadow-xs hover:shadow-md border-2 ${colorObj.darkBg.split(' ')[1]}`
        } ${isSelected ? 'ring-4 ring-offset-2 ring-amber-400 z-30' : 'z-20'}"
        style="left: ${node.x}px; top: ${node.y}px; min-width: 120px; max-width: 260px;"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="node-text truncate flex-1" title="${escapeHtml(node.text)}">
            ${escapeHtml(node.text)}
          </div>
          <button data-id="${node.id}" class="btn-node-add-child p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/20 text-current transition" title="Thêm nhánh con">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) {
    window.lucide.createIcons({ root: nodesLayer });
  }

  // Attach node interaction events (click, drag, double-click inline edit)
  attachNodeInteractions(nodesLayer);
}

/**
 * Handle Node interactions: Dragging, Inline editing, Selection
 */
function attachNodeInteractions(nodesLayer) {
  nodesLayer.querySelectorAll('.mindmap-node').forEach(el => {
    const nodeId = el.getAttribute('data-id');

    // Selection on click
    el.addEventListener('pointerdown', (e) => {
      // If clicking child add button, don't drag
      if (e.target.closest('.btn-node-add-child')) return;

      e.stopPropagation();
      selectedNodeId = nodeId;
      draggedNode = activeMindmap.nodes.find(n => n.id === nodeId);
      dragStartPos = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        nodeX: draggedNode.x,
        nodeY: draggedNode.y
      };

      // Set active pointer capture
      el.setPointerCapture(e.pointerId);
      drawMindMapContent();
    });

    el.addEventListener('pointermove', (e) => {
      if (draggedNode && draggedNode.id === nodeId) {
        const dx = (e.clientX - dragStartPos.mouseX) / scale;
        const dy = (e.clientY - dragStartPos.mouseY) / scale;
        draggedNode.x = Math.round(dragStartPos.nodeX + dx);
        draggedNode.y = Math.round(dragStartPos.nodeY + dy);
        drawMindMapContent();
      }
    });

    el.addEventListener('pointerup', (e) => {
      if (draggedNode && draggedNode.id === nodeId) {
        draggedNode = null;
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
        autoSaveActiveMindmap();
      }
    });

    // Double click to inline edit
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startInlineEditNode(el, nodeId);
    });

    // Add child button on node
    const addChildBtn = el.querySelector('.btn-node-add-child');
    if (addChildBtn) {
      addChildBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedNodeId = nodeId;
        addChildNode();
      });
    }
  });
}

function startInlineEditNode(nodeEl, nodeId) {
  const textDiv = nodeEl.querySelector('.node-text');
  if (!textDiv) return;

  const node = activeMindmap.nodes.find(n => n.id === nodeId);
  if (!node) return;

  const currentText = node.text;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentText;
  input.className = 'w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-1.5 py-0.5 rounded border border-indigo-500 text-xs font-bold outline-none';

  textDiv.innerHTML = '';
  textDiv.appendChild(input);
  input.focus();
  input.select();

  const finishEdit = () => {
    const newText = input.value.trim();
    if (newText) {
      node.text = newText;
      autoSaveActiveMindmap();
    }
    drawMindMapContent();
  };

  input.addEventListener('blur', finishEdit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      finishEdit();
    } else if (e.key === 'Escape') {
      drawMindMapContent();
    }
  });
}

/**
 * Setup Canvas Workspace Drag & Pan, Zoom, and Keyboard shortcuts
 */
function setupMindMapStudioEvents(container) {
  const viewport = container.querySelector('#mindmap-viewport');
  const canvas = container.querySelector('#mindmap-canvas');

  // Back to Gallery
  container.querySelector('#btn-back-gallery').addEventListener('click', async () => {
    await autoSaveActiveMindmap();
    activeMindmap = null;
    await loadMindmaps();
    renderMindMapView();
  });

  // Canvas Pan (Drag background to pan)
  viewport.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.mindmap-node')) return;
    isPanning = true;
    startPanPos = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    viewport.style.cursor = 'grabbing';
  });

  window.addEventListener('pointermove', (e) => {
    if (!isPanning) return;
    panOffset.x = e.clientX - startPanPos.x;
    panOffset.y = e.clientY - startPanPos.y;
    canvas.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`;
  });

  window.addEventListener('pointerup', () => {
    if (isPanning) {
      isPanning = false;
      viewport.style.cursor = 'grab';
    }
  });

  // Zoom handling
  const updateZoom = (newScale) => {
    scale = Math.min(2.0, Math.max(0.4, newScale));
    canvas.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`;
    const label = container.querySelector('#zoom-label');
    if (label) label.textContent = `${Math.round(scale * 100)}%`;
  };

  container.querySelector('#btn-zoom-in').addEventListener('click', () => updateZoom(scale + 0.15));
  container.querySelector('#btn-zoom-out').addEventListener('click', () => updateZoom(scale - 0.15));
  container.querySelector('#btn-zoom-reset').addEventListener('click', () => {
    panOffset = { x: 0, y: 0 };
    updateZoom(1.0);
  });

  // Mouse wheel zoom
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    updateZoom(scale + delta);
  }, { passive: false });

  // Add Child Node action
  container.querySelector('#btn-add-child').addEventListener('click', addChildNode);

  // Add Sibling Node action
  container.querySelector('#btn-add-sibling').addEventListener('click', addSiblingNode);

  // Change Color of selected node
  container.querySelectorAll('.btn-change-node-color').forEach(btn => {
    btn.addEventListener('click', () => {
      const col = btn.getAttribute('data-color');
      const node = activeMindmap.nodes.find(n => n.id === selectedNodeId);
      if (node) {
        node.color = col;
        drawMindMapContent();
        autoSaveActiveMindmap();
      }
    });
  });

  // Delete Node action
  container.querySelector('#btn-delete-node').addEventListener('click', deleteSelectedNode);

  // Save Button
  container.querySelector('#btn-save-mindmap').addEventListener('click', async () => {
    await autoSaveActiveMindmap();
    showToast('Đã lưu sơ đồ tư duy thành công!', 'success');
  });

  // Export PNG
  container.querySelector('#btn-export-png').addEventListener('click', exportMindMapToPNG);

  // Global Keyboard Shortcuts for Mind Map
  const handleKeydown = (e) => {
    if (!activeMindmap || document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      addChildNode();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      addSiblingNode();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelectedNode();
    }
  };

  document.removeEventListener('keydown', handleKeydown);
  document.addEventListener('keydown', handleKeydown);
}

/**
 * Add Child Node to currently selected node
 */
function addChildNode() {
  if (!activeMindmap) return;
  const parent = activeMindmap.nodes.find(n => n.id === selectedNodeId) || activeMindmap.nodes[0];
  if (!parent) return;

  // Position child to the right
  const existingChildren = activeMindmap.nodes.filter(n => n.parentId === parent.id);
  const offsetY = (existingChildren.length * 60) - 30;

  const newId = generateId();
  const newNode = {
    id: newId,
    parentId: parent.id,
    text: `Ý tưởng ${existingChildren.length + 1}`,
    x: parent.x + 220,
    y: parent.y + offsetY,
    color: parent.color || 'emerald'
  };

  activeMindmap.nodes.push(newNode);
  selectedNodeId = newId;
  drawMindMapContent();
  autoSaveActiveMindmap();
}

/**
 * Add Sibling Node (same parent)
 */
function addSiblingNode() {
  if (!activeMindmap) return;
  const current = activeMindmap.nodes.find(n => n.id === selectedNodeId);
  if (!current || current.isRoot) {
    addChildNode();
    return;
  }

  const newId = generateId();
  const newNode = {
    id: newId,
    parentId: current.parentId,
    text: 'Ý tưởng mới',
    x: current.x,
    y: current.y + 65,
    color: current.color || 'sky'
  };

  activeMindmap.nodes.push(newNode);
  selectedNodeId = newId;
  drawMindMapContent();
  autoSaveActiveMindmap();
}

/**
 * Delete selected node (and its descendants)
 */
async function deleteSelectedNode() {
  if (!activeMindmap || !selectedNodeId) return;
  const target = activeMindmap.nodes.find(n => n.id === selectedNodeId);
  if (!target) return;

  if (target.isRoot) {
    showToast('Không thể xóa nút gốc của sơ đồ!', 'warning');
    return;
  }

  // Find all descendant IDs recursively
  const toDelete = new Set([selectedNodeId]);
  let added = true;
  while (added) {
    added = false;
    activeMindmap.nodes.forEach(n => {
      if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
        toDelete.add(n.id);
        added = true;
      }
    });
  }

  activeMindmap.nodes = activeMindmap.nodes.filter(n => !toDelete.has(n.id));
  selectedNodeId = (activeMindmap.nodes[0] && activeMindmap.nodes[0].id) || null;
  drawMindMapContent();
  autoSaveActiveMindmap();
  showToast('Đã xóa nhánh và các ý tưởng phụ liên kết', 'info');
}

/**
 * Auto-save active mindmap to IndexedDB
 */
async function autoSaveActiveMindmap() {
  if (!activeMindmap) return;
  activeMindmap.updatedAt = new Date().toISOString();
  await saveItem('mindmaps', activeMindmap);
}

/**
 * Export Mind Map to high-resolution PNG
 */
function exportMindMapToPNG() {
  if (!activeMindmap || activeMindmap.nodes.length === 0) return;

  // Calculate bounding box of all nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  activeMindmap.nodes.forEach(n => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + 200);
    maxY = Math.max(maxY, n.y + 60);
  });

  const padding = 80;
  const width = Math.max(800, (maxX - minX) + padding * 2);
  const height = Math.max(500, (maxY - minY) + padding * 2);

  const canvas = document.createElement('canvas');
  canvas.width = width * 2; // Retina 2x
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  // Background
  ctx.fillStyle = '#0f172a'; // Modern dark background
  ctx.fillRect(0, 0, width, height);

  // Title on top
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px "Be Vietnam Pro", sans-serif';
  ctx.fillText(activeMindmap.title, padding, 45);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px "Be Vietnam Pro", sans-serif';
  ctx.fillText(`Môn: ${activeMindmap.subjectName || 'Học tập'} | Tạo bởi StudyHub`, padding, 65);

  const offsetX = padding - minX;
  const offsetY = padding + 40 - minY;

  // Draw connecting curves
  activeMindmap.nodes.forEach(node => {
    if (node.parentId) {
      const parent = activeMindmap.nodes.find(n => n.id === node.parentId);
      if (parent) {
        const startX = parent.x + 100 + offsetX;
        const startY = parent.y + 20 + offsetY;
        const endX = node.x + offsetX;
        const endY = node.y + 20 + offsetY;
        const color = getColorById(node.color || 'indigo');

        ctx.strokeStyle = color.hex;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        const dx = Math.abs(endX - startX) * 0.5;
        ctx.bezierCurveTo(startX + dx, startY, endX - dx, endY, endX, endY);
        ctx.stroke();
      }
    }
  });

  // Draw nodes
  activeMindmap.nodes.forEach(node => {
    const x = node.x + offsetX;
    const y = node.y + offsetY;
    const color = getColorById(node.color || (node.isRoot ? 'indigo' : 'sky'));

    // Rounded rectangle
    const nw = Math.max(120, Math.min(240, node.text.length * 10 + 30));
    const nh = 38;

    ctx.fillStyle = node.isRoot ? '#4f46e5' : '#1e293b';
    ctx.strokeStyle = color.hex;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.roundRect(x, y, nw, nh, 12);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = node.isRoot ? 'bold 14px "Be Vietnam Pro", sans-serif' : '500 12px "Be Vietnam Pro", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.text, x + 14, y + nh / 2, nw - 28);
  });

  // Trigger download
  const link = document.createElement('a');
  link.download = `MindMap_${activeMindmap.title.replace(/\s+/g, '_')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('Đã xuất file ảnh sơ đồ tư duy chất lượng cao!', 'success');
}

/**
 * Open Modal to Create or Rename a Mind Map
 */
export function openCreateMindMapModal(editingItem = null) {
  const isEditing = Boolean(editingItem);

  const modalHtml = `
    <div class="p-6">
      <div class="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
        <h3 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <i data-lucide="${isEditing ? 'edit-2' : 'git-merge'}" class="w-5 h-5 text-amber-500"></i>
          <span>${isEditing ? 'Đổi tên sơ đồ tư duy' : 'Tạo sơ đồ tư duy mới'}</span>
        </h3>
        <button id="modal-close-mm" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <form id="form-mindmap" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Tên sơ đồ tư duy <span class="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="mm-title-input"
            required
            placeholder="VD: Tổng quan Kiến trúc Mạng Máy Tính"
            value="${escapeHtml(editingItem ? editingItem.title : '')}"
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-amber-500 transition"
          />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Môn học liên quan
          </label>
          <input
            type="text"
            id="mm-subject-input"
            list="mm-subjects-datalist"
            placeholder="VD: Kỹ thuật số, Cơ học vật liệu..."
            value="${escapeHtml(editingItem ? editingItem.subjectName || '' : '')}"
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-amber-500 transition"
          />
          <datalist id="mm-subjects-datalist">
            <option value="Kỹ thuật số">
            <option value="Kỹ năng công dân toàn cầu">
            <option value="Hệ thống và điều khiển">
            <option value="Cơ học vật liệu">
            <option value="Tư tưởng Hồ Chí Minh">
          </datalist>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button type="button" id="btn-cancel-mm" class="px-4 py-2 rounded-xl text-xs md:text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Hủy
          </button>
          <button type="submit" class="px-5 py-2 rounded-xl text-xs md:text-sm font-semibold bg-amber-500 hover:bg-amber-600 active:scale-95 text-white transition shadow-sm">
            ${isEditing ? 'Lưu thay đổi' : 'Bắt đầu vẽ sơ đồ'}
          </button>
        </div>
      </form>
    </div>
  `;

  const modal = openModal(modalHtml, { size: 'max-w-md' });
  const wrapper = modal.wrapper;

  wrapper.querySelector('#modal-close-mm').addEventListener('click', () => modal.close());
  wrapper.querySelector('#btn-cancel-mm').addEventListener('click', () => modal.close());

  const form = wrapper.querySelector('#form-mindmap');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = wrapper.querySelector('#mm-title-input').value.trim();
    const subjectName = wrapper.querySelector('#mm-subject-input').value.trim();

    if (!title) {
      showToast('Vui lòng nhập tên sơ đồ tư duy!', 'warning');
      return;
    }

    const subjectCodeMap = {
      'Kỹ thuật số': '71ELEC30083',
      'Kỹ năng công dân toàn cầu': '71SSK110023',
      'Hệ thống và điều khiển': '71ELEC30163',
      'Cơ học vật liệu': '71MECA30023',
      'Tư tưởng Hồ Chí Minh': '71POLH10042'
    };
    const subjectId = subjectCodeMap[subjectName] || (editingItem ? editingItem.subjectId : '') || '';

    if (isEditing) {
      editingItem.title = title;
      editingItem.subjectId = subjectId;
      editingItem.subjectName = subjectName;
      editingItem.updatedAt = new Date().toISOString();
      await saveItem('mindmaps', editingItem);
    } else {
      const newMindmap = {
        id: generateId(),
        title,
        subjectId,
        subjectName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nodes: [
          { id: 'root', text: title, x: 400, y: 260, color: 'indigo', isRoot: true },
          { id: generateId(), parentId: 'root', text: 'Nhánh 1: Khái niệm', x: 650, y: 200, color: 'sky' },
          { id: generateId(), parentId: 'root', text: 'Nhánh 2: Nguyên lý', x: 650, y: 320, color: 'emerald' }
        ]
      };
      await saveItem('mindmaps', newMindmap);
      activeMindmap = newMindmap;
      selectedNodeId = 'root';
    }

    await loadMindmaps();
    renderMindMapView();
    modal.close();
    showToast(isEditing ? 'Đã cập nhật thông tin sơ đồ' : `Đã tạo sơ đồ "${title}"`, 'success');
  });

  if (window.lucide) {
    window.lucide.createIcons({ root: wrapper });
  }
}
