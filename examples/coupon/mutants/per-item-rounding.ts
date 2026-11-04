// Applies the percentage to each line and rounds per line.
import type { Coupon, Item } from "../src/coupon";

export function subtotal(items: Item[]): number {
  let total = 0;
  for (const item of items) total += item.priceCents * item.quantity;
  return total;
}

export function applyCoupon(items: Item[], coupon?: Coupon): number {
  const base = subtotal(items);
  if (!coupon) return base;
  if (coupon.minSubtotalCents !== undefined && base < coupon.minSubtotalCents) return base;
  if (coupon.kind === "fixed") return Math.max(0, base - coupon.amountCents);
  const p = Math.min(100, Math.max(0, coupon.percent));
  let discount = 0;
  for (const i of items) discount += Math.floor((i.priceCents * i.quantity * p) / 100);
  return Math.max(0, base - discount);
}
