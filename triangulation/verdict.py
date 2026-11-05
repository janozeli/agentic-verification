import json
import sys


def load(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def ordered_tests(stryker):
    return [
        test
        for test_file in (stryker.get("testFiles") or {}).values()
        for test in test_file.get("tests") or []
    ]


def ordered_mutants(stryker):
    return [
        mutant
        for source_file in (stryker.get("files") or {}).values()
        for mutant in source_file.get("mutants") or []
    ]


def verdict(stryker, semantic):
    tests = ordered_tests(stryker)
    mutants = ordered_mutants(stryker)
    test_names = {test["name"] for test in tests}

    kills = [set() for _ in tests]
    index_by_id = {}
    for index, test in enumerate(tests):
        index_by_id.setdefault(str(test["id"]), []).append(index)
    index_by_name = {}
    for index, test in enumerate(tests):
        index_by_name.setdefault(test["name"], []).append(index)

    for mutant in mutants:
        if mutant.get("status") != "Killed":
            continue
        key = f"stryker:{mutant['id']}"
        for test_id in mutant.get("killedBy") or []:
            for index in index_by_id.get(str(test_id), []):
                kills[index].add(key)

    for mutant in semantic:
        for name in mutant.get("killedBy") or []:
            for index in index_by_name.get(name, []):
                kills[index].add(mutant["id"])

    remaining = set().union(*kills) if kills else set()
    kept = []
    while remaining:
        best_index, best_gain = None, 0
        for index, killed_by_test in enumerate(kills):
            gain = len(killed_by_test & remaining)
            if gain > best_gain:
                best_index, best_gain = index, gain
        kept.append(best_index)
        remaining -= kills[best_index]

    kept_set = set(kept)
    vacuous = [index for index in range(len(tests)) if not kills[index]]
    redundant = [
        index
        for index in range(len(tests))
        if kills[index] and index not in kept_set
    ]

    survived = [
        f"stryker:{mutant['id']}"
        for mutant in mutants
        if mutant.get("status") in ("Survived", "NoCoverage")
    ] + [
        mutant["id"]
        for mutant in semantic
        if not any(name in test_names for name in mutant.get("killedBy") or [])
    ]

    def names(indices):
        return [str(tests[index]["name"]) for index in indices]

    return {
        "kept": names(sorted(kept)),
        "vacuous": names(vacuous),
        "redundant": names(redundant),
        "survived": survived,
    }


def main():
    stryker = load(sys.argv[1])
    semantic = load(sys.argv[2])
    result = verdict(stryker, semantic)
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
