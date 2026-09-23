/**
 * Modal Dialog Component
 */

let activeModals = [];

export function closeModal() {
  if (activeModals.length > 0) {
    const topClose = activeModals.pop();
    if (topClose) topClose();
  }
}

export function openModal(htmlContent, { onClose = null, size = 'max-w-lg' } = {}) {
  const container = document.getElementById('modal-container');
  if (!container) return null;

  const modalWrapper = document.createElement('div');
  modalWrapper.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200 opacity-0';

  modalWrapper.innerHTML = `
    <div class="relative w-full ${size} bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all duration-200 scale-95 max-h-[90vh] flex flex-col">
      ${htmlContent}
    </div>
  `;

  const close = () => {
    modalWrapper.classList.add('opacity-0');
    const inner = modalWrapper.querySelector('div');
    if (inner) inner.classList.add('scale-95');
    setTimeout(() => {
      modalWrapper.remove();
      const idx = activeModals.indexOf(close);
      if (idx !== -1) activeModals.splice(idx, 1);
      if (onClose) onClose();
    }, 200);
  };

  activeModals.push(close);

  // Close on backdrop click (outside the modal box)
  modalWrapper.addEventListener('click', (e) => {
    if (e.target === modalWrapper) {
      close();
    }
  });

  // Close on Escape
  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);

  container.appendChild(modalWrapper);
  if (window.lucide) {
    window.lucide.createIcons({ root: modalWrapper });
  }

  requestAnimationFrame(() => {
    modalWrapper.classList.remove('opacity-0');
    const inner = modalWrapper.querySelector('div');
    if (inner) inner.classList.remove('scale-95');
  });

  return { close, wrapper: modalWrapper };
}

export function confirmDialog({
  title = 'Xác nhận xóa',
  message = 'Bạn có chắc chắn muốn thực hiện thao tác này?',
  confirmText = 'Xóa',
  confirmColor = 'bg-rose-600 hover:bg-rose-700 text-white',
  cancelText = 'Hủy'
}) {
  return new Promise((resolve) => {
    const html = `
      <div class="p-6">
        <div class="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-4">
          <div class="p-3 bg-rose-100 dark:bg-rose-950/50 rounded-xl">
            <i data-lucide="alert-triangle" class="w-6 h-6"></i>
          </div>
          <h3 class="text-lg font-bold text-slate-900 dark:text-white">${title}</h3>
        </div>
        <p class="text-slate-600 dark:text-slate-300 text-sm mb-6">${message}</p>
        <div class="flex items-center justify-end gap-3">
          <button id="btn-cancel" class="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            ${cancelText}
          </button>
          <button id="btn-confirm" class="px-4 py-2 rounded-xl text-sm font-semibold ${confirmColor} transition shadow-sm">
            ${confirmText}
          </button>
        </div>
      </div>
    `;

    const modal = openModal(html, {
      onClose: () => resolve(false),
      size: 'max-w-md'
    });

    const confirmBtn = modal.wrapper.querySelector('#btn-confirm');
    const cancelBtn = modal.wrapper.querySelector('#btn-cancel');

    confirmBtn.addEventListener('click', () => {
      modal.close();
      resolve(true);
    });

    cancelBtn.addEventListener('click', () => {
      modal.close();
      resolve(false);
    });
  });
}
