/**
 * Grades & GPA Module (Module 9)
 * Calculates subject grade (10-scale), 4-scale GPA, letter grade, and weighted semester GPA.
 * Enforces strictly sum of weights == 100%.
 */

import { getAll, getById, saveItem, softDeleteItem } from '../db.js';
import { openModal, closeModal, confirmDialog } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { getColorById, escapeHtml } from '../utils/helpers.js';

let activeNavigateFn = null;

export async function initGradesModule(onNavigate) {
  activeNavigateFn = onNavigate;
  await renderGrades();
}

/**
 * Standard University 10-scale to 4-scale and Letter Grade conversion
 */
export function convertScoreToGrade(score10) {
  if (score10 == null || isNaN(score10)) {
    return { gpa4: null, letter: null, desc: 'Chưa có điểm' };
  }
  const s = Math.round(score10 * 100) / 100;
  if (s >= 8.5) return { gpa4: 4.0, letter: 'A', desc: 'Giỏi / Xuất sắc', color: 'emerald' };
  if (s >= 8.0) return { gpa4: 3.5, letter: 'B+', desc: 'Khá giỏi', color: 'blue' };
  if (s >= 7.0) return { gpa4: 3.0, letter: 'B', desc: 'Khá', color: 'sky' };
  if (s >= 6.5) return { gpa4: 2.5, letter: 'C+', desc: 'Trung bình khá', color: 'amber' };
  if (s >= 5.5) return { gpa4: 2.0, letter: 'C', desc: 'Trung bình', color: 'orange' };
  if (s >= 5.0) return { gpa4: 1.5, letter: 'D+', desc: 'Trung bình yếu', color: 'rose' };
  if (s >= 4.0) return { gpa4: 1.0, letter: 'D', desc: 'Đạt / Yếu', color: 'rose' };
  return { gpa4: 0.0, letter: 'F', desc: 'Không đạt (Rớt môn)', color: 'red' };
}

/**
 * Calculate final 10-scale score from components
 */
export function calculateSubjectFinal(components) {
  if (!components || components.length === 0) {
    return { final10: null, isComplete: false, partial10: null, completedWeight: 0 };
  }
  let totalWeightedScore = 0;
  let completedWeight = 0;
  let hasScores = false;
  let allFilled = true;

  for (const c of components) {
    if (Number(c.weight) > 0) {
      if (c.score != null && !isNaN(c.score)) {
        hasScores = true;
        totalWeightedScore += Number(c.score) * (Number(c.weight) / 100);
        completedWeight += Number(c.weight);
      } else {
        allFilled = false;
      }
    }
  }

  if (!hasScores) {
    return { final10: null, isComplete: false, partial10: null, completedWeight: 0 };
  }

  if (allFilled && completedWeight === 100) {
    return {
      final10: Math.round(totalWeightedScore * 100) / 100,
      isComplete: true,
      partial10: Math.round(totalWeightedScore * 100) / 100,
      completedWeight: 100
    };
  } else {
    // Normalized partial score based on components entered so far
    const normalized = completedWeight > 0 ? (totalWeightedScore / (completedWeight / 100)) : 0;
    return {
      final10: null,
      isComplete: false,
      partial10: Math.round(normalized * 100) / 100,
      completedWeight
    };
  }
}

/**
 * Main render function for Grades View
 */
export async function renderGrades() {
  const container = document.getElementById('grades-view');
  if (!container) return;

  const [allSubjects, allGrades] = await Promise.all([
    getAll('subjects'),
    getAll('grades')
  ]);

  const subjects = (allSubjects || []).filter(s => !s.deletedAt);
  const grades = (allGrades || []).filter(g => !g.deletedAt);

  // Compute overall semester GPA (weighted by credits for completed subjects)
  let totalCreditsWithGrades = 0;
  let totalWeightedGpa4 = 0;
  let totalWeightedGpa10 = 0;
  let gradedSubjectsCount = 0;

  const subjectGradeData = subjects.map(sub => {
    let gradeObj = grades.find(g => g.subjectId === sub.id || g.subjectId === sub.code);
    
    // Default components if none exist yet
    if (!gradeObj) {
      gradeObj = {
        id: `grade_${sub.id}`,
        subjectId: sub.id,
        components: [
          { name: 'Chuyên cần', weight: 10, score: null },
          { name: 'Bài tập / Thực hành', weight: 20, score: null },
          { name: 'Thi giữa kỳ', weight: 20, score: null },
          { name: 'Thi cuối kỳ', weight: 50, score: null }
        ],
        finalScore10: null,
        finalScore4: null,
        letterGrade: null
      };
    }

    const calcResult = calculateSubjectFinal(gradeObj.components);
    const final10 = calcResult.final10;
    const partial10 = calcResult.partial10;
    const isComplete = calcResult.isComplete;
    const gradeConv = convertScoreToGrade(final10 != null ? final10 : partial10);

    if (isComplete && final10 != null && gradeConv.gpa4 != null) {
      const cr = Number(sub.credits) || 0;
      totalCreditsWithGrades += cr;
      totalWeightedGpa4 += gradeConv.gpa4 * cr;
      totalWeightedGpa10 += final10 * cr;
      gradedSubjectsCount++;
    }

    return {
      subject: sub,
      gradeObj,
      calcResult,
      final10,
      partial10,
      isComplete,
      gradeConv
    };
  });

  const semesterGpa4 = totalCreditsWithGrades > 0
    ? (totalWeightedGpa4 / totalCreditsWithGrades).toFixed(2)
    : null;
  const semesterGpa10 = totalCreditsWithGrades > 0
    ? (totalWeightedGpa10 / totalCreditsWithGrades).toFixed(2)
    : null;

  const gpaMeta = semesterGpa4 ? convertScoreToGrade(parseFloat(semesterGpa10)) : null;

  container.innerHTML = `
    <!-- Header -->
    <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <i data-lucide="bar-chart-3" class="w-6 h-6"></i>
          </span>
          <div>
            <h2 class="text-xl md:text-2xl font-black text-slate-900 dark:text-white">Điểm số & GPA Học kỳ</h2>
            <p class="text-xs md:text-sm text-slate-500 dark:text-slate-400">
              Quản lý điểm thành phần, kiểm tra trọng số 100% và tính GPA tích lũy hệ 4
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- GPA Overview Metric Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <!-- GPA 4.0 Card -->
      <div class="p-5 rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/15 relative overflow-hidden flex flex-col justify-between">
        <div class="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-white/10 blur-lg pointer-events-none"></div>
        <div>
          <div class="flex items-center justify-between text-xs text-indigo-200 mb-1">
            <span class="font-bold uppercase tracking-wider">GPA Hệ 4.0</span>
            <i data-lucide="award" class="w-4 h-4"></i>
          </div>
          <div class="text-3xl md:text-4xl font-black">
            ${semesterGpa4 ? `${semesterGpa4} <span class="text-lg font-normal text-indigo-200">/ 4.0</span>` : '<span class="text-xl">Chưa có điểm</span>'}
          </div>
        </div>
        <div class="mt-3 text-xs text-indigo-100 font-semibold">
          ${gpaMeta ? `Xếp loại: <strong>${gpaMeta.desc}</strong>` : 'Cần nhập điểm để tính GPA'}
        </div>
      </div>

      <!-- Điểm TB Hệ 10 Card -->
      <div class="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span class="font-bold uppercase tracking-wider">Điểm TB Hệ 10</span>
            <i data-lucide="calculator" class="w-4 h-4 text-emerald-500"></i>
          </div>
          <div class="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">
            ${semesterGpa10 ? `${semesterGpa10} <span class="text-lg font-normal text-slate-400">/ 10</span>` : '<span class="text-xl text-slate-400">--</span>'}
          </div>
        </div>
        <div class="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Tính theo trọng số tín chỉ học kỳ
        </div>
      </div>

      <!-- Tín chỉ đã tính điểm -->
      <div class="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span class="font-bold uppercase tracking-wider">Tín chỉ đã có điểm</span>
            <i data-lucide="book-check" class="w-4 h-4 text-blue-500"></i>
          </div>
          <div class="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">
            ${totalCreditsWithGrades} <span class="text-lg font-normal text-slate-400">TC</span>
          </div>
        </div>
        <div class="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Trên tổng số ${subjects.reduce((a, b) => a + (Number(b.credits) || 0), 0)} tín chỉ đăng ký
        </div>
      </div>

      <!-- Số môn đã hoàn thành -->
      <div class="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span class="font-bold uppercase tracking-wider">Tiến độ nhập điểm</span>
            <i data-lucide="pie-chart" class="w-4 h-4 text-purple-500"></i>
          </div>
          <div class="text-3xl md:text-4xl font-black text-slate-900 dark:text-white">
            ${gradedSubjectsCount} / ${subjects.length} <span class="text-lg font-normal text-slate-400">môn</span>
          </div>
        </div>
        <div class="mt-3 text-xs text-slate-500 dark:text-slate-400">
          ${gradedSubjectsCount === subjects.length && subjects.length > 0 ? 'Đã hoàn thành bảng điểm!' : 'Còn môn chưa có điểm tổng kết'}
        </div>
      </div>
    </div>

    <!-- Subjects Grades Cards List -->
    <div class="space-y-4">
      <h3 class="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
        <i data-lucide="list" class="w-4 h-4 text-indigo-500"></i>
        <span>Bảng điểm chi tiết từng môn học (${subjects.length})</span>
      </h3>

      ${subjectGradeData.map(({ subject, gradeObj, calcResult, final10, partial10, isComplete, gradeConv }) => {
        const colorDef = getColorById(subject.color || 'indigo');
        const comps = gradeObj.components || [];

        return `
          <div class="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm space-y-4" data-subject-id="${subject.id}">
            <!-- Top Subject Info & Final Scores -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
              <div class="flex items-center gap-3">
                <span class="px-2.5 py-1 text-xs font-mono font-bold rounded-lg ${colorDef.bg} ${colorDef.text} border ${colorDef.border}">
                  ${escapeHtml(subject.code)}
                </span>
                <div>
                  <h4 class="text-base font-extrabold text-slate-900 dark:text-white">${escapeHtml(subject.name)}</h4>
                  <p class="text-xs text-slate-400">Số tín chỉ: <strong>${subject.credits} TC</strong> • GV: ${escapeHtml(subject.lecturer || 'Chưa cập nhật')}</p>
                </div>
              </div>

              <!-- Final Score Summary Badges -->
              <div class="flex items-center gap-2 flex-wrap">
                ${isComplete && final10 != null ? `
                  <div class="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 text-center border border-slate-200 dark:border-slate-700">
                    <span class="text-[10px] text-slate-400 block font-bold">HỆ 10</span>
                    <span class="text-sm font-black text-slate-900 dark:text-white">${final10.toFixed(1)}</span>
                  </div>
                  <div class="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-center border border-indigo-200 dark:border-indigo-800">
                    <span class="text-[10px] text-indigo-500 block font-bold">HỆ 4.0</span>
                    <span class="text-sm font-black text-indigo-600 dark:text-indigo-400">${gradeConv.gpa4.toFixed(1)}</span>
                  </div>
                  <div class="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-center border border-emerald-200 dark:border-emerald-800">
                    <span class="text-[10px] text-emerald-500 block font-bold">ĐIỂM CHỮ</span>
                    <span class="text-sm font-black text-emerald-600 dark:text-emerald-400">${gradeConv.letter}</span>
                  </div>
                ` : partial10 != null ? `
                  <div class="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-center border border-amber-200 dark:border-amber-800">
                    <span class="text-[10px] text-amber-600 dark:text-amber-400 block font-bold">QUÁ TRÌNH</span>
                    <span class="text-sm font-black text-amber-700 dark:text-amber-300">${partial10.toFixed(1)} / 10</span>
                  </div>
                  <div class="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-center border border-blue-200 dark:border-blue-800">
                    <span class="text-[10px] text-blue-500 block font-bold">DỰ KIẾN</span>
                    <span class="text-sm font-black text-blue-600 dark:text-blue-400">${gradeConv.gpa4.toFixed(1)} (${gradeConv.letter})</span>
                  </div>
                  <span class="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 font-semibold">
                    Đã có ${calcResult.completedWeight}%
                  </span>
                ` : `
                  <span class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-500 text-xs font-semibold">
                    Chưa có điểm
                  </span>
                `}

                <button
                  type="button"
                  class="ml-2 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition flex items-center gap-1.5 btn-edit-grade"
                >
                  <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                  <span>Nhập điểm</span>
                </button>
              </div>
            </div>

            <!-- Components Table -->
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th class="pb-2 font-bold">Thành phần đánh giá</th>
                    <th class="pb-2 font-bold text-center">Trọng số (%)</th>
                    <th class="pb-2 font-bold text-center">Điểm hệ 10</th>
                    <th class="pb-2 font-bold text-right">Đóng góp điểm</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
                  ${comps.map(c => {
                    const contribution = c.score != null ? (c.score * (c.weight / 100)).toFixed(2) : '--';
                    return `
                      <tr>
                        <td class="py-2.5 font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(c.name)}</td>
                        <td class="py-2.5 text-center font-mono text-slate-500">${c.weight}%</td>
                        <td class="py-2.5 text-center font-bold font-mono ${c.score != null ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600'}">
                          ${c.score != null ? c.score : 'Chưa nhập'}
                        </td>
                        <td class="py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">${contribution}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons({ root: container });

  // Event Listeners: Edit Grade
  container.querySelectorAll('.btn-edit-grade').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('[data-subject-id]');
      const subId = card?.getAttribute('data-subject-id');
      if (subId) openGradeEditModal(subId);
    });
  });
}

/**
 * Grade Edit Modal: Allows modifying components, weights (enforces sum == 100%), and scores.
 */
export async function openGradeEditModal(subjectId) {
  const subject = await getById('subjects', subjectId);
  if (!subject) return;

  const allGrades = await getAll('grades');
  let gradeObj = allGrades.find(g => (g.subjectId === subject.id || g.subjectId === subject.code) && !g.deletedAt);

  if (!gradeObj) {
    gradeObj = {
      id: `grade_${subject.id}`,
      subjectId: subject.id,
      components: [
        { name: 'Chuyên cần', weight: 10, score: null },
        { name: 'Bài tập', weight: 20, score: null },
        { name: 'Thi giữa kỳ', weight: 20, score: null },
        { name: 'Thi cuối kỳ', weight: 50, score: null }
      ]
    };
  }

  // Clone components array to edit safely
  let components = JSON.parse(JSON.stringify(gradeObj.components || []));

  const renderComponentRows = () => {
    const tbody = document.getElementById('grade-components-tbody');
    const totalWeightEl = document.getElementById('total-weight-badge');
    const saveBtn = document.getElementById('btn-save-grade');
    if (!tbody) return;

    tbody.innerHTML = components.map((c, idx) => `
      <tr data-index="${idx}" class="border-b border-slate-100 dark:border-slate-800">
        <td class="py-2 pr-2">
          <input
            type="text"
            value="${escapeHtml(c.name)}"
            data-field="name"
            class="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          />
        </td>
        <td class="py-2 px-2 w-24">
          <div class="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="100"
              value="${c.weight}"
              data-field="weight"
              class="w-full px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-center font-bold"
            />
            <span class="text-xs text-slate-400">%</span>
          </div>
        </td>
        <td class="py-2 px-2 w-28">
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value="${c.score != null ? c.score : ''}"
            placeholder="0 - 10"
            data-field="score"
            class="w-full px-2 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-center font-bold font-mono"
          />
        </td>
        <td class="py-2 pl-2 text-right w-10">
          <button type="button" class="p-1 text-slate-400 hover:text-rose-500 transition btn-remove-row" data-index="${idx}">
            <i data-lucide="trash" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `).join('');

    if (window.lucide) window.lucide.createIcons({ root: tbody });

    // Calculate total weight
    const totalWeight = components.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
    const isValid = totalWeight === 100;

    if (totalWeightEl) {
      if (isValid) {
        totalWeightEl.className = 'px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
        totalWeightEl.textContent = `Tổng trọng số: 100% (Hợp lệ)`;
      } else {
        totalWeightEl.className = 'px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300';
        totalWeightEl.textContent = `Tổng trọng số: ${totalWeight}% (Bắt buộc phải đúng 100%)`;
      }
    }

    if (saveBtn) {
      saveBtn.disabled = !isValid;
      if (!isValid) {
        saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
      } else {
        saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    }

    // Attach row events
    tbody.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', (e) => {
        const tr = input.closest('tr');
        const idx = parseInt(tr.getAttribute('data-index'), 10);
        const field = input.getAttribute('data-field');
        if (field === 'weight') {
          components[idx].weight = Number(input.value) || 0;
        } else if (field === 'score') {
          components[idx].score = input.value === '' ? null : Number(input.value);
        } else if (field === 'name') {
          components[idx].name = input.value;
        }
        // Recalculate total weight badge without losing input focus
        const newTotal = components.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
        const valid = newTotal === 100;
        if (totalWeightEl) {
          totalWeightEl.className = valid
            ? 'px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
            : 'px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300';
          totalWeightEl.textContent = valid ? 'Tổng trọng số: 100% (Hợp lệ)' : `Tổng trọng số: ${newTotal}% (Bắt buộc phải đúng 100%)`;
        }
        if (saveBtn) {
          saveBtn.disabled = !valid;
          if (!valid) saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
          else saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
      });
    });

    tbody.querySelectorAll('.btn-remove-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        components.splice(idx, 1);
        renderComponentRows();
      });
    });
  };

  const html = `
    <div class="p-6 max-w-xl w-full max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
        <div>
          <h3 class="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <i data-lucide="bar-chart-3" class="w-5 h-5 text-emerald-600"></i>
            <span>Bảng điểm môn: ${escapeHtml(subject.name)}</span>
          </h3>
          <p class="text-xs text-slate-400">Mã môn: ${escapeHtml(subject.code)} • ${subject.credits} Tín chỉ</p>
        </div>
        <button id="btn-close-grade-modal" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <span id="total-weight-badge" class="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-600">
          Đang tính trọng số...
        </span>
        <button id="btn-add-grade-component" type="button" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i> Thêm thành phần
        </button>
      </div>

      <!-- Table Container -->
      <div class="mt-3 overflow-y-auto flex-1 pr-1">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
              <th class="pb-2">Tên thành phần</th>
              <th class="pb-2 text-center">Trọng số</th>
              <th class="pb-2 text-center">Điểm (0-10)</th>
              <th class="pb-2"></th>
            </tr>
          </thead>
          <tbody id="grade-components-tbody"></tbody>
        </table>
      </div>

      <!-- Warning notice -->
      <p class="text-[11px] text-slate-400 mt-2">
        <i data-lucide="info" class="w-3 h-3 inline text-indigo-500"></i>
        Quy chế đào tạo yêu cầu tổng tỷ lệ phần trăm các điểm thành phần phải đạt đúng 100%.
      </p>

      <!-- Footer -->
      <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 flex-shrink-0">
        <button type="button" id="btn-cancel-grade" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          Hủy bỏ
        </button>
        <button type="button" id="btn-save-grade" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition">
          Lưu bảng điểm
        </button>
      </div>
    </div>
  `;

  openModal(html, { size: 'max-w-xl' });
  if (window.lucide) window.lucide.createIcons();

  document.getElementById('btn-close-grade-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-grade')?.addEventListener('click', closeModal);

  renderComponentRows();

  // Add Component Button
  document.getElementById('btn-add-grade-component')?.addEventListener('click', () => {
    components.push({ name: 'Điểm cộng / Đánh giá', weight: 10, score: null });
    renderComponentRows();
  });

  // Save Button
  document.getElementById('btn-save-grade')?.addEventListener('click', async () => {
    const totalWeight = components.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
    if (totalWeight !== 100) {
      showToast(`Tổng trọng số hiện tại là ${totalWeight}%. Phải bằng đúng 100% mới được lưu!`, 'error');
      return;
    }

    const final10 = calculateSubjectFinal(components);
    const gradeConv = convertScoreToGrade(final10);

    const updatedGrade = {
      ...(gradeObj || {}),
      id: gradeObj.id || `grade_${subject.id}`,
      subjectId: subject.id,
      components,
      finalScore10: final10,
      finalScore4: gradeConv.gpa4,
      letterGrade: gradeConv.letter,
      updatedAt: new Date().toISOString()
    };

    await saveItem('grades', updatedGrade);
    closeModal();
    showToast(`Đã lưu bảng điểm môn "${subject.name}"`, 'success');
    renderGrades();
  });
}
