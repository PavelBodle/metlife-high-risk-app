"""
MetLife Japan - High-Risk Customer Prediction
==============================================
Reproducible analysis pipeline.

Produces:
  - All statistical answers (Q1-Q4) printed to stdout and saved to assets/summary.json
  - All figures saved as PNG to assets/
  - Trained model + preprocessing saved to model.pkl (consumed by app.py)

Run:  .venv/bin/python analysis.py
"""
import json
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from statsmodels.stats.outliers_influence import variance_inflation_factor

warnings.filterwarnings("ignore")

# ----------------------------------------------------------------------------
# Config & house style
# ----------------------------------------------------------------------------
RANDOM_STATE = 42
DATA_PATH = "insurance_test_data.csv"
ASSETS = Path("assets")
ASSETS.mkdir(exist_ok=True)

# MetLife-ish palette (green + deep blue) for a polished, on-brand look
C_PRIMARY = "#0090DA"   # MetLife blue
C_ACCENT = "#00A758"    # green
C_RISK = "#E4002B"      # red for high-risk
C_SAFE = "#0090DA"
C_GREY = "#5B6770"
sns.set_theme(style="whitegrid", palette=[C_PRIMARY, C_RISK, C_ACCENT])
plt.rcParams.update({
    "figure.dpi": 120,
    "savefig.dpi": 130,
    "font.size": 11,
    "axes.titlesize": 13,
    "axes.titleweight": "bold",
    "axes.edgecolor": "#CCCCCC",
})

NUM_FEATURES = ["age", "annual_income", "health_score",
                "has_chronic_disease", "past_claims_amount", "bmi"]
CAT_FEATURES = ["policy_type"]
FEATURES = NUM_FEATURES + CAT_FEATURES
TARGET = "is_high_risk"

summary = {}


def savefig(fig, name):
    path = ASSETS / name
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"  saved {path}")


# ----------------------------------------------------------------------------
# 0. Load & profile
# ----------------------------------------------------------------------------
print("\n[0] Loading data ...")
df = pd.read_csv(DATA_PATH)
print(f"  shape = {df.shape}")

# --- Data-quality fix: 100 records carry age=200, an impossible sentinel value
# (the 99.9th percentile jumps from 89 to 200). Cap age at a realistic 100.
n_age_outliers = int((df["age"] > 100).sum())
df["age"] = df["age"].clip(upper=100)
summary["age_outliers_capped"] = n_age_outliers
print(f"  capped {n_age_outliers} implausible age values (>100) to 100")

missing = df.isna().sum()
summary["n_rows"], summary["n_cols"] = int(df.shape[0]), int(df.shape[1])
summary["missing"] = {k: int(v) for k, v in missing[missing > 0].items()}

target_balance = df[TARGET].value_counts(normalize=True).sort_index()
summary["target_pct_high_risk"] = round(float(target_balance.get(1, 0)) * 100, 2)
print(f"  high-risk share = {summary['target_pct_high_risk']}%")

# Target balance figure
fig, ax = plt.subplots(figsize=(5.5, 4))
counts = df[TARGET].value_counts().sort_index()
bars = ax.bar(["Low risk (0)", "High risk (1)"], counts.values,
              color=[C_SAFE, C_RISK])
for b, v in zip(bars, counts.values):
    ax.text(b.get_x() + b.get_width() / 2, v, f"{v:,}\n({v/len(df)*100:.1f}%)",
            ha="center", va="bottom", fontweight="bold")
ax.set_title("Target balance - is_high_risk")
ax.set_ylabel("Customers")
ax.margins(y=0.15)
savefig(fig, "target_balance.png")


# ----------------------------------------------------------------------------
# Q1. Missing values in annual_income - mean vs median (skewness)
# ----------------------------------------------------------------------------
print("\n[Q1] annual_income distribution & imputation ...")
inc = df["annual_income"].dropna()
skew = float(inc.skew())
mean_v, median_v = float(inc.mean()), float(inc.median())
summary["income_skew"] = round(skew, 3)
summary["income_mean"] = round(mean_v, 1)
summary["income_median"] = round(median_v, 1)
summary["claims_skew"] = round(float(df["past_claims_amount"].skew()), 3)
print(f"  skew={skew:.3f}  mean={mean_v:.1f}  median={median_v:.1f}")

fig, axes = plt.subplots(1, 2, figsize=(11, 4.2))
axes[0].hist(inc, bins=60, color=C_PRIMARY, alpha=0.85, edgecolor="white")
axes[0].axvline(mean_v, color=C_RISK, ls="--", lw=2, label=f"Mean = {mean_v:,.0f}")
axes[0].axvline(median_v, color=C_ACCENT, ls="-", lw=2, label=f"Median = {median_v:,.0f}")
axes[0].set_title(f"annual_income - near-symmetric (skew = {skew:.2f})")
axes[0].set_xlabel("annual_income")
axes[0].legend()
# contrast: a genuinely skewed column
axes[1].hist(df["past_claims_amount"].dropna(), bins=60, color=C_GREY,
             alpha=0.85, edgecolor="white")
axes[1].set_title(f"past_claims_amount - right-skewed (skew = {summary['claims_skew']:.2f})")
axes[1].set_xlabel("past_claims_amount")
savefig(fig, "q1_income_distribution.png")


# ----------------------------------------------------------------------------
# Q2. Hypothesis testing & multicollinearity
# ----------------------------------------------------------------------------
print("\n[Q2] Hypothesis tests & multicollinearity ...")
# Welch t-test: health_score across risk groups
h0 = df.loc[df[TARGET] == 0, "health_score"].dropna()
h1 = df.loc[df[TARGET] == 1, "health_score"].dropna()
t_stat, t_p = stats.ttest_ind(h0, h1, equal_var=False)
summary["health_ttest"] = {"t": round(float(t_stat), 2), "p": float(t_p),
                            "mean_low": round(float(h0.mean()), 2),
                            "mean_high": round(float(h1.mean()), 2)}
print(f"  Welch t-test health_score: t={t_stat:.2f}  p={t_p:.2e}")

# Chi-square: policy_type & has_chronic_disease vs target
chi_results = {}
for col in ["policy_type", "has_chronic_disease"]:
    ct = pd.crosstab(df[col], df[TARGET])
    chi2, p, dof, _ = stats.chi2_contingency(ct)
    chi_results[col] = {"chi2": round(float(chi2), 2), "p": float(p)}
    print(f"  Chi-square {col}: chi2={chi2:.2f}  p={p:.2e}")
summary["chi_square"] = chi_results

# health_score by risk - box + violin
fig, ax = plt.subplots(figsize=(6, 4.4))
sns.violinplot(data=df, x=TARGET, y="health_score",
               hue=TARGET, palette=[C_SAFE, C_RISK], legend=False, ax=ax, cut=0)
ax.set_xticklabels(["Low risk", "High risk"])
ax.set_title(f"health_score by risk group  (t={t_stat:.0f}, p<0.001)")
ax.set_xlabel("")
savefig(fig, "q2_healthscore_by_risk.png")

# Correlation heatmap
corr = df[NUM_FEATURES + [TARGET]].corr()
summary["corr_with_target"] = {k: round(float(v), 3)
                               for k, v in corr[TARGET].items() if k != TARGET}
fig, ax = plt.subplots(figsize=(7.5, 6))
sns.heatmap(corr, annot=True, fmt=".2f", cmap="RdBu_r", center=0,
            vmin=-1, vmax=1, square=True, cbar_kws={"shrink": 0.8}, ax=ax)
ax.set_title("Correlation matrix (numeric features + target)")
savefig(fig, "q2_correlation_heatmap.png")

# VIF (multicollinearity) on numeric predictors
vif_df = df[NUM_FEATURES].dropna().copy()
vif_df = (vif_df - vif_df.mean()) / vif_df.std()  # standardize
vif_df["_const"] = 1.0
vif_vals = {}
for i, col in enumerate(NUM_FEATURES):
    vif_vals[col] = round(float(variance_inflation_factor(vif_df.values, i)), 2)
summary["vif"] = vif_vals
print(f"  VIF: {vif_vals}")


# ----------------------------------------------------------------------------
# Q3. Model selection & performance
# ----------------------------------------------------------------------------
print("\n[Q3] Model bake-off ...")
X = df[FEATURES].copy()
y = df[TARGET].copy()
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y)


def build_pipeline(estimator, scale=True):
    num_steps = [("impute", SimpleImputer(strategy="median"))]
    if scale:
        num_steps.append(("scale", StandardScaler()))
    pre = ColumnTransformer([
        ("num", Pipeline(num_steps), NUM_FEATURES),
        ("cat", OneHotEncoder(drop="first", handle_unknown="ignore"), CAT_FEATURES),
    ])
    return Pipeline([("pre", pre), ("model", estimator)])


models = {
    "Logistic Regression": build_pipeline(
        LogisticRegression(max_iter=1000, random_state=RANDOM_STATE), scale=True),
    "Random Forest": build_pipeline(
        RandomForestClassifier(n_estimators=300, random_state=RANDOM_STATE,
                               n_jobs=-1), scale=False),
    "Gradient Boosting": build_pipeline(
        GradientBoostingClassifier(random_state=RANDOM_STATE), scale=False),
}

results = {}
roc_data = {}
for name, pipe in models.items():
    pipe.fit(X_train, y_train)
    proba = pipe.predict_proba(X_test)[:, 1]
    pred = (proba >= 0.5).astype(int)
    results[name] = {
        "AUROC": round(float(roc_auc_score(y_test, proba)), 4),
        "PR_AUC": round(float(average_precision_score(y_test, proba)), 4),
        "F1": round(float(f1_score(y_test, pred)), 4),
        "Accuracy": round(float(accuracy_score(y_test, pred)), 4),
    }
    fpr, tpr, _ = roc_curve(y_test, proba)
    roc_data[name] = (fpr, tpr, results[name]["AUROC"])
    print(f"  {name:22s} AUROC={results[name]['AUROC']}  "
          f"F1={results[name]['F1']}  Acc={results[name]['Accuracy']}")

summary["model_results"] = results
best_name = max(results, key=lambda k: results[k]["AUROC"])
summary["best_model"] = best_name
print(f"  --> best model: {best_name}")

# ROC curves
fig, ax = plt.subplots(figsize=(6.2, 5.2))
colors = {"Logistic Regression": C_ACCENT, "Random Forest": C_PRIMARY,
          "Gradient Boosting": C_GREY}
for name, (fpr, tpr, auc) in roc_data.items():
    ax.plot(fpr, tpr, lw=2.3, color=colors[name], label=f"{name} (AUROC={auc:.3f})")
ax.plot([0, 1], [0, 1], "k--", lw=1, alpha=0.5)
ax.set_xlabel("False Positive Rate")
ax.set_ylabel("True Positive Rate")
ax.set_title("ROC curves - model comparison")
ax.legend(loc="lower right")
savefig(fig, "q3_roc_curves.png")

# Metrics comparison bar chart
fig, ax = plt.subplots(figsize=(8, 4.6))
metrics = ["AUROC", "F1", "Accuracy"]
xpos = np.arange(len(metrics))
w = 0.25
for i, name in enumerate(models):
    vals = [results[name][m] for m in metrics]
    ax.bar(xpos + i * w, vals, w, label=name,
           color=colors[name])
    for xp, v in zip(xpos + i * w, vals):
        ax.text(xp, v, f"{v:.2f}", ha="center", va="bottom", fontsize=8)
ax.set_xticks(xpos + w)
ax.set_xticklabels(metrics)
ax.set_ylim(0, 1)
ax.set_title("Model performance comparison")
ax.legend()
savefig(fig, "q3_metrics_comparison.png")


# ----------------------------------------------------------------------------
# Q4. Business insights - drivers, threshold economics
# ----------------------------------------------------------------------------
print("\n[Q4] Business insights ...")
best_pipe = models[best_name]

# Feature names after preprocessing
ohe = best_pipe.named_steps["pre"].named_transformers_["cat"]
cat_names = list(ohe.get_feature_names_out(CAT_FEATURES))
feat_names = NUM_FEATURES + cat_names

# Coefficients / odds ratios if logistic; else feature_importances_
model = best_pipe.named_steps["model"]
if hasattr(model, "coef_"):
    coefs = model.coef_[0]
    odds = np.exp(coefs)
    imp_df = pd.DataFrame({"feature": feat_names, "coef": coefs,
                           "odds_ratio": odds})
    imp_df["abs"] = imp_df["coef"].abs()
    imp_df = imp_df.sort_values("abs", ascending=False)
    summary["odds_ratios"] = {r.feature: round(float(r.odds_ratio), 3)
                              for r in imp_df.itertuples()}
else:
    imp_df = pd.DataFrame({"feature": feat_names,
                           "importance": model.feature_importances_})
    imp_df = imp_df.sort_values("importance", ascending=False)

# Permutation importance (model-agnostic, robust) on test set
perm = permutation_importance(best_pipe, X_test, y_test, n_repeats=8,
                              random_state=RANDOM_STATE, scoring="roc_auc")
perm_df = pd.DataFrame({"feature": FEATURES,
                        "importance": perm.importances_mean}).sort_values(
    "importance", ascending=False)
summary["permutation_importance"] = {r.feature: round(float(r.importance), 4)
                                     for r in perm_df.itertuples()}
print(f"  top drivers: {list(perm_df.feature.head(3))}")

fig, ax = plt.subplots(figsize=(7, 4.6))
colors_bar = [C_RISK if v > 0 else C_GREY for v in perm_df["importance"]]
ax.barh(perm_df["feature"][::-1], perm_df["importance"][::-1], color=C_PRIMARY)
ax.set_title(f"Permutation importance - {best_name}\n(drop in AUROC when feature shuffled)")
ax.set_xlabel("Importance (Δ AUROC)")
savefig(fig, "q4_feature_importance.png")

# Threshold vs Loss-Ratio / cost economics
# Business model: FN (miss a high-risk customer) is far costlier than FP.
proba_best = best_pipe.predict_proba(X_test)[:, 1]
COST_FN = 10.0   # cost of underpricing a truly high-risk customer
COST_FP = 1.0    # cost of over-pricing / losing a low-risk customer
thresholds = np.linspace(0.05, 0.95, 91)
total_costs, fn_rates, fp_rates, f1s = [], [], [], []
for t in thresholds:
    pred = (proba_best >= t).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_test, pred).ravel()
    total_costs.append(COST_FN * fn + COST_FP * fp)
    fn_rates.append(fn / (fn + tp))
    fp_rates.append(fp / (fp + tn))
    f1s.append(f1_score(y_test, pred))
best_t = float(thresholds[int(np.argmin(total_costs))])
summary["cost_optimal_threshold"] = round(best_t, 3)
summary["cost_ratio_fn_fp"] = f"{COST_FN:.0f}:{COST_FP:.0f}"
print(f"  cost-optimal threshold (FN:FP={COST_FN:.0f}:{COST_FP:.0f}) = {best_t:.2f}")

fig, ax1 = plt.subplots(figsize=(7.5, 4.8))
ax1.plot(thresholds, total_costs, color=C_RISK, lw=2.5, label="Total business cost")
ax1.axvline(best_t, color=C_ACCENT, ls="--", lw=2,
            label=f"Cost-optimal = {best_t:.2f}")
ax1.axvline(0.5, color=C_GREY, ls=":", lw=1.5, label="Default = 0.50")
ax1.set_xlabel("Decision threshold")
ax1.set_ylabel("Total cost (FN×10 + FP×1)", color=C_RISK)
ax2 = ax1.twinx()
ax2.plot(thresholds, f1s, color=C_PRIMARY, lw=1.8, alpha=0.7, label="F1-score")
ax2.set_ylabel("F1-score", color=C_PRIMARY)
ax1.set_title("Threshold economics - managing the Loss Ratio")
ax1.legend(loc="upper center")
savefig(fig, "q4_threshold_economics.png")

# Confusion matrix at default threshold
pred_05 = (proba_best >= 0.5).astype(int)
cm = confusion_matrix(y_test, pred_05)
fig, ax = plt.subplots(figsize=(4.8, 4.2))
sns.heatmap(cm, annot=True, fmt=",d", cmap="Blues", cbar=False,
            xticklabels=["Pred Low", "Pred High"],
            yticklabels=["True Low", "True High"], ax=ax)
ax.set_title(f"Confusion matrix @ 0.50 - {best_name}")
savefig(fig, "q4_confusion_matrix.png")


# ----------------------------------------------------------------------------
# Persist model bundle + summary
# ----------------------------------------------------------------------------
print("\n[5] Persisting artifacts ...")
bundle = {
    "pipeline": best_pipe,
    "model_name": best_name,
    "features": FEATURES,
    "num_features": NUM_FEATURES,
    "cat_features": CAT_FEATURES,
    "metrics": results[best_name],
    "permutation_importance": summary["permutation_importance"],
    "cost_optimal_threshold": best_t,
    "feature_medians": {c: float(df[c].median()) for c in NUM_FEATURES},
    "policy_types": sorted(df["policy_type"].dropna().unique().tolist()),
    "feature_ranges": {c: [float(df[c].min()), float(df[c].max())]
                       for c in NUM_FEATURES},
}
joblib.dump(bundle, "model.pkl")
print("  saved model.pkl")

with open(ASSETS / "summary.json", "w") as f:
    json.dump(summary, f, indent=2)
print("  saved assets/summary.json")

print("\nDONE. Key numbers:")
print(json.dumps({k: summary[k] for k in
                  ["target_pct_high_risk", "income_skew", "best_model",
                   "model_results", "cost_optimal_threshold"]}, indent=2))
