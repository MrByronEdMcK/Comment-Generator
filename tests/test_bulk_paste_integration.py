import unittest
from cli import parse_comment_entry

class TestBulkPasteUserComments(unittest.TestCase):
    def setUp(self):
        self.user_comments = [
            "1\tDetermine the y coordinate for a given x-coordinate on a straight line.",
            "2\tIdentified the gradient of a horizontal line.",
            "3\tDetermined which point does not lie on a given line.",
            "4\tCalculated the gradient of the line connecting two points.",
            "5\tDetermined the equation of a sketched line.",
            "6\tApplied real world scenarios to linear thinking to determine an unknown.",
            "7\tRearranged a linear equation to determine the gradient.",
            "8\tDetermined the y-coordinate for a given x-value in a non-linear equation.",
            "9\tApplied descriptions of movement on the cartesian plane to find new coordinates.",
            "10\tDetermined the x-intercept from a table of values."
        ]

    def test_parse_all_user_comments(self):
        expected_qids = [f"Q{i}" for i in range(1, 11)]
        
        for idx, line in enumerate(self.user_comments):
            parsed = parse_comment_entry(line)
            # Must return tags list without throwing
            self.assertIsInstance(parsed.get("tags"), list)
            # Question IDs must be correctly extracted
            self.assertEqual(parsed.get("questionIds"), [expected_qids[idx]])
            self.assertEqual(parsed.get("questionId"), expected_qids[idx])
            # Prefix must be stripped from text
            self.assertFalse(parsed["text"].startswith(f"{idx+1}\t"))
            self.assertFalse(parsed["text"].startswith(f"Q{idx+1}"))
            self.assertTrue(len(parsed["text"]) > 10)

if __name__ == '__main__':
    unittest.main()
