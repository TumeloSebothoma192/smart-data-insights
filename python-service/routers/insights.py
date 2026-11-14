from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, Dict

router = APIRouter()


class InsightsRequest(BaseModel):
    analysis: Dict[str, Any]
    dataset_name: str = 'Dataset'


def _plain(text: Any) -> str:
    return str(text).replace('**', '')


@router.post('/insights')
async def generate(req: InsightsRequest):
    analysis = req.analysis
    rows = analysis.get('shape', {}).get('rows', 0)
    cols = analysis.get('shape', {}).get('columns', 0)
    missing = analysis.get('missing_values', {})
    missing_total = missing.get('total', 0)
    missing_rate = missing.get('rate', 0)
    duplicates = analysis.get('duplicates', {})
    numeric = analysis.get('numeric_columns', [])
    categorical = analysis.get('categorical_columns', [])
    reporter = analysis.get('reporter', {})
    stats = analysis.get('statistics', {})
    category_metrics = analysis.get('category_metrics', [])
    correlation = analysis.get('correlation', {})
    st = analysis.get('statement')

    summary = [
        f"{req.dataset_name} contains {rows:,} records across {cols} columns.",
        f"The analysis found {len(numeric)} numeric feature(s), {len(categorical)} categorical feature(s), and {missing_total:,} missing value(s).",
    ]
    if reporter.get('headline'):
        summary.insert(0, _plain(reporter['headline']))
    if reporter.get('main_finding'):
        summary.append(_plain(reporter['main_finding']))

    trends = []
    if analysis.get('time_series'):
        ts = analysis['time_series']
        trends.append(f"A time trend was detected using {ts['date_column']} against {ts['metric_column']}. Use the line chart to review movement across periods.")

    for col, column_stats in list(stats.items())[:5]:
        skewness = column_stats.get('skewness') or 0
        mean = column_stats.get('mean')
        std = column_stats.get('std') or 0
        if abs(skewness) > 1:
            trends.append(f"{col} is strongly {'right' if skewness > 0 else 'left'} skewed. Consider transformation or outlier review before model training.")
        if mean not in (None, 0) and abs(std / mean) > 0.6:
            trends.append(f"{col} has high variability compared with its average, which may reveal useful segments or outliers.")

    if category_metrics:
        top = category_metrics[0]
        if top.get('points'):
            best = top['points'][0]
            trends.append(f"{top['category_column']} is a strong reporting dimension. The leading segment is {best['name']} with value {best['value']}.")

    if correlation.get('columns') and correlation.get('matrix'):
        cols_list = correlation['columns']
        matrix = correlation['matrix']
        strongest = None
        for i in range(len(cols_list)):
            for j in range(i + 1, len(cols_list)):
                value = matrix[i][j]
                if value is None:
                    continue
                if strongest is None or abs(value) > abs(strongest[2]):
                    strongest = (cols_list[i], cols_list[j], value)
        if strongest:
            trends.append(f"The strongest numeric relationship is {strongest[0]} versus {strongest[1]} with correlation {strongest[2]}.")

    risks = []
    if missing_rate >= 5:
        risks.append(f"Missing data rate is {missing_rate}%. Clean or impute missing values before final reporting or ML training.")
    elif missing_total > 0:
        risks.append(f"Missing data exists but is low at {missing_rate}%. Review affected columns before exporting the report.")
    else:
        risks.append("No major missing-value risk was detected in the first analysis pass.")

    if duplicates.get('count', 0) > 0:
        risks.append(f"{duplicates['count']} duplicate row(s) were detected. Remove duplicates if each row should represent one unique record.")
    if rows < 100:
        risks.append("The dataset is small. Machine learning results may not generalize well without more records.")
    if len(numeric) == 0:
        risks.append("No numeric columns were detected, so regression, correlations, and most charts will be limited.")

    recommendations = [
        reporter.get('recommendation') or 'Choose a target column, then let the ML Lab decide whether the problem is classification, regression, or clustering.',
        'Use Charts to inspect trends and category breakdowns before training a model.',
        'Use the exported report as your SDLC evidence: analysis output, risks, recommendation, and next action.',
    ]
    if numeric:
        recommendations.append('For ML, start with Random Forest because it handles mixed patterns well and provides feature importance.')
    if missing_total > 0:
        recommendations.append('Apply median imputation for numeric columns and mode imputation for categorical columns before production use.')
    if categorical:
        recommendations.append('Use category breakdowns to explain business/user segments in your dashboard presentation.')

    if st:
        money = lambda v: 'n/a' if v is None else f"R{v:,.0f}"
        cats = ', '.join(f"{c['category']} {money(c['amount'])} ({c['pct']:.0f}%)" for c in st['spending_by_category'][:4])
        summary = [
            f"Financial risk is {st['risk_level'].upper()} (score {st['risk_score']}/100) for {st['period']['start']} to {st['period']['end']}.",
            f"Income {money(st['income_total'])} vs spending {money(st['spending_total'])}: net {money(st['net_cash_flow'])}.",
            f"Debt repayments: {money(st['debt_total'])}" + (f" ({st['debt_to_income_pct']:.0f}% of income)." if st['debt_to_income_pct'] is not None else '.'),
            f"Lowest balance {money(st['lowest_balance'])}; closing balance {money(st['closing_balance'])}.",
        ]
        trends = [f"Biggest spending categories: {cats}."] + trends[:1]
        risks = [f['text'] for f in st['flags']] + [f"Data quality: {reporter.get('quality_score', 0)}% (this measures file completeness, not finances)."]
        recommendations = [reporter.get('next_action', '')]
        if (st['debt_to_income_pct'] or 0) > 25:
            recommendations.append('List every debt with its interest rate; pay the most expensive first and avoid new short-term loans.')
        if (st['spend_to_income_pct'] or 0) > 100:
            recommendations.append(f"Close the monthly gap of {money((st['monthly_spending'] or 0) - (st['monthly_income'] or 0))} by cutting the top category first.")
        if (st['negative_balance_pct'] or 0) > 0:
            recommendations.append('Avoid overdraft: move debit orders to just after payday so the balance stays positive.')
        recommendations.append('Machine learning is not needed for a single statement: the rating is rule-based and explained above.')

    return {
        'summary': summary,
        'trends': trends or ['No strong trend was detected yet. Add a date/time column or more numeric measures to improve trend analysis.'],
        'risks': risks,
        'recommendations': recommendations,
        'quick_stats': {
            'total_records': rows,
            'total_features': cols,
            'numeric_features': len(numeric),
            'categorical_features': len(categorical),
            'missing_rate': missing_rate,
            'data_quality_score': reporter.get('quality_score', max(0, round(100 - missing_rate * 2, 1))),
            'financial_risk': st['risk_level'] if st else None,
        },
    }
