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
	if !complete(Record{FirstName: ptr("Test"), LastName: ptr("Member"), GraduationYear: ptr(2028), Majors: []string{"Computer Science"}}) {
		t.Fatal("complete profile must not require a preferred name or resume")
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
