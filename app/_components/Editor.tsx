"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useExam } from "@/app/_lib/useExam";
import LeftPanel from "./LeftPanel";
import TopBar, { type Subject } from "./TopBar";

// Konva needs the browser (canvas), so load the workspace on the client only.
const Workspace = dynamic(() => import("./workspace/Workspace"), { ssr: false });

// The main screen: top bar, toolbox on the left, pages in the center.
export default function Editor() {
  const exam = useExam();
  const [subject, setSubject] = useState<Subject>("General");

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <TopBar subject={subject} onSubjectChange={setSubject} />
      <div className="flex min-h-0 flex-1">
        <LeftPanel
          subject={subject}
          pageCount={exam.pages.length}
          questionCount={exam.questions.length}
          onAddMcq={exam.addMcq}
        />
        <main className="min-w-0 flex-1">
          <Workspace
            pages={exam.pages}
            questions={exam.questions}
            selectedId={exam.selectedId}
            activePage={exam.activePage}
            reveal={exam.reveal}
            onSelect={exam.setSelectedId}
            onMove={exam.moveBlock}
            onAddPage={exam.addPage}
            onActivePageChange={exam.setActivePage}
          />
        </main>
      </div>
    </div>
  );
}
