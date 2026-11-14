"""Generate stress-test datasets for Smart Data Insights.

Run:  python make_stress_data.py
Writes the CSV/JSON files next to this script. Fixed seed, so the output is the same every run.
"""
import csv
import json
import os
import random
from datetime import date, timedelta

random.seed(42)
OUT = os.path.dirname(os.path.abspath(__file__))


def write_csv(name, header, rows):
    with open(os.path.join(OUT, name), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"{name:34} {len(rows):>7} rows  {os.path.getsize(os.path.join(OUT, name)) / 1024:8.1f} KB")


# --- 1-3. Bank statements with a known risk level (the app should NOT call all of these "Excellent") ---
MERCHANTS = {
    "groceries": ["Checkers", "Shoprite", "Pick n Pay", "Woolworths Food", "Spar"],
    "transport": ["Engen Garage Fuel", "Shell Fuel", "Uber Trip", "Bolt Trip", "Gautrain"],
    "utilities": ["Eskom Prepaid Electricity", "City of Joburg Water", "Vodacom Airtime and Data", "MTN Data Bundle"],
    "debt": ["Debit Order - African Bank Loan", "Debit Order - Capitec Credit Card", "Debit Order - Short Term Loan",
             "Edgars Store Card Payment", "Foschini Account Payment", "Cash Loan Interest Fee"],
    "leisure": ["KFC", "Nando's", "Netflix", "Showmax", "Ster-Kinekor", "Mr Price", "Takealot"],
    "health": ["Clicks Pharmacy", "Dis-Chem", "Discovery Health Debit"],
}


def statement(months, salary, rent, debt_share, spend_mult, start_balance):
    rows, bal, d0 = [], start_balance, date(2025, 1, 1)
    for m in range(months):
        start = d0 + timedelta(days=30 * m)
        txns = [(start + timedelta(days=24), "Salary - Employer", salary),
                (start, "Rent", -rent)]
        for name in random.sample(MERCHANTS["debt"], k=max(0, round(debt_share * 6))):
            txns.append((start + timedelta(days=random.randint(0, 5)), name, -round(random.uniform(400, 3200), 2)))
        for cat in ("groceries", "transport", "utilities", "leisure", "health"):
            for _ in range(random.randint(2, 6)):
                amt = random.uniform(80, 900) * spend_mult
                txns.append((start + timedelta(days=random.randint(0, 29)), random.choice(MERCHANTS[cat]), -round(amt, 2)))
        txns.append((start + timedelta(days=29), "Bank Charges", -round(random.uniform(90, 220), 2)))
        for d, desc, amt in sorted(txns):
            bal = round(bal + amt, 2)
            rows.append([d.isoformat(), desc, f"{amt:.2f}", f"{bal:.2f}"])
    return rows


H = ["Date", "Description", "Amount", "Balance"]
write_csv("statement_low_risk.csv", H, statement(6, 32000, 7500, 0.15, 0.8, 12000))
write_csv("statement_medium_risk.csv", H, statement(6, 21000, 6500, 0.5, 1.0, 1500))
write_csv("statement_high_risk.csv", H, statement(6, 18500, 6500, 1.0, 1.3, -1500))

# --- 4. Messy data: everything a real export gets wrong ---
messy = []
for i in range(300):
    amt = round(random.uniform(-3000, 3000), 2)
    r = random.random()
    amount = (f"R{abs(amt):,.2f}" if r < 0.1 else          # currency text "R1,234.56"
              "" if r < 0.18 else                           # missing
              "N/A" if r < 0.22 else                        # placeholder text
              str(amt * 1000) if r < 0.25 else              # extreme outlier
              str(amt))
    dt = date(2025, 1, 1) + timedelta(days=i)
    when = random.choice([dt.isoformat(), dt.strftime("%d/%m/%Y"), dt.strftime("%m-%d-%y"), "", "not a date"])
    desc = random.choice(["Checkers", "Café Nando’s", "Pick n Pay 🛒", "  spaces  ", "", 'Quote "test", comma',
                          "Line\nbreak", "Ελληνικά", "=SUM(A1:A9)"])  # unicode, emoji, CSV/formula injection
    messy.append([when, desc, amount, random.choice(["", str(round(random.uniform(-9000, 9000), 2))]),
                  random.choice(["yes", "no", "Yes", "Y", "", "maybe"])])
messy += messy[:15]  # exact duplicates
write_csv("messy_mixed_types.csv", ["Date", "Description", "Amount", "Balance", "Flagged"], messy)

# --- 5. Wide: many columns, few rows (correlation matrix + chart explosion) ---
wide_h = [f"feature_{i:03d}" for i in range(150)] + ["target"]
wide = [[round(random.gauss(0, 1), 4) for _ in range(150)] + [random.choice(["A", "B"])] for _ in range(60)]
write_csv("wide_150_columns.csv", wide_h, wide)

# --- 6. Large: close to the 10 MB upload limit (timeouts, memory on the 512 MB free instance) ---
big = []
cities = ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Gqeberha", "Bloemfontein"]
for i in range(140_000):
    age = random.randint(18, 75)
    income = round(random.lognormvariate(10, 0.6), 2)
    big.append([i, age, income, random.choice(cities), random.randint(300, 850),
                round(random.uniform(0, 1), 4), int(income < 15000 and random.random() < 0.6)])
write_csv("large_140k_rows.csv", ["id", "age", "income", "city", "credit_score", "utilisation", "defaulted"], big)

# --- 7. Edge cases for ML training ---
write_csv("single_class_target.csv", ["x1", "x2", "label"],
          [[random.random(), random.random(), "same"] for _ in range(100)])          # only one class
write_csv("constant_columns.csv", ["a", "b", "c", "y"],
          [[1, "x", 0, random.random()] for _ in range(100)])                       # no usable features
write_csv("tiny_3_rows.csv", ["x", "y"], [[1, 2], [2, 4], [3, 6]])                   # too small to split
write_csv("header_only.csv", ["Date", "Description", "Amount"], [])                  # no data at all
write_csv("all_missing.csv", ["a", "b", "c"], [["", "", ""] for _ in range(50)])
write_csv("high_cardinality.csv", ["user_id", "email", "spend"],                    # ID-like columns
          [[f"U{i:06d}", f"user{i}@example.com", round(random.uniform(0, 5000), 2)] for i in range(5000)])

# --- 8. JSON variants ---
with open(os.path.join(OUT, "nested.json"), "w", encoding="utf-8") as f:
    json.dump([{"id": i, "customer": {"name": f"C{i}", "city": random.choice(cities)},
                "orders": [random.randint(1, 500) for _ in range(random.randint(0, 3))],
                "total": round(random.uniform(10, 900), 2)} for i in range(200)], f)
print("nested.json")
with open(os.path.join(OUT, "broken.json"), "w", encoding="utf-8") as f:
    f.write('[{"a": 1, "b": 2}, {"a": 3, "b": ')  # truncated, invalid JSON
print("broken.json")
