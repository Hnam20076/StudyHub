/**
 * StudyHub Database Layer (IndexedDB)
 * Manages persistent storage for schedules, notes, mindmaps, image notes, and settings.
 */

import { USER_16_WEEKS_SCHEDULE } from './data/userSchedule.js';

const DB_NAME = 'StudyHubDB';
const DB_VERSION = 1;

let dbInstance = null;

export function openDB() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Schedules store
      if (!db.objectStoreNames.contains('schedules')) {
        const scheduleStore = db.createObjectStore('schedules', { keyPath: 'id' });
        scheduleStore.createIndex('dayOfWeek', 'dayOfWeek', { unique: false });
        scheduleStore.createIndex('startTime', 'startTime', { unique: false });
      }

      // 2. Notes store
      if (!db.objectStoreNames.contains('notes')) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
        notesStore.createIndex('subjectId', 'subjectId', { unique: false });
        notesStore.createIndex('topic', 'topic', { unique: false });
        notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // 3. Mindmaps store
      if (!db.objectStoreNames.contains('mindmaps')) {
        const mindmapStore = db.createObjectStore('mindmaps', { keyPath: 'id' });
        mindmapStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // 4. Image Notes store
      if (!db.objectStoreNames.contains('imageNotes')) {
        const imageStore = db.createObjectStore('imageNotes', { keyPath: 'id' });
        imageStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // 5. Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
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
 * Get all soft-deleted items across Notes, Mindmaps, and ImageNotes.
 * Automatically purges items deleted more than 30 days ago.
 */
export async function getTrashItems() {
  const stores = ['notes', 'mindmaps', 'imageNotes'];
  const trashItems = [];
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const store of stores) {
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
          trashItems.push({
            ...item,
            _storeName: store,
            _typeName: store === 'notes' ? 'Ghi chú' : store === 'mindmaps' ? 'Sơ đồ tư duy' : 'Chú thích ảnh',
            _typeIcon: store === 'notes' ? 'file-text' : store === 'mindmaps' ? 'git-merge' : 'image',
            _typeColor: store === 'notes' ? 'emerald' : store === 'mindmaps' ? 'amber' : 'rose',
            _daysRemaining: daysRemaining
          });
        }
      }
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
 * Export complete database for backup
 */
export async function exportAllData() {
  const schedules = await getAll('schedules');
  const notes = await getAll('notes');
  const mindmaps = await getAll('mindmaps');
  const imageNotes = await getAll('imageNotes');
  const settings = await getAll('settings');

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    appName: 'StudyHub',
    data: {
      schedules,
      notes,
      mindmaps,
      imageNotes,
      settings
    }
  };
}

/**
 * Import and restore database from backup JSON
 */
export async function importData(backupObj) {
  if (!backupObj || !backupObj.data) {
    throw new Error('Dữ liệu sao lưu không đúng định dạng!');
  }

  const stores = ['schedules', 'notes', 'mindmaps', 'imageNotes', 'settings'];
  for (const store of stores) {
    await clearStore(store);
    const items = backupObj.data[store] || [];
    for (const item of items) {
      await saveItem(store, item);
    }
  }

  return true;
}
