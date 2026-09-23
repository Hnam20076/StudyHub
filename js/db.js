/**
 * StudyHub Database Layer (IndexedDB)
 * Manages persistent storage for schedules, notes, mindmaps, image notes, and settings.
 */

import { USER_16_WEEKS_SCHEDULE } from './data/userSchedule.js';

const DB_NAME = 'StudyHubDB';
const DB_VERSION = 2;

let dbInstance = null;

export function openDB() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const tx = event.target.transaction;

      // 1. Schedules store
      let scheduleStore;
      if (!db.objectStoreNames.contains('schedules')) {
        scheduleStore = db.createObjectStore('schedules', { keyPath: 'id' });
        scheduleStore.createIndex('dayOfWeek', 'dayOfWeek', { unique: false });
        scheduleStore.createIndex('startTime', 'startTime', { unique: false });
      } else {
        scheduleStore = tx.objectStore('schedules');
      }
      if (scheduleStore && !scheduleStore.indexNames.contains('subjectId')) {
        scheduleStore.createIndex('subjectId', 'subjectId', { unique: false });
      }

      // 2. Notes store
      let notesStore;
      if (!db.objectStoreNames.contains('notes')) {
        notesStore = db.createObjectStore('notes', { keyPath: 'id' });
        notesStore.createIndex('subjectId', 'subjectId', { unique: false });
        notesStore.createIndex('topic', 'topic', { unique: false });
        notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      } else {
        notesStore = tx.objectStore('notes');
      }
      if (notesStore && !notesStore.indexNames.contains('deletedAt')) {
        notesStore.createIndex('deletedAt', 'deletedAt', { unique: false });
      }

      // 3. Mindmaps store
      let mindmapStore;
      if (!db.objectStoreNames.contains('mindmaps')) {
        mindmapStore = db.createObjectStore('mindmaps', { keyPath: 'id' });
        mindmapStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      } else {
        mindmapStore = tx.objectStore('mindmaps');
      }
      if (mindmapStore && !mindmapStore.indexNames.contains('subjectId')) {
        mindmapStore.createIndex('subjectId', 'subjectId', { unique: false });
      }
      if (mindmapStore && !mindmapStore.indexNames.contains('deletedAt')) {
        mindmapStore.createIndex('deletedAt', 'deletedAt', { unique: false });
      }

      // 4. Image Notes store
      let imageStore;
      if (!db.objectStoreNames.contains('imageNotes')) {
        imageStore = db.createObjectStore('imageNotes', { keyPath: 'id' });
        imageStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      } else {
        imageStore = tx.objectStore('imageNotes');
      }
      if (imageStore && !imageStore.indexNames.contains('subjectId')) {
        imageStore.createIndex('subjectId', 'subjectId', { unique: false });
      }
      if (imageStore && !imageStore.indexNames.contains('deletedAt')) {
        imageStore.createIndex('deletedAt', 'deletedAt', { unique: false });
      }

      // 5. Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // 6. Subjects store (v2)
      if (!db.objectStoreNames.contains('subjects')) {
        const subStore = db.createObjectStore('subjects', { keyPath: 'id' });
        subStore.createIndex('code', 'code', { unique: false });
        subStore.createIndex('createdAt', 'createdAt', { unique: false });
        subStore.createIndex('deletedAt', 'deletedAt', { unique: false });
      }

      // 7. Tasks store (v2)
      if (!db.objectStoreNames.contains('tasks')) {
        const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
        taskStore.createIndex('subjectId', 'subjectId', { unique: false });
        taskStore.createIndex('dueDate', 'dueDate', { unique: false });
        taskStore.createIndex('status', 'status', { unique: false });
        taskStore.createIndex('priority', 'priority', { unique: false });
        taskStore.createIndex('deletedAt', 'deletedAt', { unique: false });
      }

      // 8. Exams store (v2)
      if (!db.objectStoreNames.contains('exams')) {
        const examStore = db.createObjectStore('exams', { keyPath: 'id' });
        examStore.createIndex('subjectId', 'subjectId', { unique: false });
        examStore.createIndex('date', 'date', { unique: false });
        examStore.createIndex('type', 'type', { unique: false });
        examStore.createIndex('deletedAt', 'deletedAt', { unique: false });
      }

      // 9. Grades store (v2)
      if (!db.objectStoreNames.contains('grades')) {
        const gradeStore = db.createObjectStore('grades', { keyPath: 'id' });
        gradeStore.createIndex('subjectId', 'subjectId', { unique: false });
        gradeStore.createIndex('deletedAt', 'deletedAt', { unique: false });
      }

      // 10. Study Sessions store (v2)
      if (!db.objectStoreNames.contains('studySessions')) {
        const sessionStore = db.createObjectStore('studySessions', { keyPath: 'id' });
        sessionStore.createIndex('subjectId', 'subjectId', { unique: false });
        sessionStore.createIndex('startedAt', 'startedAt', { unique: false });
        sessionStore.createIndex('deletedAt', 'deletedAt', { unique: false });
      }

      // 11. Attachments store (v2)
      if (!db.objectStoreNames.contains('attachments')) {
        const attStore = db.createObjectStore('attachments', { keyPath: 'id' });
        attStore.createIndex('entityType', 'entityType', { unique: false });
        attStore.createIndex('entityId', 'entityId', { unique: false });
        attStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Generic CRUD helper methods
 */
export async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getById(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveItem(storeName, item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteItem(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Soft Delete: Marks item as deleted with timestamp (retained for 30 days)
 */
export async function softDeleteItem(storeName, id) {
  const item = await getById(storeName, id);
  if (!item) return null;
  item.deletedAt = new Date().toISOString();
  await saveItem(storeName, item);
  return item;
}

/**
 * Restore an item from Trash
 */
export async function restoreItem(storeName, id) {
  const item = await getById(storeName, id);
  if (!item) return null;
  delete item.deletedAt;
  await saveItem(storeName, item);
  return item;
}

/**
 * Get all soft-deleted items across Notes, Mindmaps, ImageNotes, Subjects, Tasks, Exams, Grades, StudySessions.
 * Automatically purges items deleted more than 30 days ago.
 */
export async function getTrashItems() {
  const stores = ['notes', 'mindmaps', 'imageNotes', 'subjects', 'tasks', 'exams', 'grades', 'studySessions'];
  const trashItems = [];
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const typeMeta = {
    notes: { name: 'Ghi chú', icon: 'file-text', color: 'emerald' },
    mindmaps: { name: 'Sơ đồ tư duy', icon: 'git-merge', color: 'amber' },
    imageNotes: { name: 'Chú thích ảnh', icon: 'image', color: 'rose' },
    subjects: { name: 'Môn học', icon: 'book-open', color: 'indigo' },
    tasks: { name: 'Nhiệm vụ', icon: 'check-square', color: 'blue' },
    exams: { name: 'Kỳ thi', icon: 'calendar-check', color: 'purple' },
    grades: { name: 'Điểm số', icon: 'bar-chart-3', color: 'teal' },
    studySessions: { name: 'Phiên tập trung', icon: 'timer', color: 'orange' }
  };

  for (const store of stores) {
    try {
      const items = await getAll(store);
      for (const item of items) {
        if (item.deletedAt) {
          const deletedTime = new Date(item.deletedAt).getTime();
          const ageMs = now - deletedTime;

          if (ageMs > THIRTY_DAYS_MS) {
            // Permanently purge items older than 30 days
            await deleteItem(store, item.id);
          } else {
            const daysRemaining = Math.max(0, 30 - Math.floor(ageMs / (24 * 60 * 60 * 1000)));
            const meta = typeMeta[store] || { name: 'Mục', icon: 'file', color: 'slate' };
            trashItems.push({
              ...item,
              _storeName: store,
              _typeName: meta.name,
              _typeIcon: meta.icon,
              _typeColor: meta.color,
              _daysRemaining: daysRemaining
            });
          }
        }
      }
    } catch {
      // Store may not exist yet or empty
    }
  }

  // Sort newest deleted first
  trashItems.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  return trashItems;
}

/**
 * Permanently empty all items in Trash
 */
export async function emptyTrash() {
  const items = await getTrashItems();
  for (const item of items) {
    await deleteItem(item._storeName, item.id);
  }
  return true;
}

/**
 * Count total items currently in Trash
 */
export async function countTrashItems() {
  const items = await getTrashItems();
  return items.length;
}

export async function clearStore(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Settings helpers
 */
export async function getSetting(key, defaultValue = null) {
  const result = await getById('settings', key);
  return result ? result.value : defaultValue;
}

export async function setSetting(key, value) {
  return saveItem('settings', { key, value });
}

/**
 * Seed initial sample schedule if database is freshly empty
 */
export async function seedInitialScheduleIfEmpty() {
  const currentVersion = await getSetting('schedule_dataset_version');
  if (currentVersion === '16_weeks_pdf_verified_2627') {
    const existing = await getAll('schedules');
    if (existing.length > 0) return existing;
  }

  // Clear older placeholder schedules
  await clearStore('schedules');

  // Load all 76 sessions across 16 weeks
  for (const item of USER_16_WEEKS_SCHEDULE) {
    await saveItem('schedules', item);
  }

  await setSetting('schedule_dataset_version', '16_weeks_pdf_verified_2627');
  return USER_16_WEEKS_SCHEDULE;
}

/**
 * Seed initial sample notes if database is freshly empty
 */
export async function seedInitialNotesIfEmpty() {
  const version = await getSetting('notes_dataset_version');
  if (version === 'v2_subjects_linked') {
    const existing = await getAll('notes');
    if (existing.length > 0) return existing;
  }

  const sampleNotes = [
    {
      id: 'note_1',
      title: 'Hệ thống số & Đại số Boolean trong Kỹ thuật số',
      subjectId: '71ELEC30083',
      subjectName: 'Kỹ thuật số',
      topic: 'Lý thuyết mạch số',
      content: `### 1. Các hệ thống số cơ bản:
- **Hệ nhị phân (Binary):** Cơ số 2 (0, 1)
- **Hệ thập lục phân (Hexadecimal):** Cơ số 16 (0-9, A-F)
- Chuyển đổi giữa Nhị phân và Hex theo nhóm 4-bit.

### 2. Định lý De Morgan:
- \`!(A . B) = !A + !B\`
- \`!(A + B) = !A . !B\`

### Checklist bài tập:
- [x] Rút gọn biểu thức logic bằng bìa Karnaugh (K-map 4 biến)
- [x] Thiết kế mạch cộng toàn phần (Full Adder) bằng cổng NAND
- [ ] Mô phỏng mạch đếm Mod-10 trên Logisim`,
      tags: ['#KyThuatSo', '#Boolean', '#Karnaugh', '#MachSo'],
      isPinned: true,
      color: 'sky',
      createdAt: '2026-09-20T08:30:00.000Z',
      updatedAt: '2026-09-23T14:15:00.000Z'
    },
    {
      id: 'note_2',
      title: 'Tư duy phản biện & Giao tiếp đa văn hóa',
      subjectId: '71SSK110023',
      subjectName: 'Kỹ năng công dân toàn cầu',
      topic: 'Kỹ năng mềm',
      content: `### 1. Mô hình tư duy phản biện RED:
- **R - Recognize assumptions:** Nhận diện các giả định ngầm.
- **E - Evaluate arguments:** Đánh giá độ tin cậy và logic của lập luận.
- **D - Draw conclusions:** Rút ra kết luận khách quan dựa trên chứng cứ.

### 2. Kế hoạch bài tập nhóm:
- [x] Họp nhóm phân chia chủ đề thuyết trình tuần 3
- [x] Tìm kiếm tài liệu case study về phát triển bền vững (SDGs)
- [ ] Hoàn thành slide trình bày PowerPoint`,
      tags: ['#CongDanToanCau', '#SoftSkills', '#CriticalThinking'],
      isPinned: false,
      color: 'emerald',
      createdAt: '2026-09-21T10:00:00.000Z',
      updatedAt: '2026-09-22T16:20:00.000Z'
    },
    {
      id: 'note_3',
      title: 'Hàm truyền & Đáp ứng tần số của Hệ thống điều khiển',
      subjectId: '71ELEC30163',
      subjectName: 'Hệ thống và điều khiển',
      topic: 'Lý thuyết điều khiển',
      content: `### 1. Khái niệm Hàm truyền (Transfer Function):
Hàm truyền G(s) = Y(s) / U(s) là tỉ số giữa biến đổi Laplace của tín hiệu ra và tín hiệu vào với điều kiện ban đầu bằng 0.

### 2. Tiêu chuẩn ổn định Routh-Hurwitz:
- Lập bảng Routh từ đa thức đặc trưng A(s).
- Hệ thống ổn định khi và chỉ khi tất cả các phần tử ở cột thứ nhất của bảng Routh cùng dấu.`,
      tags: ['#HeThongDieuKhien', '#Laplace', '#RouthHurwitz'],
      isPinned: true,
      color: 'indigo',
      createdAt: '2026-09-22T09:10:00.000Z',
      updatedAt: '2026-09-23T11:00:00.000Z'
    }
  ];

  await clearStore('notes');
  for (const item of sampleNotes) {
    await saveItem('notes', item);
  }
  await setSetting('notes_dataset_version', 'v2_subjects_linked');
  return sampleNotes;
}

/**
 * Seed initial sample mindmap if database is freshly empty
 */
export async function seedInitialMindmapsIfEmpty() {
  const version = await getSetting('mindmaps_dataset_version');
  if (version === 'v2_subjects_linked') {
    const existing = await getAll('mindmaps');
    if (existing.length > 0) return existing;
  }

  const sampleMindmap = {
    id: 'mm_1',
    title: 'Sơ đồ Tổng quan Mạch Logic Kỹ thuật số',
    subjectId: '71ELEC30083',
    subjectName: 'Kỹ thuật số',
    createdAt: '2026-09-21T09:00:00.000Z',
    updatedAt: '2026-09-23T15:30:00.000Z',
    nodes: [
      { id: 'root', text: 'Kỹ thuật số', x: 440, y: 260, color: 'indigo', isRoot: true },
      // Branch 1: Mạch tổ hợp
      { id: 'node_comb', parentId: 'root', text: '1. Mạch Tổ hợp (Combinational)', x: 140, y: 150, color: 'sky' },
      { id: 'node_gates', parentId: 'node_comb', text: 'Cổng logic (AND, OR, NOT, NAND)', x: -80, y: 100, color: 'sky' },
      { id: 'node_adder', parentId: 'node_comb', text: 'Mạch cộng (Half/Full Adder)', x: -110, y: 160, color: 'sky' },
      { id: 'node_mux', parentId: 'node_comb', text: 'Bộ ghép kênh (MUX / DEMUX)', x: -110, y: 220, color: 'sky' },
      // Branch 2: Mạch tuần tự
      { id: 'node_seq', parentId: 'root', text: '2. Mạch Tuần tự (Sequential)', x: 740, y: 150, color: 'emerald' },
      { id: 'node_flipflop', parentId: 'node_seq', text: 'Flip-Flop (D, JK, T)', x: 970, y: 100, color: 'emerald' },
      { id: 'node_registers', parentId: 'node_seq', text: 'Thanh ghi dịch (Shift Register)', x: 970, y: 160, color: 'emerald' },
      { id: 'node_counter', parentId: 'node_seq', text: 'Mạch đếm nhị phân (Counters)', x: 970, y: 220, color: 'emerald' },
      // Branch 3: Phương pháp tối ưu
      { id: 'node_opt', parentId: 'root', text: '3. Tối ưu hàm logic', x: 260, y: 400, color: 'amber' },
      { id: 'node_boolean', parentId: 'node_opt', text: 'Đại số Boolean & De Morgan', x: 160, y: 480, color: 'amber' },
      { id: 'node_kmap', parentId: 'node_opt', text: 'Bìa Karnaugh (K-Map)', x: 380, y: 480, color: 'amber' },
      // Branch 4: Chuyển đổi tín hiệu
      { id: 'node_conv', parentId: 'root', text: '4. Chuyển đổi D/A & A/D', x: 620, y: 400, color: 'rose' },
      { id: 'node_dac', parentId: 'node_conv', text: 'DAC: Mạng điện trở R-2R', x: 600, y: 480, color: 'rose' },
      { id: 'node_adc', parentId: 'node_conv', text: 'ADC: Lấy mẫu & Lượng tử hóa', x: 800, y: 480, color: 'rose' }
    ]
  };

  await clearStore('mindmaps');
  await saveItem('mindmaps', sampleMindmap);
  await setSetting('mindmaps_dataset_version', 'v2_subjects_linked');
  return [sampleMindmap];
}

/**
 * Seed initial sample image note with SVG slide
 */
export async function seedInitialImageNotesIfEmpty() {
  const existing = await getAll('imageNotes');
  if (existing.length > 0) return existing;

  // Crisp sample slide diagram SVG
  const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 562" width="1000" height="562">
    <rect width="1000" height="562" fill="#0f172a" rx="16"/>
    <!-- Top banner -->
    <rect x="0" y="0" width="1000" height="70" fill="#1e293b"/>
    <text x="40" y="44" fill="#38bdf8" font-family="sans-serif" font-size="20" font-weight="bold">BÀI GIẢNG: LẬP TRÌNH WEB &amp; DỊCH VỤ MẠNG</text>
    <text x="750" y="44" fill="#94a3b8" font-family="sans-serif" font-size="14">Slide #14 / Chương 3</text>
    <text x="40" y="115" fill="#f8fafc" font-family="sans-serif" font-size="24" font-weight="bold">Kiến trúc Tổng quan Client - RESTful API - Database</text>
    
    <!-- Box 1: Client -->
    <rect x="80" y="180" width="220" height="230" rx="16" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
    <rect x="100" y="200" width="40" height="40" rx="8" fill="#0284c7"/>
    <text x="150" y="228" fill="#ffffff" font-family="sans-serif" font-size="18" font-weight="bold">Client App</text>
    <text x="100" y="270" fill="#cbd5e1" font-family="sans-serif" font-size="13">• Trình duyệt Web (SPA)</text>
    <text x="100" y="295" fill="#cbd5e1" font-family="sans-serif" font-size="13">• Ứng dụng Di động</text>
    <text x="100" y="320" fill="#cbd5e1" font-family="sans-serif" font-size="13">• Gửi HTTP Request</text>
    <text x="100" y="345" fill="#cbd5e1" font-family="sans-serif" font-size="13">• Xử lý State &amp; UI</text>
    <rect x="100" y="370" width="180" height="26" rx="6" fill="#0369a1"/>
    <text x="125" y="388" fill="#ffffff" font-family="sans-serif" font-size="12" font-weight="bold">Frontend (React / Vue)</text>

    <!-- Arrow 1 -->
    <path d="M 310 280 L 380 280" stroke="#38bdf8" stroke-width="3" stroke-dasharray="6,4"/>
    <polygon points="380,274 394,280 380,286" fill="#38bdf8"/>
    <text x="312" y="265" fill="#38bdf8" font-family="sans-serif" font-size="11" font-weight="bold">HTTP JSON</text>
    
    <!-- Box 2: API Server -->
    <rect x="400" y="180" width="220" height="230" rx="16" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
    <rect x="420" y="200" width="40" height="40" rx="8" fill="#059669"/>
    <text x="470" y="228" fill="#ffffff" font-family="sans-serif" font-size="18" font-weight="bold">REST API</text>
    <text x="420" y="270" fill="#cbd5e1" font-family="sans-serif" font-size="13">• Node.js / Python API</text>
    <text x="420" y="295" fill="#cbd5e1" font-family="sans-serif" font-size="13">• Xác thực JWT Token</text>
    <text x="420" y="320" fill="#cbd5e1" font-family="sans-serif" font-size="13">• Kiểm tra quyền hạn</text>
    <text x="420" y="345" fill="#cbd5e1" font-family="sans-serif" font-size="13">• Business Logic</text>
    <rect x="420" y="370" width="180" height="26" rx="6" fill="#047857"/>
    <text x="445" y="388" fill="#ffffff" font-family="sans-serif" font-size="12" font-weight="bold">Backend Controller</text>

    <!-- Arrow 2 -->
    <path d="M 630 280 L 700 280" stroke="#10b981" stroke-width="3" stroke-dasharray="6,4"/>
    <polygon points="700,274 714,280 700,286" fill="#10b981"/>
    <text x="635" y="265" fill="#10b981" font-family="sans-serif" font-size="11" font-weight="bold">SQL / Query</text>

    <!-- Box 3: Database -->
    <rect x="720" y="180" width="220" height="230" rx="16" fill="#1e293b" stroke="#f59e0b" stroke-width="2"/>
    <rect x="740" y="200" width="40" height="40" rx="8" fill="#d97706"/>
    <text x="790" y="228" fill="#ffffff" font-family="sans-serif" font-size="18" font-weight="bold">Database</text>
    <text x="740" y="270" fill="#cbd5e1" font-family="sans-serif" font-size="13">• SQL / PostgreSQL</text>
    <text x="740" y="295" fill="#cbd5e1" font-family="sans-serif" font-size="13">• NoSQL / MongoDB</text>
    <text x="740" y="320" fill="#cbd5e1" font-family="sans-serif" font-size="13">• IndexedDB Client</text>
    <text x="740" y="345" fill="#cbd5e1" font-family="sans-serif" font-size="13">• Toàn vẹn ACID</text>
    <rect x="740" y="370" width="180" height="26" rx="6" fill="#b45309"/>
    <text x="760" y="388" fill="#ffffff" font-family="sans-serif" font-size="12" font-weight="bold">Storage Engine Layer</text>

    <!-- Footer slide note -->
    <text x="40" y="520" fill="#64748b" font-family="sans-serif" font-size="13">Ghi chú của Giảng viên: Sinh viên nắm vững luồng dữ liệu 3 tầng cho kỳ thi cuối kỳ.</text>
  </svg>`;

  const dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(sampleSvg);

  const sampleImageNote = {
    id: 'img_1',
    title: 'Slide Chương 3: Sơ đồ Mạch Logic Kỹ thuật số',
    subjectId: '71ELEC30083',
    subjectName: 'Kỹ thuật số',
    imageData: dataUrl,
    createdAt: '2026-09-22T14:00:00.000Z',
    updatedAt: '2026-09-23T16:00:00.000Z',
    annotations: [
      {
        id: 'pin_1',
        type: 'pin',
        number: 1,
        xPercent: 19,
        yPercent: 37,
        title: 'Trình duyệt Client (Frontend)',
        comment: 'Ứng dụng chạy trên máy người dùng, sử dụng fetch() hoặc axios để gửi Request kèm Bearer Token lên Server. Khi nhận Response thì cập nhật State trong DOM.'
      },
      {
        id: 'pin_2',
        type: 'pin',
        number: 2,
        xPercent: 51,
        yPercent: 37,
        title: 'Tầng xử lý REST API (Backend)',
        comment: 'Tiếp nhận các lệnh REST (GET, POST, PUT, DELETE), xác thực quyền truy cập Middleware và thực hiện thuật toán nghiệp vụ trước khi truy xuất cơ sở dữ liệu.'
      },
      {
        id: 'pin_3',
        type: 'pin',
        number: 3,
        xPercent: 83,
        yPercent: 37,
        title: 'Tầng Lưu trữ Bền vững (Database)',
        comment: 'Nơi lưu trữ dữ liệu an toàn lâu dài. Lưu ý câu hỏi thi: IndexedDB là giải pháp lưu trữ NoSQL dung lượng lớn trực tiếp trên trình duyệt phía Client.'
      }
    ]
  };

  await saveItem('imageNotes', sampleImageNote);
  await setSetting('image_notes_dataset_version', 'v2_subjects_linked');
  return [sampleImageNote];
}

/**
 * Export complete database for backup (Schema v2)
 */
export async function exportAllData() {
  const stores = [
    'schedules',
    'notes',
    'mindmaps',
    'imageNotes',
    'subjects',
    'tasks',
    'exams',
    'grades',
    'studySessions',
    'attachments',
    'settings'
  ];

  const exportData = {};
  for (const s of stores) {
    try {
      exportData[s] = await getAll(s);
    } catch {
      exportData[s] = [];
    }
  }

  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    appName: 'StudyHub',
    appVersion: '2.0.0',
    data: exportData
  };
}

/**
 * Import and restore database from backup JSON (Compatible with v1 and v2)
 */
export async function importData(backupObj) {
  if (!backupObj || !backupObj.data) {
    throw new Error('Dữ liệu sao lưu không đúng định dạng!');
  }

  const stores = [
    'schedules',
    'notes',
    'mindmaps',
    'imageNotes',
    'subjects',
    'tasks',
    'exams',
    'grades',
    'studySessions',
    'attachments',
    'settings'
  ];

  for (const store of stores) {
    if (Array.isArray(backupObj.data[store])) {
      await clearStore(store);
      const items = backupObj.data[store] || [];
      for (const item of items) {
        await saveItem(store, item);
      }
    }
  }

  return true;
}

/**
 * Attachment Helpers
 */
export async function getAttachmentsByEntity(entityType, entityId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(['attachments'], 'readonly');
      const store = transaction.objectStore('attachments');
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result || [];
        const filtered = all.filter(a => a.entityType === entityType && String(a.entityId) === String(entityId));
        resolve(filtered);
      };
      request.onerror = () => reject(request.error);
    } catch {
      resolve([]);
    }
  });
}

export async function deleteAttachmentsByEntity(entityType, entityId) {
  const attachments = await getAttachmentsByEntity(entityType, entityId);
  for (const att of attachments) {
    await deleteItem('attachments', att.id);
  }
}

/**
 * Seed initial university subjects if freshly empty
 */
export async function seedInitialSubjectsIfEmpty() {
  const existing = await getAll('subjects');
  if (existing && existing.length > 0) return existing;

  const INITIAL_SUBJECTS = [
    {
      id: 'sub_71ELEC30083',
      code: '71ELEC30083',
      name: 'Kỹ thuật số',
      credits: 3,
      lecturer: 'Lê Nguyễn Hòa Bình',
      color: 'sky',
      description: 'Học phần cơ sở ngành về mạch số, logic tổ hợp, tuần tự và thiết kế hệ thống số.',
      goals: 'A',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sub_71SSK110023',
      code: '71SSK110023',
      name: 'Kỹ năng công dân toàn cầu',
      credits: 2,
      lecturer: 'Nguyễn Thị Hoa',
      color: 'purple',
      description: 'Phát triển kỹ năng giao tiếp, tư duy phản biện, làm việc nhóm và năng lực thích ứng quốc tế.',
      goals: 'A',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sub_71ELEC30163',
      code: '71ELEC30163',
      name: 'Hệ thống và điều khiển',
      credits: 3,
      lecturer: 'Dương Văn Khải',
      color: 'emerald',
      description: 'Lý thuyết điều khiển tự động, mô hình hàm truyền, phân tích ổn định và thiết kế bộ điều khiển PID.',
      goals: 'A',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sub_71MECA30023',
      code: '71MECA30023',
      name: 'Cơ học vật liệu',
      credits: 3,
      lecturer: 'Huỳnh Văn Kiểm',
      color: 'amber',
      description: 'Trạng thái ứng suất, biến dạng, độ bền của thanh, dầm và kết cấu chịu lực.',
      goals: 'B+',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sub_71POLH10042',
      code: '71POLH10042',
      name: 'Tư tưởng Hồ Chí Minh',
      credits: 2,
      lecturer: 'Đoàn Thị Hà',
      color: 'rose',
      description: 'Nguồn gốc, quá trình hình thành, nội dung cơ bản của tư tưởng Hồ Chí Minh và sự vận dụng vào thực tiễn Việt Nam.',
      goals: 'A',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  for (const sub of INITIAL_SUBJECTS) {
    await saveItem('subjects', sub);
  }
  return INITIAL_SUBJECTS;
}

/**
 * Seed initial sample tasks, exams, grades, sessions if empty
 */
export async function seedInitialAcademicDataIfEmpty() {
  // 1. Seed initial Tasks
  const tasks = await getAll('tasks');
  if (!tasks || tasks.length === 0) {
    const sampleTasks = [
      {
        id: 'task_1',
        subjectId: 'sub_71ELEC30083',
        title: 'Thiết kế mạch đếm BCD Modulo-60 trên Proteus',
        description: 'Vẽ sơ đồ nguyên lý và mô phỏng mạch đếm sử dụng IC 74LS90 hoặc 74LS190. Báo cáo kết quả và chụp dạng sóng.',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        priority: 'high',
        status: 'in_progress',
        progress: 60,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'task_2',
        subjectId: 'sub_71ELEC30163',
        title: 'Khảo sát ổn định hệ thống điều khiển bằng biểu đồ Bode',
        description: 'Tính toán dự trữ biên và pha của hàm truyền hở G(s). Viết mã MATLAB đối chiếu lý thuyết.',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        priority: 'medium',
        status: 'pending',
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'task_3',
        subjectId: 'sub_71MECA30023',
        title: 'Giải bài tập lớn tính sức bền trục truyền động',
        description: 'Vẽ biểu đồ nội lực Qy, Mz và chọn đường kính trục theo thuyết bền ứng suất tiếp lớn nhất.',
        dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        priority: 'urgent',
        status: 'overdue',
        progress: 30,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'task_4',
        subjectId: 'sub_71SSK110023',
        title: 'Chuẩn bị slide thuyết trình về Phát triển Bền vững (SDG 4)',
        description: 'Tập trung vào mục tiêu bình đẳng giáo dục và tiếp cận công nghệ trong kỷ nguyên AI.',
        dueDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        priority: 'low',
        status: 'completed',
        progress: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    for (const t of sampleTasks) await saveItem('tasks', t);
  }

  // 2. Seed initial Exams
  const exams = await getAll('exams');
  if (!exams || exams.length === 0) {
    const sampleExams = [
      {
        id: 'exam_1',
        subjectId: 'sub_71ELEC30163',
        title: 'Kiểm tra giữa kỳ Hệ thống & Điều khiển',
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        startTime: '09:30',
        endTime: '11:00',
        location: 'CS3.F.09.02',
        type: 'midterm',
        weight: 20,
        description: 'Thi trắc nghiệm + tự luận 60 phút. Phạm vi: Chương 1 đến Chương 3 (Hàm truyền, Biểu đồ khối, Khảo sát ổn định Routh-Hurwitz).',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'exam_2',
        subjectId: 'sub_71ELEC30083',
        title: 'Thi cuối kỳ Kỹ thuật số',
        date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        startTime: '07:30',
        endTime: '09:30',
        location: 'CS3.F.06.11',
        type: 'final',
        weight: 50,
        description: 'Thi tự luận 90 phút. Toàn bộ nội dung lý thuyết mạch số và bài tập thiết kế FSM.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    for (const ex of sampleExams) await saveItem('exams', ex);
  }

  // 3. Seed initial Grades
  const grades = await getAll('grades');
  if (!grades || grades.length === 0) {
    const sampleGrades = [
      {
        id: 'grade_sub_71ELEC30083',
        subjectId: 'sub_71ELEC30083',
        components: [
          { name: 'Chuyên cần', weight: 10, score: 9.5 },
          { name: 'Bài tập trên lớp', weight: 20, score: 8.5 },
          { name: 'Thi giữa kỳ', weight: 20, score: 8.0 },
          { name: 'Thi cuối kỳ', weight: 50, score: 8.5 }
        ],
        finalScore10: 8.5,
        finalScore4: 3.5,
        letterGrade: 'B+',
        updatedAt: new Date().toISOString()
      },
      {
        id: 'grade_sub_71SSK110023',
        subjectId: 'sub_71SSK110023',
        components: [
          { name: 'Chuyên cần', weight: 20, score: 10.0 },
          { name: 'Bài tập nhóm', weight: 30, score: 9.0 },
          { name: 'Báo cáo cuối kỳ', weight: 50, score: 9.0 }
        ],
        finalScore10: 9.2,
        finalScore4: 4.0,
        letterGrade: 'A',
        updatedAt: new Date().toISOString()
      },
      {
        id: 'grade_sub_71ELEC30163',
        subjectId: 'sub_71ELEC30163',
        components: [
          { name: 'Chuyên cần', weight: 10, score: 9.0 },
          { name: 'Thực hành mô phỏng', weight: 20, score: 8.0 },
          { name: 'Giữa kỳ', weight: 20, score: null },
          { name: 'Cuối kỳ', weight: 50, score: null }
        ],
        finalScore10: null,
        finalScore4: null,
        letterGrade: null,
        updatedAt: new Date().toISOString()
      }
    ];
    for (const g of sampleGrades) await saveItem('grades', g);
  }

  // 4. Seed initial Study Sessions
  const sessions = await getAll('studySessions');
  if (!sessions || sessions.length === 0) {
    const sampleSessions = [
      {
        id: 'sess_1',
        subjectId: 'sub_71ELEC30083',
        duration: 50,
        type: 'pomodoro_50',
        startedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        endedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      },
      {
        id: 'sess_2',
        subjectId: 'sub_71ELEC30163',
        duration: 25,
        type: 'pomodoro_25',
        startedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
        endedAt: new Date(Date.now() - 0.5 * 3600 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      }
    ];
    for (const s of sampleSessions) await saveItem('studySessions', s);
  }
}
