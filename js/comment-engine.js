/**
 * Comment Engine - Deterministic, Section-Ranked Assessment Feedback Generator
 * 
 * Features:
 * 1. Analyzes student test results question-by-question and section-by-section.
 * 2. Matches student performance to Comment Bank items using hierarchical question matching & strict section scoping.
 * 3. Selects achievements and improvements based on user-defined Section Priority Ranking (e.g. SAQ > MCQ > General).
 * 4. Staged fallback: High-priority section comments are used first; lower sections and General comments are used only as a last resort.
 * 5. Completely client-side and offline - zero AI, zero server, zero background processes.
 */
class CommentEngine {
  /**
   * Helper: Check if a comment section matches a test question section
   * - General comments can apply across all sections UNLESS question-tagged,
   *   in which case question-tagged comments must strictly stay within matching section.
   * - Opposing section types (e.g. MCQ vs SAQ) NEVER match.
   * - Section aliases match (e.g. "MCQ" matches "Section A - MCQ").
   */
  static isSectionMatch(commentSection, questionSection, isQuestionTagged = false) {
    const cNorm = commentSection ? commentSection.toString().trim().toLowerCase() : '';
    const qNorm = questionSection ? questionSection.toString().trim().toLowerCase() : '';

    const cIsGen = !cNorm || cNorm === 'general' || cNorm === 'all' || cNorm === 'all sections';
    const qIsGen = !qNorm || qNorm === 'general' || qNorm === 'all' || qNorm === 'all sections';

    // Both general
    if (cIsGen && qIsGen) return true;

    // If comment is explicitly tagged to questions, prevent general wildcard crossover into named sections
    if (isQuestionTagged && (cIsGen || qIsGen)) {
      return false;
    }

    if (cIsGen) return true; // Non-question-tagged general comment can apply to any section
    if (qIsGen) return false; // Specific section comment should not match untagged/general question

    if (cNorm === qNorm) return true;

    // Check mutually exclusive section tokens (e.g. MCQ vs SAQ)
    const tokensA = new Set(cNorm.split(/[\s\-_,.:;/\\\\]+/).filter(Boolean));
    const tokensB = new Set(qNorm.split(/[\s\-_,.:;/\\\\]+/).filter(Boolean));

    const isMcq = (toks) => toks.has('mcq') || (toks.has('multiple') && toks.has('choice'));
    const isSaq = (toks) => toks.has('saq') || (toks.has('short') && toks.has('answer')) || toks.has('extended');

    if ((isMcq(tokensA) && isSaq(tokensB)) || (isSaq(tokensA) && isMcq(tokensB))) {
      return false;
    }

    // Check section letters e.g. "Section A" vs "Section B"
    const cSecLetter = cNorm.match(/\bsection\s+([a-z0-9]+)\b/i);
    const qSecLetter = qNorm.match(/\bsection\s+([a-z0-9]+)\b/i);
    if (cSecLetter && qSecLetter) {
      return cSecLetter[1].toLowerCase() === qSecLetter[1].toLowerCase();
    }

    // Check substring match
    if (cNorm.includes(qNorm) || qNorm.includes(cNorm)) {
      return true;
    }

    // Token intersection excluding common noise words
    const noise = new Set(['section', 'part', 'test', 'exam', 'assessment', 'questions', 'question']);
    for (const t of tokensA) {
      if (!noise.has(t) && tokensB.has(t)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Helper: Check if a comment question ID matches a test question ID (supporting parent-to-subquestion hierarchy)
   * e.g. "Q1" matches "1a", "1b", "1c", "Q1a", "Q1b", "1"
   * e.g. "Q1a" matches "1a", "Q1a"
   * e.g. "Q8" matches "8di", "8dii"; "Q8d" matches "8di", "8dii"
   */
  static isQuestionMatch(commentQId, testQId) {
    if (!commentQId || !testQId) return false;

    const cNorm = commentQId.toString().toUpperCase().replace(/^QUESTIONS?\s*/i, '').replace(/^Q/i, '').trim();
    const tNorm = testQId.toString().toUpperCase().replace(/^QUESTIONS?\s*/i, '').replace(/^Q/i, '').trim();

    // 1. Direct normalized match (e.g. "1" === "1", "1A" === "1A", "8DI" === "8DI")
    if (cNorm === tNorm) return true;

    // 2. Parent-to-subquestion match
    // - Whole question to subquestion (e.g. comment is "1" and test is "1A", "1B", "1.1", "8DI")
    const cNumberMatch = cNorm.match(/^(\d+)$/);
    if (cNumberMatch) {
      const cNum = cNumberMatch[1];
      const tNumberMatch = tNorm.match(/^(\d+)[A-Z\.]/i);
      if (tNumberMatch && tNumberMatch[1] === cNum) {
        return true;
      }
    }

    // - Parent subquestion to sub-subquestion (e.g. comment is "8D" and test is "8DI", "8DII")
    const cParentSub = cNorm.match(/^(\d+)([A-Z])$/);
    if (cParentSub) {
      const cNum = cParentSub[1];
      const cLet = cParentSub[2];
      const tSub = tNorm.match(/^(\d+)([A-Z])([A-Z0-9\.]+)$/);
      if (tSub && tSub[1] === cNum && tSub[2] === cLet) {
        return true;
      }
    }

    // 3. Subquestion to parent match
    // - Subquestion to whole question (e.g. comment is "1A", "8DI" and test is "1")
    const tNumberMatch = tNorm.match(/^(\d+)$/);
    if (tNumberMatch) {
      const tNum = tNumberMatch[1];
      const cSubMatch = cNorm.match(/^(\d+)[A-Z\.]/i);
      if (cSubMatch && cSubMatch[1] === tNum) {
        return true;
      }
    }

    // - Sub-subquestion to parent subquestion (e.g. comment is "8DI", "8DII" and test is "8D")
    const tParentSub = tNorm.match(/^(\d+)([A-Z])$/);
    if (tParentSub) {
      const tNum = tParentSub[1];
      const tLet = tParentSub[2];
      const cSub = cNorm.match(/^(\d+)([A-Z])([A-Z0-9\.]+)$/);
      if (cSub && cSub[1] === tNum && cSub[2] === tLet) {
        return true;
      }
    }

    return false;
  }

  /**
   * Helper: Retrieve a student's score for a specific question,
   * respecting column index and section scoping to prevent duplicate question IDs across sections from colliding.
   */
  static getQuestionScore(student, q) {
    if (!student || !student.scores || !q) return undefined;
    const scores = student.scores;

    // 1. Column index match (col_<colIndex>) - highest priority, exact spreadsheet column
    if (q.colIndex !== undefined && q.colIndex !== null && q.colIndex >= 0) {
      const colKey = `col_${q.colIndex}`;
      if (scores[colKey] !== undefined && scores[colKey] !== null) return scores[colKey];
    }

    // 2. Section-scoped match (<section>__<id>) - handles section splits
    if (q.section && q.section !== 'General' && q.id) {
      const secKey = `${q.section}__${q.id}`;
      if (scores[secKey] !== undefined && scores[secKey] !== null) return scores[secKey];
    }

    // 3. Original suggested question ID from parser (e.g. Q1_2)
    if (q.suggestedQuestionId && scores[q.suggestedQuestionId] !== undefined && scores[q.suggestedQuestionId] !== null) {
      return scores[q.suggestedQuestionId];
    }

    // 4. Standard q.id match
    if (q.id && scores[q.id] !== undefined && scores[q.id] !== null) {
      return scores[q.id];
    }

    // 5. Title fallback
    if (q.title && scores[q.title] !== undefined && scores[q.title] !== null) {
      return scores[q.title];
    }

    return undefined;
  }

  /**
   * Helper: Parse question expression into a list of normalized question IDs
   * Handles: "1,2, 4", "Q1, 2, 3", "7a, b", "7a, 7b", "1a, b, c", "1-3", "7a-c", "1a, 1b"
   */
  static extractQuestionIdsFromExpression(expr) {
    const result = [];
    let currentBaseNum = null;

    let clean = expr.replace(/^Questions?\s*/i, '').trim();

    // Whole number range e.g. "1-3", "Q1-Q3", "1 to 3"
    const numRangeMatch = clean.match(/^(?:Q\s*)?(\d+)\s*(?:-|to)\s*(?:Q\s*)?(\d+)$/i);
    if (numRangeMatch) {
      const start = parseInt(numRangeMatch[1], 10);
      const end = parseInt(numRangeMatch[2], 10);
      if (start <= end && end - start <= 30) {
        for (let i = start; i <= end; i++) {
          result.push(`Q${i}`);
        }
        return result;
      }
    }

    // Letter range e.g. "7a-c", "7a to 7c", "Q7a-Q7c"
    const letterRangeMatch = clean.match(/^(?:Q\s*)?(\d+)([a-z])\s*(?:-|to)\s*(?:(?:Q\s*)?\1)?([a-z])$/i);
    if (letterRangeMatch) {
      const baseNum = letterRangeMatch[1];
      const startLetter = letterRangeMatch[2].toLowerCase();
      const endLetter = letterRangeMatch[3].toLowerCase();
      const startCode = startLetter.charCodeAt(0);
      const endCode = endLetter.charCodeAt(0);

      if (startCode <= endCode && endCode - startCode <= 10) {
        for (let code = startCode; code <= endCode; code++) {
          result.push(`Q${baseNum}${String.fromCharCode(code)}`);
        }
        return result;
      }
    }

    // Comma or whitespace-separated parts
    const parts = clean.split(/[,;\s]+/).map(p => p.trim()).filter(Boolean);

    for (const part of parts) {
      const fullSubMatch = part.match(/^(?:Q\s*)?(\d+)([a-z][a-z0-9]*)$/i);
      if (fullSubMatch) {
        currentBaseNum = fullSubMatch[1];
        result.push(`Q${fullSubMatch[1]}${fullSubMatch[2].toLowerCase()}`);
        continue;
      }

      const nakedSubMatch = part.match(/^([a-z][a-z0-9]*)$/i);
      if (nakedSubMatch && currentBaseNum !== null) {
        result.push(`Q${currentBaseNum}${nakedSubMatch[1].toLowerCase()}`);
        continue;
      }

      const wholeNumMatch = part.match(/^(?:Q\s*)?(\d+)$/i);
      if (wholeNumMatch) {
        currentBaseNum = wholeNumMatch[1];
        result.push(`Q${wholeNumMatch[1]}`);
        continue;
      }

      result.push(part.toUpperCase());
    }

    return Array.from(new Set(result));
  }

  /**
   * Helper: Parse a comment entry into a structured object
   */
  static parseCommentEntry(entry) {
    const rawText = typeof entry === 'string' ? entry : (entry?.text || entry?.comment || '');
    const tags = (typeof entry === 'object' && Array.isArray(entry?.tags)) ? [...entry.tags] : [];
    const explicitSection = (typeof entry === 'object' && entry?.section && entry.section !== 'General') ? entry.section : null;

    let questionIds = [];
    if (typeof entry === 'object' && Array.isArray(entry?.questionIds) && entry.questionIds.length > 0) {
      questionIds = entry.questionIds.map(q => q.toString().trim());
    } else if (typeof entry === 'object' && entry?.questionId) {
      questionIds = CommentEngine.extractQuestionIdsFromExpression(entry.questionId.toString());
    }

    let cleanText = (rawText || '').trim();

    // If questionIds not explicitly provided, extract from leading prefix
    // Handles prefixes like "Q1,2, 4\t...", "7a, b Used...", "1\tDetermine...", "Q1-3\t..."
    if (questionIds.length === 0) {
      // 1. Tab separated (typical Excel / spreadsheet column copy-paste)
      if (cleanText.includes('\t')) {
        const tabIdx = cleanText.indexOf('\t');
        const prefix = cleanText.substring(0, tabIdx).trim();
        const remainder = cleanText.substring(tabIdx + 1).trim();
        if (prefix && remainder) {
          const extracted = CommentEngine.extractQuestionIdsFromExpression(prefix);
          if (extracted.length > 0) {
            questionIds = extracted;
            cleanText = remainder;
          }
        }
      }

      // 2. Colon, dash, dot, paren, or whitespace separated with question prefix
      if (questionIds.length === 0) {
        const m = cleanText.match(/^(?:(?:Questions?|Q)\s*)?([0-9]+[a-z0-9\s,\-&to]*?)(?:\s*[:\.\-\)]+\s+|\s*[\t]+\s*)([A-Z].*)$/i);
        if (m) {
          const prefix = m[1].trim();
          const remainder = m[2].trim();
          const extracted = CommentEngine.extractQuestionIdsFromExpression(prefix);
          if (extracted.length > 0) {
            questionIds = extracted;
            cleanText = remainder;
          }
        }
      }

      // 3. Simple space before capital letter e.g. "Q1 Correctly...", "8di Demonstrated..."
      if (questionIds.length === 0) {
        const m2 = cleanText.match(/^(?:(?:Questions?|Q)\s*)?([0-9]+[a-z]{0,4})\s+([A-Z].*)$/i);
        if (m2) {
          const prefix = m2[1].trim();
          const remainder = m2[2].trim();
          const extracted = CommentEngine.extractQuestionIdsFromExpression(prefix);
          if (extracted.length > 0) {
            questionIds = extracted;
            cleanText = remainder;
          }
        }
      }
    }

    if (questionIds.length === 0 && tags.length > 0) {
      tags.forEach(t => {
        const m = t.match(/^(?:Q\s*)?(\d+)([a-z]+)?$/i);
        if (m) {
          const num = m[1];
          const letter = m[2] ? m[2].toLowerCase() : '';
          const qId = `Q${num}${letter}`;
          if (!questionIds.includes(qId)) {
            questionIds.push(qId);
          }
        }
      });
    }

    cleanText = cleanText.replace(/^(?:(?:Questions?|Q)\s*\d+[a-z]*[\s:\.\-\)]+)/i, '').trim();

    const customTags = tags.filter(t => !/^(?:Q\s*)?\d+[a-z]*$/i.test(t) && !questionIds.includes(t));
    const isGeneral = questionIds.length === 0 && (!explicitSection || explicitSection === 'General');

    return {
      text: cleanText,
      rawText,
      questionId: questionIds.length > 0 ? questionIds[0] : null,
      questionIds,
      section: explicitSection,
      tags: customTags,
      isGeneral
    };
  }

  /**
   * Centralized score summary calculation matching authoritative sheet Total/Percentage
   */
  static calculateStudentScoreSummary(student, questions = []) {
    const rawScores = student.scores || {};
    let calculatedObtained = 0;
    let calculatedMax = 0;
    let scoredQuestionsCount = 0;
    let nonZeroQuestionsCount = 0;
    let hasExplicitAbsence = false;

    const validQuestions = (questions || []).filter(q => !q.isSectionBreak && !q.isTotal && !q.isPercentage && !q.isSummary && q.included !== false);

    validQuestions.forEach(q => {
      const val = CommentEngine.getQuestionScore(student, q);
      if (val === 'NA' || val === 'N/A' || val === 'absent') {
        hasExplicitAbsence = true;
        return;
      }
      if (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) {
        const score = parseFloat(val);
        scoredQuestionsCount++;
        if (score > 0) nonZeroQuestionsCount++;

        if (q.isPenalty) {
          calculatedObtained += score;
          return;
        }

        const maxMarks = q.maxMarks !== undefined ? parseFloat(q.maxMarks) : 1;
        calculatedObtained += score;
        if (maxMarks > 0) {
          calculatedMax += maxMarks;
        }
      }
    });

    let sheetTotal = null;
    let sheetPct = null;

    for (const [key, val] of Object.entries(rawScores)) {
      const lowerKey = key.toLowerCase();
      if (val === 'NA' || val === 'N/A' || val === 'absent') {
        hasExplicitAbsence = true;
      }
      if (lowerKey === 'total' || lowerKey.startsWith('total_') || lowerKey === 'sum' || lowerKey.includes('total mark')) {
        if (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) {
          sheetTotal = Number(val);
        }
      }
      if (lowerKey === 'percentage' || lowerKey.startsWith('percentage_') || lowerKey === '%' || lowerKey.includes('percent')) {
        if (typeof val === 'string' && val.includes('%')) {
          const parsed = parseFloat(val.replace('%', '').trim());
          if (!isNaN(parsed)) sheetPct = Math.round(parsed);
        } else if (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) {
          const num = Number(val);
          if (num > 0 && num <= 1.0) {
            sheetPct = Math.round(num * 100);
          } else {
            sheetPct = Math.round(num);
          }
        }
      }
    }

    const isZeroOutOfZero = hasExplicitAbsence ||
      (scoredQuestionsCount === 0 && sheetTotal === null && sheetPct === null) ||
      (calculatedMax === 0 && (sheetTotal === null || sheetTotal === 0)) ||
      (sheetTotal === 0 && sheetPct === 0 && scoredQuestionsCount === 0);

    const totalObtained = (sheetTotal !== null && !isNaN(sheetTotal)) ? sheetTotal : calculatedObtained;

    let percentage = 0;
    if (isZeroOutOfZero) {
      percentage = 0;
    } else if (sheetPct !== null && !isNaN(sheetPct)) {
      percentage = sheetPct;
    } else if (calculatedMax > 0) {
      percentage = Math.round((totalObtained / calculatedMax) * 100);
    }

    let totalMax = calculatedMax;
    if (totalMax === 0 && sheetTotal !== null && sheetPct !== null && sheetPct > 0) {
      totalMax = Math.round((sheetTotal / (sheetPct / 100)));
    }
    if (totalMax === 0 && sheetTotal !== null && sheetTotal > 0) {
      totalMax = sheetTotal;
    }

    const band = isZeroOutOfZero ? 'Incomplete' : CommentEngine.getAchievementBand(percentage);

    return {
      obtained: totalObtained,
      max: totalMax,
      percentage,
      band,
      isZeroOutOfZero
    };
  }

  /**
   * Helper: Calculate standard achievement band from percentage
   */
  static getAchievementBand(pct) {
    if (pct === 'Incomplete') return 'Incomplete';
    if (pct === 'NA' || pct === undefined || pct === null) return 'NA';
    const num = Number(pct);
    if (isNaN(num)) return 'NA';

    const ratio = num > 1.0 ? num / 100 : num;
    if (ratio >= 0.9) return 'Outstanding';
    if (ratio >= 0.8) return 'Excellent';
    if (ratio >= 0.7) return 'Very Good';
    if (ratio >= 0.6) return 'Good';
    if (ratio >= 0.5) return 'Moderate';
    if (ratio >= 0.4) return 'Limited';
    if (ratio >= 0.2) return 'Low';
    if (ratio >= 0.01) return 'Very Low';
    return 'Ungraded';
  }

  /**
   * Compute dynamic sentence distribution based on percentage and config.
   * By default (enableScoreTiers = false): all students receive uniform comments (default: 3)
   * with no score-differentiated tier differences.
   * When enabled (enableScoreTiers = true): uses performance tiers and customizable thresholds.
   */
  static getTargetDistribution(pct, config = {}) {
    if (config.enableScoreTiers === false) {
      // By default: uniform comment count with no difference for higher/mid/lower scores
      const total = parseInt(config.totalComments, 10) || 3;
      const targetAch = Math.max(1, Math.ceil(total / 2));
      const targetImp = Math.max(1, total - targetAch);
      return { targetAch, targetImp, total: targetAch + targetImp };
    }

    const total = parseInt(config.totalComments, 10) || 6;
    const minAch = parseInt(config.minAchievements, 10) !== undefined ? parseInt(config.minAchievements, 10) : 1;
    const maxAch = parseInt(config.maxAchievements, 10) !== undefined ? parseInt(config.maxAchievements, 10) : 4;
    const minImp = parseInt(config.minImprovements, 10) !== undefined ? parseInt(config.minImprovements, 10) : 1;
    const maxImp = parseInt(config.maxImprovements, 10) !== undefined ? parseInt(config.maxImprovements, 10) : 4;

    const highThreshold = config.highThreshold !== undefined && !isNaN(parseInt(config.highThreshold, 10))
      ? parseInt(config.highThreshold, 10)
      : 70;
    const midThreshold = config.midThreshold !== undefined && !isNaN(parseInt(config.midThreshold, 10))
      ? parseInt(config.midThreshold, 10)
      : 50;

    let targetAch;
    if (pct >= highThreshold) {
      targetAch = Math.min(maxAch, total - minImp);
    } else if (pct < midThreshold) {
      targetAch = Math.max(minAch, total - maxImp);
    } else {
      targetAch = Math.round(total / 2);
    }

    targetAch = Math.max(minAch, Math.min(maxAch, targetAch));
    const targetImp = Math.max(minImp, Math.min(maxImp, total - targetAch));

    return { targetAch, targetImp, total: targetAch + targetImp };
  }

  /**
   * Helper: Normalize section priority ranking into tiers (Array<Array<string>>).
   * By default: places all sections in a single row/tier (equal preference).
   * Supports:
   * - Tiered arrays: [['SAQ', 'MCQ'], ['General']]
   * - Flat string arrays: ['SAQ', 'MCQ', 'General']
   * - Equality-joined strings: ['SAQ = MCQ', 'General']
   */
  static normalizeSectionTiers(sectionRanking = [], validSections = []) {
    const tiers = [];
    if (Array.isArray(sectionRanking)) {
      sectionRanking.forEach(entry => {
        if (Array.isArray(entry)) {
          const sub = entry.map(s => String(s).trim()).filter(Boolean);
          if (sub.length > 0) tiers.push(sub);
        } else if (typeof entry === 'string') {
          const parts = entry.split('=').map(s => s.trim()).filter(Boolean);
          if (parts.length > 0) tiers.push(parts);
        }
      });
    }

    // If no existing tiers configured, put all sections in a single row/tier by default!
    if (tiers.length === 0) {
      const all = [];
      (validSections || []).forEach(sec => {
        const s = String(sec).trim();
        if (s && !all.includes(s)) all.push(s);
      });
      if (!all.includes('General')) all.push('General');
      return [all];
    }

    const placedSections = new Set();
    tiers.forEach(tier => tier.forEach(sec => placedSections.add(sec)));

    (validSections || []).forEach(sec => {
      const s = String(sec).trim();
      if (s && s !== 'General' && !placedSections.has(s)) {
        if (tiers[0]) tiers[0].push(s);
        else tiers.push([s]);
        placedSections.add(s);
      }
    });

    if (!placedSections.has('General')) {
      if (tiers.length === 1) {
        tiers[0].push('General');
      } else {
        tiers.push(['General']);
      }
      placedSections.add('General');
    }

    return tiers;
  }

  /**
   * Step 1: Analyze Student Performance Question-by-Question and Section-by-Section
   */
  static analyzeStudentPerformance(student, questions, commentBank) {
    const scoreSummary = CommentEngine.calculateStudentScoreSummary(student, questions);
    const validQuestions = (questions || []).filter(q => !q.isSectionBreak && !q.isTotal && !q.isPercentage && !q.isSummary && q.included !== false);

    const correctQuestions = [];
    const incorrectQuestions = [];
    const sectionScores = {};

    validQuestions.forEach(q => {
      const rawVal = CommentEngine.getQuestionScore(student, q);
      if (rawVal === undefined || rawVal === null || rawVal === '' || isNaN(Number(rawVal)) || rawVal === 'NA') {
        return;
      }
      const score = parseFloat(rawVal);
      if (q.isPenalty) return;

      const maxMarks = q.maxMarks || 1;
      const pct = maxMarks > 0 ? (score / maxMarks) * 100 : 0;
      const sec = q.section || 'General';

      if (!sectionScores[sec]) {
        sectionScores[sec] = { section: sec, obtained: 0, max: 0, count: 0 };
      }
      sectionScores[sec].obtained += score;
      sectionScores[sec].max += maxMarks;
      sectionScores[sec].count += 1;

      const qInfo = {
        id: q.id || q.title,
        title: q.title || q.id,
        section: sec,
        score,
        maxMarks,
        pct
      };

      if (pct >= 50) {
        correctQuestions.push(qInfo);
      } else {
        incorrectQuestions.push(qInfo);
      }
    });

    Object.values(sectionScores).forEach(s => {
      s.pct = s.max > 0 ? Math.round((s.obtained / s.max) * 100) : 0;
      s.mastered = s.pct >= 50;
    });

    correctQuestions.sort((a, b) => b.pct - a.pct);
    incorrectQuestions.sort((a, b) => a.pct - b.pct);

    return {
      scoreSummary,
      sectionScores,
      correctQuestions,
      incorrectQuestions,
      validQuestions
    };
  }

  /**
   * Normalize a comment for duplicate comparison
   */
  static normalizeText(text) {
    return (text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Main Generator: Selects comments according to user's Section Priority Ranking
   * 
   * Strategy:
   * 1. High-priority section comments (e.g. SAQ) are evaluated and selected first.
   * 2. If target is not reached, proceeds to next section (e.g. MCQ).
   * 3. General comments are used ONLY as a last resort if higher-priority sections lack matching items.
   * 4. Enforces non-overlap so improvements never contradict achievements.
   * 5. If criteria are insufficient, leaves remaining slots clean without canned placeholders.
   */
  static generateCommentsForStudent(student, questions, commentBank, config = {}, sectionRanking = []) {
    const analysis = CommentEngine.analyzeStudentPerformance(student, questions, commentBank);

    if (analysis.scoreSummary.isZeroOutOfZero) {
      return "Incomplete due to absences";
    }

    const pct = analysis.scoreSummary.percentage;
    const { targetAch, targetImp } = CommentEngine.getTargetDistribution(pct, config);

    // Build active ranking tiers (normalizing equal-priority tiers and ensuring 'General' is the fallback)
    const validSections = new Set();
    analysis.validQuestions.forEach(q => {
      if (q.section && q.section !== 'General') validSections.add(q.section);
    });
    (commentBank?.achievements || []).forEach(a => {
      if (a.section && a.section !== 'General') validSections.add(a.section);
    });
    (commentBank?.improvements || []).forEach(i => {
      if (i.section && i.section !== 'General') validSections.add(i.section);
    });

    const normalizedTiers = CommentEngine.normalizeSectionTiers(sectionRanking, Array.from(validSections));

    // Flatten all distinct section names to establish comment candidate buckets
    const allSections = [];
    normalizedTiers.forEach(tier => {
      tier.forEach(sec => {
        if (!allSections.includes(sec)) allSections.push(sec);
      });
    });

    // If section priority is explicitly disabled via toggle, pool all sections into equal priority (single tier)
    const tiers = (config.enableSectionPriority === false) ? [allSections] : normalizedTiers;

    // Parse all comments from bank
    const parsedAchievements = (commentBank?.achievements || []).map(CommentEngine.parseCommentEntry);
    const parsedImprovements = (commentBank?.improvements || []).map(CommentEngine.parseCommentEntry);

    // Group candidates by section
    const achBySection = {};
    const impBySection = {};
    allSections.forEach(sec => {
      achBySection[sec] = [];
      impBySection[sec] = [];
    });

    // 1. Partition qualifying Achievements into section buckets
    parsedAchievements.forEach(a => {
      const isTagged = Array.isArray(a.questionIds) && a.questionIds.length > 0;
      if (isTagged) {
        // Find test questions matching within section
        const matched = analysis.validQuestions.filter(q => {
          if (!CommentEngine.isSectionMatch(a.section, q.section, true)) return false;
          return a.questionIds.some(qId => CommentEngine.isQuestionMatch(qId, q.id || q.title));
        });

        if (matched.length > 0) {
          let obtained = 0;
          let max = 0;
          matched.forEach(q => {
            const qScore = CommentEngine.getQuestionScore(student, q);
            obtained += (qScore !== undefined && qScore !== null && !isNaN(Number(qScore))) ? parseFloat(qScore) : 0;
            max += q.maxMarks || 1;
          });
          const matchPct = max > 0 ? (obtained / max) * 100 : 0;
          if (matchPct >= 50) {
            // Assign to matched question's section
            const targetSec = matched[0].section || a.section || 'General';
            const bucketKey = allSections.find(r => CommentEngine.isSectionMatch(targetSec, r)) || 'General';
            if (!achBySection[bucketKey]) achBySection[bucketKey] = [];
            achBySection[bucketKey].push({ text: a.text, pct: matchPct, isQuestion: true });
          }
        }
      } else if (a.section && a.section !== 'General') {
        const secStats = analysis.sectionScores[a.section];
        if (secStats && secStats.mastered) {
          const bucketKey = allSections.find(r => CommentEngine.isSectionMatch(a.section, r)) || 'General';
          if (!achBySection[bucketKey]) achBySection[bucketKey] = [];
          achBySection[bucketKey].push({ text: a.text, pct: secStats.pct, isQuestion: false });
        }
      } else if (a.isGeneral) {
        if (!achBySection['General']) achBySection['General'] = [];
        achBySection['General'].push({ text: a.text, pct: 100, isQuestion: false });
      }
    });

    // 2. Partition qualifying Improvements into section buckets
    parsedImprovements.forEach(i => {
      const isTagged = Array.isArray(i.questionIds) && i.questionIds.length > 0;
      if (isTagged) {
        const matched = analysis.validQuestions.filter(q => {
          if (!CommentEngine.isSectionMatch(i.section, q.section, true)) return false;
          return i.questionIds.some(qId => CommentEngine.isQuestionMatch(qId, q.id || q.title));
        });

        if (matched.length > 0) {
          let obtained = 0;
          let max = 0;
          matched.forEach(q => {
            const qScore = CommentEngine.getQuestionScore(student, q);
            obtained += (qScore !== undefined && qScore !== null && !isNaN(Number(qScore))) ? parseFloat(qScore) : 0;
            max += q.maxMarks || 1;
          });
          const matchPct = max > 0 ? (obtained / max) * 100 : 0;
          if (matchPct < 50) {
            const targetSec = matched[0].section || i.section || 'General';
            const bucketKey = allSections.find(r => CommentEngine.isSectionMatch(targetSec, r)) || 'General';
            if (!impBySection[bucketKey]) impBySection[bucketKey] = [];
            impBySection[bucketKey].push({ text: i.text, pct: matchPct, isQuestion: true });
          }
        }
      } else if (i.section && i.section !== 'General') {
        const secStats = analysis.sectionScores[i.section];
        if (secStats && !secStats.mastered) {
          const bucketKey = allSections.find(r => CommentEngine.isSectionMatch(i.section, r)) || 'General';
          if (!impBySection[bucketKey]) impBySection[bucketKey] = [];
          impBySection[bucketKey].push({ text: i.text, pct: secStats.pct, isQuestion: false });
        }
      } else if (i.isGeneral) {
        if (!impBySection['General']) impBySection['General'] = [];
        impBySection['General'].push({ text: i.text, pct: 0, isQuestion: false });
      }
    });

    // Helper: Fisher-Yates array shuffle for random sampling
    const shuffleArray = (array) => {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    // Extract normalized sentences from currentComment if provided to avoid repeating the exact same comment on regenerate
    const previousNorms = new Set();
    if (config.currentComment && typeof config.currentComment === 'string') {
      const prevLines = config.currentComment.split(/\r?\n+/);
      prevLines.forEach(line => {
        const cleaned = line.replace(/Achievements:\s*/gi, '').replace(/Improvements:\s*/gi, '').trim();
        if (cleaned) {
          const norm = CommentEngine.normalizeText(cleaned);
          if (norm) previousNorms.add(norm);
        }
      });
    }

    // 3. Staged Selection Following Section Priority Tiers (Equal priority sections pooled together)
    // Comments are selected at random from the possible/qualifying candidates for each student,
    // rather than always taking the first available comment.
    const selectedAch = [];
    const seenAchNorms = new Set();

    for (const tier of tiers) {
      if (selectedAch.length >= targetAch) break;
      const pool = [];
      tier.forEach(secName => {
        if (achBySection[secName]) {
          pool.push(...achBySection[secName]);
        }
      });

      // Filter to unique candidate items not yet selected
      const available = [];
      const localSeen = new Set();
      for (const item of pool) {
        const norm = CommentEngine.normalizeText(item.text);
        if (norm && !seenAchNorms.has(norm) && !localSeen.has(norm)) {
          localSeen.add(norm);
          available.push(item);
        }
      }

      // Group into question-specific and general/section candidate pools
      const qCandidates = available.filter(i => i.isQuestion);
      const gCandidates = available.filter(i => !i.isQuestion);

      // Prioritize candidates not previously used if regenerating, then shuffle
      const unusedQ = qCandidates.filter(c => !previousNorms.has(CommentEngine.normalizeText(c.text)));
      const usedQ = qCandidates.filter(c => previousNorms.has(CommentEngine.normalizeText(c.text)));
      const shuffledQ = [...shuffleArray(unusedQ), ...shuffleArray(usedQ)];

      for (const item of shuffledQ) {
        if (selectedAch.length >= targetAch) break;
        const norm = CommentEngine.normalizeText(item.text);
        seenAchNorms.add(norm);
        selectedAch.push(item.text);
      }

      // If more achievements are needed to reach target, select from general/section candidates
      if (selectedAch.length < targetAch && gCandidates.length > 0) {
        const unusedG = gCandidates.filter(c => !previousNorms.has(CommentEngine.normalizeText(c.text)));
        const usedG = gCandidates.filter(c => previousNorms.has(CommentEngine.normalizeText(c.text)));
        const shuffledG = [...shuffleArray(unusedG), ...shuffleArray(usedG)];

        for (const item of shuffledG) {
          if (selectedAch.length >= targetAch) break;
          const norm = CommentEngine.normalizeText(item.text);
          if (!seenAchNorms.has(norm)) {
            seenAchNorms.add(norm);
            selectedAch.push(item.text);
          }
        }
      }
    }

    const selectedImp = [];
    const seenImpNorms = new Set();

    for (const tier of tiers) {
      if (selectedImp.length >= targetImp) break;
      const pool = [];
      tier.forEach(secName => {
        if (impBySection[secName]) {
          pool.push(...impBySection[secName]);
        }
      });

      // Filter to unique candidate items not yet selected and not contradicting achievements
      const available = [];
      const localSeen = new Set();
      for (const item of pool) {
        const norm = CommentEngine.normalizeText(item.text);
        if (norm && !seenImpNorms.has(norm) && !seenAchNorms.has(norm) && !localSeen.has(norm)) {
          localSeen.add(norm);
          available.push(item);
        }
      }

      const qCandidates = available.filter(i => i.isQuestion);
      const gCandidates = available.filter(i => !i.isQuestion);

      // Prioritize candidates not previously used if regenerating, then shuffle
      const unusedQ = qCandidates.filter(c => !previousNorms.has(CommentEngine.normalizeText(c.text)));
      const usedQ = qCandidates.filter(c => previousNorms.has(CommentEngine.normalizeText(c.text)));
      const shuffledQ = [...shuffleArray(unusedQ), ...shuffleArray(usedQ)];

      for (const item of shuffledQ) {
        if (selectedImp.length >= targetImp) break;
        const norm = CommentEngine.normalizeText(item.text);
        seenImpNorms.add(norm);
        selectedImp.push(item.text);
      }

      // If more improvements are needed to reach target, select from general/section candidates
      if (selectedImp.length < targetImp && gCandidates.length > 0) {
        const unusedG = gCandidates.filter(c => !previousNorms.has(CommentEngine.normalizeText(c.text)));
        const usedG = gCandidates.filter(c => previousNorms.has(CommentEngine.normalizeText(c.text)));
        const shuffledG = [...shuffleArray(unusedG), ...shuffleArray(usedG)];

        for (const item of shuffledG) {
          if (selectedImp.length >= targetImp) break;
          const norm = CommentEngine.normalizeText(item.text);
          if (!seenImpNorms.has(norm) && !seenAchNorms.has(norm)) {
            seenImpNorms.add(norm);
            selectedImp.push(item.text);
          }
        }
      }
    }

    if (selectedAch.length === 0 && selectedImp.length === 0) {
      return "";
    }

    const achOutput = selectedAch.length > 0
      ? `Achievements:\n${selectedAch.join('\n')}`
      : `Achievements:\n(None qualified from bank)`;

    const impOutput = selectedImp.length > 0
      ? `Improvements:\n${selectedImp.join('\n')}`
      : `Improvements:\n(None qualified from bank)`;

    return `${achOutput}\n\n${impOutput}`;
  }

  /**
   * Single or Batch Generator: Generates comments for all provided students
   */
  static generateCommentsForAll(students, questions, commentBank, config = {}, sectionRanking = []) {
    const results = {};
    const validQuestions = (questions || []).filter(q => !q.isSectionBreak && q.included !== false);

    (students || []).forEach(student => {
      const cmt = CommentEngine.generateCommentsForStudent(student, validQuestions, commentBank, config, sectionRanking);
      results[student.id] = cmt;
    });

    return results;
  }
}

// Global browser window export
window.CommentEngine = CommentEngine;
