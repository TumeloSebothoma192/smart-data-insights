"""Bank-statement analysis: financial risk from a transaction list.

A file counts as a statement when it has a date column, a description column and either a signed
amount column or separate debit/credit columns. Everything here is rule-based and explainable:
one person's statement has no target to predict, so ML is the wrong tool for it.
"""
import re

import numpy as np
import pandas as pd

# Category rules, checked in order (first match wins). Patterns match the transaction description.
CATEGORIES = [
    ('salary', r'salary|wage|payroll|pay ?slip|stipend|sassa|grant'),
    ('debt', r'loan|credit ?card|store ?card|account payment|instal?ment|interest|finance|\bcredit\b|edgars|foschini|truworths|'
             r'jet ?stores|ackermans|identity|rcs|lewis|bayport|wonga|fnb ?credit|capitec ?credit|african bank|debit order'),
    ('housing', r'rent|bond|levy|levies|home ?loan|body ?corporate|lodging'),
    ('groceries', r'checkers|shoprite|pick ?n ?pay|woolworths|spar|food ?lover|boxer|usave|grocer'),
    ('transport', r'fuel|engen|shell|sasol|bp |caltex|total ?energies|uber|bolt|taxi|gautrain|metrorail|toll'),
    ('utilities', r'eskom|electric|prepaid|water|municipal|city of|vodacom|mtn|cell ?c|telkom|airtime|data|fibre|wifi'),
    ('health', r'pharmacy|clicks|dis-?chem|doctor|medical|hospital|health'),
    ('cash', r'atm|cash ?withdrawal|cash ?send'),
    ('fees', r'bank ?charge|service ?fee|monthly fee|admin fee|unpaid|dishono|returned'),
    ('leisure', r'kfc|nando|mcdonald|steers|debonairs|netflix|showmax|spotify|dstv|ster-?kinekor|takealot|mr ?price|restaurant|bar\b|betway|hollywoodbets|lotto'),
]
DEBT_WARNING = r'short.?term loan|payday|cash loan|wonga|mashonisa|loan interest|interest fee'
FAILED_PAYMENT = r'unpaid|dishono|returned|insufficient|bounced'
GAMBLING = r'betway|hollywoodbets|sportingbet|supabets|lotto|casino|gbets'


def _find(cols, *patterns):
    for p in patterns:
        for c in cols:
            if re.fullmatch(p, str(c).strip(), flags=re.I):
                return c
    return None


def _money(series):
    """'R1,234.50', '-450', '(300)' -> float."""
    s = series.astype(str).str.strip()
    neg = s.str.match(r'^\(.*\)$')
    s = s.str.replace(r'[^0-9.\-]', '', regex=True)
    v = pd.to_numeric(s, errors='coerce')
    return v.where(~neg, -v.abs())


def _category(desc):
    d = str(desc).lower()
    for name, pattern in CATEGORIES:
        if re.search(pattern, d):
            return name
    return 'other'


def detect_and_analyze(df: pd.DataFrame):
    """Return the statement analysis, or None if the file doesn't look like a bank statement."""
    if df is None or df.empty:
        return None
    cols = list(df.columns)
    date_c = _find(cols, r'date', r'transaction ?date', r'posting ?date', r'value ?date', r'.*date.*')
    desc_c = _find(cols, r'description', r'details?', r'narrative', r'reference', r'transaction', r'memo', r'payee')
    amount_c = _find(cols, r'amount', r'amount ?\(?zar\)?', r'value', r'transaction ?amount')
    debit_c = _find(cols, r'debits?', r'withdrawals?', r'money ?out', r'paid ?out')
    credit_c = _find(cols, r'credits?', r'deposits?', r'money ?in', r'paid ?in')
    balance_c = _find(cols, r'balance', r'running ?balance', r'closing ?balance')
    if not date_c or not desc_c or not (amount_c or (debit_c and credit_c)):
        return None

    dates = pd.to_datetime(df[date_c], errors='coerce', format='mixed')
    if dates.notna().mean() < 0.6:
        return None
    if amount_c:
        amount = _money(df[amount_c])
    else:
        amount = _money(df[credit_c]).fillna(0).abs() - _money(df[debit_c]).fillna(0).abs()
    if amount.notna().mean() < 0.6:
        return None

    t = pd.DataFrame({'date': dates, 'desc': df[desc_c].astype(str), 'amount': amount})
    if balance_c:
        t['balance'] = _money(df[balance_c])
    t = t.dropna(subset=['date', 'amount']).sort_values('date', kind='stable').reset_index(drop=True)
    if len(t) < 3:
        return None
    t['category'] = t['desc'].map(_category)

    days = max(1, (t['date'].max() - t['date'].min()).days + 1)
    months = max(1.0, days / 30.44)
    income = float(t.loc[t.amount > 0, 'amount'].sum())
    spending = float(-t.loc[t.amount < 0, 'amount'].sum())
    out = t[t.amount < 0]
    by_cat = (-out.groupby('category')['amount'].sum()).sort_values(ascending=False)
    debt = float(by_cat.get('debt', 0.0))
    housing = float(by_cat.get('housing', 0.0))

    monthly_income = income / months
    monthly_spending = spending / months
    debt_to_income = (debt / income * 100) if income > 0 else None
    spend_to_income = (spending / income * 100) if income > 0 else None

    bal = t['balance'] if 'balance' in t and t['balance'].notna().mean() > 0.6 else None
    if bal is None:
        bal = t['amount'].cumsum()  # no balance column: track the net position from the first row
        balance_source = 'net running total (no balance column)'
    else:
        balance_source = 'statement balance'
    lowest = float(bal.min())
    closing = float(bal.dropna().iloc[-1])
    negative_share = float((bal < 0).mean() * 100)

    flags = []
    points = 0

    def flag(level, text, pts):
        nonlocal points
        points += pts
        flags.append({'level': level, 'text': text})

    if income <= 0:
        flag('high', 'No income was found in this period.', 40)
    elif spend_to_income is not None:
        if spend_to_income > 120:
            flag('high', f'Spending is {spend_to_income:.0f}% of income: R{spending - income:,.0f} more went out than came in.', 30)
        elif spend_to_income > 100:
            flag('medium', f'Spending is {spend_to_income:.0f}% of income, so the account is going backwards.', 18)
        elif spend_to_income > 90:
            flag('low', f'Spending uses {spend_to_income:.0f}% of income, which leaves little room for savings.', 6)
    if debt_to_income is not None:
        if debt_to_income > 40:
            flag('high', f'Debt repayments take {debt_to_income:.0f}% of income (above 40% is considered over-indebted).', 30)
        elif debt_to_income > 25:
            flag('medium', f'Debt repayments take {debt_to_income:.0f}% of income (25 to 40% is stretched).', 15)
    if negative_share >= 50:
        flag('high', f'The balance was negative on {negative_share:.0f}% of transactions (lowest R{lowest:,.0f}).', 25)
    elif negative_share > 0:
        flag('medium', f'The account went into overdraft (lowest balance R{lowest:,.0f}).', 12)
    risky_loans = t[t.desc.str.contains(DEBT_WARNING, case=False, regex=True)]
    if len(risky_loans):
        flag('high', f'{len(risky_loans)} short-term or cash-loan transaction(s), a common sign of financial stress.', 15)
    failed = t[t.desc.str.contains(FAILED_PAYMENT, case=False, regex=True)]
    if len(failed):
        flag('high', f'{len(failed)} unpaid or returned debit order(s).', 20)
    gambling = float(-t.loc[t.desc.str.contains(GAMBLING, case=False, regex=True) & (t.amount < 0), 'amount'].sum())
    if income > 0 and gambling / income > 0.05:
        flag('medium', f'Gambling spend is {gambling / income * 100:.0f}% of income.', 10)
    if income > 0 and housing / income > 0.35:
        flag('medium', f'Housing costs are {housing / income * 100:.1f}% of income (more than 35% is high).', 8)

    score = min(100, points)
    level = 'High' if score >= 50 else 'Medium' if score >= 20 else 'Low'
    if not flags:
        flags.append({'level': 'low', 'text': 'Income covers spending, debt is manageable and the account stays in credit.'})

    r = lambda v: None if v is None or (isinstance(v, float) and np.isnan(v)) else round(float(v), 2)
    return {
        'is_statement': True,
        'columns': {'date': date_c, 'description': desc_c, 'amount': amount_c, 'debit': debit_c, 'credit': credit_c, 'balance': balance_c},
        'period': {'start': t['date'].min().date().isoformat(), 'end': t['date'].max().date().isoformat(), 'days': days, 'months': round(months, 1)},
        'transactions': int(len(t)),
        'income_total': r(income), 'spending_total': r(spending), 'net_cash_flow': r(income - spending),
        'monthly_income': r(monthly_income), 'monthly_spending': r(monthly_spending),
        'spend_to_income_pct': r(spend_to_income), 'debt_to_income_pct': r(debt_to_income),
        'debt_total': r(debt), 'housing_total': r(housing),
        'lowest_balance': r(lowest), 'closing_balance': r(closing), 'negative_balance_pct': r(negative_share),
        'balance_source': balance_source,
        'spending_by_category': [{'category': k, 'amount': r(v), 'pct': r(v / spending * 100) if spending else 0} for k, v in by_cat.items()],
        'risk_score': int(score), 'risk_level': level, 'flags': flags,
    }


def reporter_overrides(st):
    """Report text for a statement: lead with the financial risk, not generic data-science advice."""
    lvl = st['risk_level']
    top = st['flags'][0]['text']
    dti = st['debt_to_income_pct']
    return {
        'headline': f"Financial risk: {lvl.upper()}. Income R{st['income_total']:,.0f} vs spending R{st['spending_total']:,.0f} "
                    f"over {st['period']['days']} days.",
        'main_finding': top,
        'risk': ' '.join(f['text'] for f in st['flags'][:3]),
        'best_ml_option': 'Not needed: a single statement has nothing to predict. The risk rating above is rule-based '
                          '(income vs spending, debt-to-income, overdraft, loan types).',
        'next_action': ('Cut the largest spending categories and stop new short-term credit; aim for debt below 25% of income.'
                        if lvl == 'High' else
                        'Bring spending below income and keep debt repayments under 25% of income.' if lvl == 'Medium' else
                        'Healthy pattern: keep a buffer of at least one month of spending.'),
        'recommendation': (f"Debt repayments are {dti:.0f}% of income." if dti is not None else 'No income found to compare against.'),
    }
