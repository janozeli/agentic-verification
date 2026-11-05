// Deletes test definitions from source text, given a line inside each one.
// A definition is the whole statement: `it(...)`, `test.each(table)(...)`,
// `it.skip(...)`, wherever it sits (describe blocks, loops, helpers).
// Groups left empty are deleted too.
import { parse } from "@babel/parser";
import type { Node, Statement } from "@babel/types";

const TEST_FUNCTIONS = new Set(["it", "test"]);
const GROUP_FUNCTIONS = new Set(["describe"]);

// it(...), it.each(...)(...), test.skip(...) -> "it" / "test"
function rootCallee(node: Node | null | undefined): string | undefined {
  while (node) {
    if (node.type === "Identifier") return node.name;
    if (node.type === "CallExpression") node = node.callee;
    else if (node.type === "MemberExpression") node = node.object;
    else return undefined;
  }
}

function statements(src: string): Statement[] {
  const ast = parse(src, { sourceType: "module", plugins: ["typescript"] });
  const found: Statement[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const n = node as Node;
    if (n.type === "ExpressionStatement") found.push(n);
    for (const [key, value] of Object.entries(n)) {
      if (key !== "loc" && key !== "leadingComments" && key !== "trailingComments") visit(value);
    }
  };
  visit(ast.program);
  return found;
}

const isCall = (s: Statement, names: Set<string>) =>
  s.type === "ExpressionStatement" && s.expression.type === "CallExpression" && names.has(rootCallee(s.expression) ?? "");

// Remove [start, end) plus the indentation before it and the newline after it.
function cut(src: string, ranges: [number, number][]): string {
  let out = src;
  for (const [start, end] of ranges.sort((a, b) => b[0] - a[0])) {
    let from = start;
    while (from > 0 && (out[from - 1] === " " || out[from - 1] === "\t")) from--;
    let to = end;
    if (out[to] === "\n") to++;
    out = out.slice(0, from) + out.slice(to);
  }
  return out;
}

export function removeCalls(src: string, startLines: number[]): string {
  const tests = statements(src).filter((s) => isCall(s, TEST_FUNCTIONS));
  const targets = new Map<number, [number, number]>();
  for (const line of startLines) {
    // The innermost test statement whose lines include the reported line.
    const match = tests
      .filter((s) => s.loc!.start.line <= line && line <= s.loc!.end.line)
      .sort((a, b) => a.end! - a.start! - (b.end! - b.start!))[0];
    if (!match) throw new Error(`no test definition found at line ${line}`);
    targets.set(match.start!, [match.start!, match.end!]);
  }
  let out = cut(src, [...targets.values()]);

  // Drop describe(...) groups whose callback no longer has any statement.
  for (;;) {
    const empty = statements(out).filter((s) => {
      if (!isCall(s, GROUP_FUNCTIONS) || s.type !== "ExpressionStatement" || s.expression.type !== "CallExpression") return false;
      const fn = s.expression.arguments.at(-1);
      return (
        (fn?.type === "ArrowFunctionExpression" || fn?.type === "FunctionExpression") &&
        fn.body.type === "BlockStatement" &&
        fn.body.body.length === 0
      );
    });
    if (empty.length === 0) break;
    out = cut(out, empty.map((s) => [s.start!, s.end!]));
  }

  return out
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\{\n\n/g, "{\n")
    .replace(/\n\n(\s*\}\);)/g, "\n$1")
    .replace(/\n+$/, "\n");
}
