# INSPECTOR-OPTIONS.md — The "Inspector-Driven Option" Workflow

> **Directive for AI coding agents (Claude Code).**
> Read `ARCHITECTURE.md`, `LEFT-PANEL.md`, and `LIBRARY.md` first. This directive extends them. 
> **Workflow Name:** Inspector-Driven Option Workflow.
> When the user says "Use the Inspector-Driven Option Workflow for [X]", they mean exactly what is described in this file.
>
> How it maps onto the actual code (labels are English keys, `Ctx` is built in `Editor.tsx`, the right panel is
> `group-active-inspector.ts`) is recorded in `ARCHITECTURE.md` §13.

---

## 1. Intent

Currently, clicking an option in the left panel either inserts a block (tools) or opens a library (templates). 

We need a third interaction pattern: **Click an option in the left panel → show its configuration in the RIGHT panel (Inspector/Properties).** 

This is identical to how Word or Excel works: you click "Margins" in the ribbon, and a dropdown or side panel opens with margin settings, rather than inserting a margin block into the document.

**In this specific task:**
1. We are clearing the existing options inside the `Mise en page` (Layout) section.
2. We are adding a single new option called `Marges` (Margins).
3. Clicking `Marges` does **not** change the left panel view. It keeps the left panel on the `Mise en page` list.
4. Instead, it changes the **right panel** to show the Margins inspector.
5. For now, the Margins inspector will be a placeholder (an empty shell) because the specific features inside it will be built in a later step.

---

## 2. How the Workflow Works (Architecture)

To support this, we extend the `Feature` type with a `target` property. 

- **`target: 'canvas'`** (Default): The feature inserts a block or runs an action.
- **`target: 'left-panel'`**: (Existing library behavior).
- **`target: 'inspector'`**: The feature replaces the right panel's content with its own UI.

When a feature with `target: 'inspector'` is clicked:
1. It updates a global UI state: `activeInspectorId = feature.id`.
2. The left panel remains on the current section.
3. The right panel checks `activeInspectorId` and renders the corresponding UI instead of the default "Réglages de l'examen" or block properties.

---

## 3. Data Model Changes (`core/types.ts`)

Add the `target` field to the `Feature` type. Only additive changes.

```ts
export type Feature<TConfig = unknown> = {
  // ... existing fields ...
  
  /** 
   * Where the feature's UI lives.
   * - 'canvas' (default): runs create/run, inserts into doc.
   * - 'left-panel': opens a library.
   * - 'inspector': replaces the right panel content.
   */
  target?: 'canvas' | 'left-panel' | 'inspector';

  /** Optional: custom render for the right panel. Required if target is 'inspector'. */
  renderInspector?: (props: { ctx: Ctx }) => ReactNode;
};
```

**Rule for future scaling:** Any new option built using the Inspector-Driven Option Workflow must set `target: 'inspector'` and provide a `renderInspector` function. It should *not* provide a `create` or `run` function.

---

## 4. State Management (`Ctx`)

The right panel needs to know what to render. Add this to `Ctx` in `core/types.ts`:

```ts
export type Ctx = {
  // ... existing fields ...
  
  /** The ID of the feature currently occupying the right panel, if any. */
  activeInspectorId: string | null;
  
  /** Opens a feature in the right panel. */
  openInspector: (featureId: string) => void;
  
  /** Closes the active inspector, returning the right panel to default. */
  closeInspector: () => void;
};
```

These must be implemented in your state provider (e.g., `useExam` or a new UI-specific hook).

---

## 5. File Changes

### 1. Update `FeatureRow.tsx`
The click handler must respect the `target`:

```ts
const onClick = () => {
  if (feature.target === 'inspector') {
    ctx.openInspector(feature.id);
    return; // Do NOT change left panel view
  }
  
  if (feature.library) {
    onOpenLibrary(feature.id);
    return;
  }
  
  // ... existing create / run logic ...
};
```
*Also, visually distinguish inspector-driven options slightly if needed (e.g., no "insert" chevron, but a small "settings" icon).*

### 2. Update `RightPanel.tsx` (or equivalent)
The right panel must render an inspector if `ctx.activeInspectorId` is set.

```tsx
// Inside RightPanel
const activeFeature = findFeatureById(ctx.activeInspectorId);

if (activeFeature && activeFeature.renderInspector) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">{activeFeature.label(ctx.t)}</h2>
        <button onClick={ctx.closeInspector}><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {activeFeature.renderInspector({ ctx })}
      </div>
    </div>
  );
}

// ... existing fallback (block properties or exam settings) ...
```

---

## 6. Implementation Steps

Follow these steps exactly. Keep the app runnable at every step.

1. **Clean up `Mise en page`**: 
   - Locate the `layout` section and its options (currently containing `En-tête d'examen`).
   - Delete the existing options inside `Mise en page` (do not delete the section itself).
2. **Add `Marges` Feature**:
   - Create `app/_features/options/layout.margins.ts` (or similar).
   - Export a `Feature` with `id: 'option.layout.margins'`, `label: (t) => t('option.layout.margins')`, `icon: <Move size={20} />` (or similar), and `target: 'inspector'`.
   - Provide a placeholder `renderInspector`: `() => <div className="text-sm text-neutral-500 italic">Les paramètres de marge seront ajoutés ici.</div>`.
3. **Add `Marges` to Section**:
   - Update the `Mise en page` section file to include this new option.
4. **Update State/Ctx**:
   - Add `activeInspectorId`, `openInspector`, and `closeInspector` to the state provider.
5. **Update `FeatureRow`**:
   - Implement the `target === 'inspector'` click logic.
6. **Update `RightPanel`**:
   - Implement the conditional rendering to show `renderInspector` if `activeInspectorId` is set.
7. **Verify**:
   - Click `Mise en page` in the left panel.
   - Click `Marges`. The left panel stays exactly where it is. The right panel changes to show the "Marges" header and the placeholder text.
   - Clicking the `X` on the right panel returns it to normal.

---

## 7. Acceptance Criteria

- [ ] `Mise en page` no longer shows the previous templates (En-tête, etc.) in the left panel.
- [ ] `Mise en page` shows a single option: `Marges`.
- [ ] Clicking `Marges` does **not** navigate the left panel, close the left panel, or insert anything into the canvas.
- [ ] Clicking `Marges` changes the right panel to show a "Marges" inspector with a placeholder body.
- [ ] Clicking the close icon on the right panel returns it to the default "Réglages de l'examen".
- [ ] The `Feature` type in `core/types.ts` supports `target: 'inspector'` and `renderInspector`.
- [ ] `npm run build` and the CI checks pass.
- [ ] No changes are made to the top bar, canvas, or export pipeline.

---

## 8. Note for Future "Inspector-Driven Options"

When the user asks to build the actual Margins features later, or asks to add a new option (e.g., "Page Size" or "Orientation") using this workflow:
1. Create the new feature file.
2. Set `target: 'inspector'`.
3. Build out the `renderInspector` UI.
4. Add it to the section's options array.
5. Ensure `RightPanel` can resolve the ID and render it. 
No other architectural changes will be needed.

**End of directive.**
