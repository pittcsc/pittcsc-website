package profile

import (
	"net/url"
	"testing"
	"time"
)

func TestAlumniEligibilityUsesNewYorkYearAndNotCRMCompletion(t *testing.T) {
	r := Record{FirstName: ptr("Alumni"), LastName: ptr("Fixture"), GraduationYear: ptr(2027), HasAvatar: true, LinkedInUsername: ptr("alumni-fixture"), AlumniFields: AlumniFields{Location: ptr("Pittsburgh"), Bio: ptr("Happy to help"), CurrentCompany: ptr("Example"), CurrentRole: ptr("Engineer"), ContactEmail: ptr("fixture@example.org"), OpenToMentorship: true}}
	before := time.Date(2027, 1, 1, 4, 59, 59, 0, time.UTC)
	if len(AlumniMissing(r, before)) != 1 {
		t.Fatal("future class is eligible before New York's year rollover")
	}
	if m := AlumniMissing(r, before.Add(time.Second)); len(m) != 0 {
		t.Fatalf("eligible class rejected: %v", m)
	}
	if complete(r) {
		t.Fatal("test fixture should not need CRM majors, GitHub, LeetCode or resume for directory eligibility")
	}
	r.OpenToMentorship = false
	if len(AlumniMissing(r, before.Add(time.Second))) != 1 {
		t.Fatal("must offer at least one kind of help")
	}
	r.OpenToMentorship = true
	r.HasAvatar = false
	if len(AlumniMissing(r, before.Add(time.Second))) != 1 {
		t.Fatal("photo is required")
	}
}
func TestAlumniContactValidation(t *testing.T) {
	for _, value := range []string{"owner@pitt.edu", "owner@PITT.EDU", "Name <owner@example.org>", "owner@example.org\r\nBcc: other@example.org", "invalid", "owner@localhost"} {
		f := AlumniFields{ContactEmail: ptr(value)}
		if f.Validate() == nil {
			t.Fatalf("invalid contact accepted: %q", value)
		}
	}
	for _, value := range []string{" owner@example.org ", "owner+work@sub.example.org", ""} {
		f := AlumniFields{ContactEmail: ptr(value)}
		if err := f.Validate(); err != nil {
			t.Fatal(err)
		}
	}
	if err := (&Input{}).Validate(); err != nil {
		t.Fatal("empty CRM save should still work")
	}
}
func TestDirectoryQueryIsBoundedAndLiteral(t *testing.T) {
	q, err := ParseDirectoryQuery(url.Values{"search": {"%_"}, "page": {"2"}, "open_to_mentorship": {"true"}, "graduation_year": {"2026"}})
	if err != nil || q.Search != "%_" || q.Page != 2 || !q.Mentorship || q.Year != 2026 {
		t.Fatal(q, err)
	}
	for _, raw := range []string{"page=0", "page=50001", "page=1&page=2", "graduation_year=2026.5", "open_to_coffee_chats=1", "auth_user_id=someone"} {
		v, _ := url.ParseQuery(raw)
		if _, err := ParseDirectoryQuery(v); err == nil {
			t.Fatalf("invalid query accepted: %s", raw)
		}
	}
}
