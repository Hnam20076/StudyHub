/**
 * Client-Side Attachment Component (IndexedDB-backed)
 * Supports upload, drag & drop, download, preview, and delete for all entities.
 */

import { getAttachmentsByEntity, saveItem, deleteItem } from '../db.js';
import { showToast } from './toast.js';
import { confirmDialog } from './modal.js';

/**
 * Format bytes to readable size string
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Get file icon based on MIME type / extension
 */
export function getFileIcon(type, name = '') {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (type.startsWith('image/')) return 'image';
  if (type.includes('pdf') || ext === 'pdf') return 'file-text';
  if (type.includes('word') || ['doc', 'docx'].includes(ext)) return 'file-text';
  if (type.includes('excel') || type.includes('sheet') || ['xls', 'xlsx', 'csv'].includes(ext)) return 'table';
  if (type.includes('presentation') || ['ppt', 'pptx'].includes(ext)) return 'presentation';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  if (['js', 'ts', 'html', 'css', 'py', 'java', 'cpp', 'c', 'json'].includes(ext)) return 'code';
  return 'paperclip';
}

/**
 * Render attachments UI container inside a target element
 */
export async function renderAttachmentSection(container, entityType, entityId, options = {}) {
  if (!container) return;
  const canUpload = options.canUpload !== false;

  const attachments = await getAttachmentsByEntity(entityType, entityId);

  const fileItemsHtml = attachments.length > 0 ? attachments.map(att => {
    const icon = getFileIcon(att.type, att.name);
    const isImage = att.type.startsWith('image/');
    return `
      <div class="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 transition group" data-att-id="${att.id}">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
            <i data-lucide="${icon}" class="w-4 h-4"></i>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 btn-preview-att" title="${att.name}">${att.name}</p>
            <p class="text-[10px] text-slate-400">${formatFileSize(att.size)} • ${new Date(att.createdAt).toLocaleDateString('vi-VN')}</p>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 transition btn-download-att" title="Tải xuống">
            <i data-lucide="download" class="w-3.5 h-3.5"></i>
          </button>
          ${canUpload ? `
            <button type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-700 transition btn-delete-att" title="Xóa tài liệu">
              <i data-lucide="trash" class="w-3.5 h-3.5"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('') : `
    <div class="text-center py-4 text-xs text-slate-400">
      <i data-lucide="paperclip" class="w-5 h-5 mx-auto mb-1 opacity-50"></i>
      <p>Chưa có tệp đính kèm nào</p>
    </div>
  `;

  container.innerHTML = `
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <label class="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <i data-lucide="paperclip" class="w-3.5 h-3.5 text-indigo-500"></i>
          <span>Tài liệu đính kèm (${attachments.length})</span>
        </label>
      </div>

      <!-- File list -->
      <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        ${fileItemsHtml}
      </div>

      ${canUpload ? `
        <!-- Dropzone / File input -->
        <div class="relative border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center hover:border-indigo-400 dark:hover:border-indigo-500/60 transition bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer dropzone-container">
          <input type="file" multiple class="absolute inset-0 opacity-0 cursor-pointer input-att-file" />
          <div class="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <i data-lucide="upload-cloud" class="w-4 h-4 text-indigo-500"></i>
            <span>Chọn tệp hoặc kéo thả vào đây (Tối đa 15MB/tệp)</span>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ root: container });

  // Attach events
  // 1. Download
  container.querySelectorAll('.btn-download-att').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('[data-att-id]');
      const attId = card?.getAttribute('data-att-id');
      const att = attachments.find(a => a.id === attId);
      if (att) downloadAttachment(att);
    });
  });

  // 2. Preview
  container.querySelectorAll('.btn-preview-att').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = el.closest('[data-att-id]');
      const attId = card?.getAttribute('data-att-id');
      const att = attachments.find(a => a.id === attId);
      if (att) previewAttachment(att);
    });
  });

  // 3. Delete
  container.querySelectorAll('.btn-delete-att').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = btn.closest('[data-att-id]');
      const attId = card?.getAttribute('data-att-id');
      const att = attachments.find(a => a.id === attId);
      if (!att) return;

      const proceed = await confirmDialog({
        title: 'Xóa tệp đính kèm?',
        message: `Bạn có chắc muốn xóa tệp "${att.name}" không?`,
        confirmText: 'Xóa tệp',
        confirmVariant: 'danger'
      });
      if (proceed) {
        await deleteItem('attachments', attId);
        showToast(`Đã xóa tệp "${att.name}"`, 'info');
        await renderAttachmentSection(container, entityType, entityId, options);
        if (options.onChanged) options.onChanged();
      }
    });
  });

  // 4. File input change
  const fileInput = container.querySelector('.input-att-file');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      await handleUploadFiles(files, entityType, entityId);
      await renderAttachmentSection(container, entityType, entityId, options);
      if (options.onChanged) options.onChanged();
    });
  }
}

/**
 * Upload multiple files to IndexedDB
 */
export async function handleUploadFiles(files, entityType, entityId) {
  const MAX_SIZE = 15 * 1024 * 1024; // 15MB
  for (const file of files) {
    if (file.size > MAX_SIZE) {
      showToast(`Tệp "${file.name}" vượt quá giới hạn 15MB!`, 'error');
      continue;
    }

    try {
      const base64Data = await readFileAsDataURL(file);
      const att = {
        id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        entityType,
        entityId: String(entityId),
        data: base64Data,
        createdAt: new Date().toISOString()
      };
      await saveItem('attachments', att);
      showToast(`Đã tải lên "${file.name}"`, 'success');
    } catch (err) {
      console.error('File upload error:', err);
      showToast(`Lỗi khi đọc tệp "${file.name}"`, 'error');
    }
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

function downloadAttachment(att) {
  const a = document.createElement('a');
  a.href = att.data;
  a.download = att.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function previewAttachment(att) {
  if (att.type.startsWith('image/')) {
    // Open image in a popup or new tab
    const w = window.open('');
    w.document.write(`<title>${att.name}</title><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a;"><img src="${att.data}" style="max-width:95vw;max-height:95vh;object-fit:contain;border-radius:12px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);" /></body>`);
  } else if (att.type === 'application/pdf') {
    const w = window.open('');
    w.document.write(`<title>${att.name}</title><iframe src="${att.data}" frameborder="0" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>`);
  } else {
    downloadAttachment(att);
  }
}
