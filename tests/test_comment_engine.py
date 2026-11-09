#!/usr/bin/env python3
"""
Unit Test Suite for Student Assessment Comment Generator Core Algorithms & Data Models
Author: Google DeepMind Pair Programming
Python: 3.8+ (Zero external dependencies)
"""

import unittest
import re
import json
import math
import random
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ==============================================================================
# Python Logical Mirrors of Core JavaScript Algorithms for Exact Parity Testing
# ==============================================================================

def extract_question_ids_from_expression(expr):
    """Mirror of CommentEngine.extractQuestionIdsFromExpression in js/comment-engine.js"""
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
    """Mirror of CommentEngine.parseCommentEntry in js/comment-engine.js"""
    raw_text = entry if isinstance(entry, str) else (entry.get("text") or "")
    tags = list(entry.get("tags", [])) if isinstance(entry, dict) and isinstance(entry.get("tags"), list) else []
    section = entry.get("section") if isinstance(entry, dict) else None
    question_ids = []

    if isinstance(entry, dict) and entry.get("questionIds"):
        question_ids = list(entry["questionIds"])
    elif isinstance(entry, dict) and entry.get("questionId"):
        question_ids = [entry["questionId"]]

    clean_text = raw_text.strip()

    prefix_match = re.match(
        r'^(?:(?:Questions?|Q)\s*)?((?:\d+[a-z]*(?:(?:\s*(?:,\s*|\s+and\s+|\s*&\s*|\s*,\s*(?:Questions?|Q)\s*)\s*|\s*(?:-|to)\s*(?=(?:(?:Questions?|Q)\s*)?\d|[a-z]{1,4}(?:[\t:\.\-\)]|\s+[A-Z]))|\s+(?=(?:(?:Questions?|Q)\s*)?\d))(?:\d+[a-z]*|[a-z]{1,4}))*))(?:\s*[\t:\.\-\)]+\s*|\s+(?=[A-Z]))(.*)$',
        clean_text,
        flags=re.IGNORECASE
    )

    if prefix_match:
        q_expr = prefix_match.group(1).strip()
        remainder = prefix_match.group(2).strip()
        if re.match(r'^\d', q_expr) or re.match(r'^[Qq]\d', q_expr):
            extracted = extract_question_ids_from_expression(q_expr)
            if extracted and remainder:
                question_ids = extracted
                clean_text = remainder

    if not question_ids:
        for t in tags:
            m = re.match(r'^(?:Q\s*)?(\d+)([a-z]+)?$', t, flags=re.IGNORECASE)
            if m:
                num = m.group(1)
                letter = m.group(2).lower() if m.group(2) else ''
                q_id = f"Q{num}{letter}"
                if q_id not in question_ids:
                    question_ids.append(q_id)

    custom_tags = [t for t in tags if not re.match(r'^(?:Q\s*)?\d+[a-z]*$', t, flags=re.IGNORECASE) and t not in question_ids]
    is_general = len(question_ids) == 0 and (not section or section == 'General')

    return {
        "text": clean_text,
        "rawText": raw_text,
        "questionId": question_ids[0] if question_ids else None,
        "questionIds": question_ids,
        "section": section,
        "tags": custom_tags,
        "isGeneral": is_general
    }


def is_question_match(comment_qid, test_qid):
    """Mirror of CommentEngine.isQuestionMatch in js/comment-engine.js"""
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
        c_num = c_parent_sub[1]
        c_let = c_parent_sub[2]
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
        t_num = t_parent_sub[1]
        t_let = t_parent_sub[2]
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


def recalculate_question_ids_by_section(questions):
    """Mirror of recalculateQuestionIdsBySection in app.js"""
    current_section_name = 'General'
    section_used_ids = {}

    for idx, q in enumerate(questions):
        if q.get("isSectionBreak"):
            current_section_name = q.get("name") or 'Section'
            continue

        if q.get("isPenalty") or q.get("isTotal") or q.get("isPercentage") or q.get("isSummary"):
            q["section"] = None
            continue

        q["section"] = current_section_name

        if current_section_name not in section_used_ids:
            section_used_ids[current_section_name] = {}
        used_map = section_used_ids[current_section_name]

        base_id = ''
        if q.get("headerName") and q.get("headerName") != 'Manual Entry':
            clean = str(q.get("headerName")).strip()
            clean = re.sub(r'\s*\(\s*\d+\s*marks?\s*\)', '', clean, flags=re.IGNORECASE)
            clean = re.sub(r'^question\s*', 'Q', clean, flags=re.IGNORECASE)
            clean = re.sub(r'^q\s+', 'Q', clean, flags=re.IGNORECASE)
            if re.match(r'^\d+[a-z]?$', clean, flags=re.IGNORECASE):
                clean = f"Q{clean}"
            base_id = clean or f"Q{idx + 1}"
        elif q.get("id"):
            base_id = re.sub(r'_\d+$', '', q["id"])
        else:
            base_id = f"Q{idx + 1}"

        if base_id in used_map:
            count = used_map[base_id] + 1
            used_map[base_id] = count
            q["id"] = f"{base_id}_{count}"
        else:
            used_map[base_id] = 1
            q["id"] = base_id

    return questions


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
    """Centralized score summary calculation matching CommentEngine.calculateStudentScoreSummary."""
    raw_scores = student.get("scores", {})
    calculated_obtained = 0.0
    calculated_max = 0.0
    scored_questions_count = 0
    has_explicit_absence = False

    active_questions = [q for q in questions if not q.get("isSectionBreak") and not q.get("isSummary") and q.get("included") is not False]

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
        target_ach = min(max_ach, total - min_imp)
        target_imp = total - target_ach
        if target_imp < min_imp:
            target_imp = min_imp
            target_ach = total - target_imp
        if target_imp > max_imp:
            target_imp = max_imp
            target_ach = total - target_imp
    elif num_pct < 50:
        target_imp = min(max_imp, total - min_ach)
        target_ach = total - target_imp
        if target_ach < min_ach:
            target_ach = min_ach
            target_imp = total - target_ach
        if target_ach > max_ach:
            target_ach = max_ach
            target_imp = total - target_ach
    else:
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
    """Clean and verify comment structure."""
    candidate_ach = candidate_ach or []
    candidate_imp = candidate_imp or []
    target_ach, target_imp, total = get_target_distribution(pct, config)

    if not raw_text:
        ach_pads = "\n".join([f"[No Achievement comment {k+1}]" for k in range(target_ach)])
        imp_pads = "\n".join([f"[No Improvement comment {k+1}]" for k in range(target_imp)])
        return f"Achievements:\n{ach_pads}\n\nImprovements:\n{imp_pads}"

    # Strip thinking tags from reasoning models (e.g. DeepSeek-R1 <think>...</think>)
    text_without_think = re.sub(r'<think>[\s\S]*?</think>', '', raw_text, flags=re.IGNORECASE).strip()
    if not text_without_think:
        ach_pads = "\n".join([f"[No Achievement comment {k+1}]" for k in range(target_ach)])
        imp_pads = "\n".join([f"[No Improvement comment {k+1}]" for k in range(target_imp)])
        return f"Achievements:\n{ach_pads}\n\nImprovements:\n{imp_pads}"

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

    # Note: Do NOT refill from candidate_ach / candidate_imp into synthesized comments

    while len(final_ach) < target_ach:
        missing_idx = len(final_ach) + 1
        final_ach.append(f"[No Achievement comment {missing_idx}]")

    while len(final_imp) < target_imp:
        missing_idx = len(final_imp) + 1
        final_imp.append(f"[No Improvement comment {missing_idx}]")

    return f"Achievements:\n{chr(10).join(final_ach[:target_ach])}\n\nImprovements:\n{chr(10).join(final_imp[:target_imp])}"


def generate_random_comment(student, questions, comment_bank=None, config=None):
    """Directly sample comments from matching candidate pool."""
    summary = calculate_student_score_summary(student, questions)
    if summary["is_zero_out_of_zero"]:
        return "Incomplete due to absences"

    pct = summary["percentage"]
    target_ach, target_imp, total = get_target_distribution(pct, config)

    candidate_ach = []
    candidate_imp = []
    if comment_bank:
        raw_ach_bank = comment_bank.get("achievements", [])
        raw_imp_bank = comment_bank.get("improvements", [])
        scores = student.get("scores", {})
        correct_qs = [
            q for q in questions
            if not q.get("isPenalty")
            and isinstance(get_question_score(student, q), (int, float))
            and get_question_score(student, q) >= (q.get("maxMarks", 1) * 0.5)
        ]
        incorrect_qs = [
            q for q in questions
            if not q.get("isPenalty")
            and isinstance(get_question_score(student, q), (int, float))
            and get_question_score(student, q) < (q.get("maxMarks", 1) * 0.5)
        ]

        for item in raw_ach_bank:
            txt = item.get("text", "") if isinstance(item, dict) else str(item)
            q_ids = item.get("questionIds") or ([item.get("questionId")] if item.get("questionId") else []) if isinstance(item, dict) else []
            sec = item.get("section") if isinstance(item, dict) else None
            is_tagged = bool(q_ids)

            if is_tagged:
                matched = [q for q in correct_qs if is_section_match(sec, q.get("section"), is_question_tagged=True) and any(is_question_match(qid, q.get("id")) for qid in q_ids)]
                if matched and txt and txt not in candidate_ach:
                    candidate_ach.append(txt)
            else:
                if not sec or sec == 'General':
                    if txt and txt not in candidate_ach:
                        candidate_ach.append(txt)
                else:
                    if any(is_section_match(sec, q.get("section"), is_question_tagged=False) for q in correct_qs):
                        if txt and txt not in candidate_ach:
                            candidate_ach.append(txt)

        for item in raw_imp_bank:
            txt = item.get("text", "") if isinstance(item, dict) else str(item)
            q_ids = item.get("questionIds") or ([item.get("questionId")] if item.get("questionId") else []) if isinstance(item, dict) else []
            sec = item.get("section") if isinstance(item, dict) else None
            is_tagged = bool(q_ids)

            if is_tagged:
                matched = [q for q in incorrect_qs if is_section_match(sec, q.get("section"), is_question_tagged=True) and any(is_question_match(qid, q.get("id")) for qid in q_ids)]
                if matched and txt and txt not in candidate_imp:
                    candidate_imp.append(txt)
            else:
                if not sec or sec == 'General':
                    if txt and txt not in candidate_imp:
                        candidate_imp.append(txt)
                else:
                    if any(is_section_match(sec, q.get("section"), is_question_tagged=False) for q in incorrect_qs):
                        if txt and txt not in candidate_imp:
                            candidate_imp.append(txt)

    shuffled_ach = list(candidate_ach)
    random.shuffle(shuffled_ach)
    selected_ach = []
    seen_ach = set()
    for cmt in shuffled_ach:
        if len(selected_ach) >= target_ach:
            break
        norm = re.sub(r'[^a-z0-9]', '', cmt.lower())
        if norm not in seen_ach:
            seen_ach.add(norm)
            selected_ach.append(cmt)

    while len(selected_ach) < target_ach:
        missing_idx = len(selected_ach) + 1
        selected_ach.append(f"[No Achievement comment {missing_idx}]")

    shuffled_imp = list(candidate_imp)
    random.shuffle(shuffled_imp)
    selected_imp = []
    seen_imp = set()
    for cmt in shuffled_imp:
        if len(selected_imp) >= target_imp:
            break
        norm = re.sub(r'[^a-z0-9]', '', cmt.lower())
        if norm not in seen_imp and norm not in seen_ach:
            seen_imp.add(norm)
            selected_imp.append(cmt)

    while len(selected_imp) < target_imp:
        missing_idx = len(selected_imp) + 1
        selected_imp.append(f"[No Improvement comment {missing_idx}]")

    return f"Achievements:\n{chr(10).join(selected_ach[:target_ach])}\n\nImprovements:\n{chr(10).join(selected_imp[:target_imp])}"


class MockCommentBank:
    """Python mirror of CommentBank in js/comment-bank.js for testing data operations."""
    def __init__(self):
        self.achievements = []
        self.improvements = []

    def clear_all(self):
        self.achievements = []
        self.improvements = []

    def reset(self):
        self.clear_all()

    def add_achievement(self, text, tags=None, question_id=None, section=None, question_ids=None):
        q_ids = list(question_ids) if question_ids else ([question_id] if question_id else [])
        item = {
            "id": f"ach_{random.randint(1000, 9999)}",
            "text": text.strip(),
            "tags": tags or [],
            "questionId": q_ids[0] if q_ids else question_id,
            "questionIds": q_ids,
            "section": section or None
        }
        self.achievements.append(item)
        return item

    def add_improvement(self, text, tags=None, question_id=None, section=None, question_ids=None):
        q_ids = list(question_ids) if question_ids else ([question_id] if question_id else [])
        item = {
            "id": f"imp_{random.randint(1000, 9999)}",
            "text": text.strip(),
            "tags": tags or [],
            "questionId": q_ids[0] if q_ids else question_id,
            "questionIds": q_ids,
            "section": section or None
        }
        self.improvements.append(item)
        return item

    def get_achievements_by_section(self, section=None):
        if not section or section == 'General':
            return [a for a in self.achievements if not a.get("section") or a.get("section") == 'General']
        return [a for a in self.achievements if a.get("section") == section]

    def get_improvements_by_section(self, section=None):
        if not section or section == 'General':
            return [i for i in self.improvements if not i.get("section") or i.get("section") == 'General']
        return [i for i in self.improvements if i.get("section") == section]

    def clear_section_achievements(self, section=None):
        if not section or section == 'General':
            self.achievements = [a for a in self.achievements if a.get("section") and a.get("section") != 'General']
        else:
            self.achievements = [a for a in self.achievements if a.get("section") != section]

    def clear_section_improvements(self, section=None):
        if not section or section == 'General':
            self.improvements = [i for i in self.improvements if i.get("section") and i.get("section") != 'General']
        else:
            self.improvements = [i for i in self.improvements if i.get("section") != section]

    def clear_section(self, section=None):
        self.clear_section_achievements(section)
        self.clear_section_improvements(section)

    def import_from_json(self, payload, mode='merge', target_section=None):
        incoming_achs = payload.get("achievements", [])
        incoming_imps = payload.get("improvements", [])

        if mode == 'replace':
            if target_section and target_section != 'All':
                self.clear_section(target_section)
            else:
                self.clear_all()

        added_ach = 0
        added_imp = 0

        for item in incoming_achs:
            text = item.get("text", "") if isinstance(item, dict) else str(item)
            if not text.strip():
                continue
            sec = target_section if target_section and target_section != 'All' else (item.get("section") if isinstance(item, dict) else None)
            existing = self.get_achievements_by_section(sec)
            if mode == 'merge' and any(e["text"].strip().lower() == text.strip().lower() for e in existing):
                continue
            self.add_achievement(text, item.get("tags", []), item.get("questionId"), sec, item.get("questionIds"))
            added_ach += 1

        for item in incoming_imps:
            text = item.get("text", "") if isinstance(item, dict) else str(item)
            if not text.strip():
                continue
            sec = target_section if target_section and target_section != 'All' else (item.get("section") if isinstance(item, dict) else None)
            existing = self.get_improvements_by_section(sec)
            if mode == 'merge' and any(e["text"].strip().lower() == text.strip().lower() for e in existing):
                continue
            self.add_improvement(text, item.get("tags", []), item.get("questionId"), sec, item.get("questionIds"))
            added_imp += 1

        return {"success": True, "achievementsAdded": added_ach, "improvementsAdded": added_imp}


# ==============================================================================
# Master Unit Test Suite
# ==============================================================================

class TestCommentEngineAlgorithms(unittest.TestCase):
    """Comprehensive test suite verifying core parsing, matching, renumbering, and generation logic."""

    # --------------------------------------------------------------------------
    # 1. Question Expression Parsing Tests
    # --------------------------------------------------------------------------
    def test_expression_parser_single_and_multiple(self):
        self.assertEqual(extract_question_ids_from_expression("Q1"), ["Q1"])
        self.assertEqual(extract_question_ids_from_expression("Q1,2, 4"), ["Q1", "Q2", "Q4"])
        self.assertEqual(extract_question_ids_from_expression("1, 2, 3"), ["Q1", "Q2", "Q3"])
        self.assertEqual(extract_question_ids_from_expression("Questions 1, 2 and 4"), ["Q1", "Q2", "Q4"])

    def test_expression_parser_subquestion_letter_chain(self):
        self.assertEqual(extract_question_ids_from_expression("7a, b"), ["Q7a", "Q7b"])
        self.assertEqual(extract_question_ids_from_expression("7a, 7b"), ["Q7a", "Q7b"])
        self.assertEqual(extract_question_ids_from_expression("1a, b, c"), ["Q1a", "Q1b", "Q1c"])
        self.assertEqual(extract_question_ids_from_expression("12a, b"), ["Q12a", "Q12b"])

    def test_expression_parser_ranges(self):
        self.assertEqual(extract_question_ids_from_expression("1-4"), ["Q1", "Q2", "Q3", "Q4"])
        self.assertEqual(extract_question_ids_from_expression("Q1 to Q3"), ["Q1", "Q2", "Q3"])
        self.assertEqual(extract_question_ids_from_expression("7a-c"), ["Q7a", "Q7b", "Q7c"])
        self.assertEqual(extract_question_ids_from_expression("7a to 7c"), ["Q7a", "Q7b", "Q7c"])

    def test_expression_parser_whitespace_and_mixed_tokens(self):
        self.assertEqual(extract_question_ids_from_expression("Q1,   Q2 & Q3"), ["Q1", "Q2", "Q3"])
        self.assertEqual(extract_question_ids_from_expression("Questions 3a, 3b and 4"), ["Q3a", "Q3b", "Q4"])

    # --------------------------------------------------------------------------
    # 2. Comment Entry Parsing & Prefix Stripping Tests
    # --------------------------------------------------------------------------
    def test_comment_entry_prefix_extraction_and_text_stripping(self):
        entry = "Q1,2, 4\tStudent excelled in identifying geometric sequences."
        parsed = parse_comment_entry(entry)
        self.assertEqual(parsed["questionIds"], ["Q1", "Q2", "Q4"])
        self.assertEqual(parsed["text"], "Student excelled in identifying geometric sequences.")
        self.assertFalse(parsed["isGeneral"])

    def test_comment_entry_multi_question_letter_chain_prefix(self):
        entry = "7a, b: Correctly calculated rate of change and horizontal intercept."
        parsed = parse_comment_entry(entry)
        self.assertEqual(parsed["questionIds"], ["Q7a", "Q7b"])
        self.assertEqual(parsed["text"], "Correctly calculated rate of change and horizontal intercept.")

    def test_longer_alphabetical_subquestion_bulk_paste(self):
        """Test bulk paste parsing on subquestions with longer alphabetical differentiators (8di, 8dii, 7ci, etc.)."""
        raw_paste = """Q1\tSuccessfully identified isomorphic graphs.
Q2\tUnderstood the concepts, conventions and notations of walks, trails, paths, cycles and circuits.
Q2a\tSuccessfully identified a circuit from a diagram.
Q2b\tSuccessfully identified a trail from a diagram.
Q3\tWas able to find the number of faces from a graph drawn in non-planar form.
Q4\tDetermined the capacity of a cut through a network.
Q5\tSuccessfully used an adjacency matrix to complete a network graph.
Q6\tSuccessfully analysed a bipartite graph to solve an allocation problem.
Q7\tDemonstrated a strong understanding of Eulerian trails/circuits and Hamiltonian paths/cycles.
Q7a\tCorrectly determined the degree of a specific vertex.
Q7b\tAccurately drew a Hamiltonian cycle on a given graph starting from a specified vertex.
Q7ci\tCorrectly identified an Eulerian trail across a network and determined its finishing vertex.
Q7cii\tCorrectly identified an Eulerian trail across a network and determined its finishing vertex.
Q8\tDemonstrated a strong understanding of Prim's and Djikstra's Algorithms
Q8a\tAccurately calculated the sum of the degrees of all vertices in a weighted network.
Q8bi\tUsed Dijkstra’s Algorithm to find the shortest path and its overall distance between two vertices.
Q8bii\tUsed Dijkstra’s Algorithm to find the shortest path and its overall distance between two vertices.
Q8ci\tIdentified the conditions for a Hamiltonian path.
Q8cii\tIdentified a Hamiltonian path and analysed revisitation constraints when traversing a graph.
Q8di\tDemonstrated an understanding of the minimum spanning tree.
Q8dii\tUsed Prim's Algorithm to find the minimum spanning tree and determine its length.
Q9\tSolved the Hungarian Algorithm by hand to determine the two optimal allocations.
Q9a\tDemonstrated knowledge of the Hungarian Algorithm by performing a row reduction.
Q9b\tDemonstrated knowledge of the Hungarian Algorithm by performing a column reduction.
Q9c\tSolved the Hungarian Algorithm by hand to determine the two optimal allocations."""

        lines = [l.strip() for l in raw_paste.strip().split('\n') if l.strip()]
        for line in lines:
            prefix, expected_text = line.split('\t')
            parsed = parse_comment_entry(line)
            self.assertEqual(parsed["questionId"], prefix, f"Failed questionId match for {prefix}")
            self.assertEqual(parsed["questionIds"], [prefix], f"Failed questionIds match for {prefix}")
            self.assertEqual(parsed["text"], expected_text.strip(), f"Failed text stripping for {prefix}")
            self.assertFalse(parsed["isGeneral"], f"{prefix} should not be marked as general")

    def test_longer_alphabetical_subquestion_expressions(self):
        """Test multi-question expressions with longer alphabetical subquestions."""
        self.assertEqual(extract_question_ids_from_expression("Q8di, 8dii"), ["Q8di", "Q8dii"])
        self.assertEqual(extract_question_ids_from_expression("8di, dii"), ["Q8di", "Q8dii"])
        self.assertEqual(extract_question_ids_from_expression("Questions 8bi and 8bii"), ["Q8bi", "Q8bii"])
        self.assertEqual(extract_question_ids_from_expression("7ci, 7cii"), ["Q7ci", "Q7cii"])

        parsed = parse_comment_entry("Q8di, 8dii\tDemonstrated MST algorithms.")
        self.assertEqual(parsed["questionIds"], ["Q8di", "Q8dii"])
        self.assertEqual(parsed["text"], "Demonstrated MST algorithms.")

        parsed2 = parse_comment_entry("8di, dii: Demonstrated MST algorithms.")
        self.assertEqual(parsed2["questionIds"], ["Q8di", "Q8dii"])
        self.assertEqual(parsed2["text"], "Demonstrated MST algorithms.")

        parsed3 = parse_comment_entry("Questions 8bi and 8bii - Shortest path finding.")
        self.assertEqual(parsed3["questionIds"], ["Q8bi", "Q8bii"])
        self.assertEqual(parsed3["text"], "Shortest path finding.")

    def test_comment_entry_tag_fallback_for_question_ids(self):
        entry = {
            "text": "Understands recurrence rules.",
            "tags": ["Q1a", "Financial", "Algebra"],
            "section": "Financial Maths"
        }
        parsed = parse_comment_entry(entry)
        self.assertEqual(parsed["questionIds"], ["Q1a"])
        self.assertEqual(parsed["tags"], ["Financial", "Algebra"])
        self.assertEqual(parsed["section"], "Financial Maths")

    # --------------------------------------------------------------------------
    # 3. Question Hierarchy & Section Scoping Tests
    # --------------------------------------------------------------------------
    def test_question_hierarchy_matching(self):
        # Direct matching
        self.assertTrue(is_question_match("Q1", "1"))
        self.assertTrue(is_question_match("Q1a", "1a"))
        self.assertTrue(is_question_match("7b", "Q7B"))
        self.assertTrue(is_question_match("Q8di", "8di"))
        self.assertTrue(is_question_match("8di", "Q8di"))
        self.assertTrue(is_question_match("Q8dii", "8dii"))
        self.assertTrue(is_question_match("Q7ci", "7ci"))

        # Parent Q1 matches subquestions 1a, 1b, 1c
        self.assertTrue(is_question_match("Q1", "1a"))
        self.assertTrue(is_question_match("Q1", "1b"))
        self.assertTrue(is_question_match("1", "Q1c"))

        # Parent Q8 matches subquestions 8a, 8bi, 8di, 8dii
        self.assertTrue(is_question_match("Q8", "8di"))
        self.assertTrue(is_question_match("Q8", "8dii"))
        self.assertTrue(is_question_match("8", "Q8bi"))

        # Parent subquestion Q8d matches sub-subquestions 8di, 8dii
        self.assertTrue(is_question_match("Q8d", "8di"))
        self.assertTrue(is_question_match("Q8d", "8dii"))

        # Subquestion to parent
        self.assertTrue(is_question_match("8di", "Q8"))
        self.assertTrue(is_question_match("8di", "Q8d"))
        self.assertTrue(is_question_match("8dii", "Q8d"))

        # Non-matching
        self.assertFalse(is_question_match("Q1", "Q2"))
        self.assertFalse(is_question_match("Q7a", "Q8a"))
        self.assertFalse(is_question_match("Q1", "2a"))

        # Sibling subquestions must NOT match each other
        self.assertFalse(is_question_match("8di", "8dii"))
        self.assertFalse(is_question_match("8dii", "8di"))
        self.assertFalse(is_question_match("8bi", "8bii"))
        self.assertFalse(is_question_match("8ci", "8cii"))
        self.assertFalse(is_question_match("8a", "8b"))
        self.assertFalse(is_question_match("8di", "8ci"))

    def test_section_isolation_scoping(self):
        # General untagged applies everywhere
        self.assertTrue(is_section_match("General", "Section A", is_question_tagged=False))
        self.assertTrue(is_section_match(None, "Section B", is_question_tagged=False))

        # Question-tagged general comments do NOT match named sections
        self.assertFalse(is_section_match("General", "Section A", is_question_tagged=True))
        self.assertFalse(is_section_match(None, "Section B", is_question_tagged=True))
        self.assertFalse(is_section_match("General", "SAQ", is_question_tagged=True))
        self.assertFalse(is_section_match("", "MCQ", is_question_tagged=True))
        self.assertTrue(is_section_match("General", "General", is_question_tagged=True))

        # Exact and normalized section match
        self.assertTrue(is_section_match("Section A", "Section A"))
        self.assertTrue(is_section_match("Section A", "Section A - Financial Mathematics"))
        self.assertTrue(is_section_match("Section B", "Section B (Short Answer)"))
        self.assertTrue(is_section_match("MCQ", "Section A - MCQ"))
        self.assertTrue(is_section_match("SAQ", "Section B - SAQ"))

        # Cross section isolation (MUST be False)
        self.assertFalse(is_section_match("Section A", "Section B"))
        self.assertFalse(is_section_match("Section A", "Section B (Short Answer)"))
        self.assertFalse(is_section_match("Section B", "Section A"))
        self.assertFalse(is_section_match("MCQ", "SAQ"))
        self.assertFalse(is_section_match("MCQ", "Section B - SAQ"))
        self.assertFalse(is_section_match("SAQ", "Section A - MCQ"))

    def test_cross_section_question_isolation_mcq_saq(self):
        """
        Verify that a student who got Q5b correct in SAQ and Q5 incorrect in MCQ
        does NOT receive the overarching Q5 achievement comment from the MCQ bank.
        """
        questions = [
            {"id": "Q1", "section": "MCQ", "maxMarks": 1},
            {"id": "Q5", "section": "MCQ", "maxMarks": 1},
            {"id": "Q1a", "section": "SAQ", "maxMarks": 1},
            {"id": "Q5a", "section": "SAQ", "maxMarks": 1},
            {"id": "Q5b", "section": "SAQ", "maxMarks": 1},
        ]

        comment_bank = {
            "achievements": [
                {
                    "text": "Demonstrated a strong understanding of matrix operations in order to identify unknown pronumerals.",
                    "questionIds": ["Q5"],
                    "section": "MCQ"
                },
                {
                    "text": "Correctly determined the unknown pronumerals from a given matrix equation.",
                    "questionIds": ["Q5b"],
                    "section": "SAQ"
                }
            ],
            "improvements": []
        }

        # Student scored 0 on MCQ Q5, but 1 on SAQ Q5b
        student = {
            "name": "Jane Doe",
            "scores": {
                "Q1": 1,
                "Q5": 0,
                "Q1a": 1,
                "Q5a": 0,
                "Q5b": 1
            }
        }

        cmt = generate_random_comment(student, questions, comment_bank=comment_bank)

        # MCQ Q5 achievement must NOT be selected
        mcq_comment_text = "Demonstrated a strong understanding of matrix operations in order to identify unknown pronumerals."
        self.assertNotIn(mcq_comment_text, cmt)

        # SAQ Q5b achievement MUST be selected
        saq_comment_text = "Correctly determined the unknown pronumerals from a given matrix equation."
        self.assertIn(saq_comment_text, cmt)

    def test_cross_section_duplicate_question_id_score_isolation(self):
        """
        Verify that when two questions in different sections have the identical ID (e.g. Q1 in MCQ and Q1 in SAQ),
        a student receiving 3 out of 3 for the SAQ Q1 receives 3/3 (100%) and not 1/3 (33%) from the 1-mark MCQ Q1.
        """
        questions = [
            {"id": "Q1", "section": "MCQ", "maxMarks": 1, "colIndex": 1},
            {"id": "Q2", "section": "MCQ", "maxMarks": 1, "colIndex": 2},
            {"id": "Q1", "section": "SAQ", "maxMarks": 3, "colIndex": 10},
        ]

        # Student scores 1/1 on MCQ Q1, 1/1 on MCQ Q2, and 3/3 on SAQ Q1
        student = {
            "name": "Alex Smith",
            "scores": {
                "col_1": 1,
                "col_2": 1,
                "col_10": 3,
                "MCQ__Q1": 1,
                "MCQ__Q2": 1,
                "SAQ__Q1": 3,
                # Note: flat "Q1" key might be 1 from MCQ or missing, but get_question_score must resolve 3 for SAQ
                "Q1": 1
            }
        }

        # 1. Test get_question_score disambiguation
        mcq_q1_score = get_question_score(student, questions[0])
        saq_q1_score = get_question_score(student, questions[2])
        self.assertEqual(mcq_q1_score, 1)
        self.assertEqual(saq_q1_score, 3)

        # 2. Test overall summary calculation: 1 + 1 + 3 = 5 out of 5
        summary = calculate_student_score_summary(student, questions)
        self.assertEqual(summary["obtained"], 5)
        self.assertEqual(summary["max"], 5)
        self.assertEqual(summary["percentage"], 100)

        # 3. Test random comment generation with comment bank
        comment_bank = {
            "achievements": [
                {
                    "text": "Mastered complex short answer matrix calculations.",
                    "questionIds": ["Q1"],
                    "section": "SAQ"
                }
            ],
            "improvements": [
                {
                    "text": "Needs practice with short answer matrix calculations.",
                    "questionIds": ["Q1"],
                    "section": "SAQ"
                }
            ]
        }

        cmt = generate_random_comment(student, questions, comment_bank=comment_bank)
        # Because student got 3/3 on SAQ Q1, they must get the achievement and NOT the improvement
        self.assertIn("Mastered complex short answer matrix calculations.", cmt)
        self.assertNotIn("Needs practice with short answer matrix calculations.", cmt)

    # --------------------------------------------------------------------------
    # 4. Scoped Question ID Renumbering Across & Within Sections
    # --------------------------------------------------------------------------
    def test_scoped_question_id_renumbering_across_sections(self):
        # Questions in different sections with same names (e.g. Q1, Q2, Q3) must remain Q1, Q2, Q3
        raw_questions = [
            {"isSectionBreak": True, "name": "Section A"},
            {"headerName": "1", "maxMarks": 1},
            {"headerName": "2", "maxMarks": 1},
            {"headerName": "3", "maxMarks": 1},
            {"isSectionBreak": True, "name": "Section B"},
            {"headerName": "1", "maxMarks": 1},
            {"headerName": "2", "maxMarks": 1},
            {"headerName": "3", "maxMarks": 1}
        ]
        recalculated = recalculate_question_ids_by_section(raw_questions)
        sec_a_q3 = recalculated[3]
        sec_b_q3 = recalculated[7]
        self.assertEqual(sec_a_q3["id"], "Q3")
        self.assertEqual(sec_a_q3["section"], "Section A")
        self.assertEqual(sec_b_q3["id"], "Q3")
        self.assertEqual(sec_b_q3["section"], "Section B")

    def test_scoped_question_id_renumbering_within_same_section(self):
        # Duplicate question names WITHIN the same section get suffixed _2
        raw_questions = [
            {"isSectionBreak": True, "name": "Section A"},
            {"headerName": "3", "maxMarks": 1},
            {"headerName": "3", "maxMarks": 1}
        ]
        recalculated = recalculate_question_ids_by_section(raw_questions)
        self.assertEqual(recalculated[1]["id"], "Q3")
        self.assertEqual(recalculated[2]["id"], "Q3_2")

    # --------------------------------------------------------------------------
    # 5. Comment Generation Targets & Constraints Tests
    # --------------------------------------------------------------------------
    def test_dynamic_target_distribution(self):
        # High performer (>= 70%) -> 4 Ach, 2 Imp, 6 Total
        self.assertEqual(get_target_distribution(90), (4, 2, 6))
        self.assertEqual(get_target_distribution(75), (4, 2, 6))

        # Low performer (< 50%) -> 2 Ach, 4 Imp, 6 Total
        self.assertEqual(get_target_distribution(45), (2, 4, 6))
        self.assertEqual(get_target_distribution(20), (2, 4, 6))

        # Mid performer (50 - 69%) -> 3 Ach, 3 Imp, 6 Total
        self.assertEqual(get_target_distribution(60), (3, 3, 6))
        self.assertEqual(get_target_distribution(50), (3, 3, 6))

    def test_custom_target_distribution_and_constraints(self):
        # Custom total 8, minAch=3, maxAch=5, minImp=3, maxImp=5
        cfg = {
            "totalComments": 8,
            "minAchievements": 3,
            "maxAchievements": 5,
            "minImprovements": 3,
            "maxImprovements": 5
        }
        self.assertEqual(get_target_distribution(85, cfg), (5, 3, 8))
        self.assertEqual(get_target_distribution(35, cfg), (3, 5, 8))
        self.assertEqual(get_target_distribution(55, cfg), (4, 4, 8))

    def test_boundary_feasibility_resolution(self):
        # Case 1: minAch + minImp > total (e.g. 4 + 4 > 6) -> total clamped to 8
        cfg_high_min = {
            "totalComments": 6,
            "minAchievements": 4,
            "maxAchievements": 5,
            "minImprovements": 4,
            "maxImprovements": 5
        }
        self.assertEqual(get_target_distribution(90, cfg_high_min), (4, 4, 8))

        # Case 2: maxAch + maxImp < total (e.g. 2 + 2 < 6) -> bounds expanded
        cfg_low_max = {
            "totalComments": 6,
            "minAchievements": 1,
            "maxAchievements": 2,
            "minImprovements": 1,
            "maxImprovements": 2
        }
        ach, imp, tot = get_target_distribution(90, cfg_low_max)
        self.assertEqual(ach + imp, 6)
        self.assertEqual(tot, 6)

    # --------------------------------------------------------------------------
    # 6. Comment Output Verification & Anti-Redundancy Tests
    # --------------------------------------------------------------------------
    def test_exact_duplicate_deduplication(self):
        raw = ("Achievements:\n"
               "Understands least squares regression lines.\n"
               "Understands least squares regression lines.\n"
               "Correctly calculates slope.\n"
               "\nImprovements:\n"
               "Practice finding residuals.\n"
               "Practice finding residuals.\n")
        res = verify_and_clean_comments(raw, [], [], pct=85)
        ach_section = res.split("Improvements:")[0]
        imp_section = res.split("Improvements:")[1]
        self.assertEqual(ach_section.count("Understands least squares regression lines."), 1)
        self.assertEqual(ach_section.count("Correctly calculates slope."), 1)
        self.assertEqual(imp_section.count("Practice finding residuals."), 1)

    def test_candidate_pool_preservation_without_keyword_filtering(self):
        c_slope = "Was able to calculate and interpret the slope of a least squares regression line using the given data."
        c_intercept = "Correctly interpreted the vertical intercept of the least squares regression line in the context of the given variables."
        c_residual = "Correctly calculated the residual value by comparing the observed and predicted response values."
        c_draw = "Accurately drew the least squares regression line on the given scatterplot."

        candidates = [c_slope, c_intercept, c_residual, c_draw]
        raw_text = f"Achievements:\n{chr(10).join(candidates)}\n\nImprovements:"
        res = verify_and_clean_comments(raw_text, candidates, [], pct=85)
        self.assertIn(c_slope, res)
        self.assertIn(c_intercept, res)
        self.assertIn(c_residual, res)
        self.assertIn(c_draw, res)

    def test_zero_placeholder_and_authentic_output(self):
        raw = "Achievements:\nDemonstrated proficiency in recurrence models.\n\nImprovements:\nReview compound interest rates."
        res = verify_and_clean_comments(raw, [], [], pct=85)
        self.assertIn("Demonstrated proficiency in recurrence models.", res)
        self.assertIn("Review compound interest rates.", res)
        self.assertNotIn("Demonstrated strong conceptual clarity", res)
        self.assertNotIn("Dedicate time to reviewing key formulas", res)

    def test_numbered_missing_comment_placeholders(self):
        raw = ("Achievements:\n"
               "Demonstrated understanding of scatterplots.\n"
               "\nImprovements:\n"
               "Review residual calculation methods.\n")
        res = verify_and_clean_comments(raw, [], [], pct=60)
        ach_part = res.split("Improvements:")[0]
        imp_part = res.split("Improvements:")[1]

        self.assertIn("Demonstrated understanding of scatterplots.", ach_part)
        self.assertIn("[No Achievement comment 2]", ach_part)
        self.assertIn("[No Achievement comment 3]", ach_part)
        self.assertNotIn("[No Achievement comment 4]", ach_part)

        self.assertIn("Review residual calculation methods.", imp_part)
        self.assertIn("[No Improvement comment 2]", imp_part)
        self.assertIn("[No Improvement comment 3]", imp_part)

    def test_numbered_missing_comment_placeholders_with_empty_model_output(self):
        # When model returns empty text, produce full set of numbered placeholders
        res = verify_and_clean_comments("", [], [], pct=75)
        # High score 75% -> 4 Ach, 2 Imp
        self.assertIn("[No Achievement comment 1]", res)
        self.assertIn("[No Achievement comment 4]", res)
        self.assertIn("[No Improvement comment 1]", res)
        self.assertIn("[No Improvement comment 2]", res)

    def test_markdown_header_and_think_tags_cleaning(self):
        raw = """<think>
Evaluating student performance...
</think>
**Achievements:**
- Correctly identified multiple edges in a network diagram.
- Accurately counted vertices and edges in a graph.

### Improvements:
1. Practice finding both minimum spanning tree and shortest path.
2. Learn how to identify cuts in flow networks."""

        res = verify_and_clean_comments(raw, ["bank ach 1"], ["bank imp 1"], pct=50)
        self.assertNotIn("<think>", res)
        self.assertNotIn("Evaluating student performance", res)
        self.assertIn("Correctly identified multiple edges in a network diagram.", res)
        self.assertIn("Practice finding both minimum spanning tree and shortest path.", res)
        # Bank candidates must NOT be injected
        self.assertNotIn("bank ach 1", res)
        self.assertNotIn("bank imp 1", res)

    def test_no_accidental_bank_candidate_injection_in_synthesis(self):
        # If model outputs 1 achievement and 0 improvements, candidate items from bank must not be pasted
        raw = """Achievements:
Demonstrated strong understanding of Euler's formula in planar graphs.

Improvements:"""
        bank_ach = ["Raw Bank Item 1", "Raw Bank Item 2"]
        bank_imp = ["Raw Bank Item 3", "Raw Bank Item 4"]

        res = verify_and_clean_comments(raw, bank_ach, bank_imp, pct=50)
        self.assertIn("Demonstrated strong understanding of Euler's formula in planar graphs.", res)
        self.assertNotIn("Raw Bank Item 1", res)
        self.assertNotIn("Raw Bank Item 3", res)

    # --------------------------------------------------------------------------
    # 7. Student Score Calculation & Synchronizer Tests
    # --------------------------------------------------------------------------
    def test_sheet_total_and_percentage_synchronization(self):
        student = {
            "name": "Test Student",
            "scores": {
                "Q1": 1, "Q2": 1, "Q3": 1, "Q4": 1, "Q5": 1, "Q6": 1, "Q7": 1, "Q8": 1,
                "Q1a": 1, "Q1b": 0, "Q1c": 1,
                "Q2a": 1, "Q2b": 0, "Q2c": 0, "Q2d": 0, "Q2e": 0, "Q2f": 0, "Q2g": 0, "Q2h": 0, "Q2i": 1, "Q2j": 1,
                "Q3_2": 0, "Q4a": 0, "Q4b": 0,
                "Penalty": 0,
                "Total": 13,
                "Percentage": 0.43333333333333335
            }
        }
        questions = [
            {"id": "Q1", "maxMarks": 1}, {"id": "Q2", "maxMarks": 1}, {"id": "Q3", "maxMarks": 1},
            {"id": "Q4", "maxMarks": 1}, {"id": "Q5", "maxMarks": 1}, {"id": "Q6", "maxMarks": 1},
            {"id": "Q7", "maxMarks": 1}, {"id": "Q8", "maxMarks": 1},
            {"id": "Q1a", "maxMarks": 1}, {"id": "Q1b", "maxMarks": 1}, {"id": "Q1c", "maxMarks": 1},
            {"id": "Q2a", "maxMarks": 1}, {"id": "Q2b", "maxMarks": 1}, {"id": "Q2c", "maxMarks": 1},
            {"id": "Q2d", "maxMarks": 1}, {"id": "Q2e", "maxMarks": 1}, {"id": "Q2f", "maxMarks": 1},
            {"id": "Q2g", "maxMarks": 1}, {"id": "Q2h", "maxMarks": 1}, {"id": "Q2i", "maxMarks": 1},
            {"id": "Q2j", "maxMarks": 1},
            {"id": "Q3_2", "maxMarks": 1}, {"id": "Q4a", "maxMarks": 1}, {"id": "Q4b", "maxMarks": 1},
            {"id": "Penalty", "maxMarks": 0, "isPenalty": True}
        ]
        summary = calculate_student_score_summary(student, questions)
        self.assertEqual(summary["obtained"], 13)
        self.assertEqual(summary["max"], 30)
        self.assertEqual(summary["percentage"], 43)
        self.assertEqual(summary["band"], "Limited")
        self.assertFalse(summary["is_zero_out_of_zero"])

    def test_sheet_percentage_as_formatted_string(self):
        student = {
            "name": "Formatted String Student",
            "scores": {
                "Q1": 13,
                "Total": 13,
                "Percentage": "43%"
            }
        }
        questions = [{"id": "Q1", "maxMarks": 20}]
        summary = calculate_student_score_summary(student, questions)
        self.assertEqual(summary["obtained"], 13)
        self.assertEqual(summary["max"], 30)
        self.assertEqual(summary["percentage"], 43)
        self.assertEqual(summary["band"], "Limited")

    def test_decimal_sheet_percentages_and_ratios(self):
        student = {
            "name": "Ratio Student",
            "scores": {
                "Q1": 18,
                "Total": 18,
                "Percentage": 0.90
            }
        }
        questions = [{"id": "Q1", "maxMarks": 20}]
        summary = calculate_student_score_summary(student, questions)
        self.assertEqual(summary["obtained"], 18)
        self.assertEqual(summary["max"], 20)
        self.assertEqual(summary["percentage"], 90)
        self.assertEqual(summary["band"], "Outstanding")

    def test_standard_score_calculation_without_sheet_overrides(self):
        student = {
            "name": "Normal Student",
            "scores": {"Q1": 4, "Q2": 6, "Q3": 5}
        }
        questions = [
            {"id": "Q1", "maxMarks": 5},
            {"id": "Q2", "maxMarks": 10},
            {"id": "Q3", "maxMarks": 5}
        ]
        summary = calculate_student_score_summary(student, questions)
        self.assertEqual(summary["obtained"], 15)
        self.assertEqual(summary["max"], 20)
        self.assertEqual(summary["percentage"], 75)
        self.assertEqual(summary["band"], "Very Good")

    def test_penalty_questions_obtained_without_max_mark_inflation(self):
        student = {
            "name": "Penalty Student",
            "scores": {"Q1": 10, "Q2": 10, "Penalty": -2}
        }
        questions = [
            {"id": "Q1", "maxMarks": 10},
            {"id": "Q2", "maxMarks": 10},
            {"id": "Penalty", "maxMarks": 0, "isPenalty": True}
        ]
        summary = calculate_student_score_summary(student, questions)
        self.assertEqual(summary["obtained"], 18)
        self.assertEqual(summary["max"], 20)
        self.assertEqual(summary["percentage"], 90)
        self.assertEqual(summary["band"], "Outstanding")

    def test_absence_detection_and_incomplete_band(self):
        student = {
            "name": "Absent Student",
            "scores": {"Q1": "NA", "Total": 0, "Percentage": "NA"}
        }
        questions = [{"id": "Q1", "maxMarks": 10}]
        summary = calculate_student_score_summary(student, questions)
        self.assertEqual(summary["obtained"], 0)
        self.assertEqual(summary["max"], 0)
        self.assertEqual(summary["percentage"], 0)
        self.assertEqual(summary["band"], "Incomplete")
        self.assertTrue(summary["is_zero_out_of_zero"])

    def test_zero_out_of_zero_marks_absent_student(self):
        student = {
            "name": "Zero Max Student",
            "scores": {"Total": 0}
        }
        questions = []
        summary = calculate_student_score_summary(student, questions)
        self.assertTrue(summary["is_zero_out_of_zero"])
        self.assertEqual(summary["band"], "Incomplete")

    # --------------------------------------------------------------------------
    # 8. Random Selection Mode (Direct Bank Match) Tests
    # --------------------------------------------------------------------------
    def test_random_selection_mode_and_candidate_sampling(self):
        student = {
            "name": "Alex",
            "scores": {"Q1": 1, "Q2": 1, "Q3": 0, "Q4": 0}
        }
        questions = [
            {"id": "Q1", "maxMarks": 1},
            {"id": "Q2", "maxMarks": 1},
            {"id": "Q3", "maxMarks": 1},
            {"id": "Q4", "maxMarks": 1}
        ]
        comment_bank = {
            "achievements": [
                {"questionId": "Q1", "text": "Successfully calculated correlation coefficient."},
                {"questionId": "Q2", "text": "Interpreted the coefficient of determination accurately."}
            ],
            "improvements": [
                {"questionId": "Q3", "text": "Practice distinguishing explanatory and response variables."}
            ]
        }
        cfg = {
            "totalComments": 6,
            "minAchievements": 2,
            "maxAchievements": 4,
            "minImprovements": 2,
            "maxImprovements": 4
        }
        res = generate_random_comment(student, questions, comment_bank=comment_bank, config=cfg)

        self.assertIn("Successfully calculated correlation coefficient.", res)
        self.assertIn("Interpreted the coefficient of determination accurately.", res)
        self.assertIn("[No Achievement comment 3]", res)

        self.assertIn("Practice distinguishing explanatory and response variables.", res)
        self.assertIn("[No Improvement comment 2]", res)
        self.assertIn("[No Improvement comment 3]", res)

    def test_random_selection_mode_with_zero_candidates_numbered_pads(self):
        # Empty comment bank produces sequential numbered placeholders
        student = {"name": "Empty Bank Student", "scores": {"Q1": 10}}
        questions = [{"id": "Q1", "maxMarks": 10}]
        res = generate_random_comment(student, questions, comment_bank=None, config={"totalComments": 6})
        self.assertIn("[No Achievement comment 1]", res)
        self.assertIn("[No Achievement comment 4]", res)
        self.assertIn("[No Improvement comment 1]", res)
        self.assertIn("[No Improvement comment 2]", res)

    def test_random_selection_mode_absent_student(self):
        student = {"name": "Absent Student", "scores": {"Q1": "NA"}}
        questions = [{"id": "Q1", "maxMarks": 10}]
        res = generate_random_comment(student, questions, comment_bank=None)
        self.assertEqual(res, "Incomplete due to absences")

    # --------------------------------------------------------------------------
    # 9. Comment Bank Data Model Tests
    # --------------------------------------------------------------------------
    def test_comment_bank_clear_all_and_reset(self):
        bank = MockCommentBank()
        bank.add_achievement("Great working on recurrence.")
        bank.add_improvement("Review depreciation formulas.")
        self.assertEqual(len(bank.achievements), 1)
        self.assertEqual(len(bank.improvements), 1)

        bank.clear_all()
        self.assertEqual(len(bank.achievements), 0)
        self.assertEqual(len(bank.improvements), 0)

        bank.add_achievement("New comment")
        bank.reset()
        self.assertEqual(len(bank.achievements), 0)

    def test_comment_bank_section_filtering_and_clearing(self):
        bank = MockCommentBank()
        bank.add_achievement("General achievement", section='General')
        bank.add_achievement("Finance achievement", section='Financial Maths')
        bank.add_improvement("Finance improvement", section='Financial Maths')

        self.assertEqual(len(bank.get_achievements_by_section('General')), 1)
        self.assertEqual(len(bank.get_achievements_by_section('Financial Maths')), 1)

        # Clear section
        bank.clear_section('Financial Maths')
        self.assertEqual(len(bank.get_achievements_by_section('Financial Maths')), 0)
        self.assertEqual(len(bank.get_achievements_by_section('General')), 1)

    def test_comment_bank_import_merge_and_replace_modes(self):
        bank = MockCommentBank()
        bank.add_achievement("Existing comment.")

        incoming = {
            "achievements": [
                {"text": "Existing comment."}, # duplicate
                {"text": "Brand new comment."}
            ],
            "improvements": [
                {"text": "New improvement."}
            ]
        }

        # Merge Mode: skips duplicate
        res = bank.import_from_json(incoming, mode='merge')
        self.assertEqual(res["achievementsAdded"], 1)
        self.assertEqual(len(bank.achievements), 2)

        # Replace Mode: clears existing
        bank.import_from_json(incoming, mode='replace')
        self.assertEqual(len(bank.achievements), 2)
        self.assertEqual(len(bank.improvements), 1)

    # --------------------------------------------------------------------------
    # 10. Backup & Export Schema Validation Tests
    # --------------------------------------------------------------------------
    def test_comment_bank_export_import_schema(self):
        bank_payload = {
            "version": "1.0",
            "exportType": "comment_bank",
            "section": "Financial Maths",
            "timestamp": 1720000000,
            "achievements": [
                {"id": "ach_1", "text": "Understands recurrence rules.", "tags": ["Financial"], "section": "Financial Maths"}
            ],
            "improvements": [
                {"id": "imp_1", "text": "Practice compound interest formulas.", "tags": ["Financial"], "section": "Financial Maths"}
            ]
        }
        json_str = json.dumps(bank_payload)
        parsed = json.loads(json_str)
        self.assertEqual(parsed["exportType"], "comment_bank")
        self.assertEqual(len(parsed["achievements"]), 1)
        self.assertEqual(len(parsed["improvements"]), 1)

    def test_all_data_export_import_schema(self):
        all_data_payload = {
            "version": "1.0",
            "exportType": "all_data",
            "timestamp": 1720000000,
            "classes": [
                {
                    "id": "class_1",
                    "name": "Year 12 General Mathematics",
                    "assessments": [
                        {
                            "id": "assess_1",
                            "name": "SAC 1",
                            "questions": [{"id": "Q1", "maxMarks": 2, "section": "Recursion"}],
                            "commentBank": {"achievements": [], "improvements": []},
                            "students": [{"id": "s1", "name": "Alice Smith", "scores": {"Q1": 2}}]
                        }
                    ]
                }
            ]
        }
        json_str = json.dumps(all_data_payload)
        parsed = json.loads(json_str)
        self.assertEqual(parsed["exportType"], "all_data")
        self.assertEqual(len(parsed["classes"]), 1)
        self.assertEqual(len(parsed["classes"][0]["assessments"]), 1)

    def test_single_class_export_import_schema(self):
        single_class_payload = {
            "version": "1.0",
            "exportType": "single_class",
            "timestamp": 1720000000,
            "class": {
                "id": "class_101",
                "name": "11 Mathematical Methods",
                "assessments": []
            }
        }
        json_str = json.dumps(single_class_payload)
        parsed = json.loads(json_str)
        self.assertEqual(parsed["exportType"], "single_class")
        self.assertEqual(parsed["class"]["name"], "11 Mathematical Methods")


class TestSectionRankingEngine(unittest.TestCase):
    """Test suite for Section Priority Ranking and deterministic comment generation."""

    def setUp(self):
        self.questions = [
            {"id": "Q1", "section": "MCQ", "maxMarks": 1},
            {"id": "Q2", "section": "MCQ", "maxMarks": 1},
            {"id": "Q3", "section": "MCQ", "maxMarks": 1},
            {"id": "Q4", "section": "SAQ", "maxMarks": 2},
            {"id": "Q5", "section": "SAQ", "maxMarks": 3},
            {"id": "Q6", "section": "SAQ", "maxMarks": 4},
        ]
        self.bank = {
            "achievements": [
                {"id": "a_mcq1", "text": "Successfully answered MCQ Question 1.", "questionId": "Q1", "section": "MCQ"},
                {"id": "a_mcq2", "text": "Successfully answered MCQ Question 2.", "questionId": "Q2", "section": "MCQ"},
                {"id": "a_saq4", "text": "Demonstrated full mastery of SAQ Question 4.", "questionId": "Q4", "section": "SAQ"},
                {"id": "a_saq5", "text": "Demonstrated full mastery of SAQ Question 5.", "questionId": "Q5", "section": "SAQ"},
                {"id": "a_gen", "text": "Consistently produced well-structured working.", "section": "General"}
            ],
            "improvements": [
                {"id": "i_mcq3", "text": "Review multiple choice concepts for Question 3.", "questionId": "Q3", "section": "MCQ"},
                {"id": "i_saq6", "text": "Needs further practice with complex steps in SAQ Question 6.", "questionId": "Q6", "section": "SAQ"},
                {"id": "i_gen", "text": "Ensure all calculation steps are clearly communicated.", "section": "General"}
            ]
        }

    def test_section_preference_saq_over_mcq(self):
        import cli
        # Student mastered Q1, Q2 (MCQ) and Q4, Q5 (SAQ)
        student = {
            "name": "Alice",
            "scores": {"Q1": 1, "Q2": 1, "Q3": 0, "Q4": 2, "Q5": 3, "Q6": 0}
        }
        # Config: 2 achievements, 2 improvements
        config = {"totalComments": 4, "minAchievements": 2, "maxAchievements": 2, "minImprovements": 2, "maxImprovements": 2}
        
        # When SAQ is ranked higher than MCQ:
        ranking_saq_first = ["SAQ", "MCQ", "General"]
        cmt = cli.generate_comments_for_student(student, self.questions, self.bank, config, ranking_saq_first)
        
        # Achievements should be selected from SAQ first
        self.assertIn("Demonstrated full mastery of SAQ Question 4.", cmt)
        self.assertIn("Demonstrated full mastery of SAQ Question 5.", cmt)
        self.assertNotIn("Successfully answered MCQ Question 1.", cmt)

    def test_section_preference_mcq_over_saq(self):
        import cli
        student = {
            "name": "Bob",
            "scores": {"Q1": 1, "Q2": 1, "Q3": 0, "Q4": 2, "Q5": 3, "Q6": 0}
        }
        config = {"totalComments": 4, "minAchievements": 2, "maxAchievements": 2, "minImprovements": 2, "maxImprovements": 2}
        
        # When MCQ is ranked higher than SAQ:
        ranking_mcq_first = ["MCQ", "SAQ", "General"]
        cmt = cli.generate_comments_for_student(student, self.questions, self.bank, config, ranking_mcq_first)
        
        # Achievements should be selected from MCQ first
        self.assertIn("Successfully answered MCQ Question 1.", cmt)
        self.assertIn("Successfully answered MCQ Question 2.", cmt)
        self.assertNotIn("Demonstrated full mastery of SAQ Question 4.", cmt)

    def test_fallback_when_high_priority_section_has_insufficient_comments(self):
        import cli
        # Student got only Q4 right in SAQ (1 achievement candidate), but Q1 and Q2 right in MCQ
        student = {
            "name": "Charlie",
            "scores": {"Q1": 1, "Q2": 1, "Q3": 0, "Q4": 2, "Q5": 0, "Q6": 0}
        }
        # Target 2 achievements
        config = {"totalComments": 4, "minAchievements": 2, "maxAchievements": 2, "minImprovements": 2, "maxImprovements": 2}
        ranking = ["SAQ", "MCQ", "General"]
        cmt = cli.generate_comments_for_student(student, self.questions, self.bank, config, ranking)
        
        # SAQ gives 1 achievement, then falls back to MCQ for the second
        self.assertIn("Demonstrated full mastery of SAQ Question 4.", cmt)
        self.assertIn("Successfully answered MCQ Question 1.", cmt)

    def test_general_comments_as_last_resort(self):
        import cli
        # Student got no specific question comments in SAQ or MCQ for achievements
        student = {
            "name": "David",
            "scores": {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0, "Q5": 0, "Q6": 0}
        }
        # Target at least 1 achievement
        config = {"totalComments": 3, "minAchievements": 1, "maxAchievements": 1, "minImprovements": 2, "maxImprovements": 2}
        ranking = ["SAQ", "MCQ", "General"]
        cmt = cli.generate_comments_for_student(student, self.questions, self.bank, config, ranking)
        
        # General achievement used only because SAQ and MCQ have 0 candidates
        self.assertIn("Consistently produced well-structured working.", cmt)

    def test_incomplete_due_to_absences(self):
        import cli
        student = {
            "name": "Eve",
            "scores": {"Q1": "NA", "Q2": "NA", "Q3": "NA", "Q4": "NA", "Q5": "NA", "Q6": "NA"}
        }
        cmt = cli.generate_comments_for_student(student, self.questions, self.bank)
        self.assertEqual(cmt, "Incomplete due to absences")

    def test_clean_output_without_placeholders(self):
        import cli
        # Bank has only 1 improvement total for this student, but config wants 3
        bank_limited = {
            "achievements": [],
            "improvements": [{"id": "i1", "text": "Needs further practice with complex steps.", "section": "General"}]
        }
        student = {"name": "Frank", "scores": {"Q1": 0}}
        config = {"totalComments": 4, "minAchievements": 0, "maxAchievements": 0, "minImprovements": 3, "maxImprovements": 3}
        cmt = cli.generate_comments_for_student(student, [{"id": "Q1", "maxMarks": 1}], bank_limited, config)
        
        # Must not contain canned placeholders like "[No Improvement comment 2]"
        self.assertNotIn("[No Improvement", cmt)
        self.assertNotIn("[No Achievement", cmt)
        self.assertIn("Needs further practice with complex steps.", cmt)


if __name__ == '__main__':
    unittest.main()
