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
  const existing = await getAll('notes');
  if (existing.length > 0) return existing;

  const sampleNotes = [
    {
      id: 'note_1',
      title: 'Ôn tập Thuật toán Cây AVL & Cân bằng xoay',
      subjectName: 'Cấu trúc Dữ liệu & Giải thuật',
      topic: 'Cấu trúc dữ liệu',
      content: `### Khái niệm cây AVL
Cây AVL là cây nhị phân tìm kiếm tự cân bằng, trong đó độ cao chênh lệch giữa hai cây con của bất kỳ nút nào không quá 1 (hệ số cân bằng thuộc {-1, 0, 1}).

### 4 Trường hợp mất cân bằng & Phép xoay:
1. **Lệch Trái - Trái (Left-Left):** Thực hiện phép xoay Đơn sang Phải (Single Right Rotation).
2. **Lệch Phải - Phải (Right-Right):** Thực hiện phép xoay Đơn sang Trái (Single Left Rotation).
3. **Lệch Trái - Phải (Left-Right):** Xoay Trái tại con trái, sau đó xoay Phải tại nút gốc.
4. **Lệch Phải - Trái (Right-Left):** Xoay Phải tại con phải, sau đó xoay Trái tại nút gốc.

### Danh sách nhiệm vụ ôn thi:
- [x] Đọc lại slide bài giảng chương 4
- [x] Cài đặt thuật toán xoay bằng C++/Java
- [ ] Giải 5 bài tập vẽ cây AVL sau khi thêm các khóa: 10, 20, 15, 25, 5, 1`,
      tags: ['#AVL', '#BST', '#ThiGiuaKy', '#GiaiThuat'],
      isPinned: true,
      color: 'sky',
      createdAt: '2026-09-20T08:30:00.000Z',
      updatedAt: '2026-09-23T14:15:00.000Z'
    },
    {
      id: 'note_2',
      title: 'Bí kíp Layout CSS Flexbox & Responsive Design',
      subjectName: 'Lập trình Web & Ứng dụng',
      topic: 'Thực hành Web',
      content: `### Các thuộc tính quan trọng trên Flex Container:
- \`display: flex;\` - Kích hoạt flex context
- \`flex-direction: row | column | row-reverse\`
- \`justify-content: flex-start | center | space-between | space-around | space-evenly\` (căn theo trục chính)
- \`align-items: stretch | center | flex-start | flex-end\` (căn theo trục phụ)
- \`flex-wrap: nowrap | wrap\`

### Checklist bài tập lớn:
- [x] Phân chia component Header, Sidebar, Content
- [x] Tối ưu hiển thị trên màn hình điện thoại 375px
- [ ] Thử nghiệm dark mode với biến CSS
- [ ] Kiểm thử responsive trên các trình duyệt Edge/Chrome`,
      tags: ['#CSS', '#Flexbox', '#Frontend', '#BaiTapLon'],
      isPinned: false,
      color: 'emerald',
      createdAt: '2026-09-21T10:00:00.000Z',
      updatedAt: '2026-09-22T16:20:00.000Z'
    },
    {
      id: 'note_3',
      title: 'Phương pháp giải Phương trình Vi phân tuyến tính cấp 2',
      subjectName: 'Giải tích 2',
      topic: 'Lý thuyết toán',
      content: `### Dạng tổng quát:
y'' + p*y' + q*y = f(x)

### 1. Giải phương trình thuần nhất liên kết:
Phương trình đặc trưng: k^2 + p*k + q = 0
- Trường hợp 1: Delta > 0 có 2 nghiệm phân biệt k1, k2 => y0 = C1*e^(k1*x) + C2*e^(k2*x)
- Trường hợp 2: Delta = 0 có nghiệm kép k0 => y0 = (C1 + C2*x)*e^(k0*x)
- Trường hợp 3: Delta < 0 có nghiệm phức k = alpha +- i*beta => y0 = e^(alpha*x) * (C1*cos(beta*x) + C2*sin(beta*x))

### Lưu ý khi làm bài kiểm tra:
- Luôn kiểm tra kỹ dấu khi tính delta
- Chú ý dạng vế phải f(x) để chọn dạng nghiệm riêng phù hợp!`,
      tags: ['#GiaiTich', '#ViPhan', '#ToanDaiHoc', '#OnTap'],
      isPinned: true,
      color: 'indigo',
      createdAt: '2026-09-22T09:10:00.000Z',
      updatedAt: '2026-09-23T11:00:00.000Z'
    }
  ];

  for (const item of sampleNotes) {
    await saveItem('notes', item);
  }

  return sampleNotes;
}

/**
 * Seed initial sample mindmap if database is freshly empty
 */
export async function seedInitialMindmapsIfEmpty() {
  const existing = await getAll('mindmaps');
  if (existing.length > 0) return existing;

  const sampleMindmap = {
    id: 'mm_1',
    title: 'Sơ đồ Cấu trúc Dữ liệu & Giải thuật',
    subjectName: 'Cấu trúc Dữ liệu & Giải thuật',
    createdAt: '2026-09-21T09:00:00.000Z',
    updatedAt: '2026-09-23T15:30:00.000Z',
    nodes: [
      { id: 'root', text: 'Cấu trúc Dữ liệu & Giải thuật', x: 440, y: 260, color: 'indigo', isRoot: true },
      // Branch 1: Tuyến tính
      { id: 'node_linear', parentId: 'root', text: '1. Cấu trúc Tuyến tính', x: 140, y: 150, color: 'sky' },
      { id: 'node_array', parentId: 'node_linear', text: 'Mảng (Array)', x: -80, y: 100, color: 'sky' },
      { id: 'node_linkedlist', parentId: 'node_linear', text: 'Danh sách liên kết', x: -110, y: 160, color: 'sky' },
      { id: 'node_stackqueue', parentId: 'node_linear', text: 'Ngăn xếp & Hàng đợi', x: -110, y: 220, color: 'sky' },
      // Branch 2: Phi tuyến tính
      { id: 'node_nonlinear', parentId: 'root', text: '2. Cấu trúc Phi tuyến tính', x: 740, y: 150, color: 'emerald' },
      { id: 'node_binarytree', parentId: 'node_nonlinear', text: 'Cây nhị phân (Binary Tree)', x: 970, y: 100, color: 'emerald' },
      { id: 'node_avltree', parentId: 'node_nonlinear', text: 'Cây AVL tự cân bằng', x: 970, y: 160, color: 'emerald' },
      { id: 'node_graph', parentId: 'node_nonlinear', text: 'Đồ thị (Graph / BFS / DFS)', x: 970, y: 220, color: 'emerald' },
      // Branch 3: Thuật toán sắp xếp
      { id: 'node_sorting', parentId: 'root', text: '3. Giải thuật Sắp xếp', x: 260, y: 400, color: 'amber' },
      { id: 'node_quicksort', parentId: 'node_sorting', text: 'QuickSort (O(n log n))', x: 160, y: 480, color: 'amber' },
      { id: 'node_mergesort', parentId: 'node_sorting', text: 'MergeSort (O(n log n))', x: 380, y: 480, color: 'amber' },
      // Branch 4: Đánh giá độ phức tạp
      { id: 'node_complexity', parentId: 'root', text: '4. Đánh giá Big-O', x: 620, y: 400, color: 'rose' },
      { id: 'node_time', parentId: 'node_complexity', text: 'Thời gian O(n), O(log n)', x: 600, y: 480, color: 'rose' },
      { id: 'node_space', parentId: 'node_complexity', text: 'Bộ nhớ phụ (Space)', x: 800, y: 480, color: 'rose' }
    ]
  };

  await saveItem('mindmaps', sampleMindmap);
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
    title: 'Slide Chương 3: Luồng dữ liệu Kiến trúc Client - Server',
    subjectName: 'Lập trình Web & Ứng dụng',
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
