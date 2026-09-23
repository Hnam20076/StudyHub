/**
 * StudyHub Main Application Entry Point
 * Handles DB init, Theme management, Navigation Routing, PWA Service Worker,
 * Global Search (Ctrl+K), Soft Delete Trash & Undo, Schedule Notifications,
 * and 7-day Backup Reminders.
 */

import {
  openDB,
  seedInitialScheduleIfEmpty,
  seedInitialNotesIfEmpty,
  seedInitialMindmapsIfEmpty,
  seedInitialImageNotesIfEmpty,
  seedInitialSubjectsIfEmpty,
  seedInitialAcademicDataIfEmpty,
  getSetting,
  setSetting,
  exportAllData,
  importData,
  countTrashItems
} from './db.js';
import { formatDateVietnamese } from './utils/helpers.js';
import { renderNavbar, NAV_ITEMS } from './components/navbar.js';
import { showToast } from './components/toast.js';
import { confirmDialog } from './components/modal.js';
import { initGlobalSearch } from './components/search.js';
import { openTrashModal } from './components/trashModal.js';
import { startScheduleNotificationTicker } from './modules/notification.js';

// Modules
import { initScheduleModule, renderSchedule, openScheduleFormModal } from './modules/schedule.js';
import { initDashboardModule, renderDashboard } from './modules/dashboard.js';
import { initNotesModule, openNoteFormModal } from './modules/notes.js';
import { initMindMapModule, openCreateMindMapModal } from './modules/mindmap.js';
import { initImageNotesModule, openUploadImageModal } from './modules/imageNotes.js';
import { initSubjectsModule, openSubjectFormModal } from './modules/subjects.js';
import { initTasksModule, openTaskFormModal } from './modules/tasks.js';
import { initExamsModule, openExamFormModal } from './modules/exams.js';
import { initGradesModule } from './modules/grades.js';
import { initTimerModule } from './modules/timer.js';
import { initProgressModule } from './modules/progress.js';

let activeView = 'schedule'; // Start directly with Thời khóa biểu as requested

async function initApp() {
  try {
    // 0. Expose global app for cross-linking & shortcuts
    window.studyHubApp = {
      switchView,
      updateTrashBadgeCounts,
      syncLatestPublicData,
      getActiveView: () => activeView
    };

    // 1. Initialize IndexedDB
    await openDB();

    // Migrate last_backup_timestamp from localStorage if exists
    const legacyBackup = localStorage.getItem('last_backup_timestamp');
    if (legacyBackup) {
      await setSetting('last_backup_timestamp', legacyBackup);
      localStorage.removeItem('last_backup_timestamp');
    }

    // 2. Seed initial sample data across all modules if brand new
    await seedInitialScheduleIfEmpty();
    await seedInitialSubjectsIfEmpty();
    await seedInitialAcademicDataIfEmpty();
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

    // 7. Setup Global Search (Ctrl+K Command Palette)
    initGlobalSearch();

    // 8. Setup Trash Modal triggers & Badge counts
    setupTrashFeatures();

    // 9. Start Schedule Notification Ticker (60-second ticker)
    startScheduleNotificationTicker();

    // 10. Check 7-day Backup Reminder
    checkBackupReminder();

    // 11. Register Service Worker (PWA Offline caching)
    registerServiceWorker();

    // 12. Setup Mobile Quick Add button
    const mobileAddBtn = document.getElementById('btn-quick-add-mobile');
    if (mobileAddBtn) {
      mobileAddBtn.addEventListener('click', () => {
        if (activeView === 'notes') {
          openNoteFormModal();
        } else if (activeView === 'mindmap') {
          openCreateMindMapModal();
        } else if (activeView === 'imageNotes') {
          openUploadImageModal();
        } else if (activeView === 'subjects') {
          openSubjectFormModal();
        } else if (activeView === 'tasks') {
          openTaskFormModal();
        } else if (activeView === 'exams') {
          openExamFormModal();
        } else {
          openScheduleFormModal();
        }
      });
    }

    // 13. Load initial active view
    await switchView(activeView);

    console.log('✅ StudyHub đã khởi tạo thành công với đầy đủ tính năng PWA & Tối ưu!');
  } catch (err) {
    console.error('Lỗi khởi tạo StudyHub:', err);
    showToast('Lỗi tải dữ liệu ứng dụng. Vui lòng tải lại trang.', 'error');
  }
}

/**
 * Switch view handler
 */
export async function switchView(viewId) {
  const validViews = [
    'dashboard',
    'subjects',
    'schedule',
    'tasks',
    'notes',
    'mindmap',
    'imageNotes',
    'exams',
    'grades',
    'progress',
    'timer'
  ];
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
    subjects: document.getElementById('subjects-view'),
    schedule: document.getElementById('schedule-view'),
    tasks: document.getElementById('tasks-view'),
    notes: document.getElementById('notes-view'),
    mindmap: document.getElementById('mindmap-view'),
    imageNotes: document.getElementById('image-notes-view'),
    exams: document.getElementById('exams-view'),
    grades: document.getElementById('grades-view'),
    timer: document.getElementById('timer-view'),
    progress: document.getElementById('progress-view')
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
  } else if (activeView === 'subjects') {
    await initSubjectsModule(switchView);
  } else if (activeView === 'schedule') {
    await initScheduleModule();
  } else if (activeView === 'tasks') {
    await initTasksModule(switchView);
  } else if (activeView === 'notes') {
    await initNotesModule();
  } else if (activeView === 'mindmap') {
    await initMindMapModule();
  } else if (activeView === 'imageNotes') {
    await initImageNotesModule();
  } else if (activeView === 'exams') {
    await initExamsModule(switchView);
  } else if (activeView === 'grades') {
    await initGradesModule(switchView);
  } else if (activeView === 'timer') {
    await initTimerModule(switchView);
  } else if (activeView === 'progress') {
    await initProgressModule(switchView);
  }

  // Update trash badges whenever views switch
  updateTrashBadgeCounts();

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
 * Trash Features & Badges
 */
export async function updateTrashBadgeCounts() {
  try {
    const count = await countTrashItems();
    const topBadge = document.getElementById('trash-badge-count');
    if (topBadge) {
      if (count > 0) {
        topBadge.textContent = count;
        topBadge.classList.remove('hidden');
      } else {
        topBadge.classList.add('hidden');
      }
    }
    const sideCount = document.getElementById('sidebar-trash-count');
    if (sideCount) {
      sideCount.textContent = count;
    }
  } catch (err) {
    console.warn('Không thể đếm số lượng thùng rác:', err);
  }
}

function setupTrashFeatures() {
  const handleOpenTrash = () => {
    openTrashModal(async () => {
      await updateTrashBadgeCounts();
      await switchView(activeView);
    });
  };

  const btnTrashTop = document.getElementById('btn-open-trash');
  if (btnTrashTop) btnTrashTop.addEventListener('click', handleOpenTrash);

  const btnTrashSide = document.getElementById('sidebar-btn-trash');
  if (btnTrashSide) btnTrashSide.addEventListener('click', handleOpenTrash);

  const btnTrashMobile = document.getElementById('btn-open-trash-mobile');
  if (btnTrashMobile) btnTrashMobile.addEventListener('click', handleOpenTrash);

  updateTrashBadgeCounts();
}

/**
 * 7-Day Backup Reminder
 */
async function checkBackupReminder() {
  const lastBackupStr = await getSetting('last_backup_timestamp');
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  if (!lastBackupStr || (now - parseInt(lastBackupStr, 10)) > SEVEN_DAYS_MS) {
    setTimeout(() => {
      showToast('Đã hơn 7 ngày bạn chưa sao lưu dữ liệu StudyHub. Bấm để tải file backup!', 'info', 10000, {
        label: 'Sao lưu ngay',
        onClick: () => {
          const btnBackup = document.getElementById('btn-backup-data');
          if (btnBackup) btnBackup.click();
        }
      });
    }, 2500);
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

        // Record last backup timestamp in IndexedDB settings
        await setSetting('last_backup_timestamp', Date.now().toString());

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

/**
 * Sync latest public data from backup_default.json
 */
export async function syncLatestPublicData() {
  const proceed = await confirmDialog({
    title: 'Nạp dữ liệu mẫu mới nhất từ máy chủ',
    message: 'Thao tác này sẽ tải bộ dữ liệu học tập mới nhất (môn học, TKB, deadline, điểm số) từ máy chủ và ghi đè vào trình duyệt của bạn. Bạn có chắc chắn muốn tiếp tục?',
    confirmText: 'Nạp dữ liệu ngay',
    confirmColor: 'bg-indigo-600 hover:bg-indigo-700 text-white'
  });
  if (!proceed) return;

  try {
    showToast('Đang tải dữ liệu từ máy chủ...', 'info', 2000);
    const res = await fetch('./backup_default.json?t=' + Date.now());
    if (!res.ok) throw new Error('Không thể tải file dữ liệu từ máy chủ');
    const data = await res.json();
    await importData(data);
    showToast('Đã nạp toàn bộ dữ liệu mới nhất thành công!', 'success');
    await switchView(activeView);
  } catch (err) {
    console.error('Lỗi nạp dữ liệu:', err);
    showToast('Không thể nạp dữ liệu: ' + err.message, 'error');
  }
}

/**
 * Service Worker Registration for PWA Offline Caching
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => {
          console.log('✅ ServiceWorker đã sẵn sàng, scope:', reg.scope);
        })
        .catch(err => {
          console.warn('Cảnh báo ServiceWorker registration:', err);
        });
    });
  }
}

// Boot application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
