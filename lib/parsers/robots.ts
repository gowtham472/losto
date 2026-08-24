/**
 * robots.txt support.
 *
 * Losto fetches on a person's behalf, one link at a time, but the request still
 * leaves the server rather than their browser — so it behaves like a well-run
 * bot: it identifies itself, reads robots.txt, and stays out of the paths a site
 * has asked automated clients to leave alone.
 */

const CACHE_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_ROBOTS_BYTES = 512 * 1024;

/** Overridable so a self-hoster can point operators at their own contact page. */
export const BOT_NAME = process.env.LOSTO_BOT_NAME ?? "LostoReader";
export const BOT_INFO_URL = process.env.LOSTO_BOT_URL ?? "https://github.com/losto-app/losto";

export const BOT_UA = `Mozilla/5.0 (compatible; ${BOT_NAME}/1.0; +${BOT_INFO_URL}) user-initiated-fetch`;

interface Rule {
  path: string;
  allow: boolean;
}

interface Robots {
  rules: Rule[];
  crawlDelayMs: number;
  /** No robots.txt, or it could not be read — treated as "no restrictions". */
  absent: boolean;
}

const cache = new Map<string, { at: number; robots: Robots }>();

/* -------------------------------------------------------------------------- */
/* Parsing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Collects the rules that apply to us: our own name if the file mentions it,
 * otherwise the `*` group. Groups are matched case-insensitively and consecutive
 * `User-agent` lines share one block, per the robots.txt convention.
 */
export function parseRobots(text: string, agent: string): Robots {
  const lines = text.split(/\r?\n/);
  const groups: { agents: string[]; rules: Rule[]; crawlDelay?: number }[] = [];
  let current: { agents: string[]; rules: Rule[]; crawlDelay?: number } | null = null;
  let expectingAgents = false;

  for (const raw of lines) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!current || !expectingAgents) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      expectingAgents = true;
      continue;
    }

    if (!current) continue;
    expectingAgents = false;

    if (field === "disallow") {
      // An empty Disallow means "nothing is disallowed" and is simply skipped.
      if (value) current.rules.push({ path: value, allow: false });
    } else if (field === "allow") {
      if (value) current.rules.push({ path: value, allow: true });
    } else if (field === "crawl-delay") {
      const seconds = Number.parseFloat(value);
      if (Number.isFinite(seconds)) current.crawlDelay = seconds;
    }
  }

  const me = agent.toLowerCase();
  const named = groups.filter((g) => g.agents.some((a) => a !== "*" && me.includes(a)));
  const wildcard = groups.filter((g) => g.agents.includes("*"));
  const chosen = named.length ? named : wildcard;

  return {
    rules: chosen.flatMap((g) => g.rules),
    crawlDelayMs: Math.min(10_000, (chosen.find((g) => g.crawlDelay)?.crawlDelay ?? 0) * 1000),
    absent: false,
  };
}

/**
 * Google's precedence rule: the longest matching pattern wins, and Allow beats
 * Disallow when two patterns are the same length.
 */
export function isAllowed(robots: Robots, pathname: string): boolean {
  if (robots.absent || !robots.rules.length) return true;

  let best: { length: number; allow: boolean } | null = null;
  for (const rule of robots.rules) {
    if (!matches(rule.path, pathname)) continue;
    const length = rule.path.replace(/\*/g, "").length;
    if (!best || length > best.length || (length === best.length && rule.allow)) {
      best = { length, allow: rule.allow };
    }
  }
  return best ? best.allow : true;
}

/** Supports the two wildcards robots.txt defines: `*` for any run, `$` for end. */
function matches(pattern: string, pathname: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}${anchored ? "$" : ""}`).test(pathname);
}

/* -------------------------------------------------------------------------- */
/* Lookup                                                                     */
/* -------------------------------------------------------------------------- */

export async function getRobots(origin: string, agent = BOT_NAME): Promise<Robots> {
  const key = `${origin}|${agent}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.robots;

  let robots: Robots = { rules: [], crawlDelayMs: 0, absent: true };
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": BOT_UA, accept: "text/plain,*/*;q=0.8" },
    });
    if (res.status === 200) {
      const text = (await res.text()).slice(0, MAX_ROBOTS_BYTES);
      robots = parseRobots(text, agent);
    } else {
      // 404 means no rules; 401/403 or a server error means "do not assume yes".
      await res.body?.cancel().catch(() => {});
      robots = { rules: [], crawlDelayMs: 0, absent: res.status === 404 || res.status === 410 };
      if (!robots.absent) robots.rules = [{ path: "/", allow: false }];
    }
  } catch {
    // Unreachable robots.txt is treated as no restriction; the fetch that
    // follows will fail on its own if the site is genuinely down.
    robots = { rules: [], crawlDelayMs: 0, absent: true };
  }

  cache.set(key, { at: Date.now(), robots });
  return robots;
}

export interface RobotsVerdict {
  allowed: boolean;
  crawlDelayMs: number;
}

export async function checkUrl(url: URL, agent = BOT_NAME): Promise<RobotsVerdict> {
  const robots = await getRobots(url.origin, agent);
  return {
    allowed: isAllowed(robots, url.pathname + url.search),
    crawlDelayMs: robots.crawlDelayMs,
  };
}
