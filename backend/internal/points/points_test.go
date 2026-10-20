package points

import (
	"strings"
	"testing"
)

func TestNormalizeURL(t *testing.T) {
	cases := []struct {
		category, raw, want string
	}{
		{"leetcode", "https://www.leetcode.com/problems/two-sum/solutions/12345/explanation/?utm_source=email#answer", "https://leetcode.com/problems/two-sum/solutions/12345"},
		{"project", "https://www.github.com/Club/Repo/pull/42/files?diff=split#L1", "https://github.com/club/repo/pull/42"},
		{"project", "https://github.com/Club/Repo/commit/ABCDEF1234567/", "https://github.com/club/repo/commit/abcdef1234567"},
		{"paper", "https://EXAMPLE.org/paper/?b=2&utm_source=mail&a=1#section", "https://example.org/paper?a=1&b=2"},
	}
	for _, tc := range cases {
		t.Run(tc.category+tc.raw, func(t *testing.T) {
			got, err := NormalizeURL(tc.category, tc.raw)
			if err != nil || got != tc.want {
				t.Fatalf("got %q, %v; want %q", got, err, tc.want)
			}
		})
	}
}

func TestNormalizeURLRejectsInvalidAndUnsupportedClaims(t *testing.T) {
	cases := []struct{ category, raw string }{
		{"leetcode", "https://leetcode.com/problems/two-sum/"},
		{"leetcode", "https://leetcode.com/problems/two-sum/solutions/"},
		{"leetcode", "https://leetcode.com.evil.test/problems/two-sum/solutions/123"},
		{"project", "https://github.com/club/repo"},
		{"project", "https://github.com/club/repo/issues/1"},
		{"project", "https://github.com.evil.test/club/repo/pull/1"},
		{"paper", "http://example.org/paper"},
		{"paper", "javascript:alert(1)"},
		{"paper", "https://user:password@example.org/paper"},
		{"paper", "https://127.0.0.1/paper"},
		{"paper", "https://example.org:444/paper"},
		{"paper", "https://example.org/a%2fb"},
		{"unknown", "https://example.org/paper"},
	}
	for _, tc := range cases {
		t.Run(tc.category+tc.raw, func(t *testing.T) {
			if _, err := NormalizeURL(tc.category, tc.raw); err != ErrInvalid {
				t.Fatalf("accepted invalid claim: %v", err)
			}
		})
	}
}

func TestPageAndReasonValidation(t *testing.T) {
	if page, err := ParsePage(""); err != nil || page != 1 {
		t.Fatal("default page")
	}
	for _, raw := range []string{"0", "-1", "xyz", "100001"} {
		if _, err := ParsePage(raw); err != ErrInvalid {
			t.Fatalf("accepted page %q", raw)
		}
	}
	if _, err := ValidReason("   "); err != ErrInvalid {
		t.Fatal("accepted empty reason")
	}
	if got, err := ValidReason("  Duplicate  "); err != nil || got != "Duplicate" {
		t.Fatal("reason not trimmed")
	}
}

func TestNormalizationDoesNotDependOnChosenCategory(t *testing.T) {
	for _, raw := range []string{
		"https://www.github.com/Club/Repo/pull/42/files?utm_source=mail",
		"https://www.leetcode.com/problems/two-sum/solutions/12345/extra?utm_source=mail",
	} {
		category := "project"
		if strings.Contains(raw, "leetcode") {
			category = "leetcode"
		}
		a, err := NormalizeURL(category, raw)
		if err != nil {
			t.Fatal(err)
		}
		b, err := NormalizeURL("paper", raw)
		if err != nil || a != b {
			t.Fatalf("category bypasses link uniqueness: %q != %q (%v)", a, b, err)
		}
	}
}
