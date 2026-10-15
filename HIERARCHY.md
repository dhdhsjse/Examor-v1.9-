# Screen hierarchy: Feature → Group → Bar → App

Every visible piece of the Exam Builder screen is built from four levels of objects. Each level only holds objects from the level below it.

```
App  (app/_features/app.ts)            the whole screen: an ordered list of bars
 └─ Bar  (app/_features/bars/)          one region: top, left, right, bottom, overlay
     ├─ Feature   (one-off, directly on the bar)
     └─ Group     (app/_features/groups/)   an ordered list of features with a label or menu
         └─ Feature  (app/_features/{tools,actions,toggles,panels,fields,overlays}/)
```

| Level | What it is | Where it lives | Example |
|---|---|---|---|
| **Feature** | The smallest unit: one button, field, panel or overlay. One file, one exported object. | `app/_features/<kind-folder>/` | `toolMathGraph`, `subjectMath`, `undoToggle` |
| **Group** | An ordered list of features under a heading, or a dropdown menu. | `app/_features/groups/` | `mathGroup`, `fileGroup` |
| **Bar** | A region of the screen. It holds groups and a few one-off features. | `app/_features/bars/` | `topBar`, `outilsGenerauxBar` |
| **App** | The full screen: the list of all bars. | `app/_features/app.ts` | `appLayout` |

The rule that holds the structure together: **a feature never imports another feature.** A group imports features. A bar imports groups. The app imports bars. Nothing imports the app except the shell (`app/_components/Editor.tsx`).

---

## 1. Feature

A feature is one thing the user can see or use. It has an `id`, a `kind`, a label, and one way of working:

| `kind` | What it is | Its main function | Example |
|---|---|---|---|
| `tool` | A toolbox tile that adds something to the page. Can also be dragged onto the page. | `run` calls `shell.runTool(action)` | `toolQuestionMcq` |
| `menu-item` | A row inside a dropdown menu. | `run` | `fileSaveAction` |
| `action` | A plain button that runs an action. | `run` | (none yet) |
| `toggle` | A control that shows or changes a setting. | `render` | `subjectMath`, `undoToggle` |
| `field` | An input bound to a value. | `render` | `titleField` |
| `panel` | A block of UI with its own content. | `render` | `inspectorPanel`, `examSummaryPanel` |
| `overlay` | A popup or layer that appears only when open. | `render` (returns `null` when closed) | `pickerOverlay`, `toastOverlay` |

A feature is a plain object, for example:

```ts
// app/_features/tools/tool-question-mcq.tsx
export const toolQuestionMcq: Feature = {
  id: "tool.question.mcq",
  kind: "tool",
  label: "Multiple choice",         // translated automatically
  icon: <McqIcon />,
  tone: "indigo",                   // colour of the tile
  dragPayload: { kind: "block", type: "mcq" },
  run: (ctx) => ctx.shell.runTool({ kind: "block", type: "mcq" }),
};
```

Features read what they need from `ctx`, the context passed in by the renderer:

- `ctx.doc`: the exam document.
- `ctx.shell`: the commands and state the shell offers (`runTool`, `undo`, `setSubject`, …). Features call these; they never keep their own copy of app state.
- `ctx.t`: the translation function.
- `ctx.dir`: `"ltr"` or `"rtl"`.

**Naming:** ids follow `kind.scope.name`, e.g. `tool.math.graph`, `toggle.subject.math`. They must be unique.

---

## 2. Group

A group is an ordered list of features. It can be shown in one of two ways:

- **Section:** a heading and a list of features, e.g. "Questions" with four question tools.
- **Menu:** a dropdown, e.g. "File" or the language picker. Its features become the menu rows.

Groups can also be hidden or filtered:

| Field | Meaning |
|---|---|
| `features` | The features in this group. |
| `order` | Sort position inside the bar. Lower comes first. |
| `label` | Heading text. Omit it for no heading. |
| `when(ctx)` | Show the group only when this returns `true`. Used by the subject groups: the "Math tools" group shows only when Math is selected. |
| `menu` | `true` draws the group as a dropdown. |
| `header(ctx)` | The dropdown's button content, e.g. the File label or the current language code. |
| `className` | Styles for the feature list. |

Example:

```ts
// app/_features/groups/group-questions.ts
export const questionsGroup: Group = {
  id: "group.questions",
  order: 30,
  label: (t) => t("Questions"),
  className: "grid grid-cols-2 gap-2",
  features: [toolQuestionMcq, toolQuestionTrueFalse, toolQuestionBlank, toolQuestionOpen],
};
```

The search box in the toolbox filters the features of a group. A group with no matches disappears.

---

## 3. Bar

A bar is one region of the screen. Its `position` decides where it is drawn:

| `position` | Where | Bars today |
|---|---|---|
| `top` | Across the top of the window | `topBar` |
| `left` | Left column | `outilsGenerauxBar` (the toolbox) |
| `right` | Right column | `rightPanelBar` (Properties and Library) |
| `bottom` | Inside the page area, under the pages | `canvasBar` (math keyboard) |
| `overlay` | Above everything, for popups | `overlayBar` (template picker, preview, history, toast) |

A bar has:

| Field | Meaning |
|---|---|
| `groups` | Groups, drawn in `order`. |
| `features` | One-off features, drawn before the groups. Used for the logo and for overlays, which have no sibling. |
| `className` | The bar's own layout and colours, e.g. `"flex w-[248px] … border-e"`. |
| `collapsible` | `true` lets the user hide the bar. The choice is kept in `shell.hiddenBars`, saved in the browser. The toolbox and the right panel are collapsible; the top bar is not. |

Example:

```ts
// app/_features/bars/bar-top.ts
export const topBar: Bar = {
  id: "bar.top",
  position: "top",
  className: "relative z-20 flex h-11 shrink-0 items-center gap-3 border-b border-line bg-surface px-3",
  features: [brandLogoPanel],
  groups: [fileGroup, titleGroup, subjectsGroup, languageGroup, editGroup, viewGroup, exportGroup],
};
```

---

## 4. App

The app is the list of all bars:

```ts
// app/_features/app.ts
export const appLayout: Bar[] = [topBar, outilsGenerauxBar, canvasBar, rightPanelBar, overlayBar];
```

`app/_components/Editor.tsx` reads this list. It draws each bar where its `position` says:

```tsx
{bars("top")}
<div className="flex min-h-0 flex-1">
  {bars("left")}
  <main>
    <Workspace … />      {/* the page canvas (not yet a feature) */}
    {bars("bottom")}
  </main>
  {bars("right")}
</div>
{bars("overlay")}
```

Because the order and the list are both plain data, reordering the screen or hiding a region is a one-line change here.

---

## 5. The shell and the renderers

Four pieces connect the levels at run time:

- **`Editor.tsx` (the shell):** owns the state (the exam, the subject, the open panels) and the actions. It builds `ctx` and passes it down.
- **`BarRenderer`:** draws one bar: its one-off features, then its groups.
- **`GroupRenderer`:** applies `when` and the search filter, then draws a section or a dropdown.
- **`FeatureRenderer`:** draws one feature according to its `kind`.

The renderers do not know any specific feature. They only read the generic fields (`kind`, `label`, `order`, `when`, `menu`).

---

## 6. Adding something new

**A new tool** touches two files:

1. Create `app/_features/tools/tool-<name>.tsx` with the feature object.
2. Add it to the right group, e.g. `app/_features/groups/group-questions.ts`.

**A new group** touches two files:

1. Create `app/_features/groups/group-<name>.ts` with the group object.
2. Add it to a bar's `groups` in `app/_features/bars/`.

**A new bar** touches two files:

1. Create `app/_features/bars/bar-<name>.ts`.
2. Add it to `appLayout` in `app/_features/app.ts`.

If the new feature needs something the shell does not offer yet (for example, a new editor action), add it to the `Shell` type in `core/types.ts` and implement it in `Editor.tsx`.

---

## 7. Quick reference

- A **feature** is one control or panel. It is a plain object.
- A **group** is a list of features under a heading, or a dropdown.
- A **bar** is a screen region. It holds groups and a few one-off features.
- The **app** is the list of bars, in `app/_features/app.ts`.
- Features get their data and actions from **`ctx`**. They never import each other.
- The **shell** (`Editor.tsx`) is the only place that owns state.

See `ARCHITECTURE.md` for the full rules, and §13 for the places where the code extends the original design.
