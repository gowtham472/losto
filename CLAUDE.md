@AGENTS.md

# Losto - project rules

## Keep README.md current

`README.md` is the single description of what this app does and how to run it.
Treat it as part of the change, not paperwork afterwards.

**Update it in the same change whenever you:**

- add, remove or materially alter a feature
- add or change a route, an env var, or a `package.json` script
- change how a source is fetched, or what Losto can and cannot read
- change the fetching posture - robots.txt handling, user agent, rate limits
- add a dependency (also regenerate `THIRD-PARTY-NOTICES.md`)
- change anything a person deploying this would need to know

**Sections that go stale fastest:** Routes, Features, What it reads,
Configuration, Before releasing publicly.

Write what is true now. If something only half works, say which half - the
"What it reads" table names the sources that do not work and why, and that
honesty is the point. Do not describe intentions or planned work as though they
already ship.

## Other standing rules

- Prefer fixing the cause over adding a workaround, and say plainly when a limit
  is external rather than a bug.
- Anything user-facing that fetches from another site must keep respecting
  robots.txt, the rate limits, and the no-bypass rule.
- `/legal` describes a local-first app with no accounts. If that stops being
  true, the notice is wrong and must be rewritten, not patched.
