"""
MetLife Japan - High-Risk Customer Intelligence
================================================
Self-serve Streamlit app for non-technical underwriters & managers.

Run locally:   streamlit run app.py
Deploy:        push to GitHub -> share.streamlit.io -> app.py
GenAI (optional): add GROQ_API_KEY in Streamlit Secrets. Works without it too.
"""
import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

import llm_helper as L

# ---------------------------------------------------------------------------
st.set_page_config(page_title="MetLife • High-Risk Intelligence",
                   page_icon="💹", layout="wide",
                   initial_sidebar_state="expanded")

PRIMARY = "#0090DA"   # MetLife blue
GREEN = "#00A758"
RISK = "#E4002B"
DATA_PATH = "insurance_test_data.csv"


# ---------------------------------------------------------------------------
# Loaders (cached)
# ---------------------------------------------------------------------------
@st.cache_resource
def load_bundle():
    return joblib.load("model.pkl")


@st.cache_data
def load_data():
    df = pd.read_csv(DATA_PATH)
    df["age"] = df["age"].clip(upper=100)  # cap sentinel age=200 values
    return df


@st.cache_data
def load_summary():
    p = Path("assets/summary.json")
    return json.loads(p.read_text()) if p.exists() else {}


@st.cache_data
def scored_data():
    """Return the full dataset with a model risk score attached (cached)."""
    df = load_data().copy()
    bundle = load_bundle()
    df["risk_score"] = bundle["pipeline"].predict_proba(df[bundle["features"]])[:, 1]
    return df


bundle = load_bundle()
pipe = bundle["pipeline"]
FEATURES = bundle["features"]
NUM_FEATURES = bundle["num_features"]
summary = load_summary()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def predict_one(profile: dict) -> float:
    row = pd.DataFrame([profile])[FEATURES]
    return float(pipe.predict_proba(row)[:, 1][0])


def customer_drivers(profile: dict):
    """Per-customer signed contributions for the logistic model:
    coef * standardized_value. Returns list of (feature, contribution)."""
    pre = pipe.named_steps["pre"]
    model = pipe.named_steps["model"]
    if not hasattr(model, "coef_"):
        return []
    row = pd.DataFrame([profile])[FEATURES]
    x = pre.transform(row)
    x = np.asarray(x).ravel()
    coefs = model.coef_[0]
    ohe = pre.named_transformers_["cat"]
    names = NUM_FEATURES + list(ohe.get_feature_names_out(bundle["cat_features"]))
    contribs = list(zip(names, (coefs * x).tolist()))
    contribs.sort(key=lambda t: abs(t[1]), reverse=True)
    return contribs


def gauge(prob, threshold):
    color = RISK if prob >= threshold else GREEN
    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=prob * 100,
        number={"suffix": "%", "font": {"size": 44}},
        gauge={
            "axis": {"range": [0, 100]},
            "bar": {"color": color},
            "steps": [
                {"range": [0, threshold * 100], "color": "#E8F5E9"},
                {"range": [threshold * 100, 100], "color": "#FDECEA"},
            ],
            "threshold": {"line": {"color": "black", "width": 3},
                          "value": threshold * 100},
        },
        title={"text": "Model risk score"},
    ))
    fig.update_layout(height=280, margin=dict(l=20, r=20, t=50, b=10))
    return fig


@st.cache_data(show_spinner=False)
def prediction_time_ms():
    """Measure average single-customer inference latency (warmed)."""
    prof = dict(age=45, annual_income=int(bundle["feature_medians"]["annual_income"]),
                health_score=60.0, has_chronic_disease=0, past_claims_amount=150,
                bmi=25.0, policy_type=bundle["policy_types"][0])
    row = pd.DataFrame([prof])[FEATURES]
    pipe.predict_proba(row)  # warm up
    t0 = time.perf_counter()
    for _ in range(100):
        pipe.predict_proba(row)
    return (time.perf_counter() - t0) / 100 * 1000


def shap_waterfall_fig(profile: dict):
    """SHAP-style waterfall in log-odds space for a single customer.
    For the linear model, contribution_i = coef_i * standardized_x_i are the
    exact SHAP values; the base value is the model intercept (the average
    customer's log-odds)."""
    model = pipe.named_steps["model"]
    if not hasattr(model, "coef_"):
        return None
    drivers = customer_drivers(profile)      # (feature, log-odds contribution)
    base = float(model.intercept_[0])
    top = drivers[:5]
    rest = drivers[5:]
    labels = ["Base\n(avg customer)"] + [f for f, _ in top]
    values = [base] + [c for _, c in top]
    measures = ["absolute"] + ["relative"] * len(top)
    if rest:
        labels.append("Other features")
        values.append(sum(c for _, c in rest))
        measures.append("relative")
    labels.append("Final\n(log-odds)")
    values.append(0)
    measures.append("total")

    fig = go.Figure(go.Waterfall(
        orientation="v", measure=measures, x=labels, y=values,
        connector={"line": {"color": "#B8C4CE"}},
        increasing={"marker": {"color": RISK}},     # pushes risk up
        decreasing={"marker": {"color": PRIMARY}},   # pushes risk down
        totals={"marker": {"color": "#12283A"}},
        textposition="outside",
        text=[f"{v:+.2f}" if m == "relative" else f"{v:.2f}"
              for v, m in zip(values, measures)],
    ))
    fig.update_layout(height=340, margin=dict(l=10, r=10, t=30, b=10),
                      yaxis_title="log-odds of high-risk", showlegend=False,
                      xaxis=dict(tickfont=dict(size=10)))
    return fig


def percentile_strip_fig(prob: float):
    """Where this customer's risk score sits among all 60k customers."""
    scores = scored_data()["risk_score"].values
    pct = float((scores < prob).mean() * 100)
    fig = go.Figure()
    fig.add_trace(go.Histogram(x=scores * 100, nbinsx=50,
                               marker_color="#CFE3F1", showlegend=False))
    fig.add_vline(x=prob * 100, line_color=RISK, line_width=3,
                  annotation_text=f"This customer · {prob:.0%}",
                  annotation_position="top", annotation_font_color=RISK)
    fig.update_layout(height=200, margin=dict(l=10, r=10, t=30, b=10),
                      xaxis_title="Risk score across all customers (%)",
                      yaxis_title="", bargap=0.02)
    return fig, pct


def _clip(v, lo, hi):
    return max(lo, min(hi, v))


def apply_customer(cid: int) -> bool:
    """Load a real customer's features into the applicant-profile widgets.
    Writes to session_state BEFORE the sliders are created, so they display
    that customer's values. Returns False if the id is not found."""
    df = load_data()
    m = df[df["customer_id"] == cid]
    if m.empty:
        return False
    r = m.iloc[0]
    inc = r["annual_income"]
    if pd.isna(inc):
        inc = bundle["feature_medians"]["annual_income"]
    ar = bundle["feature_ranges"]["age"]
    st.session_state["age"] = int(_clip(round(r["age"]), int(ar[0]), int(ar[1])))
    st.session_state["health_score"] = float(_clip(round(r["health_score"]), 0, 100))
    st.session_state["bmi"] = float(_clip(round(r["bmi"] * 2) / 2, 10.0, 50.0))
    st.session_state["annual_income"] = int(_clip(round(inc / 100) * 100, 0, 12000))
    st.session_state["past_claims_amount"] = int(_clip(round(r["past_claims_amount"] / 10) * 10, 0, 2000))
    st.session_state["policy_type"] = r["policy_type"]
    st.session_state["chronic"] = bool(r["has_chronic_disease"])
    st.session_state["_loaded_cid"] = int(cid)
    return True


# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
st.markdown(
    f"""<div style="background:linear-gradient(90deg,{PRIMARY},{GREEN});
         padding:20px 26px;border-radius:12px;margin-bottom:12px;">
         <h1 style="color:white;margin:0;font-size:30px;">❇️ High-Risk Customer Intelligence</h1>
         <p style="color:white;margin:6px 0 0;opacity:.95;font-size:15px;font-weight:600;">
         Predict • Explain • Decide with Confidence
         <span style="opacity:.75;font-weight:400;">&nbsp;|&nbsp;
         Explainable Machine Learning + GenAI Decision Assistant</span></p>
         <p style="color:white;margin:4px 0 0;opacity:.8;font-size:12.5px;">
         Developed by Pavel Bodle &nbsp;|&nbsp; Senior AI Engineer</p></div>""",
    unsafe_allow_html=True,
)

# ---- Key statistics row ----
_n = len(load_data())
_ms = prediction_time_ms()
_ptime = "<1 ms" if _ms < 1 else f"~{_ms:.0f} ms"
_stats = [
    ("📊", "Customers", f"{_n:,}", PRIMARY),
    ("🎯", "Model Accuracy", f"AUROC {bundle['metrics']['AUROC']:.2f}", GREEN),
    ("⚡", "Prediction Time", _ptime, PRIMARY),
    ("💡", "Explainability", "SHAP", GREEN),
    ("🦙", "AI Assistant", "Llama 3.3 70B", PRIMARY),
]
_scols = st.columns(5)
for _c, (_icon, _label, _val, _clr) in zip(_scols, _stats):
    _c.markdown(
        f"""<div style="background:#FFFFFF;border:1px solid #E7EFF5;border-radius:10px;
             padding:10px 12px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06);">
             <div style="font-size:20px;line-height:1;">{_icon}</div>
             <div style="font-size:11px;color:#5B6770;margin-top:4px;text-transform:uppercase;
                  letter-spacing:.4px;">{_label}</div>
             <div style="font-size:16px;font-weight:700;color:{_clr};margin-top:2px;">{_val}</div>
             </div>""",
        unsafe_allow_html=True,
    )
st.write("")

# ---------------------------------------------------------------------------
# Sidebar - dynamic controls
# ---------------------------------------------------------------------------
with st.sidebar:
    st.header("⚙️ Controls")

    st.caption(f"Model: **{bundle['model_name']}**  ·  "
               f"AUROC **{bundle['metrics']['AUROC']}**")

    threshold = st.slider(
        "Decision threshold", 0.05, 0.95, 0.50, 0.01,
        help="Above this score a customer is flagged HIGH-RISK. "
             "Lower it to catch more risky customers (fewer misses); "
             "raise it to flag fewer (less friction).")

    st.divider()
    st.subheader("👤 Applicant profile")

    # ---- Load a real customer (must run before the sliders below) ----
    # A pending random pick updates the ID box before it is instantiated.
    if "_pending_cid" in st.session_state:
        st.session_state["cid_input"] = st.session_state.pop("_pending_cid")
    with st.expander("🔎 Load a real customer", expanded=False):
        cid = st.number_input("Customer ID (1–60000)", min_value=1, max_value=60000,
                              value=1, step=1, key="cid_input")
        lc, rc = st.columns(2)
        if lc.button("📂 Load", use_container_width=True):
            if not apply_customer(int(cid)):
                st.warning("ID not found.")
        if rc.button("🎲 Random", use_container_width=True):
            rid = int(load_data()["customer_id"].sample(1).iloc[0])
            apply_customer(rid)
            st.session_state["_pending_cid"] = rid
            st.rerun()
        if st.session_state.get("_loaded_cid"):
            st.caption(f"Showing customer **#{st.session_state['_loaded_cid']}** "
                       "— tweak any slider to run a what-if.")

    rng = bundle["feature_ranges"]
    # Seed widget defaults once (so key-only widgets need no `value=`, which
    # keeps a customer-load from triggering Streamlit's value/state warning).
    for _k, _v in {"age": 45, "health_score": 60.0, "bmi": 25.0,
                   "annual_income": int(bundle["feature_medians"]["annual_income"]),
                   "past_claims_amount": 150,
                   "policy_type": bundle["policy_types"][0],
                   "chronic": False}.items():
        st.session_state.setdefault(_k, _v)

    age = st.slider("Age", int(rng["age"][0]), int(rng["age"][1]), key="age")
    health_score = st.slider("Health score (0–100)", 0.0, 100.0, step=1.0, key="health_score")
    bmi = st.slider("BMI", 10.0, 50.0, step=0.5, key="bmi")
    annual_income = st.slider("Annual income", 0, 12000, step=100, key="annual_income")
    past_claims_amount = st.slider("Past claims amount", 0, 2000, step=10,
                                   key="past_claims_amount")
    policy_type = st.selectbox("Policy type", bundle["policy_types"], key="policy_type")
    has_chronic_disease = 1 if st.toggle("Has chronic disease", key="chronic") else 0

    profile = dict(age=age, annual_income=annual_income, health_score=health_score,
                   has_chronic_disease=has_chronic_disease,
                   past_claims_amount=past_claims_amount, bmi=bmi,
                   policy_type=policy_type)

    st.divider()
    st.subheader("📊 Portfolio filter")
    age_range = st.slider("Age range", int(rng["age"][0]), int(rng["age"][1]),
                          (int(rng["age"][0]), int(rng["age"][1])))
    hs_range = st.slider("Health-score range", 0.0, 100.0, (0.0, 100.0))

    if L.llm_available():
        st.success("👨‍💻🧠 GenAI: Groq connected")
    else:
        st.info("👨‍💻🧠 GenAI: offline mode (add GROQ_API_KEY to enable live AI text)")


# ---------------------------------------------------------------------------
# Tabs
# ---------------------------------------------------------------------------
tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "🎯 Predict a customer",
    "📊 Portfolio explorer",
    "💰 Threshold economics",
    "📈 The data story",
    "👨‍💻🧠 AI assistant",
])

# ---- Tab 1: Predict --------------------------------------------------------
with tab1:
    prob = predict_one(profile)
    verdict = "HIGH-RISK" if prob >= threshold else "LOW-RISK"
    c1, c2 = st.columns([1, 1.2])
    with c1:
        st.plotly_chart(gauge(prob, threshold), use_container_width=True)
        if prob >= threshold:
            st.error(f"### ⚠️ {verdict}  ·  {prob:.0%}")
        else:
            st.success(f"### ✅ {verdict}  ·  {prob:.0%}")
        st.caption(f"Classified against a **{threshold:.0%}** threshold "
                   "(adjust it in the sidebar).")

    with c2:
        st.markdown("#### Why this score?")
        st.caption("SHAP contributions (log-odds) - how each feature moves *this* "
                   "customer's risk vs. the average customer.")
        drivers = customer_drivers(profile)
        if drivers:
            dd = pd.DataFrame(drivers, columns=["feature", "contribution"]).head(6)
            fig = px.bar(dd[::-1], x="contribution", y="feature", orientation="h",
                         color="contribution", color_continuous_scale=["#0090DA", "#E4002B"],
                         color_continuous_midpoint=0)
            fig.update_layout(height=280, margin=dict(l=10, r=10, t=10, b=10),
                              coloraxis_showscale=False,
                              xaxis_title="pushes risk ← down · up →", yaxis_title="")
            st.plotly_chart(fig, use_container_width=True)

        st.markdown("#### 👨‍💻🧠 AI explanation")
        with st.spinner("Generating explanation…"):
            text, source = L.explain_decision(profile, prob, threshold, drivers)
        st.markdown(text)
        with st.expander("ℹ️ Source"):
            st.caption(
                "Live Groq LLM · Llama 3.3 70B" if source == "llm"
                else "Offline template - the numbers are computed exactly in Python; "
                     "add a GROQ_API_KEY to enable live AI phrasing.")

    # ---- New views (additive, collapsed by default) ------------------------
    st.divider()
    with st.expander("🔬 Advanced view — SHAP waterfall & customer ranking",
                     expanded=False):
        w1, w2 = st.columns([1.25, 1])
        with w1:
            st.markdown("#### 💧 SHAP waterfall — how we got to this score")
            st.caption("Starts at the average customer (base) and adds each feature's "
                       "contribution to reach this customer's log-odds. "
                       "Red pushes risk **up**, blue pushes it **down**.")
            wf = shap_waterfall_fig(profile)
            if wf is not None:
                st.plotly_chart(wf, use_container_width=True)
                st.info(
                    "**Reading the axis (log-odds):**  🟥 bars raise risk · 🟦 bars lower it. "
                    "**0 ≈ a 50/50 coin-flip**; each **+1** multiplies the odds of high-risk by "
                    "~2.7 (e¹), each **−1** divides them by ~2.7. The gauge above just converts "
                    "the final log-odds into an easy percentage.")
        with w2:
            st.markdown("#### 📊 Where this customer ranks")
            strip, pct = percentile_strip_fig(prob)
            st.metric("Riskier than", f"{pct:.0f}% of customers",
                      help="Share of all 60,000 customers with a lower model risk score.")
            st.plotly_chart(strip, use_container_width=True)

# ---- Tab 2: Portfolio explorer --------------------------------------------
with tab2:
    dfs = scored_data()
    mask = (dfs.age.between(*age_range)) & (dfs.health_score.between(*hs_range))
    cohort = dfs[mask]
    st.markdown(f"#### Cohort: **{len(cohort):,}** customers "
                f"(age {age_range[0]}–{age_range[1]}, "
                f"health {hs_range[0]:.0f}–{hs_range[1]:.0f})")

    if len(cohort) == 0:
        st.warning("No customers match this filter - widen the ranges.")
    else:
        actual_hr = cohort.is_high_risk.mean() * 100
        pred_hr = (cohort.risk_score >= threshold).mean() * 100
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Customers", f"{len(cohort):,}")
        m2.metric("Actual high-risk", f"{actual_hr:.1f}%")
        m3.metric("Flagged @ threshold", f"{pred_hr:.1f}%")
        m4.metric("Avg risk score", f"{cohort.risk_score.mean():.0%}")

        c1, c2 = st.columns(2)
        with c1:
            fig = px.histogram(cohort, x="risk_score", nbins=40,
                               color_discrete_sequence=[PRIMARY])
            fig.add_vline(x=threshold, line_dash="dash", line_color=RISK,
                          annotation_text="threshold")
            fig.update_layout(title="Risk-score distribution", height=330,
                              margin=dict(t=40, b=10))
            st.plotly_chart(fig, use_container_width=True)
        with c2:
            by_pt = (cohort.groupby("policy_type")
                     .agg(high_risk_rate=("is_high_risk", "mean"),
                          n=("is_high_risk", "size")).reset_index())
            by_pt["high_risk_rate"] *= 100
            fig = px.bar(by_pt, x="policy_type", y="high_risk_rate",
                         color_discrete_sequence=[GREEN], text_auto=".1f")
            fig.update_layout(title="High-risk rate by policy type (%)",
                              height=330, margin=dict(t=40, b=10))
            st.plotly_chart(fig, use_container_width=True)

        st.markdown("##### 🔎 Highest-risk customers in this cohort")
        top = (cohort.sort_values("risk_score", ascending=False)
               .head(15)[["customer_id", "age", "health_score",
                          "has_chronic_disease", "policy_type",
                          "risk_score", "is_high_risk"]])
        top["risk_score"] = (top["risk_score"] * 100).round(1)
        st.dataframe(top, use_container_width=True, hide_index=True)

# ---- Tab 3: Threshold economics -------------------------------------------
with tab3:
    st.markdown("#### Threshold is a business lever, not just a stat")
    st.caption("Missing a truly high-risk customer (false negative) usually "
               "costs far more than over-flagging a safe one (false positive). "
               "Set the relative cost and find the threshold that minimises loss.")

    dfs = scored_data()
    y = dfs.is_high_risk.values
    p = dfs.risk_score.values

    c0, c1 = st.columns([1, 2])
    with c0:
        cost_fn = st.slider("Cost of a MISS (false negative)", 1, 20, 10)
        cost_fp = st.slider("Cost of over-flagging (false positive)", 1, 20, 1)

    ths = np.linspace(0.05, 0.95, 91)
    costs, f1s = [], []
    for t in ths:
        pred = (p >= t).astype(int)
        tp = int(((pred == 1) & (y == 1)).sum())
        fp = int(((pred == 1) & (y == 0)).sum())
        fn = int(((pred == 0) & (y == 1)).sum())
        costs.append(cost_fn * fn + cost_fp * fp)
        prec = tp / (tp + fp) if (tp + fp) else 0
        rec = tp / (tp + fn) if (tp + fn) else 0
        f1s.append(2 * prec * rec / (prec + rec) if (prec + rec) else 0)
    opt_t = float(ths[int(np.argmin(costs))])

    with c1:
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=ths, y=costs, name="Total cost",
                                 line=dict(color=RISK, width=3)))
        fig.add_vline(x=opt_t, line_dash="dash", line_color=GREEN,
                      annotation_text=f"cost-optimal {opt_t:.2f}")
        fig.add_vline(x=threshold, line_dash="dot", line_color="#555",
                      annotation_text=f"your {threshold:.2f}")
        fig.update_layout(title="Total business cost vs threshold",
                          height=340, margin=dict(t=40, b=10),
                          yaxis_title="Total cost", xaxis_title="threshold")
        st.plotly_chart(fig, use_container_width=True)

    pred = (p >= threshold).astype(int)
    tp = int(((pred == 1) & (y == 1)).sum()); fp = int(((pred == 1) & (y == 0)).sum())
    fn = int(((pred == 0) & (y == 1)).sum()); tn = int(((pred == 0) & (y == 0)).sum())
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("At your threshold", f"{threshold:.2f}")
    m2.metric("Missed high-risk (FN)", f"{fn:,}")
    m3.metric("Over-flagged (FP)", f"{fp:,}")
    m4.metric("Cost-optimal threshold", f"{opt_t:.2f}",
              delta=f"{opt_t - threshold:+.2f} vs yours")
    st.info(f"💡 With a **{cost_fn}:{cost_fp}** miss-to-over-flag cost ratio, the "
            f"loss-minimising threshold is **{opt_t:.2f}**. Because a missed "
            "high-risk customer hurts the **loss ratio** most, the optimum sits "
            "**below** the default 0.50 - the model deliberately casts a wider net.")

# ---- Tab 4: Data story -----------------------------------------------------
with tab4:
    st.markdown("#### What the data tells us (the 60,000-customer picture)")
    facts = [
        ("Age is the #1 driver", f"Correlation with risk = "
         f"+{summary.get('corr_with_target', {}).get('age', 0.42):.2f}. "
         "Risk climbs from ~21% (under-40) to ~67% (over-60)."),
        ("Health score protects", "High-risk customers average a health score of "
         f"{summary.get('health_ttest', {}).get('mean_high', 43):.0f} vs "
         f"{summary.get('health_ttest', {}).get('mean_low', 56):.0f} for low-risk "
         "(difference is highly significant, p<0.001)."),
        ("Income/BMI/claims are noise", "Near-zero correlation with risk - they add "
         "little and should not drive underwriting decisions here."),
        ("Data is clean & balanced", "5% of income values missing (imputed); "
         f"{summary.get('target_pct_high_risk', 45.7):.0f}% of customers are high-risk "
         "- close to balanced."),
    ]
    cols = st.columns(2)
    for i, (h, b) in enumerate(facts):
        with cols[i % 2]:
            st.markdown(f"##### {h}")
            st.write(b)

    st.divider()
    imgs = [
        ("assets/q2_healthscore_by_risk.png", "Health score clearly separates the two groups"),
        ("assets/q2_correlation_heatmap.png", "Only age & health_score correlate with risk"),
        ("assets/q1_income_distribution.png", "Income is symmetric; claims are skewed"),
        ("assets/q4_feature_importance.png", "Model drivers confirm the story"),
    ]
    cols = st.columns(2)
    for i, (path, cap) in enumerate(imgs):
        if Path(path).exists():
            with cols[i % 2]:
                st.image(path, caption=cap, use_container_width=True)

# ---- Tab 5: AI assistant ---------------------------------------------------
with tab5:
    st.markdown("#### 👨‍💻🧠 Ask the underwriting assistant")
    st.caption("Answers are computed from the real data in Python, then phrased "
               "by the AI - so the numbers are always exact (no hallucination). "
               "Try: *“What's the high-risk rate for customers over 60?”* or "
               "*“Which factors matter most?”*")

    if "chat" not in st.session_state:
        st.session_state.chat = []

    examples = ["What's the high-risk rate for customers over 60?",
                "Compare risk across policy types.",
                "Which factors matter most and why?"]
    ec = st.columns(len(examples))
    clicked = None
    for i, ex in enumerate(examples):
        if ec[i].button(ex, use_container_width=True):
            clicked = ex

    for role, msg in st.session_state.chat:
        with st.chat_message(role):
            st.markdown(msg)

    user_q = st.chat_input("Ask about the portfolio, risk drivers, segments…")
    q = user_q or clicked
    if q:
        st.session_state.chat.append(("user", q))
        with st.chat_message("user"):
            st.markdown(q)
        with st.chat_message("assistant"):
            with st.spinner("Thinking…"):
                ans, source = L.answer_question(load_data(), q)
            st.markdown(ans)
            with st.expander("ℹ️ Source"):
                st.caption(
                    "Live Groq LLM · Llama 3.3 70B" if source == "llm"
                    else "Offline mode - facts computed exactly in Python; "
                         "add a GROQ_API_KEY to enable live AI phrasing.")
        st.session_state.chat.append(("assistant", ans))

st.markdown("---")
st.markdown(
    """<div style="text-align:center;color:#5B6770;font-size:13.5px;padding:2px 0;">
       Made with ❤️ by <b>Pavel Bodle</b>
       &nbsp;·&nbsp; <a href="https://www.linkedin.com/in/pavelbodle/" target="_blank"
          style="color:#0090DA;text-decoration:none;">🔗 LinkedIn</a>
       &nbsp;·&nbsp; <a href="https://github.com/PavelBodle" target="_blank"
          style="color:#0090DA;text-decoration:none;">💻 GitHub source code</a>
       <br><span style="font-size:11px;opacity:.75;">
       </span></div>""",
    unsafe_allow_html=True,
)
