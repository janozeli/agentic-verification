// Trusts the percentage: a negative one raises the price.
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
  const discount =
    coupon.kind === "percent" ? Math.floor((base * coupon.percent) / 100) : coupon.amountCents;
  return Math.max(0, base - discount);
}
