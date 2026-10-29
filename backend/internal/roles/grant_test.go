package roles

import "testing"

func TestValidateGrant(t *testing.T) {
	email, operator, err := Validate(" Fixture@PITT.EDU ", " Setup operator ")
	if err != nil || email != "fixture@pitt.edu" || operator != "Setup operator" {
		t.Fatal("normalization failed")
	}
	for _, tc := range [][2]string{
		{"fixture@example.com", "operator"}, {"fixture@sub.pitt.edu", "operator"},
		{"fixture@pitt.edu.evil.test", "operator"}, {"a b@pitt.edu", "operator"},
		{"fixture@pitt.edu", " "}, {"fixture@pitt.edu", "actor\ninjected"},
		{"fixture@pitt.edu", string(make([]byte, 201))},
	} {
		if _, _, err := Validate(tc[0], tc[1]); err != ErrInvalid {
			t.Fatal("invalid grant input accepted")
		}
	}
}
