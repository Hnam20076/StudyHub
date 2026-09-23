/**
 * StudyHub Helpers & Utility Functions
 */

export function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

/**
 * Convert JS getDay() (0=Sun, 1=Mon, ..., 6=Sat) to Vietnamese Day Number (2=Mon ... 8=Sun)
 */
export function jsDayToVnDay(jsDay) {
  return jsDay === 0 ? 8 : jsDay + 1;
}

/**
 * Get current day of week in VN format (2=Thứ Hai ... 8=Chủ Nhật)
 */
export function getCurrentVnDay() {
  const now = new Date();
  return jsDayToVnDay(now.getDay());
}

export function getDayNameVietnamese(dayNumber) {
  const map = {
    2: 'Thứ Hai',
    3: 'Thứ Ba',
    4: 'Thứ Tư',
    5: 'Thứ Năm',
    6: 'Thứ Sáu',
    7: 'Thứ Bảy',
    8: 'Chủ Nhật'
  };
  return map[dayNumber] || `Thứ ${dayNumber}`;
}

export function getDayShortVietnamese(dayNumber) {
  const map = {
    2: 'T2',
    3: 'T3',
    4: 'T4',
    5: 'T5',
    6: 'T6',
    7: 'T7',
    8: 'CN'
  };
  return map[dayNumber] || `T${dayNumber}`;
}

export function formatDateVietnamese(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const vnDay = jsDayToVnDay(d.getDay());
  const dayName = getDayNameVietnamese(vnDay);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dayName}, ${dd}/${mm}/${yyyy}`;
}

export function formatTimeHM(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Parse "HH:mm" to minutes since 00:00
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

/**
 * Check if two time intervals overlap: [startA, endA) and [startB, endB)
 */
export function isTimeOverlapping(startA, endA, startB, endB) {
  const minStartA = timeToMinutes(startA);
  const minEndA = timeToMinutes(endA);
  const minStartB = timeToMinutes(startB);
  const minEndB = timeToMinutes(endB);
  return Math.max(minStartA, minStartB) < Math.min(minEndA, minEndB);
}

/**
 * Curated color palette for subjects with light & dark text pairings
 */
export const SUBJECT_COLORS = [
  { id: 'indigo', name: 'Chàm', hex: '#6366F1', bgLight: 'bg-indigo-50 border-indigo-200 text-indigo-900', darkBg: 'dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-200', badge: 'bg-indigo-500' },
  { id: 'emerald', name: 'Xanh lá', hex: '#10B981', bgLight: 'bg-emerald-50 border-emerald-200 text-emerald-900', darkBg: 'dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200', badge: 'bg-emerald-500' },
  { id: 'amber', name: 'Hổ phách', hex: '#F59E0B', bgLight: 'bg-amber-50 border-amber-200 text-amber-900', darkBg: 'dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200', badge: 'bg-amber-500' },
  { id: 'rose', name: 'Hồng sen', hex: '#F43F5E', bgLight: 'bg-rose-50 border-rose-200 text-rose-900', darkBg: 'dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200', badge: 'bg-rose-500' },
  { id: 'sky', name: 'Xanh dương', hex: '#0EA5E9', bgLight: 'bg-sky-50 border-sky-200 text-sky-900', darkBg: 'dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-200', badge: 'bg-sky-500' },
  { id: 'purple', name: 'Tím hoa cà', hex: '#8B5CF6', bgLight: 'bg-purple-50 border-purple-200 text-purple-900', darkBg: 'dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-200', badge: 'bg-purple-500' },
  { id: 'teal', name: 'Xanh ngọc', hex: '#14B8A6', bgLight: 'bg-teal-50 border-teal-200 text-teal-900', darkBg: 'dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-200', badge: 'bg-teal-500' },
  { id: 'orange', name: 'Cam đất', hex: '#EA580C', bgLight: 'bg-orange-50 border-orange-200 text-orange-900', darkBg: 'dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-200', badge: 'bg-orange-500' }
];

export function getColorById(colorId) {
  return SUBJECT_COLORS.find(c => c.id === colorId) || SUBJECT_COLORS[0];
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
