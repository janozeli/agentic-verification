---------------------------- MODULE Redemption ----------------------------
(* A coupon with a limited number of uses, redeemed by concurrent checkouts.

   Design "check_then_act": read the use count, compare, write count + 1.
   Design "reserve": atomically take a slot, then pay; if payment fails,
   the slot must be given back (Release = TRUE) or it leaks (Release = FALSE).

   A reservation is a promise. Austin would say it is only felicitous if it is
   eventually kept or explicitly withdrawn, which is a liveness property:
   Promise below. *)
EXTENDS Naturals, FiniteSets

CONSTANTS Clients, Limit, Design, Release

VARIABLES used, pc, seen

vars == <<used, pc, seen>>

Init ==
  /\ used = 0
  /\ pc = [c \in Clients |-> "start"]
  /\ seen = [c \in Clients |-> 0]

\* --- check_then_act ---
Read(c) ==
  /\ Design = "check_then_act" /\ pc[c] = "start"
  /\ seen' = [seen EXCEPT ![c] = used]
  /\ pc' = [pc EXCEPT ![c] = "check"]
  /\ UNCHANGED used

Write(c) ==
  /\ Design = "check_then_act" /\ pc[c] = "check"
  /\ IF seen[c] < Limit
       THEN /\ used' = seen[c] + 1
            /\ pc' = [pc EXCEPT ![c] = "confirmed"]
       ELSE /\ pc' = [pc EXCEPT ![c] = "rejected"]
            /\ UNCHANGED used
  /\ UNCHANGED seen

\* --- reserve ---
Reserve(c) ==
  /\ Design = "reserve" /\ pc[c] = "start"
  /\ IF used < Limit
       THEN /\ used' = used + 1
            /\ pc' = [pc EXCEPT ![c] = "paying"]
       ELSE /\ pc' = [pc EXCEPT ![c] = "rejected"]
            /\ UNCHANGED used
  /\ UNCHANGED seen

PaymentSucceeds(c) ==
  /\ pc[c] = "paying"
  /\ pc' = [pc EXCEPT ![c] = "confirmed"]
  /\ UNCHANGED <<used, seen>>

PaymentFails(c) ==
  /\ pc[c] = "paying"
  /\ IF Release
       THEN /\ used' = used - 1
            /\ pc' = [pc EXCEPT ![c] = "released"]
       ELSE /\ pc' = [pc EXCEPT ![c] = "abandoned"]
            /\ UNCHANGED used
  /\ UNCHANGED seen

Step(c) ==
  \/ Read(c) \/ Write(c)
  \/ Reserve(c) \/ PaymentSucceeds(c) \/ PaymentFails(c)

Next == \E c \in Clients : Step(c)

Spec == Init /\ [][Next]_vars /\ \A c \in Clients : WF_vars(Step(c))

\* --- properties ---
Confirmed == {c \in Clients : pc[c] = "confirmed"}

\* Never more confirmed redemptions than the coupon allows.
NeverOverRedeemed == Cardinality(Confirmed) <= Limit

\* Every reservation is eventually kept or withdrawn.
Promise == \A c \in Clients : (pc[c] = "paying") ~> (pc[c] \in {"confirmed", "released"})

\* Every slot taken is accounted for by a confirmed or in-flight checkout.
NoLeakedSlots ==
  (\A c \in Clients : pc[c] \notin {"start", "paying"}) =>
    used = Cardinality(Confirmed)
=============================================================================
