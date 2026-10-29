package profile

import "testing"

func TestParseDirectorySearch(t *testing.T) {
	search, err := ParseDirectorySearch("  Ada \t Lovelace  ", "  pNc  Bank ", "1", "2")
	if err != nil || search.Name != "Ada Lovelace" || search.Company != "pNc Bank" || !search.Alumni || search.Page != 2 {
		t.Fatalf("unexpected parsed search: %+v %v", search, err)
	}
	for _, input := range [][4]string{{"Ada", "", "", "0"}, {"Ada", "", "", "nope"}, {"Ada", "", "", "10001"}, {"x\x00y", "", "", "1"}, {"Ada", "x\n", "", "1"}, {"Ada", "", "true", "1"}} {
		if _, err := ParseDirectorySearch(input[0], input[1], input[2], input[3]); err != ErrInvalidSearch {
			t.Fatalf("accepted invalid search %+v", input)
		}
	}
}
