package profile

import "testing"

func TestParseDirectorySearch(t *testing.T) {
	query, page, err := ParseDirectorySearch("  Ada \t Lovelace  ", "2")
	if err != nil || query != "Ada Lovelace" || page != 2 {
		t.Fatalf("unexpected parsed search: %q %d %v", query, page, err)
	}
	for _, input := range [][2]string{{"Ada", "0"}, {"Ada", "nope"}, {"Ada", "10001"}, {"x\x00y", "1"}} {
		if _, _, err := ParseDirectorySearch(input[0], input[1]); err != ErrInvalidSearch {
			t.Fatalf("accepted invalid search %q/%q", input[0], input[1])
		}
	}
}
