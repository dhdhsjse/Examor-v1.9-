// Interface strings of the panel of a function graph (its curve options, its window) and of other screens that share them. The key is the
// English text (see app/_lib/uiLang.tsx); these are merged into the app's dictionaries at the end of app/_lib/uiStrings.ts. Words the app
// already translates (Functions, Remove, Color, Show grid, x from…) are not repeated here. The Arabic words are generic and still to be read
// by a teacher.

export const MATHGRAPH_FR: Record<string, string> = {
  "Curves": "Courbes",
  "Examples": "Exemples",
  "Curve options": "Options de la courbe",
  "Derivative": "Dérivée",
  "Asymptotes": "Asymptotes",
  "No asymptote found in this window": "Aucune asymptote trouvée dans cette fenêtre",
  "Tangent at": "Tangente en",
  "Add a tangent": "Ajouter une tangente",
  "No tangent here": "Pas de tangente ici",
  "Fit to the curves": "Ajuster aux courbes",
  "Choose y so that the curves fit": "Choisir y pour que les courbes tiennent",
  "Usual window": "Fenêtre habituelle",
  "Size on the page": "Taille sur la page",
  "Height (px)": "Hauteur (px)",
};

export const MATHGRAPH_AR: Record<string, string> = {
  "Curves": "منحنيات",
  "Examples": "أمثلة",
  "Curve options": "خيارات المنحنى",
  "Derivative": "الدالة المشتقة",
  "Asymptotes": "المقاربات",
  "No asymptote found in this window": "لا توجد مقاربات في هذه النافذة",
  "Tangent at": "المماس عند",
  "Add a tangent": "إضافة مماس",
  "No tangent here": "لا يوجد مماس هنا",
  "Fit to the curves": "ملاءمة المنحنيات",
  "Choose y so that the curves fit": "اختيار y لتظهر المنحنيات كاملة",
  "Usual window": "النافذة المعتادة",
  "Size on the page": "الحجم في الصفحة",
  "Height (px)": "الارتفاع (px)",
};
