// Trivial: everything is free.
import type { Coupon, Item } from "../src/coupon";

export function subtotal(items: Item[]): number {
  let total = 0;
  for (const item of items) total += item.priceCents * item.quantity;
  return total;
}

export function applyCoupon(_items: Item[], _coupon?: Coupon): number {
  return 0;
}
