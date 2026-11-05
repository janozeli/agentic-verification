| Test | Points only | Points + proved rules | Points + model |
|---|---|---|---|
| returns the subtotal without a coupon | no: 3 also fits | no: 0 also fits | yes |
| returns the subtotal of several items without a coupon | no: 3 also fits | no: 0 also fits | yes |
| returns 0 for an empty cart without a coupon | no: 3 also fits | yes | yes |
| applies a 10% coupon | no: 3 also fits | no: 901 also fits | yes |
| applies a 20% coupon | no: 3 also fits | no: 801 also fits | yes |
| applies a 50% coupon | no: 3 also fits | no: 501 also fits | yes |
| applies a 10% coupon to several items | no: 3 also fits | no: 1801 also fits | yes |
| applies a 100% coupon | no: 3 also fits | yes | yes |
| applies a 0% coupon | no: 3 also fits | yes | yes |
| rounds percent discounts down | kept | kept | kept |
| applies a fixed coupon | no: 3 also fits | no: 0 also fits | yes |
| applies a fixed coupon of 100 | no: 3 also fits | no: 0 also fits | yes |
| applies a fixed coupon to several items | kept | kept | kept |
| never returns a negative total with a fixed coupon | no: 3 also fits | no: 1 also fits | yes |
| returns 0 when the fixed coupon equals the subtotal | no: 3 also fits | no: 1 also fits | yes |
| returns a non-negative total | no: -1 also fits | yes | yes |
| ignores the coupon below the minimum subtotal | kept | kept | kept |
| applies the coupon above the minimum subtotal | kept | kept | kept |
| ignores a fixed coupon below the minimum subtotal | no: 3 also fits | no: 0 also fits | yes |

Of 15 removed value tests, derivable: 0 from the kept points alone, 4 with the proved rules, 15 with the model.

Kept tests, checked against the other kept tests plus the proved rules:

| Kept test | Derivable from the others |
|---|---|
| rounds percent discounts down | no: 901 also fits |
| applies a fixed coupon to several items | no: 0 also fits |
| ignores the coupon below the minimum subtotal | no: 0 also fits |
| applies the coupon above the minimum subtotal | no: 0 also fits |
