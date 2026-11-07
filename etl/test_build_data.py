import unittest
from build_data import build, PLANS, N


class Invariants(unittest.TestCase):
    d = build()

    def test_mrr_waterfall(self):
        for p in PLANS:
            s = self.d["series"][p]
            for t in range(1, N):
                self.assertEqual(s["mrr"][t - 1] + s["newMrr"][t] + s["exp"][t] - s["con"][t] - s["churnMrr"][t], s["mrr"][t], (p, t))

    def test_logo_roll(self):
        for p in PLANS:
            s = self.d["series"][p]
            for t in range(1, N):
                self.assertEqual(s["logos"][t - 1] + s["new"][t] - s["churned"][t], s["logos"][t], (p, t))

    def test_cohorts_sum_to_active(self):
        for p in PLANS:
            for t in range(N):
                tot = sum(self.d["cohorts"][p][c][t - c][0] for c in range(t + 1))
                self.assertEqual(tot, self.d["series"][p]["logos"][t])

    def test_deterministic(self):
        self.assertEqual(build(), build())


if __name__ == "__main__":
    unittest.main()
