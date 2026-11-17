package campaigns

import (
	"fmt"
	"html"
	"regexp"
	"strings"
)

var boldRE = regexp.MustCompile(`\*\*([^*]+)\*\*`)
var italicRE = regexp.MustCompile(`\*([^*]+)\*`)
var linkRE = regexp.MustCompile(`\[([^\]]+)\]\((https://[^\s)]+)\)`)

func formatText(raw string) string {
	s := html.EscapeString(raw)
	s = boldRE.ReplaceAllString(s, "<strong>$1</strong>")
	s = italicRE.ReplaceAllString(s, "<em>$1</em>")
	s = linkRE.ReplaceAllStringFunc(s, func(m string) string {
		v := linkRE.FindStringSubmatch(m)
		u := html.UnescapeString(v[2])
		if !safeURL(u) {
			return v[1]
		}
		return `<a href="` + html.EscapeString(u) + `">` + v[1] + `</a>`
	})
	return strings.ReplaceAll(s, "\n", "<br>")
}
func Render(d Draft, first, unsubscribe string) (string, string) {
	if strings.TrimSpace(first) == "" {
		first = "there"
	}
	replace := func(s string) string { return strings.ReplaceAll(s, "{{firstName}}", first) }
	var render func([]Block) string
	render = func(bs []Block) string {
		var b strings.Builder
		for _, v := range bs {
			t := replace(v.Text)
			switch v.Type {
			case "heading":
				b.WriteString(`<h2 style="color:#071b35;margin:20px 0 12px">` + html.EscapeString(t) + `</h2>`)
			case "text":
				b.WriteString(`<p style="line-height:1.7">` + formatText(t) + `</p>`)
			case "event":
				b.WriteString(`<div style="padding:20px;background:#f0f4fa;border-radius:12px;margin:16px 0">` + formatText(t))
				if v.URL != "" {
					b.WriteString(`<p><a href="` + html.EscapeString(v.URL) + `">View event</a></p>`)
				}
				b.WriteString(`</div>`)
			case "button":
				if v.URL == "" {
					b.WriteString("<p>" + html.EscapeString(t) + "</p>")
					continue
				}
				b.WriteString(`<p style="padding:12px 0"><a style="background:#ffb81c;color:#071b35;padding:14px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold" href="` + html.EscapeString(v.URL) + `">` + html.EscapeString(t) + `</a></p>`)
			case "image":
				if v.URL == "" {
					b.WriteString("<p>[Add an image]</p>")
					continue
				}
				b.WriteString(`<img style="max-width:100%;height:auto;display:block;border:0" src="` + html.EscapeString(v.URL) + `" alt="` + html.EscapeString(v.Alt) + `">`)
			case "divider":
				b.WriteString(`<hr style="border:0;border-top:1px solid #dce2eb;margin:24px 0">`)
			case "columns":
				b.WriteString(`<table role="presentation" width="100%"><tr>`)
				for _, child := range v.Children {
					b.WriteString(fmt.Sprintf(`<td style="vertical-align:top;padding:8px;width:%d%%">`, 100/len(v.Children)) + render([]Block{child}) + `</td>`)
				}
				b.WriteString(`</tr></table>`)
			}
		}
		return b.String()
	}
	body := render(d.Blocks)
	page := `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f5f9;font-family:Arial,sans-serif;color:#26354a"><div style="display:none;max-height:0;overflow:hidden">` + html.EscapeString(replace(d.Preheader)) + `</div><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px"><table role="presentation" style="max-width:640px;width:100%;background:white;border-radius:16px;overflow:hidden"><tr><td style="background:#071b35;color:white;padding:24px 32px;font-size:22px;font-weight:bold">Pitt CSC <span style="color:#ffb81c">/</span> Computer Science Club</td></tr><tr><td style="padding:16px 32px 32px">` + body + `</td></tr><tr><td style="padding:24px 32px;background:#eef2f8;font-size:12px;color:#59677a">University of Pittsburgh Computer Science Club<br><a href="` + html.EscapeString(unsubscribe) + `">Unsubscribe from CSC campaigns</a></td></tr></table></td></tr></table></body></html>`
	var text strings.Builder
	text.WriteString("Pitt CSC\n\n")
	var plain func([]Block)
	plain = func(bs []Block) {
		for _, b := range bs {
			text.WriteString(replace(b.Text) + "\n")
			if b.URL != "" {
				text.WriteString(b.URL + "\n")
			}
			plain(b.Children)
			text.WriteString("\n")
		}
	}
	plain(d.Blocks)
	text.WriteString("Unsubscribe: " + unsubscribe)
	return page, text.String()
}
