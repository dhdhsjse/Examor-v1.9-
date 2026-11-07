"use client";

import { useT } from "@/app/_lib/uiLang";
import { Row, Segmented } from "./fields";

// A block's Position: in front of the blocks it overlaps, or behind everything else on its page. The same control in the Properties of
// every block (a picture under the text, a shape behind a question, a text box over a graph…). "In front" also brings the block to the
// top of its layer, "Behind" sends it to the bottom (useExam's orderBlock). On the page, Alt+click picks the block under the one on top.
export default function BlockPosition({ behind, onChange }: { behind: boolean; onChange: (behind: boolean) => void }) {
  const t = useT();
  return (
    <div data-testid="block-position">
      <Row label={t("Position")}>
        <div className="w-40">
          <Segmented
            value={behind ? "behind" : "front"}
            onChange={(v) => onChange(v === "behind")}
            options={[
              { value: "front", label: t("In front") },
              { value: "behind", label: t("Behind") },
            ]}
          />
        </div>
      </Row>
    </div>
  );
}
