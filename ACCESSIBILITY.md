# Accessibility review

The application UI (`ui/index.html`, `ui/widget/`, `ui/reviewer/`) was reviewed against WCAG 2.1 A and AA. Reference: https://www.w3.org/TR/WCAG21/.

Fixed missing control names and labels; autocomplete active-option and expanded states; stale search responses; mouse-only postal-code selection; year-selection state; missing skip navigation; suppressed focus indicators; low-contrast text; hidden elements overridden by flex styles; and narrow-screen layout overflow. Charts have exact-value table alternatives. The reviewer offers a keyboard-accessible table of rendered parcels, including assessment comparisons and history links; refresh it after moving or filtering the map. Third-party chart internals are inert because the adjacent tables provide their information.

Validation: Chrome with axe-core WCAG 2 A/AA and 2.1 A/AA rules returned zero violations on all three initial pages with live distribution data. All three pages fit a 320 CSS-pixel viewport after map resizing. Keyboard checks cover skip navigation, search-option active descendants and Escape dismissal on both search pages, using a deterministic geocoding response. JavaScript ESLint, shared CSS Stylelint and diff whitespace checks pass.

To repeat: `npm ci`, serve the repository with `python3 -m http.server 8765 --bind 127.0.0.1`, and run `npm run test:a11y` in another terminal. Tests use installed macOS Chrome; set `CHROME_PATH` for another Chrome executable. Live external resources must be reachable. The tests do not submit property searches or change remote data.

This is not a complete conformance certification. Manual VoiceOver/NVDA review, loaded property histories and error states, map-filter combinations, 200% text resizing, text-spacing overrides, and third-party loading failures still need end-to-end acceptance testing. Automated tools do not evaluate every success criterion. The generated research report `eda/opa_eda.html` is outside the application-page audit; it has not been certified or remediated in this review.
