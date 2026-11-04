import Lean.Data.Json
import CouponModel

/-! The Lean model as a Unix filter: one JSON case per line in, one result per
    line out, in order. A case has the same shape as applyCoupon's arguments:
    {"items":[{"priceCents":1000,"quantity":1}],
     "coupon":{"kind":"percent","percent":10,"minSubtotalCents":500}} -/

open Lean CouponModel

def field? [FromJson α] (j : Json) (k : String) : Option α :=
  (j.getObjValAs? α k).toOption

def parseItem (j : Json) : Except String Item := do
  return ⟨← j.getObjValAs? Nat "priceCents", ← j.getObjValAs? Nat "quantity"⟩

def parseCoupon (j : Json) : Except String (Option Coupon) := do
  if j.isNull then return none
  let kind : Kind ← match ← j.getObjValAs? String "kind" with
    | "percent" => do pure (Kind.percent (← j.getObjValAs? Int "percent"))
    | "fixed" => do pure (Kind.fixed (← j.getObjValAs? Nat "amountCents"))
    | other => throw s!"unknown coupon kind {other}"
  return some ⟨kind, field? j "minSubtotalCents"⟩

def parseCase (line : String) : Except String (List Item × Option Coupon) := do
  let j ← Json.parse line
  let items ← (← j.getObjValAs? (Array Json) "items").toList.mapM parseItem
  return (items, ← parseCoupon ((j.getObjVal? "coupon").toOption.getD Json.null))

partial def loop (stdin stdout : IO.FS.Stream) : IO Unit := do
  let line ← stdin.getLine
  if line.isEmpty then return
  let out := match parseCase line with
    | .ok (items, c) => Json.mkObj [("out", toJson (apply items c))]
    | .error e => Json.mkObj [("error", toJson e)]
  stdout.putStrLn out.compress
  loop stdin stdout

def main : IO Unit := do
  loop (← IO.getStdin) (← IO.getStdout)
