# Browser tools: which one to drive the app with

Measured 2026-10-02 in a cloud container (headless Chromium 1194, Playwright 1.61.1,
`@playwright/mcp` 0.0.83, `chrome-devtools-mcp` 1.10.1). Each MCP server was run over
stdio by a small client, so the numbers are what a model would send and read, not guesses.

## Pick

**Playwright scripts run through Bash.** On the same six tasks they cost about 2.4x fewer
tokens than either MCP server. They load no tool schemas, and they are the only option here
that did all six tasks with real input (true touch events, reduced motion, an init script and
`file://` with no extra flags). For screenshots, `npm run shots` already wraps this.

If a session wants an MCP server anyway, use Playwright MCP, and start it with `--headless`.
Add `--allow-unrestricted-file-access` if it has to open `file://` pages. Without `--headless`
it opens Chrome windows (as do the DevTools MCP's defaults).

## Tokens per task

Tokens are characters / 4 for the model's call arguments plus the text it reads back. Images
are left out because every option returns the same pixels (a 375x667 shot is about 330
tokens and a 1280x800 shot about 1,370, by w*h/750). Bash counts writing the script and
running it.

| Task | Bash scripts | Playwright MCP | DevTools MCP |
| --- | --- | --- | --- |
| Screenshot at 375x667 | 90 | 262 | 225 |
| Screenshot at 1280x800 | 90 | 263 | 226 |
| Reduced motion | 90 | 231 | not possible |
| Service worker and Cache Storage | 146 | 291 | 188 |
| Touch drag to find a word | 418 | 925 | 1,348 (mouse only) |
| Init script before page scripts, `file://` page | 140 | 379 | 298 |
| **Total** | **974** | **2,351** | **2,284** (5 tasks) |

Tool schemas are paid on top whenever the server's tools are loaded into context:

| Server | Tools | Schema tokens |
| --- | --- | --- |
| Playwright MCP (default) | 25 | ~5,100 |
| Playwright MCP `--caps devtools,vision` | 44 | ~7,900 |
| DevTools MCP | 30 | ~6,400 |
| DevTools MCP `--slim` | 3 | ~200, but no viewport, emulation or input tools |
| Bash | 0 extra | 0 |

## Capability

| | Bash scripts | Playwright MCP | DevTools MCP | Built-in browser pane |
| --- | --- | --- | --- | --- |
| Viewport | yes | `browser_resize` | `emulate` viewport | not measured |
| Reduced motion | yes | `browser_emulate_media` | **no**, `emulate` has no media option | not measured |
| Service worker, Cache Storage | yes | yes, via evaluate | yes, via evaluate | not measured |
| Touch drag | real touch via CDP | real touch, but only through `browser_run_code_unsafe` | `drag` sends mouse events even with `touch` emulation | not measured |
| Init script before page scripts | `addInitScript` | only through `browser_run_code_unsafe` | `navigate_page` `initScript` | not measured |
| `file://` pages | yes | blocked unless `--allow-unrestricted-file-access` | yes | not measured |
| WebKit | yes where WebKit is installed | `--browser webkit` exists | no, Chrome only | no |
| Headless by default | yes | no, needs `--headless` | no, needs `--headless` | n/a |

What was not measured, and why:

- **The built-in browser pane** only exists in the desktop app, so a cloud session can't use
  it. It got no numbers.
- **WebKit** isn't installed in this container, so neither the Bash path nor
  `--browser webkit` was run. The table only says the option exists.
- **Loading a pinned jsdelivr script.** This container's network policy refuses
  `cdn.jsdelivr.net` (the proxy returns 403), so the `file://` fixture loaded a local
  script instead. Whether the CDN loads depends on the session's network, not on the tool.

## Notes

- In Claude Code, MCP tool schemas can be deferred until searched for, which cuts the
  schema cost. Once a session loads the browser tools it needs, it pays for those schemas.
- Playwright MCP's `browser_run_code_unsafe` runs arbitrary Playwright code. That closes
  most of its capability gaps, but at that point it is the Bash path with more tokens
  around it.
- Synthetic `PointerEvent`s dispatched from page JavaScript can't stand in for a drag in
  this app. `pointerdown` calls `setPointerCapture`, which needs a real pointer.
