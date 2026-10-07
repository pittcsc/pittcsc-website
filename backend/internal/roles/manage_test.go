package roles

import (
	"strings"
	"testing"
)

func TestPolicyKeepsMemberReadOnly(t *testing.T) {
	all := []string{"member", "foundry", "staff", "alumni"}
	for mask := 0; mask < 16; mask++ {
		actor := []string{}
		for i, role := range all {
			if mask&(1<<i) != 0 {
				actor = append(actor, role)
			}
		}
		staff := mask&4 != 0
		for _, role := range all {
			want := staff && role != "member"
			if CanManage(actor, role) != want {
				t.Fatalf("%v managing %s: want %v", actor, role, want)
			}
		}
		if CanManage(actor, "admin") || CanManage(actor, "Staff") {
			t.Fatal("roles without a policy rule must be read-only")
		}
	}
	if !Policy["staff"].Protected || !Policy["staff"].Confirm || Policy["foundry"].Confirm || Policy["alumni"].Protected {
		t.Fatal("unexpected confirmation or protection rules")
	}
}

func TestParseSearch(t *testing.T) {
	search, err := ParseSearch("  Ada \t  Lovelace ", "staff", "3")
	if err != nil || search.Query != "Ada Lovelace" || search.Role != "staff" || search.Page != 3 {
		t.Fatalf("normalization failed: %+v %v", search, err)
	}
	if search, err := ParseSearch("", "", ""); err != nil || search.Page != 1 {
		t.Fatal("empty search must list the first page")
	}
	if _, err := ParseSearch(strings.Repeat("é", 100), "", ""); err != nil {
		t.Fatal("100-character search rejected")
	}
	for _, tc := range [][3]string{
		{strings.Repeat("x", 101), "", ""}, {"a\x00b", "", ""}, {"\xff", "", ""},
		{"", "Staff", ""}, {"", "staff'--", ""}, {"", strings.Repeat("a", 31), ""},
		{"", "", "0"}, {"", "", "-1"}, {"", "", "10001"}, {"", "", "1.5"}, {"", "", "two"},
	} {
		if _, err := ParseSearch(tc[0], tc[1], tc[2]); err != ErrInvalidSearch {
			t.Fatalf("invalid search accepted: %q", tc)
		}
	}
}

func TestLikeEscaping(t *testing.T) {
	if got := likeEscaper.Replace(`50%_off\`); got != `50\%\_off\\` {
		t.Fatalf("wildcards not escaped: %s", got)
	}
}
