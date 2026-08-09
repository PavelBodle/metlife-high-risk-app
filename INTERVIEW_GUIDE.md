# MetLife Japan — Interview Guide & Technical Deep-Dive

Your complete companion for presenting this solution and answering **any** follow-up.
Read top-to-bottom once; then use the **Q&A Bank** (§12) and **Numbers to Memorize** (§13) as flashcards the night before.

---

## Table of contents
1. [The 60-second pitch](#1-the-60-second-pitch)
2. [The business problem & framing](#2-the-business-problem--framing)
3. [The data (and its two traps)](#3-the-data-and-its-two-traps)
4. [Answers to Q1–Q4](#4-answers-to-q1q4)
5. [Modeling decisions — the "why" behind every choice](#5-modeling-decisions--the-why-behind-every-choice)
6. [Explainability: how SHAP works here (the math)](#6-explainability-how-shap-works-here-the-math)
7. [Threshold & loss-ratio economics](#7-threshold--loss-ratio-economics)
8. [The GenAI layer (and why it's safe)](#8-the-genai-layer-and-why-its-safe)
9. [App architecture & data flow](#9-app-architecture--data-flow)
10. [Code walkthrough, file by file](#10-code-walkthrough-file-by-file)
11. [Core tech concepts cheat-sheet](#11-core-tech-concepts-cheat-sheet)
12. [Interview Q&A bank (40+ questions)](#12-interview-qa-bank)
13. [Numbers to memorize](#13-numbers-to-memorize)
14. [Weaknesses & "what I'd do next"](#14-weaknesses--what-id-do-next)
15. [Live demo script](#15-live-demo-script)

---

## 1. The 60-second pitch

> "I built a model that flags high-risk insurance customers from 60,000 records. The headline is that the **simplest model won**: a Logistic Regression hit **AUROC 0.78**, matching or beating Random Forest and Gradient Boosting — and it's fully explainable, which matters enormously in regulated insurance. Two features carry almost all the signal: **age** and **health score**. I then turned the model into a **self-serve Streamlit app** so a non-technical underwriter can score any customer, see *why* via SHAP, explore the whole portfolio, and tune the decision threshold by business cost. On top I added a **GenAI assistant** — grounded so it never invents numbers. The business takeaway is to operate **below** the default 0.50 threshold, because a missed high-risk customer damages the loss ratio far more than an over-cautious flag."

That paragraph hits: problem, method, result, explainability, product, GenAI, business action. Memorize the shape, not the words.

---

## 2. The business problem & framing

**Task:** predict `is_high_risk` (1 = high-risk) for insurance customers.

**Why it matters — the loss ratio.** Insurers live or die on the **loss ratio = claims paid ÷ premiums earned**. If a genuinely high-risk customer is approved at a standard price, their future claims inflate the numerator and erode margin. So the model is really a tool to **price risk correctly and protect the loss ratio**.

**Three success criteria I set:**
- **Accuracy** — rank customers by true risk so pricing matches exposure.
- **Explainability** — regulators, auditors and customers need a transparent reason for every decision (adverse-action requirements).
- **Usability** — underwriters, not just data scientists, must be able to use it. Hence the app + GenAI.

---

## 3. The data (and its two traps)

- **60,000 rows × 9 columns.** Features: `age`, `annual_income`, `health_score`, `has_chronic_disease`, `past_claims_amount`, `bmi`, `policy_type`; target `is_high_risk`; plus `customer_id`.
- **Missingness:** `annual_income` has **3,000 missing (5%)** — the *only* column with gaps.
- **Data-quality catch:** **100 rows had `age = 200`** — an impossible sentinel (the 99.9th percentile jumps from 89 to 200). I **capped age at 100**. Flagging this unprompted signals rigor.

**Trap 1 — income is NOT skewed.** The textbook answer to "mean vs median for imputation" is "median because skew." But `annual_income` skew is **0.037** — essentially symmetric — so mean (5009) ≈ median (5007). I still use the median (robust default), but the *honest* point is that the rule barely applies here. The genuinely skewed column is `past_claims_amount` (skew **2.0**).

**Trap 2 — the target is roughly balanced.** `is_high_risk` is **45.7%** positive — *not* the extreme imbalance these prompts usually imply. That changes how I talk about metrics (§5).

**The real signal:** only **age** (corr **+0.42**) and **health_score** (corr **−0.23**) relate to risk. `has_chronic_disease` is weak (+0.085); `annual_income`, `past_claims_amount`, `bmi` are ≈ **0** (noise). This strongly suggests a **synthetic dataset** where risk was generated mainly from age and health — worth saying out loud; it explains the ~0.78 AUROC ceiling (there's deliberate label noise).

---

## 4. Answers to Q1–Q4

### Q1 — Mean vs. median for `annual_income`?
**Median.** It's robust to outliers and skew. *But* measure first: skew = 0.037 → the distribution is symmetric, so mean ≈ median and the choice is nearly immaterial here. Contrast with `past_claims_amount` (skew 2.0), which *would* demand the median. **Visual:** histogram with mean/median lines overlapping.

### Q2 — Which test for `health_score` vs `is_high_risk`? Multicollinearity?
- **Test:** **Welch's two-sample t-test** (continuous feature vs binary group; Welch because variances aren't assumed equal). Result **t = 57**, **p < 0.001**, means **56.3 (low-risk) vs 43.1 (high-risk)** → strongly significant.
- For categoricals I used **Chi-square**: `has_chronic_disease` is significant (χ² = 431, p ≈ 1e-95); `policy_type` is **not** (χ² = 1.1, p = 0.57) — policy type carries no signal.
- **Multicollinearity:** correlation matrix + **VIF**. All predictor-predictor correlations ≈ 0 and **all VIFs ≈ 1.0** (a VIF > 5 flags a problem). **No multicollinearity**, so no feature was dropped. As a safeguard I still used L2-regularized Logistic Regression.

### Q3 — Why F1/AUROC over Accuracy? Explainability of the algorithm?
- The target is ~46% positive — nearly balanced, so accuracy is *less* misleading than usual, but I still lead with **AUROC** and **F1** because (a) the **business costs are asymmetric** — a false negative hurts the loss ratio far more than a false positive, and accuracy weights both equally; (b) **AUROC is threshold-independent**, so I can pick the operating point by cost rather than defaulting to 0.50.
- **Chosen algorithm — Logistic Regression. Explainability pros:** each coefficient is an **odds ratio** an underwriter/regulator can read; monotonic, auditable, easy to monitor for drift and fairness. **Cons:** assumes a log-odds-linear relationship, so it can't auto-capture complex interactions — those must be engineered. Here it's also the *most accurate*, so complexity isn't justified.

### Q4 — Top feature importances? Raise or lower the threshold?
- **Drivers (permutation importance & odds ratios):** `age` (OR ≈ **3.0** per +1 SD), `health_score` (OR ≈ **0.55**, protective), then `has_chronic_disease` (OR ≈ **1.24**). Income/BMI/claims ≈ no effect.
- **Threshold — lower it below 0.50.** Because a **missed high-risk customer** (false negative) is the expensive error, casting a wider net protects the loss ratio. With an illustrative **10:1** FN:FP cost, the loss-minimising threshold drops to ≈ **0.08**. The exact value is a *business* decision — which is why the app lets managers set the cost ratio and watch the optimum move.

---

## 5. Modeling decisions — the "why" behind every choice

**Preprocessing pipeline** (one scikit-learn `Pipeline`, so train/test use identical transforms and there's no leakage):
1. **Median imputation** of `annual_income` — robust; fit on train only (inside the pipeline).
2. **One-hot encode `policy_type` with `drop_first`** — three categories → two dummies. Dropping one avoids the **dummy-variable trap** (perfect collinearity with the intercept).
3. **StandardScaler** on numeric features — three reasons: (a) helps the lbfgs solver converge; (b) makes coefficients **comparable in magnitude** (so "age matters most" is meaningful); (c) it makes `coef × standardized_value` equal the **exact SHAP value** (see §6).
4. **Logistic Regression** — `max_iter=1000`, default **L2** penalty, `C=1.0`, `solver=lbfgs`. Intercept = **−0.2301** (the average customer's log-odds).

**Split:** stratified **80/20** train/test, `random_state=42` (reproducibility; stratify preserves the 46% positive rate in both sets).

**Model bake-off (held-out test set):**

| Model | AUROC | F1 | Accuracy | PR-AUC |
|---|---|---|---|---|
| **Logistic Regression ✓** | **0.780** | 0.674 | 0.711 | 0.738 |
| Gradient Boosting | 0.780 | 0.669 | 0.706 | 0.737 |
| Random Forest | 0.762 | 0.666 | 0.702 | 0.711 |

**Why LR wins the tie with GBM:** identical AUROC but LR is far more explainable, calibrated, and cheaper — so it's the responsible choice. Trees "spread" importance onto noise features (income/BMI/claims) because they can split on anything, which actually *hurts* generalization slightly here.

**Why not deep learning / XGBoost tuning?** Signal is essentially linear in log-odds; more capacity just fits noise. The AUROC ceiling (~0.78) is a property of the data, not the model — I verified three model families converge to the same number.

---

## 6. Explainability: how SHAP works here (the math)

**SHAP** (SHapley Additive exPlanations) attributes a prediction to each feature fairly, using game theory. General SHAP is expensive, but for a **linear model it's exact and free**:

For `f(x) = b₀ + Σ wᵢ·xᵢ`, the SHAP value of feature *i* is:

```
φᵢ = wᵢ · (xᵢ − E[xᵢ])
```

Because I apply **StandardScaler**, the transformed features have mean ≈ 0, so `E[xᵢ] ≈ 0` and:

```
φᵢ ≈ wᵢ · x_standardized,ᵢ      ← exactly what customer_drivers() computes
```

So the driver bars and the **SHAP waterfall** are the *true* SHAP values, not an approximation. The waterfall reads: **start at the base (intercept = the average customer's log-odds) → add each feature's φᵢ → arrive at this customer's log-odds → sigmoid → probability.** I verified numerically that `base + Σφᵢ → sigmoid` reproduces `predict_proba` to 9 decimals.

**Log-odds vs probability:** the waterfall x-axis is **log-odds** because that's the space where contributions are additive. Interpretation: **0 = 50/50; each +1 multiplies the odds by e¹ ≈ 2.7.** The gauge converts the final log-odds to a friendly %.

---

## 7. Threshold & loss-ratio economics

- The model outputs a **probability** `P(high_risk)`; the **threshold** turns it into a 0/1 decision. They are **separate** — same score, move the threshold, the label can flip.
- **Cost model in the app:** `total_cost = C_FN · (#false negatives) + C_FP · (#false positives)`. Default `C_FN:C_FP = 10:1`.
- Sweep the threshold 0.05→0.95, compute total cost at each, pick the **argmin**. At 10:1 that's ≈ **0.08** — aggressive, because misses are so costly.
- **Honest caveat you should volunteer:** 0.08 flags a large share of customers; it's *illustrative*. In production you'd calibrate `C_FN`, `C_FP` to real expected claim costs and acquisition/friction costs, and likely land higher. The **method** is the point — tie the threshold to the loss-ratio target, not to a statistics default.

---

## 8. The GenAI layer (and why it's safe)

Two capabilities, both in `llm_helper.py`, provider **Groq** running **Llama 3.3 70B** (free API):

1. **Decision narrator** — turns the risk score + SHAP drivers into a plain-English explanation for an underwriter.
2. **Underwriting chatbot** — natural-language Q&A over the portfolio.

**The critical design choice — grounding.** The LLM **only phrases numbers computed in Python**. For the chatbot, `compute_context()` calculates the real answer (e.g., "age 60–100: 24,917 customers, 67.5% high-risk") from pandas, then passes those facts to the LLM to phrase. The system prompt says "only use the numbers provided; never invent statistics." **Result: no hallucinated numbers** — essential in a regulated setting.

**Graceful fallback:** if no API key is set (or the call fails), every function returns clean template text with the exact numbers. So a live demo **never breaks**, and the app is useful with zero external dependencies. The key is read from `st.secrets["GROQ_API_KEY"]` or the `GROQ_API_KEY` env var — never hard-coded.

---

## 9. App architecture & data flow

```
insurance_test_data.csv ──┐
                          ├─► analysis.py ──► model.pkl (pipeline + metadata)
                          │                └─► assets/*.png + summary.json
                          │
app.py (Streamlit) ───────┤
   ├─ load_bundle()  @cache_resource ─ loads model.pkl once
   ├─ load_data()    @cache_data     ─ CSV, caps age
   ├─ scored_data()  @cache_data     ─ whole dataset scored once
   ├─ predict_one() / customer_drivers() / shap_waterfall_fig() / percentile_strip_fig()
   ├─ apply_customer() ─ writes a real customer into session_state
   └─ llm_helper.py ─ narrator + grounded chatbot (Groq / fallback)
```

**Caching rationale:**
- `@st.cache_resource` for the model — it's a single shared object (loaded once per server, not per user/rerun).
- `@st.cache_data` for dataframes and derived tables — Streamlit reruns the whole script on every widget change, so caching avoids re-reading the CSV and re-scoring 60k rows each time.

**Streamlit mental model (say this if asked how Streamlit works):** the *entire script re-executes top-to-bottom on every interaction*; widgets return their current value; `st.session_state` persists across reruns; caching prevents recomputation. That's why prefilling a slider from a customer requires writing `session_state` **before** the widget is created.

---

## 10. Code walkthrough, file by file

### `analysis.py` — the reproducible pipeline (run once)
- Loads data, **caps age**, records missingness and target balance.
- **Q1:** skew + mean/median, saves income histogram.
- **Q2:** Welch t-test, Chi-square, correlation heatmap, **VIF** (via `statsmodels.variance_inflation_factor`).
- **Q3:** builds the preprocessing `ColumnTransformer` + `Pipeline`, trains **LR / RF / GBM**, computes AUROC/F1/Accuracy/PR-AUC, ROC curves.
- **Q4:** odds ratios (from LR coefficients), **permutation importance** (model-agnostic, on test set), threshold-vs-cost curve, confusion matrix.
- **Persists** everything into `model.pkl` (a dict "bundle": the fitted pipeline, feature lists, metrics, medians, ranges, policy types, cost-optimal threshold) and `assets/summary.json`.

### `model.pkl` — the bundle
A `joblib` dict so the app needs *no* training code — just `predict`. Carrying metadata (ranges, medians) makes the app self-configuring (e.g., slider bounds come from the data).

### `llm_helper.py` — GenAI
- `llm_available()` — is a key + the `groq` SDK present?
- `_chat()` — one Groq call with the system prompt; returns `None`/error sentinel on failure.
- `explain_decision()` — narrator; **falls back** to a template using the top SHAP drivers.
- `compute_context()` — **the grounding step**: computes real portfolio stats for the question in pandas.
- `answer_question()` — passes those facts to the LLM to phrase; falls back to showing the computed facts directly.

### `app.py` — the product
- **Loaders + caching** (§9).
- `predict_one(profile)` — one row → probability.
- `customer_drivers(profile)` — per-customer **SHAP values** = `coef × standardized_x` (see §6).
- `gauge()` — Plotly radial gauge of the score with the threshold marker.
- `shap_waterfall_fig()` — Plotly `Waterfall`: base (intercept) → top-5 φᵢ → "Other" → final log-odds total.
- `percentile_strip_fig()` — histogram of all 60k scores with this customer's marker + percentile.
- `apply_customer(cid)` — loads a real customer's features into `session_state` (with a `_pending_cid` trick so the ID box updates on "Random").
- **5 tabs:** Predict (gauge, SHAP bars, AI explanation, and a collapsed "Advanced view" with the waterfall + percentile strip); Portfolio explorer (dynamic age/health filters, live rates, top-15 table); Threshold economics (cost sliders, cost-vs-threshold curve, FN/FP counts); Data story (EDA charts); AI assistant (grounded chatbot).

### `build_docx.js` / `build_pptx.js`
Node scripts (docx-js / pptxgenjs) that generate the Word answers doc and the PPTX deck from the same `assets/` + `summary.json`, so the written deliverables and the app never disagree on numbers.

---

## 11. Core tech concepts cheat-sheet

- **Logistic Regression:** models `log(p/(1−p)) = b₀ + Σwᵢxᵢ`; `sigmoid` maps log-odds→probability. Coefficients → **odds ratios** via `exp(w)`.
- **Odds ratio:** `exp(coef)`. OR = 3 means the odds of the positive class **triple** per +1 (here, per +1 standard deviation because features are scaled).
- **AUROC:** probability the model ranks a random positive above a random negative. 0.5 = random, 1.0 = perfect. **Threshold-free.**
- **PR-AUC:** area under precision-recall; more informative than AUROC under heavy imbalance.
- **F1:** harmonic mean of precision & recall; balances false positives and false negatives.
- **Precision** = TP/(TP+FP) ("of those flagged, how many were right"). **Recall** = TP/(TP+FN) ("of the truly risky, how many we caught").
- **StandardScaler:** `(x − mean)/std` → mean 0, std 1.
- **One-hot + drop_first:** categorical → binary columns, drop one to avoid collinearity with the intercept.
- **VIF:** variance inflation factor; how much a feature is explained by the others. ~1 = independent, >5 = concerning, >10 = severe.
- **Welch's t-test:** compares two group means without assuming equal variances.
- **Chi-square test:** independence between two categorical variables.
- **Permutation importance:** shuffle a feature, measure the drop in AUROC → model-agnostic importance.
- **SHAP:** fair per-feature attribution; **exact and closed-form for linear models** (§6).
- **Loss ratio:** claims paid ÷ premiums earned — the insurer's core profitability metric.

---

## 12. Interview Q&A bank

**Stats & data**
- *Why median not mean?* Robust to outliers/skew; though here income is symmetric (skew 0.04) so it barely matters — I verified rather than assumed.
- *How did you detect the age problem?* Profiling: the 99.9th percentile jumped 89→200, and exactly 100 rows sat at 200 — a sentinel. Capped at 100.
- *Why Welch and not Student's t-test?* Welch doesn't assume equal variances between the risk groups — safer default.
- *How did you handle multicollinearity?* Checked correlations + VIF (all ≈ 1) — none present, so nothing to drop; L2 as a safeguard anyway.
- *Is the data real?* Almost certainly synthetic — only age & health drive risk, everything else is ~0 correlation, and three model families cap at ~0.78 AUROC, implying designed label noise.

**Modeling**
- *Why Logistic Regression over XGBoost?* Same AUROC, far more explainable and calibrated, cheaper, monotonic. On this near-linear signal, extra capacity fits noise.
- *Did you tune hyperparameters?* LR is low-variance; I used L2 with default C. I could grid-search C, but the bake-off showed the ceiling is data-bound, not model-bound.
- *How do you know it's not overfitting?* Small train/test gap, regularization, and simple hypothesis class; AUROC on held-out data is 0.78.
- *Class imbalance?* It's 46/54 — near balanced, so no resampling needed. If it were skewed I'd use `class_weight='balanced'`, PR-AUC, and threshold tuning.
- *Is the model calibrated?* LR is naturally well-calibrated; I could add a reliability curve / Platt / isotonic if downstream pricing needs true probabilities. (Good "next step.")
- *Data leakage?* None — all features are applicant attributes known at underwriting; the pipeline fits transforms on train only.
- *Why StandardScaler if trees don't need it?* Only the LR needs it (convergence + comparable coefficients + exact SHAP). The pipeline scales only for the model that benefits.

**Metrics & threshold**
- *Why not just accuracy?* Asymmetric error costs and threshold-dependence. A model that predicts "not high-risk" for everyone would still get 54% accuracy but be useless.
- *Raise or lower the threshold?* Lower — misses (FNs) hurt the loss ratio ~10× more than over-flags. Cost-optimal ≈ 0.08 at 10:1; tune to real costs.
- *Isn't 0.08 flagging everyone?* It's illustrative at an extreme cost ratio; production would calibrate the ratio and likely land higher. The app makes it a business dial.

**Explainability / SHAP**
- *Are those really SHAP values?* Yes — for a linear model SHAP is exact: `φᵢ = wᵢ(xᵢ−E[xᵢ])`, and with scaling `E[xᵢ]≈0`, so `φᵢ = wᵢ·x_std`. I verified base+Σφ reproduces the probability exactly.
- *Why log-odds on the waterfall?* That's where contributions are additive; I convert the final value to % in the gauge and add a legend for lay audiences.
- *SHAP vs feature importance?* Permutation importance is global (whole model); SHAP is local (this customer). I show both.

**GenAI**
- *How do you stop the LLM hallucinating numbers?* It never computes — pandas does. The LLM only phrases pre-computed facts; the system prompt forbids inventing statistics; and there's a deterministic fallback.
- *Why Groq/Llama?* Free, fast, good enough for phrasing. Provider-agnostic — swappable. The value is the grounding pattern, not the specific model.
- *What if the API is down?* The app degrades to exact template text — no crash, numbers intact.
- *Is sending data to an LLM a privacy risk?* I send only aggregate stats / a single hypothetical profile, never bulk PII; in production you'd use a private/enterprise endpoint and a data-processing agreement.

**Engineering / product**
- *How does Streamlit work?* Whole script reruns per interaction; `session_state` persists; caching avoids recompute. (§9)
- *Why cache_resource vs cache_data?* Resource for the single model object; data for dataframes/derived tables.
- *How does "load a real customer" work?* Write the customer's values into `session_state` before the sliders are instantiated, so they render with those values; "Random" uses a `_pending_cid` + `st.rerun()` to also update the ID box.
- *How would you deploy?* Public GitHub → Streamlit Cloud → `app.py`; key in Secrets. For production: containerize, add auth, monitoring, model registry, and a retraining pipeline.

**Business / ethics**
- *What's the business value?* Correctly priced risk protects the loss ratio; the app puts that power in underwriters' hands and cuts turnaround.
- *Fairness concerns?* Age is a strong driver — in real underwriting, age/health use is regulated and must pass fairness and legal review. The model is a **screening aid with a human in the loop**, not an auto-decline engine.
- *What would you monitor in production?* Data drift, score distribution shift, calibration, approval rates by segment, and realized loss ratio vs predicted.

---

## 13. Numbers to memorize

| Fact | Value |
|---|---|
| Rows / features | 60,000 / 8 predictors |
| Missing income | 3,000 (5%) → median imputed |
| Age sentinel fixed | 100 rows at age 200 → capped to 100 |
| Target positive rate | **45.7%** (near balanced) |
| Income skew | **0.037** (symmetric); claims skew 2.0 |
| Health t-test | Welch **t=57, p<0.001**, means 56.3 vs 43.1 |
| Chi-square | chronic χ²=431 (sig); policy_type χ²=1.1, p=0.57 (not sig) |
| Corr with target | age **+0.42**, health **−0.23**, chronic +0.09, rest ≈0 |
| VIF | all ≈ **1.0** (no multicollinearity) |
| **Best model** | Logistic Regression, **AUROC 0.780**, F1 0.674, Acc 0.711 |
| RF / GBM AUROC | 0.762 / 0.780 |
| Odds ratios | age **×3.0**, health **×0.55**, chronic ×1.24 (per +1 SD) |
| Intercept (base log-odds) | −0.23 |
| Cost-optimal threshold @10:1 | ≈ **0.08** |
| LLM | Llama 3.3 70B via Groq |

---

## 14. Weaknesses & "what I'd do next"

Volunteering these shows maturity:
- **Calibration curve** — verify predicted 70% ≈ real 70%; add isotonic if pricing needs it.
- **Cross-validation** — I used a single stratified split; k-fold would tighten the AUROC estimate.
- **Cost ratio is assumed** — in production, derive `C_FN`, `C_FP` from actual claim and acquisition costs.
- **Fairness audit** — formal bias testing on age/health-driven decisions before any real use.
- **Feature engineering** — age buckets or age×health interactions could add a little signal, though the data looks close to a linear ceiling.
- **MLOps** — model registry, automated retraining, drift monitoring, and A/B testing the threshold.
- **Real SHAP library** — I use the exact closed-form for the linear model; swapping in `shap`'s `LinearExplainer` (or `TreeExplainer` if we adopt a tree) would generalize the code if the model changes.

---

## 15. Live demo script

1. **Header + stats row** — "60k customers, AUROC 0.78, ~1 ms inference, SHAP explainability, Llama 3.3 assistant."
2. **Predict tab** — drag age up / health down → gauge climbs; open **Advanced view** → SHAP waterfall (base → age pushes up → health pushes down → final) and the percentile strip ("riskier than X%").
3. **Load a real customer** — hit **🎲 Random** → the whole tab updates for a real record; "now a what-if — drop health 10 points."
4. **Threshold economics** — slide the FN:FP cost → watch the optimal threshold move; "this is the loss-ratio lever."
5. **Portfolio explorer** — filter age 60–100 → "high-risk rate jumps to ~67%."
6. **AI assistant** — ask "compare risk across policy types" → grounded answer; open the **Source** dropdown to show it's computed, not hallucinated.
7. **Close:** "Explainable where it counts, and usable by the whole underwriting team."

---

*Prepared as a personal study companion for the MetLife Japan Sr Data Scientist interview.*
