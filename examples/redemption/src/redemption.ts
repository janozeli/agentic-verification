// Three implementations of the designs in spec/Redemption.tla.

export type Tick = () => Promise<unknown>;

// In-memory store. Every call yields first, like a network round trip would,
// so concurrent callers interleave. Tests can pass a scheduler as `tick`.
export class Store {
  private uses = new Map<string, number>();
  constructor(private tick: Tick = () => Promise.resolve()) {}

  async get(code: string): Promise<number> {
    await this.tick();
    return this.uses.get(code) ?? 0;
  }

  async set(code: string, n: number): Promise<void> {
    await this.tick();
    this.uses.set(code, n);
  }

  // Atomic: compare and increment in one step, like an UPDATE ... WHERE.
  async takeSlot(code: string, limit: number): Promise<boolean> {
    await this.tick();
    const n = this.uses.get(code) ?? 0;
    if (n >= limit) return false;
    this.uses.set(code, n + 1);
    return true;
  }

  async giveBack(code: string): Promise<void> {
    await this.tick();
    this.uses.set(code, (this.uses.get(code) ?? 1) - 1);
  }
}

export type Outcome = "confirmed" | "rejected" | "released" | "abandoned";

// Design "check_then_act": read, compare, write. Races under concurrency.
export async function redeemCheckThenAct(store: Store, code: string, limit: number): Promise<Outcome> {
  const used = await store.get(code);
  if (used >= limit) return "rejected";
  await store.set(code, used + 1);
  return "confirmed";
}

// Design "reserve" with Release = FALSE: forgets to give the slot back.
export async function redeemReserveLeaky(
  store: Store,
  code: string,
  limit: number,
  pay: () => Promise<boolean>,
): Promise<Outcome> {
  if (!(await store.takeSlot(code, limit))) return "rejected";
  if (await pay()) return "confirmed";
  return "abandoned";
}

// Design "reserve" with Release = TRUE: the one TLC accepts.
export async function redeem(
  store: Store,
  code: string,
  limit: number,
  pay: () => Promise<boolean>,
): Promise<Outcome> {
  if (!(await store.takeSlot(code, limit))) return "rejected";
  if (await pay()) return "confirmed";
  await store.giveBack(code);
  return "released";
}
