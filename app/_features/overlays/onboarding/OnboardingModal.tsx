"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Ctx } from "@/app/_features/core/types";
import {
  applyChrome,
  buildTypes,
  defaultFooterId,
  defaultHeaderId,
  defaultMarginId,
  examFromLayout,
  marginMatching,
  marginTemplates,
  onboardingRequests,
  subscribeOnboarding,
  wantsFooter,
  wantsHeader,
  type ChromeChoice,
} from "@/app/_lib/onboarding";
import type { BuildType } from "@/app/_lib/onboardingTypes";
import { loadAutosave } from "@/app/_lib/storage";
import { templateById } from "@/app/_lib/templates";
import type { ExamDoc, PageScope } from "@/app/_lib/types";
import BuildCard from "./cards/BuildCard";
import MarginCard from "./cards/MarginCard";
import ScopePicker from "./ScopePicker";

type Step = "welcome" | "margins" | "structure";
// "fresh" = no saved exam yet (a new one is created); "existing" = the current exam keeps its content.
type Mode = "fresh" | "existing";
type Draft = {
  step: Step;
  marginId: string;
  build: BuildType;
  headerId: string;
  footerId: string;
  headerScope: PageScope;
  footerScope: PageScope;
};

const ALL: PageScope = { mode: "all" };
const FRESH: Draft = {
  step: "welcome",
  marginId: defaultMarginId,
  build: "header-footer",
  headerId: defaultHeaderId,
  footerId: defaultFooterId,
  headerScope: ALL,
  footerScope: ALL,
};

// What the current exam already uses, so the window starts from it.
function draftFromDoc(doc: ExamDoc, step: Step): Draft {
  const rule = doc.meta.chrome;
  const h = !!rule && rule.header.mode !== "none";
  const f = !!rule && rule.footer.mode !== "none";
  const build: BuildType = h && f ? "header-footer" : h ? "header-only" : f ? "footer-only" : "none";
  const m = doc.pages[0]?.margins;
  return {
    step,
    marginId: (m && marginMatching(m)?.id) || defaultMarginId,
    build,
    headerId: rule?.headerId ?? defaultHeaderId,
    footerId: rule?.footerId ?? defaultFooterId,
    headerScope: h && rule ? rule.header : ALL,
    footerScope: f && rule ? rule.footer : ALL,
  };
}

const chromeOf = (d: Draft): ChromeChoice => ({
  header: wantsHeader(d.build) ? d.headerId : null,
  headerScope: d.headerScope,
  footer: wantsFooter(d.build) ? d.footerId : null,
  footerScope: d.footerScope,
});

const DESCRIPTIONS: Record<BuildType, string> = {
  "header-footer": "Repeated at the top and bottom of every page.",
  "header-only": "A band repeated at the top of every page.",
  "footer-only": "A band repeated at the bottom of every page.",
  none: "A blank page, with no repeated element.",
};

// The setup window, in three steps: welcome (first run only), margins, page structure.
// It opens on every launch, and again from File → "Configure page layout…".
export function OnboardingModal({ ctx }: { ctx: Ctx }) {
  const [mode, setMode] = useState<Mode>(() => (loadAutosave() === null ? "fresh" : "existing"));
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState<Draft>(() => (mode === "fresh" ? FRESH : draftFromDoc(ctx.doc, "welcome")));
  const requests = useSyncExternalStore(subscribeOnboarding, onboardingRequests, () => 0);
  const [seen, setSeen] = useState(requests);

  // Reopened from File → "Configure page layout…".
  if (requests !== seen) {
    setSeen(requests);
    setMode("existing");
    setDraft(draftFromDoc(ctx.doc, "margins"));
    setOpen(true);
  }

  const fresh = mode === "fresh";
  const go = (step: Step) => setDraft((d) => ({ ...d, step }));

  // A new exam is a blank page with these settings; an existing one keeps its content (a copy goes to history first).
  const finish = (d: Draft) => {
    const chrome = chromeOf(d);
    const next = fresh ? examFromLayout(templateById("blank-fr"), d.marginId, chrome, ctx.t) : applyChrome(ctx.doc, d.marginId, chrome, ctx.t);
    ctx.shell.applyDoc(next, !fresh);
    setOpen(false);
  };

  // ✕ / Esc / "Custom": a first run gets a blank page; otherwise the exam stays as it is.
  const cancel = () => (fresh ? finish({ ...draft, build: "none" }) : setOpen(false));
  const cancelRef = useRef(cancel);
  useEffect(() => {
    cancelRef.current = cancel;
  });

  // Focus the main button of each step.
  useEffect(() => {
    if (open) document.querySelector<HTMLElement>("[data-onboarding-dialog] [data-autofocus]")?.focus();
  }, [draft.step, open]);

  // Lock page scroll, Esc cancels, Tab stays inside the window.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelRef.current();
      } else if (e.key === "Tab") {
        const nodes = [...document.querySelectorAll<HTMLElement>("[data-onboarding-dialog] button:not(:disabled), [data-onboarding-dialog] input")];
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const at = document.activeElement as HTMLElement;
        const target = e.shiftKey && at === first ? last : !e.shiftKey && at === last ? first : !nodes.includes(at) ? first : null;
        if (target) {
          e.preventDefault();
          target.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;
  const t = ctx.t;
  const dots = draft.step === "welcome" ? null : (
    <div className="flex justify-center gap-2" aria-hidden="true">
      {[0, 1].map((i) => (
        <span key={i} className={`size-2 rounded-full ${i === (draft.step === "margins" ? 0 : 1) ? "bg-indigo-600" : "bg-slate-300"}`} />
      ))}
    </div>
  );
  const linkBtn = "text-sm font-medium text-indigo-600 underline-offset-2 hover:underline";
  const primaryBtn = "rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40";

  let body;
  let footer;
  if (draft.step === "welcome") {
    body = (
      <div className="flex flex-col items-center gap-6 py-4 text-center">
        <h2 className="text-2xl font-bold text-ink">{t("Welcome to Examor")}</h2>
        <p className="max-w-xl text-sm leading-relaxed text-muted">
          {t("Two quick choices will set up your paper: the margins, then the page structure. You can change everything later.")}
        </p>
        <svg width="120" height="160" viewBox="0 0 120 160" aria-hidden="true" className="mt-2">
          <rect x="1.5" y="1.5" width="117" height="157" rx="6" fill="#fff" stroke="#4f46e5" strokeWidth="2.5" />
          <rect x="18" y="20" width="84" height="3" rx="1.5" fill="#4f46e5" />
          <rect x="18" y="30" width="84" height="2" rx="1" fill="#c7d2fe" />
          {[52, 60, 68].map((y) => (
            <rect key={y} x="18" y={y} width="84" height="2" rx="1" fill="#c7d2fe" />
          ))}
          <rect x="18" y="68" width="50" height="2" rx="1" fill="#c7d2fe" />
          {[90, 98, 106].map((y) => (
            <rect key={y} x="18" y={y} width="84" height="2" rx="1" fill="#c7d2fe" />
          ))}
          <rect x="18" y="138" width="40" height="3" rx="1.5" fill="#4f46e5" />
        </svg>
      </div>
    );
    footer = (
      <>
        <button type="button" onClick={cancel} className={linkBtn}>
          {t("Custom")}
        </button>
        <button type="button" data-autofocus onClick={() => go("margins")} className={primaryBtn}>
          {t("Get started")}
        </button>
      </>
    );
  } else if (draft.step === "margins") {
    body = (
      <>
        <h2 className="text-2xl font-bold text-ink">{t("Choose a margin")}</h2>
        <p className="mb-6 mt-1 text-sm text-muted">{t("Pick the printable area of your pages.")}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {marginTemplates.map((m) => (
            <MarginCard key={m.id} ctx={ctx} template={m} selected={draft.marginId === m.id} onSelect={() => setDraft((d) => ({ ...d, marginId: m.id }))} />
          ))}
        </div>
      </>
    );
    footer = (
      <>
        <button type="button" onClick={cancel} className={linkBtn}>
          {t("Custom")}
        </button>
        <button type="button" data-autofocus onClick={() => go("structure")} className={primaryBtn}>
          {t("Next")}
        </button>
      </>
    );
  } else {
    body = (
      <>
        <h2 className="text-2xl font-bold text-ink">{t("Page structure")}</h2>
        <p className="mb-6 mt-1 text-sm text-muted">{t("Choose what each page carries, and on which pages.")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {buildTypes.map((b) => (
            <BuildCard
              key={b.id}
              ctx={ctx}
              name={b.nameKey}
              description={DESCRIPTIONS[b.id]}
              recommended={b.recommended}
              selected={draft.build === b.id}
              header={b.id === "header-footer" || b.id === "header-only"}
              footer={b.id === "header-footer" || b.id === "footer-only"}
              onSelect={() => setDraft((d) => ({ ...d, build: b.id }))}
            />
          ))}
        </div>
        {(wantsHeader(draft.build) || wantsFooter(draft.build)) && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {wantsHeader(draft.build) && <ScopePicker ctx={ctx} label="Header" scope={draft.headerScope} onChange={(headerScope) => setDraft((d) => ({ ...d, headerScope }))} />}
            {wantsFooter(draft.build) && <ScopePicker ctx={ctx} label="Footer" scope={draft.footerScope} onChange={(footerScope) => setDraft((d) => ({ ...d, footerScope }))} />}
          </div>
        )}
        <p className="mt-4 text-xs text-muted">{t("You can edit the header and footer later in the Properties panel.")}</p>
      </>
    );
    footer = (
      <>
        <button type="button" onClick={() => go("margins")} className={linkBtn}>
          {t("Back")}
        </button>
        <button type="button" data-autofocus onClick={() => finish(draft)} className={primaryBtn}>
          {fresh ? t("Create exam") : t("Apply")}
        </button>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-3 backdrop-blur-sm sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Configure page layout")}
        dir={ctx.dir}
        data-onboarding-dialog
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#4f46e5" />
              <rect x="9" y="9" width="14" height="2.5" rx="1.25" fill="#fff" />
              <rect x="9" y="15" width="14" height="2.5" rx="1.25" fill="#fff" />
              <rect x="9" y="21" width="9" height="2.5" rx="1.25" fill="#fff" />
            </svg>
            <span className="text-lg font-bold text-indigo-600">Examor</span>
          </div>
          <button
            type="button"
            onClick={cancel}
            title={t("Close (Esc)")}
            aria-label={t("Close (Esc)")}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-subtle text-muted hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-6">{body}</div>

        <div className="mt-2 flex flex-col gap-6">
          {dots}
          <div className="flex items-center justify-between gap-3">{footer}</div>
        </div>
      </div>
    </div>
  );
}
