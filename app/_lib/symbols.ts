// The symbols of Home → Symbol: letters and signs a teacher of maths, physics, chemistry, French or Arabic needs and cannot type.
// They are plain characters (system fonts draw them, the app works offline); `name` is the English key of the group.

export interface SymbolGroup {
  name: string;
  symbols: string;
}

const chars = (s: string) => [...s.replace(/\s+/g, "")];

export const SYMBOL_GROUPS: SymbolGroup[] = [
  { name: "Greek", symbols: "α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω ϵ ϑ ϕ ς" },
  { name: "Math", symbols: "± ∓ × ÷ · ∙ ≠ ≈ ≅ ≡ ≤ ≥ ≪ ≫ ∞ √ ∛ ∜ ∑ ∏ ∫ ∬ ∮ ∂ ∇ ∆ ∈ ∉ ⊂ ⊃ ⊆ ⊇ ∪ ∩ ∅ ∀ ∃ ∄ ∴ ∵ ∝ ∠ ⟂ ∥ ′ ″ ‰ ¼ ½ ¾ ⅓ ⅔ ⅛ − ⁄ ∘ ⊕ ⊗ ¬ ∧ ∨ ℝ ℕ ℤ ℚ ℂ" },
  { name: "Powers and units", symbols: "⁰ ¹ ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹ ⁺ ⁻ ⁼ ⁽ ⁾ ⁿ ⁱ ₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉ ₊ ₋ ₌ ₍ ₎ ₐ ₑ ₒ ₓ ° ℃ ℉ Å µ Ω ℓ ℏ № ‰" },
  { name: "Arrows", symbols: "← → ↑ ↓ ↔ ↕ ⇐ ⇒ ⇔ ⇑ ⇓ ↦ ⟵ ⟶ ⟷ ⇌ ⇄ ⇋ ↩ ↪ ↗ ↘ ↖ ↙ ↺ ↻" },
  { name: "Accents", symbols: "é è ê ë à â ä î ï ô ö û ù ü ç œ æ ñ ß ø å É È Ê À Â Ç Î Ô Û Œ Æ" },
  { name: "Punctuation", symbols: "« » “ ” ‘ ’ „ ‚ ‹ › … – — • · § ¶ † ‡ © ® ™ ¿ ¡ ¦ ※ ‼ ⁇ ⁈ ⁉" },
  { name: "Shapes and marks", symbols: "✓ ✔ ✗ ✘ ☐ ☑ ☒ ★ ☆ ♠ ♣ ♥ ♦ ● ○ ■ □ ▲ △ ▼ ▽ ◆ ◇ ✎ ✂ ☎ ✉ ☺ ♪" },
  { name: "Currency", symbols: "€ £ $ ¥ ¢ ₹ ₽ ₺ ₩ ₿" },
  { name: "Arabic", symbols: "ء آ أ ؤ إ ئ ا ب ة ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ى ي ـ ً ٌ ٍ َ ُ ِ ّ ْ ٠ ١ ٢ ٣ ٤ ٥ ٦ ٧ ٨ ٩ ، ؛ ؟ ﷲ ﷺ" },
];

export const symbolsOf = (group: SymbolGroup): string[] => chars(group.symbols);

/** "U+03B1": what the tooltip of a symbol says besides the symbol itself. */
export const codePoint = (symbol: string) => `U+${(symbol.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`;

// ---- the ones used last ----

const KEY = "examBuilder.recentSymbols";
export const MAX_RECENT = 16;

/** The symbols inserted last, the latest first (kept in the browser). */
export function loadRecentSymbols(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

/** The list with `symbol` first (and once), for saving. */
export const withRecent = (list: string[], symbol: string) => [symbol, ...list.filter((s) => s !== symbol)].slice(0, MAX_RECENT);

export function saveRecentSymbols(list: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // (storage blocked: the list only lives until the page is closed)
  }
}
