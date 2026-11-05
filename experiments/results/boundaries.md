| Model function | Comparison shifted | Real boundary (exhaustive small domain) | Biased inputs reach it | Uniform inputs reach it |
|---|---|---|---:|---:|
| Clamp | `if ((p).isLessThan(_dafny.ZERO)) {` | no, equivalent | 0 / 10 | 0 / 10 |
| Clamp | `} else if ((new BigNumber(100)).isLessThan(p)) {` | no, equivalent | 0 / 10 | 0 / 10 |
| Qualifies | `return (((c).dtor_minSubtotal).is_None) \|\| ((((c).dtor_minSubtotal).dtor_value).isLessThanOrEqualTo(base));` | yes | 10 / 10 | 0 / 10 |
| Apply | `} else if ((_0_base).isLessThanOrEqualTo(CouponModel.__default.Discount(_0_base, ((c).dtor_value).dtor_kind))) {` | no, equivalent | 0 / 10 | 0 / 10 |
| Total | `let _0_minimum = (((min).isLessThan(_dafny.ZERO)) ? (CouponModel.Option.create_None()) : (CouponModel.Option.create_Some((min))));` | no, equivalent | 0 / 10 | 0 / 10 |
