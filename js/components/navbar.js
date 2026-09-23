/**
 * Navigation Bar Component (Responsive Desktop Sidebar & Mobile Bottom Bar with "Thêm" Drawer)
 */

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tổng quan', icon: 'layout-dashboard', group: 'main' },
  { id: 'subjects', label: 'Môn học', icon: 'book-open', group: 'academic' },
  { id: 'schedule', label: 'Thời khóa biểu', icon: 'calendar-days', group: 'academic' },
  { id: 'tasks', label: 'Nhiệm vụ', icon: 'check-square', group: 'academic' },
  { id: 'notes', label: 'Ghi chú bài học', icon: 'file-text', group: 'docs' },
  { id: 'mindmap', label: 'Sơ đồ tư duy', icon: 'git-merge', group: 'docs' },
  { id: 'imageNotes', label: 'Chú thích ảnh', icon: 'image', group: 'docs' },
  { id: 'exams', label: 'Kỳ thi', icon: 'calendar-check', group: 'performance' },
  { id: 'grades', label: 'Điểm số & GPA', icon: 'bar-chart-3', group: 'performance' },
  { id: 'progress', label: 'Tiến độ học tập', icon: 'trending-up', group: 'performance' },
  { id: 'timer', label: 'Tập trung', icon: 'timer', group: 'performance' }
];

export const MOBILE_PRIMARY_NAV = [
  { id: 'dashboard', label: 'Tổng quan', icon: 'layout-dashboard' },
  { id: 'subjects', label: 'Môn học', icon: 'book-open' },
  { id: 'schedule', label: 'TKB', icon: 'calendar-days' },
  { id: 'tasks', label: 'Nhiệm vụ', icon: 'check-square' }
];

export function renderNavbar(activeView = 'schedule', onNavigate = null) {
  const sidebarContainer = document.getElementById('sidebar-nav');
  const bottomBarContainer = document.getElementById('bottom-nav');

  // 1. Desktop Sidebar (Full 11 Items)
  if (sidebarContainer) {
    sidebarContainer.innerHTML = NAV_ITEMS.map(item => {
      const isActive = item.id === activeView;
      const activeClass = isActive
        ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-500/20'
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200';

      return `
        <button data-view="${item.id}" class="nav-item-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs md:text-sm transition-all duration-150 ${activeClass}">
          <i data-lucide="${item.icon}" class="w-4 h-4 md:w-5 md:h-5 flex-shrink-0"></i>
          <span class="flex-1 text-left truncate">${item.label}</span>
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

  // 2. Mobile Bottom Bar (4 Primary Items + "Thêm" button)
  if (bottomBarContainer) {
    const isMoreActive = !MOBILE_PRIMARY_NAV.some(m => m.id === activeView);

    bottomBarContainer.innerHTML = `
      ${MOBILE_PRIMARY_NAV.map(item => {
        const isActive = item.id === activeView;
        const activeClass = isActive
          ? 'text-indigo-600 dark:text-indigo-400 font-bold'
          : 'text-slate-500 dark:text-slate-400';

        return `
          <button data-view="${item.id}" class="bottom-nav-btn flex-1 flex flex-col items-center justify-center py-2 transition-colors relative ${activeClass}">
            ${isActive ? '<div class="absolute top-0 w-8 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full"></div>' : ''}
            <i data-lucide="${item.icon}" class="w-5 h-5 mb-1 ${isActive ? 'stroke-[2.5]' : ''}"></i>
            <span class="text-[10px] tracking-tight truncate max-w-[64px]">${item.label}</span>
          </button>
        `;
      }).join('')}

      <!-- "Thêm" (More) Button -->
      <button id="btn-bottom-nav-more" class="flex-1 flex flex-col items-center justify-center py-2 transition-colors relative ${isMoreActive ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400'}">
        ${isMoreActive ? '<div class="absolute top-0 w-8 h-1 bg-indigo-600 dark:bg-indigo-400 rounded-full"></div>' : ''}
        <i data-lucide="more-horizontal" class="w-5 h-5 mb-1 ${isMoreActive ? 'stroke-[2.5]' : ''}"></i>
        <span class="text-[10px] tracking-tight">Thêm</span>
      </button>
    `;

    bottomBarContainer.querySelectorAll('.bottom-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const viewId = btn.getAttribute('data-view');
        if (onNavigate) onNavigate(viewId);
      });
    });

    const moreBtn = bottomBarContainer.querySelector('#btn-bottom-nav-more');
    if (moreBtn) {
      moreBtn.addEventListener('click', () => {
        openMobileMoreDrawer(activeView, onNavigate);
      });
    }
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Mobile "Thêm" Bottom Sheet Drawer
 */
export function openMobileMoreDrawer(activeView, onNavigate) {
  let drawer = document.getElementById('mobile-more-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'mobile-more-drawer';
    document.body.appendChild(drawer);
  }

  drawer.innerHTML = `
    <!-- Backdrop -->
    <div id="drawer-backdrop" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 transition-opacity opacity-0"></div>

    <!-- Sheet Panel -->
    <div id="drawer-sheet" class="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 p-5 transform translate-y-full transition-transform duration-300 max-h-[85vh] overflow-y-auto">
      <div class="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4"></div>

      <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
        <h3 class="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <i data-lucide="grid" class="w-5 h-5 text-indigo-600"></i>
          <span>Tất cả tính năng StudyHub</span>
        </h3>
        <button id="btn-close-drawer" class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- Features Grid -->
      <div class="grid grid-cols-2 gap-2.5 mb-5">
        ${NAV_ITEMS.map(item => {
          const isActive = item.id === activeView;
          return `
            <button
              data-drawer-view="${item.id}"
              class="flex items-center gap-2.5 p-3 rounded-2xl text-left border transition ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }"
            >
              <div class="w-8 h-8 rounded-xl ${isActive ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-indigo-500'} flex items-center justify-center flex-shrink-0 shadow-sm">
                <i data-lucide="${item.icon}" class="w-4 h-4"></i>
              </div>
              <span class="text-xs truncate">${item.label}</span>
            </button>
          `;
        }).join('')}
      </div>

      <!-- Quick Actions (Thùng rác, Sao lưu, Khôi phục) -->
      <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-around gap-2 text-xs">
        <button id="btn-drawer-trash" class="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-center gap-1.5">
          <i data-lucide="trash-2" class="w-4 h-4 text-rose-500"></i>
          <span>Thùng rác</span>
        </button>
        <button id="btn-drawer-backup" class="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold flex items-center justify-center gap-1.5">
          <i data-lucide="download" class="w-4 h-4 text-indigo-500"></i>
          <span>Sao lưu</span>
        </button>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ root: drawer });

  const backdrop = drawer.querySelector('#drawer-backdrop');
  const sheet = drawer.querySelector('#drawer-sheet');

  // Animation open
  requestAnimationFrame(() => {
    backdrop.classList.remove('opacity-0');
    sheet.classList.remove('translate-y-full');
  });

  const closeDrawer = () => {
    backdrop.classList.add('opacity-0');
    sheet.classList.add('translate-y-full');
    setTimeout(() => {
      drawer.remove();
    }, 300);
  };

  backdrop.addEventListener('click', closeDrawer);
  drawer.querySelector('#btn-close-drawer')?.addEventListener('click', closeDrawer);

  drawer.querySelectorAll('[data-drawer-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.getAttribute('data-drawer-view');
      closeDrawer();
      if (onNavigate) onNavigate(viewId);
    });
  });

  drawer.querySelector('#btn-drawer-trash')?.addEventListener('click', () => {
    closeDrawer();
    const btnTrash = document.getElementById('btn-open-trash');
    if (btnTrash) btnTrash.click();
  });

  drawer.querySelector('#btn-drawer-backup')?.addEventListener('click', () => {
    closeDrawer();
    const btnBackup = document.getElementById('btn-backup-data');
    if (btnBackup) btnBackup.click();
  });
}
