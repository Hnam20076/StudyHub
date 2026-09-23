/**
 * Toast Notification Component
 */

export function showToast(message, type = 'success', duration = 4000, action = null) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toastId = 'toast_' + Math.random().toString(36).substring(2, 8);
  const toast = document.createElement('div');
  toast.id = toastId;

  const typeConfig = {
    success: {
      bg: 'bg-emerald-600 text-white',
      icon: '<i data-lucide="check-circle" class="w-5 h-5 flex-shrink-0"></i>'
    },
    error: {
      bg: 'bg-rose-600 text-white',
      icon: '<i data-lucide="alert-circle" class="w-5 h-5 flex-shrink-0"></i>'
    },
    warning: {
      bg: 'bg-amber-600 text-white',
      icon: '<i data-lucide="alert-triangle" class="w-5 h-5 flex-shrink-0"></i>'
    },
    info: {
      bg: 'bg-indigo-600 text-white',
      icon: '<i data-lucide="info" class="w-5 h-5 flex-shrink-0"></i>'
    }
  };

  const config = typeConfig[type] || typeConfig.info;

  toast.className = `flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl transform transition-all duration-300 ease-out translate-y-3 opacity-0 text-sm font-medium ${config.bg} max-w-md w-full border border-white/10`;
  toast.innerHTML = `
    ${config.icon}
    <div class="flex-1 leading-snug">${message}</div>
    ${action ? `
      <button class="toast-action-btn px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition flex-shrink-0">
        ${action.label}
      </button>
    ` : ''}
    <button class="opacity-75 hover:opacity-100 transition-opacity p-1 text-white flex-shrink-0" aria-label="Đóng">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;

  const closeBtn = toast.querySelector('button[aria-label="Đóng"]');
  const actionBtn = toast.querySelector('.toast-action-btn');
  const dismiss = () => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  };
  closeBtn.addEventListener('click', dismiss);
  if (actionBtn && action && (action.callback || action.onClick)) {
    actionBtn.addEventListener('click', () => {
      dismiss();
      const fn = action.callback || action.onClick;
      fn();
    });
  }

  container.appendChild(toast);
  if (window.lucide) {
    window.lucide.createIcons({ root: toast });
  }

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.remove('opacity-0', 'translate-y-3');
    toast.classList.add('opacity-100', 'translate-y-0');
  });

  // Auto dismiss
  setTimeout(dismiss, duration);
}
