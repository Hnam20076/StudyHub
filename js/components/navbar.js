/**
 * Navigation Bar Component (Responsive Desktop Sidebar & Mobile Bottom Bar)
 */

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tổng quan', icon: 'layout-dashboard' },
  { id: 'schedule', label: 'Thời khóa biểu', icon: 'calendar-days', badge: null },
  { id: 'notes', label: 'Ghi chú bài học', icon: 'file-text' },
  { id: 'mindmap', label: 'Sơ đồ tư duy', icon: 'git-merge' },
  { id: 'imageNotes', label: 'Chú thích ảnh', icon: 'image' }
];

export function renderNavbar(activeView = 'schedule', onNavigate = null) {
  const sidebarContainer = document.getElementById('sidebar-nav');
  const bottomBarContainer = document.getElementById('bottom-nav');

  if (sidebarContainer) {
    sidebarContainer.innerHTML = NAV_ITEMS.map(item => {
      const isActive = item.id === activeView;
      const activeClass = isActive
        ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-500/20'
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200';

      return `
        <button data-view="${item.id}" class="nav-item-btn w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 ${activeClass}">
          <i data-lucide="${item.icon}" class="w-5 h-5 flex-shrink-0"></i>
          <span class="flex-1 text-left">${item.label}</span>
          ${item.badge ? `<span class="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-bold">${item.badge}</span>` : ''}
        </button>
      `;
    }).join('');

    sidebarContainer.querySelectorAll('.nav-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const viewId = btn.getAttribute('data-view');
        if (onNavigate) onNavigate(viewId);
      });
    });
  }

  if (bottomBarContainer) {
    bottomBarContainer.innerHTML = NAV_ITEMS.map(item => {
      const isActive = item.id === activeView;
      const activeClass = isActive
        ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
        : 'text-slate-500 dark:text-slate-400';

      return `
        <button data-view="${item.id}" class="bottom-nav-btn flex-1 flex flex-col items-center justify-center py-2 transition-colors relative ${activeClass}">
          ${isActive ? '<div class="absolute top-0 w-8 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full"></div>' : ''}
          <i data-lucide="${item.icon}" class="w-5 h-5 mb-1 ${isActive ? 'stroke-[2.5]' : ''}"></i>
          <span class="text-[10px] tracking-tight truncate max-w-[64px]">${item.label}</span>
        </button>
      `;
    }).join('');

    bottomBarContainer.querySelectorAll('.bottom-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const viewId = btn.getAttribute('data-view');
        if (onNavigate) onNavigate(viewId);
      });
    });
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}
