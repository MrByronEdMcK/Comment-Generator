/**
 * Storage Service for Class & Assessment Management + Auto-Save Recovery
 */
class StorageService {
  static STORAGE_KEY_CLASSES = 'cg_classes';
  static STORAGE_KEY_ACTIVE = 'cg_active_context';

  /**
   * Load all classes from localStorage
   * @returns {Array} List of Class objects
   */
  static getClasses() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_CLASSES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error loading classes from localStorage:', e);
      return [];
    }
  }

  /**
   * Save a Class object to localStorage
   * @param {Object} classObj 
   */
  static saveClass(classObj) {
    const classes = this.getClasses();
    const idx = classes.findIndex(c => c.id === classObj.id);

    if (idx >= 0) {
      classes[idx] = {
        ...classes[idx],
        ...classObj,
        spreadsheetName: classObj.spreadsheetName !== undefined ? classObj.spreadsheetName : (classes[idx].spreadsheetName || null),
        availableSheets: classObj.availableSheets !== undefined ? classObj.availableSheets : (classes[idx].availableSheets || null),
        selectedSheet: classObj.selectedSheet !== undefined ? classObj.selectedSheet : (classes[idx].selectedSheet || null),
        spreadsheetBase64: classObj.spreadsheetBase64 !== undefined ? classObj.spreadsheetBase64 : (classes[idx].spreadsheetBase64 || null),
        updatedAt: Date.now()
      };
    } else {
      classes.push({
        id: classObj.id || `class_${Date.now()}`,
        name: classObj.name || 'New Class',
        spreadsheetName: classObj.spreadsheetName || null,
        availableSheets: classObj.availableSheets || null,
        selectedSheet: classObj.selectedSheet || null,
        spreadsheetBase64: classObj.spreadsheetBase64 || null,
        assessments: classObj.assessments || [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    try {
      localStorage.setItem(this.STORAGE_KEY_CLASSES, JSON.stringify(classes));
    } catch (e) {
      console.warn('localStorage quota exceeded while saving class data:', e);
    }
  }

  /**
   * Get a specific Class by ID
   * @param {string} classId 
   * @returns {Object|null}
   */
  static getClassById(classId) {
    const classes = this.getClasses();
    return classes.find(c => c.id === classId) || null;
  }

  /**
   * Delete a Class by ID
   * @param {string} classId 
   */
  static deleteClass(classId) {
    let classes = this.getClasses();
    classes = classes.filter(c => c.id !== classId);
    localStorage.setItem(this.STORAGE_KEY_CLASSES, JSON.stringify(classes));
  }

  /**
   * Save an Assessment inside a Class
   * @param {string} classId 
   * @param {Object} assessmentObj 
   */
  static saveAssessment(classId, assessmentObj) {
    const classObj = this.getClassById(classId);
    if (!classObj) return;

    if (!classObj.assessments) classObj.assessments = [];
    const idx = classObj.assessments.findIndex(a => a.id === assessmentObj.id);

    const updatedAssessment = {
      id: assessmentObj.id || `assess_${Date.now()}`,
      name: assessmentObj.name || 'New Assessment',
      spreadsheetName: assessmentObj.spreadsheetName !== undefined ? assessmentObj.spreadsheetName : (idx >= 0 ? classObj.assessments[idx].spreadsheetName : null),
      availableSheets: assessmentObj.availableSheets !== undefined ? assessmentObj.availableSheets : (idx >= 0 ? classObj.assessments[idx].availableSheets : null),
      selectedSheet: assessmentObj.selectedSheet !== undefined ? assessmentObj.selectedSheet : (idx >= 0 ? classObj.assessments[idx].selectedSheet : null),
      questions: assessmentObj.questions || (idx >= 0 ? classObj.assessments[idx].questions : []),
      commentBank: assessmentObj.commentBank || (idx >= 0 ? classObj.assessments[idx].commentBank : { achievements: [], improvements: [] }),
      generatedComments: assessmentObj.generatedComments || (idx >= 0 ? classObj.assessments[idx].generatedComments : {}),
      sectionRanking: assessmentObj.sectionRanking || (idx >= 0 ? (classObj.assessments[idx].sectionRanking || []) : []),
      students: assessmentObj.students || (idx >= 0 ? classObj.assessments[idx].students : []),
      generationConfig: assessmentObj.generationConfig || (idx >= 0 ? classObj.assessments[idx].generationConfig : null),
      currentStep: assessmentObj.currentStep !== undefined ? assessmentObj.currentStep : (idx >= 0 ? classObj.assessments[idx].currentStep : 1),
      updatedAt: Date.now()
    };

    if (idx >= 0) {
      classObj.assessments[idx] = updatedAssessment;
    } else {
      classObj.assessments.push(updatedAssessment);
    }

    this.saveClass(classObj);
    return updatedAssessment;
  }

  /**
   * Get a specific Assessment by Class ID and Assessment ID
   * @param {string} classId 
   * @param {string} assessmentId 
   * @returns {Object|null}
   */
  static getAssessmentById(classId, assessmentId) {
    const classObj = this.getClassById(classId);
    if (!classObj || !classObj.assessments) return null;
    return classObj.assessments.find(a => a.id === assessmentId) || null;
  }

  /**
   * Save current active class ID and assessment ID context for crash recovery
   * @param {string} classId 
   * @param {string} assessmentId 
   */
  static setActiveContext(classId, assessmentId) {
    localStorage.setItem(this.STORAGE_KEY_ACTIVE, JSON.stringify({
      classId,
      assessmentId,
      timestamp: Date.now()
    }));
  }

  /**
   * Get active context for crash recovery
   * @returns {Object|null}
   */
  static getActiveContext() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_ACTIVE);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Helper: Trigger a file download for JSON data
   */
  static downloadJSON(dataObj, filename) {
    const jsonStr = typeof dataObj === 'string' ? dataObj : JSON.stringify(dataObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Export all data (classes, assessments, comment banks, students, questions)
   */
  static exportAllData() {
    const classes = this.getClasses();
    const activeContext = this.getActiveContext();
    const exportPayload = {
      version: '1.0',
      exportType: 'all_data',
      timestamp: Date.now(),
      exportedAt: new Date().toISOString(),
      classes,
      activeContext
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    this.downloadJSON(exportPayload, `Comment_Generator_All_Data_${dateStr}.json`);
    return exportPayload;
  }

  /**
   * Export an individual Class with all its assessments and comment banks
   */
  static exportClass(classId) {
    const classObj = this.getClassById(classId);
    if (!classObj) return null;

    const exportPayload = {
      version: '1.0',
      exportType: 'single_class',
      timestamp: Date.now(),
      exportedAt: new Date().toISOString(),
      class: classObj
    };

    const safeName = (classObj.name || 'Class').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    this.downloadJSON(exportPayload, `Class_${safeName}_${dateStr}.json`);
    return exportPayload;
  }

  /**
   * Import all data from parsed JSON
   * @param {Object} payload 
   * @param {string} mode 'merge' | 'replace'
   */
  static importAllData(payload, mode = 'merge') {
    if (!payload) throw new Error('Invalid or empty JSON file.');

    let classesToImport = [];
    if (payload.classes && Array.isArray(payload.classes)) {
      classesToImport = payload.classes;
    } else if (Array.isArray(payload)) {
      classesToImport = payload;
    } else if (payload.class && payload.class.id) {
      return this.importClass(payload.class, mode);
    } else {
      throw new Error('Unrecognized backup format. Expected classes data.');
    }

    if (mode === 'replace') {
      localStorage.setItem(this.STORAGE_KEY_CLASSES, JSON.stringify(classesToImport));
      if (payload.activeContext) {
        localStorage.setItem(this.STORAGE_KEY_ACTIVE, JSON.stringify(payload.activeContext));
      }
      return { success: true, count: classesToImport.length, mode: 'replace' };
    }

    // Merge Mode
    const existingClasses = this.getClasses();
    let addedCount = 0;
    let updatedCount = 0;

    classesToImport.forEach(incomingClass => {
      const idx = existingClasses.findIndex(c => c.id === incomingClass.id || (c.name && c.name.toLowerCase() === incomingClass.name?.toLowerCase()));
      if (idx >= 0) {
        const existingAssessments = existingClasses[idx].assessments || [];
        const incomingAssessments = incomingClass.assessments || [];

        incomingAssessments.forEach(inA => {
          const aIdx = existingAssessments.findIndex(ea => ea.id === inA.id || ea.name.toLowerCase() === inA.name.toLowerCase());
          if (aIdx >= 0) {
            existingAssessments[aIdx] = { ...existingAssessments[aIdx], ...inA };
          } else {
            existingAssessments.push(inA);
          }
        });

        existingClasses[idx] = {
          ...existingClasses[idx],
          ...incomingClass,
          assessments: existingAssessments,
          updatedAt: Date.now()
        };
        updatedCount++;
      } else {
        existingClasses.push({
          ...incomingClass,
          id: incomingClass.id || `class_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          updatedAt: Date.now()
        });
        addedCount++;
      }
    });

    localStorage.setItem(this.STORAGE_KEY_CLASSES, JSON.stringify(existingClasses));
    return { success: true, addedCount, updatedCount, totalCount: existingClasses.length, mode: 'merge' };
  }

  /**
   * Import an individual Class
   * @param {Object} classData 
   * @param {string} mode 'merge' | 'replace'
   */
  static importClass(classData, mode = 'merge') {
    if (!classData) throw new Error('Invalid class data.');
    const classObj = classData.class || classData;
    if (!classObj.name && !classObj.id) {
      throw new Error('Class data must contain at least a name or ID.');
    }

    const existingClasses = this.getClasses();
    const idx = existingClasses.findIndex(c => c.id === classObj.id || (c.name && c.name.toLowerCase() === classObj.name.toLowerCase()));

    if (idx >= 0 && mode === 'merge') {
      const existingAssessments = existingClasses[idx].assessments || [];
      const incomingAssessments = classObj.assessments || [];

      incomingAssessments.forEach(inA => {
        const aIdx = existingAssessments.findIndex(ea => ea.id === inA.id || ea.name.toLowerCase() === inA.name.toLowerCase());
        if (aIdx >= 0) {
          existingAssessments[aIdx] = { ...existingAssessments[aIdx], ...inA };
        } else {
          existingAssessments.push(inA);
        }
      });

      existingClasses[idx] = {
        ...existingClasses[idx],
        ...classObj,
        assessments: existingAssessments,
        updatedAt: Date.now()
      };
      localStorage.setItem(this.STORAGE_KEY_CLASSES, JSON.stringify(existingClasses));
      return { success: true, classId: existingClasses[idx].id, className: existingClasses[idx].name, action: 'updated' };
    } else {
      const newId = (idx >= 0 && mode !== 'replace') ? `class_${Date.now()}` : (classObj.id || `class_${Date.now()}`);
      const newName = (idx >= 0 && mode !== 'replace') ? `${classObj.name} (Imported)` : (classObj.name || 'Imported Class');
      const newClass = {
        ...classObj,
        id: newId,
        name: newName,
        createdAt: classObj.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      if (idx >= 0 && mode === 'replace') {
        existingClasses[idx] = newClass;
      } else {
        existingClasses.push(newClass);
      }

      localStorage.setItem(this.STORAGE_KEY_CLASSES, JSON.stringify(existingClasses));
      return { success: true, classId: newClass.id, className: newClass.name, action: 'added' };
    }
  }
}

window.StorageService = StorageService;
