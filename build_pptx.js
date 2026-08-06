const fs = require('fs');
const pptxgen = require('pptxgenjs');
const S = JSON.parse(fs.readFileSync('assets/summary.json', 'utf8'));
const mr = S.model_results;

// ---- Palette (MetLife blue + green, topic-informed) ----
const BLUE = '0090DA', GREEN = '00A758', NAVY = '12283A', RED = 'E4002B',
      INK = '1B2A38', GREY = '5B6770', LIGHT = 'F4F8FB', MIST = 'E7EFF5', WHITE = 'FFFFFF';
const FH = 'Cambria', FB = 'Calibri';

const pres = new pptxgen();
pres.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
pres.layout = 'W';
const W = 13.333, H = 7.5;

// ---------- helpers ----------
function chip(s, x, y, w, label, color) {
  s.addShape('roundRect', { x, y, w, h: 0.34, rectRadius: 0.17, fill: { color }, line: { type: 'none' } });
  s.addText(label, { x, y, w, h: 0.34, align: 'center', valign: 'middle',
    fontFace: FB, fontSize: 11, bold: true, color: WHITE });
}
function kicker(s, txt, x, y, color = BLUE) {
  s.addText(txt.toUpperCase(), { x, y, w: 8, h: 0.3, fontFace: FB, fontSize: 12,
    bold: true, color, charSpacing: 2, margin: 0 });
}
function title(s, txt, x, y, w, color = INK, size = 32) {
  s.addText(txt, { x, y, w, h: 0.9, fontFace: FH, fontSize: size, bold: true, color, margin: 0 });
}
function footer(s, n) {
  s.addText('MetLife Japan · High-Risk Customer Prediction', { x: 0.5, y: 7.08, w: 8, h: 0.3,
    fontFace: FB, fontSize: 9, color: GREY, margin: 0 });
  s.addText(String(n), { x: 12.5, y: 7.08, w: 0.4, h: 0.3, fontFace: FB, fontSize: 9,
    color: GREY, align: 'right', margin: 0 });
}
// stat card
function statCard(s, x, y, w, big, label, color = BLUE, sub) {
  s.addShape('roundRect', { x, y, w, h: 1.7, rectRadius: 0.08, fill: { color: WHITE },
    line: { color: MIST, width: 1 }, shadow: { type: 'outer', color: 'AAB7C4', blur: 6, offset: 2, angle: 90, opacity: 0.35 } });
  s.addText(big, { x, y: y + 0.18, w, h: 0.8, align: 'center', fontFace: FH, fontSize: 40, bold: true, color, margin: 0 });
  s.addText(label, { x: x + 0.1, y: y + 1.02, w: w - 0.2, h: 0.5, align: 'center', valign: 'top',
    fontFace: FB, fontSize: 12, color: INK, margin: 0 });
  if (sub) s.addText(sub, { x: x + 0.1, y: y + 1.4, w: w - 0.2, h: 0.28, align: 'center',
    fontFace: FB, fontSize: 9, italic: true, color: GREY, margin: 0 });
}
// icon-ish bullet row with colored dot
function row(s, x, y, w, head, body, color = BLUE) {
  s.addShape('ellipse', { x, y: y + 0.05, w: 0.16, h: 0.16, fill: { color }, line: { type: 'none' } });
  s.addText([{ text: head + '  ', options: { bold: true, color: INK } },
             { text: body, options: { color: GREY } }],
    { x: x + 0.32, y: y - 0.06, w: w - 0.32, h: 0.7, fontFace: FB, fontSize: 13.5, valign: 'top', margin: 0 });
}

// ===================================================================
// SLIDE 1 — Title (dark)
// ===================================================================
let s = pres.addSlide();
s.background = { color: NAVY };
s.addShape('rect', { x: 0, y: 0, w: W, h: H, fill: { color: NAVY } });
// motif: soft circles
s.addShape('ellipse', { x: 9.7, y: -1.6, w: 5.6, h: 5.6, fill: { color: BLUE, transparency: 82 }, line: { type: 'none' } });
s.addShape('ellipse', { x: 11.0, y: 3.2, w: 4.2, h: 4.2, fill: { color: GREEN, transparency: 82 }, line: { type: 'none' } });
chip(s, 0.9, 1.15, 3.0, '🛡  METLIFE JAPAN · DATA & AI', BLUE);
s.addText('Predicting High-Risk\nInsurance Customers', { x: 0.85, y: 1.9, w: 9.8, h: 2.2,
  fontFace: FH, fontSize: 46, bold: true, color: WHITE, lineSpacing: 50, margin: 0 });
s.addText('An explainable risk model — and a self-serve app the whole underwriting team can use.',
  { x: 0.9, y: 4.15, w: 9.5, h: 0.7, fontFace: FB, fontSize: 18, color: 'CADCEC', margin: 0 });
s.addText([
  { text: `AUROC ${mr['Logistic Regression'].AUROC}`, options: { bold: true, color: GREEN } },
  { text: '   ·   60,000 customers   ·   Explainable + GenAI-assisted', options: { color: 'CADCEC' } },
], { x: 0.9, y: 5.4, w: 11, h: 0.4, fontFace: FB, fontSize: 14, margin: 0 });
s.addText('Senior Data Scientist — Take-Home Assignment', { x: 0.9, y: 6.5, w: 8, h: 0.4,
  fontFace: FB, fontSize: 12, italic: true, color: '8FA6B8', margin: 0 });
s.addNotes('Framing: this is not just a model — it is a decision-support product. The headline is that the simplest, most explainable model wins, and we made it usable by non-technical underwriters through an app with a GenAI assistant.');

// ===================================================================
// SLIDE 2 — Business problem
// ===================================================================
s = pres.addSlide(); s.background = { color: LIGHT };
kicker(s, 'The business problem', 0.6, 0.5);
title(s, 'Every mis-priced high-risk customer hurts the loss ratio', 0.6, 0.85, 12.2);
s.addText('Insurers win or lose on one number: the loss ratio (claims paid ÷ premiums earned). ' +
  'If high-risk customers are approved at standard prices, claims rise and margins erode. ' +
  'The goal: flag high-risk applicants early — accurately, and in a way underwriters can trust and explain.',
  { x: 0.6, y: 1.85, w: 7.1, h: 1.8, fontFace: FB, fontSize: 15, color: INK, lineSpacing: 24, margin: 0 });
row(s, 0.6, 3.7, 7.1, 'Accuracy', 'Rank customers by true risk so pricing matches exposure.', BLUE);
row(s, 0.6, 4.5, 7.1, 'Explainability', 'Regulators and customers require a transparent reason for each decision.', GREEN);
row(s, 0.6, 5.3, 7.1, 'Usability', 'Underwriters — not only data scientists — must be able to use it day to day.', RED);
// right: big loss-ratio concept card
s.addShape('roundRect', { x: 8.1, y: 1.85, w: 4.6, h: 4.2, rectRadius: 0.1, fill: { color: NAVY }, line: { type: 'none' },
  shadow: { type: 'outer', color: '99A7B4', blur: 8, offset: 3, angle: 90, opacity: 0.4 } });
s.addText('THE LEVER', { x: 8.4, y: 2.15, w: 4, h: 0.3, fontFace: FB, fontSize: 12, bold: true, color: GREEN, charSpacing: 2, margin: 0 });
s.addText('Loss Ratio', { x: 8.4, y: 2.5, w: 4, h: 0.6, fontFace: FH, fontSize: 30, bold: true, color: WHITE, margin: 0 });
s.addText('Claims paid', { x: 8.4, y: 3.35, w: 4, h: 0.4, fontFace: FB, fontSize: 16, color: 'CADCEC', margin: 0 });
s.addShape('line', { x: 8.4, y: 3.85, w: 3.9, h: 0, line: { color: GREEN, width: 2 } });
s.addText('Premiums earned', { x: 8.4, y: 3.95, w: 4, h: 0.4, fontFace: FB, fontSize: 16, color: 'CADCEC', margin: 0 });
s.addText('A single missed high-risk customer can cost 10× an over-cautious flag. The model is how we manage that asymmetry.',
  { x: 8.4, y: 4.7, w: 4, h: 1.1, fontFace: FB, fontSize: 12.5, italic: true, color: 'AFC2D2', lineSpacing: 18, margin: 0 });
footer(s, 2);
s.addNotes('Set the stakes in business terms before any statistics. The loss ratio is the language executives think in.');

// ===================================================================
// SLIDE 3 — Data at a glance (stat callouts)
// ===================================================================
s = pres.addSlide(); s.background = { color: WHITE };
kicker(s, 'The dataset', 0.6, 0.5);
title(s, 'insurance_test_data.csv at a glance', 0.6, 0.85, 12);
statCard(s, 0.6, 2.0, 2.85, '60,000', 'Customers (rows)', BLUE);
statCard(s, 3.65, 2.0, 2.85, `${S.target_pct_high_risk}%`, 'Are high-risk', RED, 'nearly balanced');
statCard(s, 6.7, 2.0, 2.85, '5%', 'Income values missing', GREEN, 'imputed w/ median');
statCard(s, 9.75, 2.0, 2.85, `${S.age_outliers_capped}`, 'Impossible ages fixed', NAVY, 'age = 200 → capped');
// feature strip
s.addText('8 predictors', { x: 0.6, y: 4.15, w: 4, h: 0.4, fontFace: FB, fontSize: 14, bold: true, color: INK, margin: 0 });
const feats = ['age', 'health_score', 'has_chronic_disease', 'bmi', 'annual_income', 'past_claims_amount', 'policy_type'];
let fx = 0.6;
feats.forEach((f) => { const w = 0.3 + f.length * 0.1; chip(s, fx, 4.55, w, f, fx < 3 ? BLUE : GREY); fx += w + 0.16; });
s.addShape('roundRect', { x: 0.6, y: 5.35, w: 12.1, h: 1.25, rectRadius: 0.08, fill: { color: LIGHT }, line: { color: MIST, width: 1 } });
s.addText([
  { text: 'First read:  ', options: { bold: true, color: BLUE } },
  { text: 'the target is close to a 46 / 54 split — not the extreme imbalance these problems usually assume. ' +
    'That honesty shapes every downstream choice (see the metrics discussion). Only two features carry real signal.', options: { color: INK } },
], { x: 0.85, y: 5.5, w: 11.6, h: 1.0, fontFace: FB, fontSize: 13.5, valign: 'middle', lineSpacing: 20, margin: 0 });
footer(s, 3);
s.addNotes('Big numbers land faster than a table. Note the data-quality catch (age=200) — it signals rigor.');

// ===================================================================
// SLIDE 4 — Approach (process flow)
// ===================================================================
s = pres.addSlide(); s.background = { color: LIGHT };
kicker(s, 'Approach', 0.6, 0.5);
title(s, 'A disciplined, reproducible pipeline', 0.6, 0.85, 12);
const steps = [
  ['1', 'Explore & clean', 'Profile, fix age outliers, median-impute income', BLUE],
  ['2', 'Test hypotheses', 't-test, Chi-square, correlation & VIF', GREEN],
  ['3', 'Model bake-off', 'LogReg vs Random Forest vs Gradient Boosting', BLUE],
  ['4', 'Business insight', 'Drivers, odds ratios, threshold economics', RED],
  ['5', 'Productise', 'Streamlit app + GenAI assistant', NAVY],
];
let sx = 0.6; const sw = 2.32;
steps.forEach((st, i) => {
  s.addShape('roundRect', { x: sx, y: 2.2, w: sw, h: 2.9, rectRadius: 0.08, fill: { color: WHITE },
    line: { color: MIST, width: 1 }, shadow: { type: 'outer', color: 'AAB7C4', blur: 5, offset: 2, angle: 90, opacity: 0.3 } });
  s.addShape('ellipse', { x: sx + sw / 2 - 0.35, y: 2.45, w: 0.7, h: 0.7, fill: { color: st[3] }, line: { type: 'none' } });
  s.addText(st[0], { x: sx + sw / 2 - 0.35, y: 2.45, w: 0.7, h: 0.7, align: 'center', valign: 'middle',
    fontFace: FH, fontSize: 26, bold: true, color: WHITE, margin: 0 });
  s.addText(st[1], { x: sx + 0.15, y: 3.35, w: sw - 0.3, h: 0.6, align: 'center', fontFace: FB, fontSize: 15, bold: true, color: INK, margin: 0 });
  s.addText(st[2], { x: sx + 0.15, y: 3.95, w: sw - 0.3, h: 1.0, align: 'center', valign: 'top', fontFace: FB, fontSize: 11.5, color: GREY, lineSpacing: 16, margin: 0 });
  if (i < steps.length - 1) s.addText('›', { x: sx + sw - 0.02, y: 3.2, w: 0.3, h: 0.6, align: 'center', fontFace: FB, fontSize: 30, bold: true, color: BLUE, margin: 0 });
  sx += sw + 0.2;
});
s.addText('Everything is scripted in analysis.py — one command reproduces every number and chart in this deck.',
  { x: 0.6, y: 5.55, w: 12, h: 0.5, fontFace: FB, fontSize: 13, italic: true, color: GREY, align: 'center', margin: 0 });
footer(s, 4);
s.addNotes('Reproducibility is a senior signal. One script → all artifacts.');

// ===================================================================
// SLIDE 5 — Q1 data quality & imputation
// ===================================================================
s = pres.addSlide(); s.background = { color: WHITE };
kicker(s, 'Q1 · Preprocessing', 0.6, 0.5);
title(s, 'Mean or median? Measure first, then decide', 0.6, 0.85, 12);
s.addImage({ path: 'assets/q1_income_distribution.png', x: 0.6, y: 2.0, w: 7.2, h: 2.75 });
s.addText('Figure: annual_income is symmetric; past_claims_amount is the skewed one.',
  { x: 0.6, y: 4.75, w: 7.2, h: 0.3, fontFace: FB, fontSize: 10, italic: true, color: GREY, align: 'center', margin: 0 });
row(s, 8.1, 2.1, 4.7, 'Skew ≈ 0.04', 'annual_income is near-symmetric, so mean ≈ median (5009 vs 5007).', BLUE);
row(s, 8.1, 3.0, 4.7, 'Use the median', 'Robust to outliers and never harmful — the safe default even when skew is mild.', GREEN);
row(s, 8.1, 3.9, 4.7, 'The real skew', `past_claims_amount is genuinely right-skewed (skew ${S.claims_skew}).`, RED);
s.addShape('roundRect', { x: 8.1, y: 4.9, w: 4.7, h: 1.5, rectRadius: 0.08, fill: { color: LIGHT }, line: { color: MIST, width: 1 } });
s.addText([{ text: 'Senior read:  ', options: { bold: true, color: BLUE } },
  { text: 'the "median-because-skew" rule is not actually load-bearing here — proving it with the number is the point.', options: { color: INK } }],
  { x: 8.35, y: 5.05, w: 4.2, h: 1.2, fontFace: FB, fontSize: 12.5, valign: 'middle', lineSpacing: 18, margin: 0 });
footer(s, 5);
s.addNotes('Answer: median. But the nuance — income is symmetric so it barely matters — is what separates a rote answer from a real one.');

// ===================================================================
// SLIDE 6 — Key insight (drivers) with two images
// ===================================================================
s = pres.addSlide(); s.background = { color: WHITE };
kicker(s, 'The core insight', 0.6, 0.5);
title(s, 'Two features tell almost the whole story: age & health', 0.6, 0.85, 12.4);
s.addImage({ path: 'assets/q2_healthscore_by_risk.png', x: 0.6, y: 2.05, w: 4.15, h: 3.05 });
s.addImage({ path: 'assets/q2_correlation_heatmap.png', x: 5.0, y: 2.05, w: 3.9, h: 3.1 });
// insight column
s.addShape('roundRect', { x: 9.15, y: 2.05, w: 3.6, h: 3.1, rectRadius: 0.08, fill: { color: NAVY }, line: { type: 'none' } });
s.addText('WHAT DRIVES RISK', { x: 9.4, y: 2.25, w: 3.2, h: 0.3, fontFace: FB, fontSize: 11, bold: true, color: GREEN, charSpacing: 1.5, margin: 0 });
s.addText([
  { text: `Age  +${S.corr_with_target.age}\n`, options: { bold: true, color: WHITE, fontSize: 18 } },
  { text: 'risk climbs 21% → 67% with age\n\n', options: { color: 'CADCEC', fontSize: 12 } },
  { text: `Health  ${S.corr_with_target.health_score}\n`, options: { bold: true, color: WHITE, fontSize: 18 } },
  { text: 'protective; strongly significant\n\n', options: { color: 'CADCEC', fontSize: 12 } },
  { text: 'Income · BMI · claims ≈ 0\n', options: { bold: true, color: WHITE, fontSize: 15 } },
  { text: 'essentially noise', options: { color: 'CADCEC', fontSize: 12 } },
], { x: 9.4, y: 2.65, w: 3.2, h: 2.4, fontFace: FB, valign: 'top', lineSpacing: 18, margin: 0 });
s.addText('Left: health_score cleanly separates the two groups.   Right: only age & health_score correlate with the target.',
  { x: 0.6, y: 5.35, w: 8.3, h: 0.4, fontFace: FB, fontSize: 10.5, italic: true, color: GREY, align: 'center', margin: 0 });
footer(s, 6);
s.addNotes('This is the slide to linger on. The business takeaway: focus underwriting on age and health; ignore income/BMI which carry no signal.');

// ===================================================================
// SLIDE 7 — Statistical validation
// ===================================================================
s = pres.addSlide(); s.background = { color: LIGHT };
kicker(s, 'Q2 · Statistical validation', 0.6, 0.5);
title(s, 'We tested every claim before trusting it', 0.6, 0.85, 12);
function testCard(x, tag, tagc, big, label, note) {
  s.addShape('roundRect', { x, y: 2.1, w: 3.85, h: 3.7, rectRadius: 0.08, fill: { color: WHITE }, line: { color: MIST, width: 1 },
    shadow: { type: 'outer', color: 'AAB7C4', blur: 5, offset: 2, angle: 90, opacity: 0.3 } });
  chip(s, x + 0.25, 2.35, 1.7, tag, tagc);
  s.addText(big, { x: x + 0.2, y: 3.0, w: 3.45, h: 0.9, fontFace: FH, fontSize: 30, bold: true, color: tagc, margin: 0 });
  s.addText(label, { x: x + 0.25, y: 3.95, w: 3.35, h: 0.6, fontFace: FB, fontSize: 14, bold: true, color: INK, margin: 0 });
  s.addText(note, { x: x + 0.25, y: 4.55, w: 3.35, h: 1.1, fontFace: FB, fontSize: 12, color: GREY, lineSpacing: 17, margin: 0 });
}
testCard(0.6, "WELCH'S T-TEST", BLUE, 't = 57', 'health_score vs risk',
  `p < 0.001. Mean ${S.health_ttest.mean_high} (high-risk) vs ${S.health_ttest.mean_low} (low). Highly significant.`);
testCard(4.72, 'CHI-SQUARE', GREEN, 'χ² = 431', 'chronic disease vs risk',
  `p < 0.001 → significant. policy_type is NOT (χ²=${S.chi_square.policy_type.chi2}, p=${S.chi_square.policy_type.p.toFixed(2)}).`);
testCard(8.85, 'VIF', RED, '≈ 1.0', 'multicollinearity check',
  'All predictors mutually uncorrelated (VIF≈1; >5 is a problem). No features dropped; L2 regularization as safeguard.');
footer(s, 7);
s.addNotes('T-test for continuous vs binary; Chi-square for categorical; VIF for multicollinearity. The honest finding: policy_type has no signal, and there is no collinearity to fix.');

// ===================================================================
// SLIDE 8 — Model bake-off
// ===================================================================
s = pres.addSlide(); s.background = { color: WHITE };
kicker(s, 'Q3 · Model selection', 0.6, 0.5);
title(s, 'The simplest model wins — and it is the most explainable', 0.6, 0.85, 12.4);
// native bar chart: AUROC by model
const chartData = [{
  name: 'AUROC',
  labels: ['Logistic Reg.', 'Gradient Boost', 'Random Forest'],
  values: [mr['Logistic Regression'].AUROC, mr['Gradient Boosting'].AUROC, mr['Random Forest'].AUROC],
}];
s.addChart(pres.ChartType.bar, chartData, {
  x: 0.6, y: 2.0, w: 6.2, h: 3.5, barDir: 'col', chartColors: [BLUE],
  showTitle: true, title: 'AUROC by model (higher = better)', titleFontSize: 13, titleColor: INK, titleFontFace: FB,
  showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 11, dataLabelColor: INK, dataLabelFormatCode: '0.000',
  valAxisMinVal: 0.7, valAxisMaxVal: 0.8, valGridLine: { color: 'E5E5E5', size: 1 },
  catGridLine: { style: 'none' }, showLegend: false,
  catAxisLabelColor: INK, valAxisLabelColor: GREY, catAxisLabelFontSize: 11, valAxisLabelFontSize: 10,
});
// metrics table (right)
const rows2 = [
  [{ text: 'Model', options: { bold: true, color: WHITE, fill: BLUE } }, { text: 'AUROC', options: { bold: true, color: WHITE, fill: BLUE } }, { text: 'F1', options: { bold: true, color: WHITE, fill: BLUE } }, { text: 'Acc', options: { bold: true, color: WHITE, fill: BLUE } }],
  ['Logistic Reg. ✓', String(mr['Logistic Regression'].AUROC), String(mr['Logistic Regression'].F1), String(mr['Logistic Regression'].Accuracy)],
  ['Gradient Boost', String(mr['Gradient Boosting'].AUROC), String(mr['Gradient Boosting'].F1), String(mr['Gradient Boosting'].Accuracy)],
  ['Random Forest', String(mr['Random Forest'].AUROC), String(mr['Random Forest'].F1), String(mr['Random Forest'].Accuracy)],
];
s.addTable(rows2, { x: 7.1, y: 2.1, w: 5.6, colW: [2.6, 1.05, 1.0, 0.95], rowH: 0.5,
  fontFace: FB, fontSize: 12, color: INK, align: 'center', valign: 'middle',
  border: { type: 'solid', color: MIST, pt: 1 }, fill: { color: WHITE } });
s.addText('Why F1 / AUROC over Accuracy?', { x: 7.1, y: 4.55, w: 5.6, h: 0.35, fontFace: FB, fontSize: 14, bold: true, color: BLUE, margin: 0 });
s.addText([
  { text: '• Errors are not equally costly — a miss hurts the loss ratio far more.\n', options: {} },
  { text: '• AUROC is threshold-free, so we can pick the operating point by business cost.', options: {} },
], { x: 7.1, y: 4.95, w: 5.6, h: 1.2, fontFace: FB, fontSize: 12.5, color: INK, lineSpacing: 18, margin: 0 });
s.addShape('roundRect', { x: 0.6, y: 5.7, w: 6.2, h: 0.85, rectRadius: 0.06, fill: { color: LIGHT }, line: { color: MIST, width: 1 } });
s.addText([{ text: 'Explainability:  ', options: { bold: true, color: GREEN } },
  { text: 'each coefficient is an odds ratio an underwriter can read — auditable for regulators.', options: { color: INK } }],
  { x: 0.8, y: 5.8, w: 5.85, h: 0.7, fontFace: FB, fontSize: 12, valign: 'middle', lineSpacing: 16, margin: 0 });
footer(s, 8);
s.addNotes('Key point: Logistic Regression is both the most accurate AND the most explainable here, so complexity is not justified. Explainability pros/cons live in the doc.');

// ===================================================================
// SLIDE 9 — Feature importance / drivers
// ===================================================================
s = pres.addSlide(); s.background = { color: LIGHT };
kicker(s, 'Q4 · Business insight', 0.6, 0.5);
title(s, 'What moves the prediction — in plain odds', 0.6, 0.85, 12);
s.addImage({ path: 'assets/q4_feature_importance.png', x: 0.6, y: 2.0, w: 6.6, h: 3.35 });
// odds ratio callouts
function orCard(y, feat, or, note, color) {
  s.addShape('roundRect', { x: 7.5, y, w: 5.25, h: 0.95, rectRadius: 0.06, fill: { color: WHITE }, line: { color: MIST, width: 1 } });
  s.addText(`×${or}`, { x: 7.65, y: y + 0.02, w: 1.3, h: 0.9, align: 'center', valign: 'middle', fontFace: FH, fontSize: 26, bold: true, color, margin: 0 });
  s.addText([{ text: feat + '\n', options: { bold: true, color: INK, fontSize: 14 } },
    { text: note, options: { color: GREY, fontSize: 11.5 } }],
    { x: 9.0, y: y + 0.02, w: 3.6, h: 0.9, valign: 'middle', fontFace: FB, lineSpacing: 15, margin: 0 });
}
orCard(2.1, 'age', S.odds_ratios.age, 'per +1 SD, odds of high-risk ~triple', BLUE);
orCard(3.2, 'health_score', S.odds_ratios.health_score, 'protective — higher score lowers risk', GREEN);
orCard(4.3, 'has_chronic_disease', S.odds_ratios.has_chronic_disease, 'a smaller upward push', RED);
s.addText('Odds ratios come straight from the model coefficients — this is the explainability underwriters and regulators need.',
  { x: 7.5, y: 5.45, w: 5.25, h: 0.7, fontFace: FB, fontSize: 12, italic: true, color: GREY, lineSpacing: 16, margin: 0 });
footer(s, 9);
s.addNotes('Top drivers: age, then health_score, then chronic disease. Express as odds ratios so the business can act.');

// ===================================================================
// SLIDE 10 — Threshold economics
// ===================================================================
s = pres.addSlide(); s.background = { color: WHITE };
kicker(s, 'Q4 · The business lever', 0.6, 0.5);
title(s, 'Should we raise or lower the threshold? Lower it.', 0.6, 0.85, 12.2);
s.addImage({ path: 'assets/q4_threshold_economics.png', x: 0.6, y: 2.0, w: 7.0, h: 3.35 });
row(s, 7.9, 2.15, 4.9, 'A miss ≫ an over-flag', 'Approving a truly high-risk customer at standard price inflates future claims.', RED);
row(s, 7.9, 3.15, 4.9, 'Lower the threshold', 'Cast a wider net so fewer risky customers slip through to standard pricing.', GREEN);
row(s, 7.9, 4.15, 4.9, 'Cost-driven optimum', `At a 10:1 miss-to-over-flag cost, the loss-minimising threshold falls to ≈ ${S.cost_optimal_threshold}.`, BLUE);
s.addShape('roundRect', { x: 7.9, y: 5.15, w: 4.9, h: 1.15, rectRadius: 0.08, fill: { color: NAVY }, line: { type: 'none' } });
s.addText([{ text: 'In the app,  ', options: { bold: true, color: GREEN } },
  { text: 'managers set the cost ratio with a slider and watch the optimal threshold move in real time.', options: { color: WHITE } }],
  { x: 8.1, y: 5.28, w: 4.5, h: 0.95, fontFace: FB, fontSize: 12.5, valign: 'middle', lineSpacing: 17, margin: 0 });
footer(s, 10);
s.addNotes('The exact threshold is a business decision, not a statistical constant. Tie it to the loss-ratio target.');

// ===================================================================
// SLIDE 11 — The app (anatomy / usability)
// ===================================================================
s = pres.addSlide(); s.background = { color: LIGHT };
kicker(s, 'From model to product', 0.6, 0.5);
title(s, 'A self-serve app for non-technical underwriters', 0.6, 0.85, 12);
const tabs = [
  ['🎯', 'Predict a customer', 'Move sliders → instant risk score, gauge, and plain-English reason.', BLUE],
  ['📊', 'Portfolio explorer', 'Filter 60k customers by age & health band; see high-risk rates live.', GREEN],
  ['💰', 'Threshold economics', 'Set miss/over-flag costs; find the loss-minimising threshold.', RED],
  ['📈', 'The data story', 'The EDA charts with one-line takeaways for any audience.', NAVY],
  ['🤖', 'AI assistant', 'Ask questions in natural language — answers grounded in real numbers.', BLUE],
];
let ty = 2.05;
tabs.forEach((tb) => {
  s.addShape('roundRect', { x: 0.6, y: ty, w: 7.6, h: 0.86, rectRadius: 0.06, fill: { color: WHITE }, line: { color: MIST, width: 1 } });
  s.addShape('ellipse', { x: 0.78, y: ty + 0.18, w: 0.5, h: 0.5, fill: { color: tb[3] }, line: { type: 'none' } });
  s.addText(tb[0], { x: 0.78, y: ty + 0.18, w: 0.5, h: 0.5, align: 'center', valign: 'middle', fontSize: 16, margin: 0 });
  s.addText([{ text: tb[1] + '   ', options: { bold: true, color: INK, fontSize: 14 } },
    { text: tb[2], options: { color: GREY, fontSize: 11.5 } }],
    { x: 1.45, y: ty, w: 6.65, h: 0.86, valign: 'middle', fontFace: FB, lineSpacing: 15, margin: 0 });
  ty += 0.96;
});
// right highlight panel
s.addShape('roundRect', { x: 8.5, y: 2.05, w: 4.25, h: 4.55, rectRadius: 0.1, fill: { color: NAVY }, line: { type: 'none' } });
s.addText('WHY IT MATTERS', { x: 8.8, y: 2.3, w: 3.7, h: 0.3, fontFace: FB, fontSize: 11, bold: true, color: GREEN, charSpacing: 1.5, margin: 0 });
s.addText('The model leaves the notebook', { x: 8.8, y: 2.65, w: 3.7, h: 0.8, fontFace: FH, fontSize: 22, bold: true, color: WHITE, lineSpacing: 24, margin: 0 });
s.addText([
  { text: '✓  Deployable free on Streamlit Cloud\n\n', options: {} },
  { text: '✓  Dynamic sliders — no code to explore\n\n', options: {} },
  { text: '✓  Every score comes with a reason\n\n', options: {} },
  { text: '✓  Owned by the whole team, not just DS', options: {} },
], { x: 8.8, y: 3.7, w: 3.7, h: 2.7, fontFace: FB, fontSize: 13.5, color: 'D6E4F0', lineSpacing: 18, margin: 0 });
footer(s, 11);
s.addNotes('This is the "usable by non-tech people" requirement, delivered. Demo the app live here if possible.');

// ===================================================================
// SLIDE 12 — GenAI layer
// ===================================================================
s = pres.addSlide(); s.background = { color: WHITE };
kicker(s, 'The optimization: GenAI', 0.6, 0.5, GREEN);
title(s, 'ML score + LLM = trusted, conversational underwriting', 0.6, 0.85, 12.4);
// two capability cards
s.addShape('roundRect', { x: 0.6, y: 2.1, w: 5.9, h: 3.0, rectRadius: 0.1, fill: { color: LIGHT }, line: { color: MIST, width: 1 } });
s.addText('①  Decision narrator', { x: 0.9, y: 2.35, w: 5.3, h: 0.5, fontFace: FH, fontSize: 20, bold: true, color: BLUE, margin: 0 });
s.addText('Turns the risk score + drivers into a plain-English explanation an underwriter can trust: “High-risk (72%), driven mainly by age 78 and a low health score of 41…”',
  { x: 0.9, y: 2.95, w: 5.3, h: 1.4, fontFace: FB, fontSize: 13.5, color: INK, lineSpacing: 20, margin: 0 });
s.addText('Directly reinforces the explainability theme.', { x: 0.9, y: 4.55, w: 5.3, h: 0.4, fontFace: FB, fontSize: 12, italic: true, color: GREEN, margin: 0 });
s.addShape('roundRect', { x: 6.85, y: 2.1, w: 5.9, h: 3.0, rectRadius: 0.1, fill: { color: LIGHT }, line: { color: MIST, width: 1 } });
s.addText('②  Underwriting chatbot', { x: 7.15, y: 2.35, w: 5.3, h: 0.5, fontFace: FH, fontSize: 20, bold: true, color: GREEN, margin: 0 });
s.addText('Managers ask in natural language — “high-risk rate for customers over 60?” — and get an instant answer. Numbers are computed in Python first, then phrased by the LLM.',
  { x: 7.15, y: 2.95, w: 5.3, h: 1.4, fontFace: FB, fontSize: 13.5, color: INK, lineSpacing: 20, margin: 0 });
s.addText('No hallucinated statistics — a responsible-AI pattern.', { x: 7.15, y: 4.55, w: 5.3, h: 0.4, fontFace: FB, fontSize: 12, italic: true, color: GREEN, margin: 0 });
// bottom band
s.addShape('roundRect', { x: 0.6, y: 5.35, w: 12.15, h: 1.15, rectRadius: 0.08, fill: { color: NAVY }, line: { type: 'none' } });
s.addText([{ text: 'Grounded by design:  ', options: { bold: true, color: GREEN } },
  { text: 'the LLM only verbalizes numbers the model and data produce. Free to run (Groq), and it degrades gracefully to exact template text if the AI is offline — so a live demo never breaks.', options: { color: WHITE } }],
  { x: 0.9, y: 5.5, w: 11.6, h: 0.85, fontFace: FB, fontSize: 13, valign: 'middle', lineSpacing: 18, margin: 0 });
footer(s, 12);
s.addNotes('The GenAI layer is the optimization the interviewer asked about. Emphasize grounding: LLM phrases, Python computes. This is how you get GenAI value without hallucination risk in a regulated setting.');

// ===================================================================
// SLIDE 13 — Recommendations & roadmap
// ===================================================================
s = pres.addSlide(); s.background = { color: LIGHT };
kicker(s, 'Recommendations', 0.6, 0.5);
title(s, 'What we recommend MetLife do next', 0.6, 0.85, 12);
const recs = [
  ['Adopt', 'Ship the explainable Logistic Regression as the production scorer; keep gradient boosting as a challenger.', BLUE],
  ['Tune', 'Operate below a 0.50 threshold, calibrated to the current loss-ratio target; review quarterly.', GREEN],
  ['Focus', 'Direct underwriting scrutiny to older / lower-health segments; de-emphasise income & BMI (no signal).', RED],
  ['Enable', 'Roll out the app + GenAI assistant to underwriting teams as day-to-day decision support.', NAVY],
];
let ry = 2.1;
recs.forEach((r, i) => {
  s.addShape('roundRect', { x: 0.6, y: ry, w: 12.15, h: 1.0, rectRadius: 0.07, fill: { color: WHITE }, line: { color: MIST, width: 1 },
    shadow: { type: 'outer', color: 'AAB7C4', blur: 4, offset: 2, angle: 90, opacity: 0.25 } });
  s.addShape('roundRect', { x: 0.6, y: ry, w: 1.75, h: 1.0, rectRadius: 0.07, fill: { color: r[2] }, line: { type: 'none' } });
  s.addText(r[0], { x: 0.6, y: ry, w: 1.75, h: 1.0, align: 'center', valign: 'middle', fontFace: FH, fontSize: 20, bold: true, color: WHITE, margin: 0 });
  s.addText(r[1], { x: 2.6, y: ry, w: 9.9, h: 1.0, valign: 'middle', fontFace: FB, fontSize: 14, color: INK, lineSpacing: 19, margin: 0 });
  ry += 1.12;
});
footer(s, 13);
s.addNotes('Close the analysis with clear, prioritized actions in business language.');

// ===================================================================
// SLIDE 14 — Closing (dark)
// ===================================================================
s = pres.addSlide(); s.background = { color: NAVY };
s.addShape('ellipse', { x: -1.8, y: 4.2, w: 5.5, h: 5.5, fill: { color: BLUE, transparency: 84 }, line: { type: 'none' } });
s.addShape('ellipse', { x: 10.2, y: -1.8, w: 5.0, h: 5.0, fill: { color: GREEN, transparency: 84 }, line: { type: 'none' } });
s.addText('Thank you', { x: 0.9, y: 2.3, w: 10, h: 1.0, fontFace: FH, fontSize: 48, bold: true, color: WHITE, margin: 0 });
s.addText('Accurate where it counts · explainable by design · usable by everyone.',
  { x: 0.95, y: 3.5, w: 10.5, h: 0.6, fontFace: FB, fontSize: 18, color: 'CADCEC', margin: 0 });
s.addText([
  { text: `AUROC ${mr['Logistic Regression'].AUROC}`, options: { bold: true, color: GREEN } },
  { text: '   ·   Streamlit app + GenAI assistant   ·   fully reproducible', options: { color: 'CADCEC' } },
], { x: 0.95, y: 4.5, w: 11, h: 0.4, fontFace: FB, fontSize: 14, margin: 0 });
s.addText('Deliverables:  MetLife_Answers.docx  ·  this deck  ·  app.py + analysis.py',
  { x: 0.95, y: 6.4, w: 11, h: 0.4, fontFace: FB, fontSize: 12, italic: true, color: '8FA6B8', margin: 0 });

pres.writeFile({ fileName: 'MetLife_Insights_Deck.pptx' }).then((f) => console.log('Wrote', f));
