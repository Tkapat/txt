import { Fragment } from "react";
import { PageShell } from "@/frontend/components/layout/PageShell";
import { PaperSheet } from "@/frontend/components/paper/PaperSheet";
import { RuleLine } from "@/frontend/components/paper/RuleLine";

const SECTIONS = [
  {
    title: "What it measures",
    content: `txt analyses text to estimate the probability that it was written by an AI language model rather than a human. It uses two specialised models: a review detector (DistilBERT + stylometric features + stacker) for short texts up to about 160 words, and a document detector (fine-tuned RoBERTa) that splits longer texts into overlapping chunks.`,
  },
  {
    title: "How it works",
    content: `For reviews and short texts, the system combines a fine-tuned DistilBERT transformer with 22 handcrafted stylometric features (sentence length variation, contraction use, first-person pronouns, punctuation patterns, and more). A logistic regression stacker merges both signals. For longer documents, overlapping chunks are scored independently, and the results are averaged. Evidence phrases are identified through occlusion: removing each sentence and measuring how the score changes.`,
  },
  {
    title: "How accurate it is",
    content: `The review model is trained on human reviews from before 2022 and AI-generated reviews from multiple LLM families. It is evaluated on generators it has never seen during training. Accuracy drops on adversarial text (casual style prompts) and on very short text (under 40 words). The document model is fine-tuned from a ChatGPT detector and further trained on multi-generator, multi-domain data. All percentages for review sets are corrected for detector error rate using the Rogan–Gladen method and reported with a confidence range.`,
  },
  {
    title: "What it cannot do",
    content: `No detector is perfect. txt cannot determine intent: AI-assisted editing, grammar correction, and translation may trigger a higher score. Very short text (under 40 words) produces unreliable results. The models are trained primarily on English text. Non-native English writing may occasionally be flagged incorrectly. "AI-written" does not mean "fake" — people use AI tools for legitimate purposes. Never use a detector result alone to judge someone.`,
  },
  {
    title: "Privacy",
    content: `txt has no database and no user accounts. Text you submit is processed in memory and immediately discarded. No request bodies are logged. The API responses include a "detector_not_proof" warning as a reminder that the output is evidence, not proof. All processing happens on the server where the app is deployed — no text is sent to third-party AI services.`,
  },
  {
    title: "FAQ",
    content: `**Why does it say "likely AI-written" instead of "fake"?**\nBecause AI-assisted writing is not the same as fake writing. A reviewer might use AI to fix grammar. A student might use AI to brainstorm. The detector measures style signals, not intent.\n\n**What is the "range" shown for review sets?**\nIt is a 95% Wilson confidence interval, corrected for the detector's known sensitivity and specificity on generators it was not trained on. It is wider when fewer reviews are analysed.\n\n**Can I use this to check my own writing?**\nYes — it can help you understand how your writing style compares to typical AI output. But remember that a high score does not mean your text is bad or dishonest.`,
  },
];

export default function MethodPage() {
  return (
    <PageShell>
      <PaperSheet clip="tl">
        {/* Hero */}
      <div
        className="mb-6 animate-fade-up"
        style={{ paddingTop: "var(--s5)" }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-h2)",
            fontWeight: 300,
            color: "var(--ink)",
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          How it works
        </h1>
        <p
          className="mt-2 mb-0"
          style={{
            fontFamily: "var(--font-text)",
            color: "var(--ink-soft)",
            maxWidth: "55ch",
          }}
        >
          Accuracy, limitations, and privacy. Honest about what the detector can
          and cannot do.
        </p>
      </div>

      <RuleLine className="mb-8" />

      {/* Sections */}
      <div className="flex flex-col gap-10">
        {SECTIONS.map((section, i) => (
          <Fragment key={i}>
            <section
              className="animate-fade-up"
              style={{ animationDelay: `${0.1 + i * 0.1}s` }}
            >
              <span
                className="mono-label"
                style={{ display: "block", marginBottom: "var(--s2)" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2
                className="mb-3"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.2rem, 1rem + 0.5vw, 1.5rem)",
                  fontWeight: 400,
                  color: "var(--ink)",
                  margin: 0,
                }}
              >
                {section.title}
              </h2>
              <div
                style={{
                  fontFamily: "var(--font-text)",
                  fontSize: "var(--fs-body)",
                  color: "var(--ink-soft)",
                  lineHeight: 1.7,
                  maxWidth: "68ch",
                }}
              >
                {section.content.split("\n\n").map((para, j) => {
                  // Handle bold markdown
                  const parts = para.split(/\*\*(.*?)\*\*/g);
                  return (
                    <p key={j} className="mb-3 last:mb-0" style={{ margin: 0, marginBottom: j < section.content.split("\n\n").length - 1 ? "12px" : 0 }}>
                      {parts.map((part, k) =>
                        k % 2 === 1 ? (
                          <strong key={k} style={{ color: "var(--ink)", fontWeight: 500 }}>
                            {part}
                          </strong>
                        ) : (
                          <span key={k}>{part}</span>
                        ),
                      )}
                    </p>
                  );
                })}
              </div>
            </section>
            {i < SECTIONS.length - 1 && <RuleLine />}
          </Fragment>
        ))}
      </div>
    </PaperSheet>
    </PageShell>
  );
}
