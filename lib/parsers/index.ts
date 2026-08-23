import { detectSource } from "../sources";
import type { ExtractResult, SourceId } from "../types";
import { deriveTitle } from "../utils";
import { parseChatGpt } from "./chatgpt";
import { parseClaude } from "./claude";
import { parseGeneric } from "./generic";
import { ExtractProblem } from "./http";
import { parsePerplexity } from "./perplexity";

export { ExtractProblem } from "./http";

export async function extractChat(rawUrl: string): Promise<ExtractResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ExtractProblem("bad_url", "That is not a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ExtractProblem("bad_url", "Only http and https links can be saved.");
  }
  if (isPrivateHost(url.hostname)) {
    throw new ExtractProblem("bad_url", "Local and private addresses cannot be fetched.");
  }

  const source: SourceId = detectSource(url.href);
  const result = await run(source, url.href);

  // Every source occasionally omits a title; the opening question is a fine one.
  const title = result.title?.trim() || deriveTitle(result.messages);
  return { ...result, title, source: result.source ?? source };
}

function run(source: SourceId, url: string): Promise<ExtractResult> {
  switch (source) {
    case "chatgpt":
      return parseChatGpt(url);
    case "claude":
      return parseClaude(url);
    case "perplexity":
      return parsePerplexity(url);
    default:
      return parseGeneric(url, source);
  }
}

/** Blocks SSRF against the deployment's own network. */
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h === "[::1]") {
    return true;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}
