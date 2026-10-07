package events

import (
	"errors"
	"strings"
	"testing"
)

func validInput() Input {
	return Input{Title: " Test event ", Location: " Room 101 ", Description: " Optional notes ", Start: "2027-01-15T18:00", End: "2027-01-15T19:00"}
}

func TestValidation(t *testing.T) {
	in := validInput()
	if err := in.Validate(); err != nil {
		t.Fatal(err)
	}
	if in.Title != "Test event" || in.Location != "Room 101" || in.Description != "Optional notes" || in.StartsAt.Format("15:04Z07:00") != "23:00Z" {
		t.Fatal("normalization or New York conversion failed")
	}
	for _, mutate := range []func(*Input){
		func(i *Input) { i.Title = "  " }, func(i *Input) { i.Location = "" },
		func(i *Input) { i.Title = strings.Repeat("a", 201) }, func(i *Input) { i.Location = strings.Repeat("a", 501) },
		func(i *Input) { i.Description = strings.Repeat("a", 5001) }, func(i *Input) { i.Title = "a\nb" },
		func(i *Input) { i.Description = "a\x00b" }, func(i *Input) { i.Version = -1 },
	} {
		in = validInput()
		mutate(&in)
		if !errors.Is(in.Validate(), ErrInvalid) {
			t.Fatal("invalid fields accepted")
		}
	}
	in = validInput()
	in.Description = ""
	if err := in.Validate(); err != nil {
		t.Fatal("optional description rejected")
	}
}

func TestNewYorkDSTAndInvalidTimes(t *testing.T) {
	for _, tc := range []struct{ start, end, utc string }{
		{"2027-07-01T18:00", "2027-07-01T19:00", "2027-07-01T22:00:00Z"},
		{"2027-01-01T18:00", "2027-01-01T19:00", "2027-01-01T23:00:00Z"},
		{"2027-03-14T01:30", "2027-03-14T03:30", "2027-03-14T06:30:00Z"},
	} {
		in := validInput()
		in.Start, in.End = tc.start, tc.end
		if err := in.Validate(); err != nil || in.StartsAt.Format("2006-01-02T15:04:05Z07:00") != tc.utc {
			t.Fatalf("timezone case %s: %v", tc.start, err)
		}
	}
	for _, pair := range [][2]string{
		{"2027-03-14T02:30", "2027-03-14T03:30"}, // skipped hour
		{"2027-11-07T01:30", "2027-11-07T02:30"}, // repeated hour
		{"2027-01-01T18:00", "2027-01-01T18:00"},
		{"2027-01-01T19:00", "2027-01-01T18:00"},
		{"2027-02-30T18:00", "2027-03-01T18:00"},
		{"2027-01-01T18:00Z", "2027-01-01T19:00Z"},
		{"", "2027-01-01T19:00"},
	} {
		in := validInput()
		in.Start, in.End = pair[0], pair[1]
		if !errors.Is(in.Validate(), ErrTime) {
			t.Fatalf("invalid time accepted: %v", pair)
		}
	}
}
