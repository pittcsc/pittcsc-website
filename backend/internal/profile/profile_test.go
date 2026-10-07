package profile

import (
	"strings"
	"testing"
)

func ptr[T any](v T) *T { return &v }

func TestPartialProfilesAndCompletion(t *testing.T) {
	input := Input{FirstName: ptr("  Test  "), LastName: ptr(" ")}
	if err := input.Validate(); err != nil {
		t.Fatal(err)
	}
	if *input.FirstName != "Test" || input.LastName != nil || input.Majors == nil {
		t.Fatal("fields were not normalized")
	}
	if complete(Record{FirstName: input.FirstName}) {
		t.Fatal("partial profile marked complete")
	}

	full := Record{
		FirstName: ptr("Test"), LastName: ptr("Member"),
		GraduationYear: ptr(2028), Majors: []string{"Computer Science"},
		GitHubUsername: ptr("octocat"), LeetCodeUsername: ptr("octocat"),
		LinkedInUsername: ptr("test-member"), HasResume: true,
	}
	if !complete(full) {
		t.Fatal("complete profile must not require a preferred name or a picture")
	}

	// A profile picture is optional and must not affect completion.
	withAvatar := full
	withAvatar.HasAvatar = true
	withoutAvatar := full
	withoutAvatar.HasAvatar = false
	if !complete(withAvatar) || !complete(withoutAvatar) {
		t.Fatal("a profile picture must not change completion")
	}

	// Every required field, dropped one at a time.
	for _, drop := range []struct {
		name  string
		apply func(*Record)
	}{
		{"github", func(r *Record) { r.GitHubUsername = nil }},
		{"leetcode", func(r *Record) { r.LeetCodeUsername = nil }},
		{"linkedin", func(r *Record) { r.LinkedInUsername = nil }},
		{"resume", func(r *Record) { r.HasResume = false }},
	} {
		record := full
		drop.apply(&record)
		if complete(record) {
			t.Fatalf("profile without a %s must not be complete", drop.name)
		}
	}
}

func TestHandleValidation(t *testing.T) {
	for _, tc := range []struct {
		name  string
		input Input
		valid bool
	}{
		{"github ok", Input{GitHubUsername: ptr("octo-cat9")}, true},
		{"github blank clears", Input{GitHubUsername: ptr("   ")}, true},
		{"github leading hyphen", Input{GitHubUsername: ptr("-octocat")}, false},
		{"github trailing hyphen", Input{GitHubUsername: ptr("octocat-")}, false},
		{"github double hyphen", Input{GitHubUsername: ptr("octo--cat")}, false},
		{"github too long", Input{GitHubUsername: ptr(strings.Repeat("a", 40))}, false},
		{"github url rejected", Input{GitHubUsername: ptr("https://github.com/octocat")}, false},
		// Regression: the pattern alone consumes the character after a hyphen,
		// so "a-a-a-..." slipped past it at 77 characters and only failed at the
		// database check constraint. maxLen bounds it here instead.
		{"github alternating hyphens over length", Input{GitHubUsername: ptr("a" + strings.Repeat("-a", 38))}, false},
		{"github path traversal", Input{GitHubUsername: ptr("../../etc/passwd")}, false},
		{"leetcode dots ok", Input{LeetCodeUsername: ptr("octo.cat_9-x")}, true},
		{"leetcode slash rejected", Input{LeetCodeUsername: ptr("octo/cat")}, false},
		{"linkedin ok", Input{LinkedInUsername: ptr("jordan-lee-1a2b3c")}, true},
		{"linkedin too short", Input{LinkedInUsername: ptr("ab")}, false},
		{"linkedin underscore rejected", Input{LinkedInUsername: ptr("jordan_lee")}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			input := tc.input
			err := input.Validate()
			if tc.valid && err != nil {
				t.Fatalf("expected valid, got %v", err)
			}
			if !tc.valid && err == nil {
				t.Fatal("expected the handle to be rejected")
			}
		})
	}

	// Whitespace is trimmed, and an all-whitespace handle clears the field.
	input := Input{GitHubUsername: ptr("  octocat  "), LeetCodeUsername: ptr(" ")}
	if err := input.Validate(); err != nil {
		t.Fatal(err)
	}
	if input.GitHubUsername == nil || *input.GitHubUsername != "octocat" {
		t.Fatal("handle was not trimmed")
	}
	if input.LeetCodeUsername != nil {
		t.Fatal("blank handle should clear to nil")
	}
}

func TestInputValidation(t *testing.T) {
	for _, tc := range []struct {
		name  string
		input Input
		valid bool
	}{
		{"empty", Input{}, true},
		{"multiple majors", Input{Majors: []string{"Computer Science", " Mathematics "}}, true},
		{"unicode name", Input{FirstName: ptr("Zoë")}, true},
		{"long name", Input{FirstName: ptr(strings.Repeat("a", 101))}, false},
		{"control character", Input{PreferredName: ptr("a\x00b")}, false},
		{"year too low", Input{GraduationYear: ptr(1899)}, false},
		{"year too high", Input{GraduationYear: ptr(2101)}, false},
		{"empty major", Input{Majors: []string{" "}}, false},
		{"duplicate major", Input{Majors: []string{"Math", " math "}}, false},
		{"too many majors", Input{Majors: make([]string, 9)}, false},
		{"long major", Input{Majors: []string{strings.Repeat("a", 121)}}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if (tc.input.Validate() == nil) != tc.valid {
				t.Fatalf("valid = %v", tc.valid)
			}
		})
	}
}
