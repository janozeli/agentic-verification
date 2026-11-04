/-! Reference model of applyCoupon in Lean, with the same rules as
    spec/coupon.dfy proved as theorems. Main.lean wraps it in a process that
    reads one JSON case per line and writes one result per line. -/

namespace CouponModel

structure Item where
  price : Nat
  quantity : Nat

inductive Kind where
  | percent (p : Int)
  | fixed (amount : Nat)

structure Coupon where
  kind : Kind
  minSubtotal : Option Nat

def subtotal : List Item → Nat
  | [] => 0
  | i :: is => i.price * i.quantity + subtotal is

def clamp (p : Int) : Nat :=
  if p < 0 then 0 else if p > 100 then 100 else p.toNat

def discount (base : Nat) : Kind → Nat
  | .percent p => base * clamp p / 100
  | .fixed a => a

def qualifies (base : Nat) (c : Coupon) : Bool :=
  match c.minSubtotal with
  | none => true
  | some m => decide (base ≥ m)

-- Natural subtraction stops at zero, which is the "never below zero" rule.
def apply (items : List Item) : Option Coupon → Nat
  | none => subtotal items
  | some c =>
    let base := subtotal items
    if qualifies base c then base - discount base c.kind else base

/-! ## The rules -/

-- A coupon never raises the price.
theorem never_above_subtotal (items : List Item) (c : Option Coupon) :
    apply items c ≤ subtotal items := by
  cases c with
  | none => simp [apply]
  | some c => simp only [apply]; split <;> omega

-- Reaching the minimum exactly is enough to use the coupon.
theorem minimum_is_inclusive (items : List Item) (k : Kind) :
    apply items (some ⟨k, some (subtotal items)⟩) = apply items (some ⟨k, none⟩) := by
  simp [apply, qualifies]

theorem clamp_cases (p : Int) :
    (p < 0 ∧ clamp p = 0) ∨ (p > 100 ∧ clamp p = 100) ∨
    (0 ≤ p ∧ p ≤ 100 ∧ (clamp p : Int) = p) := by
  by_cases h0 : p < 0
  · left; simp [clamp, h0]
  · by_cases h1 : p > 100
    · right; left; simp [clamp, h0, h1]
    · right; right
      simp [clamp, h0, h1, Int.toNat_of_nonneg (show 0 ≤ p by omega)]
      omega

theorem clamp_idem (p : Int) : clamp (clamp p : Int) = clamp p := by
  have := clamp_cases p
  have := clamp_cases (clamp p : Int)
  omega

-- Percentages outside [0, 100] behave like the nearest bound.
theorem percent_is_clamped (items : List Item) (p : Int) :
    apply items (some ⟨.percent p, none⟩) = apply items (some ⟨.percent (clamp p), none⟩) := by
  simp [apply, qualifies, discount, clamp_idem]

-- 100% off is free; 0% off changes nothing.
theorem percent_bounds (items : List Item) :
    apply items (some ⟨.percent 100, none⟩) = 0 ∧
    apply items (some ⟨.percent 0, none⟩) = subtotal items := by
  simp [apply, qualifies, discount, clamp]

-- Rounding never favors the customer: the discount is at most the exact value.
theorem percent_rounds_down (base : Nat) (p : Int) :
    discount base (.percent p) * 100 ≤ base * clamp p := by
  simp only [discount]
  exact Nat.div_mul_le_self _ _

theorem clamp_mono {p q : Int} (h : p ≤ q) : clamp p ≤ clamp q := by
  have := clamp_cases p
  have := clamp_cases q
  omega

-- A bigger percentage never costs more.
theorem percent_is_monotone (items : List Item) {p q : Int} (h : p ≤ q) :
    apply items (some ⟨.percent q, none⟩) ≤ apply items (some ⟨.percent p, none⟩) := by
  simp only [apply, qualifies, discount, ite_true]
  have := Nat.div_le_div_right (c := 100) (Nat.mul_le_mul_left (subtotal items) (clamp_mono h))
  omega

end CouponModel
