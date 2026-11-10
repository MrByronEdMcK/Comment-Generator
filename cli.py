#!/usr/bin/env python3
"""
Student Assessment Comment Generator - Headless CLI & Batch Processor
Author: Google DeepMind Pair Programming
Python: 3.8+ (Zero external dependencies)
"""

import argparse
import csv
import json
import math
import os
import random
import re
import sys
import time


def parse_csv_gradebook(file_path):
    """Parse CSV gradebook file into students and question scores."""
    students = []
    questions = []

    with open(file_path, 'r', encoding='utf-8-sig', errors='ignore') as f:
        reader = csv.reader(f)
        rows = [row for row in reader if any(cell.strip() for cell in row)]

    if not rows:
        raise ValueError(f"File '{file_path}' is empty or invalid.")

    # Detect header row
    header_idx = 0
    for idx, row in enumerate(rows[:10]):
        text = " ".join(row).lower()
        if any(kw in text for kw in ['student', 'name', 'first', 'q1', '1a']):
            header_idx = idx
            break

    headers = [h.strip() for h in rows[header_idx]]
    data_rows = rows[header_idx + 1:]

    # Locate student name column
    name_col = 0
    for c, h in enumerate(headers):
        if any(kw in h.lower() for kw in ['student', 'name', 'first name']):
            name_col = c
            break

    # Identify question columns and summary columns
    question_cols = []
    summary_cols = []
    for c, h in enumerate(headers):
        if c == name_col or not h:
            continue
        lower_h = h.lower()
        if any(kw in lower_h for kw in ['total', 'percentage', '%', 'rank', 'average', 'sum', 'penalty']):
            summary_cols.append((c, h))
            if 'penalty' in lower_h:
                questions.append({"id": h, "title": h, "maxMarks": 0, "isPenalty": True})
        else:
            question_cols.append((c, h))
            questions.append({"id": h, "title": h, "maxMarks": 1, "isPenalty": False})

    for row in data_rows:
        if len(row) <= name_col or not row[name_col].strip():
            continue
        name = row[name_col].strip()
        scores = {}
        for col_idx, q_name in question_cols + summary_cols:
            if col_idx < len(row) and row[col_idx].strip():
                val_str = row[col_idx].strip()
                if val_str.lower() in ['na', 'n/a', 'absent', '-']:
                    scores[q_name] = 'NA'
                elif '%' in val_str:
                    try:
                        scores[q_name] = float(val_str.replace('%', '').strip()) / 100.0
                    except ValueError:
                        scores[q_name] = None
                else:
                    try:
                        scores[q_name] = float(val_str)
                    except ValueError:
                        scores[q_name] = None
        students.append({"name": name, "scores": scores})

    return students, questions


def extract_question_ids_from_expression(expr):
    """Mirror of CommentEngine.extractQuestionIdsFromExpression."""
    result = []
    current_base_num = None

    clean = re.sub(r'^Questions?\s*', '', expr, flags=re.IGNORECASE).strip()

    # Number range e.g. "1-3", "Q1-Q3", "1 to 3"
    num_range_match = re.match(r'^(?:Q\s*)?(\d+)\s*(?:-|to)\s*(?:Q\s*)?(\d+)$', clean, re.IGNORECASE)
    if num_range_match:
        start = int(num_range_match.group(1))
        end = int(num_range_match.group(2))
        if start <= end and end - start <= 30:
            return [f"Q{i}" for i in range(start, end + 1)]

    # Letter range e.g. "7a-c", "7a to 7c"
    letter_range_match = re.match(r'^(?:Q\s*)?(\d+)([a-z])\s*(?:-|to)\s*(?:(?:Q\s*)?\1)?([a-z])$', clean, re.IGNORECASE)
    if letter_range_match:
        base = letter_range_match.group(1)
        start_code = ord(letter_range_match.group(2).lower())
        end_code = ord(letter_range_match.group(3).lower())
        if start_code <= end_code and end_code - start_code <= 10:
            return [f"Q{base}{chr(c)}" for c in range(start_code, end_code + 1)]

    tokens = re.split(r'(?:,\s*|\s+and\s+|\s*&\s*)', clean, flags=re.IGNORECASE)
    for token in tokens:
        t = token.strip()
        if not t:
            continue

        full_match = re.match(r'^(?:Q\s*)?(\d+)([a-z]+)?$', t, re.IGNORECASE)
        if full_match:
            current_base_num = full_match.group(1)
            letter = full_match.group(2).lower() if full_match.group(2) else ''
            qid = f"Q{current_base_num}{letter}"
            if qid not in result:
                result.append(qid)
            continue

        letter_only_match = re.match(r'^([a-z]+)$', t, re.IGNORECASE)
        if letter_only_match and current_base_num:
            letter = letter_only_match.group(1).lower()
            qid = f"Q{current_base_num}{letter}"
            if qid not in result:
                result.append(qid)
            continue

    return result


def parse_comment_entry(entry):
    """Mirror of CommentEngine.parseCommentEntry."""
    raw_text = entry if isinstance(entry, str) else (entry.get("text") or "")
    tags = list(entry.get("tags", [])) if isinstance(entry, dict) and isinstance(entry.get("tags"), list) else []
    section = entry.get("section") if isinstance(entry, dict) else None
    question_ids = []

    if isinstance(entry, dict) and entry.get("questionIds"):
        question_ids = list(entry["questionIds"])
    elif isinstance(entry, dict) and entry.get("questionId"):
        question_ids = [entry["questionId"]]

    clean_text = raw_text.strip()

    # If question_ids not explicitly provided, extract from leading prefix
    # Handles prefixes like "Q1,2, 4\t...", "7a, b Used...", "1\tDetermine...", "Q1-3\t..."
    if not question_ids:
        # 1. Tab separated (typical Excel / spreadsheet column copy-paste)
        if '\t' in clean_text:
            tab_idx = clean_text.find('\t')
            prefix = clean_text[:tab_idx].strip()
            remainder = clean_text[tab_idx + 1:].strip()
            if prefix and remainder:
                extracted = extract_question_ids_from_expression(prefix)
                if extracted:
                    question_ids = extracted
                    clean_text = remainder

        # 2. Colon, dash, dot, paren, or whitespace separated with question prefix
        if not question_ids:
            m = re.match(r'^(?:(?:Questions?|Q)\s*)?([0-9]+[a-z0-9\s,\-&to]*?)(?:\s*[:\.\-\)]+\s+|\s*[\t]+\s*)([A-Z].*)$', clean_text, re.IGNORECASE)
            if m:
                prefix = m.group(1).strip()
                remainder = m.group(2).strip()
                extracted = extract_question_ids_from_expression(prefix)
                if extracted:
                    question_ids = extracted
                    clean_text = remainder

        # 3. Simple space before capital letter e.g. "Q1 Correctly...", "8di Demonstrated..."
        if not question_ids:
            m2 = re.match(r'^(?:(?:Questions?|Q)\s*)?([0-9]+[a-z]{0,4})\s+([A-Z].*)$', clean_text, re.IGNORECASE)
            if m2:
                prefix = m2.group(1).strip()
                remainder = m2.group(2).strip()
                extracted = extract_question_ids_from_expression(prefix)
                if extracted:
                    question_ids = extracted
                    clean_text = remainder

    clean_text = re.sub(r'^(?:(?:Questions?|Q)\s*\d+[a-z]*[\s:\.\-\)]+)', '', clean_text, flags=re.IGNORECASE).strip()

    return {
        "text": clean_text,
        "questionIds": question_ids,
        "questionId": question_ids[0] if question_ids else None,
        "tags": tags,
        "section": section,
        "isGeneral": not section or section.lower() in ('general', 'all', 'all sections')
    }


def is_question_match(comment_qid, test_qid):
    """Helper: Check if a comment question ID matches a test question ID (supporting parent-to-subquestion hierarchy)."""
    if not comment_qid or not test_qid:
        return False

    c_norm = re.sub(r'^Q(UESTIONS?)?\s*', '', str(comment_qid).strip(), flags=re.IGNORECASE).upper()
    t_norm = re.sub(r'^Q(UESTIONS?)?\s*', '', str(test_qid).strip(), flags=re.IGNORECASE).upper()

    # 1. Direct normalized match (e.g. "1" === "1", "1A" === "1A", "8DI" === "8DI")
    if c_norm == t_norm:
        return True

    # 2. Parent-to-subquestion match
    # - Whole question to subquestion (e.g. comment is "1" and test is "1A", "1B", "1.1", "8DI")
    c_match = re.match(r'^(\d+)$', c_norm)
    if c_match:
        c_num = c_match.group(1)
        t_match = re.match(r'^(\d+)[A-Z\.]', t_norm)
        if t_match and t_match.group(1) == c_num:
            return True

    # - Parent subquestion to sub-subquestion (e.g. comment is "8D" and test is "8DI", "8DII")
    c_parent_sub = re.match(r'^(\d+)([A-Z])$', c_norm)
    if c_parent_sub:
        c_num, c_let = c_parent_sub.group(1), c_parent_sub.group(2)
        t_sub = re.match(r'^(\d+)([A-Z])([A-Z0-9\.]+)$', t_norm)
        if t_sub and t_sub.group(1) == c_num and t_sub.group(2) == c_let:
            return True

    # 3. Subquestion to parent match
    # - Subquestion to whole question (e.g. comment is "1A", "8DI" and test is "1")
    t_match = re.match(r'^(\d+)$', t_norm)
    if t_match:
        t_num = t_match.group(1)
        c_sub_match = re.match(r'^(\d+)[A-Z\.]', c_norm)
        if c_sub_match and c_sub_match.group(1) == t_num:
            return True

    # - Sub-subquestion to parent subquestion (e.g. comment is "8DI", "8DII" and test is "8D")
    t_parent_sub = re.match(r'^(\d+)([A-Z])$', t_norm)
    if t_parent_sub:
        t_num, t_let = t_parent_sub.group(1), t_parent_sub.group(2)
        c_sub = re.match(r'^(\d+)([A-Z])([A-Z0-9\.]+)$', c_norm)
        if c_sub and c_sub.group(1) == t_num and c_sub.group(2) == t_let:
            return True

    return False


def is_section_match(comment_sec, question_sec, is_question_tagged=False):
    """Mirror of CommentEngine.isSectionMatch in js/comment-engine.js"""
    c_norm = str(comment_sec or '').strip().lower()
    q_norm = str(question_sec or '').strip().lower()

    c_is_gen = not c_norm or c_norm in ('general', 'all', 'all sections')
    q_is_gen = not q_norm or q_norm in ('general', 'all', 'all sections')

    if c_is_gen and q_is_gen:
        return True

    if is_question_tagged and (c_is_gen or q_is_gen):
        return False

    if c_is_gen:
        return True
    if q_is_gen:
        return False

    if c_norm == q_norm:
        return True

    tokens_a = set(re.split(r'[\s\-_,.:;/\\\\]+', c_norm)) - {''}
    tokens_b = set(re.split(r'[\s\-_,.:;/\\\\]+', q_norm)) - {''}

    def is_mcq(s):
        return 'mcq' in s or ('multiple' in s and 'choice' in s)

    def is_saq(s):
        return 'saq' in s or ('short' in s and 'answer' in s) or 'extended' in s

    if (is_mcq(tokens_a) and is_saq(tokens_b)) or (is_saq(tokens_a) and is_mcq(tokens_b)):
        return False

    c_letter = re.search(r'\bsection\s+([a-z0-9]+)\b', c_norm)
    q_letter = re.search(r'\bsection\s+([a-z0-9]+)\b', q_norm)
    if c_letter and q_letter:
        return c_letter.group(1) == q_letter.group(1)

    if c_norm in q_norm or q_norm in c_norm:
        return True

    noise = {'section', 'part', 'test', 'exam', 'assessment', 'questions', 'question'}
    for t in tokens_a:
        if t not in noise and t in tokens_b:
            return True

    return False


def get_achievement_band(pct):
    """Mirror of CommentEngine.getAchievementBand."""
    if pct == 'Incomplete' or pct == 'NA' or pct is None:
        return 'Incomplete'
    try:
        num = float(pct)
    except (ValueError, TypeError):
        return 'NA'
    ratio = num / 100.0 if num > 1.0 else num
    if ratio >= 0.9: return 'Outstanding'
    if ratio >= 0.8: return 'Excellent'
    if ratio >= 0.7: return 'Very Good'
    if ratio >= 0.6: return 'Good'
    if ratio >= 0.5: return 'Moderate'
    if ratio >= 0.4: return 'Limited'
    if ratio >= 0.2: return 'Low'
    if ratio >= 0.01: return 'Very Low'
    return 'Ungraded'


def get_question_score(student, q):
    """Accurately retrieves student's score for question q, handling column index and section scoping."""
    if not isinstance(student, dict) or not isinstance(q, dict):
        return None
    scores = student.get("scores", {})
    if not isinstance(scores, dict):
        return None

    # 1. Column index match (col_<colIndex>) - highest priority, exact spreadsheet column
    col_idx = q.get("colIndex")
    if col_idx is not None and col_idx >= 0:
        col_key = f"col_{col_idx}"
        if col_key in scores and scores[col_key] is not None:
            return scores[col_key]

    # 2. Section-scoped match (<section>__<id>) - handles section splits
    sec = q.get("section")
    qid = q.get("id")
    if sec and sec != "General" and qid:
        sec_key = f"{sec}__{qid}"
        if sec_key in scores and scores[sec_key] is not None:
            return scores[sec_key]

    # 3. Suggested or original question ID
    if q.get("suggestedQuestionId") and q["suggestedQuestionId"] in scores and scores[q["suggestedQuestionId"]] is not None:
        return scores[q["suggestedQuestionId"]]

    # 4. Standard q.id match
    if qid and qid in scores and scores[qid] is not None:
        return scores[qid]

    # 5. Title match
    if q.get("title") and q["title"] in scores and scores[q["title"]] is not None:
        return scores[q["title"]]

    return None


def calculate_student_score_summary(student, questions):
    """Centralized score summary calculation matching CommentEngine."""
    raw_scores = student.get("scores", {})
    calculated_obtained = 0.0
    calculated_max = 0.0
    scored_questions_count = 0
    has_explicit_absence = False

    active_questions = [q for q in questions if not q.get("isSectionBreak") and not q.get("isSummary")]

    for q in active_questions:
        val = get_question_score(student, q)
        if val in ['NA', 'N/A', 'absent']:
            has_explicit_absence = True
            continue
        if val is not None and isinstance(val, (int, float)):
            scored_questions_count += 1
            if q.get("isPenalty"):
                calculated_obtained += val
                continue
            max_m = float(q.get("maxMarks", 1))
            calculated_obtained += val
            if max_m > 0:
                calculated_max += max_m

    sheet_total = None
    sheet_pct = None
    raw_sheet_pct_val = None

    for k, val in raw_scores.items():
        lower_k = k.lower()
        if val in ['NA', 'N/A', 'absent']:
            has_explicit_absence = True
        if lower_k in ['total', 'sum'] or lower_k.startswith('total_'):
            if val is not None and isinstance(val, (int, float)):
                sheet_total = float(val)
        if lower_k in ['percentage', '%'] or 'percent' in lower_k or lower_k.startswith('percentage_'):
            raw_sheet_pct_val = val
            if isinstance(val, str) and '%' in val:
                try:
                    sheet_pct = round(float(val.replace('%', '').strip()))
                except ValueError:
                    pass
            elif val is not None and isinstance(val, (int, float)):
                if 0 < val <= 1.0:
                    sheet_pct = round(val * 100)
                else:
                    sheet_pct = round(val)

    is_zero_out_of_zero = has_explicit_absence or (scored_questions_count == 0 and sheet_total is None and sheet_pct is None) or (calculated_max == 0 and (sheet_total is None or sheet_total == 0)) or (sheet_total == 0 and sheet_pct == 0 and scored_questions_count == 0)

    total_obtained = sheet_total if sheet_total is not None else calculated_obtained
    if is_zero_out_of_zero:
        percentage = 0
    elif sheet_pct is not None:
        percentage = sheet_pct
    elif calculated_max > 0:
        percentage = round((total_obtained / calculated_max) * 100)
    else:
        percentage = 0

    total_max = calculated_max
    if is_zero_out_of_zero:
        total_max = 0
    elif sheet_pct is not None and sheet_pct > 0 and total_obtained > 0:
        if isinstance(raw_sheet_pct_val, float) and 0 < raw_sheet_pct_val <= 1.0:
            exact_max = round(total_obtained / raw_sheet_pct_val)
            if exact_max > 0 and abs((total_obtained / exact_max) - raw_sheet_pct_val) < 0.01:
                total_max = exact_max
            else:
                total_max = round(total_obtained / (sheet_pct / 100.0))
        elif calculated_max == 0 or round((total_obtained / calculated_max) * 100) != sheet_pct:
            total_max = round(total_obtained / (sheet_pct / 100.0))
    elif total_max == 0 and total_obtained > 0:
        total_max = int(total_obtained)

    band = 'Incomplete' if is_zero_out_of_zero else get_achievement_band(percentage)

    return {
        "obtained": int(total_obtained) if isinstance(total_obtained, float) and total_obtained.is_integer() else total_obtained,
        "max": int(total_max) if isinstance(total_max, float) and total_max.is_integer() else int(total_max),
        "percentage": percentage,
        "band": band,
        "is_zero_out_of_zero": is_zero_out_of_zero
    }


def get_target_distribution(pct, config=None):
    """Calculate target (ach, imp) based on student percentage and optional config."""
    config = config or {}
    total = int(config.get("totalComments", 6))
    if total < 1:
        total = 6

    min_ach = int(config.get("minAchievements", 2))
    if min_ach < 0:
        min_ach = 2

    max_ach = int(config.get("maxAchievements", 4))
    if max_ach < min_ach:
        max_ach = max(min_ach, 4)

    min_imp = int(config.get("minImprovements", 2))
    if min_imp < 0:
        min_imp = 2

    max_imp = int(config.get("maxImprovements", 4))
    if max_imp < min_imp:
        max_imp = max(min_imp, 4)

    # Ensure boundary feasibility
    if min_ach + min_imp > total:
        total = min_ach + min_imp
    if max_ach + max_imp < total:
        max_ach = max(max_ach, total - min_imp)
        max_imp = max(max_imp, total - min_ach)

    try:
        num_pct = float(pct)
    except (ValueError, TypeError):
        num_pct = 50.0

    if num_pct >= 70:
        # High performer: maximize achievements while respecting min improvements
        target_ach = min(max_ach, total - min_imp)
        target_imp = total - target_ach
        if target_imp < min_imp:
            target_imp = min_imp
            target_ach = total - target_imp
        if target_imp > max_imp:
            target_imp = max_imp
            target_ach = total - target_imp
    elif num_pct < 50:
        # Low performer: maximize improvements while respecting min achievements
        target_imp = min(max_imp, total - min_ach)
        target_ach = total - target_imp
        if target_ach < min_ach:
            target_ach = min_ach
            target_imp = total - target_ach
        if target_ach > max_ach:
            target_ach = max_ach
            target_imp = total - target_ach
    else:
        # Mid performer (50% - 69%): balanced allocation
        half = total / 2.0
        if num_pct >= 60:
            target_ach = int(math.ceil(half))
        else:
            target_ach = int(math.floor(half))
        target_imp = total - target_ach

        if target_ach < min_ach:
            target_ach = min_ach
            target_imp = total - target_ach
        elif target_ach > max_ach:
            target_ach = max_ach
            target_imp = total - target_ach

        if target_imp < min_imp:
            target_imp = min_imp
            target_ach = total - target_imp
        elif target_imp > max_imp:
            target_imp = max_imp
            target_ach = total - target_imp

    return target_ach, target_imp, total


def verify_and_clean_comments(raw_text, candidate_ach=None, candidate_imp=None, pct=50, config=None):
    """Clean, deduplicate, and format comments. Leaves output blank on failure rather than dumping candidate bank items."""
    candidate_ach = candidate_ach or []
    candidate_imp = candidate_imp or []
    target_ach, target_imp, total = get_target_distribution(pct, config)

    if not raw_text or not raw_text.strip():
        return ""

    # Strip thinking tags from reasoning models (e.g. DeepSeek-R1 <think>...</think>)
    text_without_think = re.sub(r'<think>[\s\S]*?</think>', '', raw_text, flags=re.IGNORECASE).strip()
    if not text_without_think:
        return ""

    lines = [l.strip() for l in text_without_think.splitlines() if l.strip()]
    section = None
    raw_ach = []
    raw_imp = []

    for line in lines:
        stripped = re.sub(r'[*#_~`]', '', line).strip()
        if re.match(r'^(?:\d+[\.\)]\s*)?Achievements\s*:?$', stripped, re.IGNORECASE):
            section = 'ach'
            continue
        if re.match(r'^(?:\d+[\.\)]\s*)?Improvements\s*:?$', stripped, re.IGNORECASE):
            section = 'imp'
            continue

        clean = re.sub(r'^[\s•\-*\d\.\):]+', '', line).strip()
        clean = re.sub(r'^(?:(?:Question|Q)\s*\d+[a-z]*[\s:\.\-\)]+)', '', clean, flags=re.IGNORECASE).strip()
        clean = re.sub(r'^(?:\[?\s*Achievement\s*\d*\s*\]?:?|\[?\s*Improvement\s*\d*\s*\]?:?)\s*', '', clean, flags=re.IGNORECASE).strip()
        clean = re.sub(r'[\[\]]', '', clean).strip()

        is_placeholder = bool(re.match(r'^(\[?Distinct\s+(?:Achievement|Improvement)\s+Sentence\s*\d*\]?|\[?Achievement\s+Sentence\s*\d*\]?|\[?Improvement\s+Sentence\s*\d*\]?|\[?No\s+(?:Achievement|Improvement)\s+comment\s*\d*\]?)$', clean, re.IGNORECASE))

        if len(clean) > 10 and not is_placeholder:
            if section == 'ach':
                raw_ach.append(clean)
            elif section == 'imp':
                raw_imp.append(clean)

    final_ach = []
    seen_ach = set()
    for ach in raw_ach:
        if len(final_ach) >= target_ach:
            break
        norm = re.sub(r'[^a-z0-9]', '', ach.lower())
        if norm not in seen_ach:
            seen_ach.add(norm)
            final_ach.append(ach)

    final_imp = []
    seen_imp = set()
    for imp in raw_imp:
        if len(final_imp) >= target_imp:
            break
        norm = re.sub(r'[^a-z0-9]', '', imp.lower())
        if norm not in seen_imp and norm not in seen_ach:
            seen_imp.add(norm)
            final_imp.append(imp)

    # If both sections are empty (model output failed to yield valid comments), leave blank
    if not final_ach and not final_imp:
        return ""

    return f"Achievements:\n{chr(10).join(final_ach[:target_ach])}\n\nImprovements:\n{chr(10).join(final_imp[:target_imp])}"


def generate_comments_for_student(student, questions, comment_bank=None, config=None, section_ranking=None):
    """
    Generate comments for a single student applying Section Priority Ranking.
    Mirrors CommentEngine.generateCommentsForStudent in js/comment-engine.js.
    """
    summary = calculate_student_score_summary(student, questions)
    if summary["is_zero_out_of_zero"]:
        return "Incomplete due to absences"

    pct = summary["percentage"]
    target_ach, target_imp, total = get_target_distribution(pct, config)

    valid_questions = [
        q for q in questions
        if not q.get("isPenalty") and not q.get("isSectionBreak") and q.get("included") is not False
    ]

    # Calculate section-level scores
    section_scores = {}
    for q in valid_questions:
        q_sec = q.get("section") or "General"
        if q_sec not in section_scores:
            section_scores[q_sec] = {"obtained": 0.0, "max": 0.0}
        q_score = get_question_score(student, q)
        if q_score is not None and q_score != "NA" and not isinstance(q_score, str):
            section_scores[q_sec]["obtained"] += float(q_score)
            max_m = float(q.get("maxMarks", 1))
            section_scores[q_sec]["max"] += max_m

    for s in section_scores.values():
        s["pct"] = round((s["obtained"] / s["max"] * 100.0)) if s["max"] > 0 else 0
        s["mastered"] = s["pct"] >= 50

    # Build active ranking
    valid_sections = set()
    for q in valid_questions:
        s = q.get("section")
        if s and s != "General":
            valid_sections.add(s)

    raw_ach_bank = (comment_bank or {}).get("achievements", [])
    raw_imp_bank = (comment_bank or {}).get("improvements", [])

    for item in raw_ach_bank + raw_imp_bank:
        if isinstance(item, dict):
            s = item.get("section")
            if s and s != "General":
                valid_sections.add(s)

    ranking = [r for r in (section_ranking or []) if r]
    for sec in sorted(valid_sections):
        if sec not in ranking:
            ranking.append(sec)
    if "General" not in ranking:
        ranking.append("General")

    ach_by_section = {sec: [] for sec in ranking}
    imp_by_section = {sec: [] for sec in ranking}

    def find_bucket(sec_name):
        for r in ranking:
            if is_section_match(sec_name, r):
                return r
        return "General"

    # Partition achievements
    for item in raw_ach_bank:
        parsed = parse_comment_entry(item)
        txt = parsed["text"]
        q_ids = parsed.get("questionIds") or ([parsed["questionId"]] if parsed.get("questionId") else [])
        sec = parsed.get("section")
        is_gen = not sec or sec.lower() in ("general", "all", "all sections")

        if q_ids:
            matched = [
                q for q in valid_questions
                if is_section_match(sec, q.get("section"), is_question_tagged=True)
                and any(is_question_match(qid, q.get("id")) for qid in q_ids)
            ]
            if matched:
                tot_obt = 0.0
                tot_max = 0.0
                for q in matched:
                    qs = get_question_score(student, q)
                    if qs is not None and qs != "NA" and not isinstance(qs, str):
                        tot_obt += float(qs)
                    tot_max += float(q.get("maxMarks", 1))
                match_pct = (tot_obt / tot_max * 100.0) if tot_max > 0 else 0.0
                if match_pct >= 50.0:
                    tgt_sec = matched[0].get("section") or sec or "General"
                    b_key = find_bucket(tgt_sec)
                    ach_by_section[b_key].append({"text": txt, "pct": match_pct, "is_q": True})
        elif sec and not is_gen:
            stats = section_scores.get(sec)
            if stats and stats["mastered"]:
                b_key = find_bucket(sec)
                ach_by_section[b_key].append({"text": txt, "pct": stats["pct"], "is_q": False})
        elif is_gen:
            ach_by_section["General"].append({"text": txt, "pct": 100.0, "is_q": False})

    # Partition improvements
    for item in raw_imp_bank:
        parsed = parse_comment_entry(item)
        txt = parsed["text"]
        q_ids = parsed.get("questionIds") or ([parsed["questionId"]] if parsed.get("questionId") else [])
        sec = parsed.get("section")
        is_gen = not sec or sec.lower() in ("general", "all", "all sections")

        if q_ids:
            matched = [
                q for q in valid_questions
                if is_section_match(sec, q.get("section"), is_question_tagged=True)
                and any(is_question_match(qid, q.get("id")) for qid in q_ids)
            ]
            if matched:
                tot_obt = 0.0
                tot_max = 0.0
                for q in matched:
                    qs = get_question_score(student, q)
                    if qs is not None and qs != "NA" and not isinstance(qs, str):
                        tot_obt += float(qs)
                    tot_max += float(q.get("maxMarks", 1))
                match_pct = (tot_obt / tot_max * 100.0) if tot_max > 0 else 0.0
                if match_pct < 50.0:
                    tgt_sec = matched[0].get("section") or sec or "General"
                    b_key = find_bucket(tgt_sec)
                    imp_by_section[b_key].append({"text": txt, "pct": match_pct, "is_q": True})
        elif sec and not is_gen:
            stats = section_scores.get(sec)
            if stats and not stats["mastered"]:
                b_key = find_bucket(sec)
                imp_by_section[b_key].append({"text": txt, "pct": stats["pct"], "is_q": False})
        elif is_gen:
            imp_by_section["General"].append({"text": txt, "pct": 0.0, "is_q": False})

    # Sort each bucket: questions first, then by mastery
    for k in ach_by_section:
        ach_by_section[k].sort(key=lambda x: (not x["is_q"], -x["pct"]))
    for k in imp_by_section:
        imp_by_section[k].sort(key=lambda x: (not x["is_q"], x["pct"]))

    def norm_text(t):
        return re.sub(r'[^a-z0-9]', '', (t or '').lower())

    selected_ach = []
    seen_ach_norms = set()
    for sec_name in ranking:
        if len(selected_ach) >= target_ach:
            break
        for item in ach_by_section.get(sec_name, []):
            if len(selected_ach) >= target_ach:
                break
            n = norm_text(item["text"])
            if n and n not in seen_ach_norms:
                seen_ach_norms.add(n)
                selected_ach.append(item["text"])

    selected_imp = []
    seen_imp_norms = set()
    for sec_name in ranking:
        if len(selected_imp) >= target_imp:
            break
        for item in imp_by_section.get(sec_name, []):
            if len(selected_imp) >= target_imp:
                break
            n = norm_text(item["text"])
            if n and n not in seen_imp_norms and n not in seen_ach_norms:
                seen_imp_norms.add(n)
                selected_imp.append(item["text"])

    if not selected_ach and not selected_imp:
        return ""

    ach_out = f"Achievements:\n{chr(10).join(selected_ach)}" if selected_ach else "Achievements:\n(None qualified from bank)"
    imp_out = f"Improvements:\n{chr(10).join(selected_imp)}" if selected_imp else "Improvements:\n(None qualified from bank)"
    return f"{ach_out}\n\n{imp_out}"


def generate_batch_comments(students, questions, config=None, comment_bank=None, section_ranking=None):
    """Generate section-ranked comments for all students."""
    config = config or {}
    section_ranking = section_ranking or []
    results = {}
    ranking_str = " > ".join(section_ranking) if section_ranking else "Auto-detected"
    print(f"\n[CLI] Processing {len(students)} student(s) with Section Ranking: {ranking_str}...")

    for idx, student in enumerate(students, 1):
        name = student["name"]
        summary = calculate_student_score_summary(student, questions)
        total_score = summary["obtained"]
        max_score = summary["max"]
        pct = summary["percentage"]
        band = summary["band"]
        is_zero_out_of_zero = summary["is_zero_out_of_zero"]

        if is_zero_out_of_zero:
            print(f"  [{idx}/{len(students)}] {name}: Incomplete due to absences (0/0 marks).")
            results[name] = {
                "score": "0/0 (0%)",
                "band": "Incomplete",
                "comments": "Incomplete due to absences"
            }
            continue

        cmt = generate_comments_for_student(
            student, questions, comment_bank=comment_bank, config=config, section_ranking=section_ranking
        )
        print(f"  [{idx}/{len(students)}] Generated comments for {name} ({pct}%).")
        results[name] = {
            "score": f"{total_score}/{max_score} ({pct}%)",
            "band": band,
            "comments": cmt
        }

    return results


def main():
    parser = argparse.ArgumentParser(description="Student Assessment Comment Generator CLI (Section-Prioritized Matching)")
    parser.add_argument('--gradebook', '-g', required=True, help="Path to CSV gradebook file")
    parser.add_argument('--bank', '-b', default=None, help="Optional path to comment bank JSON file")
    parser.add_argument('--ranking', '-r', default=None, help="Comma-separated section priority ranking (e.g. 'SAQ,MCQ,General')")
    parser.add_argument('--total', type=int, default=6, help="Total number of comments (default: 6)")
    parser.add_argument('--min-ach', type=int, default=2, help="Minimum achievement comments (default: 2)")
    parser.add_argument('--max-ach', type=int, default=4, help="Maximum achievement comments (default: 4)")
    parser.add_argument('--min-imp', type=int, default=2, help="Minimum improvement comments (default: 2)")
    parser.add_argument('--max-imp', type=int, default=4, help="Maximum improvement comments (default: 4)")
    parser.add_argument('--output', '-o', default="generated_comments.json", help="Path to output JSON file")

    args = parser.parse_args()

    if not os.path.exists(args.gradebook):
        print(f"Error: File '{args.gradebook}' not found.", file=sys.stderr)
        sys.exit(1)

    comment_bank = None
    if args.bank:
        if os.path.exists(args.bank):
            try:
                with open(args.bank, 'r', encoding='utf-8') as f:
                    comment_bank = json.load(f)
                print(f"[CLI] Loaded comment bank from '{args.bank}'.")
            except Exception as e:
                print(f"Warning: Could not load comment bank: {e}", file=sys.stderr)
        else:
            print(f"Warning: Comment bank file '{args.bank}' not found.", file=sys.stderr)

    config = {
        "totalComments": args.total,
        "minAchievements": args.min_ach,
        "maxAchievements": args.max_ach,
        "minImprovements": args.min_imp,
        "maxImprovements": args.max_imp
    }

    section_ranking = [s.strip() for s in args.ranking.split(',')] if args.ranking else []

    try:
        students, questions = parse_csv_gradebook(args.gradebook)
        print(f"[CLI] Loaded {len(students)} students and {len(questions)} question columns.")
    except Exception as e:
        print(f"Error parsing gradebook: {e}", file=sys.stderr)
        sys.exit(1)

    comments = generate_batch_comments(
        students, questions, config=config, comment_bank=comment_bank, section_ranking=section_ranking
    )

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(comments, f, indent=2, ensure_ascii=False)

    print(f"\n[CLI] Success! Exported generated comments for {len(comments)} students to '{args.output}'.")


if __name__ == '__main__':
    main()
