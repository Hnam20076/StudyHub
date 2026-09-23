/**
 * Schedule Notification Module
 * Manages Web Notifications API, 60-second ticker, 10-15 minute pre-class alerts,
 * and client-side limitation notices.
 */

import { getAll, getSetting, setSetting } from '../db.js';
import {
  getCurrentVnDay,
  formatTimeHM,
  timeToMinutes,
  escapeHtml
} from '../utils/helpers.js';
import { showToast } from '../components/toast.js';

let notificationInterval = null;

export function isNotificationSupported() {
  return 'Notification' in window;
}

export async function isNotificationEnabled() {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  const enabled = await getSetting('notifications_enabled', false);
  return Boolean(enabled);
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    showToast('Trình duyệt của bạn không hỗ trợ Web Notifications.', 'warning');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await setSetting('notifications_enabled', true);
      showToast('Đã bật thông báo nhắc nhở lịch học thành công!', 'success');
      return true;
    } else if (permission === 'denied') {
      await setSetting('notifications_enabled', false);
      showToast('Quyền thông báo bị từ chối trong cài đặt trình duyệt.', 'warning');
      return false;
    }
    return false;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return false;
  }
}

export async function toggleNotifications(enable) {
  if (enable) {
    const granted = await requestNotificationPermission();
    return granted;
  } else {
    await setSetting('notifications_enabled', false);
    showToast('Đã tắt thông báo nhắc nhở lịch học.', 'info');
    return false;
  }
}

/**
 * Check today's schedule and fire notification if class starts in 10-15 minutes
 */
export async function checkUpcomingClasses() {
  const enabled = await isNotificationEnabled();
  if (!enabled) return;

  try {
    const schedules = await getAll('schedules');
    if (!schedules || schedules.length === 0) return;

    const currentVnDay = getCurrentVnDay();
    const now = new Date();
    const currentMinutes = timeToMinutes(formatTimeHM(now));
    const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

    // Filter today's classes
    const todayClasses = schedules.filter(s => s.dayOfWeek === currentVnDay);

    for (const item of todayClasses) {
      const startMin = timeToMinutes(item.startTime);
      const diff = startMin - currentMinutes;

      // 10 to 15 minutes before class starts
      if (diff >= 10 && diff <= 15) {
        const notifyKey = `notified_${todayStr}_${item.id}`;
        if (localStorage.getItem(notifyKey)) {
          continue; // Already notified for this class today
        }

        // Fire Notification
        const title = `🔔 Nhắc nhở: Sắp đến giờ học môn ${item.subjectName}`;
        const body = `Bắt đầu lúc ${item.startTime} (còn ~${diff} phút)\nPhòng: ${item.room || 'Chưa cập nhật'}\nGV: ${item.lecturer || 'Chưa cập nhật'}`;

        try {
          if (Notification.permission === 'granted') {
            const notif = new Notification(title, {
              body,
              icon: 'icons/icon-192.png',
              badge: 'icons/icon-192.png',
              tag: `studyhub-${item.id}-${todayStr}`
            });

            notif.onclick = () => {
              window.focus();
              notif.close();
            };
          }
        } catch (e) {
          console.warn('Native notification failed, falling back to toast:', e);
        }

        // Also display in-app toast
        showToast(
          `Sắp đến giờ học môn ${item.subjectName} (${item.startTime} tại ${item.room || 'Lớp'})`,
          'info',
          8000
        );

        localStorage.setItem(notifyKey, 'true');
      }
    }
  } catch (err) {
    console.error('Error checking upcoming classes for notification:', err);
  }
}

/**
 * Start the 60-second ticker
 */
export function startScheduleNotificationTicker() {
  if (notificationInterval) {
    clearInterval(notificationInterval);
  }

  // Check immediately
  checkUpcomingClasses();

  // Run every 60 seconds
  notificationInterval = setInterval(checkUpcomingClasses, 60000);
}
