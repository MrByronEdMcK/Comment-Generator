/**
 * Main Application Orchestrator
 * Coordinates Screen 0 (Class & Assessment Manager) and Wizard Steps 1–4.
 */
document.addEventListener('DOMContentLoaded', () => {
  const commentBank = new CommentBank();
  const esc = UIHelpers.escapeHtml;

  // Application State
  const state = {
    spreadsheetFile: null,
    spreadsheetName: null,
    availableSheets: [],
    selectedSheet: null,
    excelData: null,
    questions: [],
    students: [],
    generatedComments: {},
    sectionRanking: [],
    commentBankMode: null, // null | 'question' | 'outcome'
    outcomes: [],
    generationConfig: {
      totalComments: 6,
      enableScoreTiers: false,
      commentPriorityMode: 'section',
      commentSourceMode: 'question',
      outcomeMasteryCutoff: 70,
      enableSectionPriority: false,
      minAchievements: 1,
      maxAchievements: 4,
      minImprovements: 1,
      maxImprovements: 4,
      highThreshold: 70,
      midThreshold: 50
    },
    isGenerating: false,
    currentStep: 0
  };

  let currentClassId = null;
  let currentAssessmentId = null;
  let spreadsheetArrayBuffer = null;
  let activeCommentBankSection = 'General';
  let activeStudentFilter = 'all'; // 'all' | 'complete' | 'review' | 'absent'
  let activeStudentSort = 'order'; // 'order' | 'name_asc' | 'score_desc' | 'score_asc'
  const expandedBreakdownIds = new Set();
  let editingCommentId = null;

  // Header & Navigation DOM
  const saveStatusIndicator = document.getElementById('saveStatusIndicator');
  const headerContextChip = document.getElementById('headerContextChip');
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const stepItems = document.querySelectorAll('.step-item');
  const stepPanels = document.querySelectorAll('.step-panel');

  // Step 0 DOM
  const classesManagerGrid = document.getElementById('classesManagerGrid');
  const btnCreateClassMain = document.getElementById('btnCreateClassMain');
  const btnExportAllData = document.getElementById('btnExportAllData');
  const btnImportData = document.getElementById('btnImportData');
  const importDataInput = document.getElementById('importDataInput');

  // Step 1 DOM
  const spreadsheetDropzone = document.getElementById('spreadsheetDropzone');
  const spreadsheetInput = document.getElementById('spreadsheetInput');
  const spreadsheetStatus = document.getElementById('spreadsheetStatus');
  const sheetSelectContainer = document.getElementById('sheetSelectContainer');
  const sheetSelect = document.getElementById('sheetSelect');
  const detectionNotice = document.getElementById('detectionNotice');
  const detectionDetails = document.getElementById('detectionDetails');
  const gradebookPreviewCard = document.getElementById('gradebookPreviewCard');
  const btnGotoStep2 = document.getElementById('btnGotoStep2');

  // Step 2 DOM
  const questionStructureSummaryBar = document.getElementById('questionStructureSummaryBar');
  const questionsTableBody = document.getElementById('questionsTableBody');
  const btnAddQuestion = document.getElementById('btnAddQuestion');
  const btnAddSectionBreak = document.getElementById('btnAddSectionBreak');
  const btnGotoStep3 = document.getElementById('btnGotoStep3');

  // Step 3 DOM
  const questionCoverageBanner = document.getElementById('questionCoverageBanner');
  const btnCopyBankFromAssessment = document.getElementById('btnCopyBankFromAssessment');
  const btnBankModeQuestion = document.getElementById('btnBankModeQuestion');
  const btnBankModeOutcome = document.getElementById('btnBankModeOutcome');
  const questionBankContainer = document.getElementById('questionBankContainer');
  const outcomeBankContainer = document.getElementById('outcomeBankContainer');
  const sectionTabs = document.getElementById('sectionTabs');
  const achieveCount = document.getElementById('achieveCount');
  const improveCount = document.getElementById('improveCount');
  const achievementsList = document.getElementById('achievementsList');
  const improvementsList = document.getElementById('improvementsList');
  const achieveComposer = document.getElementById('achieveComposer');
  const improveComposer = document.getElementById('improveComposer');
  const btnAddAchievement = document.getElementById('btnAddAchievement');
  const btnAddImprovement = document.getElementById('btnAddImprovement');
  const btnBulkPasteAchieve = document.getElementById('btnBulkPasteAchieve');
  const btnBulkPasteImprove = document.getElementById('btnBulkPasteImprove');
  const btnClearSectionAchieve = document.getElementById('btnClearSectionAchieve');
  const btnClearSectionImprove = document.getElementById('btnClearSectionImprove');
  const btnClearActiveSection = document.getElementById('btnClearActiveSection');
  const btnClearAllCommentBanks = document.getElementById('btnClearAllCommentBanks');
  const btnExportCommentBank = document.getElementById('btnExportCommentBank');
  const btnImportCommentBank = document.getElementById('btnImportCommentBank');
  const importCommentBankInput = document.getElementById('importCommentBankInput');
  const outcomesListEl = document.getElementById('outcomesList');
  const outcomeCountBadge = document.getElementById('outcomeCountBadge');
  const cfgOutcomeCutoff = document.getElementById('cfgOutcomeCutoff');
  const btnExportOutcomeBank = document.getElementById('btnExportOutcomeBank');
  const btnImportOutcomeBank = document.getElementById('btnImportOutcomeBank');
  const importOutcomeBankInput = document.getElementById('importOutcomeBankInput');
  const btnBulkPasteOutcomes = document.getElementById('btnBulkPasteOutcomes');
  const btnAddOutcome = document.getElementById('btnAddOutcome');
  const btnAddOutcomeBottom = document.getElementById('btnAddOutcomeBottom');
  const btnClearOutcomes = document.getElementById('btnClearOutcomes');
  const btnGotoStep4 = document.getElementById('btnGotoStep4');

  // Modals DOM
  const bulkPasteModal = document.getElementById('bulkPasteModal');
  const bulkCategorySelect = document.getElementById('bulkCategorySelect');
  const bulkSectionSelect = document.getElementById('bulkSectionSelect');
  const bulkPasteTextarea = document.getElementById('bulkPasteTextarea');
  const bulkPreviewText = document.getElementById('bulkPreviewText');
  const btnCloseBulkModal = document.getElementById('btnCloseBulkModal');
  const btnCancelBulk = document.getElementById('btnCancelBulk');
  const btnSubmitBulk = document.getElementById('btnSubmitBulk');

  const bulkOutcomeModal = document.getElementById('bulkOutcomeModal');
  const btnCloseBulkOutcomeModal = document.getElementById('btnCloseBulkOutcomeModal');
  const btnCancelBulkOutcome = document.getElementById('btnCancelBulkOutcome');
  const btnSubmitBulkOutcome = document.getElementById('btnSubmitBulkOutcome');
  const bulkOutcomeTextarea = document.getElementById('bulkOutcomeTextarea');
  const bulkOutcomePreviewText = document.getElementById('bulkOutcomePreviewText');

  const commentModeModal = document.getElementById('commentModeModal');
  const btnCloseCommentModeModal = document.getElementById('btnCloseCommentModeModal');
  const btnChooseModeQuestion = document.getElementById('btnChooseModeQuestion');
  const btnChooseModeOutcome = document.getElementById('btnChooseModeOutcome');

  // Step 4 DOM
  const generationConfigCard = document.getElementById('generationConfigCard');
  const configCardHeader = document.getElementById('configCardHeader');
  const btnToggleConfigCard = document.getElementById('btnToggleConfigCard');
  const configSummaryBadge = document.getElementById('configSummaryBadge');
  const cfgTotalComments = document.getElementById('cfgTotalComments');
  const cfgEnableScoreTiers = document.getElementById('cfgEnableScoreTiers');
  const cfgScoreTiersStatusBadge = document.getElementById('cfgScoreTiersStatusBadge');
  const advancedScoreSettingsContainer = document.getElementById('advancedScoreSettingsContainer');
  const cfgEnableSectionPriority = document.getElementById('cfgEnableSectionPriority');
  const cfgSectionPriorityStatusBadge = document.getElementById('cfgSectionPriorityStatusBadge');
  const sectionPriorityBoardContainer = document.getElementById('sectionPriorityBoardContainer');
  const sectionPriorityControls = document.getElementById('sectionPriorityControls');
  const performanceModeHint = document.getElementById('performanceModeHint');
  const btnModeSection = document.getElementById('btnModeSection');
  const btnModePerformance = document.getElementById('btnModePerformance');
  const commentSourceRow = document.getElementById('commentSourceRow');
  const btnSourceQuestion = document.getElementById('btnSourceQuestion');
  const btnSourceOutcome = document.getElementById('btnSourceOutcome');
  const sectionRankingBreadcrumb = document.getElementById('sectionRankingBreadcrumb');
  const cfgMinAch = document.getElementById('cfgMinAch');
  const cfgMaxAch = document.getElementById('cfgMaxAch');
  const cfgMinImp = document.getElementById('cfgMinImp');
  const cfgMaxImp = document.getElementById('cfgMaxImp');
  const cfgHighThreshold = document.getElementById('cfgHighThreshold');
  const cfgMidThreshold = document.getElementById('cfgMidThreshold');
  const badgeTierHigh = document.getElementById('badgeTierHigh');
  const badgeTierMid = document.getElementById('badgeTierMid');
  const badgeTierLow = document.getElementById('badgeTierLow');

  const btnGenerateAll = document.getElementById('btnGenerateAll');
  const btnGenerateMissing = document.getElementById('btnGenerateMissing');
  const btnClearAllComments = document.getElementById('btnClearAllComments');
  const btnExportExcel = document.getElementById('btnExportExcel');
  const btnCopyCompassScript = document.getElementById('btnCopyCompassScript');
  const compassModal = document.getElementById('compassModal');
  const btnCloseCompassModal = document.getElementById('btnCloseCompassModal');
  const btnCancelCompassModal = document.getElementById('btnCancelCompassModal');
  const btnCopyCompassModalScript = document.getElementById('btnCopyCompassModalScript');
  const compassColumnFormat = document.getElementById('compassColumnFormat');
  const compassScriptPreview = document.getElementById('compassScriptPreview');
  const compassStudentCountBadge = document.getElementById('compassStudentCountBadge');
  const searchStudent = document.getElementById('searchStudent');
  const studentFilterPills = document.getElementById('studentFilterPills');
  const sortStudentSelect = document.getElementById('sortStudentSelect');
  const totalStudentsCount = document.getElementById('totalStudentsCount');
  const missingCommentsBanner = document.getElementById('missingCommentsBanner');
  const studentCardsContainer = document.getElementById('studentCardsContainer');
  const progressContainer = document.getElementById('progressContainer');
  const btnCancelGeneration = document.getElementById('btnCancelGeneration');

  // --- Theme Management ---
  function initTheme() {
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get('theme');
    const saved = themeParam || localStorage.getItem('commentgen_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
  }

  function updateThemeIcon(theme) {
    if (!btnThemeToggle) return;
    const isDark = theme === 'dark';
    btnThemeToggle.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    btnThemeToggle.innerHTML = isDark
      ? `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
      : `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path></svg>`;
  }

  btnThemeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('commentgen_theme', next);
    updateThemeIcon(next);
  });

  initTheme();

  // --- Header Context & Wizard Step Badges ---
  headerContextChip?.addEventListener('click', () => {
    showStep(0);
  });

  function updateHeaderContext() {
    const classSpan = document.getElementById('headerContextClass');
    const assessSpan = document.getElementById('headerContextAssess');
    if (!headerContextChip) return;

    if (state.currentStep > 0 && currentClassId && currentAssessmentId) {
      const classObj = StorageService.getClassById(currentClassId);
      const assessObj = StorageService.getAssessmentById(currentClassId, currentAssessmentId);
      if (classSpan) classSpan.textContent = classObj?.name || 'Class';
      if (assessSpan) assessSpan.textContent = assessObj?.name || 'Assessment';
      headerContextChip.style.display = 'inline-flex';
    } else {
      headerContextChip.style.display = 'none';
    }
    updateWizardStepBadges();
  }

  function updateWizardStepBadges() {
    const b1 = document.getElementById('stepBadge1');
    const b2 = document.getElementById('stepBadge2');
    const b3 = document.getElementById('stepBadge3');
    const b4 = document.getElementById('stepBadge4');

    const studentCount = (state.students || []).length;
    if (b1) {
      if (studentCount > 0) {
        b1.textContent = `${studentCount}`;
        b1.style.display = 'inline-flex';
      } else {
        b1.style.display = 'none';
      }
    }

    const cov = CommentEngine.calculateQuestionCoverage(
      state.questions,
      commentBank,
      state.outcomes,
      state.commentBankMode || 'question'
    );
    if (b2) {
      if (cov.totalQuestions > 0) {
        b2.textContent = `${cov.totalQuestions} Qs • ${cov.totalMaxMarks}m`;
        b2.style.display = 'inline-flex';
      } else {
        b2.style.display = 'none';
      }
    }

    if (b3) {
      if (state.commentBankMode === 'outcome') {
        const outCount = (state.outcomes || []).filter(o => (o.name || '').trim() || (o.achievement || '').trim() || (o.improvement || '').trim()).length;
        b3.textContent = `${outCount} out`;
        b3.style.display = outCount > 0 ? 'inline-flex' : 'none';
      } else {
        const bankTotal = (commentBank.achievements?.length || 0) + (commentBank.improvements?.length || 0);
        b3.textContent = `${bankTotal}`;
        b3.style.display = bankTotal > 0 ? 'inline-flex' : 'none';
      }
    }

    if (b4) {
      if (studentCount > 0) {
        let completeCount = 0;
        let reviewCount = 0;
        state.students.forEach(s => {
          const hasAttempted = Object.prototype.hasOwnProperty.call(state.generatedComments, s.id);
          const text = state.generatedComments[s.id] || '';
          const status = getStudentCommentStatus(s, text, null, hasAttempted);
          if (status.needsManualReview) reviewCount++;
          else if (text.trim()) completeCount++;
        });
        if (reviewCount > 0) {
          b4.textContent = `⚠️ ${reviewCount}`;
          b4.classList.add('badge-warning');
          b4.style.display = 'inline-flex';
        } else if (completeCount > 0) {
          b4.textContent = `${completeCount}/${studentCount}`;
          b4.classList.remove('badge-warning');
          b4.style.display = 'inline-flex';
        } else {
          b4.style.display = 'none';
        }
      } else {
        b4.style.display = 'none';
      }
    }
  }

  function triggerAutoSave() {
    if (!currentClassId || !currentAssessmentId) return;

    const dot = saveStatusIndicator?.querySelector('.storage-dot');
    if (dot) dot.classList.add('saving');

    const existingAssess = StorageService.getAssessmentById(currentClassId, currentAssessmentId);
    const assessName = existingAssess?.name || 'Assessment';

    StorageService.saveAssessment(currentClassId, {
      id: currentAssessmentId,
      name: assessName,
      spreadsheetName: state.spreadsheetName || state.spreadsheetFile?.name || null,
      availableSheets: (state.availableSheets && state.availableSheets.length > 0) ? state.availableSheets : (state.excelData?.availableSheets || null),
      selectedSheet: state.selectedSheet || state.excelData?.sheetName || null,
      questions: state.questions,
      commentBank: commentBank.toJSON(),
      commentBankMode: state.commentBankMode,
      outcomes: (state.outcomes || []).map(o => ({
        ...o,
        questionKeys: Array.isArray(o.questionKeys) ? [...o.questionKeys] : []
      })),
      generatedComments: state.generatedComments,
      sectionRanking: state.sectionRanking,
      students: state.students,
      generationConfig: state.generationConfig,
      currentStep: state.currentStep
    });

    StorageService.setActiveContext(currentClassId, currentAssessmentId);
    updateHeaderContext();

    if (dot) {
      setTimeout(() => dot.classList.remove('saving'), 320);
    }
  }

  function restoreAssessmentData(classId, assessmentId) {
    const assessment = StorageService.getAssessmentById(classId, assessmentId);
    const classObj = StorageService.getClassById(classId);
    if (!assessment) return;

    currentClassId = classId;
    currentAssessmentId = assessmentId;
    expandedBreakdownIds.clear();
    editingCommentId = null;

    state.spreadsheetFile = null;
    state.spreadsheetName = assessment.spreadsheetName || null;
    state.availableSheets = Array.isArray(assessment.availableSheets) ? [...assessment.availableSheets] : [];
    state.selectedSheet = assessment.selectedSheet || null;
    state.excelData = null;
    state.questions = Array.isArray(assessment.questions) ? [...assessment.questions] : [];
    state.students = Array.isArray(assessment.students) ? [...assessment.students] : [];
    state.generatedComments = assessment.generatedComments ? { ...assessment.generatedComments } : {};
    state.sectionRanking = Array.isArray(assessment.sectionRanking) ? [...assessment.sectionRanking] : [];
    state.outcomes = Array.isArray(assessment.outcomes)
      ? assessment.outcomes.map(o => ({ ...o, questionKeys: Array.isArray(o.questionKeys) ? [...o.questionKeys] : [] }))
      : [];

    const hasQuestionBankItems = !!(
      assessment.commentBank &&
      ((assessment.commentBank.achievements && assessment.commentBank.achievements.length > 0) ||
        (assessment.commentBank.improvements && assessment.commentBank.improvements.length > 0))
    );
    const hasExistingWork = hasQuestionBankItems || state.questions.length > 0 || state.students.length > 0 || Object.keys(state.generatedComments).length > 0;
    state.commentBankMode = assessment.commentBankMode || (state.outcomes.length > 0 ? 'outcome' : (hasExistingWork ? 'question' : null));

    const savedCfg = { ...(assessment.generationConfig || {}) };
    if (savedCfg.totalComments === 3 && savedCfg.maxAchievements === 3 && savedCfg.maxImprovements === 2) {
      savedCfg.totalComments = 6;
      savedCfg.maxAchievements = 4;
      savedCfg.maxImprovements = 4;
    }
    state.generationConfig = {
      totalComments: 6,
      enableScoreTiers: false,
      commentPriorityMode: 'section',
      commentSourceMode: state.commentBankMode === 'outcome' ? 'outcome' : 'question',
      outcomeMasteryCutoff: 70,
      enableSectionPriority: false,
      minAchievements: 1,
      maxAchievements: 4,
      minImprovements: 1,
      maxImprovements: 4,
      highThreshold: 70,
      midThreshold: 50,
      ...savedCfg
    };

    if (hasQuestionBankItems) {
      commentBank.fromJSON(assessment.commentBank);
    } else {
      commentBank.reset();
    }

    spreadsheetArrayBuffer = null;
    if (assessment.spreadsheetName && classObj?.spreadsheetBase64 && assessment.spreadsheetName === classObj.spreadsheetName) {
      try {
        const binary = atob(classObj.spreadsheetBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        spreadsheetArrayBuffer = bytes.buffer;
      } catch (e) {
        console.warn('Could not restore spreadsheetArrayBuffer from base64:', e);
      }
    }

    if (btnGotoStep2) {
      btnGotoStep2.disabled = !(state.students.length > 0 && state.questions.length > 0);
    }

    syncGenerationConfigUI();
    updateStep1UploadUI();
    renderStep3CommentBank();
    updateHeaderContext();
  }

  // --- Demo Data Builder ---
  function seedDemoData() {
    const existing = StorageService.getClasses();
    if (existing.some(c => c.id === 'class_demo_maths')) {
      StorageService.setActiveContext('class_demo_maths', 'assess_sac1');
      return;
    }

    const demoQuestions = [
      { id: 'sb_mcq', isSectionBreak: true, name: 'MCQ', title: 'Multiple Choice Questions' },
      { id: 'Q1', title: 'Question 1', maxMarks: 1, section: 'MCQ', included: true },
      { id: 'Q2', title: 'Question 2', maxMarks: 1, section: 'MCQ', included: true },
      { id: 'Q3', title: 'Question 3', maxMarks: 1, section: 'MCQ', included: true },
      { id: 'Q4', title: 'Question 4', maxMarks: 1, section: 'MCQ', included: true },
      { id: 'Q5', title: 'Question 5', maxMarks: 1, section: 'MCQ', included: true },
      { id: 'sb_saq', isSectionBreak: true, name: 'SAQ', title: 'Short Answer Questions' },
      { id: 'Q1a', title: 'Question 1a', maxMarks: 1, section: 'SAQ', isSubQuestion: true, included: true },
      { id: 'Q1b', title: 'Question 1b', maxMarks: 2, section: 'SAQ', isSubQuestion: true, included: true },
      { id: 'Q1c', title: 'Question 1c', maxMarks: 2, section: 'SAQ', isSubQuestion: true, included: true },
      { id: 'Q1d', title: 'Question 1d', maxMarks: 3, section: 'SAQ', isSubQuestion: true, included: true },
      { id: 'Q2', title: 'Question 2', maxMarks: 4, section: 'SAQ', included: true },
      { id: 'Q3', title: 'Question 3', maxMarks: 3, section: 'SAQ', included: true }
    ];

    const demoStudents = [
      { id: 'stud_1', name: 'Alice Smith', scores: { Q1: 1, Q2: 1, Q3: 1, Q4: 1, Q5: 1, Q1a: 1, Q1b: 2, Q1c: 2, Q1d: 3, SAQ__Q2: 4, SAQ__Q3: 3, 'Total Mark': 20, '%': 1.0 } },
      { id: 'stud_2', name: 'Edward Elric', scores: { Q1: 1, Q2: 1, Q3: 1, Q4: 1, Q5: 0, Q1a: 1, Q1b: 2, Q1c: 2, Q1d: 3, SAQ__Q2: 3, SAQ__Q3: 3, 'Total Mark': 18, '%': 0.9 } },
      { id: 'stud_3', name: 'Charlie Brown', scores: { Q1: 1, Q2: 0, Q3: 1, Q4: 1, Q5: 1, Q1a: 1, Q1b: 1, Q1c: 2, Q1d: 2, SAQ__Q2: 3, SAQ__Q3: 2, 'Total Mark': 14, '%': 0.7 } },
      { id: 'stud_4', name: 'Bob Jones', scores: { Q1: 1, Q2: 0, Q3: 1, Q4: 0, Q5: 0, Q1a: 1, Q1b: 1, Q1c: 1, Q1d: 1, SAQ__Q2: 2, SAQ__Q3: 1, 'Total Mark': 9, '%': 0.45 } },
      { id: 'stud_5', name: 'Diana Prince', scores: { Q1: 0, Q2: 0, Q3: 1, Q4: 0, Q5: 0, Q1a: 0, Q1b: 1, Q1c: 0, Q1d: 1, SAQ__Q2: 1, SAQ__Q3: 1, 'Total Mark': 5, '%': 0.25 } }
    ];

    const demoBank = {
      achievements: [
        { id: 'ach_g1', text: 'Consistently engaged in classroom activities and demonstrated a diligent approach to coursework.', tags: ['General'], section: 'General' },
        { id: 'ach_g2', text: 'Demonstrated sustained effort and attention to detail throughout this assessment.', tags: ['Effort'], section: 'General' },
        { id: 'ach_s1', text: 'Correctly identified the order of a matrix and evaluated dimensions accurately.', tags: ['Matrix'], questionId: 'Q1a', questionIds: ['Q1a'], section: 'SAQ' },
        { id: 'ach_s2', text: 'Successfully interpreted information from within a real-world application matrix.', tags: ['Matrix'], questionId: 'Q1b', questionIds: ['Q1b'], section: 'SAQ' },
        { id: 'ach_s3', text: 'Demonstrated understanding of scalar multiplication involving a percentage adjustment.', tags: ['Scalar'], questionId: 'Q1d', questionIds: ['Q1d'], section: 'SAQ' },
        { id: 'ach_s4', text: 'Used Dijkstra’s algorithm to determine the shortest path and its overall distance.', tags: ['Networks'], questionId: 'Q2', questionIds: ['Q2'], section: 'SAQ' },
        { id: 'ach_m1', text: 'Correctly solved multiple-choice problems on matrix element conventions.', tags: ['MCQ'], questionId: 'Q1', questionIds: ['Q1'], section: 'MCQ' },
        { id: 'ach_m2', text: 'Accurately answered network theory and vertex degree questions.', tags: ['MCQ'], questionId: 'Q3', questionIds: ['Q3'], section: 'MCQ' }
      ],
      improvements: [
        { id: 'imp_g1', text: 'Ensure that full working out is shown systematically for all multi-step problems to avoid arithmetic slips.', tags: ['Working'], section: 'General' },
        { id: 'imp_g2', text: 'Review key mathematical terminology and verify definitions regularly to strengthen understanding.', tags: ['Definitions'], section: 'General' },
        { id: 'imp_s1', text: 'Focus on setting up matrix row-by-column multiplications carefully, checking intermediate values.', tags: ['Multiplication'], questionId: 'Q1d', questionIds: ['Q1d'], section: 'SAQ' },
        { id: 'imp_s2', text: 'Practice network traversals to ensure all revisitation constraints are satisfied before concluding paths.', tags: ['Networks'], questionId: 'Q2', questionIds: ['Q2'], section: 'SAQ' },
        { id: 'imp_m1', text: 'Review multiple-choice definitions regarding planar graphs and Euler’s formula.', tags: ['MCQ'], questionId: 'Q4', questionIds: ['Q4'], section: 'MCQ' },
        { id: 'imp_m2', text: 'Consolidate understanding of bipartite graph allocations and row reduction techniques.', tags: ['MCQ'], questionId: 'Q5', questionIds: ['Q5'], section: 'MCQ' }
      ]
    };

    const demoClass = {
      id: 'class_demo_maths',
      name: 'Year 12 General Mathematics',
      spreadsheetName: 'Year12_SAC1_Results.xlsx',
      availableSheets: ['SAC 1 Matrices', 'SAC 2 Networks'],
      selectedSheet: 'SAC 1 Matrices',
      assessments: [
        {
          id: 'assess_sac1',
          name: 'SAC 1 - Matrices & Networks',
          spreadsheetName: 'Year12_SAC1_Results.xlsx',
          selectedSheet: 'SAC 1 Matrices',
          questions: demoQuestions,
          students: demoStudents,
          sectionRanking: [['SAQ', 'MCQ', 'General']],
          generationConfig: { totalComments: 6, enableScoreTiers: false, enableSectionPriority: false, minAchievements: 1, maxAchievements: 4, minImprovements: 1, maxImprovements: 4, highThreshold: 70, midThreshold: 50 },
          commentBank: demoBank,
          commentBankMode: 'question',
          generatedComments: CommentEngine.generateCommentsForAll(demoStudents, demoQuestions, demoBank, { totalComments: 6, enableScoreTiers: false }, [['SAQ', 'MCQ', 'General']]),
          currentStep: 4,
          updatedAt: Date.now()
        }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    StorageService.saveClass(demoClass);
    StorageService.setActiveContext('class_demo_maths', 'assess_sac1');
  }

  // --- Screen 0: Class & Assessment Manager Dashboard ---
  async function createNewClassPrompt() {
    const name = await UIHelpers.showPromptModal({
      title: 'Create New Class',
      message: 'Enter a name for your subject or class group.',
      label: 'Class Name',
      placeholder: 'e.g. 12 General Mathematics',
      confirmText: 'Create Class'
    });
    if (name) {
      const newClass = { id: `class_${Date.now()}`, name, assessments: [] };
      StorageService.saveClass(newClass);
      currentClassId = newClass.id;
      currentAssessmentId = null;
      renderManagerDashboard();
      UIHelpers.showToast(`Created class "${name}".`, 'success');
    }
  }

  btnCreateClassMain?.addEventListener('click', createNewClassPrompt);

  function renderManagerDashboard() {
    if (!classesManagerGrid) return;
    classesManagerGrid.innerHTML = '';

    const classes = StorageService.getClasses();
    if (classes.length === 0) {
      classesManagerGrid.innerHTML = `
        <div class="dashboard-empty-state">
          <svg width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="color: var(--primary); margin-bottom: 0.75rem;">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
          </svg>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">Welcome to Comment Generator</h3>
          <p style="font-size: 0.9rem; color: var(--text-muted); max-width: 480px; margin: 0 auto 1.25rem;">
            Create your first subject class to upload a gradebook and build a reusable comment bank, or explore a pre-loaded sample class.
          </p>
          <div style="display: inline-flex; gap: 0.65rem; flex-wrap: wrap; justify-content: center;">
            <button type="button" id="btnEmptyCreateClass" class="btn btn-primary">+ Create Your First Class</button>
            <button type="button" id="btnEmptyLoadDemo" class="btn btn-secondary">Load Sample Demo Class</button>
          </div>
        </div>
      `;
      document.getElementById('btnEmptyCreateClass')?.addEventListener('click', createNewClassPrompt);
      document.getElementById('btnEmptyLoadDemo')?.addEventListener('click', () => {
        seedDemoData();
        renderManagerDashboard();
        UIHelpers.showToast('Sample demo class loaded.', 'success');
      });
      return;
    }

    classes.forEach(c => {
      const card = document.createElement('div');
      card.className = 'class-card';

      const assessments = c.assessments || [];
      const assessListHtml = assessments.length === 0
        ? `<div style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; padding: 0.5rem 0;">No assessments added yet. Click "+ Add Assessment" above.</div>`
        : assessments.map(a => {
            const qCount = a.questions ? a.questions.filter(q => !q.isSectionBreak && !q.isSummary && !q.isTotal && !q.isPercentage && q.included !== false).length : 0;
            const sCount = a.students ? a.students.length : 0;
            const bankCount = a.commentBankMode === 'outcome'
              ? `${(a.outcomes || []).length} Outcomes`
              : `${((a.commentBank?.achievements?.length || 0) + (a.commentBank?.improvements?.length || 0))} Comments`;
            return `
              <div class="assessment-card-item">
                <div style="display: flex; flex-direction: column; gap: 0.25rem; min-width: 0;">
                  <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <strong style="font-size: 0.95rem; color: var(--text-main);">${esc(a.name)}</strong>
                  </div>
                  <div style="font-size: 0.78rem; color: var(--text-muted);">
                    ${a.selectedSheet ? `Sheet: <strong>${esc(a.selectedSheet)}</strong> &bull; ` : ''}<strong>${qCount}</strong> Qs &bull; <strong>${sCount}</strong> Students &bull; <strong>${bankCount}</strong>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0;">
                  <button type="button" class="btn btn-primary btn-sm btn-open-assess" data-classid="${esc(c.id)}" data-assessid="${esc(a.id)}">
                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
                    <span>Open</span>
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm btn-duplicate-assess" data-classid="${esc(c.id)}" data-assessid="${esc(a.id)}" title="Duplicate Assessment or Copy Comment Bank to another class" style="padding: 0.42rem;">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm btn-rename-assess" data-classid="${esc(c.id)}" data-assessid="${esc(a.id)}" title="Rename Assessment" style="padding: 0.42rem;">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                  </button>
                  <button type="button" class="btn btn-danger btn-sm btn-delete-assess" data-classid="${esc(c.id)}" data-assessid="${esc(a.id)}" title="Delete Assessment" style="padding: 0.42rem;">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </div>
            `;
          }).join('');

      const spreadsheetSubtitle = c.spreadsheetName
        ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem; display: flex; align-items: center; gap: 0.35rem;">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            <span>${esc(c.spreadsheetName)}</span>
          </div>`
        : '';

      card.innerHTML = `
        <div class="class-card-header">
          <div>
            <div class="class-card-title">${esc(c.name)}</div>
            ${spreadsheetSubtitle}
          </div>
          <div style="display: flex; gap: 0.35rem; flex-shrink: 0; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-sm btn-export-class" data-classid="${esc(c.id)}" style="padding: 0.42rem;" title="Export Class as JSON">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            </button>
            <button type="button" class="btn btn-secondary btn-sm btn-rename-class" data-classid="${esc(c.id)}" style="padding: 0.42rem;" title="Rename Class">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            </button>
            <button type="button" class="btn btn-danger btn-sm btn-delete-class" data-classid="${esc(c.id)}" style="padding: 0.42rem;" title="Delete Class">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 0.82rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;">Assessments (${assessments.length})</strong>
          <button type="button" class="btn btn-secondary btn-sm btn-add-assess-class" data-classid="${esc(c.id)}">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"></path></svg>
            <span>Add Assessment</span>
          </button>
        </div>

        <div class="assessment-list">
          ${assessListHtml}
        </div>
      `;

      classesManagerGrid.appendChild(card);
    });

    // Dashboard Event Listeners
    classesManagerGrid.querySelectorAll('.btn-export-class').forEach(b => {
      b.addEventListener('click', () => {
        const classId = b.getAttribute('data-classid');
        StorageService.exportClass(classId);
        UIHelpers.showToast('Class backup exported.', 'success');
      });
    });

    classesManagerGrid.querySelectorAll('.btn-open-assess').forEach(b => {
      b.addEventListener('click', () => {
        const classId = b.getAttribute('data-classid');
        const assessId = b.getAttribute('data-assessid');
        restoreAssessmentData(classId, assessId);
        const assess = StorageService.getAssessmentById(classId, assessId);
        const targetStep = (assess && assess.currentStep && assess.currentStep > 0) ? assess.currentStep : 1;
        showStep(targetStep);
      });
    });

    classesManagerGrid.querySelectorAll('.btn-duplicate-assess').forEach(b => {
      b.addEventListener('click', () => {
        const classId = b.getAttribute('data-classid');
        const assessId = b.getAttribute('data-assessid');
        openDuplicateAssessmentModal(classId, assessId);
      });
    });

    classesManagerGrid.querySelectorAll('.btn-add-assess-class').forEach(b => {
      b.addEventListener('click', async () => {
        const classId = b.getAttribute('data-classid');
        const name = await UIHelpers.showPromptModal({
          title: 'Create New Assessment',
          label: 'Assessment Name',
          placeholder: 'e.g. SAC 1 - Sequences & Finance',
          confirmText: 'Create Assessment'
        });
        if (name) {
          const newAssess = StorageService.saveAssessment(classId, { name });
          currentClassId = classId;
          currentAssessmentId = newAssess.id;
          renderManagerDashboard();
          UIHelpers.showToast(`Created assessment "${name}".`, 'success');
        }
      });
    });

    classesManagerGrid.querySelectorAll('.btn-rename-class').forEach(b => {
      b.addEventListener('click', async () => {
        const classId = b.getAttribute('data-classid');
        const classObj = StorageService.getClassById(classId);
        if (!classObj) return;
        const newName = await UIHelpers.showPromptModal({
          title: 'Rename Class',
          label: 'Class Name',
          defaultValue: classObj.name,
          confirmText: 'Save Name'
        });
        if (newName) {
          StorageService.saveClass({ id: classId, name: newName });
          renderManagerDashboard();
          updateHeaderContext();
          UIHelpers.showToast('Class renamed.', 'success');
        }
      });
    });

    classesManagerGrid.querySelectorAll('.btn-delete-class').forEach(b => {
      b.addEventListener('click', async () => {
        const classId = b.getAttribute('data-classid');
        const classObj = StorageService.getClassById(classId);
        if (!classObj) return;
        const ok = await UIHelpers.showConfirmModal({
          title: 'Delete Class',
          message: `Are you sure you want to delete class "${classObj.name}" and all of its assessments?`,
          confirmText: 'Delete Class',
          danger: true
        });
        if (ok) {
          StorageService.deleteClass(classId);
          if (currentClassId === classId) {
            currentClassId = null;
            currentAssessmentId = null;
            StorageService.clearActiveContext();
          }
          renderManagerDashboard();
          UIHelpers.showToast(`Deleted class "${classObj.name}".`, 'info');
        }
      });
    });

    classesManagerGrid.querySelectorAll('.btn-rename-assess').forEach(b => {
      b.addEventListener('click', async () => {
        const classId = b.getAttribute('data-classid');
        const assessId = b.getAttribute('data-assessid');
        const assess = StorageService.getAssessmentById(classId, assessId);
        if (!assess) return;
        const newName = await UIHelpers.showPromptModal({
          title: 'Rename Assessment',
          label: 'Assessment Name',
          defaultValue: assess.name,
          confirmText: 'Save Name'
        });
        if (newName) {
          StorageService.saveAssessment(classId, { id: assessId, name: newName });
          renderManagerDashboard();
          updateHeaderContext();
          UIHelpers.showToast('Assessment renamed.', 'success');
        }
      });
    });

    classesManagerGrid.querySelectorAll('.btn-delete-assess').forEach(b => {
      b.addEventListener('click', async () => {
        const classId = b.getAttribute('data-classid');
        const assessId = b.getAttribute('data-assessid');
        const assess = StorageService.getAssessmentById(classId, assessId);
        if (!assess) return;
        const ok = await UIHelpers.showConfirmModal({
          title: 'Delete Assessment',
          message: `Are you sure you want to delete assessment "${assess.name}"?`,
          confirmText: 'Delete Assessment',
          danger: true
        });
        if (ok) {
          StorageService.deleteAssessment(classId, assessId);
          if (currentAssessmentId === assessId) {
            currentAssessmentId = null;
            StorageService.clearActiveContext();
          }
          renderManagerDashboard();
          UIHelpers.showToast(`Deleted assessment "${assess.name}".`, 'info');
        }
      });
    });
  }

  function openDuplicateAssessmentModal(sourceClassId, sourceAssessId) {
    const sourceAssess = StorageService.getAssessmentById(sourceClassId, sourceAssessId);
    const allClasses = StorageService.getClasses();
    if (!sourceAssess || allClasses.length === 0) return;

    const classOptionsHtml = allClasses.map(c =>
      `<option value="${esc(c.id)}" ${c.id === sourceClassId ? 'selected' : ''}>${esc(c.name)}</option>`
    ).join('');

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div>
          <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.3rem;">New Assessment Name</label>
          <input type="text" id="dupAssessNameInput" class="form-control" value="${esc(sourceAssess.name)} (Copy)">
        </div>
        <div>
          <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.3rem;">Destination Class</label>
          <select id="dupAssessTargetClass" class="form-control">${classOptionsHtml}</select>
        </div>
        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
          <input type="checkbox" id="dupAssessIncludeStudents">
          <span>Also copy student gradebook scores and generated comments (leave unchecked to copy only Question Map, Comment Bank/Outcomes, and Settings)</span>
        </label>
      </div>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary btn-sm" data-action="cancel">Cancel</button>
      <button type="button" class="btn btn-primary btn-sm" data-action="confirm">Duplicate Assessment</button>
    `;

    UIHelpers._openDynamicModal({
      title: 'Duplicate Assessment',
      bodyHtml,
      footerHtml,
      onMount: (overlay, close) => {
        const nameInp = overlay.querySelector('#dupAssessNameInput');
        const classSel = overlay.querySelector('#dupAssessTargetClass');
        const stuChk = overlay.querySelector('#dupAssessIncludeStudents');

        overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => close(null));
        overlay.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
          const newName = (nameInp?.value || '').trim();
          if (!newName) {
            nameInp?.focus();
            return;
          }
          const created = StorageService.duplicateAssessment(sourceClassId, sourceAssessId, {
            targetClassId: classSel?.value || sourceClassId,
            newName,
            includeStudents: Boolean(stuChk?.checked)
          });
          close(created);
          if (created) {
            renderManagerDashboard();
            UIHelpers.showToast(`Duplicated assessment as "${created.name}".`, 'success');
          }
        });
        setTimeout(() => {
          nameInp?.focus();
          nameInp?.select();
        }, 30);
      }
    });
  }

  // Global Export / Import Data Listeners
  btnExportAllData?.addEventListener('click', () => {
    StorageService.exportAllData();
    UIHelpers.showToast('Full workspace backup downloaded.', 'success');
  });

  if (btnImportData && importDataInput) {
    btnImportData.addEventListener('click', () => {
      importDataInput.value = '';
      importDataInput.click();
    });

    importDataInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          const isSingleClass = parsed.exportType === 'single_class' || (parsed.class && parsed.class.name);
          const isCommentBank = parsed.exportType === 'comment_bank' || (parsed.achievements && parsed.improvements);

          if (isCommentBank) {
            const fileSec = (parsed.section && parsed.section !== 'All') ? parsed.section : null;
            const targetSec = fileSec || activeCommentBankSection;
            const secLabel = targetSec === 'General' ? 'General Comments' : targetSec;
            const mode = await UIHelpers.showChoiceModal({
              title: `Import Comment Bank into [${secLabel}]`,
              message: 'Choose how to import comments from this file:',
              choices: [
                { id: 'merge', label: 'Merge Comments (Recommended)', description: 'Keep existing comments and append unique new ones.' },
                { id: 'replace', label: 'Replace Section Comments', description: `Clear existing comments in [${secLabel}] before importing.` }
              ]
            });
            if (!mode) return;
            const res = commentBank.importFromJSON(parsed, mode, targetSec);
            if (res.success) {
              renderStep3CommentBank();
              triggerAutoSave();
              UIHelpers.showToast(`Imported ${res.achievementsAdded} achievements & ${res.improvementsAdded} improvements.`, 'success');
            } else {
              UIHelpers.showToast(`Import failed: ${res.message}`, 'danger');
            }
            return;
          }

          if (isSingleClass) {
            const classObj = parsed.class || parsed;
            const mode = await UIHelpers.showChoiceModal({
              title: `Import Class "${classObj.name || 'Imported'}"`,
              message: 'Choose how to handle existing classes with the same ID or name:',
              choices: [
                { id: 'merge', label: 'Merge / Update Class (Recommended)', description: 'Merge assessments into any matching class.' },
                { id: 'replace', label: 'Overwrite Matching Class', description: 'Replace existing class with the same ID or name.' }
              ]
            });
            if (!mode) return;
            const res = StorageService.importClass(classObj, mode);
            renderManagerDashboard();
            UIHelpers.showToast(`Class "${res.className}" ${res.action} successfully.`, 'success');
            return;
          }

          const mode = await UIHelpers.showChoiceModal({
            title: 'Import Full Workspace Backup',
            message: 'Choose whether to merge with your existing classes or replace all data:',
            choices: [
              { id: 'merge', label: 'Merge with Existing Data (Recommended)', description: 'Keep current classes and merge in classes/assessments from the backup.' },
              { id: 'replace', label: 'Replace All Data', description: 'Overwrite all current classes and assessments with this backup.' }
            ]
          });
          if (!mode) return;
          const res = StorageService.importAllData(parsed, mode);
          renderManagerDashboard();
          if (res.mode === 'replace') {
            UIHelpers.showToast(`Restored backup with ${res.count} class(es).`, 'success');
          } else {
            UIHelpers.showToast(`Merged backup: ${res.addedCount} added, ${res.updatedCount} updated.`, 'success');
          }
        } catch (err) {
          console.error('Import error:', err);
          UIHelpers.showToast(`Failed to parse JSON file: ${err.message}`, 'danger');
        }
      };
      reader.readAsText(file);
    });
  }

  // --- Step Navigation ---
  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetStep = parseInt(btn.getAttribute('data-target'), 10);
      showStep(targetStep);
    });
  });

  function showStep(stepNum) {
    state.currentStep = stepNum;
    const isDashboard = (stepNum === 0);

    stepItems.forEach(item => {
      const itemStep = parseInt(item.getAttribute('data-step'), 10);
      item.classList.remove('active', 'completed');
      if (itemStep === stepNum) item.classList.add('active');
      if (itemStep < stepNum && itemStep > 0) item.classList.add('completed');

      if (itemStep === 0) {
        item.style.display = 'flex';
      } else {
        item.style.display = isDashboard ? 'none' : 'flex';
      }
    });

    stepPanels.forEach((panel, idx) => {
      panel.classList.remove('active');
      if (idx === stepNum) panel.classList.add('active');
    });

    if (stepNum === 0) renderManagerDashboard();
    if (stepNum === 1) updateStep1UploadUI();
    if (stepNum === 2) renderStep2Questions();
    if (stepNum === 3) {
      if (state.commentBankMode === null) {
        if (commentModeModal) commentModeModal.style.display = 'flex';
      }
      renderStep3CommentBank();
    }
    if (stepNum === 4) {
      syncGenerationConfigUI();
      renderStep4Dashboard();
      setTimeout(autoResizeAllCommentBoxes, 50);
    }

    updateHeaderContext();
    if (!isDashboard) triggerAutoSave();
  }

  stepItems.forEach(item => {
    item.addEventListener('click', () => {
      const step = parseInt(item.getAttribute('data-step'), 10);
      if (state.currentStep === 0 && step > 0) return;
      showStep(step);
    });
  });

  // --- Step 1: Upload Gradebook & Quick Preview ---
  function updateStep1UploadUI() {
    const hasData = (state.students && state.students.length > 0) && (state.spreadsheetName || state.spreadsheetFile);
    if (!hasData) {
      if (spreadsheetStatus) spreadsheetStatus.innerHTML = '';
      if (sheetSelectContainer) sheetSelectContainer.style.display = 'none';
      if (detectionNotice) detectionNotice.style.display = 'none';
      if (gradebookPreviewCard) {
        gradebookPreviewCard.style.display = 'none';
        gradebookPreviewCard.innerHTML = '';
      }
      if (btnGotoStep2) btnGotoStep2.disabled = true;
      if (spreadsheetInput) spreadsheetInput.value = '';
      return;
    }

    const sheetName = state.selectedSheet || state.excelData?.sheetName || (state.availableSheets && state.availableSheets[0]) || 'Default';
    const fileName = state.spreadsheetName || state.spreadsheetFile?.name || 'Uploaded Gradebook';

    if (spreadsheetStatus) {
      spreadsheetStatus.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; color: var(--success-text); font-weight: 600;">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg>
          <span>Gradebook Loaded: <strong>${esc(fileName)}</strong></span>
        </div>
      `;
    }

    const sheets = (state.availableSheets && state.availableSheets.length > 0)
      ? state.availableSheets
      : (state.excelData?.availableSheets || []);

    if (sheets.length > 1 && sheetSelect && sheetSelectContainer) {
      sheetSelect.innerHTML = '';
      sheets.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        if (s === sheetName) opt.selected = true;
        sheetSelect.appendChild(opt);
      });
      sheetSelectContainer.style.display = 'flex';
    } else if (sheetSelectContainer) {
      sheetSelectContainer.style.display = 'none';
    }

    const cov = CommentEngine.calculateQuestionCoverage(state.questions, commentBank, state.outcomes, state.commentBankMode || 'question');

    if (detectionNotice && detectionDetails) {
      detectionNotice.style.display = 'flex';
      detectionDetails.textContent = `Active Sheet: "${sheetName}". Loaded ${state.students.length} student records across ${cov.totalQuestions} included questions (${cov.totalMaxMarks} total marks).`;
    }

    if (gradebookPreviewCard) {
      const summaries = state.students.map(s => ({
        student: s,
        summary: CommentEngine.calculateStudentScoreSummary(s, state.questions)
      }));
      const graded = summaries.filter(x => !x.summary.isZeroOutOfZero);
      const avgPct = graded.length > 0
        ? Math.round(graded.reduce((acc, x) => acc + x.summary.percentage, 0) / graded.length)
        : 0;

      const rowsHtml = summaries.map(({ student, summary }, idx) => `
        <tr>
          <td style="padding: 0.45rem 0.75rem; color: var(--text-muted); font-size: 0.78rem;">${idx + 1}</td>
          <td style="padding: 0.45rem 0.75rem; font-weight: 600;">${esc(student.name)}</td>
          <td style="padding: 0.45rem 0.75rem; font-family: var(--font-mono); font-size: 0.8rem;">${summary.obtained} / ${summary.max}</td>
          <td style="padding: 0.45rem 0.75rem; font-family: var(--font-mono); font-size: 0.8rem;">${summary.isZeroOutOfZero ? 'NA' : `${summary.percentage}%`}</td>
          <td style="padding: 0.45rem 0.75rem;"><span class="tag-pill">${esc(summary.band)}</span></td>
        </tr>
      `).join('');

      gradebookPreviewCard.style.display = 'block';
      gradebookPreviewCard.innerHTML = `
        <div class="preview-stats-row">
          <div class="preview-stat-box">
            <div class="preview-stat-label">Students</div>
            <div class="preview-stat-value">${state.students.length}</div>
          </div>
          <div class="preview-stat-box">
            <div class="preview-stat-label">Questions</div>
            <div class="preview-stat-value">${cov.totalQuestions}</div>
          </div>
          <div class="preview-stat-box">
            <div class="preview-stat-label">Total Marks</div>
            <div class="preview-stat-value">${cov.totalMaxMarks}</div>
          </div>
          <div class="preview-stat-box">
            <div class="preview-stat-label">Class Average</div>
            <div class="preview-stat-value">${avgPct}%</div>
          </div>
        </div>
        <div class="mini-preview-table-wrap">
          <table class="data-table" style="font-size: 0.82rem;">
            <thead>
              <tr>
                <th style="width: 48px; padding: 0.5rem 0.75rem;">#</th>
                <th style="padding: 0.5rem 0.75rem;">Student Name</th>
                <th style="padding: 0.5rem 0.75rem;">Score</th>
                <th style="padding: 0.5rem 0.75rem;">Percentage</th>
                <th style="padding: 0.5rem 0.75rem;">Band</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `;
    }

    if (btnGotoStep2) {
      btnGotoStep2.disabled = false;
    }
  }

  setupDropzone(spreadsheetDropzone, spreadsheetInput, handleSpreadsheetSelect);

  function setupDropzone(dropzoneEl, inputEl, handler) {
    if (!dropzoneEl || !inputEl) return;

    dropzoneEl.addEventListener('click', () => inputEl.click());
    dropzoneEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzoneEl.classList.add('dragover');
    });
    dropzoneEl.addEventListener('dragleave', () => dropzoneEl.classList.remove('dragover'));
    dropzoneEl.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzoneEl.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        inputEl.files = e.dataTransfer.files;
        handler(e.dataTransfer.files[0]);
      }
    });
    inputEl.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handler(e.target.files[0]);
    });
  }

  async function handleSpreadsheetSelect(file, targetSheetName = null) {
    try {
      state.spreadsheetFile = file;
      state.spreadsheetName = file.name;
      if (spreadsheetStatus) spreadsheetStatus.textContent = `Reading ${file.name}...`;

      if (!targetSheetName && file.arrayBuffer) {
        spreadsheetArrayBuffer = await file.arrayBuffer();
      }
      if (!spreadsheetArrayBuffer) {
        throw new Error('Spreadsheet file buffer is empty or not loaded.');
      }

      state.excelData = ExcelParser.parseSpreadsheet(spreadsheetArrayBuffer, targetSheetName);
      state.students = state.excelData.students;
      state.availableSheets = state.excelData.availableSheets || [];
      state.selectedSheet = state.excelData.sheetName;

      if (currentClassId) {
        const classObj = StorageService.getClassById(currentClassId);
        if (classObj) {
          classObj.spreadsheetName = file.name;
          classObj.availableSheets = state.availableSheets;
          classObj.selectedSheet = state.selectedSheet;
          if (spreadsheetArrayBuffer && spreadsheetArrayBuffer.byteLength < 5 * 1024 * 1024) {
            try {
              let binary = '';
              const bytes = new Uint8Array(spreadsheetArrayBuffer);
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              classObj.spreadsheetBase64 = btoa(binary);
            } catch (e) {
              console.warn('Could not encode spreadsheetBase64:', e);
            }
          }
          StorageService.saveClass(classObj);
        }
      }

      state.questions = state.excelData.questionCols.map((col, idx) => ({
        id: col.suggestedQuestionId || `Q${idx + 1}`,
        headerName: col.headerName,
        maxMarks: col.isPenalty ? 0 : (col.maxMarks !== undefined ? col.maxMarks : (col.maxObservedScore > 0 ? col.maxObservedScore : 1)),
        isSubQuestion: Boolean(col.isSubQuestion),
        isPenalty: Boolean(col.isPenalty),
        isTotal: Boolean(col.isTotal),
        isPercentage: Boolean(col.isPercentage),
        isSummary: Boolean(col.isSummary),
        included: col.isPenalty ? true : (!col.isSummary && !col.isTotal && !col.isPercentage),
        colIndex: col.colIndex
      }));

      recalculateQuestionIdsBySection();
      updateStep1UploadUI();
      triggerAutoSave();
      UIHelpers.showToast(`Loaded ${state.students.length} students from "${state.selectedSheet}".`, 'success');
    } catch (err) {
      UIHelpers.showToast(`Error parsing spreadsheet: ${err.message}`, 'danger');
      if (spreadsheetStatus) spreadsheetStatus.textContent = 'Error parsing file.';
    }
  }

  sheetSelect?.addEventListener('change', async (e) => {
    const targetSheet = e.target.value;
    if (state.spreadsheetFile && spreadsheetArrayBuffer) {
      await handleSpreadsheetSelect(state.spreadsheetFile, targetSheet);
    } else if (spreadsheetArrayBuffer) {
      const mockFile = { name: state.spreadsheetName || 'Gradebook.xlsx' };
      await handleSpreadsheetSelect(mockFile, targetSheet);
    }
    triggerAutoSave();
  });

  btnGotoStep2?.addEventListener('click', () => showStep(2));

  // --- Step 2: Question Structure Editor & Summary Bar ---
  function recalculateQuestionIdsBySection() {
    let currentSectionName = 'General';
    const sectionUsedIds = new Map();

    state.questions.forEach((q, idx) => {
      if (q.isSectionBreak) {
        currentSectionName = q.name || 'Section';
        return;
      }
      if (q.isPenalty || q.isTotal || q.isPercentage || q.isSummary) {
        q.section = null;
        return;
      }

      q.section = currentSectionName;
      if (!sectionUsedIds.has(currentSectionName)) {
        sectionUsedIds.set(currentSectionName, new Map());
      }
      const usedMap = sectionUsedIds.get(currentSectionName);

      let baseId = '';
      if (q.headerName && q.headerName !== 'Manual Entry' && !q.userEditedId) {
        baseId = ExcelParser.cleanQuestionName(q.headerName, idx);
      } else if (q.id) {
        baseId = q.id.replace(/_\d+$/, '');
      } else {
        baseId = `Q${idx + 1}`;
      }

      if (usedMap.has(baseId)) {
        const count = usedMap.get(baseId) + 1;
        usedMap.set(baseId, count);
        q.id = `${baseId}_${count}`;
      } else {
        usedMap.set(baseId, 1);
        q.id = baseId;
      }
    });

    if (state.students && state.students.length > 0) {
      const globalIdCounts = new Map();
      state.questions.forEach(q => {
        if (!q.isSectionBreak && q.id) {
          globalIdCounts.set(q.id, (globalIdCounts.get(q.id) || 0) + 1);
        }
      });

      state.students.forEach(student => {
        if (!student.scores) student.scores = {};
        state.questions.forEach(q => {
          if (!q.isSectionBreak && q.colIndex !== undefined && q.colIndex >= 0) {
            const val = student.scores[`col_${q.colIndex}`] !== undefined ? student.scores[`col_${q.colIndex}`] : student.scores[q.colIndex];
            if (val !== undefined) {
              if (q.section && q.section !== 'General') {
                student.scores[`${q.section}__${q.id}`] = val;
              }
              const isUniqueGlobal = (globalIdCounts.get(q.id) || 0) <= 1;
              if (isUniqueGlobal) {
                student.scores[q.id] = val;
              } else {
                delete student.scores[q.id];
              }
            }
          }
        });
      });
    }
  }

  function renderStep2StructureSummary() {
    if (!questionStructureSummaryBar) return;
    const cov = CommentEngine.calculateQuestionCoverage(state.questions, commentBank, state.outcomes, state.commentBankMode || 'question');
    if (cov.totalQuestions === 0) {
      questionStructureSummaryBar.style.display = 'none';
      return;
    }

    const secPillsHtml = cov.sectionBreakdown.map(sec => `
      <span class="tag-pill" style="background: var(--bg-surface); color: var(--text-main); font-weight: 600;">
        ${esc(sec.section)}: <strong>${sec.questionCount}</strong> Qs (${sec.totalMarks} marks)
      </span>
    `).join('');

    questionStructureSummaryBar.style.display = 'flex';
    questionStructureSummaryBar.innerHTML = `
      <div class="summary-stats-group">
        <span>Included Questions: <strong style="color: var(--text-main);">${cov.totalQuestions}</strong></span>
        <span>Total Assessment Marks: <strong style="color: var(--primary);">${cov.totalMaxMarks}</strong></span>
      </div>
      <div class="section-breakdown-pills">
        ${secPillsHtml}
      </div>
    `;
  }

  function renderStep2Questions() {
    if (!questionsTableBody) return;
    questionsTableBody.innerHTML = '';
    renderStep2StructureSummary();
    updateWizardStepBadges();

    if (!state.questions || state.questions.length === 0) {
      questionsTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No questions loaded yet. Upload a spreadsheet in Step 1 or click "+ Add Question" above.
          </td>
        </tr>
      `;
      return;
    }

    let currentSectionName = 'General';

    state.questions.forEach((q, idx) => {
      if (q.isSectionBreak) {
        currentSectionName = q.name || q.sectionName || q.title || 'Section Break';
        const tr = document.createElement('tr');
        tr.className = 'section-break-row draggable-row';
        tr.setAttribute('draggable', 'true');
        tr.setAttribute('data-idx', idx);
        tr.innerHTML = `
          <td colspan="7">
            <div class="section-break-content">
              <div class="section-break-title-group">
                <span class="drag-handle" title="Drag to reposition this section break">⋮⋮</span>
                <span class="section-break-tag">Section</span>
                <input type="text" class="section-break-name-input q-sec-title-input" value="${esc(q.name || q.sectionName || q.title || '')}" data-idx="${idx}" placeholder="Enter Section Name / Topic...">
              </div>
              <div style="display: flex; align-items: center; gap: 0.35rem;">
                <button type="button" class="btn btn-secondary btn-sm btn-move-sec-up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Move Section Up">
                  <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7"></path></svg>
                </button>
                <button type="button" class="btn btn-secondary btn-sm btn-move-sec-down" data-idx="${idx}" ${idx === state.questions.length - 1 ? 'disabled' : ''} title="Move Section Down">
                  <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <button type="button" class="btn btn-danger btn-sm btn-del-sec" data-idx="${idx}">Remove</button>
              </div>
            </div>
          </td>
        `;
        questionsTableBody.appendChild(tr);
        return;
      }

      const isSpecial = q.isPenalty || q.isTotal || q.isPercentage || q.isSummary;
      q.section = isSpecial ? null : currentSectionName;

      const tr = document.createElement('tr');
      tr.className = 'draggable-row';
      tr.setAttribute('draggable', 'true');
      tr.setAttribute('data-idx', idx);

      const subCheckHtml = isSpecial
        ? `<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">N/A</span>`
        : `<input type="checkbox" class="q-sub-check" ${q.isSubQuestion ? 'checked' : ''} data-idx="${idx}">`;

      const includeHtml = (q.isTotal || q.isPercentage || q.isSummary)
        ? `<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">Excluded</span>`
        : `<input type="checkbox" class="q-include-check" ${q.included ? 'checked' : ''} data-idx="${idx}">`;

      const marksHtml = q.isPenalty
        ? `<span style="font-weight: 600; font-size: 0.85rem;">0</span>`
        : (q.isTotal || q.isPercentage || q.isSummary
          ? `<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">N/A</span>`
          : `<input type="number" class="input-table q-marks-input" value="${esc(q.maxMarks)}" min="0" step="0.5" data-idx="${idx}" style="width: 74px;">`);

      const sectionBadgeHtml = (!isSpecial && q.section && q.section !== 'General')
        ? `<span class="tag-pill" style="background: var(--primary-light); color: var(--primary-text); font-weight: 700; margin-top: 4px; display: inline-block;">${esc(q.section)}</span>`
        : '';

      tr.innerHTML = `
        <td style="text-align: center;">
          <span class="drag-handle" title="Drag and drop to reposition this question">⋮⋮</span>
        </td>
        <td><strong>${esc(q.headerName || q.id)}</strong></td>
        <td>
          <input type="text" class="input-table q-id-input" value="${esc(q.id)}" data-idx="${idx}">
          ${sectionBadgeHtml}
        </td>
        <td>${marksHtml}</td>
        <td style="text-align: center;">${subCheckHtml}</td>
        <td style="text-align: center;">${includeHtml}</td>
        <td>
          <div style="display: flex; gap: 0.35rem; align-items: center;">
            <button type="button" class="btn btn-secondary btn-sm btn-split-here" data-idx="${idx}" title="Insert a section break directly above this question" style="font-size: 0.775rem; padding: 0.25rem 0.5rem; white-space: nowrap;">
              <span>+ Split Section</span>
            </button>
            <button type="button" class="btn btn-danger btn-sm btn-del-q" data-idx="${idx}" style="font-size: 0.775rem; padding: 0.25rem 0.5rem;">Remove</button>
          </div>
        </td>
      `;

      questionsTableBody.appendChild(tr);
    });

    let draggedIdx = null;
    questionsTableBody.querySelectorAll('.draggable-row').forEach(row => {
      row.addEventListener('dragstart', (e) => {
        if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) {
          e.preventDefault();
          return;
        }
        draggedIdx = parseInt(row.getAttribute('data-idx'), 10);
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(draggedIdx));
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        questionsTableBody.querySelectorAll('.draggable-row').forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom'));
        draggedIdx = null;
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const targetIdx = parseInt(row.getAttribute('data-idx'), 10);
        if (draggedIdx === null || targetIdx === draggedIdx) return;
        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        row.classList.remove('drag-over-top', 'drag-over-bottom');
        row.classList.add(e.clientY < midY ? 'drag-over-top' : 'drag-over-bottom');
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetIdx = parseInt(row.getAttribute('data-idx'), 10);
        row.classList.remove('drag-over-top', 'drag-over-bottom');
        if (draggedIdx === null || targetIdx === draggedIdx) return;

        const rect = row.getBoundingClientRect();
        const insertBefore = e.clientY < (rect.top + rect.height / 2);
        const [movedItem] = state.questions.splice(draggedIdx, 1);

        let newIdx = targetIdx;
        if (draggedIdx < targetIdx) {
          newIdx = insertBefore ? targetIdx - 1 : targetIdx;
        } else {
          newIdx = insertBefore ? targetIdx : targetIdx + 1;
        }
        newIdx = Math.max(0, Math.min(state.questions.length, newIdx));
        state.questions.splice(newIdx, 0, movedItem);

        recalculateQuestionIdsBySection();
        renderStep2Questions();
        triggerAutoSave();
      });
    });

    questionsTableBody.querySelectorAll('.q-sec-title-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        state.questions[idx].name = e.target.value.trim() || 'Section';
        recalculateQuestionIdsBySection();
        renderStep2Questions();
        triggerAutoSave();
      });
    });

    questionsTableBody.querySelectorAll('.btn-move-sec-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (idx > 0) {
          const [item] = state.questions.splice(idx, 1);
          state.questions.splice(idx - 1, 0, item);
          recalculateQuestionIdsBySection();
          renderStep2Questions();
          triggerAutoSave();
        }
      });
    });

    questionsTableBody.querySelectorAll('.btn-move-sec-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (idx < state.questions.length - 1) {
          const [item] = state.questions.splice(idx, 1);
          state.questions.splice(idx + 1, 0, item);
          recalculateQuestionIdsBySection();
          renderStep2Questions();
          triggerAutoSave();
        }
      });
    });

    questionsTableBody.querySelectorAll('.btn-del-sec').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        state.questions.splice(idx, 1);
        recalculateQuestionIdsBySection();
        renderStep2Questions();
        triggerAutoSave();
      });
    });

    questionsTableBody.querySelectorAll('.btn-split-here').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const existingBreaks = state.questions.filter(q => q.isSectionBreak);
        const defaultLetter = String.fromCharCode(65 + existingBreaks.length);
        const name = await UIHelpers.showPromptModal({
          title: 'Split Section Above Question',
          label: 'Section Name / Topic',
          defaultValue: `Section ${defaultLetter}`,
          placeholder: 'e.g. SAQ or Extended Response',
          confirmText: 'Insert Section Break'
        });
        if (name) {
          state.questions.splice(idx, 0, {
            isSectionBreak: true,
            id: `sec_${Date.now()}`,
            name
          });
          recalculateQuestionIdsBySection();
          renderStep2Questions();
          triggerAutoSave();
        }
      });
    });

    questionsTableBody.querySelectorAll('.q-id-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        state.questions[idx].id = e.target.value.trim() || `Q${idx + 1}`;
        state.questions[idx].userEditedId = true;
        recalculateQuestionIdsBySection();
        renderStep2Questions();
        triggerAutoSave();
      });
    });

    questionsTableBody.querySelectorAll('.q-marks-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        state.questions[idx].maxMarks = parseFloat(e.target.value) || 0;
        renderStep2StructureSummary();
        updateWizardStepBadges();
        triggerAutoSave();
      });
    });

    questionsTableBody.querySelectorAll('.q-sub-check').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        state.questions[idx].isSubQuestion = e.target.checked;
        triggerAutoSave();
      });
    });

    questionsTableBody.querySelectorAll('.q-include-check').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        state.questions[idx].included = e.target.checked;
        renderStep2StructureSummary();
        updateWizardStepBadges();
        triggerAutoSave();
      });
    });

    questionsTableBody.querySelectorAll('.btn-del-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        state.questions.splice(idx, 1);
        recalculateQuestionIdsBySection();
        renderStep2Questions();
        triggerAutoSave();
      });
    });
  }

  btnAddQuestion?.addEventListener('click', () => {
    state.questions.push({
      id: `Q${state.questions.filter(q => !q.isSectionBreak).length + 1}`,
      headerName: 'Manual Entry',
      maxMarks: 1,
      isSubQuestion: false,
      included: true,
      colIndex: -1
    });
    recalculateQuestionIdsBySection();
    renderStep2Questions();
    triggerAutoSave();
  });

  btnAddSectionBreak?.addEventListener('click', async () => {
    const existingBreaks = state.questions.filter(q => q.isSectionBreak);
    const defaultLetter = String.fromCharCode(65 + existingBreaks.length);
    const name = await UIHelpers.showPromptModal({
      title: 'Add Section Break',
      label: 'Section Name / Topic',
      defaultValue: `Section ${defaultLetter}`,
      placeholder: 'e.g. Section A - Multiple Choice',
      confirmText: 'Add Section'
    });
    if (name) {
      state.questions.push({
        isSectionBreak: true,
        id: `sec_${Date.now()}`,
        name
      });
      recalculateQuestionIdsBySection();
      renderStep2Questions();
      triggerAutoSave();
    }
  });

  btnGotoStep3?.addEventListener('click', () => showStep(3));

  // --- Step 3: Comment Bank Management, Question Coverage, Inline Composer & Outcome Mode ---
  function getAssessmentSections() {
    const sectionNames = [];
    (state.questions || []).forEach(q => {
      const sName = q.name || q.sectionName || q.title;
      if (q.isSectionBreak && sName && !sectionNames.includes(sName)) {
        sectionNames.push(sName);
      }
    });
    return ['General', ...sectionNames];
  }

  function getQuestionsForSection(sectionName) {
    const valid = (state.questions || []).filter(
      q => !q.isSectionBreak && !q.isTotal && !q.isPercentage && !q.isSummary && !q.isPenalty && q.included !== false
    );
    if (!sectionName || sectionName === 'General') {
      const hasNamedSections = valid.some(q => q.section && q.section !== 'General');
      return hasNamedSections ? valid.filter(q => !q.section || q.section === 'General') : valid;
    }
    return valid.filter(q => CommentEngine.isSectionMatch(sectionName, q.section, true));
  }

  function renderStep3CoverageBanner() {
    if (!questionCoverageBanner) return;
    const mode = state.commentBankMode === 'outcome' ? 'outcome' : 'question';
    const cov = CommentEngine.calculateQuestionCoverage(state.questions, commentBank, state.outcomes, mode);

    if (cov.totalQuestions === 0) {
      questionCoverageBanner.style.display = 'none';
      return;
    }

    const hasMultiSec = cov.sectionBreakdown.length > 1;
    const pillsHtml = cov.questionCoverage.map(item => {
      const label = hasMultiSec && item.section !== 'General' ? `${item.section}: ${item.id}` : item.id;
      const statusClass = `status-${item.status}`;
      const icon = item.status === 'full' ? '✓' : (item.status === 'partial' ? '◐' : '○');
      const tip = `${label} (${item.maxMarks}m) — ${item.achCount} Achievement(s), ${item.impCount} Improvement(s). Click to jump/tag.`;
      return `
        <button type="button" class="coverage-q-pill ${statusClass}" data-q-id="${esc(item.id)}" data-q-sec="${esc(item.section)}" title="${esc(tip)}">
          <span>${icon}</span>
          <span>${esc(label)}</span>
          <span style="opacity: 0.75; font-weight: 600;">+${item.achCount}/-${item.impCount}</span>
        </button>
      `;
    }).join('');

    questionCoverageBanner.style.display = 'block';
    questionCoverageBanner.innerHTML = `
      <div class="coverage-header">
        <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
          <strong style="font-size: 0.85rem; color: var(--text-main);">Question Comment Coverage:</strong>
          <span class="tag-pill" style="background: var(--success-light); color: var(--success-text); border-color: rgba(56, 115, 78, 0.3);">
            ✓ ${cov.fullyCoveredCount} Full (+ &amp; -)
          </span>
          <span class="tag-pill" style="background: var(--warning-light); color: var(--warning-text); border-color: rgba(184, 115, 32, 0.35);">
            ◐ ${cov.partialCoveredCount} Partial
          </span>
          <span class="tag-pill">
            ○ ${cov.uncoveredCount} Uncovered
          </span>
        </div>
        <span style="font-size: 0.76rem; color: var(--text-muted);">
          ${mode === 'outcome' ? 'Tag every question to at least one outcome below' : 'Click any question pill to add a comment for that question'}
        </span>
      </div>
      <div class="coverage-pills-wrap">
        ${pillsHtml}
      </div>
    `;

    questionCoverageBanner.querySelectorAll('.coverage-q-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const qId = pill.getAttribute('data-q-id');
        const qSec = pill.getAttribute('data-q-sec') || 'General';
        if (state.commentBankMode === 'outcome') {
          if (state.outcomes.length === 0) handleAddOutcomeAndScroll();
          return;
        }
        const sections = getAssessmentSections();
        if (sections.includes(qSec) && activeCommentBankSection !== qSec) {
          activeCommentBankSection = qSec;
          renderStep3CommentBank();
        }
        openInlineComposer('achievements', [qId]);
      });
    });
  }

  function openInlineComposer(category = 'achievements', preselectedQIds = []) {
    const container = category === 'achievements' ? achieveComposer : improveComposer;
    if (!container) return;

    const sectionQuestions = getQuestionsForSection(activeCommentBankSection);
    const selectedQSet = new Set(preselectedQIds);

    const pillsHtml = sectionQuestions.map(q => {
      const qId = q.id || q.title;
      return `<button type="button" class="composer-q-pill ${selectedQSet.has(qId) ? 'selected' : ''}" data-qid="${esc(qId)}">${esc(qId)}</button>`;
    }).join('');

    const catLabel = category === 'achievements' ? 'Achievement (Strength)' : 'Improvement (Growth)';
    const secLabel = activeCommentBankSection === 'General' ? 'General' : activeCommentBankSection;

    container.style.display = 'flex';
    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <strong style="font-size: 0.82rem; color: var(--text-main);">New ${catLabel} in [${esc(secLabel)}]</strong>
        <button type="button" class="btn-close" data-action="close-composer" style="font-size: 1.1rem;">&times;</button>
      </div>
      ${sectionQuestions.length > 0 ? `
        <div class="composer-q-pills">
          <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-right: 0.25rem;">Tag Question(s):</span>
          ${pillsHtml}
        </div>
      ` : ''}
      <textarea class="comment-textarea composer-text-input" rows="2" style="min-height: 64px; padding: 0.55rem 0.75rem;" placeholder="Write comment here (or prefix with e.g. 'Q1a: ...')..."></textarea>
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
        <input type="text" class="form-control composer-tags-input" style="max-width: 220px; padding: 0.35rem 0.6rem; font-size: 0.78rem;" placeholder="Optional tags (comma-separated)...">
        <div style="display: flex; gap: 0.4rem;">
          <button type="button" class="btn btn-secondary btn-sm" data-action="cancel-composer">Cancel</button>
          <button type="button" class="btn btn-primary btn-sm" data-action="save-composer">Save Comment</button>
        </div>
      </div>
    `;

    container.querySelectorAll('.composer-q-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const qId = pill.getAttribute('data-qid');
        if (selectedQSet.has(qId)) {
          selectedQSet.delete(qId);
          pill.classList.remove('selected');
        } else {
          selectedQSet.add(qId);
          pill.classList.add('selected');
        }
      });
    });

    const closeComposer = () => {
      container.style.display = 'none';
      container.innerHTML = '';
    };

    const textInput = container.querySelector('.composer-text-input');
    const tagsInput = container.querySelector('.composer-tags-input');

    const submitComposer = () => {
      const rawText = (textInput?.value || '').trim();
      if (!rawText) {
        textInput?.focus();
        return;
      }
      const parsed = CommentEngine.parseCommentEntry(rawText);
      const pillQIds = Array.from(selectedQSet);
      const finalQIds = pillQIds.length > 0 ? pillQIds : (parsed.questionIds || []);
      const customTags = (tagsInput?.value || '').split(',').map(t => t.trim()).filter(Boolean);
      const mergedTags = Array.from(new Set([...(parsed.tags || []), ...customTags]));

      if (category === 'achievements') {
        commentBank.addAchievement(parsed.text, mergedTags, finalQIds[0] || null, activeCommentBankSection, finalQIds);
      } else {
        commentBank.addImprovement(parsed.text, mergedTags, finalQIds[0] || null, activeCommentBankSection, finalQIds);
      }

      closeComposer();
      renderStep3CommentBank();
      triggerAutoSave();
      UIHelpers.showToast('Comment added to bank.', 'success');
    };

    container.querySelector('[data-action="close-composer"]')?.addEventListener('click', closeComposer);
    container.querySelector('[data-action="cancel-composer"]')?.addEventListener('click', closeComposer);
    container.querySelector('[data-action="save-composer"]')?.addEventListener('click', submitComposer);
    textInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submitComposer();
      }
    });

    setTimeout(() => textInput?.focus(), 20);
  }

  btnAddAchievement?.addEventListener('click', () => openInlineComposer('achievements'));
  btnAddImprovement?.addEventListener('click', () => openInlineComposer('improvements'));

  // Bulk Paste Modal (Question Mode)
  function openBulkModal(category = 'achievements') {
    if (bulkCategorySelect) bulkCategorySelect.value = category;
    if (bulkPasteTextarea) bulkPasteTextarea.value = '';
    if (bulkPreviewText) bulkPreviewText.textContent = '0 comments detected';

    if (bulkSectionSelect) {
      const sections = getAssessmentSections();
      bulkSectionSelect.innerHTML = '';
      sections.forEach(sec => {
        const opt = document.createElement('option');
        opt.value = sec;
        opt.textContent = sec === 'General' ? 'General Comments' : sec;
        if (sec === activeCommentBankSection) opt.selected = true;
        bulkSectionSelect.appendChild(opt);
      });
    }

    if (bulkPasteModal) bulkPasteModal.style.display = 'flex';
    setTimeout(() => bulkPasteTextarea?.focus(), 50);
  }

  function closeBulkModal() {
    if (bulkPasteModal) bulkPasteModal.style.display = 'none';
  }

  function getLinesFromBulkInput() {
    if (!bulkPasteTextarea) return [];
    return bulkPasteTextarea.value
      .split(/\r?\n/)
      .map(line => line.trim().replace(/^"|"$/g, '').trim())
      .filter(line => line.length > 0);
  }

  btnBulkPasteAchieve?.addEventListener('click', () => openBulkModal('achievements'));
  btnBulkPasteImprove?.addEventListener('click', () => openBulkModal('improvements'));
  btnCloseBulkModal?.addEventListener('click', closeBulkModal);
  btnCancelBulk?.addEventListener('click', closeBulkModal);

  bulkPasteTextarea?.addEventListener('input', () => {
    const count = getLinesFromBulkInput().length;
    if (bulkPreviewText) bulkPreviewText.textContent = `${count} comment${count === 1 ? '' : 's'} detected`;
  });

  btnSubmitBulk?.addEventListener('click', () => {
    const lines = getLinesFromBulkInput();
    if (lines.length === 0) {
      UIHelpers.showToast('Please paste at least one comment line.', 'warning');
      return;
    }

    const category = bulkCategorySelect ? bulkCategorySelect.value : 'achievements';
    const targetSection = bulkSectionSelect ? bulkSectionSelect.value : activeCommentBankSection;

    lines.forEach(text => {
      const parsed = CommentEngine.parseCommentEntry(text);
      const tags = (Array.isArray(parsed?.tags) && parsed.tags.length > 0) ? parsed.tags : [];
      if (category === 'achievements') {
        commentBank.addAchievement(parsed.text, tags, parsed.questionId, targetSection, parsed.questionIds);
      } else {
        commentBank.addImprovement(parsed.text, tags, parsed.questionId, targetSection, parsed.questionIds);
      }
    });

    activeCommentBankSection = targetSection;
    closeBulkModal();
    renderStep3CommentBank();
    triggerAutoSave();
    UIHelpers.showToast(`Imported ${lines.length} comment(s) into [${targetSection}].`, 'success');
  });

  // Copy Comment Bank / Outcomes from Another Assessment
  btnCopyBankFromAssessment?.addEventListener('click', () => {
    const allClasses = StorageService.getClasses();
    const candidateAssessments = [];
    allClasses.forEach(c => {
      (c.assessments || []).forEach(a => {
        if (c.id === currentClassId && a.id === currentAssessmentId) return;
        const achLen = a.commentBank?.achievements?.length || 0;
        const impLen = a.commentBank?.improvements?.length || 0;
        const outLen = a.outcomes?.length || 0;
        if (achLen + impLen + outLen > 0) {
          candidateAssessments.push({
            classId: c.id,
            className: c.name,
            assessId: a.id,
            assessName: a.name,
            mode: a.commentBankMode || (outLen > 0 ? 'outcome' : 'question'),
            achLen,
            impLen,
            outLen,
            assessment: a
          });
        }
      });
    });

    if (candidateAssessments.length === 0) {
      UIHelpers.showToast('No other assessments with saved comments or outcomes were found.', 'info');
      return;
    }

    const optionsHtml = candidateAssessments.map((item, idx) => {
      const summary = item.mode === 'outcome'
        ? `${item.outLen} Outcomes`
        : `${item.achLen} Achievements, ${item.impLen} Improvements`;
      return `<option value="${idx}">${esc(item.className)} &bull; ${esc(item.assessName)} (${summary})</option>`;
    }).join('');

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div>
          <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.3rem;">Source Assessment</label>
          <select id="copyBankSourceSelect" class="form-control">${optionsHtml}</select>
        </div>
        <div>
          <label style="display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.3rem;">Import Mode</label>
          <select id="copyBankModeSelect" class="form-control">
            <option value="merge">Merge with current bank (keep existing items)</option>
            <option value="replace">Replace current bank</option>
          </select>
        </div>
      </div>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary btn-sm" data-action="cancel">Cancel</button>
      <button type="button" class="btn btn-primary btn-sm" data-action="confirm">Copy Bank</button>
    `;

    UIHelpers._openDynamicModal({
      title: 'Copy Comment Bank from Assessment',
      bodyHtml,
      footerHtml,
      onMount: (overlay, close) => {
        overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => close(null));
        overlay.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
          const idx = parseInt(overlay.querySelector('#copyBankSourceSelect')?.value || '0', 10);
          const importMode = overlay.querySelector('#copyBankModeSelect')?.value || 'merge';
          const chosen = candidateAssessments[idx];
          close(true);
          if (!chosen) return;

          if (chosen.mode === 'outcome' && Array.isArray(chosen.assessment.outcomes) && chosen.assessment.outcomes.length > 0) {
            importOutcomeBankFromParsed({
              outcomes: chosen.assessment.outcomes,
              outcomeMasteryCutoff: chosen.assessment.generationConfig?.outcomeMasteryCutoff ?? 70
            }, importMode);
          } else if (chosen.assessment.commentBank) {
            const res = commentBank.importFromJSON(chosen.assessment.commentBank, importMode, 'All');
            state.commentBankMode = 'question';
            state.generationConfig.commentSourceMode = 'question';
            renderStep3CommentBank();
            syncGenerationConfigUI();
            triggerAutoSave();
            UIHelpers.showToast(`Copied ${res.achievementsAdded} achievements & ${res.improvementsAdded} improvements from "${chosen.assessName}".`, 'success');
          }
        });
      }
    });
  });

  // Outcome Mode Management
  function setCommentBankMode(mode) {
    state.commentBankMode = mode === 'outcome' ? 'outcome' : 'question';
    if (state.commentBankMode === 'outcome') {
      if (state.outcomes.length === 0) {
        addEmptyOutcome();
      }
      state.generationConfig.commentSourceMode = 'outcome';
    } else {
      state.generationConfig.commentSourceMode = 'question';
    }
    if (commentModeModal) commentModeModal.style.display = 'none';
    syncGenerationConfigUI();
    renderStep3CommentBank();
    triggerAutoSave();
  }

  function addEmptyOutcome() {
    state.outcomes.push({
      id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: '',
      achievement: '',
      improvement: '',
      questionKeys: []
    });
  }

  function renderStep3Outcomes() {
    if (!outcomesListEl) return;
    if (outcomeCountBadge) outcomeCountBadge.textContent = String(state.outcomes.length);
    if (cfgOutcomeCutoff) cfgOutcomeCutoff.value = state.generationConfig.outcomeMasteryCutoff ?? 70;

    const validQuestions = (state.questions || []).filter(q => !q.isSectionBreak && !q.isTotal && !q.isPercentage && !q.isSummary && !q.isPenalty && q.included !== false);
    const hasMultiSection = new Set(validQuestions.map(q => q.section || 'General')).size > 1;

    outcomesListEl.innerHTML = '';
    if (state.outcomes.length === 0) {
      outcomesListEl.innerHTML = `
        <div class="empty-state" style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.86rem;">
          No outcomes added yet. Click <strong>+ Add Outcome</strong> to create one.
        </div>`;
      return;
    }

    state.outcomes.forEach((outcome, idx) => {
      const card = document.createElement('div');
      card.className = `outcome-card${outcome.needsQuestionSelection ? ' needs-question-selection' : ''}`;
      const taggedSet = new Set(Array.isArray(outcome.questionKeys) ? outcome.questionKeys : []);

      const header = document.createElement('div');
      header.className = 'outcome-card-header';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'outcome-name-input';
      nameInput.placeholder = `Outcome ${idx + 1} name...`;
      nameInput.value = outcome.name || '';
      const onNameUpdate = () => {
        outcome.name = nameInput.value;
        updateWizardStepBadges();
        triggerAutoSave();
      };
      nameInput.addEventListener('input', onNameUpdate);
      nameInput.addEventListener('change', onNameUpdate);

      const taggedBadge = document.createElement('span');
      taggedBadge.className = 'config-box-badge';
      taggedBadge.textContent = `${taggedSet.size} Qs`;

      let unmatchedBadge = null;
      if (outcome.needsQuestionSelection) {
        unmatchedBadge = document.createElement('span');
        unmatchedBadge.className = 'outcome-unmatched-badge';
        unmatchedBadge.textContent = '⚠️ Select questions';
        unmatchedBadge.title = 'Saved questions for this outcome did not match the questions in this assessment. Please select the matching questions below.';
      }

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-danger btn-sm';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        state.outcomes.splice(idx, 1);
        renderStep3Outcomes();
        renderStep3CoverageBanner();
        syncGenerationConfigUI();
        triggerAutoSave();
      });

      header.appendChild(nameInput);
      if (unmatchedBadge) header.appendChild(unmatchedBadge);
      header.appendChild(taggedBadge);
      header.appendChild(delBtn);

      const commentsGrid = document.createElement('div');
      commentsGrid.className = 'outcome-comments-grid';

      const achField = document.createElement('div');
      achField.className = 'outcome-comment-field';
      const achLabel = document.createElement('label');
      achLabel.style.color = 'var(--accent-achievement)';
      achLabel.textContent = 'Achievement (when >= cutoff)';
      const achArea = document.createElement('textarea');
      achArea.className = 'comment-textarea';
      achArea.rows = 2;
      achArea.placeholder = 'Enter achievement comment for this outcome...';
      achArea.value = outcome.achievement || '';
      const onAchUpdate = () => {
        outcome.achievement = achArea.value;
        renderStep3CoverageBanner();
        triggerAutoSave();
      };
      achArea.addEventListener('input', onAchUpdate);
      achArea.addEventListener('change', onAchUpdate);
      achField.appendChild(achLabel);
      achField.appendChild(achArea);

      const impField = document.createElement('div');
      impField.className = 'outcome-comment-field';
      const impLabel = document.createElement('label');
      impLabel.style.color = 'var(--accent-improvement)';
      impLabel.textContent = 'Improvement (when < cutoff)';
      const impArea = document.createElement('textarea');
      impArea.className = 'comment-textarea';
      impArea.rows = 2;
      impArea.placeholder = 'Enter improvement comment for this outcome...';
      impArea.value = outcome.improvement || '';
      const onImpUpdate = () => {
        outcome.improvement = impArea.value;
        renderStep3CoverageBanner();
        triggerAutoSave();
      };
      impArea.addEventListener('input', onImpUpdate);
      impArea.addEventListener('change', onImpUpdate);
      impField.appendChild(impLabel);
      impField.appendChild(impArea);

      commentsGrid.appendChild(achField);
      commentsGrid.appendChild(impField);

      const tagRow = document.createElement('div');
      tagRow.className = 'outcome-tag-row';
      const tagLabel = document.createElement('span');
      tagLabel.className = 'outcome-tag-label';
      tagLabel.textContent = 'Tag Questions:';
      const pillsWrap = document.createElement('div');
      pillsWrap.className = 'outcome-tag-pills';

      if (validQuestions.length === 0) {
        const emptyHint = document.createElement('span');
        emptyHint.style.fontSize = '0.78rem';
        emptyHint.style.color = 'var(--text-muted)';
        emptyHint.textContent = 'No questions loaded yet (upload a spreadsheet in Step 1).';
        pillsWrap.appendChild(emptyHint);
      } else {
        validQuestions.forEach(q => {
          const qKey = CommentEngine.getQuestionKey(q);
          const qDisplay = q.id || q.title || 'Q';
          const pillLabel = hasMultiSection && q.section && q.section !== 'General'
            ? `${q.section}: ${qDisplay}`
            : qDisplay;

          const pill = document.createElement('button');
          pill.type = 'button';
          pill.className = `outcome-q-pill ${taggedSet.has(qKey) ? 'selected' : ''}`;
          pill.textContent = pillLabel;
          pill.title = `${pillLabel} (${q.maxMarks || 1} marks)`;
          pill.addEventListener('click', () => {
            if (!Array.isArray(outcome.questionKeys)) outcome.questionKeys = [];
            const pos = outcome.questionKeys.indexOf(qKey);
            if (pos >= 0) {
              outcome.questionKeys.splice(pos, 1);
              pill.classList.remove('selected');
            } else {
              outcome.questionKeys.push(qKey);
              pill.classList.add('selected');
            }
            if (outcome.needsQuestionSelection && outcome.questionKeys.length > 0) {
              delete outcome.needsQuestionSelection;
              card.classList.remove('needs-question-selection');
              if (unmatchedBadge) unmatchedBadge.remove();
            }
            taggedBadge.textContent = `${outcome.questionKeys.length} Qs`;
            renderStep3CoverageBanner();
            triggerAutoSave();
          });
          pillsWrap.appendChild(pill);
        });
      }

      tagRow.appendChild(tagLabel);
      tagRow.appendChild(pillsWrap);

      card.appendChild(header);
      card.appendChild(commentsGrid);
      card.appendChild(tagRow);
      outcomesListEl.appendChild(card);
    });
  }

  btnBankModeQuestion?.addEventListener('click', () => setCommentBankMode('question'));
  btnBankModeOutcome?.addEventListener('click', () => setCommentBankMode('outcome'));
  btnChooseModeQuestion?.addEventListener('click', () => setCommentBankMode('question'));
  btnChooseModeOutcome?.addEventListener('click', () => setCommentBankMode('outcome'));
  btnCloseCommentModeModal?.addEventListener('click', () => {
    if (state.commentBankMode === null) {
      setCommentBankMode('question');
    } else if (commentModeModal) {
      commentModeModal.style.display = 'none';
    }
  });

  if (cfgOutcomeCutoff) {
    const onCutoffChange = () => {
      const val = Math.max(0, Math.min(100, parseFloat(cfgOutcomeCutoff.value) || 0));
      state.generationConfig.outcomeMasteryCutoff = val;
      triggerAutoSave();
    };
    cfgOutcomeCutoff.addEventListener('input', onCutoffChange);
    cfgOutcomeCutoff.addEventListener('change', onCutoffChange);
  }

  function handleAddOutcomeAndScroll() {
    addEmptyOutcome();
    renderStep3Outcomes();
    renderStep3CoverageBanner();
    syncGenerationConfigUI();
    triggerAutoSave();
    requestAnimationFrame(() => {
      if (!outcomesListEl) return;
      const cards = outcomesListEl.querySelectorAll('.outcome-card');
      const lastCard = cards[cards.length - 1];
      if (lastCard) {
        lastCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = lastCard.querySelector('.outcome-name-input');
        if (input) input.focus({ preventScroll: true });
      }
    });
  }

  btnAddOutcome?.addEventListener('click', handleAddOutcomeAndScroll);
  btnAddOutcomeBottom?.addEventListener('click', handleAddOutcomeAndScroll);
  btnClearOutcomes?.addEventListener('click', async () => {
    if (state.outcomes.length === 0) return;
    const ok = await UIHelpers.showConfirmModal({
      title: 'Clear All Outcomes',
      message: `Are you sure you want to clear all ${state.outcomes.length} outcome(s) and their comments?`,
      confirmText: 'Clear Outcomes',
      danger: true
    });
    if (ok) {
      state.outcomes = [];
      renderStep3Outcomes();
      renderStep3CoverageBanner();
      syncGenerationConfigUI();
      triggerAutoSave();
      UIHelpers.showToast('Cleared all outcomes.', 'info');
    }
  });

  function closeBulkOutcomeModal() {
    if (bulkOutcomeModal) bulkOutcomeModal.style.display = 'none';
  }

  function updateBulkOutcomePreview() {
    if (!bulkOutcomeTextarea || !bulkOutcomePreviewText) return;
    const parsed = CommentEngine.parseBulkOutcomesText(bulkOutcomeTextarea.value);
    bulkOutcomePreviewText.textContent = `${parsed.length} outcome${parsed.length === 1 ? '' : 's'} detected`;
  }

  btnBulkPasteOutcomes?.addEventListener('click', () => {
    if (bulkOutcomeTextarea) bulkOutcomeTextarea.value = '';
    updateBulkOutcomePreview();
    if (bulkOutcomeModal) bulkOutcomeModal.style.display = 'flex';
    setTimeout(() => bulkOutcomeTextarea?.focus(), 40);
  });
  btnCloseBulkOutcomeModal?.addEventListener('click', closeBulkOutcomeModal);
  btnCancelBulkOutcome?.addEventListener('click', closeBulkOutcomeModal);
  bulkOutcomeTextarea?.addEventListener('input', updateBulkOutcomePreview);
  bulkOutcomeTextarea?.addEventListener('change', updateBulkOutcomePreview);

  btnSubmitBulkOutcome?.addEventListener('click', () => {
    const parsed = CommentEngine.parseBulkOutcomesText(bulkOutcomeTextarea ? bulkOutcomeTextarea.value : '');
    if (parsed.length === 0) {
      UIHelpers.showToast('No valid outcomes detected. Format: Outcome, Achievement, Improvement', 'warning');
      return;
    }

    if (
      state.outcomes.length === 1 &&
      !(state.outcomes[0].name || '').trim() &&
      !(state.outcomes[0].achievement || '').trim() &&
      !(state.outcomes[0].improvement || '').trim() &&
      (!Array.isArray(state.outcomes[0].questionKeys) || state.outcomes[0].questionKeys.length === 0)
    ) {
      state.outcomes = [];
    }

    parsed.forEach((item, idx) => {
      state.outcomes.push({
        id: `out_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        name: item.name,
        achievement: item.achievement,
        improvement: item.improvement,
        questionKeys: []
      });
    });

    closeBulkOutcomeModal();
    renderStep3Outcomes();
    renderStep3CoverageBanner();
    syncGenerationConfigUI();
    triggerAutoSave();
    UIHelpers.showToast(`Imported ${parsed.length} outcome(s).`, 'success');
  });

  function exportOutcomeBank() {
    if (!state.outcomes || state.outcomes.length === 0) {
      UIHelpers.showToast('No outcomes to export.', 'warning');
      return;
    }

    const validQuestions = (state.questions || []).filter(q => !q.isSectionBreak && q.included !== false);
    const labelByKey = {};
    validQuestions.forEach(q => {
      labelByKey[CommentEngine.getQuestionKey(q)] = q.id || q.title || '';
    });

    const assessName = StorageService.getAssessmentById(currentClassId, currentAssessmentId)?.name || 'Assessment';
    const payload = {
      version: '1.0',
      exportType: 'outcome_comment_bank',
      timestamp: Date.now(),
      exportedAt: new Date().toISOString(),
      outcomeMasteryCutoff: state.generationConfig.outcomeMasteryCutoff ?? 70,
      outcomes: state.outcomes.map(o => {
        const qKeys = Array.isArray(o.questionKeys) ? [...o.questionKeys] : [];
        return {
          id: o.id,
          name: o.name || '',
          achievement: o.achievement || '',
          improvement: o.improvement || '',
          questionKeys: qKeys,
          questionLabels: qKeys.map(k => labelByKey[k] || (k.split('::')[1] || k))
        };
      })
    };

    const safeAssess = assessName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    StorageService.downloadJSON(payload, `Outcome_Bank_${safeAssess}_${dateStr}.json`);
    UIHelpers.showToast('Outcome bank exported.', 'success');
  }

  async function importOutcomeBankFromParsed(parsed, forcedMode = null) {
    if (!parsed || !Array.isArray(parsed.outcomes) || parsed.outcomes.length === 0) {
      UIHelpers.showToast('Invalid Outcome Bank JSON file: no outcomes found.', 'danger');
      return;
    }

    const hasNonEmptyExisting = state.outcomes.some(o =>
      (o.name || '').trim() ||
      (o.achievement || '').trim() ||
      (o.improvement || '').trim() ||
      (Array.isArray(o.questionKeys) && o.questionKeys.length > 0)
    );

    let replaceMode = true;
    if (forcedMode) {
      replaceMode = (forcedMode === 'replace');
    } else if (hasNonEmptyExisting) {
      const choice = await UIHelpers.showChoiceModal({
        title: 'Import Outcome Comment Bank',
        message: 'Choose whether to merge with your existing outcomes or replace them:',
        choices: [
          { id: 'merge', label: 'Merge Outcomes (Recommended)', description: 'Keep existing outcomes and append imported ones.' },
          { id: 'replace', label: 'Replace Existing Outcomes', description: 'Clear existing outcomes before importing.' }
        ]
      });
      if (!choice) return;
      replaceMode = (choice === 'replace');
    }

    const validQuestions = (state.questions || []).filter(q => !q.isSectionBreak && q.included !== false);
    const validKeySet = new Set();
    const keyByIdLower = {};
    validQuestions.forEach(q => {
      const k = CommentEngine.getQuestionKey(q);
      validKeySet.add(k);
      const idLower = String(q.id || q.title || '').trim().toLowerCase();
      if (idLower && !keyByIdLower[idLower]) {
        keyByIdLower[idLower] = k;
      }
    });

    const unmatchedOutcomeNames = [];
    const importedOutcomes = parsed.outcomes.map((inO, idx) => {
      const rawKeys = Array.isArray(inO.questionKeys) ? inO.questionKeys : [];
      const rawLabels = Array.isArray(inO.questionLabels) ? inO.questionLabels : [];
      const candidateTokens = rawKeys.length > 0 ? rawKeys : rawLabels;

      const matchedKeys = [];
      let hadUnmatched = false;

      candidateTokens.forEach((tok, tIdx) => {
        const strTok = String(tok || '').trim().toLowerCase();
        if (!strTok) return;
        if (validKeySet.has(strTok)) {
          if (!matchedKeys.includes(strTok)) matchedKeys.push(strTok);
          return;
        }
        const idPart = strTok.includes('::') ? strTok.split('::')[1] : strTok;
        const labelFallback = rawLabels[tIdx] ? String(rawLabels[tIdx]).trim().toLowerCase() : idPart;
        const resolved = keyByIdLower[idPart] || keyByIdLower[labelFallback];
        if (resolved) {
          if (!matchedKeys.includes(resolved)) matchedKeys.push(resolved);
        } else {
          hadUnmatched = true;
        }
      });

      const needsSelection = hadUnmatched || (validQuestions.length > 0 && matchedKeys.length === 0);
      const outcomeName = (inO.name || '').trim() || `Outcome ${idx + 1}`;
      if (needsSelection) {
        unmatchedOutcomeNames.push(outcomeName);
      }

      return {
        id: inO.id || `out_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        name: inO.name || '',
        achievement: inO.achievement || '',
        improvement: inO.improvement || '',
        questionKeys: matchedKeys,
        ...(needsSelection ? { needsQuestionSelection: true } : {})
      };
    });

    if (typeof parsed.outcomeMasteryCutoff === 'number' && !isNaN(parsed.outcomeMasteryCutoff)) {
      state.generationConfig.outcomeMasteryCutoff = Math.max(0, Math.min(100, parsed.outcomeMasteryCutoff));
    }

    if (replaceMode) {
      state.outcomes = importedOutcomes;
    } else {
      state.outcomes.push(...importedOutcomes);
    }

    state.commentBankMode = 'outcome';
    state.generationConfig.commentSourceMode = 'outcome';
    renderStep3CommentBank();
    syncGenerationConfigUI();
    triggerAutoSave();

    if (unmatchedOutcomeNames.length > 0) {
      requestAnimationFrame(() => {
        const firstFlagged = outcomesListEl ? outcomesListEl.querySelector('.outcome-card.needs-question-selection') : null;
        if (firstFlagged) firstFlagged.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      UIHelpers.showToast(
        `Imported ${importedOutcomes.length} outcome(s). Please tag questions for ${unmatchedOutcomeNames.length} highlighted outcome(s).`,
        'warning',
        5500
      );
    } else {
      UIHelpers.showToast(`Outcome Comment Bank imported (${importedOutcomes.length} outcomes).`, 'success');
    }
  }

  btnExportOutcomeBank?.addEventListener('click', exportOutcomeBank);
  if (btnImportOutcomeBank && importOutcomeBankInput) {
    btnImportOutcomeBank.addEventListener('click', () => {
      importOutcomeBankInput.value = '';
      importOutcomeBankInput.click();
    });
    importOutcomeBankInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          importOutcomeBankFromParsed(parsed);
        } catch (err) {
          UIHelpers.showToast(`Failed to import Outcome Bank JSON: ${err.message}`, 'danger');
        }
      };
      reader.readAsText(file);
    });
  }

  // Render Comment Cards with In-Place Edit & Delete
  function buildCommentCardElement(item, category) {
    const parsed = CommentEngine.parseCommentEntry(item);
    item.text = parsed.text;
    item.questionIds = parsed.questionIds;
    item.questionId = parsed.questionId;
    item.tags = parsed.tags || [];

    const card = document.createElement('div');
    card.className = 'comment-card';

    if (editingCommentId === item.id) {
      const sectionQuestions = getQuestionsForSection(activeCommentBankSection);
      const selectedQSet = new Set(item.questionIds || []);
      const pillsHtml = sectionQuestions.map(q => {
        const qId = q.id || q.title;
        return `<button type="button" class="composer-q-pill ${selectedQSet.has(qId) ? 'selected' : ''}" data-qid="${esc(qId)}">${esc(qId)}</button>`;
      }).join('');

      card.innerHTML = `
        <div class="comment-card-edit-form">
          ${sectionQuestions.length > 0 ? `
            <div class="composer-q-pills">
              <span style="font-size: 0.73rem; font-weight: 700; color: var(--text-muted); margin-right: 0.2rem;">Questions:</span>
              ${pillsHtml}
            </div>
          ` : ''}
          <textarea class="comment-textarea edit-comment-text" rows="2" style="min-height: 60px; padding: 0.5rem 0.65rem;">${esc(item.text)}</textarea>
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <input type="text" class="form-control edit-comment-tags" style="max-width: 190px; padding: 0.3rem 0.55rem; font-size: 0.76rem;" value="${esc((item.tags || []).join(', '))}" placeholder="Tags (comma-separated)...">
            <div style="display: flex; gap: 0.35rem;">
              <button type="button" class="btn btn-secondary btn-sm btn-cancel-edit">Cancel</button>
              <button type="button" class="btn btn-primary btn-sm btn-save-edit">Save</button>
            </div>
          </div>
        </div>
      `;

      card.querySelectorAll('.composer-q-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          const qId = pill.getAttribute('data-qid');
          if (selectedQSet.has(qId)) {
            selectedQSet.delete(qId);
            pill.classList.remove('selected');
          } else {
            selectedQSet.add(qId);
            pill.classList.add('selected');
          }
        });
      });

      card.querySelector('.btn-cancel-edit')?.addEventListener('click', () => {
        editingCommentId = null;
        renderStep3CommentBank();
      });

      card.querySelector('.btn-save-edit')?.addEventListener('click', () => {
        const newRawText = (card.querySelector('.edit-comment-text')?.value || '').trim();
        if (!newRawText) return;
        const reParsed = CommentEngine.parseCommentEntry(newRawText);
        const pillQIds = Array.from(selectedQSet);
        const finalQIds = pillQIds.length > 0 ? pillQIds : (reParsed.questionIds || []);
        const newTags = (card.querySelector('.edit-comment-tags')?.value || '').split(',').map(t => t.trim()).filter(Boolean);

        if (category === 'achievements') {
          commentBank.updateAchievement(item.id, {
            text: reParsed.text,
            questionIds: finalQIds,
            tags: newTags
          });
        } else {
          commentBank.updateImprovement(item.id, {
            text: reParsed.text,
            questionIds: finalQIds,
            tags: newTags
          });
        }

        editingCommentId = null;
        renderStep3CommentBank();
        triggerAutoSave();
        UIHelpers.showToast('Comment updated.', 'success');
      });

      return card;
    }

    const qDisplay = (item.questionIds && item.questionIds.length > 0) ? item.questionIds.join(', ') : item.questionId;
    const qLink = qDisplay ? `<span class="tag-pill" style="background: var(--primary-light); color: var(--primary-text); font-weight: 700;">Question ${esc(qDisplay)}</span>` : '';
    const secPill = item.section && item.section !== 'General' ? `<span class="tag-pill">${esc(item.section)}</span>` : '';

    card.innerHTML = `
      <div class="comment-card-content">
        <div>${esc(item.text)}</div>
        <div class="tag-list">
          ${qLink}
          ${secPill}
          ${(item.tags || []).map(t => `<span class="tag-pill">${esc(t)}</span>`).join('')}
        </div>
      </div>
      <div class="comment-card-actions">
        <button type="button" class="btn btn-secondary btn-sm btn-edit-comment" title="Edit comment" style="padding: 0.32rem 0.45rem;">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
        </button>
        <button type="button" class="btn btn-danger btn-sm btn-del-comment" title="Remove comment" style="padding: 0.32rem 0.45rem;">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"></path></svg>
        </button>
      </div>
    `;

    card.querySelector('.btn-edit-comment')?.addEventListener('click', () => {
      editingCommentId = item.id;
      renderStep3CommentBank();
    });

    card.querySelector('.btn-del-comment')?.addEventListener('click', () => {
      if (category === 'achievements') {
        commentBank.deleteAchievement(item.id);
      } else {
        commentBank.deleteImprovement(item.id);
      }
      renderStep3CommentBank();
      triggerAutoSave();
    });

    return card;
  }

  function renderStep3CommentBank() {
    const isOutcomeMode = state.commentBankMode === 'outcome';
    if (btnBankModeQuestion) btnBankModeQuestion.classList.toggle('active', !isOutcomeMode);
    if (btnBankModeOutcome) btnBankModeOutcome.classList.toggle('active', isOutcomeMode);
    if (questionBankContainer) questionBankContainer.style.display = isOutcomeMode ? 'none' : 'block';
    if (outcomeBankContainer) outcomeBankContainer.style.display = isOutcomeMode ? 'block' : 'none';

    renderStep3CoverageBanner();
    renderStep3Outcomes();
    updateWizardStepBadges();

    if (!achievementsList || !improvementsList) return;

    const sections = getAssessmentSections();
    if (!sections.includes(activeCommentBankSection)) {
      activeCommentBankSection = sections[0] || 'General';
    }

    if (sectionTabs) {
      sectionTabs.innerHTML = '';
      sections.forEach(sec => {
        const achs = commentBank.getAchievementsBySection(sec);
        const imps = commentBank.getImprovementsBySection(sec);
        const count = achs.length + imps.length;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `section-tab-btn ${sec === activeCommentBankSection ? 'active' : ''}`;
        btn.setAttribute('data-section', sec);
        btn.innerHTML = `
          <span>${esc(sec === 'General' ? 'General Comments' : sec)}</span>
          <span class="tab-count">${count}</span>
        `;
        btn.addEventListener('click', () => {
          activeCommentBankSection = sec;
          editingCommentId = null;
          if (achieveComposer) achieveComposer.style.display = 'none';
          if (improveComposer) improveComposer.style.display = 'none';
          renderStep3CommentBank();
        });
        sectionTabs.appendChild(btn);
      });
    }

    const filteredAchievements = commentBank.getAchievementsBySection(activeCommentBankSection);
    const filteredImprovements = commentBank.getImprovementsBySection(activeCommentBankSection);

    if (achieveCount) achieveCount.textContent = filteredAchievements.length;
    if (improveCount) improveCount.textContent = filteredImprovements.length;

    achievementsList.innerHTML = '';
    if (filteredAchievements.length === 0) {
      achievementsList.innerHTML = `<div style="padding: 1.25rem; text-align: center; color: var(--text-muted); font-size: 0.84rem;">No achievement comments in [${esc(activeCommentBankSection)}] yet. Click <strong>+ Add</strong> or <strong>Bulk Paste</strong>.</div>`;
    } else {
      filteredAchievements.forEach(item => {
        achievementsList.appendChild(buildCommentCardElement(item, 'achievements'));
      });
    }

    improvementsList.innerHTML = '';
    if (filteredImprovements.length === 0) {
      improvementsList.innerHTML = `<div style="padding: 1.25rem; text-align: center; color: var(--text-muted); font-size: 0.84rem;">No improvement comments in [${esc(activeCommentBankSection)}] yet. Click <strong>+ Add</strong> or <strong>Bulk Paste</strong>.</div>`;
    } else {
      filteredImprovements.forEach(item => {
        improvementsList.appendChild(buildCommentCardElement(item, 'improvements'));
      });
    }
  }

  // Clear & Export/Import Handlers for Question Comment Bank
  btnClearSectionAchieve?.addEventListener('click', async () => {
    const secLabel = activeCommentBankSection === 'General' ? 'General Comments' : activeCommentBankSection;
    const count = commentBank.getAchievementsBySection(activeCommentBankSection).length;
    if (count === 0) return;
    const ok = await UIHelpers.showConfirmModal({
      title: 'Clear Section Achievements',
      message: `Clear all ${count} achievement comment(s) in [${secLabel}]?`,
      confirmText: 'Clear Achievements',
      danger: true
    });
    if (ok) {
      commentBank.clearSectionAchievements(activeCommentBankSection);
      renderStep3CommentBank();
      triggerAutoSave();
      UIHelpers.showToast(`Cleared achievements in [${secLabel}].`, 'info');
    }
  });

  btnClearSectionImprove?.addEventListener('click', async () => {
    const secLabel = activeCommentBankSection === 'General' ? 'General Comments' : activeCommentBankSection;
    const count = commentBank.getImprovementsBySection(activeCommentBankSection).length;
    if (count === 0) return;
    const ok = await UIHelpers.showConfirmModal({
      title: 'Clear Section Improvements',
      message: `Clear all ${count} improvement comment(s) in [${secLabel}]?`,
      confirmText: 'Clear Improvements',
      danger: true
    });
    if (ok) {
      commentBank.clearSectionImprovements(activeCommentBankSection);
      renderStep3CommentBank();
      triggerAutoSave();
      UIHelpers.showToast(`Cleared improvements in [${secLabel}].`, 'info');
    }
  });

  btnClearActiveSection?.addEventListener('click', async () => {
    const secLabel = activeCommentBankSection === 'General' ? 'General Comments' : activeCommentBankSection;
    const total = commentBank.getAchievementsBySection(activeCommentBankSection).length +
      commentBank.getImprovementsBySection(activeCommentBankSection).length;
    if (total === 0) return;
    const ok = await UIHelpers.showConfirmModal({
      title: 'Clear Active Section',
      message: `Are you sure you want to clear all ${total} comments in [${secLabel}]?`,
      confirmText: 'Clear Section',
      danger: true
    });
    if (ok) {
      commentBank.clearSection(activeCommentBankSection);
      renderStep3CommentBank();
      triggerAutoSave();
      UIHelpers.showToast(`Cleared all comments in [${secLabel}].`, 'info');
    }
  });

  btnClearAllCommentBanks?.addEventListener('click', async () => {
    const total = commentBank.achievements.length + commentBank.improvements.length;
    if (total === 0) return;
    const ok = await UIHelpers.showConfirmModal({
      title: 'Clear Entire Comment Bank',
      message: `Are you sure you want to clear ALL ${total} comments across ALL sections? This cannot be undone.`,
      confirmText: 'Clear All Comments',
      danger: true
    });
    if (ok) {
      commentBank.clearAll();
      renderStep3CommentBank();
      triggerAutoSave();
      UIHelpers.showToast('Cleared entire comment bank.', 'info');
    }
  });

  btnExportCommentBank?.addEventListener('click', async () => {
    const assessName = StorageService.getAssessmentById(currentClassId, currentAssessmentId)?.name || 'Assessment';
    const secLabel = activeCommentBankSection === 'General' ? 'General Comments' : activeCommentBankSection;
    const choice = await UIHelpers.showChoiceModal({
      title: 'Export Comment Bank',
      message: 'Choose which comments to include in the exported JSON file:',
      choices: [
        { id: 'all', label: 'Export All Sections (Recommended)', description: 'Include comments across every section in this assessment.' },
        { id: 'active', label: `Export Only [${secLabel}]`, description: `Export only comments in the active [${secLabel}] tab.` }
      ]
    });
    if (!choice) return;
    const targetSec = choice === 'active' ? activeCommentBankSection : 'All';
    commentBank.downloadJSON(targetSec, assessName);
    UIHelpers.showToast('Comment bank exported.', 'success');
  });

  if (btnImportCommentBank && importCommentBankInput) {
    btnImportCommentBank.addEventListener('click', () => {
      importCommentBankInput.value = '';
      importCommentBankInput.click();
    });

    importCommentBankInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (parsed.exportType === 'outcome_comment_bank' || Array.isArray(parsed.outcomes)) {
            await importOutcomeBankFromParsed(parsed);
            return;
          }
          const fileSec = (parsed.section && parsed.section !== 'All') ? parsed.section : null;
          const targetSec = fileSec || activeCommentBankSection;
          const secLabel = targetSec === 'General' ? 'General Comments' : targetSec;
          const mode = await UIHelpers.showChoiceModal({
            title: `Import Comment Bank into [${secLabel}]`,
            message: 'Choose how to import comments from this file:',
            choices: [
              { id: 'merge', label: 'Merge Comments (Recommended)', description: 'Keep existing comments and append new unique ones.' },
              { id: 'replace', label: 'Replace Section Comments', description: `Clear existing comments in [${secLabel}] before importing.` }
            ]
          });
          if (!mode) return;
          const res = commentBank.importFromJSON(parsed, mode, targetSec);
          if (res.success) {
            if (fileSec) activeCommentBankSection = fileSec;
            renderStep3CommentBank();
            triggerAutoSave();
            UIHelpers.showToast(`Imported ${res.achievementsAdded} achievements & ${res.improvementsAdded} improvements.`, 'success');
          } else {
            UIHelpers.showToast(`Failed to import comment bank: ${res.message}`, 'danger');
          }
        } catch (err) {
          console.error('Comment bank import error:', err);
          UIHelpers.showToast(`Failed to import comment bank JSON: ${err.message}`, 'danger');
        }
      };
      reader.readAsText(file);
    });
  }

  btnGotoStep4?.addEventListener('click', () => showStep(4));

  // --- Step 4: Generation Settings, Section Priority Board, Student Cards & Exports ---
  function updateConfigSummaryBadge() {
    if (!configSummaryBadge) return;
    const cfg = state.generationConfig || {};
    const total = cfg.totalComments ?? 6;
    const isScoreTiers = cfg.enableScoreTiers === true;
    const isPerfMode = cfg.commentPriorityMode === 'performance';
    const hasOutcomes = Array.isArray(state.outcomes) && state.outcomes.length > 0;
    const isOutcomeSource = hasOutcomes && cfg.commentSourceMode === 'outcome';
    const isSecPriority = !isPerfMode && !isOutcomeSource && cfg.enableSectionPriority === true;

    const sourcePart = isOutcomeSource ? ' • Outcome-Based' : '';
    const secPart = `${sourcePart}${isPerfMode ? ' • Performance-Based' : (isSecPriority ? ' • Section-Prioritized' : '')}`;
    if (!isScoreTiers) {
      const ach = Math.max(1, Math.ceil(total / 2));
      const imp = Math.max(1, total - ach);
      configSummaryBadge.textContent = `${total} Comments per student (${ach} Str, ${imp} Gro) • Uniform${secPart}`;
      return;
    }

    const minAch = cfg.minAchievements ?? 1;
    const maxAch = cfg.maxAchievements ?? 4;
    const minImp = cfg.minImprovements ?? 1;
    const maxImp = cfg.maxImprovements ?? 4;
    const high = cfg.highThreshold ?? 70;
    const mid = cfg.midThreshold ?? 50;
    configSummaryBadge.textContent = `${total} Comments (${minAch}-${maxAch} Str, ${minImp}-${maxImp} Gro) • Score-Differentiated (≥${high}% / <${mid}%)${secPart}`;
  }

  function toggleGenerationConfigCard(forceOpen) {
    if (!generationConfigCard) return;
    const isCurrentlyCollapsed = generationConfigCard.classList.contains('collapsed');
    const shouldBeCollapsed = forceOpen === undefined ? !isCurrentlyCollapsed : !forceOpen;

    if (shouldBeCollapsed) {
      generationConfigCard.classList.add('collapsed');
      if (btnToggleConfigCard) {
        btnToggleConfigCard.setAttribute('aria-expanded', 'false');
        btnToggleConfigCard.setAttribute('title', 'Expand settings');
      }
      if (configSummaryBadge) {
        updateConfigSummaryBadge();
        configSummaryBadge.style.display = 'inline-flex';
      }
    } else {
      generationConfigCard.classList.remove('collapsed');
      if (btnToggleConfigCard) {
        btnToggleConfigCard.setAttribute('aria-expanded', 'true');
        btnToggleConfigCard.setAttribute('title', 'Collapse settings');
      }
      if (configSummaryBadge) {
        configSummaryBadge.style.display = 'none';
      }
    }
  }

  function syncGenerationConfigUI() {
    if (!cfgTotalComments) return;
    const cfg = state.generationConfig || {};
    cfgTotalComments.value = cfg.totalComments ?? 6;

    const isScoreTiers = cfg.enableScoreTiers === true;
    if (cfgEnableScoreTiers) cfgEnableScoreTiers.checked = isScoreTiers;
    if (cfgScoreTiersStatusBadge) cfgScoreTiersStatusBadge.textContent = isScoreTiers ? 'On' : 'Off';
    if (advancedScoreSettingsContainer) {
      advancedScoreSettingsContainer.style.display = isScoreTiers ? 'block' : 'none';
    }

    const isPerfMode = cfg.commentPriorityMode === 'performance';
    const isSectionPriority = cfg.enableSectionPriority === true;
    const hasOutcomes = Array.isArray(state.outcomes) && state.outcomes.length > 0;
    const showSourceToggle = hasOutcomes || state.commentBankMode === 'outcome';
    const isOutcomeSource = showSourceToggle && cfg.commentSourceMode === 'outcome';

    if (commentSourceRow) commentSourceRow.style.display = showSourceToggle ? 'inline-flex' : 'none';
    if (btnSourceQuestion) btnSourceQuestion.classList.toggle('active', !isOutcomeSource);
    if (btnSourceOutcome) btnSourceOutcome.classList.toggle('active', isOutcomeSource);

    if (btnModeSection) btnModeSection.classList.toggle('active', !isPerfMode);
    if (btnModePerformance) btnModePerformance.classList.toggle('active', isPerfMode);
    if (sectionPriorityControls) {
      sectionPriorityControls.style.display = (isPerfMode || isOutcomeSource) ? 'none' : 'block';
    }
    if (performanceModeHint) {
      performanceModeHint.style.display = isPerfMode ? 'block' : 'none';
      if (isPerfMode) {
        performanceModeHint.textContent = isOutcomeSource
          ? 'Prioritises hardest outcomes mastered (lowest class %) for strengths and easiest missed outcomes (highest class %) for growth.'
          : 'Prioritises hardest questions mastered (lowest class %) for strengths and easiest missed questions (highest class %) for growth.';
      }
    }
    if (cfgEnableSectionPriority) cfgEnableSectionPriority.checked = isSectionPriority;
    if (cfgSectionPriorityStatusBadge) {
      const modeLabel = isPerfMode
        ? 'Performance Based'
        : (isOutcomeSource ? 'Random' : (isSectionPriority ? 'Section Priority' : 'Random'));
      cfgSectionPriorityStatusBadge.textContent = isOutcomeSource ? `Outcome • ${modeLabel}` : modeLabel;
    }
    if (sectionPriorityBoardContainer) {
      sectionPriorityBoardContainer.style.display = (!isPerfMode && !isOutcomeSource && isSectionPriority) ? 'block' : 'none';
    }
    if (sectionRankingBreadcrumb) {
      sectionRankingBreadcrumb.style.display = (!isPerfMode && !isOutcomeSource && isSectionPriority) ? 'inline-flex' : 'none';
    }

    if (cfgMinAch) cfgMinAch.value = cfg.minAchievements ?? 1;
    if (cfgMaxAch) cfgMaxAch.value = cfg.maxAchievements ?? 4;
    if (cfgMinImp) cfgMinImp.value = cfg.minImprovements ?? 1;
    if (cfgMaxImp) cfgMaxImp.value = cfg.maxImprovements ?? 4;
    if (cfgHighThreshold) cfgHighThreshold.value = cfg.highThreshold ?? 70;
    if (cfgMidThreshold) cfgMidThreshold.value = cfg.midThreshold ?? 50;

    updateConfigSummaryBadge();
    updateConfigPreview();
    syncSectionRanking();
  }

  function updateConfigPreview() {
    const cfg = state.generationConfig || {};
    const total = cfg.totalComments ?? 6;
    const isScoreTiers = cfg.enableScoreTiers === true;
    const highThreshold = cfg.highThreshold !== undefined ? parseInt(cfg.highThreshold, 10) : 70;
    const midThreshold = cfg.midThreshold !== undefined ? parseInt(cfg.midThreshold, 10) : 50;

    const sampleHigh = Math.min(100, Math.max(highThreshold, highThreshold + 5));
    const sampleMid = Math.round((highThreshold + midThreshold) / 2);
    const sampleLow = Math.max(0, midThreshold - 10);

    const high = CommentEngine.getTargetDistribution(sampleHigh, cfg);
    const mid = CommentEngine.getTargetDistribution(sampleMid, cfg);
    const low = CommentEngine.getTargetDistribution(sampleLow, cfg);

    const lblTierHighAch = document.getElementById('lblTierHighAch');
    const lblTierHighImp = document.getElementById('lblTierHighImp');
    const tierHighTotal = document.getElementById('tierHighTotal');

    const lblTierMidAch = document.getElementById('lblTierMidAch');
    const lblTierMidImp = document.getElementById('lblTierMidImp');
    const tierMidTotal = document.getElementById('tierMidTotal');

    const lblTierLowAch = document.getElementById('lblTierLowAch');
    const lblTierLowImp = document.getElementById('lblTierLowImp');
    const tierLowTotal = document.getElementById('tierLowTotal');

    const configModeDescText = document.getElementById('configModeDescText');
    const configWarningBanner = document.getElementById('configWarningBanner');

    if (badgeTierHigh) badgeTierHigh.innerHTML = `High Scores (&ge;${highThreshold}%)`;
    if (badgeTierMid) badgeTierMid.innerHTML = `Mid Scores (${midThreshold}&ndash;${highThreshold - 1}%)`;
    if (badgeTierLow) badgeTierLow.innerHTML = `Growth Focus (&lt;${midThreshold}%)`;

    if (lblTierHighAch && lblTierHighImp) {
      lblTierHighAch.textContent = high.targetAch;
      lblTierHighImp.textContent = high.targetImp;
      if (tierHighTotal) tierHighTotal.textContent = `${high.targetAch + high.targetImp} comments`;
    }
    if (lblTierMidAch && lblTierMidImp) {
      lblTierMidAch.textContent = mid.targetAch;
      lblTierMidImp.textContent = mid.targetImp;
      if (tierMidTotal) tierMidTotal.textContent = `${mid.targetAch + mid.targetImp} comments`;
    }
    if (lblTierLowAch && lblTierLowImp) {
      lblTierLowAch.textContent = low.targetAch;
      lblTierLowImp.textContent = low.targetImp;
      if (tierLowTotal) tierLowTotal.textContent = `${low.targetAch + low.targetImp} comments`;
    }

    if (configModeDescText) {
      configModeDescText.textContent = isScoreTiers ? 'Method: Score-Differentiated Tiers' : 'Method: Uniform Target (Balanced)';
    }

    if (configWarningBanner) {
      if (isScoreTiers) {
        const minSum = (cfg.minAchievements ?? 1) + (cfg.minImprovements ?? 1);
        const maxSum = (cfg.maxAchievements ?? 4) + (cfg.maxImprovements ?? 4);
        if (midThreshold >= highThreshold) {
          configWarningBanner.textContent = `Warning: The Growth Focus cutoff (${midThreshold}%) must be lower than the High Score cutoff (${highThreshold}%).`;
          configWarningBanner.style.display = 'block';
        } else if (minSum > total) {
          configWarningBanner.textContent = `Note: Minimum strengths (${cfg.minAchievements}) + minimum growth (${cfg.minImprovements}) = ${minSum}, which exceeds the total comments target (${total}).`;
          configWarningBanner.style.display = 'block';
        } else if (total > maxSum) {
          configWarningBanner.textContent = `Note: Total comments (${total}) exceeds maximum strengths (${cfg.maxAchievements}) + maximum growth (${cfg.maxImprovements}) = ${maxSum}.`;
          configWarningBanner.style.display = 'block';
        } else {
          configWarningBanner.style.display = 'none';
        }
      } else {
        configWarningBanner.style.display = 'none';
      }
    }

    updateConfigSummaryBadge();
  }

  function getAvailableAssessmentSections() {
    const sectionsSet = new Set();
    (state.questions || []).forEach(q => {
      const sName = q.name || q.sectionName || q.title;
      if (q.isSectionBreak && sName && sName.trim()) {
        sectionsSet.add(sName.trim());
      } else if (q.section && q.section.trim() && q.section !== 'General') {
        sectionsSet.add(q.section.trim());
      }
    });

    (commentBank.achievements || []).forEach(a => {
      if (a.section && a.section.trim() && a.section !== 'General') sectionsSet.add(a.section.trim());
    });
    (commentBank.improvements || []).forEach(i => {
      if (i.section && i.section.trim() && i.section !== 'General') sectionsSet.add(i.section.trim());
    });

    const list = Array.from(sectionsSet);
    if (!list.includes('General')) list.push('General');
    return list;
  }

  function syncSectionRanking() {
    const available = getAvailableAssessmentSections();
    const normalized = CommentEngine.normalizeSectionTiers(state.sectionRanking, available);

    const filtered = [];
    normalized.forEach(tier => {
      const validInTier = tier.filter(sec => available.includes(sec));
      if (validInTier.length > 0) filtered.push(validInTier);
    });

    const placed = new Set();
    filtered.forEach(tier => tier.forEach(s => placed.add(s)));
    available.forEach(s => {
      if (s !== 'General' && !placed.has(s)) {
        if (filtered[0]) filtered[0].push(s);
        else filtered.push([s]);
        placed.add(s);
      }
    });
    if (!placed.has('General')) {
      if (filtered.length === 1) filtered[0].push('General');
      else filtered.push(['General']);
    }

    state.sectionRanking = filtered;
    renderSectionRankingUI();
  }

  let dragBoardState = { sec: null, sourceTier: null, sourceSec: null };

  function renderSectionRankingUI() {
    const board = document.getElementById('sectionPriorityBoard');
    const breadcrumb = document.getElementById('sectionRankingBreadcrumb');
    if (!board) return;

    if (!state.sectionRanking || state.sectionRanking.length === 0) {
      syncSectionRanking();
      return;
    }

    const tiers = state.sectionRanking;
    const totalTiers = tiers.length;

    const breadcrumbText = tiers.map(tier => Array.isArray(tier) ? tier.join(' = ') : tier).join(' > ');
    if (breadcrumb) {
      breadcrumb.textContent = `Priority: ${breadcrumbText || 'General'}`;
      breadcrumb.style.display = (state.generationConfig.enableSectionPriority === true) ? 'inline-flex' : 'none';
    }

    board.innerHTML = '';

    const topDropZone = document.createElement('div');
    topDropZone.className = 'tier-drop-zone';
    topDropZone.setAttribute('data-drop-action', 'create-tier-above');
    topDropZone.setAttribute('data-target-tier', '0');
    topDropZone.innerHTML = `
      <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"></path></svg>
      <span>Drag a section here to create Level 1 (Top Priority)</span>
    `;
    board.appendChild(topDropZone);

    tiers.forEach((tier, tierIdx) => {
      const isFirstTier = tierIdx === 0;
      const isLastTier = tierIdx === totalTiers - 1;
      const isMultiSection = tier.length > 1;
      const levelNumber = tierIdx + 1;

      const tierRow = document.createElement('div');
      tierRow.className = 'tier-level-row';
      tierRow.setAttribute('data-tier-idx', tierIdx);

      const statusTag = isMultiSection
        ? `<span class="tier-level-status">= Equal Priority (${tier.length} Sections)</span>`
        : '';

      tierRow.innerHTML = `
        <div class="tier-level-header">
          <div class="tier-level-title-wrap">
            <span class="tier-level-badge">${levelNumber}</span>
            <span class="tier-level-title">Level ${levelNumber}</span>
            ${statusTag}
          </div>
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <button type="button" class="btn-tier-shift btn-row-up" data-tier="${tierIdx}" ${isFirstTier ? 'disabled' : ''} title="Shift entire Level ${levelNumber} up">
              <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7"></path></svg>
              <span>Move Up</span>
            </button>
            <button type="button" class="btn-tier-shift btn-row-down" data-tier="${tierIdx}" ${isLastTier ? 'disabled' : ''} title="Shift entire Level ${levelNumber} down">
              <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"></path></svg>
              <span>Move Down</span>
            </button>
          </div>
        </div>
        <div class="tier-tiles-row" data-tier-idx="${tierIdx}"></div>
      `;

      const tilesContainer = tierRow.querySelector('.tier-tiles-row');

      tier.forEach((sec, secIdx) => {
        const achCountVal = commentBank.getAchievementsBySection(sec).length;
        const impCountVal = commentBank.getImprovementsBySection(sec).length;
        const totalCount = achCountVal + impCountVal;

        const tile = document.createElement('div');
        tile.className = 'section-tile';
        tile.setAttribute('draggable', 'true');
        tile.setAttribute('data-sec', sec);
        tile.setAttribute('data-tier-idx', tierIdx);
        tile.setAttribute('data-sec-idx', secIdx);

        const canMoveUp = !(tierIdx === 0 && tier.length === 1);
        const canMoveDown = !(tierIdx === totalTiers - 1 && tier.length === 1);

        tile.innerHTML = `
          <span class="tile-drag-handle" title="Drag to reorder or place in another level">⋮⋮</span>
          <div class="tile-content">
            <span class="tile-name">${esc(sec)}</span>
            <span class="tile-meta">${totalCount} comments</span>
          </div>
          <div class="tile-actions">
            <button type="button" class="btn-tile-action btn-tile-up" data-tier="${tierIdx}" data-sec-idx="${secIdx}" ${canMoveUp ? '' : 'disabled'} title="Move '${esc(sec)}' to level above">
              <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7"></path></svg>
            </button>
            <button type="button" class="btn-tile-action btn-tile-down" data-tier="${tierIdx}" data-sec-idx="${secIdx}" ${canMoveDown ? '' : 'disabled'} title="Move '${esc(sec)}' to level below">
              <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"></path></svg>
            </button>
          </div>
        `;

        tilesContainer.appendChild(tile);
      });

      board.appendChild(tierRow);

      const bottomDropZone = document.createElement('div');
      bottomDropZone.className = 'tier-drop-zone';
      bottomDropZone.setAttribute('data-drop-action', 'create-tier-below');
      bottomDropZone.setAttribute('data-target-tier', tierIdx);
      bottomDropZone.innerHTML = `
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"></path></svg>
        <span>Drag a section here to create Level ${levelNumber + 1} (Lower Priority)</span>
      `;
      board.appendChild(bottomDropZone);
    });

    board.querySelectorAll('.section-tile').forEach(tile => {
      tile.addEventListener('dragstart', (e) => {
        dragBoardState.sec = tile.getAttribute('data-sec');
        dragBoardState.sourceTier = parseInt(tile.getAttribute('data-tier-idx'), 10);
        dragBoardState.sourceSec = parseInt(tile.getAttribute('data-sec-idx'), 10);
        tile.classList.add('tile-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragBoardState.sec);
      });

      tile.addEventListener('dragend', () => {
        tile.classList.remove('tile-dragging');
        board.querySelectorAll('.drop-hover').forEach(el => el.classList.remove('drop-hover'));
        dragBoardState = { sec: null, sourceTier: null, sourceSec: null };
      });
    });

    board.querySelectorAll('.tier-drop-zone').forEach(dz => {
      dz.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        dz.classList.add('drop-hover');
      });
      dz.addEventListener('dragleave', () => dz.classList.remove('drop-hover'));
      dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('drop-hover');
        if (!dragBoardState.sec) return;

        const action = dz.getAttribute('data-drop-action');
        const targetTier = parseInt(dz.getAttribute('data-target-tier'), 10);

        const [movedSec] = state.sectionRanking[dragBoardState.sourceTier].splice(dragBoardState.sourceSec, 1);
        if (state.sectionRanking[dragBoardState.sourceTier].length === 0) {
          state.sectionRanking.splice(dragBoardState.sourceTier, 1);
        }

        if (action === 'create-tier-above') {
          state.sectionRanking.splice(targetTier, 0, [movedSec]);
        } else {
          const insertIdx = (dragBoardState.sourceTier < targetTier && state.sectionRanking.length <= targetTier)
            ? targetTier
            : targetTier + 1;
          state.sectionRanking.splice(insertIdx, 0, [movedSec]);
        }

        renderSectionRankingUI();
        triggerAutoSave();
      });
    });

    board.querySelectorAll('.tier-tiles-row').forEach(row => {
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.classList.add('drop-hover');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drop-hover'));
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drop-hover');
        if (!dragBoardState.sec) return;

        const targetTier = parseInt(row.getAttribute('data-tier-idx'), 10);
        if (targetTier === dragBoardState.sourceTier) return;

        const [movedSec] = state.sectionRanking[dragBoardState.sourceTier].splice(dragBoardState.sourceSec, 1);
        if (state.sectionRanking[dragBoardState.sourceTier].length === 0) {
          state.sectionRanking.splice(dragBoardState.sourceTier, 1);
        }

        const adjustedTarget = targetTier > dragBoardState.sourceTier && state.sectionRanking.length <= targetTier
          ? targetTier - 1
          : targetTier;
        state.sectionRanking[adjustedTarget].push(movedSec);

        renderSectionRankingUI();
        triggerAutoSave();
      });
    });

    board.querySelectorAll('.btn-tile-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tierIdx = parseInt(e.currentTarget.getAttribute('data-tier'), 10);
        const secIdx = parseInt(e.currentTarget.getAttribute('data-sec-idx'), 10);

        if (tierIdx === 0) {
          if (state.sectionRanking[0].length > 1) {
            const [sec] = state.sectionRanking[0].splice(secIdx, 1);
            state.sectionRanking.unshift([sec]);
            renderSectionRankingUI();
            triggerAutoSave();
          }
        } else {
          const [sec] = state.sectionRanking[tierIdx].splice(secIdx, 1);
          state.sectionRanking[tierIdx - 1].push(sec);
          if (state.sectionRanking[tierIdx].length === 0) state.sectionRanking.splice(tierIdx, 1);
          renderSectionRankingUI();
          triggerAutoSave();
        }
      });
    });

    board.querySelectorAll('.btn-tile-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tierIdx = parseInt(e.currentTarget.getAttribute('data-tier'), 10);
        const secIdx = parseInt(e.currentTarget.getAttribute('data-sec-idx'), 10);

        if (tierIdx === totalTiers - 1) {
          if (state.sectionRanking[tierIdx].length > 1) {
            const [sec] = state.sectionRanking[tierIdx].splice(secIdx, 1);
            state.sectionRanking.push([sec]);
            renderSectionRankingUI();
            triggerAutoSave();
          }
        } else {
          const [sec] = state.sectionRanking[tierIdx].splice(secIdx, 1);
          state.sectionRanking[tierIdx + 1].unshift(sec);
          if (state.sectionRanking[tierIdx].length === 0) state.sectionRanking.splice(tierIdx, 1);
          renderSectionRankingUI();
          triggerAutoSave();
        }
      });
    });

    board.querySelectorAll('.btn-row-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tierIdx = parseInt(e.currentTarget.getAttribute('data-tier'), 10);
        if (tierIdx > 0) {
          const [moved] = state.sectionRanking.splice(tierIdx, 1);
          state.sectionRanking.splice(tierIdx - 1, 0, moved);
          renderSectionRankingUI();
          triggerAutoSave();
        }
      });
    });

    board.querySelectorAll('.btn-row-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tierIdx = parseInt(e.currentTarget.getAttribute('data-tier'), 10);
        if (tierIdx < state.sectionRanking.length - 1) {
          const [moved] = state.sectionRanking.splice(tierIdx, 1);
          state.sectionRanking.splice(tierIdx + 1, 0, moved);
          renderSectionRankingUI();
          triggerAutoSave();
        }
      });
    });
  }

  function setupGenerationConfigListeners() {
    btnToggleConfigCard?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGenerationConfigCard();
    });

    configCardHeader?.addEventListener('click', (e) => {
      if (e.target.closest('button, input, select, .section-ranking-container')) return;
      toggleGenerationConfigCard();
    });

    cfgEnableScoreTiers?.addEventListener('change', () => {
      state.generationConfig.enableScoreTiers = cfgEnableScoreTiers.checked;
      if (cfgScoreTiersStatusBadge) cfgScoreTiersStatusBadge.textContent = cfgEnableScoreTiers.checked ? 'On' : 'Off';
      if (advancedScoreSettingsContainer) advancedScoreSettingsContainer.style.display = cfgEnableScoreTiers.checked ? 'block' : 'none';
      updateConfigSummaryBadge();
      updateConfigPreview();
      triggerAutoSave();
    });

    const setPriorityMode = (mode) => {
      state.generationConfig.commentPriorityMode = mode === 'performance' ? 'performance' : 'section';
      syncGenerationConfigUI();
      triggerAutoSave();
    };

    const setCommentSourceMode = (source) => {
      state.generationConfig.commentSourceMode = source === 'outcome' ? 'outcome' : 'question';
      syncGenerationConfigUI();
      triggerAutoSave();
    };

    btnSourceQuestion?.addEventListener('click', () => setCommentSourceMode('question'));
    btnSourceOutcome?.addEventListener('click', () => setCommentSourceMode('outcome'));
    btnModeSection?.addEventListener('click', () => setPriorityMode('section'));
    btnModePerformance?.addEventListener('click', () => setPriorityMode('performance'));

    cfgEnableSectionPriority?.addEventListener('change', () => {
      const isEnabled = cfgEnableSectionPriority.checked;
      state.generationConfig.enableSectionPriority = isEnabled;
      if (cfgSectionPriorityStatusBadge) cfgSectionPriorityStatusBadge.textContent = isEnabled ? 'Section Priority' : 'Random';
      if (sectionPriorityBoardContainer) sectionPriorityBoardContainer.style.display = isEnabled ? 'block' : 'none';
      if (sectionRankingBreadcrumb) sectionRankingBreadcrumb.style.display = isEnabled ? 'inline-flex' : 'none';
      updateConfigSummaryBadge();
      renderSectionRankingUI();
      triggerAutoSave();
    });

    const onNumChange = () => {
      let total = parseInt(cfgTotalComments ? cfgTotalComments.value : 6, 10);
      if (isNaN(total) || total < 1) total = 6;
      let minAch = parseInt(cfgMinAch ? cfgMinAch.value : 1, 10);
      if (isNaN(minAch) || minAch < 0) minAch = 0;
      let maxAch = parseInt(cfgMaxAch ? cfgMaxAch.value : 4, 10);
      if (isNaN(maxAch) || maxAch < minAch) maxAch = minAch;
      let minImp = parseInt(cfgMinImp ? cfgMinImp.value : 1, 10);
      if (isNaN(minImp) || minImp < 0) minImp = 0;
      let maxImp = parseInt(cfgMaxImp ? cfgMaxImp.value : 4, 10);
      if (isNaN(maxImp) || maxImp < minImp) maxImp = minImp;
      let highThresh = parseInt(cfgHighThreshold ? cfgHighThreshold.value : 70, 10);
      if (isNaN(highThresh) || highThresh < 1) highThresh = 70;
      if (highThresh > 100) highThresh = 100;
      let midThresh = parseInt(cfgMidThreshold ? cfgMidThreshold.value : 50, 10);
      if (isNaN(midThresh) || midThresh < 0) midThresh = 0;
      if (midThresh > 99) midThresh = 99;

      state.generationConfig.totalComments = total;
      state.generationConfig.minAchievements = minAch;
      state.generationConfig.maxAchievements = maxAch;
      state.generationConfig.minImprovements = minImp;
      state.generationConfig.maxImprovements = maxImp;
      state.generationConfig.highThreshold = highThresh;
      state.generationConfig.midThreshold = midThresh;

      updateConfigPreview();
      triggerAutoSave();
    };

    [cfgTotalComments, cfgMinAch, cfgMaxAch, cfgMinImp, cfgMaxImp, cfgHighThreshold, cfgMidThreshold].forEach(inp => {
      if (inp) {
        inp.addEventListener('change', onNumChange);
        inp.addEventListener('input', onNumChange);
      }
    });

    syncGenerationConfigUI();
  }

  setupGenerationConfigListeners();

  // --- Step 4: Student Comment Status, Filtering, Sorting & Score Breakdown ---
  function getStudentCommentStatus(student, commentText, scoreSummary = null, hasAttempted = false) {
    const summary = scoreSummary || CommentEngine.calculateStudentScoreSummary(student, state.questions);
    if (summary.isZeroOutOfZero) {
      return { needsManualReview: false, missingAch: false, missingImp: false, reason: '' };
    }

    const text = (commentText || '').trim();
    if (!hasAttempted && !text) {
      return { needsManualReview: false, missingAch: false, missingImp: false, reason: '' };
    }

    const achMatch = text.match(/Achievements:\s*([\s\S]*?)(?=(?:Improvements:|$))/i);
    const impMatch = text.match(/Improvements:\s*([\s\S]*?)$/i);
    const hasNonePlaceholder = /\(none qualified from bank\)/i.test(text) || /\[(?:No|Missing) (?:Achievement|Improvement)/i.test(text);
    const { achievements, improvements, full } = CommentEngine.extractFeedbackSections(text);

    if (!achMatch && !impMatch && text && !hasNonePlaceholder && full) {
      return { needsManualReview: false, missingAch: false, missingImp: false, reason: '' };
    }

    const { targetAch, targetImp } = CommentEngine.getTargetDistribution(summary.percentage, state.generationConfig);
    const achRawLines = (achMatch ? achMatch[1] : '').split(/\r?\n+/).map(l => l.trim()).filter(l =>
      l && !/\(none qualified from bank\)/i.test(l) && !/\[Missing Achievement\s*\d*\]/i.test(l)
    );
    const impRawLines = (impMatch ? impMatch[1] : '').split(/\r?\n+/).map(l => l.trim()).filter(l =>
      l && !/\(none qualified from bank\)/i.test(l) && !/\[Missing Improvement\s*\d*\]/i.test(l)
    );

    const hasMissingAchTag = /\[Missing Achievement\s*\d*\]/i.test(text);
    const hasMissingImpTag = /\[Missing Improvement\s*\d*\]/i.test(text);

    const missingAch = !text || !achievements.trim() || /Achievements:\s*\n*\s*\(None qualified from bank\)/i.test(text) || hasMissingAchTag || achRawLines.length < targetAch;
    const missingImp = !text || !improvements.trim() || /Improvements:\s*\n*\s*\(None qualified from bank\)/i.test(text) || hasMissingImpTag || impRawLines.length < targetImp;
    const needsManualReview = missingAch || missingImp;

    let reason = '';
    if (!text || (achRawLines.length === 0 && impRawLines.length === 0)) {
      reason = 'No qualifying comments matched — add manually';
    } else if (missingAch && missingImp) {
      reason = `Missing achievement & improvement comments (${achRawLines.length}/${targetAch} Ach, ${impRawLines.length}/${targetImp} Imp) — review manually`;
    } else if (missingImp) {
      reason = impRawLines.length === 0
        ? 'No improvement comments qualified — add manually'
        : `Missing improvement comment (${impRawLines.length}/${targetImp}) — review manually`;
    } else if (missingAch) {
      reason = achRawLines.length === 0
        ? 'No achievement comments qualified — add manually'
        : `Missing achievement comment (${achRawLines.length}/${targetAch}) — review manually`;
    }

    return { needsManualReview, missingAch, missingImp, reason };
  }

  function updateStep4FilterCounts() {
    const allStudents = state.students || [];
    let completeCount = 0;
    let reviewCount = 0;
    let absentCount = 0;

    allStudents.forEach(student => {
      const summary = CommentEngine.calculateStudentScoreSummary(student, state.questions);
      if (summary.isZeroOutOfZero) {
        absentCount++;
        return;
      }
      const hasAttempted = Object.prototype.hasOwnProperty.call(state.generatedComments, student.id);
      const commentText = state.generatedComments[student.id] || '';
      const status = getStudentCommentStatus(student, commentText, summary, hasAttempted);
      if (hasAttempted && status.needsManualReview) {
        reviewCount++;
      } else if (commentText.trim() && !status.needsManualReview) {
        completeCount++;
      }
    });

    const elAll = document.getElementById('countFilterAll');
    const elComplete = document.getElementById('countFilterComplete');
    const elReview = document.getElementById('countFilterReview');
    const elAbsent = document.getElementById('countFilterAbsent');

    if (elAll) elAll.textContent = String(allStudents.length);
    if (elComplete) elComplete.textContent = String(completeCount);
    if (elReview) elReview.textContent = String(reviewCount);
    if (elAbsent) elAbsent.textContent = String(absentCount);

    studentFilterPills?.querySelectorAll('.filter-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === activeStudentFilter);
    });
  }

  function getFilteredStudentsForStep4() {
    const q = (searchStudent ? searchStudent.value : '').toLowerCase().trim();
    const filtered = (state.students || []).filter(student => {
      if (q && !student.name.toLowerCase().includes(q)) return false;

      if (activeStudentFilter !== 'all') {
        const summary = CommentEngine.calculateStudentScoreSummary(student, state.questions);
        if (activeStudentFilter === 'absent') {
          return summary.isZeroOutOfZero;
        }
        if (summary.isZeroOutOfZero) return false;
        const hasAttempted = Object.prototype.hasOwnProperty.call(state.generatedComments, student.id);
        const commentText = state.generatedComments[student.id] || '';
        const status = getStudentCommentStatus(student, commentText, summary, hasAttempted);

        if (activeStudentFilter === 'review') {
          return hasAttempted && status.needsManualReview;
        }
        if (activeStudentFilter === 'complete') {
          return Boolean(commentText.trim()) && !status.needsManualReview;
        }
      }
      return true;
    });

    if (activeStudentSort === 'name_asc') {
      return [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    if (activeStudentSort === 'score_desc' || activeStudentSort === 'score_asc') {
      return [...filtered].sort((a, b) => {
        const sumA = CommentEngine.calculateStudentScoreSummary(a, state.questions);
        const sumB = CommentEngine.calculateStudentScoreSummary(b, state.questions);
        const pctA = sumA.isZeroOutOfZero ? -1 : sumA.percentage;
        const pctB = sumB.isZeroOutOfZero ? -1 : sumB.percentage;
        return activeStudentSort === 'score_desc' ? pctB - pctA : pctA - pctB;
      });
    }

    return filtered;
  }

  studentFilterPills?.querySelectorAll('.filter-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeStudentFilter = btn.getAttribute('data-filter') || 'all';
      renderStudentCards(getFilteredStudentsForStep4());
    });
  });

  sortStudentSelect?.addEventListener('change', (e) => {
    activeStudentSort = e.target.value || 'order';
    renderStudentCards(getFilteredStudentsForStep4());
  });

  searchStudent?.addEventListener('input', () => {
    renderStudentCards(getFilteredStudentsForStep4());
  });

  function buildStudentScoreBreakdownHtml(student) {
    const validQuestions = (state.questions || []).filter(
      q => !q.isSectionBreak && !q.isTotal && !q.isPercentage && !q.isSummary && !q.isPenalty && q.included !== false
    );
    if (validQuestions.length === 0) {
      return `<div style="color: var(--text-muted);">No questions configured.</div>`;
    }

    const isOutcomeSource = state.generationConfig.commentSourceMode === 'outcome' && Array.isArray(state.outcomes) && state.outcomes.length > 0;
    if (isOutcomeSource) {
      const cutoff = Number(state.generationConfig.outcomeMasteryCutoff ?? 70);
      const qByKey = {};
      validQuestions.forEach(q => { qByKey[CommentEngine.getQuestionKey(q)] = q; });

      const chipsHtml = state.outcomes.map((o, idx) => {
        const tagged = (o.questionKeys || []).map(k => qByKey[k]).filter(Boolean);
        let obt = 0;
        let max = 0;
        tagged.forEach(q => {
          const val = CommentEngine.getQuestionScore(student, q);
          if (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) obt += parseFloat(val);
          max += parseFloat(q.maxMarks) || 1;
        });
        const pct = max > 0 ? Math.round((obt / max) * 100) : 0;
        const chipClass = max === 0 ? '' : (pct >= cutoff ? 'chip-mastered' : 'chip-missed');
        const label = (o.name || '').trim() || `Outcome ${idx + 1}`;
        return `<span class="breakdown-chip ${chipClass}" title="${esc(label)}: ${obt}/${max} (${pct}%)">${esc(label)}: ${obt}/${max} (${pct}%)</span>`;
      }).join('');

      return `
        <div class="breakdown-section-row">
          <span class="breakdown-sec-label">Outcomes (Cutoff ${cutoff}%):</span>
          <div class="breakdown-chips-wrap">${chipsHtml}</div>
        </div>
      `;
    }

    const bySection = {};
    validQuestions.forEach(q => {
      const sec = q.section || 'General';
      if (!bySection[sec]) bySection[sec] = { obtained: 0, max: 0, items: [] };
      const rawVal = CommentEngine.getQuestionScore(student, q);
      const maxM = parseFloat(q.maxMarks) || 1;
      const isNum = rawVal !== undefined && rawVal !== null && rawVal !== '' && !isNaN(Number(rawVal));
      const score = isNum ? parseFloat(rawVal) : 0;
      if (isNum) {
        bySection[sec].obtained += score;
        bySection[sec].max += maxM;
      }
      const pct = (isNum && maxM > 0) ? (score / maxM) * 100 : 0;
      const chipClass = !isNum ? '' : (pct >= 100 ? 'chip-mastered' : (pct >= 50 ? 'chip-partial' : 'chip-missed'));
      bySection[sec].items.push(`
        <span class="breakdown-chip ${chipClass}">
          <strong>${esc(q.id || q.title)}</strong>: ${isNum ? score : 'NA'}/${maxM}
        </span>
      `);
    });

    return Object.entries(bySection).map(([sec, data]) => {
      const secPct = data.max > 0 ? Math.round((data.obtained / data.max) * 100) : 0;
      const obtClean = Number.isInteger(data.obtained) ? data.obtained : Math.round(data.obtained * 100) / 100;
      const maxClean = Number.isInteger(data.max) ? data.max : Math.round(data.max * 100) / 100;
      return `
        <div class="breakdown-section-row">
          <span class="breakdown-sec-label">${esc(sec)} (${obtClean}/${maxClean} &bull; ${secPct}%):</span>
          <div class="breakdown-chips-wrap">${data.items.join('')}</div>
        </div>
      `;
    }).join('');
  }

  function updateCardReviewState(card, student, commentText) {
    if (!card || !student) return;
    const hasAttempted = Object.prototype.hasOwnProperty.call(state.generatedComments, student.id);
    const status = getStudentCommentStatus(student, commentText, null, hasAttempted);
    const pillSlot = card.querySelector('.missing-comment-pill-slot');

    card.classList.toggle('student-card-needs-review', status.needsManualReview);
    if (pillSlot) {
      pillSlot.innerHTML = status.needsManualReview
        ? `<span class="missing-comment-pill" title="${esc(status.reason)}">⚠️ ${esc(status.reason)}</span>`
        : '';
    }
  }

  function updateMissingCommentsBanner() {
    updateStep4FilterCounts();
    updateWizardStepBadges();
    if (!missingCommentsBanner) return;

    const flagged = (state.students || []).filter(student => {
      const hasAttempted = Object.prototype.hasOwnProperty.call(state.generatedComments, student.id);
      if (!hasAttempted) return false;
      const status = getStudentCommentStatus(student, state.generatedComments[student.id] || '', null, true);
      return status.needsManualReview;
    });

    if (flagged.length === 0) {
      if (activeStudentFilter === 'review') activeStudentFilter = 'all';
      missingCommentsBanner.style.display = 'none';
      missingCommentsBanner.innerHTML = '';
      return;
    }

    const previewNames = flagged.slice(0, 5).map(s => esc(s.name)).join(', ');
    const extraCount = flagged.length > 5 ? ` +${flagged.length - 5} more` : '';
    const plural = flagged.length === 1 ? 'student has' : 'students have';
    const isReviewFilterActive = activeStudentFilter === 'review';

    missingCommentsBanner.style.display = 'flex';
    missingCommentsBanner.innerHTML = `
      <div class="missing-comments-banner-main">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path>
        </svg>
        <div>
          <strong>${flagged.length} ${plural} missing or incomplete qualifying comments</strong> (${previewNames}${extraCount}). Edit manually or they will be left blank in the Compass script.
        </div>
      </div>
      <button type="button" id="btnToggleReviewFilter" class="btn btn-secondary btn-sm">
        ${isReviewFilterActive ? 'Show All Students' : `Filter Needs Review (${flagged.length})`}
      </button>
    `;

    document.getElementById('btnToggleReviewFilter')?.addEventListener('click', () => {
      activeStudentFilter = isReviewFilterActive ? 'all' : 'review';
      renderStudentCards(getFilteredStudentsForStep4());
    });
  }

  function renderStep4Dashboard() {
    syncSectionRanking();
    renderStudentCards(getFilteredStudentsForStep4());
  }

  function renderStudentCards(studentsToRender) {
    if (!studentCardsContainer) return;
    studentCardsContainer.innerHTML = '';
    updateMissingCommentsBanner();

    if (totalStudentsCount) {
      totalStudentsCount.textContent = `${studentsToRender.length} of ${state.students.length}`;
    }

    if (!studentsToRender || studentsToRender.length === 0) {
      const emptyMsg = state.students.length === 0
        ? 'No student records found. Upload a graded spreadsheet in Step 1 to generate comments.'
        : 'No students match the current search or filter criteria.';
      studentCardsContainer.innerHTML = `
        <div class="dashboard-empty-state" style="padding: 2.25rem;">
          <p style="color: var(--text-muted); font-size: 0.92rem;">${esc(emptyMsg)}</p>
        </div>
      `;
      return;
    }

    studentsToRender.forEach(student => {
      const scoreSummary = CommentEngine.calculateStudentScoreSummary(student, state.questions);
      const totalObtained = scoreSummary.obtained;
      const totalMax = scoreSummary.max;
      const pct = scoreSummary.percentage;
      const isZeroOutOfZero = scoreSummary.isZeroOutOfZero;
      const band = scoreSummary.band;

      let commentText = state.generatedComments[student.id] || '';
      if (isZeroOutOfZero && !commentText) {
        commentText = 'Incomplete due to absences';
        state.generatedComments[student.id] = commentText;
      }

      const hasAttempted = Object.prototype.hasOwnProperty.call(state.generatedComments, student.id);
      const commentStatus = getStudentCommentStatus(student, commentText, scoreSummary, hasAttempted);

      const card = document.createElement('div');
      card.className = commentStatus.needsManualReview
        ? 'student-comment-card student-card-needs-review'
        : 'student-comment-card';

      let bandStyle = 'background: var(--bg-subtle); color: var(--text-muted);';
      if (isZeroOutOfZero) {
        bandStyle = 'background: var(--danger-light); color: var(--danger-text); border: 1px solid rgba(184, 58, 58, 0.3);';
      } else if (band === 'Outstanding' || band === 'Excellent') {
        bandStyle = 'background: var(--success-light); color: var(--success-text); border: 1px solid rgba(56, 115, 78, 0.3);';
      } else if (band === 'Very Good' || band === 'Good') {
        bandStyle = 'background: var(--primary-light); color: var(--primary-text); border: 1px solid rgba(54, 100, 130, 0.3);';
      } else if (band === 'Moderate') {
        bandStyle = 'background: var(--warning-light); color: var(--warning-text); border: 1px solid rgba(184, 115, 32, 0.3);';
      } else if (band === 'Limited' || band === 'Low' || band === 'Very Low') {
        bandStyle = 'background: var(--terracotta-light); color: var(--terracotta-text); border: 1px solid rgba(192, 86, 56, 0.3);';
      }

      const missingPillHtml = commentStatus.needsManualReview
        ? `<span class="missing-comment-pill" title="${esc(commentStatus.reason)}">⚠️ ${esc(commentStatus.reason)}</span>`
        : '';

      const isExpanded = expandedBreakdownIds.has(student.id);

      card.innerHTML = `
        <div class="student-card-header">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span class="student-name">${esc(student.name)}</span>
            <span class="tag-pill" style="${bandStyle} font-weight: 700;">${esc(band)}</span>
            <span class="missing-comment-pill-slot">${missingPillHtml}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <button type="button" class="student-breakdown-toggle" data-id="${esc(student.id)}" aria-expanded="${isExpanded}">
              <span>${isExpanded ? '▴ Hide Breakdown' : '▾ Score Breakdown'}</span>
            </button>
            <div class="student-score-badge">
              Score: ${totalObtained} / ${totalMax} (${isZeroOutOfZero ? '0%' : `${pct}%`})
            </div>
          </div>
        </div>

        <div class="student-breakdown-panel" id="breakdown_${esc(student.id)}" style="display: ${isExpanded ? 'block' : 'none'};">
          ${isExpanded ? buildStudentScoreBreakdownHtml(student) : ''}
        </div>

        <textarea class="comment-textarea student-comment-input" data-id="${esc(student.id)}" placeholder="Student feedback comment will appear here after clicking 'Generate All' or 'Regenerate'...">${esc(commentText)}</textarea>

        <div class="card-actions">
          <button type="button" class="btn btn-secondary btn-sm btn-copy-comment" data-id="${esc(student.id)}">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
            <span>Copy</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm btn-regen-single" data-id="${esc(student.id)}">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            <span>Regenerate</span>
          </button>
          <button type="button" class="btn btn-danger btn-sm btn-clear-single" data-id="${esc(student.id)}">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            <span>Clear</span>
          </button>
        </div>
      `;

      studentCardsContainer.appendChild(card);
    });

    studentCardsContainer.querySelectorAll('.student-breakdown-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const student = state.students.find(s => String(s.id) === String(id));
        const panel = document.getElementById(`breakdown_${id}`);
        if (!student || !panel) return;

        if (expandedBreakdownIds.has(id)) {
          expandedBreakdownIds.delete(id);
          panel.style.display = 'none';
          btn.setAttribute('aria-expanded', 'false');
          btn.innerHTML = '<span>▾ Score Breakdown</span>';
        } else {
          expandedBreakdownIds.add(id);
          panel.innerHTML = buildStudentScoreBreakdownHtml(student);
          panel.style.display = 'block';
          btn.setAttribute('aria-expanded', 'true');
          btn.innerHTML = '<span>▴ Hide Breakdown</span>';
        }
      });
    });

    studentCardsContainer.querySelectorAll('.student-comment-input').forEach(txt => {
      autoResizeCommentTextarea(txt);

      txt.addEventListener('input', () => {
        autoResizeCommentTextarea(txt);
        const id = txt.getAttribute('data-id');
        state.generatedComments[id] = txt.value;
        const student = state.students.find(s => String(s.id) === String(id));
        updateCardReviewState(txt.closest('.student-comment-card'), student, txt.value);
        updateMissingCommentsBanner();
      });

      txt.addEventListener('change', () => {
        const id = txt.getAttribute('data-id');
        state.generatedComments[id] = txt.value;
        const student = state.students.find(s => String(s.id) === String(id));
        updateCardReviewState(txt.closest('.student-comment-card'), student, txt.value);
        updateMissingCommentsBanner();
        triggerAutoSave();
      });
    });

    requestAnimationFrame(() => autoResizeAllCommentBoxes());

    studentCardsContainer.querySelectorAll('.btn-copy-comment').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-id');
        const text = state.generatedComments[id] || '';
        copyTextToClipboard(text);
        b.innerHTML = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg> <span>Copied</span>';
        setTimeout(() => {
          b.innerHTML = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg> <span>Copy</span>';
        }, 1500);
      });
    });

    studentCardsContainer.querySelectorAll('.btn-clear-single').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-id');
        delete state.generatedComments[id];
        const card = b.closest('.student-comment-card');
        const txt = card?.querySelector('.student-comment-input');
        if (txt) {
          txt.value = '';
          autoResizeCommentTextarea(txt);
        }
        const student = state.students.find(s => String(s.id) === String(id));
        updateCardReviewState(card, student, '');
        updateMissingCommentsBanner();
        triggerAutoSave();
      });
    });

    studentCardsContainer.querySelectorAll('.btn-regen-single').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-id');
        const student = state.students.find(s => String(s.id) === String(id));
        if (!student) return;

        b.innerHTML = '<span>Regenerating...</span>';
        b.disabled = true;

        const activeQuestions = state.questions.filter(q => !q.isSectionBreak && q.included !== false);
        const config = buildGenerationConfig(activeQuestions, {
          currentComment: state.generatedComments[id] || ''
        });

        try {
          const comment = CommentEngine.generateCommentsForStudent(student, activeQuestions, commentBank, config, state.sectionRanking);
          state.generatedComments[id] = comment;

          const card = b.closest('.student-comment-card');
          const txt = card ? card.querySelector('.student-comment-input') : null;
          if (txt) {
            txt.value = comment;
            autoResizeCommentTextarea(txt);
            txt.style.transition = 'border-color 0.25s ease, box-shadow 0.25s ease';
            txt.style.borderColor = 'var(--success)';
            txt.style.boxShadow = '0 0 0 3px rgba(56, 115, 78, 0.25)';
            setTimeout(() => {
              txt.style.borderColor = '';
              txt.style.boxShadow = '';
            }, 1200);
          }

          updateCardReviewState(card, student, comment);
          updateMissingCommentsBanner();
          triggerAutoSave();

          b.innerHTML = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg> <span>Regenerated!</span>';
          setTimeout(() => {
            b.disabled = false;
            b.innerHTML = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> <span>Regenerate</span>';
          }, 1400);
        } catch (err) {
          console.error(`Single generation failed for ${student.name}:`, err);
          b.disabled = false;
          b.innerHTML = '<span>Regenerate</span>';
        }
      });
    });
  }

  function autoResizeCommentTextarea(txt) {
    if (!txt) return;
    txt.style.height = 'auto';
    const targetHeight = Math.max(120, txt.scrollHeight + 8);
    txt.style.height = `${targetHeight}px`;
  }

  function autoResizeAllCommentBoxes() {
    document.querySelectorAll('.student-comment-input').forEach(txt => {
      autoResizeCommentTextarea(txt);
    });
  }

  btnCancelGeneration?.addEventListener('click', () => {
    if (!state.isGenerating) return;
    state.isGenerating = false;
    btnCancelGeneration.disabled = true;
    btnCancelGeneration.innerHTML = `<span>Stopping...</span>`;
    const progressStatusText = document.getElementById('progressStatusText');
    if (progressStatusText) progressStatusText.textContent = 'Stopping generation...';
  });

  btnClearAllComments?.addEventListener('click', async () => {
    if (Object.keys(state.generatedComments).length === 0) return;
    const ok = await UIHelpers.showConfirmModal({
      title: 'Clear All Generated Comments',
      message: 'Are you sure you want to clear all generated comments for all students?',
      confirmText: 'Clear All Comments',
      danger: true
    });
    if (ok) {
      state.generatedComments = {};
      activeStudentFilter = 'all';
      renderStudentCards(getFilteredStudentsForStep4());
      triggerAutoSave();
      UIHelpers.showToast('Cleared all generated student comments.', 'info');
    }
  });

  function buildGenerationConfig(activeQuestions, extra = {}) {
    const isOutcomeSource = state.generationConfig.commentSourceMode === 'outcome' && Array.isArray(state.outcomes) && state.outcomes.length > 0;
    return {
      ...state.generationConfig,
      tone: 'formal and encouraging',
      questionAverages: CommentEngine.computeQuestionAverages(state.students, activeQuestions),
      ...(isOutcomeSource ? {
        outcomes: state.outcomes,
        outcomeAverages: CommentEngine.computeOutcomeAverages(state.students, activeQuestions, state.outcomes)
      } : {}),
      ...extra
    };
  }

  function runBatchGeneration(studentsToProcess) {
    if (!studentsToProcess || studentsToProcess.length === 0) return;

    toggleGenerationConfigCard(false);
    state.isGenerating = true;

    if (btnGenerateAll) btnGenerateAll.disabled = true;
    if (btnGenerateMissing) btnGenerateMissing.disabled = true;
    if (btnCancelGeneration) {
      btnCancelGeneration.disabled = false;
      btnCancelGeneration.innerHTML = `<span>Stop</span>`;
    }
    if (progressContainer) progressContainer.style.display = 'block';

    const progressStudentName = document.getElementById('progressStudentName');
    const progressStepCount = document.getElementById('progressStepCount');
    const progressStatusText = document.getElementById('progressStatusText');
    const progressBarFill = document.getElementById('progressBarFill');
    const progressPercent = document.getElementById('progressPercent');
    const progressTimeElapsed = document.getElementById('progressTimeElapsed');
    const progressEstTime = document.getElementById('progressEstTime');

    const activeQuestions = state.questions.filter(q => !q.isSectionBreak && q.included !== false);
    const config = buildGenerationConfig(activeQuestions);

    const total = studentsToProcess.length;
    const startTime = Date.now();
    const rankingDisplay = (state.sectionRanking && state.sectionRanking.length > 0)
      ? state.sectionRanking.map(tier => Array.isArray(tier) ? tier.join(' = ') : tier).join(' > ')
      : 'General';

    if (progressStatusText) {
      progressStatusText.textContent = config.commentPriorityMode === 'performance'
        ? 'Applying performance-based difficulty ranking...'
        : `Applying section priority ranking (${rankingDisplay})...`;
    }

    let processed = 0;
    let missingReviewCount = 0;
    for (let i = 0; i < total; i++) {
      if (!state.isGenerating) break;
      const student = studentsToProcess[i];
      const comment = CommentEngine.generateCommentsForStudent(student, activeQuestions, commentBank, config, state.sectionRanking);
      state.generatedComments[student.id] = comment;
      processed++;

      const status = getStudentCommentStatus(student, comment, null, true);
      if (status.needsManualReview) missingReviewCount++;

      const pctDone = Math.round(((i + 1) / total) * 100);
      if (progressBarFill) progressBarFill.style.width = `${pctDone}%`;
      if (progressPercent) progressPercent.textContent = `(${pctDone}%)`;
      if (progressStepCount) progressStepCount.textContent = `Student ${i + 1} of ${total}`;
    }

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
    if (progressTimeElapsed) progressTimeElapsed.textContent = `Elapsed: ${elapsedSec}s`;

    if (!state.isGenerating) {
      if (progressStudentName) progressStudentName.textContent = 'Generation Stopped';
      if (progressStatusText) progressStatusText.textContent = `Stopped by user. Generated comments for ${processed} student(s).`;
      if (progressEstTime) progressEstTime.textContent = 'Stopped';
    } else {
      if (progressStudentName) progressStudentName.textContent = 'Comments Generated Successfully';
      if (progressStatusText) {
        progressStatusText.textContent = missingReviewCount > 0
          ? `Generated comments for ${processed} student(s). ⚠️ ${missingReviewCount} student(s) need manual review.`
          : `Generated comments for ${processed} student(s).`;
      }
      if (progressEstTime) progressEstTime.textContent = 'Complete';
      UIHelpers.showToast(
        missingReviewCount > 0
          ? `Generated ${processed} comments (${missingReviewCount} flagged for manual review).`
          : `Generated comments for ${processed} student(s).`,
        missingReviewCount > 0 ? 'warning' : 'success'
      );
    }

    renderStudentCards(getFilteredStudentsForStep4());
    triggerAutoSave();

    state.isGenerating = false;
    if (btnGenerateAll) btnGenerateAll.disabled = false;
    if (btnGenerateMissing) btnGenerateMissing.disabled = false;
    if (btnCancelGeneration) btnCancelGeneration.disabled = false;

    setTimeout(() => {
      if (progressContainer) progressContainer.style.display = 'none';
    }, 2200);
  }

  btnGenerateAll?.addEventListener('click', () => {
    if (state.students.length === 0) {
      UIHelpers.showToast('No student records loaded! Upload a gradebook in Step 1.', 'warning');
      return;
    }
    runBatchGeneration(state.students);
  });

  btnGenerateMissing?.addEventListener('click', () => {
    if (state.students.length === 0) {
      UIHelpers.showToast('No student records loaded! Upload a gradebook in Step 1.', 'warning');
      return;
    }
    const missingStudents = state.students.filter(s => !state.generatedComments[s.id] || !state.generatedComments[s.id].trim());
    if (missingStudents.length === 0) {
      UIHelpers.showToast('All students already have generated comments!', 'info');
      return;
    }
    runBatchGeneration(missingStudents);
  });

  // Export to Excel Handler
  btnExportExcel?.addEventListener('click', () => {
    if (state.students.length === 0) {
      UIHelpers.showToast('No student records to export.', 'warning');
      return;
    }

    const activeQuestions = state.questions.filter(q => !q.isSectionBreak && q.included !== false);

    const exportRows = state.students.map(student => {
      const summary = CommentEngine.calculateStudentScoreSummary(student, state.questions);
      const row = { 'Student Name': student.name };

      activeQuestions.forEach(q => {
        const score = CommentEngine.getQuestionScore(student, q);
        const headerKey = (q.section && q.section !== 'General') ? `${q.section} - ${q.id}` : q.id;
        row[headerKey] = score !== undefined && score !== null ? score : '';
      });

      const commentText = state.generatedComments[student.id] || (summary.isZeroOutOfZero ? 'Incomplete due to absences' : '');
      const { achievements, improvements } = CommentEngine.extractFeedbackSections(commentText);

      row['Total Mark'] = summary.obtained;
      row['Max Mark'] = summary.max;
      row['Percentage (%)'] = summary.isZeroOutOfZero ? 'NA' : summary.percentage;
      row['Achievement Band'] = summary.band;
      row['Achievements Comment'] = achievements;
      row['Improvements Comment'] = improvements;
      row['Generated Feedback Comment'] = commentText;

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Feedback Comments');

    XLSX.writeFile(workbook, 'Student_Assessment_Comments.xlsx');
    UIHelpers.showToast('Exported comments to Student_Assessment_Comments.xlsx.', 'success');
  });

  // --- Compass Console Command Modal & Clipboard ---
  function updateCompassModalPreview() {
    const format = compassColumnFormat ? compassColumnFormat.value : 'band_ach_imp';
    const script = CompassExporter.generateCompassScript(
      state.students,
      state.questions,
      state.generatedComments,
      format,
      getStudentCommentStatus
    );
    if (compassScriptPreview) compassScriptPreview.value = script;
    if (compassStudentCountBadge) {
      const count = state.students.length;
      const activeQuestions = (state.questions || []).filter(q => !q.isSectionBreak && q.included !== false);
      const blankCount = state.students.filter(student => {
        const summary = CommentEngine.calculateStudentScoreSummary(student, activeQuestions);
        if (summary.isZeroOutOfZero) return false;
        const status = getStudentCommentStatus(student, state.generatedComments[student.id] || '', summary, true);
        return status.needsManualReview;
      }).length;
      const baseText = `${count} student${count === 1 ? '' : 's'} included`;
      compassStudentCountBadge.textContent = blankCount > 0
        ? `${baseText} (${blankCount} left blank for review)`
        : baseText;
    }
  }

  async function copyTextToClipboard(text) {
    if (!text) return false;

    const fallbackCopy = () => {
      try {
        if (compassScriptPreview && compassScriptPreview.value === text) {
          compassScriptPreview.focus();
          compassScriptPreview.select();
          const ok = document.execCommand('copy');
          if (ok) return true;
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.width = '2em';
        ta.style.height = '2em';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, text.length);
        const success = document.execCommand('copy');
        document.body.removeChild(ta);
        return success;
      } catch (err) {
        console.warn('Fallback copy failed:', err);
        return false;
      }
    };

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        return fallbackCopy();
      }
    }
    return fallbackCopy();
  }

  function openCompassModal() {
    if (!compassModal) return;
    updateCompassModalPreview();
    compassModal.style.display = 'flex';
    if (compassScriptPreview) {
      setTimeout(() => {
        compassScriptPreview.focus();
        compassScriptPreview.select();
      }, 50);
    }
  }

  function closeCompassModal() {
    if (!compassModal) return;
    compassModal.style.display = 'none';
  }

  btnCopyCompassScript?.addEventListener('click', async () => {
    if (state.students.length === 0) {
      UIHelpers.showToast('No students found to export. Upload a gradebook first.', 'warning');
      return;
    }

    const generatedCount = Object.keys(state.generatedComments).length;
    if (generatedCount === 0) {
      const activeQuestions = state.questions.filter(q => !q.isSectionBreak && q.included !== false);
      const config = buildGenerationConfig(activeQuestions);
      state.students.forEach(student => {
        state.generatedComments[student.id] = CommentEngine.generateCommentsForStudent(
          student,
          activeQuestions,
          commentBank,
          config,
          state.sectionRanking
        );
      });
      renderStudentCards(getFilteredStudentsForStep4());
      triggerAutoSave();
    }

    const format = compassColumnFormat ? compassColumnFormat.value : 'band_ach_imp';
    const script = CompassExporter.generateCompassScript(
      state.students,
      state.questions,
      state.generatedComments,
      format,
      getStudentCommentStatus
    );

    openCompassModal();
    await copyTextToClipboard(script);
    UIHelpers.showToast('Compass automation script copied to clipboard.', 'success');
  });

  compassColumnFormat?.addEventListener('change', updateCompassModalPreview);

  btnCopyCompassModalScript?.addEventListener('click', async () => {
    const script = compassScriptPreview ? compassScriptPreview.value : '';
    await copyTextToClipboard(script);
    UIHelpers.showToast('Compass script copied to clipboard.', 'success');
  });

  btnCloseCompassModal?.addEventListener('click', closeCompassModal);
  btnCancelCompassModal?.addEventListener('click', closeCompassModal);
  compassModal?.addEventListener('click', (e) => {
    if (e.target === compassModal) closeCompassModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && compassModal && compassModal.style.display !== 'none') {
      closeCompassModal();
    }
  });

  // --- Initial Boot & Active Context Recovery ---
  if (window.location.search.includes('demo=1')) {
    seedDemoData();
  }

  const hashStepMatch = window.location.hash.match(/#step-(\d+)/);
  const activeCtx = StorageService.getActiveContext();
  let initialStep = 0;

  if (activeCtx && activeCtx.classId && activeCtx.assessmentId) {
    const classObj = StorageService.getClassById(activeCtx.classId);
    const assessObj = StorageService.getAssessmentById(activeCtx.classId, activeCtx.assessmentId);
    if (classObj && assessObj) {
      restoreAssessmentData(activeCtx.classId, activeCtx.assessmentId);
      initialStep = hashStepMatch ? parseInt(hashStepMatch[1], 10) : (assessObj.currentStep || 0);
    }
  } else if (hashStepMatch) {
    initialStep = parseInt(hashStepMatch[1], 10);
  }

  showStep(initialStep);

  window.addEventListener('hashchange', () => {
    const match = window.location.hash.match(/#step-(\d+)/);
    if (match) {
      showStep(parseInt(match[1], 10));
    }
  });
});
