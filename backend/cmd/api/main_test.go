package main

import "testing"

func TestFrontendOriginForLocalAndHostedServers(t *testing.T) {
	for _, tc := range []struct {
		bind, origin string
		valid        bool
	}{
		{"127.0.0.1", "http://localhost:8000", true},
		{"0.0.0.0", "https://pittcsc.org", true},
		{"0.0.0.0", "https://staging.pittcsc.org", true},
		{"0.0.0.0", "http://localhost:8000", false},
		{"0.0.0.0", "https://127.0.0.1:8000", false},
		{"0.0.0.0", "https://192.168.1.20", false},
		{"0.0.0.0", "http://pittcsc.org", false},
		{"0.0.0.0", "https://pittcsc.org/path", false},
		{"0.0.0.0", "https://pittcsc.org@localhost", false},
	} {
		if got := validateFrontendOrigin(tc.bind, tc.origin) == nil; got != tc.valid {
			t.Errorf("bind %q origin %q: valid=%v, want %v", tc.bind, tc.origin, got, tc.valid)
		}
	}
}
