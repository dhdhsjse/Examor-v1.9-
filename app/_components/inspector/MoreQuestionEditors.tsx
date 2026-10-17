"use client";

import { useState } from "react";
import { addOrderItem, addPair, removeOrderItem, removePair, reshuffle, setSentence } from "@/app/_lib/blocks";
import { plainText } from "@/app/_lib/richText";
import { fixOrder } from "@/app/_lib/shuffle";
import type { ClassifyBlock, MatchBlock, OrderBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { AddRowButton, Field, RemoveButton, RichInput, Segmented, SmallButton, TextArea, TextInput, Toggle } from "./fields";
import { QuestionBasics, type OnChange } from "./QuestionEditors";

const MAX_ROWS = 12;

const lines = (s: string) => s.split("\n").map((w) => w.trim()).filter(Boolean);

// Pairs that belong together, side by side. The paper prints the right column mixed up.
export function MatchEditor({ b, onChange }: { b: MatchBlock; onChange: OnChange }) {
  const t = useT();
  const set = (i: number, side: "left" | "right", v: string) => onChange({ pairs: b.pairs.map((p, k) => (k === i ? { ...p, [side]: v } : p)) }, `pair${i}-${side}`);
  const order = fixOrder(b.order, b.pairs.length);
  const letter = (i: number) => String.fromCharCode(97 + order.indexOf(i));

  return (
    <>
      <QuestionBasics b={b} onChange={onChange} />
      <Field group label={t("Pairs")} hint={t("Write each item next to its match. On the paper the right column is mixed up; the correction sheet draws the links.")}>
        <div className="flex flex-col gap-1.5">
          {b.pairs.map((p, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="w-4 shrink-0 text-center text-[11px] font-semibold text-muted">{i + 1}</span>
              <RichInput value={p.left} placeholder={t("Item…")} onChange={(v) => set(i, "left", v)} />
              <span className="shrink-0 text-faint" aria-hidden>
                ↔
              </span>
              <RichInput value={p.right} placeholder={t("Match…")} onChange={(v) => set(i, "right", v)} />
              <span className="w-4 shrink-0 text-center text-[11px] font-semibold text-muted" title={t("Printed as")}>
                {letter(i)}
              </span>
              {b.pairs.length > 2 && <RemoveButton title={t("Remove")} onClick={() => onChange(removePair(b, i), "pairs")} />}
            </div>
          ))}
          {b.pairs.length < MAX_ROWS && <AddRowButton onClick={() => onChange(addPair(b), "pairs")}>{t("Add pair")}</AddRowButton>}
        </div>
      </Field>
      <SmallButton onClick={() => onChange(reshuffle(b.pairs.length), "order")}>{t("Mix the right column again")}</SmallButton>
    </>
  );
}

// Items in the right order; the paper prints them mixed up.
export function OrderEditor({ b, onChange }: { b: OrderBlock; onChange: OnChange }) {
  const t = useT();
  const sentence = b.style === "sentence";
  const order = fixOrder(b.order, b.items.length);
  // The sentence is kept while typing (spaces included); the words follow it.
  const [typed, setTyped] = useState(b.items.join(" "));
  const move = (i: number, to: number) => {
    if (to < 0 || to >= b.items.length) return;
    const items = [...b.items];
    [items[i], items[to]] = [items[to], items[i]];
    // The printed order stays the same on paper: swap the two indexes in it too.
    onChange({ items, order: order.map((k) => (k === i ? to : k === to ? i : k)) }, "items-order");
  };

  return (
    <>
      <QuestionBasics b={b} onChange={onChange} />
      <Field group label={t("Kind")}>
        <Segmented
          value={sentence ? "sentence" : "list"}
          onChange={(v) => {
            if (v === "sentence") {
              const words = plainText(b.items.join(" "));
              setTyped(words);
              onChange({ style: "sentence", ...setSentence(b, words) }, "style");
            } else onChange({ style: "list" }, "style");
          }}
          options={[
            { value: "list", label: t("Steps to number") },
            { value: "sentence", label: t("Words of a sentence") },
          ]}
        />
      </Field>
      {sentence ? (
        <>
          <Field label={t("Correct sentence")} hint={t("Its words are printed mixed up; the student writes the sentence on the line.")}>
            <TextInput
              value={typed.split(/\s+/).filter(Boolean).join(" ") === b.items.join(" ") ? typed : b.items.join(" ")}
              placeholder={t("e.g. The cat sleeps on the chair.")}
              onChange={(v) => {
                setTyped(v);
                onChange(setSentence(b, v), "sentence");
              }}
            />
          </Field>
          {b.items.length > 1 && (
            <p className="rounded-md bg-subtle px-2.5 py-1.5 text-[11px] text-muted" dir="auto">
              {order.map((i) => plainText(b.items[i])).join("  /  ")}
            </p>
          )}
        </>
      ) : (
        <Field group label={t("Items, in the right order")} hint={t("The paper prints them mixed up, with a box for the rank.")}>
          <div className="flex flex-col gap-1.5">
            {b.items.map((item, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="w-4 shrink-0 text-center text-[11px] font-semibold text-muted">{i + 1}</span>
                <RichInput value={item} placeholder={t("Item…")} onChange={(v) => onChange({ items: b.items.map((x, k) => (k === i ? v : x)) }, `item${i}`)} />
                <div className="flex shrink-0 flex-col">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} title={t("Move up")} className="h-3.5 px-1 text-[9px] leading-none text-muted hover:text-ink disabled:opacity-30">
                    ▲
                  </button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === b.items.length - 1} title={t("Move down")} className="h-3.5 px-1 text-[9px] leading-none text-muted hover:text-ink disabled:opacity-30">
                    ▼
                  </button>
                </div>
                {b.items.length > 2 && <RemoveButton title={t("Remove")} onClick={() => onChange(removeOrderItem(b, i), "items")} />}
              </div>
            ))}
            {b.items.length < MAX_ROWS && <AddRowButton onClick={() => onChange(addOrderItem(b), "items")}>{t("Add item")}</AddRowButton>}
          </div>
        </Field>
      )}
      <SmallButton onClick={() => onChange(reshuffle(b.items.length), "order")}>{t("Mix again")}</SmallButton>
    </>
  );
}

// Categories and the words that go in each. One word per line.
export function ClassifyEditor({ b, onChange }: { b: ClassifyBlock; onChange: OnChange }) {
  const t = useT();
  // Keep each list as typed (empty lines included) until the next change.
  const [lists, setLists] = useState(() => b.groups.map((g) => g.items.join("\n")));
  const setGroup = (i: number, patch: Partial<ClassifyBlock["groups"][number]>, field: string) =>
    onChange({ groups: b.groups.map((g, k) => (k === i ? { ...g, ...patch } : g)) }, `group${i}-${field}`);

  return (
    <>
      <QuestionBasics b={b} onChange={onChange} />
      <Toggle checked={!b.hideBank} onChange={(show) => onChange({ hideBank: !show }, "hideBank")} label={t("Give the words in a box")} hint={t("Off: the student finds the words (e.g. in a text).")} />
      <Field group label={t("Categories")} hint={t("One word per line. The correction sheet fills the table.")}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
          {b.groups.map((g, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-lg border border-line bg-subtle/60 p-1.5">
              <div className="flex items-center gap-1">
                <TextInput value={g.name} placeholder={t("Category…")} onChange={(name) => setGroup(i, { name }, "name")} />
                {b.groups.length > 2 && (
                  <RemoveButton
                    title={t("Remove")}
                    onClick={() => {
                      setLists((l) => l.filter((_, k) => k !== i));
                      onChange({ groups: b.groups.filter((_, k) => k !== i) }, "groups");
                    }}
                  />
                )}
              </div>
              <TextArea
                rows={4}
                value={lines(lists[i] ?? "").join("\n") === g.items.join("\n") ? lists[i] : g.items.join("\n")}
                placeholder={t("One word per line")}
                onChange={(v) => {
                  setLists((l) => b.groups.map((_, k) => (k === i ? v : (l[k] ?? ""))));
                  setGroup(i, { items: lines(v) }, "items");
                }}
              />
            </div>
          ))}
        </div>
      </Field>
      {b.groups.length < 4 && (
        <AddRowButton
          onClick={() => {
            setLists((l) => [...l, ""]);
            onChange({ groups: [...b.groups, { name: `${t("Category")} ${b.groups.length + 1}`, items: [] }] }, "groups");
          }}
        >
          {t("Add category")}
        </AddRowButton>
      )}
    </>
  );
}
