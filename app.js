const CSV_URLS = {
  specs: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS0iLo4xqCPxrtPu7yj5PyybojanJyxP8i0WoDAvMMeIp6Gmpy75gttgQhKkqT0wcr_Q5A-70J3wJ31/pub?gid=0&single=true&output=csv',
  instructors: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS0iLo4xqCPxrtPu7yj5PyybojanJyxP8i0WoDAvMMeIp6Gmpy75gttgQhKkqT0wcr_Q5A-70J3wJ31/pub?gid=1650217321&single=true&output=csv',
  clos: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS0iLo4xqCPxrtPu7yj5PyybojanJyxP8i0WoDAvMMeIp6Gmpy75gttgQhKkqT0wcr_Q5A-70J3wJ31/pub?gid=1&single=true&output=csv',
  contents: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS0iLo4xqCPxrtPu7yj5PyybojanJyxP8i0WoDAvMMeIp6Gmpy75gttgQhKkqT0wcr_Q5A-70J3wJ31/pub?gid=2&single=true&output=csv'
};

const state = {
  courses: [],
  instructorsByCourse: {},
  closByCourse: {},
  contentsByCourse: {},
  selectedCourseId: null,
  lastMainView: 'courses'
};

const els = {
  loadingBanner: document.getElementById('loadingBanner'),
  errorBanner: document.getElementById('errorBanner'),
  tabCourses: document.getElementById('tabCourses'),
  tabMatrix: document.getElementById('tabMatrix'),
  btnReload: document.getElementById('btnReload'),
  viewCourses: document.getElementById('viewCourses'),
  viewMatrix: document.getElementById('viewMatrix'),
  viewDetail: document.getElementById('viewDetail'),
  searchInput: document.getElementById('searchInput'),
  filterLevel: document.getElementById('filterLevel'),
  filterType: document.getElementById('filterType'),
  filterPlo: document.getElementById('filterPlo'),
  courseCountText: document.getElementById('courseCountText'),
  courseGrid: document.getElementById('courseGrid'),
  ploMatrixBody: document.getElementById('ploMatrixBody'),
  ploMatrixFoot: document.getElementById('ploMatrixFoot'),
  btnPrintMatrix: document.getElementById('btnPrintMatrix'),
  btnBack: document.getElementById('btnBack'),
  btnCopySyllabus: document.getElementById('btnCopySyllabus'),
  btnPrintCourse: document.getElementById('btnPrintCourse'),
  courseDetailContent: document.getElementById('courseDetailContent'),
  toast: document.getElementById('toast')
};

function fetchCsv(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (err) => reject(err)
    });
  });
}

function isTrue(val) {
  return String(val || '').trim().toUpperCase() === 'TRUE';
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 2600);
}

function getInstructorName(row) {
  return String(row.responsible_instructor || row.instructor_name || '').trim();
}

function splitInstructorsByRole(rows) {
  const coordinators = [];
  const lecturers = [];

  (rows || []).forEach((row) => {
    const name = getInstructorName(row);
    if (!name) return;
    const role = String(row.instructor_role || '').trim();
    const term = String(row.academic_term || '').trim();
    const entry = { name, term, role };

    if (role.includes('ผู้รับผิดชอบ')) {
      coordinators.push(entry);
    } else {
      lecturers.push(entry);
    }
  });

  return { coordinators, lecturers };
}

async function loadAllData() {
  els.loadingBanner.classList.remove('hidden');
  els.errorBanner.classList.add('hidden');

  try {
    const [specs, instructors, clos, contents] = await Promise.all([
      fetchCsv(CSV_URLS.specs),
      fetchCsv(CSV_URLS.instructors),
      fetchCsv(CSV_URLS.clos),
      fetchCsv(CSV_URLS.contents)
    ]);

    state.instructorsByCourse = {};
    instructors.forEach((row) => {
      const id = String(row.course_id || '').trim();
      if (!id) return;
      if (!state.instructorsByCourse[id]) state.instructorsByCourse[id] = [];
      state.instructorsByCourse[id].push(row);
    });

    state.closByCourse = {};
    clos.forEach((row) => {
      const id = String(row.course_id || '').trim();
      if (!id) return;
      if (!state.closByCourse[id]) state.closByCourse[id] = [];
      state.closByCourse[id].push(row);
    });

    state.contentsByCourse = {};
    contents.forEach((row) => {
      const id = String(row.course_id || '').trim();
      if (!id) return;
      if (!state.contentsByCourse[id]) state.contentsByCourse[id] = [];
      state.contentsByCourse[id].push(row);
    });

    state.courses = specs
      .filter((row) => String(row.course_id || '').trim() !== '')
      .map((course) => {
        const id = String(course.course_id).trim();
        const courseClos = state.closByCourse[id] || [];
        const ploFlags = {
          PLO1: courseClos.some((c) => isTrue(c.PLO1)),
          PLO2: courseClos.some((c) => isTrue(c.PLO2)),
          PLO3: courseClos.some((c) => isTrue(c.PLO3)),
          PLO4: courseClos.some((c) => isTrue(c.PLO4)),
          PLO5: courseClos.some((c) => isTrue(c.PLO5)),
          PLO6: courseClos.some((c) => isTrue(c.PLO6))
        };
        const activePlos = Object.keys(ploFlags).filter((k) => ploFlags[k]);
        const { coordinators, lecturers } = splitInstructorsByRole(state.instructorsByCourse[id]);
        const allInstructorNames = [...coordinators, ...lecturers].map((i) => i.name);

        return {
          ...course,
          course_id: id,
          ploFlags,
          activePlos,
          coordinators,
          lecturers,
          allInstructorNames
        };
      })
      .sort((a, b) => a.course_id.localeCompare(b.course_id));

    els.loadingBanner.classList.add('hidden');
    renderCourseGrid();
    renderPloMatrix();
    if (state.selectedCourseId) {
      renderCourseDetail(state.selectedCourseId);
    }
  } catch (err) {
    console.error(err);
    els.loadingBanner.classList.add('hidden');
    els.errorBanner.textContent = 'ไม่สามารถโหลดข้อมูลจาก Google Sheets ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือสิทธิ์การเผยแพร่ไฟล์ครับ';
    els.errorBanner.classList.remove('hidden');
  }
}

function getFilteredCourses() {
  const q = els.searchInput.value.trim().toLowerCase();
  const level = els.filterLevel.value;
  const type = els.filterType.value;
  const plo = els.filterPlo.value;

  return state.courses.filter((c) => {
    if (level && c.course_id.charAt(3) !== level) return false;
    if (type && !String(c.course_type || '').includes(type)) return false;
    if (plo && !c.ploFlags[plo]) return false;

    if (q) {
      const haystack = [
        c.course_id,
        c.course_code_th,
        c.course_code_en,
        c.title_th,
        c.title_en,
        ...c.allInstructorNames
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function renderCourseGrid() {
  const list = getFilteredCourses();
  els.courseCountText.textContent = `พบ ${list.length} จากทั้งหมด ${state.courses.length} กระบวนวิชา`;

  if (list.length === 0) {
    els.courseGrid.innerHTML = '<p style="color:#6b7280;">ไม่พบกระบวนวิชาที่ตรงกับเงื่อนไขการค้นหา</p>';
    return;
  }

  els.courseGrid.innerHTML = list
    .map((c) => {
      const ploHtml =
        c.activePlos.length > 0
          ? c.activePlos.map((p) => `<span class="plo-pill">${p}</span>`).join('')
          : '<span class="plo-pill empty">ยังไม่ระบุ PLO</span>';

      const coordText = c.coordinators.length > 0 ? c.coordinators.map((i) => i.name).join(', ') : '-';
      const lectText = c.lecturers.length > 0 ? c.lecturers.map((i) => i.name).join(', ') : '-';

      return `
        <div class="course-card" data-id="${escapeHtml(c.course_id)}">
          <div class="card-top">
            <span class="course-id-badge">${escapeHtml(c.course_id)}</span>
            <span class="credit-tag">${escapeHtml(c.credit_structure)} • ${escapeHtml(c.course_type)}</span>
          </div>
          <h3 class="card-title-th">${escapeHtml(c.title_th)}</h3>
          <p class="card-title-en">${escapeHtml(c.title_en)}</p>
          <div class="plo-badges">${ploHtml}</div>
          <div class="card-meta">
            <div class="meta-row"><strong>ผู้รับผิดชอบ:</strong> ${escapeHtml(coordText)}</div>
            <div class="meta-row"><strong>อาจารย์ผู้สอน:</strong> ${escapeHtml(lectText)}</div>
          </div>
        </div>
      `;
    })
    .join('');

  els.courseGrid.querySelectorAll('.course-card').forEach((card) => {
    card.addEventListener('click', () => openCourseDetail(card.dataset.id));
  });
}

function renderPloMatrix() {
  const counts = { PLO1: 0, PLO2: 0, PLO3: 0, PLO4: 0, PLO5: 0, PLO6: 0 };

  els.ploMatrixBody.innerHTML = state.courses
    .map((c) => {
      const cells = ['PLO1', 'PLO2', 'PLO3', 'PLO4', 'PLO5', 'PLO6']
        .map((p) => {
          if (c.ploFlags[p]) {
            counts[p] += 1;
            return '<td><span class="plo-dot" title="สอดคล้อง"></span></td>';
          }
          return '<td></td>';
        })
        .join('');

      return `
        <tr class="matrix-row" data-id="${escapeHtml(c.course_id)}">
          <td><strong>${escapeHtml(c.course_id)}</strong></td>
          <td>${escapeHtml(c.title_th)}</td>
          <td>${escapeHtml(c.credit_structure)}</td>
          ${cells}
        </tr>
      `;
    })
    .join('');

  els.ploMatrixFoot.innerHTML = `
    <tr style="background:#f8fafc;font-weight:700;">
      <td colspan="3">รวมจำนวนกระบวนวิชาที่รับผิดชอบในแต่ละ PLO (จาก ${state.courses.length} วิชา)</td>
      <td>${counts.PLO1}</td>
      <td>${counts.PLO2}</td>
      <td>${counts.PLO3}</td>
      <td>${counts.PLO4}</td>
      <td>${counts.PLO5}</td>
      <td>${counts.PLO6}</td>
    </tr>
  `;

  els.ploMatrixBody.querySelectorAll('.matrix-row').forEach((row) => {
    row.addEventListener('click', () => openCourseDetail(row.dataset.id));
  });
}

function formatMethodList(text) {
  const items = String(text || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length <= 1) return escapeHtml(text || '-');
  return `<ul class="method-list">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
}

function formatInstructorEntries(entries) {
  if (!entries || entries.length === 0) return '-';
  if (entries.length === 1) {
    const e = entries[0];
    return `${escapeHtml(e.name)}${e.term ? `<span class="term-tag">(${escapeHtml(e.term)})</span>` : ''}`;
  }
  return `<ul class="instructor-list">${entries
    .map((e) => `<li>${escapeHtml(e.name)}${e.term ? `<span class="term-tag">(${escapeHtml(e.term)})</span>` : ''}</li>`)
    .join('')}</ul>`;
}

function openCourseDetail(courseId) {
  state.selectedCourseId = courseId;
  renderCourseDetail(courseId);
  els.viewCourses.classList.add('hidden');
  els.viewMatrix.classList.add('hidden');
  els.viewDetail.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCourseDetail(courseId) {
  const course = state.courses.find((c) => c.course_id === courseId);
  if (!course) return;

  const clos = state.closByCourse[courseId] || [];
  const contents = state.contentsByCourse[courseId] || [];

  const cloRowsHtml = clos
    .map((clo) => {
      const plos = ['PLO1', 'PLO2', 'PLO3', 'PLO4', 'PLO5', 'PLO6'].filter((p) => isTrue(clo[p]));
      const ploBadges =
        plos.length > 0
          ? plos.map((p) => `<span class="plo-pill">${p}</span>`).join(' ')
          : '<span class="plo-pill empty">ไม่ระบุ</span>';

      return `
        <tr>
          <td style="white-space:nowrap;font-weight:700;">${escapeHtml(clo.clo_code)}</td>
          <td>
            <div>${escapeHtml(clo.clo_description_th)}</div>
            <div style="color:#6b7280;font-size:0.86rem;margin-top:4px;">${escapeHtml(clo.clo_description_en)}</div>
          </td>
          <td>${ploBadges}</td>
          <td>${formatMethodList(clo.teaching_methods_th)}</td>
          <td>${formatMethodList(clo.assessment_methods_th)}</td>
        </tr>
      `;
    })
    .join('');

  let sumLec = 0;
  let sumLab = 0;
  const contentRowsHtml = contents
    .map((item) => {
      const lec = parseFloat(item.lecture_hours) || 0;
      const lab = parseFloat(item.lab_hours) || 0;
      sumLec += lec;
      sumLab += lab;
      return `
        <tr>
          <td style="text-align:center;">${escapeHtml(item.topic_no)}</td>
          <td>
            <div>${escapeHtml(item.topic_th)}</div>
            <div style="color:#6b7280;font-size:0.86rem;">${escapeHtml(item.topic_en)}</div>
          </td>
          <td style="text-align:center;">${lec > 0 ? lec : '-'}</td>
          <td style="text-align:center;">${lab > 0 ? lab : '-'}</td>
        </tr>
      `;
    })
    .join('');

  els.courseDetailContent.innerHTML = `
    <div class="spec-header">
      <div class="spec-code">${escapeHtml(course.course_code_th)} (${escapeHtml(course.course_id)}) • ${escapeHtml(course.course_code_en)}</div>
      <h2 class="spec-title-th">${escapeHtml(course.title_th)}</h2>
      <p class="spec-title-en">${escapeHtml(course.title_en)}</p>
    </div>

    <div class="info-grid">
      <div class="info-item"><strong>หน่วยกิตและโครงสร้าง</strong>${escapeHtml(course.credit_structure)}</div>
      <div class="info-item"><strong>ลักษณะกระบวนวิชา</strong>${escapeHtml(course.course_type)} (${escapeHtml(course.grading_system)})</div>
      <div class="info-item"><strong>เงื่อนไขที่ต้องผ่านก่อน</strong>${escapeHtml(course.prerequisite_th || 'ไม่มี')}</div>
      <div class="info-item"><strong>อาจารย์ผู้รับผิดชอบกระบวนวิชา</strong>${formatInstructorEntries(course.coordinators)}</div>
      <div class="info-item"><strong>อาจารย์ผู้สอน</strong>${formatInstructorEntries(course.lecturers)}</div>
    </div>

    <div class="section-block">
      <h3>คำอธิบายกระบวนวิชา (Course Description)</h3>
      <div class="desc-box">
        <div class="lang-label">ภาษาไทย</div>
        <div>${escapeHtml(course.description_th)}</div>
      </div>
      <div class="desc-box">
        <div class="lang-label">English</div>
        <div>${escapeHtml(course.description_en)}</div>
      </div>
    </div>

    <div class="section-block">
      <h3>ความสอดคล้องผลลัพธ์การเรียนรู้ การจัดการเรียนการสอน และการประเมินผล (Constructive Alignment)</h3>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:70px;">CLO</th>
              <th style="width:34%;">ผลลัพธ์การเรียนรู้ของกระบวนวิชา</th>
              <th style="width:14%;">PLO ที่สอดคล้อง</th>
              <th style="width:23%;">วิธีการจัดการเรียนรู้</th>
              <th style="width:22%;">วิธีการประเมินผล</th>
            </tr>
          </thead>
          <tbody>${cloRowsHtml}</tbody>
        </table>
      </div>
    </div>

    <div class="section-block">
      <h3>เนื้อหากระบวนวิชาและจำนวนชั่วโมง (Course Contents)</h3>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:70px;text-align:center;">หัวข้อ</th>
              <th>รายละเอียดเนื้อหา</th>
              <th style="width:110px;text-align:center;">ชม. บรรยาย</th>
              <th style="width:110px;text-align:center;">ชม. ปฏิบัติการ</th>
            </tr>
          </thead>
          <tbody>
            ${contentRowsHtml}
            <tr style="background:#f8fafc;font-weight:700;">
              <td colspan="2" style="text-align:right;">รวมจำนวนชั่วโมงตลอดภาคการศึกษา</td>
              <td style="text-align:center;">${sumLec}</td>
              <td style="text-align:center;">${sumLab}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="approval-footer">
      <div><strong>เหตุผลในการพัฒนา/ปรับปรุง:</strong> ${escapeHtml(course.revision_rationale_th || '-')}</div>
      <div><strong>การอนุมัติ:</strong> ${escapeHtml(course.approval_meeting_info || '-')} | <strong>มีผลบังคับใช้:</strong> ${escapeHtml(course.effective_term || '-')}</div>
    </div>
  `;
}

function copySyllabusText() {
  const course = state.courses.find((c) => c.course_id === state.selectedCourseId);
  if (!course) return;
  const clos = state.closByCourse[course.course_id] || [];
  const coordText = course.coordinators.length > 0 ? course.coordinators.map((i) => i.name).join(', ') : '-';
  const lectText = course.lecturers.length > 0 ? course.lecturers.map((i) => i.name).join(', ') : '-';

  const text = [
    `${course.course_code_th} (${course.course_id}) ${course.title_th} ${course.credit_structure}`,
    `${course.course_code_en} ${course.title_en}`,
    `เงื่อนไขที่ต้องผ่านก่อน: ${course.prerequisite_th || 'ไม่มี'}`,
    `อาจารย์ผู้รับผิดชอบกระบวนวิชา: ${coordText}`,
    `อาจารย์ผู้สอน: ${lectText}`,
    '',
    'คำอธิบายกระบวนวิชา:',
    course.description_th,
    '',
    'Course Description:',
    course.description_en,
    '',
    'ผลลัพธ์การเรียนรู้ของกระบวนวิชา (CLOs): นักศึกษาสามารถ',
    ...clos.map((c, idx) => `${idx + 1}. ${c.clo_description_th}`),
    '',
    'Course Learning Outcomes (CLOs): Students are able to',
    ...clos.map((c, idx) => `${idx + 1}. ${c.clo_description_en}`)
  ].join('\n');

  navigator.clipboard.writeText(text).then(() => {
    showToast('คัดลอกข้อความสำหรับทำ Syllabus เรียบร้อยแล้วครับ');
  });
}

function switchMainView(viewName) {
  state.lastMainView = viewName;
  state.selectedCourseId = null;
  els.viewDetail.classList.add('hidden');

  if (viewName === 'courses') {
    els.viewCourses.classList.remove('hidden');
    els.viewMatrix.classList.add('hidden');
    els.tabCourses.classList.add('active');
    els.tabMatrix.classList.remove('active');
  } else {
    els.viewCourses.classList.add('hidden');
    els.viewMatrix.classList.remove('hidden');
    els.tabCourses.classList.remove('active');
    els.tabMatrix.classList.add('active');
  }
}

els.tabCourses.addEventListener('click', () => switchMainView('courses'));
els.tabMatrix.addEventListener('click', () => switchMainView('matrix'));
els.btnReload.addEventListener('click', () => {
  loadAllData();
  showToast('กำลังอัปเดตข้อมูลล่าสุดจาก Google Sheets...');
});
els.searchInput.addEventListener('input', renderCourseGrid);
els.filterLevel.addEventListener('change', renderCourseGrid);
els.filterType.addEventListener('change', renderCourseGrid);
els.filterPlo.addEventListener('change', renderCourseGrid);
els.btnBack.addEventListener('click', () => switchMainView(state.lastMainView));
els.btnCopySyllabus.addEventListener('click', copySyllabusText);
els.btnPrintCourse.addEventListener('click', () => window.print());
els.btnPrintMatrix.addEventListener('click', () => window.print());

loadAllData();
