# MetLife Japan — High-Risk Customer Prediction

Predicting `is_high_risk` for 60,000 insurance customers with an **explainable** model,
plus a **self-serve Streamlit app** and a **GenAI underwriting assistant**.

Built as a Senior Data Scientist take-home. Three audiences, three deliverables:

| Deliverable | File | For |
|---|---|---|
| 📊 Interactive app | `app.py` | Underwriters / managers (non-technical) |
| 📄 Written answers (Q1–Q4) | `MetLife_Answers.docx` | Technical + business reviewers |
| 🖥️ Insights deck | `MetLife_Insights_Deck.pptx` | Executive presentation |
| 🔬 Reproducible analysis | `analysis.py` | Data science review |

---

## Headline results

- **Best model: Logistic Regression** — AUROC **0.780**, and fully explainable (odds ratios).
  It beats Random Forest (0.762) and Gradient Boosting (0.780), so the simplest model is
  also the most accurate *and* the most auditable.
- **Top drivers:** `age` (odds ×3.0 per SD), `health_score` (protective, ×0.55), then
  `has_chronic_disease`. Income, BMI and past claims carry **no** signal.
- **Business call:** *lower* the decision threshold below 0.50 — a missed high-risk
  customer hurts the loss ratio ~10× more than an over-flag.

---

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python analysis.py          # trains model.pkl + regenerates charts in assets/
streamlit run app.py        # opens the app at http://localhost:8501
```

`analysis.py` is optional to re-run — `model.pkl` and `assets/` are already included.

## Deploy free on Streamlit Cloud

1. Push this folder to a **public GitHub repo** (include `app.py`, `llm_helper.py`,
   `model.pkl`, `requirements.txt`, `insurance_test_data.csv`, `assets/`).
2. Go to **share.streamlit.io** → *New app* → pick the repo → main file **`app.py`** → Deploy.
3. (Optional) enable the live GenAI text — see below.

## Enable the GenAI assistant (optional, free)

The app works **without any key** — the AI narrator and chatbot fall back to exact,
template-based text so a demo never breaks. To turn on live LLM phrasing:

1. Get a free API key at **console.groq.com**.
2. **Locally:** create `.streamlit/secrets.toml`:
   ```toml
   GROQ_API_KEY = "gsk_your_key_here"
   ```
3. **On Streamlit Cloud:** app → *Settings* → *Secrets* → paste the same line.

> The LLM only *phrases* numbers computed in Python — it never invents statistics.
> This "grounded" design keeps the GenAI layer safe for a regulated insurance context.

---

## The app (5 tabs)

1. **🎯 Predict a customer** — sliders → risk gauge, driver breakdown, plain-English AI reason.
2. **📊 Portfolio explorer** — filter 60k customers by age & health band; live high-risk rates.
3. **💰 Threshold economics** — set miss vs. over-flag costs; find the loss-minimising threshold.
4. **📈 The data story** — EDA charts with one-line takeaways for any audience.
5. **🤖 AI assistant** — natural-language Q&A, grounded in the real data.

## Files

```
app.py                     Streamlit app (5 tabs, dynamic controls)
llm_helper.py              GenAI narrator + grounded chatbot (Groq + offline fallback)
analysis.py                Reproducible EDA, stats, model bake-off → model.pkl + assets/
model.pkl                  Trained pipeline + metadata (consumed by the app)
requirements.txt           Python dependencies
assets/                    Generated charts + summary.json
MetLife_Answers.docx       Q1–Q4 write-up with visualizations
MetLife_Insights_Deck.pptx Executive insights deck
insurance_test_data.csv    Source data (60,000 rows)
```

*Decision-support demo only — not for real underwriting decisions.*
