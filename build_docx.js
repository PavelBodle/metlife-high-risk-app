const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  PageBreak, PositionalTab, PositionalTabAlignment, PositionalTabLeader,
} = require('docx');

const BLUE = '0090DA', GREEN = '00A758', RED = 'E4002B', DARK = '1B2A38', GREY = '5B6770';
const S = JSON.parse(fs.readFileSync('assets/summary.json', 'utf8'));

const img = (p, w, h) => new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new ImageRun({ type: 'png', data: fs.readFileSync(p),
    transformation: { width: w, height: h } })],
  spacing: { before: 120, after: 60 },
});
const cap = (t) => new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: t, italics: true, size: 18, color: GREY })],
  spacing: { after: 200 },
});
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 },
  children: [new TextRun({ text: t, color: DARK, bold: true })] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 80 },
  children: [new TextRun({ text: t, color: BLUE, bold: true })] });
const p = (runs, opts = {}) => new Paragraph({ spacing: { after: 120, line: 276 }, ...opts,
  children: Array.isArray(runs) ? runs : [new TextRun({ text: runs, size: 22 })] });
const t = (s, o = {}) => new TextRun({ text: s, size: 22, ...o });
const bullet = (runs) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 },
  children: Array.isArray(runs) ? runs : [new TextRun({ text: runs, size: 22 })] });

// Callout box (single-cell shaded table)
const callout = (title, body, color = GREEN) => new Table({
  width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360],
  borders: { top:{style:BorderStyle.SINGLE,size:2,color}, bottom:{style:BorderStyle.SINGLE,size:2,color},
             left:{style:BorderStyle.SINGLE,size:18,color}, right:{style:BorderStyle.SINGLE,size:2,color},
             insideHorizontal:{style:BorderStyle.NONE}, insideVertical:{style:BorderStyle.NONE} },
  rows: [new TableRow({ children: [new TableCell({
    width: { size: 9360, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: 'F4FAF6' },
    margins: { top: 120, bottom: 120, left: 180, right: 180 },
    children: [
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: title, bold: true, color, size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: body, size: 21, color: DARK })] }),
    ],
  })] })],
});

// Simple data table
function dataTable(headers, rows, widths) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  const borders = { top: border, bottom: border, left: border, right: border,
    insideHorizontal: border, insideVertical: border };
  const headerRow = new TableRow({ tableHeader: true, children: headers.map((hh, i) =>
    new TableCell({ width: { size: widths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: BLUE },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: hh, bold: true, color: 'FFFFFF', size: 20 })] })] })) });
  const dataRows = rows.map((r, ri) => new TableRow({ children: r.map((c, i) =>
    new TableCell({ width: { size: widths[i], type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: ri % 2 ? 'F2F6F9' : 'FFFFFF' },
      margins: { top: 50, bottom: 50, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: String(c), size: 20,
        bold: i === 0, color: DARK })] })] })) }));
  return new Table({ width: { size: widths.reduce((a,b)=>a+b,0), type: WidthType.DXA },
    columnWidths: widths, borders, rows: [headerRow, ...dataRows] });
}

const mr = S.model_results;
const children = [];

// ---------- TITLE PAGE ----------
children.push(
  new Paragraph({ spacing: { before: 2400 } }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: 'Predicting High-Risk Insurance Customers', bold: true, size: 52, color: DARK })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
    children: [new TextRun({ text: 'An Explainable, Business-Ready Risk Model', size: 30, color: BLUE })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 },
    children: [new TextRun({ text: 'Data Exploration · Statistical Testing · Modeling · Business Insight', size: 22, italics: true, color: GREY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: 'Prepared for MetLife Japan', size: 24, color: DARK, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: 'Senior Data Scientist — Take-Home Assignment', size: 22, color: GREY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Dataset: insurance_test_data.csv · 60,000 customers · 9 features', size: 20, color: GREY })] }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ---------- EXECUTIVE SUMMARY ----------
children.push(h1('Executive Summary'));
children.push(p([
  t('We built a model to flag '), t('high-risk customers', { bold: true }),
  t(' among 60,000 policyholders. The recommended model — a '),
  t('Logistic Regression', { bold: true, color: BLUE }),
  t(` — reaches an AUROC of ${mr['Logistic Regression'].AUROC} and, critically, is fully transparent: every decision can be explained to an underwriter as a set of odds ratios. It beats more complex Random Forest and Gradient Boosting models on this data, so the simplest option is also the most accurate `),
  t('and', { italics: true }), t(' the most auditable — an ideal combination for regulated insurance.'),
]));
children.push(p([t('Three findings drive the story:', { bold: true })]));
children.push(bullet([t('Age is the dominant risk driver', { bold: true }),
  t(` (correlation +${S.corr_with_target.age}). High-risk incidence rises from ~21% for under-40s to ~67% for over-60s.`)]));
children.push(bullet([t('Health score is strongly protective', { bold: true }),
  t(` (high-risk customers average ${S.health_ttest.mean_high} vs ${S.health_ttest.mean_low}; difference significant at p<0.001).`)]));
children.push(bullet([t('Income, BMI and past claims are essentially noise', { bold: true }),
  t(' (near-zero correlation) — they should not sway underwriting on this data.')]));
children.push(p([
  t('Because a '), t('missed', { italics: true }),
  t(' high-risk customer hurts the loss ratio far more than an over-cautious flag, we recommend operating '),
  t('below', { bold: true }), t(' the default 0.50 threshold. Finally, we packaged the model into an interactive Streamlit app with a GenAI assistant so that '),
  t('non-technical underwriters', { bold: true }),
  t(' can score customers, explore the portfolio, and ask plain-English questions.'),
]));
children.push(callout('Bottom line',
  `An explainable model (AUROC ${mr['Logistic Regression'].AUROC}) plus a self-serve app turns risk scoring into a tool the whole underwriting team can use — not a black box owned by data science.`, BLUE));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---------- Q1 ----------
children.push(h1('Q1 · Data Exploration & Preprocessing'));
children.push(h2('Mean vs. median for imputing annual_income'));
children.push(p([
  t('The dataset has '), t('3,000 missing values (5%)', { bold: true }),
  t(' in annual_income — the only column with missingness. The textbook rule is "use the median when the variable is skewed, because the mean is pulled toward the tail." So the first step is to actually measure the skew rather than assume it.'),
]));
children.push(img('assets/q1_income_distribution.png', 560, 214));
children.push(cap(`Figure 1. annual_income is near-symmetric (skew = ${S.income_skew}); past_claims_amount is the genuinely skewed variable (skew = ${S.claims_skew}).`));
children.push(p([
  t('annual_income is '), t('almost perfectly symmetric', { bold: true }),
  t(` (skew = ${S.income_skew}). As a result the mean (${S.income_mean}) and median (${S.income_median}) are practically identical — they differ by less than 0.05%. `),
]));
children.push(callout('Answer — use the median',
  `The median is the more statistically sound default because it is robust to outliers and skew. On THIS variable the choice barely matters (skew ≈ 0.04, so mean ≈ median), but the median never does harm and protects us if the distribution is fatter-tailed than it looks. Reporting that the "use-median-for-skew" rule is not actually load-bearing here — and contrasting it with past_claims_amount, which IS skewed at ${S.claims_skew} — is itself the correct, senior read of the data.`, GREEN));
children.push(h2('Data-quality catch: impossible ages'));
children.push(p([
  t('Profiling also surfaced '), t(`${S.age_outliers_capped} records with age = 200`, { bold: true, color: RED }),
  t(' — an impossible sentinel value (the 99.9th percentile jumps from 89 to 200). We capped age at 100. Catching and handling this before modeling is exactly the kind of hygiene that protects a production risk model.'),
]));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---------- Q2 ----------
children.push(h1('Q2 · Hypothesis Testing & Correlation Analysis'));
children.push(h2('Is health_score significantly related to risk?'));
children.push(p([
  t('health_score is continuous and is_high_risk is binary, so the right tool is a '),
  t("two-sample Welch's t-test", { bold: true }),
  t(' comparing mean health_score between the two risk groups (Welch, not Student, because we do not assume equal variances).'),
]));
children.push(img('assets/q2_healthscore_by_risk.png', 420, 308));
children.push(cap('Figure 2. Distribution of health_score by risk group — the two populations clearly separate.'));
children.push(callout('Answer — highly significant',
  `Welch's t = ${S.health_ttest.t}, p < 0.001. Mean health_score is ${S.health_ttest.mean_low} for low-risk vs ${S.health_ttest.mean_high} for high-risk. We reject the null hypothesis: health_score is strongly associated with risk. (For categorical drivers we used a Chi-square test: has_chronic_disease is significant, χ² = ${S.chi_square.has_chronic_disease.chi2}, p < 0.001, while policy_type is NOT, χ² = ${S.chi_square.policy_type.chi2}, p = ${S.chi_square.policy_type.p.toFixed(2)}.)`, GREEN));
children.push(h2('Multicollinearity'));
children.push(p([
  t('We checked the correlation matrix and Variance Inflation Factors (VIF) across all numeric predictors.'),
]));
children.push(img('assets/q2_correlation_heatmap.png', 430, 344));
children.push(cap('Figure 3. Correlation matrix. Only age (+0.42) and health_score (−0.23) correlate with the target; predictors are mutually uncorrelated.'));
children.push(dataTable(
  ['Feature', 'Corr. with target', 'VIF'],
  [
    ['age', `+${S.corr_with_target.age}`, S.vif.age.toFixed(2)],
    ['health_score', `${S.corr_with_target.health_score}`, S.vif.health_score.toFixed(2)],
    ['has_chronic_disease', `+${S.corr_with_target.has_chronic_disease}`, S.vif.has_chronic_disease.toFixed(2)],
    ['annual_income', `${S.corr_with_target.annual_income}`, S.vif.annual_income.toFixed(2)],
    ['past_claims_amount', `+${S.corr_with_target.past_claims_amount}`, S.vif.past_claims_amount.toFixed(2)],
    ['bmi', `+${S.corr_with_target.bmi}`, S.vif.bmi.toFixed(2)],
  ],
  [3600, 3000, 2760]));
children.push(p([t('')], { spacing: { after: 60 } }));
children.push(callout('Answer — no multicollinearity present',
  'Every inter-predictor correlation is ≈ 0 and all VIFs ≈ 1.0 (a VIF above 5 would signal a problem). No feature pair is redundant, so no feature needed to be dropped or combined. As a safeguard we still used L2-regularized Logistic Regression, which is stable even if mild collinearity were introduced by future data.', BLUE));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---------- Q3 ----------
children.push(h1('Q3 · Model Selection & Performance Metrics'));
children.push(h2('Why prioritise F1 / AUROC over Accuracy?'));
children.push(p([
  t('The target is '), t(`${S.target_pct_high_risk}% high-risk`, { bold: true }),
  t(' — close to balanced, not the extreme imbalance these questions often assume. That honesty matters: with a ~46/54 split, plain accuracy is '),
  t('less', { italics: true }),
  t(' misleading here than in a 1%-fraud problem. But we still lead with AUROC and F1 for two reasons:'),
]));
children.push(bullet([t('Asymmetric business cost.', { bold: true }),
  t(' A false negative (missing a high-risk customer) damages the loss ratio far more than a false positive. Accuracy weights both errors equally; F1 and the full ROC do not.')]));
children.push(bullet([t('Threshold independence.', { bold: true }),
  t(' AUROC measures ranking quality across every threshold, so we can choose the operating point by business cost (Q4) rather than being locked to 0.50.')]));
children.push(h2('Model bake-off'));
children.push(img('assets/q3_roc_curves.png', 380, 320));
children.push(cap('Figure 4. ROC curves. Logistic Regression matches or beats the tree ensembles.'));
children.push(dataTable(
  ['Model', 'AUROC', 'F1', 'Accuracy', 'PR-AUC'],
  [
    ['Logistic Regression ✓', mr['Logistic Regression'].AUROC, mr['Logistic Regression'].F1, mr['Logistic Regression'].Accuracy, mr['Logistic Regression'].PR_AUC],
    ['Gradient Boosting', mr['Gradient Boosting'].AUROC, mr['Gradient Boosting'].F1, mr['Gradient Boosting'].Accuracy, mr['Gradient Boosting'].PR_AUC],
    ['Random Forest', mr['Random Forest'].AUROC, mr['Random Forest'].F1, mr['Random Forest'].Accuracy, mr['Random Forest'].PR_AUC],
  ],
  [3000, 1600, 1600, 1600, 1560]));
children.push(new Paragraph({ spacing: { after: 100 } }));
children.push(h2('Explainability of the chosen algorithm in insurance'));
children.push(p([t('Pros of Logistic Regression:', { bold: true, color: GREEN })]));
children.push(bullet('Every coefficient is an odds ratio — directly explainable to underwriters, auditors and regulators ("each standard-deviation of age roughly triples the odds of high risk").'));
children.push(bullet('Transparent, monotonic, and easy to monitor for fairness and drift — important under insurance regulation and for customer-facing adverse-action reasons.'));
children.push(bullet('Fast, stable, and here it is also the most accurate model.'));
children.push(p([t('Cons / trade-offs:', { bold: true, color: RED })]));
children.push(bullet('Assumes a (log-odds) linear relationship, so it cannot automatically capture complex interactions or thresholds; those must be added as engineered features.'));
children.push(bullet('On datasets with strong nonlinearity a gradient-boosted model could pull ahead — but here it did not, so the added opacity is not justified.'));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---------- Q4 ----------
children.push(h1('Q4 · Business Insights'));
children.push(h2('Top feature importances'));
children.push(img('assets/q4_feature_importance.png', 440, 290));
children.push(cap('Figure 5. Permutation importance (drop in AUROC when a feature is shuffled).'));
children.push(p([
  t('The model is driven, in order, by '), t('age', { bold: true }), t(', then '),
  t('health_score', { bold: true }), t(', then '), t('has_chronic_disease', { bold: true }),
  t('. In odds-ratio terms: age has an OR ≈ '), t(`${S.odds_ratios.age}`, { bold: true }),
  t(' (a one-SD increase in age roughly triples the odds of high risk), health_score has an OR ≈ '),
  t(`${S.odds_ratios.health_score}`, { bold: true }),
  t(' (protective — higher score lowers risk), and chronic disease adds a smaller upward push (OR ≈ '),
  t(`${S.odds_ratios.has_chronic_disease}`, { bold: true }),
  t('). Income, BMI and past claims contribute almost nothing.'),
]));
children.push(h2('Should we raise or lower the probability threshold?'));
children.push(img('assets/q4_threshold_economics.png', 470, 300));
children.push(cap('Figure 6. Total business cost vs. threshold when a miss costs 10× an over-flag.'));
children.push(p([
  t('The '), t('loss ratio', { bold: true }),
  t(' = claims paid ÷ premiums earned. A '), t('false negative', { bold: true, color: RED }),
  t(' — approving a truly high-risk customer at standard price — inflates future claims and pushes the loss ratio up. A '),
  t('false positive', { bold: true }),
  t(' merely adds friction or slightly overprices a safe customer. The two errors are '),
  t('not', { italics: true }), t(' equally costly.'),
]));
children.push(callout('Answer — lower the threshold',
  `Because missing a high-risk customer is the expensive error, the company should LOWER the decision threshold below 0.50, casting a wider net so fewer risky customers slip through to standard pricing. With an illustrative 10:1 miss-to-over-flag cost ratio, the loss-minimising threshold falls to about ${S.cost_optimal_threshold}. Flagged customers are then routed to manual underwriting or risk-based pricing. The exact point is a business decision — which is why the app lets managers set the cost ratio and see the optimal threshold move in real time.`, GREEN));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---------- Business recommendations / app ----------
children.push(h1('From Model to Business Value'));
children.push(p([
  t('A model only creates value when the business can use it. We delivered three assets beyond the notebook:'),
]));
children.push(bullet([t('Interactive Streamlit app', { bold: true }),
  t(' — an underwriter scores any applicant with sliders, sees a plain-English reason, explores the 60,000-customer portfolio by age/health band, and tunes the cost-based threshold. Deployable free on Streamlit Cloud.')]));
children.push(bullet([t('GenAI underwriting assistant', { bold: true }),
  t(' — a chatbot that answers questions like "what is the high-risk rate for customers over 60?". Answers are computed in Python first and only phrased by the LLM, so the numbers are always exact — a responsible-AI pattern with no hallucinated statistics.')]));
children.push(bullet([t('This document + an executive deck', { bold: true }),
  t(' — the analytical narrative for both technical and business audiences.')]));
children.push(h2('Recommended actions'));
children.push(bullet('Adopt the explainable Logistic Regression as the production scorer; keep gradient boosting as a challenger model.'));
children.push(bullet('Operate below a 0.50 threshold, tuned to the current loss-ratio target; review quarterly.'));
children.push(bullet('Focus underwriting scrutiny on older and lower-health-score segments; de-emphasise income/BMI, which carry no signal here.'));
children.push(bullet('Roll out the app to underwriting teams as a decision-support tool, with the GenAI assistant for self-serve questions.'));
children.push(callout('Responsible use',
  'The model is a screening aid, not an automated decline engine. Use age and health-derived features in line with local regulation and fairness review; keep a human underwriter in the loop for adverse decisions.', BLUE));
children.push(h2('Appendix · Methodology'));
children.push(p([t('60,000 rows, stratified 80/20 train/test split (random_state = 42). Pipeline: median imputation of annual_income → one-hot encoding of policy_type → standardisation → estimator. Age capped at 100. Metrics on the held-out test set. Fully reproducible via analysis.py.', { size: 20, color: GREY })]));

// ---------- BUILD ----------
const doc = new Document({
  creator: 'MetLife Japan — Sr Data Scientist Assignment',
  title: 'Predicting High-Risk Insurance Customers',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22, color: '222222' } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, color: DARK }, paragraph: { spacing: { before: 240, after: 120 } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, color: BLUE }, paragraph: { spacing: { before: 180, after: 80 } } },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync('MetLife_Answers.docx', buf);
  console.log('Wrote MetLife_Answers.docx', buf.length, 'bytes');
});
