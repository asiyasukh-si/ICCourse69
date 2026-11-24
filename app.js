const CSV_URLS = {
  specs: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS0iLo4xqCPxrtPu7yj5PyybojanJyxP8i0WoDAvMMeIp6Gmpy75gttgQhKkqT0wcr_Q5A-70J3wJ31/pub?gid=0&single=true&output=csv',
  instructors: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS0iLo4xqCPxrtPu7yj5PyybojanJyxP8i0WoDAvMMeIp6Gmpy75gttgQhKkqT0wcr_Q5A-70J3wJ31/pub?gid=1650217321&single=true&output=csv',
  clos: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS0iLo4xqCPxrtPu7yj5PyybojanJyxP8i0WoDAvMMeIp6Gmpy75gttgQhKkqT0wcr_Q5A-70J3wJ31/pub?gid=1&single=true&output=csv',
  contents: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS0iLo4xqCPxrtPu7yj5PyybojanJyxP8i0WoDAvMMeIp6Gmpy75gttgQhKkqT0wcr_Q5A-70J3wJ31/pub?gid=2&single=true&output=csv'
};

const OBE_CACHE_KEY = 'iccourse69_obe_cache_v1';
let initialUrlCourseHandled = false;

const state = {
  courses: [],
  instructorsByCourse: {},
  closByCourse: {},
  contentsByCourse: {},
  selectedCourseId: null,
  selectedDetailSemester: 'ALL',
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

function formatHours(num) {
  if (!num || num <= 0) return '-';
  return Number(num.toFixed(2)).toString();
}

function formatHoursZero(num) {
  return Number((num || 0).toFixed(2)).toString();
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

function parseTopicInstructors(raw) {
  return String(raw || '')
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeSemestersList(rawValue) {
  const str = String(rawValue || '').trim().toUpperCase();
  if (!str) return ['1'];
  if (str === 'CLOSED' || str === 'NONE') return ['CLOSED'];

  const found = [];
  const tokens = str.split(/[,;/\s]+/).filter(Boolean);
  tokens.forEach((tk) => {
    const cleaned = tk.replace(/^T/, '');
    if ((cleaned === '1' || cleaned === '2' || cleaned === '3' || cleaned === 'CLOSED') && !found.includes(cleaned)) {
      found.push(cleaned);
    }
  });

  if (found.includes('CLOSED')) return ['CLOSED'];

  if (found.length === 0) {
    if (str.indexOf('2') !== -1 && str.indexOf('1') !== -1) return ['1', '2'];
    if (str.indexOf('2') !== -1) return ['2'];
    if (str.indexOf('3') !== -1) return ['3'];
    return ['1'];
  }
  return found.sort();
}

function formatSemestersKey(semInput) {
  return normalizeSemestersList(Array.isArray(semInput) ? semInput.join(',') : semInput).join(',');
}

function formatSemesterShort(semKey) {
  const s = formatSemestersKey(semKey);
  if (s === 'CLOSED') return 'ปิดชั่วคราวในปีนี้';
  if (s === '1,2') return 'ภาค 1 และ 2';
  if (s === '2') return 'ภาค 2';
  if (s === '3') return 'ภาคฤดูร้อน';
  return 'ภาค 1';
}

function formatSemesterFull(semKey) {
  const s = formatSemestersKey(semKey);
  if (s === 'CLOSED') return 'ปิดการเรียนการสอนชั่วคราวในปีการศึกษานี้';
  if (s === '1,2') return 'ภาคการศึกษาที่ 1 และ 2';
  if (s === '2') return 'ภาคการศึกษาที่ 2';
  if (s === '3') return 'ภาคฤดูร้อน';
  return 'ภาคการศึกษาที่ 1';
}

function formatCurriculumBadgeLabel(verRaw) {
  const v = String(verRaw || '2564,2569').trim();
  if (v.includes('2564') && v.includes('2569')) return 'หลักสูตร 64 & 69';
  if (v.includes('2564')) return 'เฉพาะหลักสูตร 64';
  return 'หลักสูตร 69';
}

function splitInstructorsByRole(rows, fallbackSemKey) {
  const coordMap = new Map();
  const lectMap = new Map();

  const addEntry = (targetMap, name, role, term, semKey) => {
    const sems = normalizeSemestersList(semKey || fallbackSemKey || '1');
    if (!targetMap.has(name)) {
      targetMap.set(name, {
        name,
        role,
        terms: term ? [term] : [],
        semestersSet: new Set(sems)
      });
    } else {
      const existing = targetMap.get(name);
      if (term && !existing.terms.includes(term)) {
        existing.terms.push(term);
      }
      sems.forEach((s) => existing.semestersSet.add(s));
    }
  };

  (rows || []).forEach((row) => {
    const name = getInstructorName(row);
    if (!name) return;
    const role = String(row.instructor_role || row.role || '').trim();
    const term = String(row.academic_term || '').trim();
    const rawSem = String(row.semester || '').trim();
    const semKey = rawSem ? formatSemestersKey(rawSem) : formatSemestersKey(fallbackSemKey || '1');

    if (role.includes('ผู้รับผิดชอบ')) {
      addEntry(coordMap, name, role, term, semKey);
    } else {
      addEntry(lectMap, name, role, term, semKey);
    }
  });

  const finalizeList = (mapObj) =>
    Array.from(mapObj.values()).map((item) => {
      const semestersList = Array.from(item.semestersSet).sort();
      return {
        name: item.name,
        role: item.role,
        term: item.terms.join(', '),
        semester: semestersList.join(','),
        semestersList
      };
    });

  return {
    coordinators: finalizeList(coordMap),
    lecturers: finalizeList(lectMap)
  };
}

function filterInstructorsBySemester(entries, semFilter) {
  if (!entries || entries.length === 0) return [];
  if (!semFilter || semFilter === 'ALL') return entries;
  return entries
    .filter((e) => (e.semestersList || ['1']).includes(semFilter))
    .map((e) => ({
      ...e,
      semester: semFilter,
      semestersList: [semFilter]
    }));
}

function buildTeachingLoadSummary(contents, defaultSemKey, semFilter = 'ALL') {
  const map = {};
  let hasSharedTopic = false;
  let grandTotalHours = 0;
  let sumLec = 0;
  let sumLab = 0;
  let sumSem1 = 0;
  let sumSem2 = 0;
  let matchedTopicCount = 0;
  const isAllSem = !semFilter || semFilter === 'ALL';

  (contents || []).forEach((item) => {
    const topicSems =
      item.semesters_list && item.semesters_list.length > 0
        ? item.semesters_list
        : normalizeSemestersList(item.semester || defaultSemKey || '1');

    const activeSems = isAllSem ? topicSems : topicSems.filter((s) => s === semFilter);
    if (activeSems.length === 0) return;

    matchedTopicCount += 1;
    const lec = parseFloat(item.lecture_hours) || 0;
    const lab = parseFloat(item.lab_hours) || 0;

    const names = parseTopicInstructors(item.topic_instructor);
    const assigned = names.length > 0 ? names : ['ยังไม่ระบุผู้สอน'];
    if (assigned.length > 1) hasSharedTopic = true;

    const shareLec = lec / assigned.length;
    const shareLab = lab / assigned.length;
    const shareTotal = shareLec + shareLab;

    activeSems.forEach((sem) => {
      sumLec += lec;
      sumLab += lab;
      grandTotalHours += lec + lab;
      if (sem === '1') sumSem1 += lec + lab;
      else if (sem === '2') sumSem2 += lec + lab;

      assigned.forEach((name) => {
        if (!map[name]) {
          map[name] = {
            name,
            topicCount: 0,
            sem1Total: 0,
            sem2Total: 0,
            lec: 0,
            lab: 0,
            total: 0
          };
        }
        map[name].lec += shareLec;
        map[name].lab += shareLab;
        map[name].total += shareTotal;
        if (sem === '1') map[name].sem1Total += shareTotal;
        else if (sem === '2') map[name].sem2Total += shareTotal;
      });
    });

    assigned.forEach((name) => {
      if (map[name]) {
        map[name].topicCount += 1;
      }
    });
  });

  const rows = Object.values(map).sort((a, b) => {
    if (a.name === 'ยังไม่ระบุผู้สอน') return 1;
    if (b.name === 'ยังไม่ระบุผู้สอน') return -1;
    return b.total - a.total || a.name.localeCompare(b.name, 'th');
  });

  return {
    rows,
    hasSharedTopic,
    grandTotalHours,
    sumLec,
    sumLab,
    sumSem1,
    sumSem2,
    matchedTopicCount
  };
}

function ensureSemesterFilterControl() {
  const controlsWrap = document.querySelector('.filter-controls');
  if (!controlsWrap) return;

  if (!els.filterCurriculum) {
    const existingCurr = document.getElementById('filterCurriculum');
    if (existingCurr) {
      els.filterCurriculum = existingCurr;
    } else {
      const currSel = document.createElement('select');
      currSel.id = 'filterCurriculum';
      currSel.setAttribute('aria-label', 'กรองตามหลักสูตร');
      currSel.innerHTML = `
        <option value="">ทุกหลักสูตร (64 & 69)</option>
        <option value="2569">หลักสูตร 2569 (รหัส 69+)</option>
        <option value="2564">หลักสูตร 2564 (รหัส 64-68)</option>
      `;
      currSel.addEventListener('change', renderCourseGrid);
      controlsWrap.insertBefore(currSel, controlsWrap.firstChild);
      els.filterCurriculum = currSel;
    }
  }

  if (!els.filterSemester) {
    const existingSem = document.getElementById('filterSemester');
    if (existingSem) {
      els.filterSemester = existingSem;
    } else {
      const sel = document.createElement('select');
      sel.id = 'filterSemester';
      sel.setAttribute('aria-label', 'กรองตามภาคการศึกษา');
      sel.innerHTML = `
        <option value="">ทุกภาคการศึกษา (ที่เปิด)</option>
        <option value="1">ภาคการศึกษาที่ 1</option>
        <option value="2">ภาคการศึกษาที่ 2</option>
        <option value="CLOSED">วิชาที่ปิดชั่วคราวในปีนี้</option>
      `;
      sel.addEventListener('change', renderCourseGrid);
      controlsWrap.insertBefore(sel, els.filterCurriculum.nextSibling);
      els.filterSemester = sel;
    }
  }

  if (!els.filterAssignStatus) {
    const existingAssign = document.getElementById('filterAssignStatus');
    if (existingAssign) {
      els.filterAssignStatus = existingAssign;
    } else {
      const assignSel = document.createElement('select');
      assignSel.id = 'filterAssignStatus';
      assignSel.setAttribute('aria-label', 'กรองตามสถานะการระบุผู้สอน');
      assignSel.innerHTML = `
        <option value="">ทุกสถานะผู้สอน</option>
        <option value="COMPLETE">ระบุผู้สอนครบแล้ว</option>
        <option value="INCOMPLETE">รอระบุผู้สอน / ยังไม่ครบ</option>
      `;
      assignSel.addEventListener('change', renderCourseGrid);
      controlsWrap.appendChild(assignSel);
      els.filterAssignStatus = assignSel;
    }
  }
}

function applyRawDataToState(specs, instructors, clos, contents) {
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
      const rawContents = state.contentsByCourse[id] || [];
      const rawInstructors = state.instructorsByCourse[id] || [];

      const specSemRaw = String(course.offered_semesters || '').trim();
      const inferredSemSet = new Set();
      if (specSemRaw) {
        normalizeSemestersList(specSemRaw).forEach((s) => inferredSemSet.add(s));
      }
      rawContents.forEach((item) => {
        if (String(item.semester || '').trim()) {
          normalizeSemestersList(item.semester).forEach((s) => inferredSemSet.add(s));
        }
      });
      rawInstructors.forEach((inst) => {
        if (String(inst.semester || '').trim()) {
          normalizeSemestersList(inst.semester).forEach((s) => inferredSemSet.add(s));
        }
      });
      if (inferredSemSet.size === 0) inferredSemSet.add('1');

      const semestersList = Array.from(inferredSemSet).sort();
      const offeredSemKey = specSemRaw ? formatSemestersKey(specSemRaw) : semestersList.join(',');

      const courseContents = rawContents.map((item) => {
        const itemSemKey = String(item.semester || '').trim()
          ? formatSemestersKey(item.semester)
          : offeredSemKey;
        return {
          ...item,
          semester: itemSemKey,
          semesters_list: normalizeSemestersList(itemSemKey)
        };
      });
      state.contentsByCourse[id] = courseContents;

      const ploFlags = {
        PLO1: courseClos.some((c) => isTrue(c.PLO1)),
        PLO2: courseClos.some((c) => isTrue(c.PLO2)),
        PLO3: courseClos.some((c) => isTrue(c.PLO3)),
        PLO4: courseClos.some((c) => isTrue(c.PLO4)),
        PLO5: courseClos.some((c) => isTrue(c.PLO5)),
        PLO6: courseClos.some((c) => isTrue(c.PLO6))
      };
      const activePlos = Object.keys(ploFlags).filter((k) => ploFlags[k]);
      const { coordinators, lecturers } = splitInstructorsByRole(rawInstructors, offeredSemKey);
      const topicInstructorNames = courseContents.flatMap((item) =>
        parseTopicInstructors(item.topic_instructor)
      );
      const allInstructorNames = Array.from(
        new Set([...coordinators.map((i) => i.name), ...lecturers.map((i) => i.name), ...topicInstructorNames])
      );

      const hasCoordinator = coordinators.length > 0;
      const unassignedTopicCount = courseContents.filter(
        (item) => parseTopicInstructors(item.topic_instructor).length === 0
      ).length;
      const isAssignmentComplete =
        hasCoordinator && courseContents.length > 0 && unassignedTopicCount === 0;

      return {
        ...course,
        course_id: id,
        offered_semesters: offeredSemKey,
        semesters_list: semestersList,
        ploFlags,
        activePlos,
        coordinators,
        lecturers,
        allInstructorNames,
        hasCoordinator,
        unassignedTopicCount,
        isAssignmentComplete
      };
    })
    .sort((a, b) => a.course_id.localeCompare(b.course_id));

  els.loadingBanner.classList.add('hidden');
  renderCourseGrid();
  renderPloMatrix();

  if (!initialUrlCourseHandled) {
    initialUrlCourseHandled = true;
    const urlCourse = new URLSearchParams(window.location.search).get('course');
    if (urlCourse) {
      const cleanId = String(urlCourse).trim();
      if (state.courses.some((c) => c.course_id === cleanId)) {
        openCourseDetail(cleanId);
        return;
      }
    }
  }

  if (state.selectedCourseId) {
    renderCourseDetail(state.selectedCourseId);
  }
}

async function loadAllData() {
  ensureSemesterFilterControl();
  els.errorBanner.classList.add('hidden');
  let renderedFromCache = false;

  try {
    const cachedRaw = localStorage.getItem(OBE_CACHE_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached && cached.specs && cached.instructors && cached.clos && cached.contents) {
        applyRawDataToState(cached.specs, cached.instructors, cached.clos, cached.contents);
        renderedFromCache = true;
      }
    }
  } catch (e) {}

  if (!renderedFromCache) {
    els.loadingBanner.classList.remove('hidden');
  }

  try {
    const [specs, instructors, clos, contents] = await Promise.all([
      fetchCsv(CSV_URLS.specs),
      fetchCsv(CSV_URLS.instructors),
      fetchCsv(CSV_URLS.clos),
      fetchCsv(CSV_URLS.contents)
    ]);

    applyRawDataToState(specs, instructors, clos, contents);
    try {
      localStorage.setItem(
        OBE_CACHE_KEY,
        JSON.stringify({ specs, instructors, clos, contents, updatedAt: Date.now() })
      );
    } catch (e) {}
  } catch (err) {
    console.error(err);
    els.loadingBanner.classList.add('hidden');
    if (!renderedFromCache) {
      els.errorBanner.textContent = 'ไม่สามารถโหลดข้อมูลจาก Google Sheets ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือสิทธิ์การเผยแพร่ไฟล์ครับ';
      els.errorBanner.classList.remove('hidden');
    }
  }
}

function getFilteredCourses() {
  const q = els.searchInput.value.trim().toLowerCase();
  const curr = els.filterCurriculum ? els.filterCurriculum.value : '';
  const sem = els.filterSemester ? els.filterSemester.value : '';
  const assignStatus = els.filterAssignStatus ? els.filterAssignStatus.value : '';
  const level = els.filterLevel.value;
  const type = els.filterType.value;
  const plo = els.filterPlo.value;

  return state.courses.filter((c) => {
    const isClosed = String(c.offered_semesters || '').toUpperCase() === 'CLOSED';
    const cVer = String(c.curriculum_version || '2564,2569');
    if (curr && !cVer.includes(curr)) return false;
    if (sem === 'CLOSED') {
      if (!isClosed) return false;
    } else if (sem) {
      if (isClosed || !(c.semesters_list || ['1']).includes(sem)) return false;
    } else {
      if (isClosed) return false;
    }
    if (assignStatus === 'COMPLETE' && !c.isAssignmentComplete) return false;
    if (assignStatus === 'INCOMPLETE' && c.isAssignmentComplete) return false;
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

function formatCardInstructors(entries, isMultiSemCourse) {
  if (!entries || entries.length === 0) return '-';
  return entries
    .map((e) =>
      isMultiSemCourse && e.semester
        ? `${e.name} (${formatSemesterShort(e.semester)})`
        : e.name
    )
    .join(', ');
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

      const isMultiSem = (c.semesters_list || []).length > 1;
      const semBadgeLabel = formatSemesterShort(c.offered_semesters);
      const currBadgeLabel = formatCurriculumBadgeLabel(c.curriculum_version);
      const coordText = formatCardInstructors(c.coordinators, isMultiSem);
      const lectText = formatCardInstructors(c.lecturers, isMultiSem);
      const assignBadgeHtml = !c.isAssignmentComplete
        ? `<span class="plo-pill empty" title="ยังระบุผู้รับผิดชอบหรือผู้สอนรายหัวข้อไม่ครบ (${c.unassignedTopicCount} หัวข้อว่าง)">รอระบุผู้สอน</span>`
        : '';

      return `
        <div class="course-card" data-id="${escapeHtml(c.course_id)}">
          <div class="card-top">
            <span class="course-id-badge">${escapeHtml(c.course_id)}</span>
            <span class="credit-tag">${escapeHtml(c.credit_structure)} • ${escapeHtml(c.course_type)} • ${escapeHtml(semBadgeLabel)} • ${escapeHtml(currBadgeLabel)}</span>
          </div>
          <h3 class="card-title-th">${escapeHtml(c.title_th)}</h3>
          <p class="card-title-en">${escapeHtml(c.title_en)}</p>
          <div class="plo-badges">${ploHtml}${assignBadgeHtml}</div>
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
    <tr style="background:linear-gradient(90deg, #faf5ff 0%, #fffdf2 100%);font-weight:700;">
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

function formatInstructorMetaTag(entry) {
  const parts = [];
  if (entry.semester) parts.push(formatSemesterShort(entry.semester));
  if (entry.term) parts.push(entry.term);
  if (parts.length === 0) return '';
  return `<span class="term-tag">(${escapeHtml(parts.join(' • '))})</span>`;
}

function formatInstructorEntries(entries) {
  if (!entries || entries.length === 0) return '-';
  if (entries.length === 1) {
    const e = entries[0];
    return `${escapeHtml(e.name)}${formatInstructorMetaTag(e)}`;
  }
  return `<ul class="instructor-list">${entries
    .map((e) => `<li>${escapeHtml(e.name)}${formatInstructorMetaTag(e)}</li>`)
    .join('')}</ul>`;
}

function openCourseDetail(courseId) {
  state.selectedCourseId = courseId;
  state.selectedDetailSemester = 'ALL';
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('course', courseId);
    window.history.replaceState({}, '', url.toString());
  } catch (e) {}
  renderCourseDetail(courseId);
  els.viewCourses.classList.add('hidden');
  els.viewMatrix.classList.add('hidden');
  els.viewDetail.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setDetailSemesterFilter(sem) {
  state.selectedDetailSemester = sem || 'ALL';
  if (state.selectedCourseId) {
    renderCourseDetail(state.selectedCourseId);
  }
}

function renderCourseDetail(courseId) {
  const course = state.courses.find((c) => c.course_id === courseId);
  if (!course) return;

  const clos = state.closByCourse[courseId] || [];
  const allContents = state.contentsByCourse[courseId] || [];
  const courseSems = course.semesters_list || ['1'];
  const isMultiSemCourse = courseSems.length > 1;
  const activeSem =
    isMultiSemCourse && state.selectedDetailSemester !== 'ALL' && courseSems.includes(state.selectedDetailSemester)
      ? state.selectedDetailSemester
      : 'ALL';

  const filteredContents =
    activeSem === 'ALL'
      ? allContents
      : allContents.filter((item) => (item.semesters_list || ['1']).includes(activeSem));

  const filteredCoordinators = filterInstructorsBySemester(course.coordinators, activeSem);
  const filteredLecturers = filterInstructorsBySemester(course.lecturers, activeSem);

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

  let sumTopicLec = 0;
  let sumTopicLab = 0;
  const contentRowsHtml = filteredContents
    .map((item) => {
      const lec = parseFloat(item.lecture_hours) || 0;
      const lab = parseFloat(item.lab_hours) || 0;
      sumTopicLec += lec;
      sumTopicLab += lab;

      const topicInstructors = parseTopicInstructors(item.topic_instructor);
      const instructorBadges =
        topicInstructors.length > 0
          ? topicInstructors.map((name) => `<span class="instructor-pill">${escapeHtml(name)}</span>`).join('')
          : '<span style="color:#9ca3af;">-</span>';

      const displaySemKey = activeSem === 'ALL' ? item.semester || course.offered_semesters : activeSem;

      return `
        <tr>
          <td style="text-align:center;">${escapeHtml(item.topic_no)}</td>
          <td>
            <div>${escapeHtml(item.topic_th)}</div>
            <div style="color:#6b7280;font-size:0.86rem;">${escapeHtml(item.topic_en)}</div>
          </td>
          <td style="text-align:center;"><span class="plo-pill">${escapeHtml(formatSemesterShort(displaySemKey))}</span></td>
          <td style="text-align:center;">${formatHours(lec)}</td>
          <td style="text-align:center;">${formatHours(lab)}</td>
          <td style="text-align:center;">${instructorBadges}</td>
        </tr>
      `;
    })
    .join('');

  const workload = buildTeachingLoadSummary(allContents, course.offered_semesters, activeSem);
  const showSemColumns = isMultiSemCourse && activeSem === 'ALL';

  const workloadRowsHtml = workload.rows
    .map((row) => {
      const pct = workload.grandTotalHours > 0 ? ((row.total / workload.grandTotalHours) * 100).toFixed(1) : '0.0';
      return `
        <tr>
          <td><strong>${escapeHtml(row.name)}</strong></td>
          <td style="text-align:center;">${row.topicCount}</td>
          ${
            showSemColumns
              ? `
            <td style="text-align:center;">${formatHoursZero(row.sem1Total)}</td>
            <td style="text-align:center;">${formatHoursZero(row.sem2Total)}</td>
          `
              : ''
          }
          <td style="text-align:center;">${formatHours(row.lec)}</td>
          <td style="text-align:center;">${formatHours(row.lab)}</td>
          <td style="text-align:center;font-weight:700;">${formatHoursZero(row.total)}</td>
          <td style="text-align:center;">${pct}%</td>
        </tr>
      `;
    })
    .join('');

  const semesterFilterBarHtml = isMultiSemCourse
    ? `
      <div class="no-print" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:14px;padding:10px 14px;background:linear-gradient(90deg, #faf5ff 0%, #fffdf2 100%);border:1px solid var(--border);border-radius:10px;">
        <strong style="font-size:0.88rem;color:var(--primary);">มุมมองภาคการศึกษา:</strong>
        <button type="button" class="${activeSem === 'ALL' ? 'btn-primary' : 'btn-outline'}" style="padding:5px 12px;font-size:0.84rem;" data-sem-btn="ALL">ทุกภาคการศึกษา (${escapeHtml(formatSemesterShort(course.offered_semesters))})</button>
        ${courseSems
          .map(
            (s) => `
          <button type="button" class="${activeSem === s ? 'btn-primary' : 'btn-outline'}" style="padding:5px 12px;font-size:0.84rem;" data-sem-btn="${escapeHtml(s)}">${escapeHtml(formatSemesterFull(s))}</button>
        `
          )
          .join('')}
      </div>
    `
    : '';

  const totalLoadLabel = showSemColumns
    ? 'รวมชั่วโมงทั้งปี'
    : `รวมชั่วโมง (${formatSemesterShort(activeSem === 'ALL' ? course.offered_semesters : activeSem)})`;

  els.courseDetailContent.innerHTML = `
    <div class="spec-header">
      <div class="spec-code">${escapeHtml(course.course_code_th)} (${escapeHtml(course.course_id)}) • ${escapeHtml(course.course_code_en)}</div>
      <h2 class="spec-title-th">${escapeHtml(course.title_th)}</h2>
      <p class="spec-title-en">${escapeHtml(course.title_en)}</p>
    </div>

    ${semesterFilterBarHtml}

    <div class="info-grid">
      <div class="info-item"><strong>หน่วยกิตและโครงสร้าง</strong>${escapeHtml(course.credit_structure)}</div>
      <div class="info-item"><strong>ลักษณะกระบวนวิชา</strong>${escapeHtml(course.course_type)} (${escapeHtml(course.grading_system)})</div>
      <div class="info-item"><strong>ภาคการศึกษาที่เปิดสอน</strong>${escapeHtml(formatSemesterFull(course.offered_semesters))}</div>
      <div class="info-item"><strong>เงื่อนไขที่ต้องผ่านก่อน</strong>${escapeHtml(course.prerequisite_th || 'ไม่มี')}</div>
      <div class="info-item"><strong>อาจารย์ผู้รับผิดชอบกระบวนวิชา</strong>${formatInstructorEntries(filteredCoordinators.length > 0 ? filteredCoordinators : course.coordinators)}</div>
      <div class="info-item"><strong>อาจารย์ผู้สอน</strong>${formatInstructorEntries(filteredLecturers)}</div>
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
      <h3>เนื้อหากระบวนวิชา จำนวนชั่วโมง และอาจารย์ผู้สอนรายหัวข้อ (Course Contents)</h3>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:65px;text-align:center;">หัวข้อ</th>
              <th>รายละเอียดเนื้อหา</th>
              <th style="width:95px;text-align:center;">ภาคฯ</th>
              <th style="width:95px;text-align:center;">ชม. บรรยาย</th>
              <th style="width:100px;text-align:center;">ชม. ปฏิบัติการ</th>
              <th style="width:150px;text-align:center;">อาจารย์ผู้สอน</th>
            </tr>
          </thead>
          <tbody>
            ${contentRowsHtml}
            <tr style="background:linear-gradient(90deg, #faf5ff 0%, #fffdf2 100%);font-weight:700;">
              <td colspan="3" style="text-align:right;">รวมจำนวนชั่วโมงตามแผนการสอน (${escapeHtml(activeSem === 'ALL' ? formatSemesterShort(course.offered_semesters) : formatSemesterShort(activeSem))})</td>
              <td style="text-align:center;">${formatHoursZero(sumTopicLec)}</td>
              <td style="text-align:center;">${formatHoursZero(sumTopicLab)}</td>
              <td style="text-align:center;">รวม ${formatHoursZero(sumTopicLec + sumTopicLab)} ชม.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="section-block">
      <h3>สรุปภาระชั่วโมงสอนรายบุคคลตามแผนการสอน (Teaching Load Summary)</h3>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>อาจารย์ผู้สอน</th>
              <th style="width:105px;text-align:center;">จำนวนหัวข้อ</th>
              ${
                showSemColumns
                  ? `
                <th style="width:100px;text-align:center;">ภาค 1 (ชม.)</th>
                <th style="width:100px;text-align:center;">ภาค 2 (ชม.)</th>
              `
                  : ''
              }
              <th style="width:105px;text-align:center;">ชม. บรรยาย</th>
              <th style="width:105px;text-align:center;">ชม. ปฏิบัติการ</th>
              <th style="width:120px;text-align:center;">${escapeHtml(totalLoadLabel)}</th>
              <th style="width:95px;text-align:center;">สัดส่วน</th>
            </tr>
          </thead>
          <tbody>
            ${workloadRowsHtml}
            <tr style="background:linear-gradient(90deg, #faf5ff 0%, #fffdf2 100%);font-weight:700;">
              <td>รวมทั้งหมด</td>
              <td style="text-align:center;">${workload.matchedTopicCount}</td>
              ${
                showSemColumns
                  ? `
                <td style="text-align:center;">${formatHoursZero(workload.sumSem1)}</td>
                <td style="text-align:center;">${formatHoursZero(workload.sumSem2)}</td>
              `
                  : ''
              }
              <td style="text-align:center;">${formatHoursZero(workload.sumLec)}</td>
              <td style="text-align:center;">${formatHoursZero(workload.sumLab)}</td>
              <td style="text-align:center;">${formatHoursZero(workload.grandTotalHours)}</td>
              <td style="text-align:center;">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
      ${
        workload.hasSharedTopic
          ? '<p class="summary-note">* หมายเหตุ: หัวข้อที่มีผู้สอนร่วมกันมากกว่า 1 ท่าน ระบบคำนวณแบ่งชั่วโมงสอนเท่าๆ กันตามจำนวนผู้สอนในหัวข้อนั้น</p>'
          : ''
      }
      ${
        showSemColumns
          ? '<p class="summary-note">* หมายเหตุ: กระบวนวิชานี้เปิดสอนมากกว่า 1 ภาคการศึกษา ตารางสรุปภาระงานสอนแสดงชั่วโมงแยกภาค 1 และภาค 2 (สามารถกดปุ่มเลือกดูเฉพาะภาคการศึกษาด้านบนได้)</p>'
          : ''
      }
    </div>

    <div class="approval-footer">
      <div><strong>เหตุผลในการพัฒนา/ปรับปรุง:</strong> ${escapeHtml(course.revision_rationale_th || '-')}</div>
      <div><strong>การอนุมัติ:</strong> ${escapeHtml(course.approval_meeting_info || '-')} | <strong>มีผลบังคับใช้:</strong> ${escapeHtml(course.effective_term || '-')}</div>
    </div>
  `;

  els.courseDetailContent.querySelectorAll('[data-sem-btn]').forEach((btn) => {
    btn.addEventListener('click', () => setDetailSemesterFilter(btn.getAttribute('data-sem-btn')));
  });
}

function copySyllabusText() {
  const course = state.courses.find((c) => c.course_id === state.selectedCourseId);
  if (!course) return;
  const clos = state.closByCourse[course.course_id] || [];
  const allContents = state.contentsByCourse[course.course_id] || [];
  const courseSems = course.semesters_list || ['1'];
  const isMultiSemCourse = courseSems.length > 1;
  const activeSem =
    isMultiSemCourse && state.selectedDetailSemester !== 'ALL' && courseSems.includes(state.selectedDetailSemester)
      ? state.selectedDetailSemester
      : 'ALL';

  const contents =
    activeSem === 'ALL'
      ? allContents
      : allContents.filter((item) => (item.semesters_list || ['1']).includes(activeSem));

  const coordinators = filterInstructorsBySemester(course.coordinators, activeSem);
  const lecturers = filterInstructorsBySemester(course.lecturers, activeSem);
  const coordList = coordinators.length > 0 ? coordinators : course.coordinators;

  const coordText = coordList.length > 0 ? formatCardInstructors(coordList, isMultiSemCourse && activeSem === 'ALL') : '-';
  const lectText = lecturers.length > 0 ? formatCardInstructors(lecturers, isMultiSemCourse && activeSem === 'ALL') : '-';
  const semHeaderLabel =
    activeSem === 'ALL' ? formatSemesterFull(course.offered_semesters) : formatSemesterFull(activeSem);

  const contentLines = contents.map((item) => {
    const lec = parseFloat(item.lecture_hours) || 0;
    const lab = parseFloat(item.lab_hours) || 0;
    const hrLabel = lec > 0 && lab > 0
      ? `บรรยาย ${lec} ชม. / ปฏิบัติการ ${lab} ชม.`
      : lec > 0
        ? `บรรยาย ${lec} ชม.`
        : `ปฏิบัติการ ${lab} ชม.`;
    const inst = String(item.topic_instructor || '').trim();
    const semTag = isMultiSemCourse && activeSem === 'ALL' ? ` [${formatSemesterShort(item.semester)}]` : '';
    return `${item.topic_no}. ${item.topic_th}${semTag} (${hrLabel})${inst ? ` — ผู้สอน: ${inst}` : ''}`;
  });

  const text = [
    `${course.course_code_th} (${course.course_id}) ${course.title_th} ${course.credit_structure}`,
    `${course.course_code_en} ${course.title_en}`,
    `ภาคการศึกษาที่เปิดสอน: ${semHeaderLabel}`,
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
    ...clos.map((c, idx) => `${idx + 1}. ${c.clo_description_en}`),
    '',
    'เนื้อหากระบวนวิชาและอาจารย์ผู้สอน:',
    ...contentLines
  ].join('\n');

  navigator.clipboard.writeText(text).then(() => {
    showToast('คัดลอกข้อความสำหรับทำ Syllabus เรียบร้อยแล้วครับ');
  });
}

function switchMainView(viewName) {
  state.lastMainView = viewName;
  state.selectedCourseId = null;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('course');
    window.history.replaceState({}, '', url.toString());
  } catch (e) {}
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
