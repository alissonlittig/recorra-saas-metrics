"""Synthetic subscription ledger -> monthly SaaS metrics (JSON). All data is fictional."""
import json, random, sys
from pathlib import Path

PLANS = {"Starter": 29, "Team": 99, "Business": 299}
CAC = {"Starter": 180, "Team": 520, "Business": 1900}  # modeled acquisition cost per new logo (USD)
CHURN = {"Starter": 0.052, "Team": 0.028, "Business": 0.013}  # base monthly logo churn
N = 36
MONTHS = [f"{2023 + (i + 10) // 12}-{(i + 10) % 12 + 1:02d}" for i in range(N)]  # 2023-11 .. 2026-10


def simulate(seed=555):
    rnd = random.Random(seed)
    customers = []
    for m in range(N):
        season = 1 + 0.18 * (1 if MONTHS[m][5:] in ("01", "09", "10") else 0)
        base = (9 + m * 0.95) * season
        for plan, w in (("Starter", 0.58), ("Team", 0.32), ("Business", 0.10)):
            for _ in range(max(0, round(rnd.gauss(base * w, base * w * 0.25)))):
                price = PLANS[plan]
                mrr = price
                end = N + 1  # churn month index (N+1 = still active)
                path = {}
                for t in range(m, N):
                    age = t - m
                    if age > 0:
                        p = CHURN[plan] * (1.9 if age < 3 else 1.0 if age < 12 else 0.7)
                        if rnd.random() < p:
                            end = t
                            break
                        r = rnd.random()
                        if r < 0.075:
                            mrr += round(price * rnd.choice([0.2, 0.35, 0.5]))
                        elif r < 0.09 and mrr > price:
                            mrr = max(price, mrr - round(price * 0.25))
                    path[t] = mrr
                customers.append({"plan": plan, "start": m, "end": end, "path": path})
    return customers


def aggregate(customers):
    z = lambda: {"mrr": 0, "logos": 0, "new": 0, "newMrr": 0, "exp": 0, "con": 0, "churnMrr": 0, "churned": 0}
    ts = {p: [z() for _ in range(N)] for p in PLANS}
    coh = {p: [[[0, 0] for _ in range(N - c)] for c in range(N)] for p in PLANS}  # [logos, mrr] by age
    for c in customers:
        T = ts[c["plan"]]
        prev = 0
        for t, mrr in c["path"].items():
            row = T[t]
            row["mrr"] += mrr
            row["logos"] += 1
            if t == c["start"]:
                row["new"] += 1
                row["newMrr"] += mrr
            elif mrr > prev:
                row["exp"] += mrr - prev
            elif mrr < prev:
                row["con"] += prev - mrr
            prev = mrr
            cell = coh[c["plan"]][c["start"]][t - c["start"]]
            cell[0] += 1
            cell[1] += mrr
        if c["end"] < N:
            T[c["end"]]["churnMrr"] += prev
            T[c["end"]]["churned"] += 1
    return ts, coh


def build(seed=555):
    ts, coh = aggregate(simulate(seed))
    keys = ["mrr", "logos", "new", "newMrr", "exp", "con", "churnMrr", "churned"]
    return {
        "meta": {"synthetic": True, "company": "Recorra Labs (fictional)", "months": MONTHS, "plans": PLANS, "cac": CAC},
        "series": {p: {k: [r[k] for r in ts[p]] for k in keys} for p in PLANS},
        "cohorts": {p: [[[a, b] for a, b in row] for row in coh[p]] for p in PLANS},
    }


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "public/data.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(build(), separators=(",", ":")), encoding="utf-8")
    print("wrote", out, out.stat().st_size, "bytes")
