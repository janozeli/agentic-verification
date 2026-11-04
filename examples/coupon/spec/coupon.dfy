// Reference model of applyCoupon, with the rules stated as proved lemmas.
// Compiled to JavaScript and used as the oracle in test-props/.

module CouponModel {
  datatype Item = Item(price: nat, quantity: nat)
  datatype Kind = Percent(percent: int) | Fixed(amount: nat)
  datatype Option<T> = None | Some(value: T)
  datatype Coupon = Coupon(kind: Kind, minSubtotal: Option<nat>)

  function Subtotal(items: seq<Item>): nat {
    if |items| == 0 then 0
    else items[0].price * items[0].quantity + Subtotal(items[1..])
  }

  function Clamp(p: int): int {
    if p < 0 then 0 else if p > 100 then 100 else p
  }

  function Discount(base: nat, k: Kind): nat {
    match k
    case Percent(p) => (base * Clamp(p)) / 100
    case Fixed(a) => a
  }

  predicate Qualifies(base: nat, c: Coupon) {
    c.minSubtotal.None? || base >= c.minSubtotal.value
  }

  function Apply(items: seq<Item>, c: Option<Coupon>): nat {
    var base := Subtotal(items);
    if c.None? || !Qualifies(base, c.value) then base
    else if Discount(base, c.value.kind) >= base then 0
    else base - Discount(base, c.value.kind)
  }

  // ---- The rules, as theorems about the model ----

  // A coupon never raises the price and never makes it negative.
  lemma NeverAboveSubtotal(items: seq<Item>, c: Option<Coupon>)
    ensures 0 <= Apply(items, c) <= Subtotal(items)
  {}

  // Reaching the minimum exactly is enough to use the coupon.
  lemma MinimumIsInclusive(items: seq<Item>, k: Kind)
    ensures Apply(items, Some(Coupon(k, Some(Subtotal(items)))))
         == Apply(items, Some(Coupon(k, None)))
  {}

  // Percentages outside [0, 100] behave like the nearest bound.
  lemma PercentIsClamped(items: seq<Item>, p: int)
    ensures Apply(items, Some(Coupon(Percent(p), None)))
         == Apply(items, Some(Coupon(Percent(Clamp(p)), None)))
  {}

  // 100% off is free; 0% off changes nothing.
  lemma PercentBounds(items: seq<Item>)
    ensures Apply(items, Some(Coupon(Percent(100), None))) == 0
    ensures Apply(items, Some(Coupon(Percent(0), None))) == Subtotal(items)
  {}

  // Percent discounts round in the customer's disfavor: never more than the exact value.
  lemma PercentRoundsDown(base: nat, p: int)
    requires 0 <= p <= 100
    ensures Discount(base, Percent(p)) * 100 <= base * p
  {}

  // A bigger percentage never costs more.
  lemma PercentIsMonotone(items: seq<Item>, p: int, q: int)
    requires p <= q
    ensures Apply(items, Some(Coupon(Percent(q), None)))
         <= Apply(items, Some(Coupon(Percent(p), None)))
  {
    var base := Subtotal(items);
    MulMonotone(base, Clamp(p), Clamp(q));
    DivMonotone(base * Clamp(p), base * Clamp(q), 100);
  }

  lemma MulMonotone(a: nat, x: int, y: int)
    requires 0 <= x <= y
    ensures a * x <= a * y
  {}

  lemma DivMonotone(x: int, y: int, d: int)
    requires 0 <= x <= y && d > 0
    ensures x / d <= y / d
  {
    if x / d > y / d {
      var qx, qy := x / d, y / d;
      assert x == d * qx + x % d;
      assert y == d * qy + y % d;
      MulMonotone(d, qy + 1, qx);
      assert d * (qy + 1) == d * qy + d;
      assert false;
    }
  }

  // ---- Flat entry point for the JavaScript side ----

  function Items(prices: seq<nat>, quantities: seq<nat>): seq<Item>
    requires |prices| == |quantities|
  {
    if |prices| == 0 then []
    else [Item(prices[0], quantities[0])] + Items(prices[1..], quantities[1..])
  }

  // kind: 0 = no coupon, 1 = percent, 2 = fixed. min < 0 means no minimum.
  function Total(prices: seq<nat>, quantities: seq<nat>, kind: int, value: int, min: int): nat
    requires |prices| == |quantities|
    requires kind == 2 ==> value >= 0
  {
    var minimum := if min < 0 then None else Some(min as nat);
    var coupon :=
      if kind == 1 then Some(Coupon(Percent(value), minimum))
      else if kind == 2 then Some(Coupon(Fixed(value as nat), minimum))
      else None;
    Apply(Items(prices, quantities), coupon)
  }
}
