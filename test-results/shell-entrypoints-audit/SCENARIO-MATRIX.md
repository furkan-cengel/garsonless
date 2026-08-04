# Shell entrypoints verification matrix

| Area | Scenario | Required assertion | Baseline | Post-fix |
| --- | --- | --- | --- | --- |
| Responsive | 1440×1000, 820×1000, 390×844 | No horizontal overflow; surfaces remain usable | Partial pass | Pending |
| Zoom | 200% | Dialog scrolls without clipped controls | Fail | Pending |
| Help | Open/close, search, empty search, Escape, backdrop | Correct dialog semantics, focus trap and restoration | Fail | Automated contract pass; browser pending |
| Help links | Internal links, configured/unconfigured support URL, offline | Every visible action works; external URL is safe and leaks no context | Fail | Policy/contract pass; browser pending |
| Profile | Enter/Space, Arrow keys, Home/End, Escape, Tab, outside click | Menu semantics and predictable focus lifecycle | Fail | Automated contract pass; browser pending |
| Identity | Avatar success/error/absent; long values | Safe image policy and deterministic initials fallback | Partial pass | Unit policy pass; visual pending |
| Store | 1, 3, and 4+ stores; slow/error navigation | Authorized list only; selected, pending, retry and rollback states | Fail | Contract implemented; runtime pending |
| Overlay state | Rapid alternating clicks and route changes | One overlay only; route change closes stale surface | Partial pass | Contract implemented; browser pending |
| Logout | Dirty guard, double click, server failure, local-only session | One action; recoverable error; current endpoint/session only | Not run | Automated contract pass; disposable runtime pending |
| Security | Deleted/unauthorized tenants; plan badge mismatch | Server authorization remains authoritative | Pass | Regression tests pass |
| Observability | Slow/degraded reads | No awaited DB write on GET; no raw tenant/PII log | Fail | 11 tests pass |
| Network/console | All scenarios | No unexpected 4xx/5xx, pageerror, or PII-bearing warning | Partial pass | Pending |
