// Removes test calls such as `it("...", () => { ... });` from source text,
// given the line where each call starts. A small scanner finds the matching
// closing parenthesis while skipping strings, template literals and comments.

function skipString(src: string, i: number): number {
  const quote = src[i];
  i++;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (quote === "`" && c === "$" && src[i + 1] === "{") {
      i = matchClose(src, i + 1, "{", "}") + 1;
      continue;
    }
    if (c === quote) return i + 1;
    i++;
  }
  throw new Error("unterminated string");
}

// Index of the bracket that closes the one at `start`.
function matchClose(src: string, start: number, open: string, close: string): number {
  let depth = 0;
  let i = start;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      i = src.indexOf("\n", i);
      if (i === -1) break;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i) + 2;
      continue;
    }
    if (c === open) depth++;
    if (c === close && --depth === 0) return i;
    i++;
  }
  throw new Error(`no matching ${close}`);
}

export function removeCalls(src: string, startLines: number[]): string {
  const lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") lineStarts.push(i + 1);

  const ranges = startLines.map((line) => {
    const from = lineStarts[line - 1];
    const paren = src.indexOf("(", from);
    let to = matchClose(src, paren, "(", ")") + 1;
    if (src[to] === ";") to++;
    if (src[to] === "\n") to++;
    return [from, to] as const;
  });

  let out = src;
  for (const [from, to] of ranges.sort((a, b) => b[0] - a[0])) {
    out = out.slice(0, from) + out.slice(to);
  }
  // Tidy what is left: drop groups that became empty, then stray blank lines.
  return out
    .replace(/^[ \t]*describe\((["'`])(?:\\.|(?!\1).)*\1,\s*\(\)\s*=>\s*\{\s*\}\);?\n?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\{\n\n/g, "{\n")
    .replace(/\n\n(\s*\}\);)/g, "\n$1")
    .replace(/\n+$/, "\n");
}
