// Search that forgives how a word is written: case, French accents, Arabic short vowels (tashkeel), hamza and alef
// forms, tatweel, ة/ه and ى/ي, Arabic-Indic digits, and the Arabic article "ال". Used by the Library search.

const ARABIC_MARKS = /[ً-ٰٟۖ-ۭـ]/g; // tashkeel, dagger alef, Quranic marks, tatweel
const LATIN_MARKS = /[̀-ͯ]/g; // accents left alone by NFKD (é → e + ◌́)
// (not ? and !: they are the names of two symbols)
const PUNCTUATION = /[\s'’‘`´"“”«»\-–—_.,;:()[\]{}/\\|]+/g;

// One text as the search sees it: lower case, without accents or vowel marks, letters brought to one form.
export function foldText(text: string): string {
  return (
    text
      // (NFKD also splits أ إ آ ؤ ئ into the letter + a hamza/madda mark, and turns Arabic presentation forms into letters)
      .normalize("NFKD")
      .toLowerCase()
      .replace(LATIN_MARKS, "")
      .replace(ARABIC_MARKS, "")
      .replace(/[ٱ-ٳ]/g, "ا") // ٱ ٲ ٳ → ا
      .replace(/[ىی]/g, "ي") // ى ی → ي
      .replace(/ة/g, "ه") // ة → ه
      .replace(/ک/g, "ك") // ک → ك
      .replace(/ء/g, "") // a lone hamza (ماء = ما)
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // ٠-٩ → 0-9
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // ۰-۹ → 0-9
      .replace(/œ/g, "oe")
      .replace(/æ/g, "ae")
      .replace(/ß/g, "ss")
      .replace(/؟/g, "?") // ؟
      .replace(PUNCTUATION, " ")
      .trim()
  );
}

// "التفاح" → "تفاح" (only on words long enough to have it: "الو" stays as typed).
const withoutArticle = (word: string) => (word.length >= 4 && word.startsWith("ال") ? word.slice(2) : word);

// Everything an item can be found by, ready to search: each word as written and without its article.
export function searchTerms(texts: Iterable<string>): string {
  const words = new Set<string>();
  for (const text of texts) {
    for (const word of foldText(text).split(" ")) {
      if (!word) continue;
      words.add(word);
      words.add(withoutArticle(word));
    }
  }
  return ` ${[...words].join(" ")} `;
}

// Every word of the query is found in the terms (anywhere in a word: "pom" finds "pomme"). A word also counts without
// its article ("التفاح") or its plural s ("pommes", "apples").
export function matchesQuery(terms: string, query: string): boolean {
  const words = foldText(query).split(" ").filter(Boolean);
  return words.length > 0 && words.every((w) => {
    if (terms.includes(w)) return true;
    const bare = withoutArticle(w);
    if (bare !== w && terms.includes(bare)) return true;
    return w.length > 3 && (w.endsWith("s") || w.endsWith("x")) && terms.includes(w.slice(0, -1));
  });
}
