"""
GenAI layer for the MetLife High-Risk app.
==========================================
Two capabilities, both GROUNDED on numbers computed in Python
(the LLM only *verbalizes* the model's output — it never invents statistics):

  1. explain_decision()  -> plain-English "why" for a single prediction
  2. answer_question()   -> underwriting Q&A where pandas computes the answer
                            and the LLM phrases it conversationally

Provider: Groq (free API, Llama 3.3 70B). The API key is read from
Streamlit secrets (st.secrets["GROQ_API_KEY"]) or the GROQ_API_KEY env var.

If no key / SDK is available, every function falls back to a clean
template-based response so the app NEVER breaks during a live demo.
"""
from __future__ import annotations

import os
import textwrap

MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = (
    "You are an underwriting assistant for a life & health insurer. "
    "You explain a machine-learning risk model to NON-TECHNICAL staff "
    "(underwriters, managers) in clear, concise business English. "
    "CRITICAL RULES: Only use the numbers explicitly provided to you. "
    "Never invent statistics, probabilities, or customer data. "
    "Keep answers short (2-4 sentences unless asked for more). "
    "Do not give individualised financial or medical advice; frame everything "
    "as a portfolio / underwriting screening aid."
)


# ---------------------------------------------------------------------------
# Groq client (lazy, cached)
# ---------------------------------------------------------------------------
def _get_api_key():
    key = os.environ.get("GROQ_API_KEY")
    if key:
        return key
    try:
        import streamlit as st
        return st.secrets.get("GROQ_API_KEY")  # type: ignore
    except Exception:
        return None


def llm_available() -> bool:
    if _get_api_key() is None:
        return False
    try:
        import groq  # noqa: F401
        return True
    except Exception:
        return False


def _chat(user_prompt: str, temperature: float = 0.3, max_tokens: int = 350):
    """Return LLM text, or None if unavailable / errored."""
    key = _get_api_key()
    if not key:
        return None
    try:
        from groq import Groq
        client = Groq(api_key=key)
        resp = client.chat.completions.create(
            model=MODEL,
            temperature=temperature,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:  # network, quota, bad key, etc.
        return f"__ERROR__{e}"


# ---------------------------------------------------------------------------
# 1. Decision narrator
# ---------------------------------------------------------------------------
def explain_decision(inputs: dict, probability: float, threshold: float,
                     drivers: list[tuple[str, float]]) -> tuple[str, str]:
    """
    Returns (text, source) where source is 'llm' or 'template'.
    drivers: list of (feature, signed_contribution) sorted by |impact| desc.
    """
    verdict = "HIGH-RISK" if probability >= threshold else "LOW-RISK"
    driver_lines = "\n".join(
        f"  - {f}: pushes risk {'UP' if c > 0 else 'DOWN'} "
        f"(customer value = {inputs.get(f, 'n/a')})"
        for f, c in drivers[:4]
    )
    prompt = textwrap.dedent(f"""
        A customer was scored by our risk model.

        Model risk probability: {probability:.0%}
        Decision threshold in use: {threshold:.0%}
        Resulting classification: {verdict}

        Customer profile: {inputs}

        Top factors driving THIS customer's score (already computed):
        {driver_lines}

        Write a short, friendly explanation for an underwriter of WHY this
        customer received this classification, naming the main factors.
        End with one practical next step.
    """).strip()

    out = _chat(prompt)
    if out and not out.startswith("__ERROR__"):
        return out, "llm"

    # ---- Offline template fallback ----
    top = drivers[0][0] if drivers else "age"
    second = drivers[1][0] if len(drivers) > 1 else "health score"
    direction = "elevated" if probability >= threshold else "acceptable"
    text = (
        f"This customer is classified **{verdict}** with a model risk score of "
        f"**{probability:.0%}** (decision threshold {threshold:.0%}). "
        f"The score is driven mainly by **{top}** and **{second}**. "
        f"Overall the profile sits in the {direction} range. "
        f"Suggested next step: "
        + ("route to manual underwriting / consider risk-based pricing."
           if probability >= threshold
           else "eligible for standard fast-track processing.")
    )
    return text, "template"


# ---------------------------------------------------------------------------
# 2. Grounded Q&A chatbot
#    We answer common questions from the dataframe in Python, then let the
#    LLM phrase the result. This prevents hallucinated statistics.
# ---------------------------------------------------------------------------
def compute_context(df, question: str) -> str:
    """Compute a compact, factual context block from the data for the question.
    Always returns real numbers regardless of the question so the LLM has
    grounded facts to work from."""
    q = question.lower()
    lines = []
    total = len(df)
    hr = df["is_high_risk"].mean() * 100
    lines.append(f"Portfolio size: {total:,} customers. "
                 f"Overall high-risk rate: {hr:.1f}%.")

    # policy-type breakdown
    if "policy" in q or "platinum" in q or "basic" in q or "premium" in q:
        for pt, g in df.groupby("policy_type"):
            lines.append(f"{pt}: {len(g):,} customers, "
                         f"{g['is_high_risk'].mean()*100:.1f}% high-risk.")

    # age-related
    if "age" in q or "old" in q or "young" in q or "60" in q or "senior" in q:
        for lo, hi in [(18, 40), (40, 60), (60, 100)]:
            g = df[(df.age >= lo) & (df.age < hi)]
            if len(g):
                lines.append(f"Age {lo}-{hi}: {len(g):,} customers, "
                             f"{g['is_high_risk'].mean()*100:.1f}% high-risk.")

    # chronic disease
    if "chronic" in q or "disease" in q or "sick" in q:
        for v, label in [(1, "with"), (0, "without")]:
            g = df[df.has_chronic_disease == v]
            lines.append(f"Customers {label} chronic disease: {len(g):,}, "
                         f"{g['is_high_risk'].mean()*100:.1f}% high-risk.")

    # health score
    if "health" in q or "score" in q:
        lines.append(
            f"Avg health_score: high-risk group "
            f"{df[df.is_high_risk==1]['health_score'].mean():.1f} vs "
            f"low-risk {df[df.is_high_risk==0]['health_score'].mean():.1f}.")

    # generic driver question
    if "driver" in q or "factor" in q or "important" in q or "why" in q:
        lines.append("Top model drivers (permutation importance): "
                     "age (largest), then health_score, then has_chronic_disease. "
                     "annual_income, bmi and past_claims_amount have ~zero effect.")

    return "\n".join(lines)


def answer_question(df, question: str, history=None) -> tuple[str, str]:
    """Returns (answer_text, source)."""
    context = compute_context(df, question)
    prompt = textwrap.dedent(f"""
        A manager asked: "{question}"

        Here are the ONLY facts you may use (computed from the live data):
        {context}

        Answer the manager's question using these facts. If the facts do not
        contain the answer, say what the data does show instead. Be concise.
    """).strip()

    out = _chat(prompt, temperature=0.2)
    if out and not out.startswith("__ERROR__"):
        return out, "llm"

    # ---- Offline fallback: return the computed facts directly ----
    text = ("*(AI text service not configured — showing the computed facts "
            "directly.)*\n\n" + context)
    return text, "template"
