/**
 * StudyHub Main Application Entry Point
 * Handles DB init, Theme management, Navigation Routing, and Global Events.
 */

import {
  openDB,
  seedInitialScheduleIfEmpty,
  seedInitialNotesIfEmpty,
  seedInitialMindmapsIfEmpty,
  seedInitialImageNotesIfEmpty,
  getSetting,
  setSetting,
  exportAllData,
  importData
} from './db.js';
import { formatDateVietnamese } from './utils/helpers.js';
import { renderNavbar, NAV_ITEMS } from './components/navbar.js';
import { showToast } from './components/toast.js';
import { confirmDialog } from './components/modal.js';

// Modules
import { initScheduleModule, renderSchedule, openScheduleFormModal } from './modules/schedule.js';
import { initDashboardModule, renderDashboard } from './modules/dashboard.js';
import { initNotesModule, openNoteFormModal } from './modules/notes.js';
import { initMindMapModule, openCreateMindMapModal } from './modules/mindmap.js';
import { initImageNotesModule, openUploadImageModal } from './modules/imageNotes.js';

let activeView = 'schedule'; // Start directly with Thời khóa biểu as requested

async function initApp() {
  try {
    // 1. Initialize IndexedDB
    await openDB();

    // 2. Seed initial sample data across all modules if brand new
    await seedInitialScheduleIfEmpty();
    await seedInitialNotesIfEmpty();
    await seedInitialMindmapsIfEmpty();
    await seedInitialImageNotesIfEmpty();

    // 3. Initialize theme
    await initTheme();

    // 4. Update header date
    const dateEl = document.getElementById('desktop-today-date');
    if (dateEl) {
      dateEl.textContent = formatDateVietnamese(new Date());
    }

    // 5. Setup View Routing
    setupRouter();

    // 6. Setup Backup and Restore
    setupBackupRestore();

    // 7. Setup Mobile Quick Add button
    const mobileAddBtn = document.getElementById('btn-quick-add-mobile');
    if (mobileAddBtn) {
      mobileAddBtn.addEventListener('click', () => {
        if (activeView === 'notes') {
          openNoteFormModal();
        } else if (activeView === 'mindmap') {
          openCreateMindMapModal();
        } else if (activeView === 'imageNotes') {
          openUploadImageModal();
        } else {
          openScheduleFormModal();
        }
      });
    }

    // 8. Load initial active view
    await switchView(activeView);

    console.log('✅ StudyHub đã khởi tạo thành công!');
  } catch (err) {
    console.error('Lỗi khởi tạo StudyHub:', err);
    showToast('Lỗi tải dữ liệu ứng dụng. Vui lòng tải lại trang.', 'error');
  }
}

/**
 * Switch view handler
 */
export async function switchView(viewId) {
  const validViews = ['dashboard', 'schedule', 'notes', 'mindmap', 'imageNotes'];
  if (!validViews.includes(viewId)) {
    viewId = 'schedule';
  }

  activeView = viewId;

  // Update navbar
  renderNavbar(activeView, switchView);

  // Update headers
  const currentNav = NAV_ITEMS.find(n => n.id === activeView);
  const viewTitle = currentNav ? currentNav.label : 'StudyHub';

  const desktopTitle = document.getElementById('desktop-view-title');
  if (desktopTitle) desktopTitle.textContent = viewTitle;

  const mobileTitle = document.getElementById('mobile-view-name');
  if (mobileTitle) mobileTitle.textContent = viewTitle;

  // Toggle DOM visibility
  const panels = {
    dashboard: document.getElementById('dashboard-view'),
    schedule: document.getElementById('schedule-view'),
    notes: document.getElementById('notes-view'),
    mindmap: document.getElementById('mindmap-view'),
    imageNotes: document.getElementById('image-notes-view')
  };

  Object.entries(panels).forEach(([key, el]) => {
    if (el) {
      if (key === activeView) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  // Render view-specific content
  if (activeView === 'dashboard') {
    await initDashboardModule(switchView);
  } else if (activeView === 'schedule') {
    await initScheduleModule();
  } else if (activeView === 'notes') {
    await initNotesModule();
  } else if (activeView === 'mindmap') {
    await initMindMapModule();
  } else if (activeView === 'imageNotes') {
    await initImageNotesModule();
  }

  // Refresh Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Setup Router & History / Hash change
 */
function setupRouter() {
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      switchView(hash);
    }
  });

  // Check initial hash
  const initialHash = window.location.hash.replace('#', '');
  if (initialHash) {
    activeView = initialHash;
  }
}

/**
 * Theme Manager (Dark / Light)
 */
async function initTheme() {
  const savedTheme = await getSetting('theme', 'light');
  applyTheme(savedTheme);

  const toggleBtnDesktop = document.getElementById('btn-theme-toggle');
  const toggleBtnMobile = document.getElementById('btn-theme-toggle-mobile');

  const handleToggle = async () => {
    const isDark = document.documentElement.classList.contains('dark');
    const newTheme = isDark ? 'light' : 'dark';
    applyTheme(newTheme);
    await setSetting('theme', newTheme);
    showToast(`Đã chuyển sang giao diện ${newTheme === 'dark' ? 'Tối' : 'Sáng'}`, 'info');
  };

  if (toggleBtnDesktop) toggleBtnDesktop.addEventListener('click', handleToggle);
  if (toggleBtnMobile) toggleBtnMobile.addEventListener('click', handleToggle);
}

function applyTheme(theme) {
  const root = document.documentElement;
  const label = document.getElementById('theme-label');

  if (theme === 'dark') {
    root.classList.add('dark');
    if (label) label.textContent = 'Giao diện: Sáng';
  } else {
    root.classList.remove('dark');
    if (label) label.textContent = 'Giao diện: Tối';
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Backup & Restore Manager
 */
function setupBackupRestore() {
  // Backup download
  const backupBtn = document.getElementById('btn-backup-data');
  if (backupBtn) {
    backupBtn.addEventListener('click', async () => {
      try {
        const data = await exportAllData();
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        a.href = url;
        a.download = `StudyHub_Backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Đã xuất file sao lưu dữ liệu thành công!', 'success');
      } catch (err) {
        console.error('Backup error:', err);
        showToast('Có lỗi khi tạo file sao lưu.', 'error');
      }
    });
  }

  // Restore file input
  const restoreInput = document.getElementById('input-restore-data');
  if (restoreInput) {
    restoreInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const proceed = await confirmDialog({
        title: 'Khôi phục dữ liệu',
        message: 'Thao tác này sẽ thay thế dữ liệu hiện tại bằng dữ liệu từ file sao lưu. Bạn có chắc chắn muốn khôi phục?',
        confirmText: 'Khôi phục ngay',
        confirmColor: 'bg-indigo-600 hover:bg-indigo-700 text-white'
      });

      if (!proceed) {
        restoreInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          await importData(parsed);
          showToast('Khôi phục dữ liệu thành công!', 'success');
          await switchView(activeView);
        } catch (err) {
          console.error('Restore error:', err);
          showToast('File sao lưu không hợp lệ hoặc bị lỗi!', 'error');
        } finally {
          restoreInput.value = '';
        }
      };
      reader.readAsText(file);
    });
  }
}

// Boot application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
