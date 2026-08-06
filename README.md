# High-Risk Customer Prediction - Demo

Predicting `is_high_risk` for 60,000 insurance customers with an **explainable** model,
plus a **self-serve Streamlit app** and a **GenAI underwriting assistant**.

---

## Headline results

- **Best model: Logistic Regression** -> AUROC **0.780**, and fully explainable (odds ratios).
It beats Random Forest (0.762) and Gradient Boosting (0.780), so the simplest model is
also the most accurate *and* the most auditable.
- **Top drivers:** `age` (odds ×3.0 per SD), `health_score` (protective, ×0.55), then
`has_chronic_disease`. Income, BMI and past claims carry **no** signal.
- **Business call:** *lower* the decision threshold below 0.50 -> a missed high-risk
customer hurts the loss ratio ~10× more than an over-flag.

---



## Run locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python analysis.py          # trains model.pkl + regenerates charts in assets/
streamlit run app.py        # opens the app at http://localhost:8501
```

`analysis.py` is optional to re-run -> `model.pkl` and `assets/` are already included.

## The app (5 tabs)

1. **🎯 Predict a customer** -> sliders → risk gauge, driver breakdown, plain-English AI reason.
2. **📊 Portfolio explorer** -> filter 60k customers by age & health band; live high-risk rates.
3. **💰 Threshold economics** -> set miss vs. over-flag costs; find the loss-minimising threshold.
4. **📈 The data story** -> EDA charts with one-line takeaways for any audience.
5. **🤖 AI assistant** -> natural-language Q&A, grounded in the real data.



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

---



## Author

Developed by **Pavel Daulat Bodle**

Senior AI Engineer 

🔗 LinkedIn: [linkedin.com/in/pavelbodle](https://linkedin.com/in/pavelbodle)  
🐙 GitHub: [github.com/pavelbodle](https://github.com/pavelbodle)  
📧 [paveliitb@gmail.com](mailto:paveliitb@gmail.com)