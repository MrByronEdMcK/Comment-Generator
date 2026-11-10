/**
 * Main Application Orchestrator
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize services
  const commentBank = new CommentBank();

  // Application State
  const state = {
    spreadsheetFile: null,
    spreadsheetName: null,
    availableSheets: [],
    selectedSheet: null,
    excelData: null,
    questions: [],
    students: [],
    generatedComments: {}, // studentId -> commentText
    sectionRanking: [], // Order of section preference e.g. ['SAQ', 'MCQ', 'General']
    generationConfig: {
      totalComments: 3,
      enableScoreTiers: false,
      enableSectionPriority: false,
      minAchievements: 1,
      maxAchievements: 3,
      minImprovements: 1,
      maxImprovements: 2,
      highThreshold: 70,
      midThreshold: 50
    },
    isGenerating: false,
    currentStep: 1
  };

  // Class & Assessment State
  let currentClassId = null;
  let currentAssessmentId = null;
  let spreadsheetArrayBuffer = null;

  const classSelect = document.getElementById('classSelect');
  const btnNewClass = document.getElementById('btnNewClass');
  const assessmentSelect = document.getElementById('assessmentSelect');
  const btnNewAssessment = document.getElementById('btnNewAssessment');
  const saveStatusIndicator = document.getElementById('saveStatusIndicator');

  // Theme Initialization & Switcher
  const btnThemeToggle = document.getElementById('btnThemeToggle');
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

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('commentgen_theme', next);
      updateThemeIcon(next);
    });
  }

  initTheme();

  function updateHeaderContext() {
    const chip = document.getElementById('headerContextChip');
    const classSpan = document.getElementById('headerContextClass');
    const assessSpan = document.getElementById('headerContextAssess');
    if (!chip) return;

    if (state.currentStep > 0 && currentClassId && currentAssessmentId) {
      const classObj = StorageService.getClassById(currentClassId);
      const assessObj = StorageService.getAssessmentById(currentClassId, currentAssessmentId);
      if (classSpan) classSpan.textContent = classObj?.name || 'Class';
      if (assessSpan) assessSpan.textContent = assessObj?.name || 'Assessment';
      chip.style.display = 'inline-flex';
    } else {
      chip.style.display = 'none';
    }
  }

  function triggerAutoSave() {
    if (!currentClassId || !currentAssessmentId) return;

    if (saveStatusIndicator) {
      const dot = saveStatusIndicator.querySelector('.storage-dot');
      if (dot) dot.classList.add('saving');
    }

    const assessName = assessmentSelect && assessmentSelect.selectedIndex >= 0
      ? assessmentSelect.options[assessmentSelect.selectedIndex]?.text
      : (StorageService.getAssessmentById(currentClassId, currentAssessmentId)?.name || 'Assessment');

    StorageService.saveAssessment(currentClassId, {
      id: currentAssessmentId,
      name: assessName,
      spreadsheetName: state.spreadsheetName || state.spreadsheetFile?.name || null,
      availableSheets: (state.availableSheets && state.availableSheets.length > 0) ? state.availableSheets : (state.excelData?.availableSheets || null),
      selectedSheet: state.selectedSheet || state.excelData?.sheetName || null,
      questions: state.questions,
      commentBank: commentBank.toJSON(),
      generatedComments: state.generatedComments,
      sectionRanking: state.sectionRanking,
      students: state.students,
      generationConfig: state.generationConfig,
      currentStep: state.currentStep
    });

    StorageService.setActiveContext(currentClassId, currentAssessmentId);
    updateHeaderContext();

    if (saveStatusIndicator) {
      setTimeout(() => {
        const dot = saveStatusIndicator.querySelector('.storage-dot');
        if (dot) dot.classList.remove('saving');
      }, 350);
    }
  }

  function loadClassesUI() {
    const classes = StorageService.getClasses();
    if (classSelect) classSelect.innerHTML = '<option value="">+ New Class...</option>';
    
    classes.forEach(c => {
      if (classSelect) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        classSelect.appendChild(opt);
      }
    });

    const activeCtx = StorageService.getActiveContext();
    if (activeCtx && activeCtx.classId && classes.some(c => c.id === activeCtx.classId)) {
      currentClassId = activeCtx.classId;
      currentAssessmentId = activeCtx.assessmentId;
    } else if (!currentClassId && classes.length > 0) {
      currentClassId = classes[0].id;
    }

    if (currentClassId) {
      if (classSelect) classSelect.value = currentClassId;
      loadAssessmentsUI(currentClassId);
    } else {
      // Auto-create default class if none exists
      const defaultClass = { id: `class_${Date.now()}`, name: 'My Class', assessments: [] };
      StorageService.saveClass(defaultClass);
      currentClassId = defaultClass.id;
  loadClassesUI();
    }
  }

  function loadAssessmentsUI(classId) {
    const classObj = StorageService.getClassById(classId);
    if (assessmentSelect) assessmentSelect.innerHTML = '<option value="">+ New Assessment...</option>';

    if (classObj) {
      if (!classObj.assessments || classObj.assessments.length === 0) {
        const defaultAssess = { id: `assess_${Date.now()}`, name: 'Assessment 1', questions: [], students: [] };
        StorageService.saveAssessment(classId, defaultAssess);
        currentAssessmentId = defaultAssess.id;
      }

      const updatedClass = StorageService.getClassById(classId);
      updatedClass.assessments.forEach(a => {
        if (assessmentSelect) {
          const opt = document.createElement('option');
          opt.value = a.id;
          opt.textContent = a.name;
          assessmentSelect.appendChild(opt);
        }
      });

      if (!currentAssessmentId && updatedClass.assessments.length > 0) {
        currentAssessmentId = updatedClass.assessments[0].id;
      }

      if (currentAssessmentId) {
        if (assessmentSelect) assessmentSelect.value = currentAssessmentId;
        restoreAssessmentData(classId, currentAssessmentId);
      }
    }
  }

  function restoreAssessmentData(classId, assessmentId) {
    const assessment = StorageService.getAssessmentById(classId, assessmentId);
    const classObj = StorageService.getClassById(classId);
    if (!assessment) return;

    // Reset and initialize fresh state for the target assessment
    state.spreadsheetFile = null;
    state.spreadsheetName = assessment.spreadsheetName || null;
    state.availableSheets = (assessment.availableSheets && Array.isArray(assessment.availableSheets))
      ? [...assessment.availableSheets]
      : [];
    state.selectedSheet = assessment.selectedSheet || null;
    state.excelData = null;
    state.questions = Array.isArray(assessment.questions) ? [...assessment.questions] : [];
    state.students = Array.isArray(assessment.students) ? [...assessment.students] : [];
    state.generatedComments = assessment.generatedComments ? { ...assessment.generatedComments } : {};
    state.sectionRanking = Array.isArray(assessment.sectionRanking) ? [...assessment.sectionRanking] : [];
    state.generationConfig = {
      totalComments: 3,
      enableScoreTiers: false,
      minAchievements: 1,
      maxAchievements: 3,
      minImprovements: 1,
      maxImprovements: 2,
      highThreshold: 70,
      midThreshold: 50,
      ...(assessment.generationConfig || {})
    };

    // Restore or reset comment bank
    if (assessment.commentBank && ((assessment.commentBank.achievements && assessment.commentBank.achievements.length > 0) || (assessment.commentBank.improvements && assessment.commentBank.improvements.length > 0))) {
      commentBank.fromJSON(assessment.commentBank);
    } else {
      commentBank.reset();
    }
    renderStep3CommentBank();

    // Reset spreadsheet array buffer; restore only if this assessment matches class spreadsheet
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
      btnGotoStep2.disabled = !(state.students && state.students.length > 0 && state.questions && state.questions.length > 0);
    }

    syncGenerationConfigUI();
    updateStep1UploadUI();
    updateHeaderContext();
  }

  // Generation Config & Constraints UI Handlers
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
  const sectionRankingBreadcrumb = document.getElementById('sectionRankingBreadcrumb');
  const cfgMinAch = document.getElementById('cfgMinAch');
  const cfgMaxAch = document.getElementById('cfgMaxAch');
  const cfgMinImp = document.getElementById('cfgMinImp');
  const cfgMaxImp = document.getElementById('cfgMaxImp');
  const cfgHighThreshold = document.getElementById('cfgHighThreshold');
  const cfgMidThreshold = document.getElementById('cfgMidThreshold');
  const cfgGradeRangesHint = document.getElementById('cfgGradeRangesHint');
  const badgeTierHigh = document.getElementById('badgeTierHigh');
  const badgeTierMid = document.getElementById('badgeTierMid');
  const badgeTierLow = document.getElementById('badgeTierLow');

  function updateConfigSummaryBadge() {
    if (!configSummaryBadge) return;
    const cfg = state.generationConfig || {};
    const total = cfg.totalComments ?? 3;
    const isScoreTiers = cfg.enableScoreTiers === true;
    const isSecPriority = cfg.enableSectionPriority === true;

    const secPart = isSecPriority ? ' • Section-Prioritized' : '';
    if (!isScoreTiers) {
      const ach = Math.max(1, Math.ceil(total / 2));
      const imp = Math.max(1, total - ach);
      configSummaryBadge.textContent = `${total} Comments per student (${ach} Str, ${imp} Gro) • Uniform${secPart}`;
      return;
    }

    const minAch = cfg.minAchievements ?? 1;
    const maxAch = cfg.maxAchievements ?? 3;
    const minImp = cfg.minImprovements ?? 1;
    const maxImp = cfg.maxImprovements ?? 2;
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
    cfgTotalComments.value = cfg.totalComments ?? 3;

    const isScoreTiers = cfg.enableScoreTiers === true;
    if (cfgEnableScoreTiers) {
      cfgEnableScoreTiers.checked = isScoreTiers;
    }
    if (cfgScoreTiersStatusBadge) {
      cfgScoreTiersStatusBadge.textContent = isScoreTiers ? 'On' : 'Off';
    }
    if (advancedScoreSettingsContainer) {
      advancedScoreSettingsContainer.style.display = isScoreTiers ? 'block' : 'none';
    }

    const isSectionPriority = cfg.enableSectionPriority === true;
    if (cfgEnableSectionPriority) {
      cfgEnableSectionPriority.checked = isSectionPriority;
    }
    if (cfgSectionPriorityStatusBadge) {
      cfgSectionPriorityStatusBadge.textContent = isSectionPriority ? 'On' : 'Off';
    }
    if (sectionPriorityBoardContainer) {
      sectionPriorityBoardContainer.style.display = isSectionPriority ? 'block' : 'none';
    }
    if (sectionRankingBreadcrumb) {
      sectionRankingBreadcrumb.style.display = isSectionPriority ? 'inline-flex' : 'none';
    }

    if (cfgMinAch) cfgMinAch.value = cfg.minAchievements ?? 1;
    if (cfgMaxAch) cfgMaxAch.value = cfg.maxAchievements ?? 3;
    if (cfgMinImp) cfgMinImp.value = cfg.minImprovements ?? 1;
    if (cfgMaxImp) cfgMaxImp.value = cfg.maxImprovements ?? 2;
    if (cfgHighThreshold) cfgHighThreshold.value = cfg.highThreshold ?? 70;
    if (cfgMidThreshold) cfgMidThreshold.value = cfg.midThreshold ?? 50;

    updateConfigSummaryBadge();
    updateConfigPreview();
    syncSectionRanking();
  }

  function updateConfigPreview() {
    const cfg = state.generationConfig || {};
    const total = cfg.totalComments ?? 3;
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
    if (cfgGradeRangesHint) {
      cfgGradeRangesHint.innerHTML = `High &ge; ${highThreshold}%, Mid ${midThreshold}&ndash;${highThreshold - 1}%, Growth &lt; ${midThreshold}%.`;
    }

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
        const maxSum = (cfg.maxAchievements ?? 3) + (cfg.maxImprovements ?? 2);

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

  // --- Section Priority Ranking System (Tiles in Rows with Drag/Drop) ---
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
      if (a.section && a.section.trim() && a.section !== 'General') {
        sectionsSet.add(a.section.trim());
      }
    });
    (commentBank.improvements || []).forEach(i => {
      if (i.section && i.section.trim() && i.section !== 'General') {
        sectionsSet.add(i.section.trim());
      }
    });

    const list = Array.from(sectionsSet);
    if (!list.includes('General')) {
      list.push('General');
    }
    return list;
  }

  function syncSectionRanking() {
    const available = getAvailableAssessmentSections();
    const normalized = CommentEngine.normalizeSectionTiers(state.sectionRanking, available);

    // Retain only valid available sections in each tier
    const filtered = [];
    normalized.forEach(tier => {
      const validInTier = tier.filter(sec => available.includes(sec));
      if (validInTier.length > 0) {
        filtered.push(validInTier);
      }
    });

    // Ensure all available are placed
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
      if (filtered.length === 1) {
        filtered[0].push('General');
      } else {
        filtered.push(['General']);
      }
    }

    state.sectionRanking = filtered;
    renderSectionRankingUI();
  }

  // Active drag state
  let dragBoardState = {
    sec: null,
    sourceTier: null,
    sourceSec: null
  };

  function renderSectionRankingUI() {
    const board = document.getElementById('sectionPriorityBoard') || document.getElementById('sectionRankingList');
    const breadcrumb = document.getElementById('sectionRankingBreadcrumb');
    if (!board) return;

    if (!state.sectionRanking || state.sectionRanking.length === 0) {
      syncSectionRanking();
      return;
    }

    const tiers = state.sectionRanking;
    const totalTiers = tiers.length;

    // Breadcrumb: e.g. Priority: SAQ = MCQ = General
    const breadcrumbText = tiers.map(tier => Array.isArray(tier) ? tier.join(' = ') : tier).join(' > ');
    if (breadcrumb) {
      breadcrumb.textContent = `Priority: ${breadcrumbText || 'General'}`;
      breadcrumb.style.display = (state.generationConfig.enableSectionPriority === true) ? 'inline-flex' : 'none';
    }

    board.innerHTML = '';

    // 1. Top Dropzone: Create Level Above First Tier
    const topDropZone = document.createElement('div');
    topDropZone.className = 'tier-drop-zone';
    topDropZone.setAttribute('data-drop-action', 'create-tier-above');
    topDropZone.setAttribute('data-target-tier', '0');
    topDropZone.innerHTML = `
      <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"></path></svg>
      <span>Drag a section here to create Level 1 (Top Priority)</span>
    `;
    board.appendChild(topDropZone);

    // 2. Render each Tier Row and trailing dropzone
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
        <div class="tier-tiles-row" data-tier-idx="${tierIdx}">
          <!-- Tiles rendered dynamically below -->
        </div>
      `;

      const tilesContainer = tierRow.querySelector('.tier-tiles-row');

      tier.forEach((sec, secIdx) => {
        const achCount = commentBank.getAchievementsBySection(sec).length;
        const impCount = commentBank.getImprovementsBySection(sec).length;
        const totalCount = achCount + impCount;

        const tile = document.createElement('div');
        tile.className = 'section-tile';
        tile.setAttribute('draggable', 'true');
        tile.setAttribute('data-sec', sec);
        tile.setAttribute('data-tier-idx', tierIdx);
        tile.setAttribute('data-sec-idx', secIdx);

        // Can move up if not (single item in top tier)
        const canMoveUp = !(tierIdx === 0 && tier.length === 1);
        // Can move down if not (single item in bottom tier)
        const canMoveDown = !(tierIdx === totalTiers - 1 && tier.length === 1);

        tile.innerHTML = `
          <span class="tile-drag-handle" title="Drag to reorder or place in another level">⋮⋮</span>
          <div class="tile-content">
            <span class="tile-name">${sec}</span>
            <span class="tile-meta">${totalCount} comments</span>
          </div>
          <div class="tile-actions">
            <button type="button" class="btn-tile-action btn-tile-up" data-tier="${tierIdx}" data-sec-idx="${secIdx}" ${canMoveUp ? '' : 'disabled'} title="Move '${sec}' to level above">
              <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7"></path></svg>
            </button>
            <button type="button" class="btn-tile-action btn-tile-down" data-tier="${tierIdx}" data-sec-idx="${secIdx}" ${canMoveDown ? '' : 'disabled'} title="Move '${sec}' to level below">
              <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"></path></svg>
            </button>
          </div>
        `;

        tilesContainer.appendChild(tile);
      });

      board.appendChild(tierRow);

      // Trailing dropzone below this tier (e.g. create level below)
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

    // --- Wire Drag and Drop Handlers ---
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

    // Dropzone listeners (creating new levels)
    board.querySelectorAll('.tier-drop-zone').forEach(dz => {
      dz.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        dz.classList.add('drop-hover');
      });

      dz.addEventListener('dragleave', () => {
        dz.classList.remove('drop-hover');
      });

      dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('drop-hover');
        if (!dragBoardState.sec) return;

        const action = dz.getAttribute('data-drop-action');
        const targetTier = parseInt(dz.getAttribute('data-target-tier'), 10);

        // Remove from source tier
        const [movedSec] = state.sectionRanking[dragBoardState.sourceTier].splice(dragBoardState.sourceSec, 1);
        if (state.sectionRanking[dragBoardState.sourceTier].length === 0) {
          state.sectionRanking.splice(dragBoardState.sourceTier, 1);
        }

        // Insert as new tier
        if (action === 'create-tier-above') {
          state.sectionRanking.splice(targetTier, 0, [movedSec]);
        } else {
          // create-tier-below: if source was before target and removed, target index might have shifted
          const insertIdx = (dragBoardState.sourceTier < targetTier && state.sectionRanking.length <= targetTier)
            ? targetTier
            : targetTier + 1;
          state.sectionRanking.splice(insertIdx, 0, [movedSec]);
        }

        renderSectionRankingUI();
        triggerAutoSave();
      });
    });

    // Row Container listeners (dropping into an existing row to share priority)
    board.querySelectorAll('.tier-tiles-row').forEach(row => {
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.classList.add('drop-hover');
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drop-hover');
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drop-hover');
        if (!dragBoardState.sec) return;

        const targetTier = parseInt(row.getAttribute('data-tier-idx'), 10);
        if (targetTier === dragBoardState.sourceTier) return; // already in this tier

        // Remove from source
        const [movedSec] = state.sectionRanking[dragBoardState.sourceTier].splice(dragBoardState.sourceSec, 1);
        if (state.sectionRanking[dragBoardState.sourceTier].length === 0) {
          state.sectionRanking.splice(dragBoardState.sourceTier, 1);
        }

        // Add to target tier row
        const adjustedTarget = targetTier > dragBoardState.sourceTier && state.sectionRanking.length <= targetTier
          ? targetTier - 1
          : targetTier;
        state.sectionRanking[adjustedTarget].push(movedSec);

        renderSectionRankingUI();
        triggerAutoSave();
      });
    });

    // --- Wire Button Controls (Tile Move Up / Move Down) ---
    board.querySelectorAll('.btn-tile-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tierIdx = parseInt(e.currentTarget.getAttribute('data-tier'), 10);
        const secIdx = parseInt(e.currentTarget.getAttribute('data-sec-idx'), 10);

        if (tierIdx === 0) {
          // If in Level 1 and multiple items exist, create new Level 1 above with this section!
          if (state.sectionRanking[0].length > 1) {
            const [sec] = state.sectionRanking[0].splice(secIdx, 1);
            state.sectionRanking.unshift([sec]);
            renderSectionRankingUI();
            triggerAutoSave();
          }
        } else {
          // Move into tier above
          const [sec] = state.sectionRanking[tierIdx].splice(secIdx, 1);
          state.sectionRanking[tierIdx - 1].push(sec);
          if (state.sectionRanking[tierIdx].length === 0) {
            state.sectionRanking.splice(tierIdx, 1);
          }
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
          // If in bottom tier and multiple items exist, create new Level below with this section!
          if (state.sectionRanking[tierIdx].length > 1) {
            const [sec] = state.sectionRanking[tierIdx].splice(secIdx, 1);
            state.sectionRanking.push([sec]);
            renderSectionRankingUI();
            triggerAutoSave();
          }
        } else {
          // Move into tier below
          const [sec] = state.sectionRanking[tierIdx].splice(secIdx, 1);
          state.sectionRanking[tierIdx + 1].unshift(sec);
          if (state.sectionRanking[tierIdx].length === 0) {
            state.sectionRanking.splice(tierIdx, 1);
          }
          renderSectionRankingUI();
          triggerAutoSave();
        }
      });
    });

    // Tier Shift Row Up / Down
    board.querySelectorAll('.btn-row-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tierIdx = parseInt(e.currentTarget.getAttribute('data-tier'), 10);
        if (tierIdx > 0) {
          const moved = state.sectionRanking.splice(tierIdx, 1)[0];
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
          const moved = state.sectionRanking.splice(tierIdx, 1)[0];
          state.sectionRanking.splice(tierIdx + 1, 0, moved);
          renderSectionRankingUI();
          triggerAutoSave();
        }
      });
    });
  }

  function setupGenerationConfigListeners() {
    if (btnToggleConfigCard) {
      btnToggleConfigCard.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleGenerationConfigCard();
      });
    }

    if (configCardHeader) {
      configCardHeader.addEventListener('click', (e) => {
        if (e.target.closest('button, input, select, .section-ranking-container')) return;
        toggleGenerationConfigCard();
      });
    }

    if (cfgEnableScoreTiers) {
      cfgEnableScoreTiers.addEventListener('change', () => {
        state.generationConfig.enableScoreTiers = cfgEnableScoreTiers.checked;
        if (cfgScoreTiersStatusBadge) {
          cfgScoreTiersStatusBadge.textContent = cfgEnableScoreTiers.checked ? 'On' : 'Off';
        }
        if (advancedScoreSettingsContainer) {
          advancedScoreSettingsContainer.style.display = cfgEnableScoreTiers.checked ? 'block' : 'none';
        }
        updateConfigSummaryBadge();
        updateConfigPreview();
        triggerAutoSave();
      });
    }

    if (cfgEnableSectionPriority) {
      cfgEnableSectionPriority.addEventListener('change', () => {
        const isEnabled = cfgEnableSectionPriority.checked;
        state.generationConfig.enableSectionPriority = isEnabled;
        if (cfgSectionPriorityStatusBadge) {
          cfgSectionPriorityStatusBadge.textContent = isEnabled ? 'On' : 'Off';
        }
        if (sectionPriorityBoardContainer) {
          sectionPriorityBoardContainer.style.display = isEnabled ? 'block' : 'none';
        }
        if (sectionRankingBreadcrumb) {
          sectionRankingBreadcrumb.style.display = isEnabled ? 'inline-flex' : 'none';
        }
        updateConfigSummaryBadge();
        renderSectionRankingUI();
        triggerAutoSave();
      });
    }

    const onNumChange = () => {
      let total = parseInt(cfgTotalComments ? cfgTotalComments.value : 3, 10);
      if (isNaN(total) || total < 1) total = 3;

      let minAch = parseInt(cfgMinAch ? cfgMinAch.value : 1, 10);
      if (isNaN(minAch) || minAch < 0) minAch = 0;

      let maxAch = parseInt(cfgMaxAch ? cfgMaxAch.value : 3, 10);
      if (isNaN(maxAch) || maxAch < minAch) maxAch = minAch;

      let minImp = parseInt(cfgMinImp ? cfgMinImp.value : 1, 10);
      if (isNaN(minImp) || minImp < 0) minImp = 0;

      let maxImp = parseInt(cfgMaxImp ? cfgMaxImp.value : 2, 10);
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

  const classesManagerGrid = document.getElementById('classesManagerGrid');
  const btnCreateClassMain = document.getElementById('btnCreateClassMain');

  if (btnNewClass) {
    btnNewClass.addEventListener('click', () => {
      createNewClassPrompt();
    });
  }

  if (btnCreateClassMain) {
    btnCreateClassMain.addEventListener('click', () => {
      createNewClassPrompt();
    });
  }

  function createNewClassPrompt() {
    const name = prompt('Enter New Class Name (e.g. "12 General Mathematics"):');
    if (name && name.trim()) {
      const newClass = { id: `class_${Date.now()}`, name: name.trim(), assessments: [] };
      StorageService.saveClass(newClass);
      currentClassId = newClass.id;
      currentAssessmentId = null;
  loadClassesUI();
      renderManagerDashboard();
    }
  }

  function renderManagerDashboard() {
    if (!classesManagerGrid) return;
    classesManagerGrid.innerHTML = '';

    const classes = StorageService.getClasses();
    if (classes.length === 0) {
      classesManagerGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: #f8fafc; border-radius: var(--radius-md); border: 2px dashed var(--border-color);">
          <p style="font-size: 1.1rem; color: var(--text-muted); margin-bottom: 1rem;">No Subject Classes created yet.</p>
          <button id="btnEmptyCreateClass" class="btn btn-primary">+ Create Your First Class</button>
        </div>
      `;
      document.getElementById('btnEmptyCreateClass')?.addEventListener('click', createNewClassPrompt);
      return;
    }

    classes.forEach(c => {
      const card = document.createElement('div');
      card.className = 'class-card';

      const assessments = c.assessments || [];
      const assessListHtml = assessments.length === 0
        ? `<div style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; padding: 0.5rem 0;">No assessments added yet. Click "+ Add Assessment" below.</div>`
        : assessments.map(a => {
            const qCount = a.questions ? a.questions.filter(q => !q.isSectionBreak && !q.isSummary && q.included !== false).length : 0;
            const sCount = a.students ? a.students.length : 0;
            const isCurrent = (c.id === currentClassId && a.id === currentAssessmentId);
            return `
              <div class="assessment-card-item">
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <strong style="font-size: 0.95rem; color: var(--text-main);">${a.name}</strong>
                  </div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">
                    ${a.selectedSheet ? `Sheet: <strong>${a.selectedSheet}</strong> | ` : ''}<strong>${qCount}</strong> Questions | <strong>${sCount}</strong> Students
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0;">
                  <button class="btn btn-primary btn-sm btn-open-assess" data-classid="${c.id}" data-assessid="${a.id}" style="display: flex; align-items: center; gap: 0.35rem;">
                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24" style="pointer-events: none;"><path d="M8 5v14l11-7z"></path></svg>
                    <span>Open</span>
                  </button>
                  <button class="btn btn-secondary btn-sm btn-rename-assess" data-classid="${c.id}" data-assessid="${a.id}" title="Rename Assessment" style="display: flex; align-items: center; padding: 0.45rem;">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="pointer-events: none;"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                  </button>
                  <button class="btn btn-danger btn-sm btn-delete-assess" data-classid="${c.id}" data-assessid="${a.id}" title="Delete Assessment" style="display: flex; align-items: center; padding: 0.45rem;">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="pointer-events: none;"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </div>
            `;
          }).join('');

      const spreadsheetSubtitle = c.spreadsheetName
        ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem; display: flex; align-items: center; gap: 0.35rem;">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            ${c.spreadsheetName}
          </div>`
        : '';

      card.innerHTML = `
        <div class="class-card-header">
          <div>
            <div class="class-card-title">${c.name}</div>
            ${spreadsheetSubtitle}
          </div>

          <div style="display: flex; gap: 0.4rem; flex-shrink: 0; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm btn-export-class" data-classid="${c.id}" style="display: flex; align-items: center; padding: 0.45rem;" title="Export Class as JSON">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="pointer-events: none;"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            </button>
            <button class="btn btn-secondary btn-sm btn-rename-class" data-classid="${c.id}" style="display: flex; align-items: center; padding: 0.45rem;" title="Rename Class">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="pointer-events: none;"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
            </button>
            <button class="btn btn-danger btn-sm btn-delete-class" data-classid="${c.id}" style="display: flex; align-items: center; padding: 0.45rem;" title="Delete Class">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="pointer-events: none;"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;">Assessments (${assessments.length})</strong>
          <button class="btn btn-secondary btn-sm btn-add-assess-class" data-classid="${c.id}" style="display: flex; align-items: center; padding: 0.45rem;" title="Add Assessment">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="pointer-events: none;"><path d="M12 4v16m8-8H4"></path></svg>
          </button>
        </div>

        <div class="assessment-list">
          ${assessListHtml}
        </div>
      `;

      classesManagerGrid.appendChild(card);
    });

    // Event bindings inside Manager Grid using closest target selector
    document.querySelectorAll('.btn-export-class').forEach(b => {
      b.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-export-class');
        const classId = btn.getAttribute('data-classid');
        StorageService.exportClass(classId);
      });
    });

    document.querySelectorAll('.btn-open-assess').forEach(b => {
      b.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-open-assess');
        const classId = btn.getAttribute('data-classid');
        const assessId = btn.getAttribute('data-assessid');
        currentClassId = classId;
        currentAssessmentId = assessId;
        loadAssessmentsUI(classId);
        const assess = StorageService.getAssessmentById(classId, assessId);
        const targetStep = (assess && assess.currentStep && assess.currentStep > 0) ? assess.currentStep : 1;
        showStep(targetStep);
      });
    });

    document.querySelectorAll('.btn-add-assess-class').forEach(b => {
      b.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-add-assess-class');
        const classId = btn.getAttribute('data-classid');
        const name = prompt('Enter New Assessment Name (e.g. "SAC 1 - Sequences & Finance"):');
        if (name && name.trim()) {
          const newAssess = StorageService.saveAssessment(classId, { name: name.trim() });
          currentClassId = classId;
          currentAssessmentId = newAssess.id;
      loadClassesUI();
          renderManagerDashboard();
        }
      });
    });

    document.querySelectorAll('.btn-rename-class').forEach(b => {
      b.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-rename-class');
        const classId = btn.getAttribute('data-classid');
        const classObj = StorageService.getClassById(classId);
        if (!classObj) return;
        const newName = prompt('Rename Class:', classObj.name);
        if (newName && newName.trim()) {
          StorageService.saveClass({ id: classId, name: newName.trim() });
      loadClassesUI();
          renderManagerDashboard();
        }
      });
    });

    document.querySelectorAll('.btn-delete-class').forEach(b => {
      b.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete-class');
        const classId = btn.getAttribute('data-classid');
        const classObj = StorageService.getClassById(classId);
        if (!classObj) return;
        if (confirm(`Are you sure you want to delete class "${classObj.name}" and all its assessments?`)) {
          StorageService.deleteClass(classId);
          currentClassId = null;
          currentAssessmentId = null;
      loadClassesUI();
          renderManagerDashboard();
        }
      });
    });

    document.querySelectorAll('.btn-rename-assess').forEach(b => {
      b.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-rename-assess');
        const classId = btn.getAttribute('data-classid');
        const assessId = btn.getAttribute('data-assessid');
        const assess = StorageService.getAssessmentById(classId, assessId);
        if (!assess) return;
        const newName = prompt('Rename Assessment:', assess.name);
        if (newName && newName.trim()) {
          StorageService.saveAssessment(classId, { id: assessId, name: newName.trim() });
      loadClassesUI();
          renderManagerDashboard();
        }
      });
    });

    document.querySelectorAll('.btn-delete-assess').forEach(b => {
      b.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete-assess');
        const classId = btn.getAttribute('data-classid');
        const assessId = btn.getAttribute('data-assessid');
        const assess = StorageService.getAssessmentById(classId, assessId);
        if (!assess) return;
        if (confirm(`Are you sure you want to delete assessment "${assess.name}"?`)) {
          const classObj = StorageService.getClassById(classId);
          classObj.assessments = classObj.assessments.filter(a => a.id !== assessId);
          StorageService.saveClass(classObj);
          if (currentAssessmentId === assessId) currentAssessmentId = null;
      loadClassesUI();
          renderManagerDashboard();
        }
      });
    });
  }

  // Global Export / Import Data Listeners
  const btnExportAllData = document.getElementById('btnExportAllData');
  const btnImportData = document.getElementById('btnImportData');
  const importDataInput = document.getElementById('importDataInput');

  if (btnExportAllData) {
    btnExportAllData.addEventListener('click', () => {
      StorageService.exportAllData();
    });
  }

  if (btnImportData && importDataInput) {
    btnImportData.addEventListener('click', () => {
      importDataInput.value = '';
      importDataInput.click();
    });

    importDataInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          const isSingleClass = parsed.exportType === 'single_class' || (parsed.class && parsed.class.name);
          const isCommentBank = parsed.exportType === 'comment_bank' || (parsed.achievements && parsed.improvements);

          if (isCommentBank) {
            const fileSec = (parsed.section && parsed.section !== 'All') ? parsed.section : null;
            const targetSec = fileSec || activeCommentBankSection;
            const secLabel = targetSec === 'General' ? 'General Comments' : targetSec;
            const modeChoice = confirm(`Importing Comment Bank into [${secLabel}]:\n\nClick OK to MERGE comments into this section.\nClick Cancel to REPLACE comments in this section.`);
            const mode = modeChoice ? 'merge' : 'replace';
            const res = commentBank.importFromJSON(parsed, mode, targetSec);
            if (res.success) {
              renderStep3CommentBank();
              triggerAutoSave();
              alert(`Comment Bank imported successfully!\nAdded: ${res.achievementsAdded} achievements, ${res.improvementsAdded} improvements.`);
            } else {
              alert(`Failed to import comment bank: ${res.message}`);
            }
            return;
          }

          if (isSingleClass) {
            const classObj = parsed.class || parsed;
            const modeChoice = confirm(`Importing Class "${classObj.name || 'Imported'}":\n\nClick OK to MERGE / update this class.\nClick Cancel to OVERWRITE/replace existing class with same ID/name.`);
            const mode = modeChoice ? 'merge' : 'replace';
            const res = StorageService.importClass(classObj, mode);
        loadClassesUI();
            renderManagerDashboard();
            alert(`Class "${res.className}" ${res.action} successfully!`);
            return;
          }

          // Full Data Backup
          const modeChoice = confirm('Importing Full Data Backup:\n\nClick OK to MERGE (keep existing classes and add new ones).\nClick Cancel to REPLACE ALL current classes & assessments with this backup.');
          const mode = modeChoice ? 'merge' : 'replace';
          const res = StorageService.importAllData(parsed, mode);
      loadClassesUI();
          renderManagerDashboard();
          if (res.mode === 'replace') {
            alert(`Full backup restored! Replaced system data with ${res.count} class(es).`);
          } else {
            alert(`Full backup merged! Added ${res.addedCount} new class(es), updated ${res.updatedCount} class(es). Total: ${res.totalCount} classes.`);
          }
        } catch (err) {
          console.error('Import error:', err);
          alert(`Failed to parse imported JSON file:\n${err.message}`);
        }
      };
      reader.readAsText(file);
    });
  }

  if (btnNewAssessment) {
    btnNewAssessment.addEventListener('click', () => {
      if (!currentClassId) {
        alert('Please select or create a Class first.');
        return;
      }
      const name = prompt('Enter New Assessment Name (e.g. "SAC 1 - Sequences & Finance"):');
      if (name && name.trim()) {
        const newAssess = StorageService.saveAssessment(currentClassId, { name: name.trim() });
        currentAssessmentId = newAssess.id;
        loadAssessmentsUI(currentClassId);
      }
    });
  }

  if (classSelect) {
    classSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        currentClassId = e.target.value;
        currentAssessmentId = null;
        loadAssessmentsUI(currentClassId);
      } else if (btnNewClass) {
        btnNewClass.click();
      }
    });
  }

  if (assessmentSelect) {
    assessmentSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        currentAssessmentId = e.target.value;
        restoreAssessmentData(currentClassId, currentAssessmentId);
      } else if (btnNewAssessment) {
        btnNewAssessment.click();
      }
    });
  }

  // DOM Elements
  const stepItems = document.querySelectorAll('.step-item');
  const stepPanels = document.querySelectorAll('.step-panel');
  
  // Step 1 DOM
  const spreadsheetDropzone = document.getElementById('spreadsheetDropzone');
  const spreadsheetInput = document.getElementById('spreadsheetInput');
  const spreadsheetStatus = document.getElementById('spreadsheetStatus');
  const sheetSelectContainer = document.getElementById('sheetSelectContainer');
  const sheetSelect = document.getElementById('sheetSelect');
  
  const detectionNotice = document.getElementById('detectionNotice');
  const detectionDetails = document.getElementById('detectionDetails');
  const btnGotoStep2 = document.getElementById('btnGotoStep2');

  // Step 2 DOM
  const questionsTableBody = document.getElementById('questionsTableBody');
  const btnAddQuestion = document.getElementById('btnAddQuestion');
  const btnGotoStep3 = document.getElementById('btnGotoStep3');

  // Step 3 DOM
  const achieveCount = document.getElementById('achieveCount');
  const improveCount = document.getElementById('improveCount');
  const achievementsList = document.getElementById('achievementsList');
  const improvementsList = document.getElementById('improvementsList');
  const btnAddAchievement = document.getElementById('btnAddAchievement');
  const btnAddImprovement = document.getElementById('btnAddImprovement');
  const btnBulkPasteAchieve = document.getElementById('btnBulkPasteAchieve');
  const btnBulkPasteImprove = document.getElementById('btnBulkPasteImprove');
  const btnGotoStep4 = document.getElementById('btnGotoStep4');
  const sectionTabs = document.getElementById('sectionTabs');
  let activeCommentBankSection = 'General';

  // Bulk Paste Modal DOM
  const bulkPasteModal = document.getElementById('bulkPasteModal');
  const bulkCategorySelect = document.getElementById('bulkCategorySelect');
  const bulkSectionSelect = document.getElementById('bulkSectionSelect');
  const bulkPasteTextarea = document.getElementById('bulkPasteTextarea');
  const bulkPreviewText = document.getElementById('bulkPreviewText');
  const btnCloseBulkModal = document.getElementById('btnCloseBulkModal');
  const btnCancelBulk = document.getElementById('btnCancelBulk');
  const btnSubmitBulk = document.getElementById('btnSubmitBulk');

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

  function openBulkModal(category = 'achievements') {
    bulkCategorySelect.value = category;
    bulkPasteTextarea.value = '';
    bulkPreviewText.textContent = '0 comments detected';

    // Populate Target Section dropdown
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

    bulkPasteModal.style.display = 'flex';
    setTimeout(() => bulkPasteTextarea.focus(), 50);
  }

  function closeBulkModal() {
    bulkPasteModal.style.display = 'none';
  }

  function getLinesFromBulkInput() {
    return bulkPasteTextarea.value
      .split(/\r?\n/)
      .map(line => line.trim().replace(/^"|"$/g, '').trim())
      .filter(line => line.length > 0);
  }

  btnBulkPasteAchieve.addEventListener('click', () => openBulkModal('achievements'));
  btnBulkPasteImprove.addEventListener('click', () => openBulkModal('improvements'));
  btnCloseBulkModal.addEventListener('click', closeBulkModal);
  btnCancelBulk.addEventListener('click', closeBulkModal);

  bulkPasteTextarea.addEventListener('input', () => {
    const count = getLinesFromBulkInput().length;
    bulkPreviewText.textContent = `${count} comment${count === 1 ? '' : 's'} detected`;
  });

  btnSubmitBulk.addEventListener('click', () => {
    const lines = getLinesFromBulkInput();
    if (lines.length === 0) {
      alert('Please paste at least one comment line.');
      return;
    }

    const category = bulkCategorySelect.value;
    const targetSection = bulkSectionSelect ? bulkSectionSelect.value : activeCommentBankSection;

    lines.forEach(text => {
      const parsed = CommentEngine.parseCommentEntry(text);
      const tags = (Array.isArray(parsed?.tags) && parsed.tags.length > 0) ? parsed.tags : ['Imported'];
      if (category === 'achievements') {
        commentBank.addAchievement(parsed.text, tags, parsed.questionId, targetSection, parsed.questionIds);
      } else {
        commentBank.addImprovement(parsed.text, tags, parsed.questionId, targetSection, parsed.questionIds);
      }
    });

    closeBulkModal();
    renderStep3CommentBank();
    triggerAutoSave();
  });

  // Step 4 DOM
  const btnGenerateAll = document.getElementById('btnGenerateAll');
  const btnExportExcel = document.getElementById('btnExportExcel');
  const searchStudent = document.getElementById('searchStudent');
  const totalStudentsCount = document.getElementById('totalStudentsCount');
  const studentCardsContainer = document.getElementById('studentCardsContainer');
  const progressContainer = document.getElementById('progressContainer');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressPercent = document.getElementById('progressPercent');
  const progressStatusText = document.getElementById('progressStatusText');

  // Back Buttons
  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetStep = parseInt(e.target.getAttribute('data-target'), 10);
      showStep(targetStep);
    });
  });

  // --- Step Navigation ---
  function showStep(stepNum) {
    state.currentStep = stepNum;
    const isDashboard = (stepNum === 0);

    stepItems.forEach(item => {
      const itemStep = parseInt(item.getAttribute('data-step'), 10);
      item.classList.remove('active', 'completed');
      if (itemStep === stepNum) item.classList.add('active');
      if (itemStep < stepNum && itemStep > 0) item.classList.add('completed');

      if (itemStep === 0) {
        // Manager Dashboard is always visible and navigable in the navbar
        item.style.display = 'flex';
      } else {
        // Steps 1-4 are hidden in dashboard and become visible when an assessment is open
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
    if (stepNum === 3) renderStep3CommentBank();
    if (stepNum === 4) {
      renderStep4Dashboard();
      setTimeout(autoResizeAllCommentBoxes, 50);
    }

    updateHeaderContext();
    triggerAutoSave();
  }

  stepItems.forEach(item => {
    item.addEventListener('click', () => {
      const step = parseInt(item.getAttribute('data-step'), 10);
      if (state.currentStep === 0 && step > 0) {
        return;
      }
      showStep(step);
    });
  });

  // --- Step 1 Upload UI State Synchronizer ---
  function updateStep1UploadUI() {
    const hasData = (state.students && state.students.length > 0) && (state.spreadsheetName || state.spreadsheetFile);
    if (!hasData) {
      if (spreadsheetStatus) spreadsheetStatus.innerHTML = '';
      if (sheetSelectContainer) sheetSelectContainer.style.display = 'none';
      if (detectionNotice) detectionNotice.style.display = 'none';
      if (btnGotoStep2) btnGotoStep2.disabled = true;
      if (spreadsheetInput) spreadsheetInput.value = '';
      return;
    }

    const sheetName = state.selectedSheet || state.excelData?.sheetName || (state.availableSheets && state.availableSheets[0]) || 'Default';
    const fileName = state.spreadsheetName || state.spreadsheetFile?.name || 'Uploaded Gradebook';

    if (spreadsheetStatus) {
      spreadsheetStatus.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; color: #059669; font-weight: 600;">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg>
          <span>Gradebook Loaded: <strong>${fileName}</strong></span>
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

    if (detectionNotice && detectionDetails) {
      detectionNotice.style.display = 'flex';
      const qCount = state.questions ? state.questions.filter(q => !q.isSectionBreak && !q.isSummary).length : 0;
      detectionDetails.textContent = `Active Sheet: "${sheetName}". Loaded ${state.students.length} student records across ${qCount} questions.`;
    }

    if (btnGotoStep2) {
      btnGotoStep2.disabled = false;
    }
  }

  function loadDemoDataIfRequested() {
    if (!window.location.search.includes('demo=1')) return;

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
      { id: 'stud_1', name: 'Alice Smith', scores: { 'Q1': 1, 'Q2': 1, 'Q3': 1, 'Q4': 1, 'Q5': 1, 'Q1a': 1, 'Q1b': 2, 'Q1c': 2, 'Q1d': 3, 'Q2': 4, 'Q3': 3, 'Total Mark': 20, '%': 1.0 } },
      { id: 'stud_2', name: 'Edward Elric', scores: { 'Q1': 1, 'Q2': 1, 'Q3': 1, 'Q4': 1, 'Q5': 0, 'Q1a': 1, 'Q1b': 2, 'Q1c': 2, 'Q1d': 3, 'Q2': 3, 'Q3': 3, 'Total Mark': 18, '%': 0.9 } },
      { id: 'stud_3', name: 'Charlie Brown', scores: { 'Q1': 1, 'Q2': 0, 'Q3': 1, 'Q4': 1, 'Q5': 1, 'Q1a': 1, 'Q1b': 1, 'Q1c': 2, 'Q1d': 2, 'Q2': 3, 'Q3': 2, 'Total Mark': 14, '%': 0.7 } },
      { id: 'stud_4', name: 'Bob Jones', scores: { 'Q1': 1, 'Q2': 0, 'Q3': 1, 'Q4': 0, 'Q5': 0, 'Q1a': 1, 'Q1b': 1, 'Q1c': 1, 'Q1d': 1, 'Q2': 2, 'Q3': 1, 'Total Mark': 9, '%': 0.45 } },
      { id: 'stud_5', name: 'Diana Prince', scores: { 'Q1': 0, 'Q2': 0, 'Q3': 1, 'Q4': 0, 'Q5': 0, 'Q1a': 0, 'Q1b': 1, 'Q1c': 0, 'Q1d': 1, 'Q2': 1, 'Q3': 1, 'Total Mark': 5, '%': 0.25 } }
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

    const demoComments = {
      'stud_1': 'Alice has achieved an outstanding result (100%) in this assessment. She correctly identified the order of a matrix and evaluated dimensions accurately. Additionally, she successfully interpreted information from within a real-world application matrix and used Dijkstra’s algorithm to determine the shortest path and its overall distance.',
      'stud_2': 'Edward demonstrated an excellent mastery of course content (90%). He accurately evaluated matrix operations and solved short-answer network paths with precision. He also demonstrated understanding of scalar multiplication. Edward is encouraged to review multiple-choice definitions regarding planar graphs to consolidate concepts.',
      'stud_3': 'Charlie achieved a very good standard (70%) on this task. He demonstrated good competence with matrix interpretation and short answer network diagrams. To improve future performance, Charlie should practice setting up matrix row-by-column multiplications carefully and double-check element coordinates during multiple-choice questions.',
      'stud_4': 'Bob completed the assessment with a developing level of understanding (45%). He successfully identified matrix orders in basic problem contexts. Bob should focus on regular revision of scalar multiplication steps and ensure full working out is shown systematically for all multi-step problems.',
      'stud_5': 'Diana achieved a limited standard (25%) on this assessment. She showed positive effort when interpreting single-entry matrix values. Diana is strongly encouraged to attend scheduled revision tutorials, practice identifying row and column orders, and consolidate understanding of bipartite graph allocations.'
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
          generationConfig: { totalComments: 3, enableScoreTiers: false, enableSectionPriority: false, minAchievements: 1, maxAchievements: 3, minImprovements: 1, maxImprovements: 2, highThreshold: 70, midThreshold: 50 },
          commentBank: demoBank,
          generatedComments: demoComments,
          currentStep: 4,
          updatedAt: Date.now()
        },
        {
          id: 'assess_sac2',
          name: 'SAC 2 - Financial Modelling',
          spreadsheetName: 'Year12_SAC1_Results.xlsx',
          selectedSheet: 'SAC 2 Networks',
          questions: [],
          students: [],
          sectionRanking: ['Financial', 'General'],
          commentBank: { achievements: [], improvements: [] },
          generatedComments: {},
          currentStep: 1,
          updatedAt: Date.now() - 86400000
        }
      ],
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now()
    };

    const demoYear10 = {
      id: 'class_demo_year10',
      name: 'Year 10 Advanced Mathematics',
      spreadsheetName: 'Year10_Term3_Algebra.xlsx',
      availableSheets: ['Sheet1'],
      selectedSheet: 'Sheet1',
      assessments: [
        {
          id: 'assess_y10_t3',
          name: 'Task 1 - Non-Linear Graphs',
          questions: [],
          students: [],
          sectionRanking: ['General'],
          commentBank: { achievements: [], improvements: [] },
          generatedComments: {},
          currentStep: 1,
          updatedAt: Date.now() - 250000000
        }
      ],
      createdAt: Date.now() - 300000000,
      updatedAt: Date.now() - 250000000
    };

    StorageService.saveClass(demoClass);
    StorageService.saveClass(demoYear10);
    StorageService.setActiveContext('class_demo_maths', 'assess_sac1');
  }

  loadDemoDataIfRequested();
  loadClassesUI();

  // Restore active assessment or URL hash if available
  const hashStepMatch = window.location.hash.match(/#step-(\d+)/);
  const activeCtx = StorageService.getActiveContext();
  let initialStep = 0;

  if (activeCtx && activeCtx.classId && activeCtx.assessmentId) {
    const classObj = StorageService.getClassById(activeCtx.classId);
    const assessObj = StorageService.getAssessmentById(activeCtx.classId, activeCtx.assessmentId);
    if (classObj && assessObj) {
      currentClassId = activeCtx.classId;
      currentAssessmentId = activeCtx.assessmentId;
      if (classSelect) classSelect.value = currentClassId;
      loadAssessmentsUI(currentClassId);
      if (assessmentSelect) assessmentSelect.value = currentAssessmentId;
      restoreAssessmentData(currentClassId, currentAssessmentId);
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

  // --- Step 1: File Upload Handlers ---
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
      spreadsheetStatus.textContent = `File selected: ${file.name}`;
      
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

      // Update classObj with spreadsheet info and base64
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

      // Build initial questions state from detected spreadsheet columns
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
    } catch (err) {
      alert(`Error parsing spreadsheet: ${err.message}`);
      spreadsheetStatus.textContent = 'Error parsing file.';
    }
  }

  sheetSelect.addEventListener('change', async (e) => {
    const targetSheet = e.target.value;
    if (state.spreadsheetFile && spreadsheetArrayBuffer) {
      await handleSpreadsheetSelect(state.spreadsheetFile, targetSheet);
    } else if (spreadsheetArrayBuffer) {
      const mockFile = { name: state.spreadsheetName || 'Gradebook.xlsx' };
      await handleSpreadsheetSelect(mockFile, targetSheet);
    }
    triggerAutoSave();
  });

  btnGotoStep2.addEventListener('click', () => showStep(2));

  // --- Step 2: Question Structure Editor with Section Breaks ---
  const btnAddSectionBreak = document.getElementById('btnAddSectionBreak');

  /**
   * Recalculates question IDs scoped to their containing section.
   * Ensures that duplicate column headers across different sections (e.g. Q3 in Section A and Q3 in Section B)
   * are both cleanly named Q3 without global _2 suffixes.
   */
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

      // Determine the base question identifier
      let baseId = '';
      if (q.headerName && q.headerName !== 'Manual Entry') {
        baseId = ExcelParser.cleanQuestionName(q.headerName, idx);
      } else if (q.id) {
        baseId = q.id.replace(/_\d+$/, '');
      } else {
        baseId = `Q${idx + 1}`;
      }

      // Check if this baseId has already appeared in the CURRENT section
      if (usedMap.has(baseId)) {
        const count = usedMap.get(baseId) + 1;
        usedMap.set(baseId, count);
        q.id = `${baseId}_${count}`;
      } else {
        usedMap.set(baseId, 1);
        q.id = baseId;
      }
    });

    // Synchronize student score key references
    if (state.students && state.students.length > 0) {
      // First count occurrences of each q.id across ALL active questions to detect cross-section duplicates
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
              // Always store section-scoped key if question has a section
              if (q.section && q.section !== 'General') {
                student.scores[`${q.section}__${q.id}`] = val;
              }
              // If q.id is unique across the entire test, safe to set student.scores[q.id]
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

  function renderStep2Questions() {
    questionsTableBody.innerHTML = '';
    if (!state.questions || state.questions.length === 0) {
      questionsTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No questions loaded yet. Upload a spreadsheet in Step 1 or click "+ Add Question" below.
          </td>
        </tr>
      `;
      return;
    }
    let currentSectionName = 'General';

    state.questions.forEach((q, idx) => {
      // Check if this item is a Section Break
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
                <input type="text" class="section-break-name-input q-sec-title-input" value="${q.name || q.sectionName || q.title || ''}" data-idx="${idx}" placeholder="Enter Section Name / Topic...">
              </div>
              <div style="display: flex; align-items: center; gap: 0.35rem;">
                <button class="btn btn-secondary btn-sm btn-move-sec-up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Move Section Up">
                  <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7"></path></svg>
                </button>
                <button class="btn btn-secondary btn-sm btn-move-sec-down" data-idx="${idx}" ${idx === state.questions.length - 1 ? 'disabled' : ''} title="Move Section Down">
                  <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <button class="btn btn-danger btn-sm btn-del-sec" data-idx="${idx}">Remove</button>
              </div>
            </div>
          </td>
        `;
        questionsTableBody.appendChild(tr);
        return;
      }

      const isSpecial = q.isPenalty || q.isTotal || q.isPercentage || q.isSummary;

      // Assign current section to normal questions only (penalty, total, percentage columns do not belong to sections)
      q.section = isSpecial ? null : currentSectionName;

      const tr = document.createElement('tr');
      tr.className = 'draggable-row';
      tr.setAttribute('draggable', 'true');
      tr.setAttribute('data-idx', idx);

      // Subquestion Checkbox Cell
      const subCheckHtml = isSpecial
        ? `<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">N/A</span>`
        : `<input type="checkbox" class="q-sub-check" ${q.isSubQuestion ? 'checked' : ''} data-idx="${idx}">`;

      // Include Checkbox Cell
      let includeHtml = '';
      if (q.isPenalty) {
        includeHtml = `<input type="checkbox" class="q-include-check" ${q.included ? 'checked' : ''} data-idx="${idx}">`;
      } else if (q.isTotal || q.isPercentage || q.isSummary) {
        includeHtml = `<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">Excluded</span>`;
      } else {
        includeHtml = `<input type="checkbox" class="q-include-check" ${q.included ? 'checked' : ''} data-idx="${idx}">`;
      }

      // Max Marks Cell
      const marksHtml = q.isPenalty
        ? `<span style="font-weight: 600; font-size: 0.85rem;">0</span>`
        : (q.isTotal || q.isPercentage ? `<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">N/A</span>` : `<input type="number" class="input-table q-marks-input" value="${q.maxMarks}" min="0" step="0.5" data-idx="${idx}" style="width: 70px;">`);

      // Section Badge (Only for normal questions assigned to a specific section)
      const sectionBadgeHtml = (!isSpecial && q.section && q.section !== 'General')
        ? `<span style="display: inline-block; font-size: 0.725rem; background-color: #e0e7ff; color: var(--primary); font-weight: 600; padding: 2px 6px; border-radius: 4px; margin-top: 3px;">${q.section}</span>`
        : '';

      tr.innerHTML = `
        <td style="text-align: center;">
          <span class="drag-handle" title="Drag and drop to reposition this question">⋮⋮</span>
        </td>
        <td><strong>${q.headerName || q.id}</strong></td>
        <td>
          <input type="text" class="input-table q-id-input" value="${q.id}" data-idx="${idx}">
          ${sectionBadgeHtml}
        </td>
        <td>${marksHtml}</td>
        <td style="text-align: center;">${subCheckHtml}</td>
        <td style="text-align: center;">${includeHtml}</td>
        <td>
          <div style="display: flex; gap: 0.35rem; align-items: center;">
            <button class="btn btn-secondary btn-sm btn-split-here" data-idx="${idx}" title="Insert a section break directly above this question" style="font-size: 0.775rem; padding: 0.25rem 0.5rem; display: inline-flex; align-items: center; gap: 0.25rem; white-space: nowrap;">
              <span>+ Split Section</span>
            </button>
            <button class="btn btn-danger btn-sm btn-del-q" data-idx="${idx}" style="font-size: 0.775rem; padding: 0.25rem 0.5rem;">Remove</button>
          </div>
        </td>
      `;

      questionsTableBody.appendChild(tr);
    });

    // Drag and Drop Event Listeners for Question Table Rows
    let draggedIdx = null;

    document.querySelectorAll('.draggable-row').forEach(row => {
      row.addEventListener('dragstart', (e) => {
        // Prevent drag initiation when selecting text inside inputs or textareas
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') {
          e.preventDefault();
          return;
        }

        draggedIdx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        e.currentTarget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(draggedIdx));
      });

      row.addEventListener('dragend', (e) => {
        e.currentTarget.classList.remove('dragging');
        document.querySelectorAll('.draggable-row').forEach(r => {
          r.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        draggedIdx = null;
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const targetRow = e.currentTarget;
        const targetIdx = parseInt(targetRow.getAttribute('data-idx'), 10);
        if (draggedIdx === null || targetIdx === draggedIdx) return;

        const rect = targetRow.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        targetRow.classList.remove('drag-over-top', 'drag-over-bottom');
        if (e.clientY < midY) {
          targetRow.classList.add('drag-over-top');
        } else {
          targetRow.classList.add('drag-over-bottom');
        }
      });

      row.addEventListener('dragleave', (e) => {
        e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetRow = e.currentTarget;
        const targetIdx = parseInt(targetRow.getAttribute('data-idx'), 10);
        targetRow.classList.remove('drag-over-top', 'drag-over-bottom');

        if (draggedIdx === null || targetIdx === draggedIdx) return;

        const rect = targetRow.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertBefore = e.clientY < midY;

        // Perform array reordering
        const [movedItem] = state.questions.splice(draggedIdx, 1);
        
        let newIdx = targetIdx;
        if (draggedIdx < targetIdx) {
          newIdx = insertBefore ? targetIdx - 1 : targetIdx;
        } else {
          newIdx = insertBefore ? targetIdx : targetIdx + 1;
        }

        // Clamp to valid range
        newIdx = Math.max(0, Math.min(state.questions.length, newIdx));
        state.questions.splice(newIdx, 0, movedItem);

        recalculateQuestionIdsBySection();
        renderStep2Questions();
        triggerAutoSave();
      });
    });

    // Event bindings for Section Break actions
    document.querySelectorAll('.q-sec-title-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        state.questions[idx].name = e.target.value.trim() || 'Section';
        recalculateQuestionIdsBySection();
        renderStep2Questions();
        triggerAutoSave();
      });
    });

    document.querySelectorAll('.btn-move-sec-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        if (idx > 0) {
          const item = state.questions.splice(idx, 1)[0];
          state.questions.splice(idx - 1, 0, item);
          recalculateQuestionIdsBySection();
          renderStep2Questions();
          triggerAutoSave();
        }
      });
    });

    document.querySelectorAll('.btn-move-sec-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        if (idx < state.questions.length - 1) {
          const item = state.questions.splice(idx, 1)[0];
          state.questions.splice(idx + 1, 0, item);
          recalculateQuestionIdsBySection();
          renderStep2Questions();
          triggerAutoSave();
        }
      });
    });

    document.querySelectorAll('.btn-del-sec').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        state.questions.splice(idx, 1);
        recalculateQuestionIdsBySection();
        renderStep2Questions();
        triggerAutoSave();
      });
    });

    // Event bindings for "+ Split Here" button
    document.querySelectorAll('.btn-split-here').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.closest('.btn-split-here').getAttribute('data-idx'), 10);
        const existingBreaks = state.questions.filter(q => q.isSectionBreak);
        const defaultLetter = String.fromCharCode(65 + existingBreaks.length);
        const name = prompt('Enter Section Name / Topic for new split:', `Section ${defaultLetter}`);
        if (name && name.trim()) {
          state.questions.splice(idx, 0, {
            isSectionBreak: true,
            id: `sec_${Date.now()}`,
            name: name.trim()
          });
          recalculateQuestionIdsBySection();
          renderStep2Questions();
          triggerAutoSave();
        }
      });
    });

    // Event bindings for question edit inputs
    document.querySelectorAll('.q-id-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        state.questions[idx].id = e.target.value.trim();
        recalculateQuestionIdsBySection();
        renderStep2Questions();
        triggerAutoSave();
      });
    });

    document.querySelectorAll('.q-marks-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        state.questions[idx].maxMarks = parseFloat(e.target.value) || 0;
        triggerAutoSave();
      });
    });

    document.querySelectorAll('.q-sub-check').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        state.questions[idx].isSubQuestion = e.target.checked;
        triggerAutoSave();
      });
    });

    document.querySelectorAll('.q-include-check').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        state.questions[idx].included = e.target.checked;
        triggerAutoSave();
      });
    });

    document.querySelectorAll('.btn-del-q').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        state.questions.splice(idx, 1);
        recalculateQuestionIdsBySection();
        renderStep2Questions();
        triggerAutoSave();
      });
    });
  }

  btnAddQuestion.addEventListener('click', () => {
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
  });

  if (btnAddSectionBreak) {
    btnAddSectionBreak.addEventListener('click', () => {
      const existingBreaks = state.questions.filter(q => q.isSectionBreak);
      const defaultLetter = String.fromCharCode(65 + existingBreaks.length);
      const name = prompt('Enter Section Name (e.g. "Section A - Financial Mathematics"):', `Section ${defaultLetter}`);
      if (name && name.trim()) {
        state.questions.push({
          isSectionBreak: true,
          id: `sec_${Date.now()}`,
          name: name.trim()
        });
        recalculateQuestionIdsBySection();
        renderStep2Questions();
        triggerAutoSave();
      }
    });
  }

  btnGotoStep3.addEventListener('click', () => showStep(3));

  // --- Step 3: Comment Bank Management with Section Tabs ---
  function renderStep3CommentBank() {
    const sections = getAssessmentSections();
    if (!sections.includes(activeCommentBankSection)) {
      activeCommentBankSection = sections[0] || 'General';
    }

    // Render Section Tabs
    if (sectionTabs) {
      sectionTabs.innerHTML = '';
      sections.forEach(sec => {
        const achs = commentBank.getAchievementsBySection(sec);
        const imps = commentBank.getImprovementsBySection(sec);
        const count = achs.length + imps.length;

        const btn = document.createElement('button');
        btn.className = `section-tab-btn ${sec === activeCommentBankSection ? 'active' : ''}`;
        btn.setAttribute('data-section', sec);
        btn.innerHTML = `
          <span>${sec === 'General' ? 'General Comments' : sec}</span>
          <span class="tab-count">${count}</span>
        `;
        btn.addEventListener('click', () => {
          activeCommentBankSection = sec;
          renderStep3CommentBank();
        });
        sectionTabs.appendChild(btn);
      });
    }

    // Get comments for active section
    const filteredAchievements = commentBank.getAchievementsBySection(activeCommentBankSection);
    const filteredImprovements = commentBank.getImprovementsBySection(activeCommentBankSection);

    achieveCount.textContent = filteredAchievements.length;
    improveCount.textContent = filteredImprovements.length;

    achievementsList.innerHTML = '';
    filteredAchievements.forEach(item => {
      // Auto-normalize if text contains unstripped prefix or missing multi-question tags
      const parsed = CommentEngine.parseCommentEntry(item);
      item.text = parsed.text;
      item.questionIds = parsed.questionIds;
      item.questionId = parsed.questionId;
      item.tags = parsed.tags || [];

      const card = document.createElement('div');
      card.className = 'comment-card';
      const qDisplay = (item.questionIds && item.questionIds.length > 0) ? item.questionIds.join(', ') : item.questionId;
      const qLink = qDisplay ? `<span class="tag-pill" style="background:var(--primary-light); color:var(--primary-text); font-weight:700;">Question ${qDisplay}</span>` : '';
      const secPill = item.section && item.section !== 'General' ? `<span class="tag-pill">${item.section}</span>` : '';

      card.innerHTML = `
        <div class="comment-card-content">
          <div>${item.text}</div>
          <div class="tag-list">
            ${qLink}
            ${secPill}
            ${(item.tags || []).map(t => `<span class="tag-pill">${t}</span>`).join('')}
          </div>
        </div>
        <button class="btn btn-danger btn-sm btn-del-ach" data-id="${item.id}" title="Remove comment">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"></path></svg>
        </button>
      `;
      achievementsList.appendChild(card);
    });

    improvementsList.innerHTML = '';
    filteredImprovements.forEach(item => {
      // Auto-normalize if text contains unstripped prefix or missing multi-question tags
      const parsed = CommentEngine.parseCommentEntry(item);
      item.text = parsed.text;
      item.questionIds = parsed.questionIds;
      item.questionId = parsed.questionId;
      item.tags = parsed.tags || [];

      const card = document.createElement('div');
      card.className = 'comment-card';
      const qDisplay = (item.questionIds && item.questionIds.length > 0) ? item.questionIds.join(', ') : item.questionId;
      const qLink = qDisplay ? `<span class="tag-pill" style="background:var(--primary-light); color:var(--primary-text); font-weight:700;">Question ${qDisplay}</span>` : '';
      const secPill = item.section && item.section !== 'General' ? `<span class="tag-pill">${item.section}</span>` : '';

      card.innerHTML = `
        <div class="comment-card-content">
          <div>${item.text}</div>
          <div class="tag-list">
            ${qLink}
            ${secPill}
            ${(item.tags || []).map(t => `<span class="tag-pill">${t}</span>`).join('')}
          </div>
        </div>
        <button class="btn btn-danger btn-sm btn-del-imp" data-id="${item.id}" title="Remove comment">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"></path></svg>
        </button>
      `;
      improvementsList.appendChild(card);
    });

    document.querySelectorAll('.btn-del-ach').forEach(b => {
      b.addEventListener('click', (e) => {
        commentBank.deleteAchievement(e.target.getAttribute('data-id'));
        renderStep3CommentBank();
      });
    });

    document.querySelectorAll('.btn-del-imp').forEach(b => {
      b.addEventListener('click', (e) => {
        commentBank.deleteImprovement(e.target.getAttribute('data-id'));
        renderStep3CommentBank();
      });
    });
  }

  btnAddAchievement.addEventListener('click', () => {
    const secLabel = activeCommentBankSection === 'General' ? 'General' : activeCommentBankSection;
    const text = prompt(`Enter new Achievement comment for [${secLabel}]:`);
    if (text && text.trim()) {
      commentBank.addAchievement(text.trim(), ['Custom'], null, activeCommentBankSection);
      renderStep3CommentBank();
      triggerAutoSave();
    }
  });

  btnAddImprovement.addEventListener('click', () => {
    const secLabel = activeCommentBankSection === 'General' ? 'General' : activeCommentBankSection;
    const text = prompt(`Enter new Improvement comment for [${secLabel}]:`);
    if (text && text.trim()) {
      commentBank.addImprovement(text.trim(), ['Custom'], null, activeCommentBankSection);
      renderStep3CommentBank();
      triggerAutoSave();
    }
  });

  // Clear Section Achievements Handler
  const btnClearSectionAchieve = document.getElementById('btnClearSectionAchieve');
  if (btnClearSectionAchieve) {
    btnClearSectionAchieve.addEventListener('click', () => {
      const secLabel = activeCommentBankSection === 'General' ? 'General Comments' : activeCommentBankSection;
      const count = commentBank.getAchievementsBySection(activeCommentBankSection).length;
      if (count === 0) return;
      if (confirm(`Are you sure you want to clear all ${count} achievements in [${secLabel}]?`)) {
        commentBank.clearSectionAchievements(activeCommentBankSection);
        renderStep3CommentBank();
        triggerAutoSave();
      }
    });
  }

  // Clear Section Improvements Handler
  const btnClearSectionImprove = document.getElementById('btnClearSectionImprove');
  if (btnClearSectionImprove) {
    btnClearSectionImprove.addEventListener('click', () => {
      const secLabel = activeCommentBankSection === 'General' ? 'General Comments' : activeCommentBankSection;
      const count = commentBank.getImprovementsBySection(activeCommentBankSection).length;
      if (count === 0) return;
      if (confirm(`Are you sure you want to clear all ${count} improvements in [${secLabel}]?`)) {
        commentBank.clearSectionImprovements(activeCommentBankSection);
        renderStep3CommentBank();
        triggerAutoSave();
      }
    });
  }

  // Clear Active Section (both achievements & improvements) Handler
  const btnClearActiveSection = document.getElementById('btnClearActiveSection');
  if (btnClearActiveSection) {
    btnClearActiveSection.addEventListener('click', () => {
      const secLabel = activeCommentBankSection === 'General' ? 'General Comments' : activeCommentBankSection;
      const achs = commentBank.getAchievementsBySection(activeCommentBankSection).length;
      const imps = commentBank.getImprovementsBySection(activeCommentBankSection).length;
      const total = achs + imps;
      if (total === 0) return;
      if (confirm(`Are you sure you want to clear all ${total} comments (achievements & improvements) in [${secLabel}]?`)) {
        commentBank.clearSection(activeCommentBankSection);
        renderStep3CommentBank();
        triggerAutoSave();
      }
    });
  }

  // Clear All Comment Banks across All Sections Handler
  const btnClearAllCommentBanks = document.getElementById('btnClearAllCommentBanks');
  if (btnClearAllCommentBanks) {
    btnClearAllCommentBanks.addEventListener('click', () => {
      const total = commentBank.achievements.length + commentBank.improvements.length;
      if (total === 0) return;
      if (confirm(`Are you sure you want to clear ALL ${total} comments across ALL sections? This cannot be undone.`)) {
        commentBank.clearAll();
        renderStep3CommentBank();
        triggerAutoSave();
      }
    });
  }

  // Comment Bank Export / Import Listeners
  const btnExportCommentBank = document.getElementById('btnExportCommentBank');
  const btnImportCommentBank = document.getElementById('btnImportCommentBank');
  const importCommentBankInput = document.getElementById('importCommentBankInput');

  if (btnExportCommentBank) {
    btnExportCommentBank.addEventListener('click', () => {
      const assessName = assessmentSelect && assessmentSelect.selectedIndex >= 0
        ? assessmentSelect.options[assessmentSelect.selectedIndex]?.text
        : 'Assessment';

      const isSpecificSection = activeCommentBankSection && activeCommentBankSection !== 'General';
      const secChoice = confirm(`Do you want to export ONLY the active section [${activeCommentBankSection === 'General' ? 'General Comments' : activeCommentBankSection}]?\n\nClick OK to export [${activeCommentBankSection}].\nClick Cancel to export ALL sections across this assessment.`);
      const targetSec = secChoice ? activeCommentBankSection : 'All';
      commentBank.downloadJSON(targetSec, assessName);
    });
  }

  if (btnImportCommentBank && importCommentBankInput) {
    btnImportCommentBank.addEventListener('click', () => {
      importCommentBankInput.value = '';
      importCommentBankInput.click();
    });

    importCommentBankInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          const fileSec = (parsed.section && parsed.section !== 'All') ? parsed.section : null;
          const targetSec = fileSec || activeCommentBankSection;
          const secLabel = targetSec === 'General' ? 'General Comments' : targetSec;
          const modeChoice = confirm(`Importing Comment Bank into [${secLabel}]:\n\nClick OK to MERGE comments (keep existing comments and append new unique ones).\nClick Cancel to REPLACE existing comments in this section.`);
          const mode = modeChoice ? 'merge' : 'replace';
          const res = commentBank.importFromJSON(parsed, mode, targetSec);
          if (res.success) {
            if (fileSec) activeCommentBankSection = fileSec;
            renderStep3CommentBank();
            triggerAutoSave();
            alert(`Comment Bank imported successfully!\nAdded: ${res.achievementsAdded} achievements, ${res.improvementsAdded} improvements.\nTotal in Bank: ${res.totalAchievements} achievements, ${res.totalImprovements} improvements.`);
          } else {
            alert(`Failed to import comment bank: ${res.message}`);
          }
        } catch (err) {
          console.error('Comment bank import error:', err);
          alert(`Failed to import comment bank JSON file:\n${err.message}`);
        }
      };
      reader.readAsText(file);
    });
  }

  btnGotoStep4.addEventListener('click', () => showStep(4));

  // --- Step 4: Comment Dashboard & Export ---
  function renderStep4Dashboard() {
    syncSectionRanking();
    totalStudentsCount.textContent = state.students.length;
    renderStudentCards(state.students);
  }

  function renderStudentCards(studentsToRender) {
    studentCardsContainer.innerHTML = '';
    if (!studentsToRender || studentsToRender.length === 0) {
      studentCardsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: #ffffff; border-radius: var(--radius-md); border: 1px dashed var(--border-color); color: var(--text-muted);">
          No student records found. Upload a graded spreadsheet in Step 1 to generate comments.
        </div>
      `;
      return;
    }
    const activeQuestions = state.questions.filter(q => !q.isSectionBreak && q.included);

    studentsToRender.forEach(student => {
      // Calculate overall score (checks against sheet Total and Percentage if present)
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

      const card = document.createElement('div');
      card.className = 'student-comment-card';

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

      card.innerHTML = `
        <div class="student-card-header">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span class="student-name">${student.name}</span>
            <span class="tag-pill" style="${bandStyle} font-weight: 700;">${band}</span>
          </div>
          <div class="student-score-badge">
            Score: ${totalObtained} / ${totalMax} (${isZeroOutOfZero ? '0%' : pct + '%'})
          </div>
        </div>

        <textarea class="comment-textarea student-comment-input" data-id="${student.id}" placeholder="Student feedback comment will appear here after clicking 'Generate All Comments' or 'Regenerate'...">${commentText}</textarea>

        <div class="card-actions">
          <button class="btn btn-secondary btn-sm btn-copy-comment" data-id="${student.id}">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
            <span>Copy</span>
          </button>
          <button class="btn btn-secondary btn-sm btn-regen-single" data-id="${student.id}">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            <span>Regenerate</span>
          </button>
          <button class="btn btn-danger btn-sm btn-clear-single" data-id="${student.id}">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            <span>Clear</span>
          </button>
        </div>
      `;

      studentCardsContainer.appendChild(card);
    });

    // Event listeners for comment editing & single student regeneration / clearing
    document.querySelectorAll('.student-comment-input').forEach(txt => {
      autoResizeCommentTextarea(txt);

      txt.addEventListener('input', (e) => {
        autoResizeCommentTextarea(e.target);
      });

      txt.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        state.generatedComments[id] = e.target.value;
        triggerAutoSave();
      });
    });

    requestAnimationFrame(() => autoResizeAllCommentBoxes());

    document.querySelectorAll('.btn-copy-comment').forEach(b => {
      b.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const text = state.generatedComments[id] || '';
        navigator.clipboard.writeText(text);
        b.innerHTML = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg> <span>Copied</span>';
        setTimeout(() => {
          b.innerHTML = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg> <span>Copy</span>';
        }, 1500);
      });
    });

    document.querySelectorAll('.btn-clear-single').forEach(b => {
      b.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        delete state.generatedComments[id];
        const txt = document.querySelector(`.student-comment-input[data-id="${id}"]`);
        if (txt) {
          txt.value = '';
          autoResizeCommentTextarea(txt);
        }
        triggerAutoSave();
      });
    });

    document.querySelectorAll('.btn-regen-single').forEach(b => {
      b.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const student = state.students.find(s => s.id === id);
        if (!student) return;

        // Minimise generation settings upon generating
        toggleGenerationConfigCard(false);

        b.innerHTML = '<span>Regenerating...</span>';
        b.disabled = true;

        const config = {
          ...state.generationConfig,
          tone: 'formal and encouraging'
        };

        const activeQuestions = state.questions.filter(q => !q.isSectionBreak && q.included);
        try {
          const comment = CommentEngine.generateCommentsForStudent(student, activeQuestions, commentBank, config, state.sectionRanking);
          state.generatedComments[id] = comment;
          renderStudentCards(state.students);
          triggerAutoSave();
        } catch (err) {
          console.error(`Single generation failed for ${student.name}:`, err);
        } finally {
          b.disabled = false;
          b.innerHTML = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> <span>Regenerate</span>';
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

  // Cancel Generation Button Handler
  const btnCancelGeneration = document.getElementById('btnCancelGeneration');
  if (btnCancelGeneration) {
    btnCancelGeneration.addEventListener('click', () => {
      if (!state.isGenerating) return;
      state.isGenerating = false;
      btnCancelGeneration.disabled = true;
      btnCancelGeneration.innerHTML = `<span>Stopping...</span>`;
      const progressStatusText = document.getElementById('progressStatusText');
      if (progressStatusText) progressStatusText.textContent = 'Stopping generation...';
    });
  }

  // Clear All Comments Button Handler
  const btnClearAllComments = document.getElementById('btnClearAllComments');
  if (btnClearAllComments) {
    btnClearAllComments.addEventListener('click', () => {
      if (Object.keys(state.generatedComments).length === 0) return;
      if (confirm('Are you sure you want to clear all generated comments for all students?')) {
        state.generatedComments = {};
        renderStudentCards(state.students);
        triggerAutoSave();
      }
    });
  }

  // Search filter handler
  searchStudent.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const filtered = state.students.filter(s => s.name.toLowerCase().includes(q));
    renderStudentCards(filtered);
  });

  // Helper to run batch generation for a list of students
  function runBatchGeneration(studentsToProcess) {
    if (!studentsToProcess || studentsToProcess.length === 0) return;

    // Minimise generation settings upon generating
    toggleGenerationConfigCard(false);

    state.isGenerating = true;

    btnGenerateAll.disabled = true;
    const btnGenerateMissing = document.getElementById('btnGenerateMissing');
    if (btnGenerateMissing) btnGenerateMissing.disabled = true;
    if (btnCancelGeneration) {
      btnCancelGeneration.disabled = false;
      btnCancelGeneration.innerHTML = `<span>Stop</span>`;
    }
    progressContainer.style.display = 'block';

    const progressStudentName = document.getElementById('progressStudentName');
    const progressStepCount = document.getElementById('progressStepCount');
    const progressStatusText = document.getElementById('progressStatusText');
    const progressBarFill = document.getElementById('progressBarFill');
    const progressPercent = document.getElementById('progressPercent');
    const progressTimeElapsed = document.getElementById('progressTimeElapsed');
    const progressEstTime = document.getElementById('progressEstTime');

    const activeQuestions = state.questions.filter(q => !q.isSectionBreak && q.included);
    const config = {
      ...state.generationConfig,
      tone: 'formal and encouraging'
    };

    const total = studentsToProcess.length;
    const startTime = Date.now();
    const rankingDisplay = (state.sectionRanking && state.sectionRanking.length > 0)
      ? state.sectionRanking.map(tier => Array.isArray(tier) ? tier.join(' = ') : tier).join(' > ')
      : 'General';

    if (progressStatusText) progressStatusText.textContent = `Applying section priority ranking (${rankingDisplay})...`;

    let processed = 0;
    for (let i = 0; i < total; i++) {
      if (!state.isGenerating) {
        break;
      }
      const student = studentsToProcess[i];
      const comment = CommentEngine.generateCommentsForStudent(student, activeQuestions, commentBank, config, state.sectionRanking);
      state.generatedComments[student.id] = comment;
      processed++;

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
      if (progressStatusText) progressStatusText.textContent = `Generated comments for ${processed} student(s) using section priority.`;
      if (progressEstTime) progressEstTime.textContent = 'Complete';
    }

    renderStudentCards(state.students);
    triggerAutoSave();

    state.isGenerating = false;
    btnGenerateAll.disabled = false;
    if (btnGenerateMissing) btnGenerateMissing.disabled = false;
    if (btnCancelGeneration) btnCancelGeneration.disabled = false;

    setTimeout(() => {
      progressContainer.style.display = 'none';
    }, 2500);
  }

  // Batch Generation Handlers
  btnGenerateAll.addEventListener('click', () => {
    if (state.students.length === 0) {
      alert('No student records loaded!');
      return;
    }
    runBatchGeneration(state.students);
  });

  const btnGenerateMissing = document.getElementById('btnGenerateMissing');
  if (btnGenerateMissing) {
    btnGenerateMissing.addEventListener('click', () => {
      if (state.students.length === 0) {
        alert('No student records loaded!');
        return;
      }
      const missingStudents = state.students.filter(s => !state.generatedComments[s.id] || !state.generatedComments[s.id].trim());
      if (missingStudents.length === 0) {
        alert('All students already have generated comments!');
        return;
      }
      runBatchGeneration(missingStudents);
    });
  }

  // Export to Excel Handler
  btnExportExcel.addEventListener('click', () => {
    if (state.students.length === 0) return;

    const activeQuestions = state.questions.filter(q => !q.isSectionBreak && q.included);

    const exportRows = state.students.map(student => {
      const summary = CommentEngine.calculateStudentScoreSummary(student, state.questions);
      const row = {
        'Student Name': student.name
      };

      activeQuestions.forEach(q => {
        const score = CommentEngine.getQuestionScore(student, q);
        const headerKey = (q.section && q.section !== 'General') ? `${q.section} - ${q.id}` : q.id;
        row[headerKey] = score !== undefined && score !== null ? score : '';
      });

      row['Total Mark'] = summary.obtained;
      row['Max Mark'] = summary.max;
      row['Percentage (%)'] = summary.isZeroOutOfZero ? 'NA' : summary.percentage;
      row['Achievement Band'] = summary.band;
      row['Generated Feedback Comment'] = state.generatedComments[student.id] || (summary.isZeroOutOfZero ? 'Incomplete due to absences' : '');

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Feedback Comments');

    XLSX.writeFile(workbook, 'Student_Assessment_Comments.xlsx');
  });
});
