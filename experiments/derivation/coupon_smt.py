"""Which coupon example tests follow from what we know?

Each value test of the agent-style suite becomes a fact about an
uninterpreted function F(base, kind, value, has_min, min) -> total, where
base is the subtotal (kind: 0 none, 1 percent, 2 fixed; no minimum is
encoded as has_min = False, min = 0). For each test we ask Z3 whether it is
entailed, at three levels of knowledge:

  points: only the tests kept by pruning, as facts
  rules:  those facts plus the six rules proved about the Dafny model
  model:  those facts plus the model's full definition

Entailed means no implementation satisfying the knowledge violates the test,
so the test is derivable and can go. Not entailed comes with a countermodel:
the value a conforming implementation could return instead (Padoa's method).
"""

import warnings

warnings.filterwarnings("ignore")
from z3 import (  # noqa: E402
    And, BoolSort, BoolVal, ForAll, Function, If, Implies, IntSort, IntVal, Ints,
    MultiPattern, Not, Solver, sat, unsat,
)

F = Function("F", IntSort(), IntSort(), IntSort(), BoolSort(), IntSort(), IntSort())
NONE, PCT, FIX = 0, 1, 2


def f(base, kind, value=0, minimum=None):
    has = minimum is not None
    return F(IntVal(base), IntVal(kind), IntVal(value), BoolVal(has), IntVal(minimum or 0))


# (name, kept by pruning, fact)
TESTS = [
    ("returns the subtotal without a coupon", False, f(1000, NONE) == 1000),
    ("returns the subtotal of several items without a coupon", False, f(2000, NONE) == 2000),
    ("returns 0 for an empty cart without a coupon", False, f(0, NONE) == 0),
    ("applies a 10% coupon", False, f(1000, PCT, 10) == 900),
    ("applies a 20% coupon", False, f(1000, PCT, 20) == 800),
    ("applies a 50% coupon", False, f(1000, PCT, 50) == 500),
    ("applies a 10% coupon to several items", False, f(2000, PCT, 10) == 1800),
    ("applies a 100% coupon", False, f(1000, PCT, 100) == 0),
    ("applies a 0% coupon", False, f(1000, PCT, 0) == 1000),
    ("rounds percent discounts down", True, f(999, PCT, 10) == 900),
    ("applies a fixed coupon", False, f(1000, FIX, 300) == 700),
    ("applies a fixed coupon of 100", False, f(1000, FIX, 100) == 900),
    ("applies a fixed coupon to several items", True, f(2000, FIX, 500) == 1500),
    ("never returns a negative total with a fixed coupon", False, f(1000, FIX, 5000) == 0),
    ("returns 0 when the fixed coupon equals the subtotal", False, f(1000, FIX, 1000) == 0),
    ("returns a non-negative total", False, f(1000, FIX, 300) >= 0),
    ("ignores the coupon below the minimum subtotal", True, f(1000, PCT, 10, 5000) == 1000),
    ("applies the coupon above the minimum subtotal", True, f(2000, PCT, 10, 1500) == 1800),
    ("ignores a fixed coupon below the minimum subtotal", False, f(1000, FIX, 300, 5000) == 1000),
]

b, k, v, w, m = Ints("b k v w m")

# The rules only relate points with the same base, so they are instantiated
# on a finite grid around the tests: every base and minimum that appears, and
# percentages on both sides of every boundary. Ground instances keep Z3
# decidable; a "yes" over them is a "yes" for the quantified rules.
BASES = sorted({0, 999, 1000, 2000})
PERCENTS = sorted({-1, 0, 1, 10, 20, 50, 99, 100, 101})
AMOUNTS = sorted({0, 100, 300, 500, 1000, 5000})
MINS = sorted({1500, 5000})


def points(base):
    yield (NONE, 0)
    for p in PERCENTS:
        yield (PCT, p)
    for a in AMOUNTS:
        yield (FIX, a)


def G(base, kind, value, minimum=None):
    return f(base, kind, value, minimum)


def rules():
    """The six rules proved in spec/coupon.dfy and lean/CouponModel.lean, instantiated."""
    out = []
    for base in BASES:
        for kind, value in points(base):
            for minimum in [None, base, *MINS]:
                t = G(base, kind, value, minimum)
                out.append(And(0 <= t, t <= base))  # never above the subtotal, never below zero
            out.append(G(base, kind, value, base) == G(base, kind, value))  # the minimum is inclusive
        out.append(G(base, PCT, 100) == 0)  # 100% off is free
        out.append(G(base, PCT, 0) == base)  # 0% off changes nothing
        for p in PERCENTS:
            if p < 0:
                out.append(G(base, PCT, p) == G(base, PCT, 0))  # clamped below
            if p > 100:
                out.append(G(base, PCT, p) == G(base, PCT, 100))  # clamped above
            if 0 <= p <= 100:
                out.append((base - G(base, PCT, p)) * 100 <= base * p)  # rounds down
            for q in PERCENTS:
                if p <= q:
                    out.append(G(base, PCT, q) <= G(base, PCT, p))  # monotone
    return out


def definition():
    """The model itself (Apply in spec/coupon.dfy), as an axiom on F."""
    from z3 import Bool

    hm = Bool("hm")
    clamp = If(v < 0, 0, If(v > 100, 100, v))
    discount = If(k == PCT, (b * clamp) / 100, v)
    total = If(k == NONE, b, If(And(hm, b < m), b, If(discount >= b, 0, b - discount)))
    return [ForAll([b, k, v, hm, m], Implies(b >= 0, F(b, k, v, hm, m) == total), patterns=[F(b, k, v, hm, m)])]


def entailed(knowledge, fact):
    s = Solver()
    s.set("timeout", 5000)
    s.add(*knowledge, Not(fact))
    r = s.check()
    if r == unsat:
        return "yes", None
    if r == sat:
        lhs = fact.arg(0)
        return "no", s.model().eval(lhs)
    return "unknown", None


def model_total(base, kind, value, minimum):
    if kind == NONE:
        return base
    if minimum is not None and base < minimum:
        return base
    clamp = 0 if value < 0 else 100 if value > 100 else value
    discount = base * clamp // 100 if kind == PCT else value
    return 0 if discount >= base else base - discount


def rules_hold(impl):
    """Check the six rules on a concrete implementation, over a wide grid."""
    for base in BASES:
        ps = range(-150, 251)
        for p in ps:
            for minimum in [None, base, *MINS]:
                t = impl(base, PCT, p, minimum)
                if not 0 <= t <= base:
                    return False
            if impl(base, PCT, p, base) != impl(base, PCT, p, None):
                return False
            if p < 0 and impl(base, PCT, p, None) != impl(base, PCT, 0, None):
                return False
            if p > 100 and impl(base, PCT, p, None) != impl(base, PCT, 100, None):
                return False
            if 0 <= p <= 100 and (base - impl(base, PCT, p, None)) * 100 > base * p:
                return False
        for p in ps:
            for q in range(p, 251, 7):
                if impl(base, PCT, q, None) > impl(base, PCT, p, None):
                    return False
        if impl(base, PCT, 100, None) != 0 or impl(base, PCT, 0, None) != base:
            return False
        for a in [*AMOUNTS, 7, 2500]:
            for minimum in [None, base, *MINS]:
                if not 0 <= impl(base, FIX, a, minimum) <= base:
                    return False
    return True


def patched(point, value):
    """The true model, except at one point (and its twin under the
    inclusive-minimum rule: no minimum, or a minimum equal to the base)."""
    base0, kind0, val0, min0 = point
    twins = {point}
    if min0 is None or min0 == base0:
        twins = {(base0, kind0, val0, None), (base0, kind0, val0, base0)}

    def impl(base, kind, val, minimum):
        if (base, kind, val, minimum) in twins:
            return value
        return model_total(base, kind, val, minimum)
    return impl


POINTS = {}
for name, _, fact in TESTS:
    call = fact.arg(0)
    args = [call.arg(i) for i in range(5)]
    has = bool(args[3])
    POINTS[name] = (args[0].as_long(), args[1].as_long(), args[2].as_long(), args[4].as_long() if has else None)

kept = [fact for _, keep, fact in TESTS if keep]
levels = {"points": kept, "rules": kept + rules(), "model": kept + definition()}

rows = []
for name, keep, fact in TESTS:
    cells = []
    for level, knowledge in levels.items():
        if keep:
            cells.append("kept")
            continue
        verdict, counter = entailed(knowledge, fact)
        if verdict == "no":
            # Confirm with a concrete implementation that keeps the knowledge.
            impl = patched(POINTS[name], counter.as_long())
            valid = level == "points" or rules_hold(impl)
            cells.append(f"no: {counter} also fits" + ("" if valid else " (not confirmed)"))
        else:
            cells.append(verdict)
    rows.append((name, cells))

md = "| Test | Points only | Points + proved rules | Points + model |\n|---|---|---|---|\n"
for name, cells in rows:
    md += f"| {name} | " + " | ".join(cells) + " |\n"
removed = [c for n, c in rows if c[0] != "kept"]
summary = {lvl: sum(1 for c in removed if c[i] == "yes") for i, lvl in enumerate(levels)}
md += (
    f"\nOf {len(removed)} removed value tests, derivable: "
    f"{summary['points']} from the kept points alone, "
    f"{summary['rules']} with the proved rules, {summary['model']} with the model.\n"
)
# Is the kept set irredundant? Each kept test against the other kept tests + rules.
md += "\nKept tests, checked against the other kept tests plus the proved rules:\n\n| Kept test | Derivable from the others |\n|---|---|\n"
kept_tests = [(n, fct) for n, keep, fct in TESTS if keep]
for name, fact in kept_tests:
    others = [o for n, o in kept_tests if n != name]
    verdict, counter = entailed(others + rules(), fact)
    md += f"| {name} | {verdict if verdict != 'no' else f'no: {counter} also fits'} |\n"

open("experiments/results/derivation-coupon.md", "w").write(md)
print(md)
