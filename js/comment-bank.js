/**
 * Comment Bank Manager for Achievements & Improvements
 */
class CommentBank {
  constructor() {
    this.achievements = [];
    this.improvements = [];
  }

  addAchievement(text, tags = [], questionId = null, section = null, questionIds = null) {
    const qIds = Array.isArray(questionIds) ? questionIds : (questionId ? [questionId] : []);
    const item = {
      id: `ach_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      text: text.trim(),
      tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean),
      questionId: qIds[0] || questionId || null,
      questionIds: qIds,
      section: section || null
    };
    this.achievements.push(item);
    return item;
  }

  addImprovement(text, tags = [], questionId = null, section = null, questionIds = null) {
    const qIds = Array.isArray(questionIds) ? questionIds : (questionId ? [questionId] : []);
    const item = {
      id: `imp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      text: text.trim(),
      tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean),
      questionId: qIds[0] || questionId || null,
      questionIds: qIds,
      section: section || null
    };
    this.improvements.push(item);
    return item;
  }

  getAchievementsBySection(section = null) {
    if (!section || section === 'General') {
      return this.achievements.filter(a => !a.section || a.section === 'General');
    }
    return this.achievements.filter(a => a.section === section);
  }

  getImprovementsBySection(section = null) {
    if (!section || section === 'General') {
      return this.improvements.filter(i => !i.section || i.section === 'General');
    }
    return this.improvements.filter(i => i.section === section);
  }

  deleteAchievement(id) {
    this.achievements = this.achievements.filter(a => a.id !== id);
  }

  deleteImprovement(id) {
    this.improvements = this.improvements.filter(i => i.id !== id);
  }

  clearSectionAchievements(section = null) {
    if (!section || section === 'General') {
      this.achievements = this.achievements.filter(a => a.section && a.section !== 'General');
    } else {
      this.achievements = this.achievements.filter(a => a.section !== section);
    }
  }

  clearSectionImprovements(section = null) {
    if (!section || section === 'General') {
      this.improvements = this.improvements.filter(i => i.section && i.section !== 'General');
    } else {
      this.improvements = this.improvements.filter(i => i.section !== section);
    }
  }

  clearSection(section = null) {
    this.clearSectionAchievements(section);
    this.clearSectionImprovements(section);
  }

  clearAll() {
    this.achievements = [];
    this.improvements = [];
  }

  reset() {
    this.clearAll();
  }

  toJSON() {
    return {
      achievements: this.achievements,
      improvements: this.improvements
    };
  }

  fromJSON(data) {
    if (!data) {
      this.clearAll();
      return;
    }
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      this.achievements = (parsed.achievements && Array.isArray(parsed.achievements)) ? parsed.achievements : [];
      this.improvements = (parsed.improvements && Array.isArray(parsed.improvements)) ? parsed.improvements : [];
    } catch (e) {
      console.warn('Failed to load comment bank state:', e);
      this.clearAll();
    }
  }

  exportToJSON(section = null) {
    const isAll = !section || section === 'All';
    const achs = isAll ? this.achievements : this.getAchievementsBySection(section);
    const imps = isAll ? this.improvements : this.getImprovementsBySection(section);

    const payload = {
      version: '1.0',
      exportType: 'comment_bank',
      section: isAll ? 'All' : section,
      timestamp: Date.now(),
      exportedAt: new Date().toISOString(),
      achievements: achs,
      improvements: imps
    };

    return JSON.stringify(payload, null, 2);
  }

  downloadJSON(section = null, assessmentName = 'Assessment') {
    const jsonStr = this.exportToJSON(section);
    const isAll = !section || section === 'All';
    const secLabel = isAll ? 'All_Sections' : section.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const safeAssess = assessmentName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Comment_Bank_${safeAssess}_${secLabel}_${dateStr}.json`;

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

  importFromJSON(jsonInput, mode = 'merge', targetSection = null) {
    try {
      const parsed = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
      const incomingAchs = Array.isArray(parsed.achievements) ? parsed.achievements : [];
      const incomingImps = Array.isArray(parsed.improvements) ? parsed.improvements : [];

      if (incomingAchs.length === 0 && incomingImps.length === 0) {
        return { success: false, message: 'No comments found in JSON file.' };
      }

      const fileSec = (parsed.section && parsed.section !== 'All') ? parsed.section : null;

      if (mode === 'replace') {
        const replaceSec = fileSec || (targetSection && targetSection !== 'All' ? targetSection : null);
        if (replaceSec) {
          this.clearSection(replaceSec);
        } else {
          this.clearAll();
        }
      }

      let addedAch = 0;
      let addedImp = 0;

      incomingAchs.forEach(item => {
        const text = item.text || item.comment || (typeof item === 'string' ? item : '');
        if (!text || !text.trim()) return;

        const sec = item.section || fileSec || (targetSection && targetSection !== 'All' ? targetSection : null);
        const tags = Array.isArray(item.tags) ? item.tags : ['Imported'];
        const qIds = item.questionIds || (item.questionId ? [item.questionId] : []);

        const existingInSection = this.getAchievementsBySection(sec);
        const isDup = mode === 'merge' && existingInSection.some(e => e.text.trim().toLowerCase() === text.trim().toLowerCase());
        if (!isDup) {
          this.addAchievement(text, tags, qIds[0] || null, sec, qIds);
          addedAch++;
        }
      });

      incomingImps.forEach(item => {
        const text = item.text || item.comment || (typeof item === 'string' ? item : '');
        if (!text || !text.trim()) return;

        const sec = item.section || fileSec || (targetSection && targetSection !== 'All' ? targetSection : null);
        const tags = Array.isArray(item.tags) ? item.tags : ['Imported'];
        const qIds = item.questionIds || (item.questionId ? [item.questionId] : []);

        const existingInSection = this.getImprovementsBySection(sec);
        const isDup = mode === 'merge' && existingInSection.some(e => e.text.trim().toLowerCase() === text.trim().toLowerCase());
        if (!isDup) {
          this.addImprovement(text, tags, qIds[0] || null, sec, qIds);
          addedImp++;
        }
      });

      return {
        success: true,
        achievementsAdded: addedAch,
        improvementsAdded: addedImp,
        totalAchievements: this.achievements.length,
        totalImprovements: this.improvements.length
      };
    } catch (e) {
      console.error('Failed to import comment bank:', e);
      return { success: false, message: e.message };
    }
  }
}

window.CommentBank = CommentBank;
