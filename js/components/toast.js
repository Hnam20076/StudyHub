/**
 * Toast Notification Component
 */

export function showToast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toastId = 'toast_' + Math.random().toString(36).substring(2, 8);
  const toast = document.createElement('div');
  toast.id = toastId;

  const typeConfig = {
    success: {
      bg: 'bg-emerald-500 text-white',
      icon: '<i data-lucide="check-circle" class="w-5 h-5 flex-shrink-0"></i>'
    },
    error: {
      bg: 'bg-rose-500 text-white',
      icon: '<i data-lucide="alert-circle" class="w-5 h-5 flex-shrink-0"></i>'
    },
    warning: {
      bg: 'bg-amber-500 text-white',
      icon: '<i data-lucide="alert-triangle" class="w-5 h-5 flex-shrink-0"></i>'
    },
    info: {
      bg: 'bg-indigo-600 text-white',
      icon: '<i data-lucide="info" class="w-5 h-5 flex-shrink-0"></i>'
    }
  };

  const config = typeConfig[type] || typeConfig.info;

  toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg transform transition-all duration-300 ease-out translate-y-3 opacity-0 text-sm font-medium ${config.bg} max-w-sm w-full`;
  toast.innerHTML = `
    ${config.icon}
    <div class="flex-1">${message}</div>
    <button class="opacity-75 hover:opacity-100 transition-opacity p-1 text-white" aria-label="Đóng">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;

  const closeBtn = toast.querySelector('button');
  const dismiss = () => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  };
  closeBtn.addEventListener('click', dismiss);

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
