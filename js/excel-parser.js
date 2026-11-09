/**
 * Excel & CSV Spreadsheet Parser with Robust Multi-Row Header Scanner & Subquestion Extractor
 */
class ExcelParser {
  /**
   * Get all sheet names from workbook data
   * @param {ArrayBuffer} data 
   * @returns {Array<string>} List of sheet names
   */
  static getSheetNames(data) {
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    return workbook.SheetNames || [];
  }

  /**
   * Parse an Excel array buffer or CSV string for a target sheet name
   * @param {ArrayBuffer|string} data 
   * @param {string} [targetSheetName] Optional sheet name to parse
   * @returns {Object} Parsed sheet result
   */
  static parseSpreadsheet(data, targetSheetName = null) {
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    const availableSheets = workbook.SheetNames || [];
    
    if (availableSheets.length === 0) {
      throw new Error('Spreadsheet contains no readable sheets.');
    }

    const sheetName = targetSheetName && availableSheets.includes(targetSheetName)
      ? targetSheetName
      : availableSheets[0];

    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!matrix || matrix.length === 0) {
      throw new Error(`Sheet "${sheetName}" is empty or could not be read.`);
    }

    const result = this.detectAndExtractTable(matrix, sheetName);
    result.availableSheets = availableSheets;
    return result;
  }

  /**
   * Scans 2D grid to locate off-center grade table, header row, max mark row, and student records
   * @param {Array[][]} matrix 
   * @param {string} sheetName 
   */
  static detectAndExtractTable(matrix, sheetName) {
    const numRows = matrix.length;
    let numCols = 0;
    for (let r = 0; r < numRows; r++) {
      if (matrix[r].length > numCols) numCols = matrix[r].length;
    }

    // Step 1: Intelligent Header Row Selection
    // Prioritize rows containing subquestion codes (1a, 1b, Q1) or student headers
    // Heavily penalize rows filled with static repeating numbers (like 1, 1, 1, 1, 1)
    let headerRowIdx = -1;
    let maxHeaderScore = -999;

    for (let r = 0; r < Math.min(numRows, 25); r++) {
      const row = matrix[r] || [];
      let score = 0;
      let stringCount = 0;
      let qCodeMatchCount = 0;
      let repeatingOneCount = 0;
      const seenValues = new Set();

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim();
        if (!val) continue;

        stringCount++;
        const lower = val.toLowerCase();

        if (val === '1' || val === 1) {
          repeatingOneCount++;
        }

        if (['student', 'name', 'first name', 'last name', 'preferred name', 'id', 'student name'].includes(lower)) {
          score += 25;
        } else if (/^\d+[a-z]+$/i.test(val) || /^q(uestion)?\s*\d+[a-z]*$/i.test(val)) {
          score += 20; // High score for question codes like 1a, 1b, 2c, Q1a
          qCodeMatchCount++;
        } else if (/^\d+$/.test(val) && val !== '1') {
          score += 5;
        } else if (['total', 'percentage', 'penalty', 'grade', 'mark'].includes(lower)) {
          score += 8;
        } else if (isNaN(Number(val))) {
          score += 2;
        }

        seenValues.add(val);
      }

      // If a row is mostly repeating 1s (like a Max Marks row [1,1,1,1,1...]), heavily penalize it as a header
      if (repeatingOneCount >= 5 && seenValues.size <= 5) {
        score -= 100;
      }

      if (qCodeMatchCount >= 2) score += 30;

      if (score > maxHeaderScore && stringCount >= 2) {
        maxHeaderScore = score;
        headerRowIdx = r;
      }
    }

    if (headerRowIdx === -1) headerRowIdx = 0;

    const primaryHeaderRow = matrix[headerRowIdx] || [];

    // Step 2: Identify Max Marks Row (e.g. Row directly below or above header filled with question allocations)
    let maxMarksRowIdx = -1;
    for (let r = headerRowIdx + 1; r <= Math.min(numRows - 1, headerRowIdx + 2); r++) {
      const candidateRow = matrix[r] || [];
      let numericCount = 0;
      for (let c = 0; c < candidateRow.length; c++) {
        const val = Number(candidateRow[c]);
        if (!isNaN(val) && String(candidateRow[c]).trim() !== '') {
          numericCount++;
        }
      }

      if (numericCount >= 4) {
        maxMarksRowIdx = r;
        break;
      }
    }

    const startDataRowIdx = maxMarksRowIdx !== -1 ? maxMarksRowIdx + 1 : headerRowIdx + 1;

    // Step 3: Detect Student Name Columns (Supports split Preferred Name / Last Name)
    let firstNameColIdx = -1;
    let lastNameColIdx = -1;

    // Check primary header row and adjacent rows (in case name headers are on row below question numbers)
    const candidateHeaderRows = [primaryHeaderRow];
    if (maxMarksRowIdx !== -1 && matrix[maxMarksRowIdx]) candidateHeaderRows.push(matrix[maxMarksRowIdx]);
    if (headerRowIdx + 1 < numRows && matrix[headerRowIdx + 1]) candidateHeaderRows.push(matrix[headerRowIdx + 1]);

    for (const hRow of candidateHeaderRows) {
      if (firstNameColIdx !== -1 && lastNameColIdx !== -1) break;
      for (let c = 0; c < hRow.length; c++) {
        const colHeader = String(hRow[c] || '').trim().toLowerCase();
        if (['preferred name', 'first name', 'given name'].includes(colHeader)) {
          firstNameColIdx = c;
        } else if (['last name', 'surname', 'family name'].includes(colHeader)) {
          lastNameColIdx = c;
        } else if (['student', 'name', 'student name', 'full name'].includes(colHeader) && firstNameColIdx === -1) {
          firstNameColIdx = c;
        }
      }
    }

    // Fallback: If no headers matched, scan first 4 columns for string text entries
    if (firstNameColIdx === -1) {
      for (let c = 0; c < Math.min(numCols, 4); c++) {
        let textEntries = 0;
        for (let r = startDataRowIdx; r < Math.min(numRows, startDataRowIdx + 10); r++) {
          const val = String(matrix[r]?.[c] || '').trim();
          if (val && isNaN(Number(val)) && !['na', 'n/a', '-', 'absent'].includes(val.toLowerCase())) textEntries++;
        }
        if (textEntries >= 3) {
          if (firstNameColIdx === -1) firstNameColIdx = c;
          else if (lastNameColIdx === -1 && c === firstNameColIdx + 1) lastNameColIdx = c;
        }
      }
    }

    if (firstNameColIdx === -1) firstNameColIdx = 0;

    // Step 4: Identify Question Columns & Clean Unique Question IDs
    const questionCols = [];
    const summaryKeywords = ['total', 'sum', 'average', 'avg', 'percentage', '%', 'percent', 'pct', 'grade', 'rank', 'penalty'];
    const usedQuestionIds = new Map(); // Track ID counts to guarantee uniqueness

    for (let c = 0; c < numCols; c++) {
      if (c === firstNameColIdx || c === lastNameColIdx) continue;

      // Extract raw header text from primary header row, or adjacent header rows
      let rawHeader = String(primaryHeaderRow[c] || '').trim();
      if (!rawHeader && maxMarksRowIdx !== -1 && headerRowIdx > 0) {
        // Try adjacent row above
        rawHeader = String(matrix[headerRowIdx - 1]?.[c] || '').trim();
      }

      if (!rawHeader) continue;

      const lowerHeader = rawHeader.toLowerCase();
      const isPenalty = lowerHeader.includes('penalty');
      const isTotal = lowerHeader.includes('total') || lowerHeader.includes('sum');
      const isPercentage = lowerHeader.includes('percentage') || lowerHeader === '%' || lowerHeader.includes('percent') || lowerHeader === 'pct';
      const isSummary = (isTotal || isPercentage || summaryKeywords.some(kw => lowerHeader.includes(kw))) && !isPenalty;

      // Determine Max Mark for this question column
      let definedMaxMark = null;
      if (isPenalty) {
        definedMaxMark = 0; // Penalty has no potential max marks
      } else if (maxMarksRowIdx !== -1) {
        const mmVal = Number(matrix[maxMarksRowIdx]?.[c]);
        if (!isNaN(mmVal) && mmVal >= 0) definedMaxMark = mmVal;
      }

      // Scan student rows for score statistics
      let numericCount = 0;
      let maxObservedScore = 0;

      for (let r = startDataRowIdx; r < numRows; r++) {
        const rowVal = matrix[r]?.[c];
        const studentName = String(matrix[r]?.[firstNameColIdx] || '').trim();

        if (!studentName || summaryKeywords.some(kw => studentName.toLowerCase().includes(kw))) {
          continue;
        }

        if (rowVal !== undefined && rowVal !== '') {
          const num = Number(rowVal);
          if (!isNaN(num)) {
            numericCount++;
            if (num > maxObservedScore) maxObservedScore = num;
          }
        }
      }

      if (numericCount > 0 || definedMaxMark !== null || isTotal || isPercentage || isPenalty) {
        const finalMaxMark = isPenalty ? 0 : (definedMaxMark !== null ? definedMaxMark : (maxObservedScore > 0 ? maxObservedScore : 1));
        
        let cleanedId = isPenalty ? 'Penalty' : (isTotal ? 'Total' : (isPercentage ? 'Percentage' : this.cleanQuestionName(rawHeader, questionCols.length)));

        // Ensure unique question ID if duplicate headers exist
        if (usedQuestionIds.has(cleanedId)) {
          const count = usedQuestionIds.get(cleanedId) + 1;
          usedQuestionIds.set(cleanedId, count);
          cleanedId = `${cleanedId}_${count}`;
        } else {
          usedQuestionIds.set(cleanedId, 1);
        }

        // Auto-detect subquestion status (e.g. Q1a, Q1b, Q2c, Q8di, Q8dii)
        const isSubQuestion = !isPenalty && !isTotal && !isPercentage && (/^Q?\d+[a-z]+/i.test(cleanedId) || (/[a-z]$/i.test(cleanedId) && !/^Q?\d+$/i.test(cleanedId)));

        questionCols.push({
          colIndex: c,
          headerName: rawHeader,
          suggestedQuestionId: cleanedId,
          isSubQuestion: isSubQuestion,
          isPenalty: isPenalty,
          isTotal: isTotal,
          isPercentage: isPercentage,
          isSummary: isSummary,
          maxMarks: finalMaxMark,
          maxObservedScore: maxObservedScore
        });
      }
    }

    // Step 5: Extract Student Score Records
    const students = [];
    for (let r = startDataRowIdx; r < numRows; r++) {
      const row = matrix[r] || [];
      const firstPart = String(row[firstNameColIdx] || '').trim();
      const lastPart = lastNameColIdx !== -1 ? String(row[lastNameColIdx] || '').trim() : '';

      if (!firstPart && !lastPart) continue;

      const combinedName = lastPart ? `${firstPart} ${lastPart}`.trim() : firstPart;
      const lowerName = combinedName.toLowerCase();

      if (summaryKeywords.some(kw => lowerName === kw || lowerName.startsWith(kw + ' ') || lowerName.includes('average'))) {
        continue;
      }

      const scores = {};
      questionCols.forEach(qCol => {
        const val = row[qCol.colIndex];
        let scoreVal = null;
        
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const strVal = String(val).trim();
          const lowerVal = strVal.toLowerCase();
          
          if (['na', 'n/a', 'absent', '-'].includes(lowerVal)) {
            scoreVal = 'NA';
          } else if (qCol.isPercentage) {
            if (strVal.includes('%')) {
              const parsed = parseFloat(strVal.replace('%', '').trim());
              scoreVal = !isNaN(parsed) ? parsed / 100 : null;
            } else if (!isNaN(Number(strVal))) {
              scoreVal = Number(strVal);
            }
          } else if (qCol.isTotal && strVal.includes('/')) {
            const parsed = parseFloat(strVal.split('/')[0]);
            scoreVal = !isNaN(parsed) ? parsed : null;
          } else if (!isNaN(Number(strVal))) {
            scoreVal = Number(strVal);
          }
        }
        
        scores[qCol.suggestedQuestionId] = scoreVal;
        if (qCol.colIndex !== undefined && qCol.colIndex !== null) {
          scores[`col_${qCol.colIndex}`] = scoreVal;
        }

        // Also store normalized aliases for quick lookup
        if (qCol.isTotal && !scores['Total']) {
          scores['Total'] = scoreVal;
        }
        if (qCol.isPercentage && !scores['Percentage']) {
          scores['Percentage'] = scoreVal;
        }
      });

      students.push({
        id: `student_${students.length + 1}`,
        name: combinedName,
        scores: scores
      });
    }

    const studentColHeader = lastNameColIdx !== -1 
      ? `${primaryHeaderRow[firstNameColIdx] || 'First'} & ${primaryHeaderRow[lastNameColIdx] || 'Last'}`
      : (primaryHeaderRow[firstNameColIdx] || 'Student Name');

    return {
      sheetName,
      boundingBox: {
        startRow: headerRowIdx,
        maxMarksRow: maxMarksRowIdx,
        endRow: numRows - 1,
        studentCol: firstNameColIdx,
        totalCols: numCols
      },
      headerRowIdx,
      maxMarksRowIdx,
      studentColHeader,
      questionCols,
      students,
      rawMatrix: matrix
    };
  }

  /**
   * Helper to clean raw column headers into standard question IDs (e.g., "1a" -> "Q1a")
   */
  static cleanQuestionName(rawHeader, colIdx = 0) {
    let clean = String(rawHeader).trim();
    clean = clean.replace(/\s*\(\s*\d+\s*marks?\s*\)/i, '');
    clean = clean.replace(/^question\s*/i, 'Q');
    clean = clean.replace(/^q\s+/i, 'Q');
    
    if (/^\d+[a-z]*$/i.test(clean)) {
      clean = `Q${clean}`;
    }
    return clean || `Q${colIdx + 1}`;
  }
}

window.ExcelParser = ExcelParser;
