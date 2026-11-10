// The picture pack of the Library ("Pictures"): preschool pictures (fruits, animals, the body, numbers, letters…), shapes and
// symbols, instruction pictograms and worksheet templates. Everything about the pack is in this file.
//
// The pictures are SVG files in public/library/<category>/. They are made to print: dark outlines (#1f2328), flat colours
// written as #hex (a black-and-white export turns them grey), no gradients, filters, opacity or outside links, and a
// width/height (160 × 160 for a picture: its size on the page). A picture is read when it is put on the page and the block
// keeps the drawing itself, so the exam does not depend on the file afterwards.
//
// To add a picture: put its .svg in public/library/<category>/, then add one entry to PACK_ITEMS:
//   { id: "fruits-apple", category: "fruits", file: "fruits/apple.svg",
//     names: { en: "Apple", fr: "Pomme", ar: "تفاحة" }, aliases: { en: ["apples"], fr: ["pommes"], ar: ["تفاح"] } },
// `names` is what the card shows (in the app's language); the search finds the item by its names and aliases in all three
// languages, and by its category and subcategory names. The search ignores case, accents, Arabic vowel marks and the
// forms of hamza and alef (see searchText.ts): aliases are for other words, not for other spellings of the same word.

export type PackLang = "en" | "fr" | "ar";
export type Names = Record<PackLang, string>;
export type Aliases = Partial<Record<PackLang, string[]>>;

export interface PackCategory {
  id: string;
  group: "pictures" | "learning"; // its section on the Library's home page
  names: Names;
  aliases?: Aliases;
  subcategories?: { id: string; names: Names; aliases?: Aliases }[];
}

export interface PackItem {
  id: string; // unique in the pack
  category: string; // a PACK_CATEGORIES id
  subcategory?: string; // one of its subcategories (a category with subcategories gives one to each item)
  file: string; // under public/library/
  names: Names;
  aliases?: Aliases;
}

// Where the files are served from.
export const PACK_DIR = "/library/";

export const PACK_CATEGORIES: PackCategory[] = [
  { id: "fruits", group: "pictures", names: { en: "Fruits", fr: "Fruits", ar: "الفواكه" }, aliases: { en: ["fruit"], fr: ["fruit"], ar: ["فاكهة", "فواكه"] } },
  { id: "vegetables", group: "pictures", names: { en: "Vegetables", fr: "Légumes", ar: "الخضر" }, aliases: { en: ["vegetable", "veggies"], fr: ["légume"], ar: ["خضار", "خضروات", "خضرة"] } },
  { id: "food", group: "pictures", names: { en: "Food & drinks", fr: "Aliments et boissons", ar: "الطعام والشراب" }, aliases: { en: ["food", "drink", "meal", "breakfast"], fr: ["nourriture", "aliment", "boisson", "repas"], ar: ["أكل", "طعام", "مشروبات", "فطور"] } },
  {
    id: "animals",
    group: "pictures",
    names: { en: "Animals", fr: "Animaux", ar: "الحيوانات" },
    aliases: { en: ["animal"], fr: ["animal"], ar: ["حيوان"] },
    subcategories: [
      { id: "farm", names: { en: "Farm & pets", fr: "Ferme et compagnie", ar: "حيوانات أليفة" }, aliases: { en: ["farm", "pet", "domestic"], fr: ["ferme", "domestique"], ar: ["الضيعة", "المزرعة", "داجنة"] } },
      { id: "wild", names: { en: "Wild animals", fr: "Animaux sauvages", ar: "حيوانات برية" }, aliases: { en: ["wild", "jungle", "zoo", "savanna"], fr: ["sauvage", "jungle", "zoo", "savane"], ar: ["متوحشة", "الغابة", "وحشية"] } },
      { id: "sea", names: { en: "Sea animals", fr: "Animaux marins", ar: "حيوانات بحرية" }, aliases: { en: ["sea", "ocean", "marine"], fr: ["mer", "océan", "marin"], ar: ["البحر", "المحيط", "مائية"] } },
      { id: "small", names: { en: "Birds & insects", fr: "Oiseaux et insectes", ar: "طيور وحشرات" }, aliases: { en: ["bird", "insect", "bug"], fr: ["oiseau", "insecte"], ar: ["طائر", "حشرة"] } },
    ],
  },
  { id: "body", group: "pictures", names: { en: "Body parts", fr: "Corps humain", ar: "أعضاء الجسم" }, aliases: { en: ["body", "human body"], fr: ["corps", "parties du corps"], ar: ["الجسم", "جسم الإنسان"] } },
  { id: "feelings", group: "pictures", names: { en: "Feelings", fr: "Émotions", ar: "المشاعر" }, aliases: { en: ["emotions", "faces", "mood"], fr: ["sentiments", "visages", "humeur"], ar: ["الأحاسيس", "الانفعالات", "وجوه"] } },
  { id: "clothes", group: "pictures", names: { en: "Clothes", fr: "Vêtements", ar: "الملابس" }, aliases: { en: ["clothing", "wear"], fr: ["habits", "vêtement"], ar: ["لباس", "ملابس", "ثياب"] } },
  { id: "home", group: "pictures", names: { en: "Home & objects", fr: "Maison et objets", ar: "المنزل والأشياء" }, aliases: { en: ["house", "furniture", "objects"], fr: ["meubles", "objets"], ar: ["الدار", "البيت", "أثاث", "أدوات"] } },
  { id: "places", group: "pictures", names: { en: "Places", fr: "Lieux", ar: "الأماكن" }, aliases: { en: ["buildings", "town", "city"], fr: ["bâtiments", "ville"], ar: ["مباني", "المدينة", "أمكنة"] } },
  {
    id: "vehicles",
    group: "pictures",
    names: { en: "Vehicles", fr: "Transports", ar: "وسائل النقل" },
    aliases: { en: ["vehicle", "transport", "transportation"], fr: ["véhicule", "moyens de transport"], ar: ["النقل", "مواصلات", "مركبات"] },
    subcategories: [
      { id: "land", names: { en: "On land", fr: "Sur terre", ar: "برية" }, aliases: { en: ["road"], fr: ["route"], ar: ["الطريق"] } },
      { id: "air", names: { en: "In the air", fr: "Dans les airs", ar: "جوية" }, aliases: { en: ["sky", "fly"], fr: ["ciel", "voler"], ar: ["الجو", "السماء"] } },
      { id: "water", names: { en: "On water", fr: "Sur l'eau", ar: "بحرية" }, aliases: { en: ["sea", "boat"], fr: ["mer"], ar: ["البحر", "الماء"] } },
    ],
  },
  { id: "toys", group: "pictures", names: { en: "Toys & games", fr: "Jouets et jeux", ar: "الألعاب" }, aliases: { en: ["toy", "game", "play"], fr: ["jouet", "jeu", "jouer"], ar: ["لعبة", "لعب"] } },
  { id: "school", group: "pictures", names: { en: "School items", fr: "Fournitures scolaires", ar: "الأدوات المدرسية" }, aliases: { en: ["school", "classroom", "supplies", "stationery"], fr: ["école", "classe", "fournitures", "matériel scolaire"], ar: ["المدرسة", "القسم", "أدوات"] } },
  {
    id: "nature",
    group: "pictures",
    names: { en: "Weather & nature", fr: "Météo et nature", ar: "الطقس والطبيعة" },
    aliases: { en: ["weather", "nature", "seasons"], fr: ["météo", "nature", "saisons", "temps"], ar: ["الطقس", "الطبيعة", "الفصول", "الجو"] },
    subcategories: [
      { id: "weather", names: { en: "Weather", fr: "Météo", ar: "الطقس" }, aliases: { en: ["sky"], fr: ["temps", "ciel"], ar: ["الجو", "السماء"] } },
      { id: "plants", names: { en: "Plants & landscape", fr: "Plantes et paysage", ar: "نباتات ومناظر" }, aliases: { en: ["plant", "landscape"], fr: ["plante", "paysage"], ar: ["نبات", "منظر"] } },
    ],
  },
  { id: "colors", group: "learning", names: { en: "Colors", fr: "Couleurs", ar: "الألوان" }, aliases: { en: ["color", "colour", "colours"], fr: ["couleur"], ar: ["لون", "ألوان"] } },
  {
    id: "shapes",
    group: "learning",
    names: { en: "Shapes", fr: "Formes", ar: "الأشكال" },
    aliases: { en: ["shape", "geometry"], fr: ["forme", "géométrie"], ar: ["شكل", "هندسة", "أشكال هندسية"] },
    subcategories: [
      { id: "flat", names: { en: "Flat shapes", fr: "Formes planes", ar: "أشكال مستوية" }, aliases: { en: ["2d", "plane"], fr: ["2d", "plane"], ar: ["مسطحة"] } },
      { id: "solid", names: { en: "Solids", fr: "Solides", ar: "مجسمات" }, aliases: { en: ["3d", "solid shapes"], fr: ["3d", "volumes"], ar: ["مجسم", "أجسام"] } },
    ],
  },
  {
    id: "numbers",
    group: "learning",
    names: { en: "Numbers", fr: "Nombres", ar: "الأعداد" },
    aliases: { en: ["number", "digit", "counting"], fr: ["nombre", "chiffre", "chiffres"], ar: ["عدد", "رقم", "أرقام"] },
    subcategories: [
      { id: "digits", names: { en: "Numbers 0–20", fr: "Nombres 0–20", ar: "الأعداد 0–20" }, aliases: { en: ["digits"], fr: ["chiffres"], ar: ["أرقام"] } },
      { id: "eastern", names: { en: "Eastern Arabic digits ٠–٢٠", fr: "Chiffres arabes orientaux ٠–٢٠", ar: "الأرقام المشرقية ٠–٢٠" }, aliases: { en: ["eastern arabic", "hindi numerals", "arabic indic"], fr: ["arabes orientaux", "indiens"], ar: ["المشرقية", "الهندية"] } },
      { id: "counting", names: { en: "Counting dots", fr: "Constellations", ar: "عدّ النقاط" }, aliases: { en: ["dots", "count", "dice"], fr: ["points", "dé", "compter"], ar: ["نقاط", "عد", "نرد"] } },
    ],
  },
  {
    id: "fractions",
    group: "learning",
    names: { en: "Fractions", fr: "Fractions", ar: "الكسور" },
    aliases: { en: ["fraction", "parts", "share"], fr: ["fraction", "partage"], ar: ["كسر", "أجزاء"] },
    subcategories: [
      { id: "circles", names: { en: "Circles", fr: "Disques", ar: "دوائر" }, aliases: { en: ["pie", "pizza"], fr: ["camembert", "pizza"], ar: ["قرص"] } },
      { id: "bars", names: { en: "Bars", fr: "Bandes", ar: "أشرطة" }, aliases: { en: ["strip", "bar model"], fr: ["barres"], ar: ["شريط"] } },
    ],
  },
  {
    id: "time",
    group: "learning",
    names: { en: "Time", fr: "L'heure", ar: "الوقت" },
    aliases: { en: ["clock", "hours", "telling time"], fr: ["horloge", "heures", "lire l'heure"], ar: ["الساعة", "الزمن", "قراءة الساعة"] },
    subcategories: [
      { id: "oclock", names: { en: "O'clock", fr: "Heures pile", ar: "الساعة تماما" }, aliases: { en: ["exactly"], fr: ["pile"], ar: ["تماما", "بالضبط"] } },
      { id: "half", names: { en: "Half past", fr: "Et demie", ar: "والنصف" }, aliases: { en: ["half", "thirty"], fr: ["demie", "trente"], ar: ["النصف", "نصف"] } },
    ],
  },
  {
    id: "letters",
    group: "learning",
    names: { en: "Letters", fr: "Lettres", ar: "الحروف" },
    aliases: { en: ["letter", "alphabet"], fr: ["lettre", "alphabet"], ar: ["حرف", "الأبجدية", "حروف"] },
    subcategories: [
      { id: "latin", names: { en: "Latin alphabet", fr: "Alphabet latin", ar: "الحروف اللاتينية" }, aliases: { en: ["latin", "english", "french", "abc"], fr: ["latin", "français", "abc"], ar: ["اللاتينية", "الفرنسية"] } },
      { id: "arabic", names: { en: "Arabic alphabet", fr: "Alphabet arabe", ar: "الحروف العربية" }, aliases: { en: ["arabic"], fr: ["arabe"], ar: ["العربية", "الهجائية"] } },
    ],
  },
  {
    id: "symbols",
    group: "learning",
    names: { en: "Symbols", fr: "Symboles", ar: "الرموز" },
    aliases: { en: ["symbol", "sign", "icon"], fr: ["symbole", "signe", "icône"], ar: ["رمز", "علامة", "إشارة"] },
    subcategories: [
      { id: "marks", names: { en: "Marks & faces", fr: "Marques et visages", ar: "علامات ووجوه" }, aliases: { en: ["marks", "feedback", "emoji"], fr: ["évaluation", "émoji"], ar: ["تقييم", "وجوه"] } },
      { id: "arrows", names: { en: "Arrows", fr: "Flèches", ar: "أسهم" }, aliases: { en: ["arrow", "direction"], fr: ["flèche", "direction"], ar: ["سهم", "اتجاه"] } },
      { id: "math", names: { en: "Math signs", fr: "Signes mathématiques", ar: "رموز رياضية" }, aliases: { en: ["math", "operations", "operators"], fr: ["maths", "opérations"], ar: ["رياضيات", "عمليات", "حساب"] } },
    ],
  },
  { id: "instructions", group: "learning", names: { en: "Instructions", fr: "Consignes", ar: "التعليمات" }, aliases: { en: ["instruction", "pictogram", "task"], fr: ["consigne", "pictogramme"], ar: ["تعليمة", "رموز التعليمات", "توجيهات"] } },
  {
    id: "templates",
    group: "learning",
    names: { en: "Templates", fr: "Modèles", ar: "قوالب" },
    aliases: { en: ["template", "worksheet"], fr: ["modèle", "fiche"], ar: ["قالب", "نموذج", "ورقة عمل"] },
    subcategories: [
      { id: "writing", names: { en: "Writing", fr: "Écriture", ar: "الكتابة" }, aliases: { en: ["write", "lines"], fr: ["écrire", "lignes"], ar: ["سطور", "خط"] } },
      { id: "math", names: { en: "Math", fr: "Maths", ar: "الرياضيات" }, aliases: { en: ["numbers"], fr: ["nombres", "mathématiques"], ar: ["أعداد", "حساب"] } },
      { id: "organizers", names: { en: "Organizers", fr: "Organisateurs", ar: "منظمات" }, aliases: { en: ["layout", "boxes"], fr: ["cases", "mise en page"], ar: ["خانات", "تنظيم"] } },
    ],
  },
];

// The pictures drawn one by one.
const DRAWN: PackItem[] = [
  // ---- Fruits ----
  { id: "fruits-apple", category: "fruits", file: "fruits/apple.svg", names: { en: "Apple", fr: "Pomme", ar: "تفاحة" }, aliases: { en: ["apples"], fr: ["pommes"], ar: ["تفاح", "تفّاحة"] } },
  { id: "fruits-banana", category: "fruits", file: "fruits/banana.svg", names: { en: "Banana", fr: "Banane", ar: "موزة" }, aliases: { en: ["bananas"], fr: ["bananes"], ar: ["موز"] } },
  { id: "fruits-orange", category: "fruits", file: "fruits/orange.svg", names: { en: "Orange", fr: "Orange", ar: "برتقالة" }, aliases: { en: ["oranges"], fr: ["oranges"], ar: ["برتقال", "ليمون حلو"] } },
  { id: "fruits-strawberry", category: "fruits", file: "fruits/strawberry.svg", names: { en: "Strawberry", fr: "Fraise", ar: "فراولة" }, aliases: { en: ["strawberries"], fr: ["fraises"], ar: ["فريز", "فريزة"] } },
  { id: "fruits-grapes", category: "fruits", file: "fruits/grapes.svg", names: { en: "Grapes", fr: "Raisin", ar: "عنب" }, aliases: { en: ["grape", "bunch of grapes"], fr: ["raisins", "grappe"], ar: ["عنقود", "عنبة"] } },
  { id: "fruits-pear", category: "fruits", file: "fruits/pear.svg", names: { en: "Pear", fr: "Poire", ar: "إجاصة" }, aliases: { en: ["pears"], fr: ["poires"], ar: ["إجاص", "كمثرى", "لنجاص"] } },
  { id: "fruits-watermelon", category: "fruits", file: "fruits/watermelon.svg", names: { en: "Watermelon", fr: "Pastèque", ar: "بطيخة" }, aliases: { en: ["melon"], fr: ["melon d'eau"], ar: ["بطيخ", "دلاح", "دلاحة"] } },
  { id: "fruits-lemon", category: "fruits", file: "fruits/lemon.svg", names: { en: "Lemon", fr: "Citron", ar: "ليمونة" }, aliases: { en: ["lemons", "lime"], fr: ["citrons"], ar: ["ليمون", "حامض"] } },
  { id: "fruits-cherries", category: "fruits", file: "fruits/cherries.svg", names: { en: "Cherries", fr: "Cerises", ar: "كرز" }, aliases: { en: ["cherry"], fr: ["cerise"], ar: ["كرزة", "حب الملوك"] } },
  { id: "fruits-pineapple", category: "fruits", file: "fruits/pineapple.svg", names: { en: "Pineapple", fr: "Ananas", ar: "أناناس" }, aliases: { en: ["ananas"] } },
  { id: "fruits-pomegranate", category: "fruits", file: "fruits/pomegranate.svg", names: { en: "Pomegranate", fr: "Grenade", ar: "رمانة" }, aliases: { ar: ["رمان"] } },
  { id: "fruits-dates", category: "fruits", file: "fruits/dates.svg", names: { en: "Dates", fr: "Dattes", ar: "تمر" }, aliases: { en: ["date fruit"], fr: ["datte"], ar: ["تمرة", "تمور"] } },
  { id: "fruits-peach", category: "fruits", file: "fruits/peach.svg", names: { en: "Peach", fr: "Pêche", ar: "خوخة" }, aliases: { en: ["peaches"], fr: ["pêches"], ar: ["خوخ", "دراق"] } },
  { id: "fruits-mango", category: "fruits", file: "fruits/mango.svg", names: { en: "Mango", fr: "Mangue", ar: "مانجو" }, aliases: { en: ["mangoes"], fr: ["mangues"], ar: ["منجة", "مانغو"] } },
  { id: "fruits-kiwi", category: "fruits", file: "fruits/kiwi.svg", names: { en: "Kiwi", fr: "Kiwi", ar: "كيوي" }, aliases: { en: ["kiwi fruit"] } },
  { id: "fruits-coconut", category: "fruits", file: "fruits/coconut.svg", names: { en: "Coconut", fr: "Noix de coco", ar: "جوز الهند" }, aliases: { fr: ["coco"], ar: ["كوكو"] } },
  { id: "fruits-fig", category: "fruits", file: "fruits/fig.svg", names: { en: "Fig", fr: "Figue", ar: "تينة" }, aliases: { en: ["figs"], fr: ["figues"], ar: ["تين", "كرموس", "كرموسة"] } },
  { id: "fruits-melon", category: "fruits", file: "fruits/melon.svg", names: { en: "Melon", fr: "Melon", ar: "شمام" }, aliases: { en: ["cantaloupe"], ar: ["بطيخ أصفر"] } },

  // ---- Vegetables ----
  { id: "veg-carrot", category: "vegetables", file: "vegetables/carrot.svg", names: { en: "Carrot", fr: "Carotte", ar: "جزرة" }, aliases: { en: ["carrots"], fr: ["carottes"], ar: ["جزر"] } },
  { id: "veg-tomato", category: "vegetables", file: "vegetables/tomato.svg", names: { en: "Tomato", fr: "Tomate", ar: "طماطم" }, aliases: { en: ["tomatoes"], fr: ["tomates"], ar: ["طماطة", "بندورة", "مطيشة"] } },
  { id: "veg-potato", category: "vegetables", file: "vegetables/potato.svg", names: { en: "Potato", fr: "Pomme de terre", ar: "بطاطس" }, aliases: { en: ["potatoes"], fr: ["patate", "pommes de terre"], ar: ["بطاطا", "بطاطة"] } },
  { id: "veg-onion", category: "vegetables", file: "vegetables/onion.svg", names: { en: "Onion", fr: "Oignon", ar: "بصلة" }, aliases: { en: ["onions"], fr: ["oignons"], ar: ["بصل"] } },
  { id: "veg-cucumber", category: "vegetables", file: "vegetables/cucumber.svg", names: { en: "Cucumber", fr: "Concombre", ar: "خيارة" }, aliases: { en: ["cucumbers"], fr: ["concombres"], ar: ["خيار"] } },
  { id: "veg-pepper", category: "vegetables", file: "vegetables/pepper.svg", names: { en: "Pepper", fr: "Poivron", ar: "فلفل" }, aliases: { en: ["bell pepper", "capsicum"], fr: ["piment"], ar: ["فلفلة", "فلفل حلو"] } },
  { id: "veg-eggplant", category: "vegetables", file: "vegetables/eggplant.svg", names: { en: "Eggplant", fr: "Aubergine", ar: "باذنجان" }, aliases: { en: ["aubergine"], fr: ["aubergines"], ar: ["باذنجانة", "بدنجال"] } },
  { id: "veg-corn", category: "vegetables", file: "vegetables/corn.svg", names: { en: "Corn", fr: "Maïs", ar: "ذرة" }, aliases: { en: ["maize", "corn cob"], fr: ["épi de maïs"], ar: ["كوز ذرة", "درة"] } },
  { id: "veg-broccoli", category: "vegetables", file: "vegetables/broccoli.svg", names: { en: "Broccoli", fr: "Brocoli", ar: "بروكلي" }, aliases: { fr: ["brocolis"], ar: ["قرنبيط أخضر"] } },
  { id: "veg-pumpkin", category: "vegetables", file: "vegetables/pumpkin.svg", names: { en: "Pumpkin", fr: "Citrouille", ar: "يقطين" }, aliases: { en: ["squash"], fr: ["potiron", "courge"], ar: ["قرع", "يقطينة", "كرعة"] } },
  { id: "veg-peas", category: "vegetables", file: "vegetables/peas.svg", names: { en: "Peas", fr: "Petits pois", ar: "بازلاء" }, aliases: { en: ["pea", "green peas", "pea pod"], fr: ["pois", "cosse"], ar: ["جلبانة", "جلبان", "بسلة"] } },
  { id: "veg-garlic", category: "vegetables", file: "vegetables/garlic.svg", names: { en: "Garlic", fr: "Ail", ar: "ثوم" }, aliases: { fr: ["gousse d'ail"], ar: ["ثومة"] } },
  { id: "veg-lettuce", category: "vegetables", file: "vegetables/lettuce.svg", names: { en: "Lettuce", fr: "Salade", ar: "خس" }, aliases: { en: ["salad"], fr: ["laitue"], ar: ["خسة", "شلاضة"] } },
  { id: "veg-mushroom", category: "vegetables", file: "vegetables/mushroom.svg", names: { en: "Mushroom", fr: "Champignon", ar: "فطر" }, aliases: { en: ["mushrooms"], fr: ["champignons"], ar: ["فقاع", "فطريات"] } },
  { id: "veg-radish", category: "vegetables", file: "vegetables/radish.svg", names: { en: "Radish", fr: "Radis", ar: "فجل" }, aliases: { en: ["radishes"], ar: ["فجلة"] } },
  { id: "veg-cabbage", category: "vegetables", file: "vegetables/cabbage.svg", names: { en: "Cabbage", fr: "Chou", ar: "ملفوف" }, aliases: { ar: ["كرنب", "كرومب"] } },
  { id: "veg-zucchini", category: "vegetables", file: "vegetables/zucchini.svg", names: { en: "Zucchini", fr: "Courgette", ar: "كوسة" }, aliases: { en: ["courgette"], fr: ["courgettes"], ar: ["قرعة خضراء", "كوسا"] } },
  { id: "veg-beans", category: "vegetables", file: "vegetables/beans.svg", names: { en: "Green beans", fr: "Haricots verts", ar: "لوبيا خضراء" }, aliases: { en: ["beans"], fr: ["haricots"], ar: ["لوبيا", "فاصوليا"] } },

  // ---- Animals ----
  { id: "animals-cow", category: "animals", subcategory: "farm", file: "animals/cow.svg", names: { en: "Cow", fr: "Vache", ar: "بقرة" }, aliases: { en: ["cattle"], fr: ["vaches"], ar: ["بقر"] } },
  { id: "animals-sheep", category: "animals", subcategory: "farm", file: "animals/sheep.svg", names: { en: "Sheep", fr: "Mouton", ar: "خروف" }, aliases: { en: ["lamb", "ram"], fr: ["agneau", "brebis"], ar: ["كبش", "نعجة", "حولي", "خرفان"] } },
  { id: "animals-chicken", category: "animals", subcategory: "farm", file: "animals/chicken.svg", names: { en: "Hen", fr: "Poule", ar: "دجاجة" }, aliases: { en: ["chicken"], fr: ["poulet"], ar: ["دجاج"] } },
  { id: "animals-horse", category: "animals", subcategory: "farm", file: "animals/horse.svg", names: { en: "Horse", fr: "Cheval", ar: "حصان" }, aliases: { en: ["pony"], fr: ["jument", "poney"], ar: ["فرس", "خيل", "عود"] } },
  { id: "animals-duck", category: "animals", subcategory: "farm", file: "animals/duck.svg", names: { en: "Duck", fr: "Canard", ar: "بطة" }, aliases: { en: ["duckling"], fr: ["caneton"], ar: ["بط"] } },
  { id: "animals-rabbit", category: "animals", subcategory: "farm", file: "animals/rabbit.svg", names: { en: "Rabbit", fr: "Lapin", ar: "أرنب" }, aliases: { en: ["bunny"], fr: ["lapins"], ar: ["أرانب"] } },
  { id: "animals-cat", category: "animals", subcategory: "farm", file: "animals/cat.svg", names: { en: "Cat", fr: "Chat", ar: "قطة" }, aliases: { en: ["kitten", "kitty"], fr: ["chaton", "chatte"], ar: ["قط", "هر", "هرة", "مش"] } },
  { id: "animals-dog", category: "animals", subcategory: "farm", file: "animals/dog.svg", names: { en: "Dog", fr: "Chien", ar: "كلب" }, aliases: { en: ["puppy"], fr: ["chiot"], ar: ["جرو"] } },
  { id: "animals-goat", category: "animals", subcategory: "farm", file: "animals/goat.svg", names: { en: "Goat", fr: "Chèvre", ar: "ماعز" }, aliases: { en: ["kid"], fr: ["bouc", "chevreau"], ar: ["عنزة", "معزة", "جدي"] } },
  { id: "animals-donkey", category: "animals", subcategory: "farm", file: "animals/donkey.svg", names: { en: "Donkey", fr: "Âne", ar: "حمار" }, aliases: { fr: ["ânesse"], ar: ["حمير"] } },
  { id: "animals-rooster", category: "animals", subcategory: "farm", file: "animals/rooster.svg", names: { en: "Rooster", fr: "Coq", ar: "ديك" }, aliases: { en: ["cock"], ar: ["ديوك"] } },
  { id: "animals-mouse", category: "animals", subcategory: "farm", file: "animals/mouse.svg", names: { en: "Mouse", fr: "Souris", ar: "فأر" }, aliases: { en: ["mice"], ar: ["فار", "فئران"] } },
  { id: "animals-lion", category: "animals", subcategory: "wild", file: "animals/lion.svg", names: { en: "Lion", fr: "Lion", ar: "أسد" }, aliases: { fr: ["lionne"], ar: ["سبع", "ليث"] } },
  { id: "animals-elephant", category: "animals", subcategory: "wild", file: "animals/elephant.svg", names: { en: "Elephant", fr: "Éléphant", ar: "فيل" }, aliases: { ar: ["فيلة"] } },
  { id: "animals-giraffe", category: "animals", subcategory: "wild", file: "animals/giraffe.svg", names: { en: "Giraffe", fr: "Girafe", ar: "زرافة" } },
  { id: "animals-monkey", category: "animals", subcategory: "wild", file: "animals/monkey.svg", names: { en: "Monkey", fr: "Singe", ar: "قرد" }, aliases: { en: ["ape"], ar: ["قردة", "شادي"] } },
  { id: "animals-zebra", category: "animals", subcategory: "wild", file: "animals/zebra.svg", names: { en: "Zebra", fr: "Zèbre", ar: "حمار وحشي" }, aliases: { ar: ["حمار الوحش"] } },
  { id: "animals-bear", category: "animals", subcategory: "wild", file: "animals/bear.svg", names: { en: "Bear", fr: "Ours", ar: "دب" }, aliases: { en: ["teddy bear"], fr: ["ourson"], ar: ["دبدوب"] } },
  { id: "animals-camel", category: "animals", subcategory: "wild", file: "animals/camel.svg", names: { en: "Camel", fr: "Chameau", ar: "جمل" }, aliases: { en: ["dromedary"], fr: ["dromadaire"], ar: ["ناقة", "بعير"] } },
  { id: "animals-tiger", category: "animals", subcategory: "wild", file: "animals/tiger.svg", names: { en: "Tiger", fr: "Tigre", ar: "نمر" }, aliases: { ar: ["ببر"] } },
  { id: "animals-fox", category: "animals", subcategory: "wild", file: "animals/fox.svg", names: { en: "Fox", fr: "Renard", ar: "ثعلب" }, aliases: { ar: ["تعلب"] } },
  { id: "animals-snake", category: "animals", subcategory: "wild", file: "animals/snake.svg", names: { en: "Snake", fr: "Serpent", ar: "ثعبان" }, aliases: { en: ["serpent"], ar: ["أفعى", "حنش"] } },
  { id: "animals-crocodile", category: "animals", subcategory: "wild", file: "animals/crocodile.svg", names: { en: "Crocodile", fr: "Crocodile", ar: "تمساح" }, aliases: { en: ["alligator"], ar: ["تماسيح"] } },
  { id: "animals-penguin", category: "animals", subcategory: "wild", file: "animals/penguin.svg", names: { en: "Penguin", fr: "Manchot", ar: "بطريق" }, aliases: { fr: ["pingouin"], ar: ["بطريق قطبي"] } },
  { id: "animals-fish", category: "animals", subcategory: "sea", file: "animals/fish.svg", names: { en: "Fish", fr: "Poisson", ar: "سمكة" }, aliases: { fr: ["poissons"], ar: ["سمك"] } },
  { id: "animals-whale", category: "animals", subcategory: "sea", file: "animals/whale.svg", names: { en: "Whale", fr: "Baleine", ar: "حوت" }, aliases: { ar: ["حوت أزرق"] } },
  { id: "animals-octopus", category: "animals", subcategory: "sea", file: "animals/octopus.svg", names: { en: "Octopus", fr: "Pieuvre", ar: "أخطبوط" }, aliases: { fr: ["poulpe"], ar: ["أخطبوط بحري"] } },
  { id: "animals-crab", category: "animals", subcategory: "sea", file: "animals/crab.svg", names: { en: "Crab", fr: "Crabe", ar: "سلطعون" }, aliases: { ar: ["سرطان البحر", "قبقوب"] } },
  { id: "animals-turtle", category: "animals", subcategory: "sea", file: "animals/turtle.svg", names: { en: "Turtle", fr: "Tortue", ar: "سلحفاة" }, aliases: { en: ["tortoise", "sea turtle"], fr: ["tortue de mer"], ar: ["فكرون"] } },
  { id: "animals-starfish", category: "animals", subcategory: "sea", file: "animals/starfish.svg", names: { en: "Starfish", fr: "Étoile de mer", ar: "نجم البحر" }, aliases: { en: ["sea star"], ar: ["نجمة البحر"] } },
  { id: "animals-jellyfish", category: "animals", subcategory: "sea", file: "animals/jellyfish.svg", names: { en: "Jellyfish", fr: "Méduse", ar: "قنديل البحر" }, aliases: { ar: ["قنديل"] } },
  { id: "animals-shark", category: "animals", subcategory: "sea", file: "animals/shark.svg", names: { en: "Shark", fr: "Requin", ar: "قرش" }, aliases: { ar: ["سمك القرش"] } },
  { id: "animals-seahorse", category: "animals", subcategory: "sea", file: "animals/seahorse.svg", names: { en: "Seahorse", fr: "Hippocampe", ar: "حصان البحر" }, aliases: { fr: ["cheval de mer"], ar: ["فرس البحر الصغير"] } },
  { id: "animals-bird", category: "animals", subcategory: "small", file: "animals/bird.svg", names: { en: "Bird", fr: "Oiseau", ar: "عصفور" }, aliases: { en: ["birds"], fr: ["oiseaux"], ar: ["طائر", "طير", "عصفورة"] } },
  { id: "animals-owl", category: "animals", subcategory: "small", file: "animals/owl.svg", names: { en: "Owl", fr: "Hibou", ar: "بومة" }, aliases: { fr: ["chouette"], ar: ["بوم"] } },
  { id: "animals-butterfly", category: "animals", subcategory: "small", file: "animals/butterfly.svg", names: { en: "Butterfly", fr: "Papillon", ar: "فراشة" }, aliases: { ar: ["فراش"] } },
  { id: "animals-bee", category: "animals", subcategory: "small", file: "animals/bee.svg", names: { en: "Bee", fr: "Abeille", ar: "نحلة" }, aliases: { en: ["honeybee"], ar: ["نحل"] } },
  { id: "animals-ladybug", category: "animals", subcategory: "small", file: "animals/ladybug.svg", names: { en: "Ladybug", fr: "Coccinelle", ar: "دعسوقة" }, aliases: { en: ["ladybird"], ar: ["خنفساء الدعسوقة"] } },
  { id: "animals-snail", category: "animals", subcategory: "small", file: "animals/snail.svg", names: { en: "Snail", fr: "Escargot", ar: "حلزون" }, aliases: { ar: ["حلزونة", "بوجغلالة"] } },
  { id: "animals-ant", category: "animals", subcategory: "small", file: "animals/ant.svg", names: { en: "Ant", fr: "Fourmi", ar: "نملة" }, aliases: { en: ["ants"], fr: ["fourmis"], ar: ["نمل"] } },
  { id: "animals-spider", category: "animals", subcategory: "small", file: "animals/spider.svg", names: { en: "Spider", fr: "Araignée", ar: "عنكبوت" }, aliases: { en: ["web"], fr: ["toile"], ar: ["رتيلة"] } },
  { id: "animals-caterpillar", category: "animals", subcategory: "small", file: "animals/caterpillar.svg", names: { en: "Caterpillar", fr: "Chenille", ar: "يرقة" }, aliases: { en: ["worm"], fr: ["ver"], ar: ["دودة", "يسروع"] } },
  { id: "animals-parrot", category: "animals", subcategory: "small", file: "animals/parrot.svg", names: { en: "Parrot", fr: "Perroquet", ar: "ببغاء" }, aliases: { ar: ["بباغ"] } },
  { id: "animals-frog", category: "animals", subcategory: "small", file: "animals/frog.svg", names: { en: "Frog", fr: "Grenouille", ar: "ضفدع" }, aliases: { en: ["toad"], fr: ["crapaud"], ar: ["ضفدعة", "جرانة"] } },

  // ---- Body parts ----
  { id: "body-face", category: "body", file: "body/face.svg", names: { en: "Face", fr: "Visage", ar: "وجه" }, aliases: { en: ["head"], fr: ["tête", "figure"], ar: ["رأس"] } },
  { id: "body-eye", category: "body", file: "body/eye.svg", names: { en: "Eye", fr: "Œil", ar: "عين" }, aliases: { en: ["eyes", "see"], fr: ["yeux", "voir"], ar: ["عينان", "عيون", "البصر"] } },
  { id: "body-ear", category: "body", file: "body/ear.svg", names: { en: "Ear", fr: "Oreille", ar: "أذن" }, aliases: { en: ["ears", "hear"], fr: ["oreilles", "entendre"], ar: ["أذنان", "ودن", "السمع"] } },
  { id: "body-nose", category: "body", file: "body/nose.svg", names: { en: "Nose", fr: "Nez", ar: "أنف" }, aliases: { en: ["smell"], fr: ["odorat"], ar: ["الشم"] } },
  { id: "body-mouth", category: "body", file: "body/mouth.svg", names: { en: "Mouth", fr: "Bouche", ar: "فم" }, aliases: { en: ["lips", "smile"], fr: ["lèvres", "sourire"], ar: ["شفاه", "شفتان"] } },
  { id: "body-tooth", category: "body", file: "body/tooth.svg", names: { en: "Tooth", fr: "Dent", ar: "سن" }, aliases: { en: ["teeth"], fr: ["dents"], ar: ["أسنان", "ضرس"] } },
  { id: "body-tongue", category: "body", file: "body/tongue.svg", names: { en: "Tongue", fr: "Langue", ar: "لسان" }, aliases: { en: ["taste"], fr: ["goût"], ar: ["الذوق"] } },
  { id: "body-hand", category: "body", file: "body/hand.svg", names: { en: "Hand", fr: "Main", ar: "يد" }, aliases: { en: ["fingers", "palm", "touch"], fr: ["doigts", "toucher"], ar: ["كف", "أصابع", "اللمس"] } },
  { id: "body-foot", category: "body", file: "body/foot.svg", names: { en: "Foot", fr: "Pied", ar: "قدم" }, aliases: { en: ["feet", "toes"], fr: ["pieds", "orteils"], ar: ["أقدام", "أصابع القدم"] } },
  { id: "body-leg", category: "body", file: "body/leg.svg", names: { en: "Leg", fr: "Jambe", ar: "رجل" }, aliases: { en: ["knee", "legs"], fr: ["genou", "jambes"], ar: ["ساق", "ركبة"] } },
  { id: "body-arm", category: "body", file: "body/arm.svg", names: { en: "Arm", fr: "Bras", ar: "ذراع" }, aliases: { en: ["elbow"], fr: ["coude"], ar: ["ساعد", "مرفق"] } },
  { id: "body-hair", category: "body", file: "body/hair.svg", names: { en: "Hair", fr: "Cheveux", ar: "شعر" }, aliases: { en: ["haircut"], fr: ["coiffure"], ar: ["الشعر"] } },
  { id: "body-boy", category: "body", file: "body/boy.svg", names: { en: "Body (boy)", fr: "Corps (garçon)", ar: "جسم الولد" }, aliases: { en: ["boy", "child", "kid", "label the body"], fr: ["garçon", "enfant", "schéma du corps"], ar: ["ولد", "طفل", "تلميذ"] } },
  { id: "body-girl", category: "body", file: "body/girl.svg", names: { en: "Body (girl)", fr: "Corps (fille)", ar: "جسم البنت" }, aliases: { en: ["girl", "child", "kid", "label the body"], fr: ["fille", "enfant", "schéma du corps"], ar: ["بنت", "طفلة", "تلميذة"] } },

  // ---- Clothes ----
  { id: "clothes-tshirt", category: "clothes", file: "clothes/tshirt.svg", names: { en: "T-shirt", fr: "T-shirt", ar: "قميص" }, aliases: { en: ["shirt", "tee"], fr: ["tee-shirt", "maillot"], ar: ["تيشرت", "تريكو"] } },
  { id: "clothes-pants", category: "clothes", file: "clothes/pants.svg", names: { en: "Trousers", fr: "Pantalon", ar: "سروال" }, aliases: { en: ["pants", "jeans"], fr: ["jean"], ar: ["بنطلون", "سراويل"] } },
  { id: "clothes-shorts", category: "clothes", file: "clothes/shorts.svg", names: { en: "Shorts", fr: "Short", ar: "سروال قصير" }, aliases: { fr: ["bermuda"], ar: ["شورت"] } },
  { id: "clothes-dress", category: "clothes", file: "clothes/dress.svg", names: { en: "Dress", fr: "Robe", ar: "فستان" }, aliases: { ar: ["كسوة", "روبة"] } },
  { id: "clothes-skirt", category: "clothes", file: "clothes/skirt.svg", names: { en: "Skirt", fr: "Jupe", ar: "تنورة" }, aliases: { ar: ["صاية", "جيب"] } },
  { id: "clothes-shoes", category: "clothes", file: "clothes/shoes.svg", names: { en: "Shoe", fr: "Chaussure", ar: "حذاء" }, aliases: { en: ["shoes", "sneakers", "trainers"], fr: ["chaussures", "basket", "soulier"], ar: ["صباط", "أحذية", "سبرديلة"] } },
  { id: "clothes-socks", category: "clothes", file: "clothes/socks.svg", names: { en: "Sock", fr: "Chaussette", ar: "جورب" }, aliases: { en: ["socks"], fr: ["chaussettes"], ar: ["جوارب", "تقاشر", "تقشيرة"] } },
  { id: "clothes-hat", category: "clothes", file: "clothes/hat.svg", names: { en: "Hat", fr: "Chapeau", ar: "قبعة" }, aliases: { en: ["sun hat"], fr: ["chapeaux"], ar: ["شاشية", "طربوش", "ترازة"] } },
  { id: "clothes-cap", category: "clothes", file: "clothes/cap.svg", names: { en: "Cap", fr: "Casquette", ar: "قبعة رياضية" }, aliases: { en: ["baseball cap"], ar: ["كاسكيطة", "كسكيطة"] } },
  { id: "clothes-scarf", category: "clothes", file: "clothes/scarf.svg", names: { en: "Scarf", fr: "Écharpe", ar: "وشاح" }, aliases: { fr: ["foulard", "cache-col"], ar: ["شال", "كاشكول"] } },
  { id: "clothes-mitten", category: "clothes", file: "clothes/mitten.svg", names: { en: "Mitten", fr: "Moufle", ar: "قفاز" }, aliases: { en: ["glove", "gloves", "mittens"], fr: ["gant", "gants", "moufles"], ar: ["قفازات", "ليكة"] } },
  { id: "clothes-jacket", category: "clothes", file: "clothes/jacket.svg", names: { en: "Jacket", fr: "Veste", ar: "سترة" }, aliases: { en: ["coat"], fr: ["manteau", "blouson"], ar: ["جاكيط", "معطف"] } },
  { id: "clothes-boots", category: "clothes", file: "clothes/boots.svg", names: { en: "Boots", fr: "Bottes", ar: "جزمة" }, aliases: { en: ["boot", "rain boots"], fr: ["botte"], ar: ["حذاء طويل", "بوط"] } },
  { id: "clothes-sandals", category: "clothes", file: "clothes/sandals.svg", names: { en: "Sandal", fr: "Sandale", ar: "صندل" }, aliases: { en: ["sandals", "flip-flop"], fr: ["sandales", "tong"], ar: ["نعل", "صندالة", "شلاكة"] } },
  { id: "clothes-djellaba", category: "clothes", file: "clothes/djellaba.svg", names: { en: "Djellaba", fr: "Djellaba", ar: "جلابة" }, aliases: { en: ["jellaba", "robe"], fr: ["gandoura"], ar: ["جلابية", "قشابة"] } },
  { id: "clothes-glasses", category: "clothes", file: "clothes/glasses.svg", names: { en: "Glasses", fr: "Lunettes", ar: "نظارات" }, aliases: { en: ["spectacles", "sunglasses"], fr: ["lunettes de soleil"], ar: ["نظارة", "منظار"] } },

  // ---- Vehicles ----
  { id: "vehicles-car", category: "vehicles", subcategory: "land", file: "vehicles/car.svg", names: { en: "Car", fr: "Voiture", ar: "سيارة" }, aliases: { en: ["automobile"], fr: ["auto"], ar: ["طوموبيل", "طونوبيل"] } },
  { id: "vehicles-bus", category: "vehicles", subcategory: "land", file: "vehicles/bus.svg", names: { en: "Bus", fr: "Bus", ar: "حافلة" }, aliases: { en: ["school bus", "coach"], fr: ["autobus", "autocar", "car"], ar: ["طوبيس", "أوطوبيس", "كار"] } },
  { id: "vehicles-truck", category: "vehicles", subcategory: "land", file: "vehicles/truck.svg", names: { en: "Truck", fr: "Camion", ar: "شاحنة" }, aliases: { en: ["lorry"], ar: ["كاميو", "كاميون"] } },
  { id: "vehicles-bicycle", category: "vehicles", subcategory: "land", file: "vehicles/bicycle.svg", names: { en: "Bicycle", fr: "Vélo", ar: "دراجة" }, aliases: { en: ["bike", "cycle"], fr: ["bicyclette"], ar: ["دراجة هوائية", "بشكليط"] } },
  { id: "vehicles-train", category: "vehicles", subcategory: "land", file: "vehicles/train.svg", names: { en: "Train", fr: "Train", ar: "قطار" }, aliases: { en: ["locomotive", "railway"], fr: ["locomotive"], ar: ["تران", "ماشينة"] } },
  { id: "vehicles-tractor", category: "vehicles", subcategory: "land", file: "vehicles/tractor.svg", names: { en: "Tractor", fr: "Tracteur", ar: "جرار" }, aliases: { ar: ["تراكتور", "جرار فلاحي"] } },
  { id: "vehicles-motorcycle", category: "vehicles", subcategory: "land", file: "vehicles/motorcycle.svg", names: { en: "Motorcycle", fr: "Moto", ar: "دراجة نارية" }, aliases: { en: ["motorbike"], fr: ["motocyclette"], ar: ["موطور", "موطو"] } },
  { id: "vehicles-ambulance", category: "vehicles", subcategory: "land", file: "vehicles/ambulance.svg", names: { en: "Ambulance", fr: "Ambulance", ar: "سيارة إسعاف" }, aliases: { ar: ["إسعاف", "لانبيلانس"] } },
  { id: "vehicles-firetruck", category: "vehicles", subcategory: "land", file: "vehicles/firetruck.svg", names: { en: "Fire truck", fr: "Camion de pompiers", ar: "شاحنة الإطفاء" }, aliases: { en: ["fire engine", "firefighter"], fr: ["pompiers"], ar: ["مطافئ", "رجال الإطفاء", "بومبية"] } },
  { id: "vehicles-scooter", category: "vehicles", subcategory: "land", file: "vehicles/scooter.svg", names: { en: "Scooter", fr: "Trottinette", ar: "سكوتر" }, aliases: { en: ["kick scooter"], ar: ["تروتينيت"] } },
  { id: "vehicles-airplane", category: "vehicles", subcategory: "air", file: "vehicles/airplane.svg", names: { en: "Airplane", fr: "Avion", ar: "طائرة" }, aliases: { en: ["plane", "aeroplane", "aircraft"], ar: ["طيارة"] } },
  { id: "vehicles-helicopter", category: "vehicles", subcategory: "air", file: "vehicles/helicopter.svg", names: { en: "Helicopter", fr: "Hélicoptère", ar: "مروحية" }, aliases: { ar: ["هليكوبتر", "طائرة مروحية"] } },
  { id: "vehicles-rocket", category: "vehicles", subcategory: "air", file: "vehicles/rocket.svg", names: { en: "Rocket", fr: "Fusée", ar: "صاروخ" }, aliases: { en: ["spaceship", "space"], fr: ["espace"], ar: ["مركبة فضائية", "الفضاء"] } },
  { id: "vehicles-balloon", category: "vehicles", subcategory: "air", file: "vehicles/balloon.svg", names: { en: "Hot-air balloon", fr: "Montgolfière", ar: "منطاد" }, aliases: { en: ["balloon"], fr: ["ballon"], ar: ["منطاد هوائي"] } },
  { id: "vehicles-parachute", category: "vehicles", subcategory: "air", file: "vehicles/parachute.svg", names: { en: "Parachute", fr: "Parachute", ar: "مظلة" }, aliases: { ar: ["باراشوت", "مظلة هبوط"] } },
  { id: "vehicles-boat", category: "vehicles", subcategory: "water", file: "vehicles/boat.svg", names: { en: "Boat", fr: "Barque", ar: "قارب" }, aliases: { en: ["rowboat"], fr: ["bateau", "canot"], ar: ["فلوكة", "زورق", "شقف"] } },
  { id: "vehicles-sailboat", category: "vehicles", subcategory: "water", file: "vehicles/sailboat.svg", names: { en: "Sailboat", fr: "Voilier", ar: "مركب شراعي" }, aliases: { en: ["sailing boat", "sail"], fr: ["bateau à voile", "voile"], ar: ["سفينة شراعية", "شراع"] } },
  { id: "vehicles-ship", category: "vehicles", subcategory: "water", file: "vehicles/ship.svg", names: { en: "Ship", fr: "Bateau", ar: "سفينة" }, aliases: { en: ["liner", "cruise ship"], fr: ["navire", "paquebot"], ar: ["باخرة", "بابور"] } },
  { id: "vehicles-submarine", category: "vehicles", subcategory: "water", file: "vehicles/submarine.svg", names: { en: "Submarine", fr: "Sous-marin", ar: "غواصة" }, aliases: { ar: ["غواصات"] } },
  { id: "vehicles-kayak", category: "vehicles", subcategory: "water", file: "vehicles/kayak.svg", names: { en: "Kayak", fr: "Kayak", ar: "قارب كاياك" }, aliases: { en: ["canoe", "paddle"], fr: ["canoë", "pagaie"], ar: ["زورق تجديف", "كاياك"] } },

  // ---- School items ----
  { id: "school-pencil", category: "school", file: "school/pencil.svg", names: { en: "Pencil", fr: "Crayon", ar: "قلم رصاص" }, aliases: { fr: ["crayon à papier", "crayon gris"], ar: ["قلم", "رصاص", "قلم الرصاص"] } },
  { id: "school-pen", category: "school", file: "school/pen.svg", names: { en: "Pen", fr: "Stylo", ar: "قلم جاف" }, aliases: { en: ["ballpoint"], fr: ["stylo bille"], ar: ["قلم", "ستيلو", "قلم حبر"] } },
  { id: "school-eraser", category: "school", file: "school/eraser.svg", names: { en: "Eraser", fr: "Gomme", ar: "ممحاة" }, aliases: { en: ["rubber"], ar: ["ممسحة", "كومة", "گومة"] } },
  { id: "school-ruler", category: "school", file: "school/ruler.svg", names: { en: "Ruler", fr: "Règle", ar: "مسطرة" }, aliases: { fr: ["double décimètre"] } },
  { id: "school-scissors", category: "school", file: "school/scissors.svg", names: { en: "Scissors", fr: "Ciseaux", ar: "مقص" }, aliases: { en: ["scissor"], fr: ["paire de ciseaux"], ar: ["مقص ورق"] } },
  { id: "school-glue", category: "school", file: "school/glue.svg", names: { en: "Glue stick", fr: "Bâton de colle", ar: "لاصق" }, aliases: { en: ["glue"], fr: ["colle", "tube de colle"], ar: ["غراء", "كولا", "صمغ", "لصاق"] } },
  { id: "school-book", category: "school", file: "school/book.svg", names: { en: "Book", fr: "Livre", ar: "كتاب" }, aliases: { en: ["books", "textbook"], fr: ["livres", "manuel"], ar: ["كتب"] } },
  { id: "school-notebook", category: "school", file: "school/notebook.svg", names: { en: "Notebook", fr: "Cahier", ar: "دفتر" }, aliases: { en: ["exercise book", "copybook"], fr: ["cahiers", "carnet"], ar: ["كراسة", "كناش", "كراس"] } },
  { id: "school-backpack", category: "school", file: "school/backpack.svg", names: { en: "School bag", fr: "Cartable", ar: "محفظة" }, aliases: { en: ["backpack", "bag", "schoolbag"], fr: ["sac à dos", "sac"], ar: ["حقيبة", "حقيبة مدرسية", "شنطة"] } },
  { id: "school-crayons", category: "school", file: "school/crayons.svg", names: { en: "Crayons", fr: "Crayons de couleur", ar: "أقلام التلوين" }, aliases: { en: ["crayon", "colored pencils", "colouring pencils"], fr: ["crayon de couleur", "craies grasses"], ar: ["ألوان", "قلم ملون", "أقلام ملونة"] } },
  { id: "school-sharpener", category: "school", file: "school/sharpener.svg", names: { en: "Sharpener", fr: "Taille-crayon", ar: "مبراة" }, aliases: { en: ["pencil sharpener"], ar: ["براية"] } },
  { id: "school-calculator", category: "school", file: "school/calculator.svg", names: { en: "Calculator", fr: "Calculatrice", ar: "آلة حاسبة" }, aliases: { fr: ["calculette"], ar: ["حاسبة", "الحاسبة"] } },
  { id: "school-paintbrush", category: "school", file: "school/paintbrush.svg", names: { en: "Paintbrush", fr: "Pinceau", ar: "فرشاة" }, aliases: { en: ["brush", "paint brush", "paint"], fr: ["peinture"], ar: ["فرشاة رسم", "ريشة", "صباغة"] } },
  { id: "school-board", category: "school", file: "school/board.svg", names: { en: "Blackboard", fr: "Tableau", ar: "سبورة" }, aliases: { en: ["board", "chalkboard"], fr: ["tableau noir", "ardoise"], ar: ["سبورة سوداء", "لوح"] } },
  { id: "school-compass", category: "school", file: "school/compass.svg", names: { en: "Compass", fr: "Compas", ar: "بركار" }, aliases: { en: ["drawing compass"], ar: ["فرجار", "بيكار", "كومباص"] } },
  { id: "school-protractor", category: "school", file: "school/protractor.svg", names: { en: "Protractor", fr: "Rapporteur", ar: "منقلة" }, aliases: { en: ["angle"], fr: ["angle"], ar: ["زاوية"] } },
  { id: "school-setsquare", category: "school", file: "school/set-square.svg", names: { en: "Set square", fr: "Équerre", ar: "مزواة" }, aliases: { en: ["triangle ruler"], ar: ["الكوس", "كوس"] } },
  { id: "school-pencilcase", category: "school", file: "school/pencil-case.svg", names: { en: "Pencil case", fr: "Trousse", ar: "مقلمة" }, aliases: { en: ["pouch"], ar: ["محفظة الأقلام", "تروس"] } },
  { id: "school-globe", category: "school", file: "school/globe.svg", names: { en: "Globe", fr: "Globe", ar: "مجسم الكرة الأرضية" }, aliases: { en: ["earth", "world", "geography"], fr: ["globe terrestre", "terre", "géographie"], ar: ["الكرة الأرضية", "الأرض", "جغرافيا"] } },
  { id: "school-magnifier", category: "school", file: "school/magnifier.svg", names: { en: "Magnifying glass", fr: "Loupe", ar: "عدسة مكبرة" }, aliases: { en: ["magnifier", "zoom"], ar: ["مكبر", "مجهر يدوي"] } },

  // ---- Weather & nature ----
  { id: "nature-sun", category: "nature", subcategory: "weather", file: "nature/sun.svg", names: { en: "Sun", fr: "Soleil", ar: "شمس" }, aliases: { en: ["sunny"], fr: ["ensoleillé"], ar: ["مشمس"] } },
  { id: "nature-cloud", category: "nature", subcategory: "weather", file: "nature/cloud.svg", names: { en: "Cloud", fr: "Nuage", ar: "سحابة" }, aliases: { en: ["cloudy"], fr: ["nuageux"], ar: ["غيمة", "غائم", "سحاب"] } },
  { id: "nature-rain", category: "nature", subcategory: "weather", file: "nature/rain.svg", names: { en: "Rain", fr: "Pluie", ar: "مطر" }, aliases: { en: ["rainy", "raining"], fr: ["pluvieux", "il pleut"], ar: ["ممطر", "أمطار", "الشتا"] } },
  { id: "nature-snow", category: "nature", subcategory: "weather", file: "nature/snow.svg", names: { en: "Snow", fr: "Neige", ar: "ثلج" }, aliases: { en: ["snowflake", "snowy", "winter"], fr: ["flocon", "hiver"], ar: ["ندفة ثلج", "ثلوج", "شتاء"] } },
  { id: "nature-storm", category: "nature", subcategory: "weather", file: "nature/storm.svg", names: { en: "Storm", fr: "Orage", ar: "عاصفة رعدية" }, aliases: { en: ["thunderstorm", "lightning", "thunder"], fr: ["éclair", "tonnerre"], ar: ["برق", "رعد", "عاصفة"] } },
  { id: "nature-rainbow", category: "nature", subcategory: "weather", file: "nature/rainbow.svg", names: { en: "Rainbow", fr: "Arc-en-ciel", ar: "قوس قزح" }, aliases: { ar: ["قوس المطر"] } },
  { id: "nature-moon", category: "nature", subcategory: "weather", file: "nature/moon.svg", names: { en: "Moon", fr: "Lune", ar: "قمر" }, aliases: { en: ["night", "stars"], fr: ["nuit", "étoiles"], ar: ["هلال", "ليل", "نجوم"] } },
  { id: "nature-wind", category: "nature", subcategory: "weather", file: "nature/wind.svg", names: { en: "Wind", fr: "Vent", ar: "رياح" }, aliases: { en: ["windy"], fr: ["venteux"], ar: ["ريح", "عاصف"] } },
  { id: "nature-partly-cloudy", category: "nature", subcategory: "weather", file: "nature/partly-cloudy.svg", names: { en: "Sun and cloud", fr: "Éclaircies", ar: "غائم جزئيا" }, aliases: { en: ["partly cloudy", "sunny spells"], fr: ["soleil et nuage", "nuageux"], ar: ["شمس وسحاب"] } },
  { id: "nature-snowman", category: "nature", subcategory: "weather", file: "nature/snowman.svg", names: { en: "Snowman", fr: "Bonhomme de neige", ar: "رجل الثلج" }, aliases: { en: ["winter"], fr: ["hiver"], ar: ["شتاء", "دمية الثلج"] } },
  { id: "nature-umbrella", category: "nature", subcategory: "weather", file: "nature/umbrella.svg", names: { en: "Umbrella", fr: "Parapluie", ar: "مظلة" }, aliases: { en: ["rainy"], fr: ["pluie"], ar: ["مظلة المطر", "مضلة"] } },
  { id: "nature-tree", category: "nature", subcategory: "plants", file: "nature/tree.svg", names: { en: "Tree", fr: "Arbre", ar: "شجرة" }, aliases: { en: ["trees"], fr: ["arbres"], ar: ["أشجار", "شجر"] } },
  { id: "nature-flower", category: "nature", subcategory: "plants", file: "nature/flower.svg", names: { en: "Flower", fr: "Fleur", ar: "زهرة" }, aliases: { en: ["flowers", "spring"], fr: ["fleurs", "printemps"], ar: ["وردة", "ورد", "أزهار", "ربيع"] } },
  { id: "nature-leaf", category: "nature", subcategory: "plants", file: "nature/leaf.svg", names: { en: "Leaf", fr: "Feuille", ar: "ورقة" }, aliases: { en: ["leaves", "autumn"], fr: ["feuilles", "automne"], ar: ["ورقة شجر", "أوراق", "خريف"] } },
  { id: "nature-palm", category: "nature", subcategory: "plants", file: "nature/palm.svg", names: { en: "Palm tree", fr: "Palmier", ar: "نخلة" }, aliases: { en: ["date palm", "palm"], ar: ["نخيل"] } },
  { id: "nature-cactus", category: "nature", subcategory: "plants", file: "nature/cactus.svg", names: { en: "Cactus", fr: "Cactus", ar: "صبار" }, aliases: { en: ["desert"], fr: ["désert"], ar: ["هندية", "صحراء"] } },
  { id: "nature-mountain", category: "nature", subcategory: "plants", file: "nature/mountain.svg", names: { en: "Mountain", fr: "Montagne", ar: "جبل" }, aliases: { en: ["mountains", "hill"], fr: ["montagnes", "colline"], ar: ["جبال", "تل"] } },
  { id: "nature-sprout", category: "nature", subcategory: "plants", file: "nature/sprout.svg", names: { en: "Sprout", fr: "Pousse", ar: "نبتة" }, aliases: { en: ["seedling", "plant", "grow", "seed"], fr: ["plante", "germination", "graine"], ar: ["نبات", "إنبات", "بذرة"] } },
  { id: "nature-pine", category: "nature", subcategory: "plants", file: "nature/pine.svg", names: { en: "Pine tree", fr: "Sapin", ar: "صنوبر" }, aliases: { en: ["fir", "pine"], fr: ["pin", "conifère"], ar: ["شجرة الصنوبر", "أرز"] } },
  { id: "nature-volcano", category: "nature", subcategory: "plants", file: "nature/volcano.svg", names: { en: "Volcano", fr: "Volcan", ar: "بركان" }, aliases: { en: ["lava", "eruption"], fr: ["lave", "éruption"], ar: ["حمم", "ثوران"] } },
  { id: "nature-desert", category: "nature", subcategory: "plants", file: "nature/desert.svg", names: { en: "Desert", fr: "Désert", ar: "صحراء" }, aliases: { en: ["dunes", "sand"], fr: ["dunes", "sable"], ar: ["كثبان", "رمال"] } },

  // ---- Colours ----
  ...(
    [
      ["red", "Red", "Rouge", "أحمر", [], [], ["حمراء"]],
      ["blue", "Blue", "Bleu", "أزرق", [], ["bleue"], ["زرقاء"]],
      ["yellow", "Yellow", "Jaune", "أصفر", [], [], ["صفراء"]],
      ["green", "Green", "Vert", "أخضر", [], ["verte"], ["خضراء"]],
      ["orange", "Orange", "Orange", "برتقالي", [], [], ["برتقالية", "ليموني"]],
      ["purple", "Purple", "Violet", "بنفسجي", ["violet"], ["violette", "mauve"], ["بنفسجية", "موف"]],
      ["pink", "Pink", "Rose", "وردي", [], [], ["وردية", "زهري"]],
      ["brown", "Brown", "Marron", "بني", [], ["brun", "brune"], ["بنية", "قهوي"]],
      ["black", "Black", "Noir", "أسود", [], ["noire"], ["سوداء", "كحل"]],
      ["white", "White", "Blanc", "أبيض", [], ["blanche"], ["بيضاء"]],
      ["gray", "Gray", "Gris", "رمادي", ["grey"], ["grise"], ["رمادية", "رصاصي"]],
    ] as [string, string, string, string, string[], string[], string[]][]
  ).map(([key, en, fr, ar, enA, frA, arA]): PackItem => ({
    id: `colors-${key}`,
    category: "colors",
    file: `colors/${key}.svg`,
    names: { en, fr, ar },
    aliases: { en: enA, fr: frA, ar: arA },
  })),

  // ---- Shapes ----
  { id: "shapes-circle", category: "shapes", subcategory: "flat", file: "shapes/circle.svg", names: { en: "Circle", fr: "Cercle", ar: "دائرة" }, aliases: { en: ["round"], fr: ["rond", "disque"], ar: ["دائري", "قرص"] } },
  { id: "shapes-square", category: "shapes", subcategory: "flat", file: "shapes/square.svg", names: { en: "Square", fr: "Carré", ar: "مربع" } },
  { id: "shapes-triangle", category: "shapes", subcategory: "flat", file: "shapes/triangle.svg", names: { en: "Triangle", fr: "Triangle", ar: "مثلث" } },
  { id: "shapes-rectangle", category: "shapes", subcategory: "flat", file: "shapes/rectangle.svg", names: { en: "Rectangle", fr: "Rectangle", ar: "مستطيل" } },
  { id: "shapes-oval", category: "shapes", subcategory: "flat", file: "shapes/oval.svg", names: { en: "Oval", fr: "Ovale", ar: "شكل بيضوي" }, aliases: { en: ["ellipse"], fr: ["ellipse"], ar: ["بيضوي", "إهليلج"] } },
  { id: "shapes-star", category: "shapes", subcategory: "flat", file: "shapes/star.svg", names: { en: "Star", fr: "Étoile", ar: "نجمة" }, aliases: { ar: ["نجم"] } },
  { id: "shapes-heart", category: "shapes", subcategory: "flat", file: "shapes/heart.svg", names: { en: "Heart", fr: "Cœur", ar: "قلب" }, aliases: { en: ["love"], fr: ["amour"], ar: ["حب"] } },
  { id: "shapes-rhombus", category: "shapes", subcategory: "flat", file: "shapes/rhombus.svg", names: { en: "Rhombus", fr: "Losange", ar: "معين" }, aliases: { en: ["diamond"], ar: ["معين الشكل"] } },
  { id: "shapes-pentagon", category: "shapes", subcategory: "flat", file: "shapes/pentagon.svg", names: { en: "Pentagon", fr: "Pentagone", ar: "خماسي الأضلاع" }, aliases: { ar: ["مخمس", "خماسي"] } },
  { id: "shapes-hexagon", category: "shapes", subcategory: "flat", file: "shapes/hexagon.svg", names: { en: "Hexagon", fr: "Hexagone", ar: "سداسي الأضلاع" }, aliases: { ar: ["مسدس", "سداسي"] } },
  { id: "shapes-octagon", category: "shapes", subcategory: "flat", file: "shapes/octagon.svg", names: { en: "Octagon", fr: "Octogone", ar: "ثماني الأضلاع" }, aliases: { ar: ["مثمن", "ثماني"] } },
  { id: "shapes-crescent", category: "shapes", subcategory: "flat", file: "shapes/crescent.svg", names: { en: "Crescent", fr: "Croissant", ar: "هلال" }, aliases: { en: ["crescent moon"], fr: ["croissant de lune"], ar: ["شكل هلال"] } },
  { id: "shapes-semicircle", category: "shapes", subcategory: "flat", file: "shapes/semicircle.svg", names: { en: "Semicircle", fr: "Demi-cercle", ar: "نصف دائرة" }, aliases: { en: ["half circle"], fr: ["demi-disque"], ar: ["نصف قرص"] } },
  { id: "shapes-trapezoid", category: "shapes", subcategory: "flat", file: "shapes/trapezoid.svg", names: { en: "Trapezoid", fr: "Trapèze", ar: "شبه منحرف" }, aliases: { en: ["trapezium"] } },
  { id: "shapes-parallelogram", category: "shapes", subcategory: "flat", file: "shapes/parallelogram.svg", names: { en: "Parallelogram", fr: "Parallélogramme", ar: "متوازي الأضلاع" }, aliases: { ar: ["متوازي اضلاع"] } },
  { id: "shapes-kite", category: "shapes", subcategory: "flat", file: "shapes/kite.svg", names: { en: "Kite shape", fr: "Cerf-volant (forme)", ar: "شكل الطائرة الورقية" }, aliases: { en: ["kite", "deltoid"], fr: ["cerf-volant"], ar: ["دالتون"] } },
  { id: "shapes-ring", category: "shapes", subcategory: "flat", file: "shapes/ring.svg", names: { en: "Ring", fr: "Couronne", ar: "حلقة" }, aliases: { en: ["annulus", "donut"], fr: ["anneau"], ar: ["حلقة دائرية"] } },
  { id: "shapes-cube", category: "shapes", subcategory: "solid", file: "shapes/cube.svg", names: { en: "Cube", fr: "Cube", ar: "مكعب" } },
  { id: "shapes-sphere", category: "shapes", subcategory: "solid", file: "shapes/sphere.svg", names: { en: "Sphere", fr: "Sphère", ar: "كرة" }, aliases: { en: ["ball"], fr: ["boule"], ar: ["جسم كروي"] } },
  { id: "shapes-cylinder", category: "shapes", subcategory: "solid", file: "shapes/cylinder.svg", names: { en: "Cylinder", fr: "Cylindre", ar: "أسطوانة" } },
  { id: "shapes-cone", category: "shapes", subcategory: "solid", file: "shapes/cone.svg", names: { en: "Cone", fr: "Cône", ar: "مخروط" } },
  { id: "shapes-pyramid", category: "shapes", subcategory: "solid", file: "shapes/pyramid.svg", names: { en: "Pyramid", fr: "Pyramide", ar: "هرم" } },
  { id: "shapes-cuboid", category: "shapes", subcategory: "solid", file: "shapes/cuboid.svg", names: { en: "Cuboid", fr: "Pavé droit", ar: "متوازي المستطيلات" }, aliases: { en: ["rectangular prism", "box"], fr: ["parallélépipède rectangle", "pavé"], ar: ["متوازي مستطيلات", "علبة"] } },
  { id: "shapes-prism", category: "shapes", subcategory: "solid", file: "shapes/prism.svg", names: { en: "Triangular prism", fr: "Prisme", ar: "موشور" }, aliases: { en: ["prism"], fr: ["prisme droit"], ar: ["موشور قائم"] } },
  { id: "shapes-hemisphere", category: "shapes", subcategory: "solid", file: "shapes/hemisphere.svg", names: { en: "Hemisphere", fr: "Demi-sphère", ar: "نصف كرة" }, aliases: { en: ["half sphere", "dome"], fr: ["dôme"], ar: ["قبة"] } },

  // ---- Symbols ----
  { id: "symbols-check", category: "symbols", subcategory: "marks", file: "symbols/check.svg", names: { en: "Check mark", fr: "Coche", ar: "علامة صح" }, aliases: { en: ["tick", "correct", "right", "yes"], fr: ["juste", "correct", "vrai", "oui"], ar: ["صح", "صحيح", "صواب"] } },
  { id: "symbols-cross", category: "symbols", subcategory: "marks", file: "symbols/cross.svg", names: { en: "Cross", fr: "Croix", ar: "علامة خطأ" }, aliases: { en: ["wrong", "incorrect", "no"], fr: ["faux", "non"], ar: ["خطأ", "خاطئ", "غلط"] } },
  { id: "symbols-happy", category: "symbols", subcategory: "marks", file: "symbols/happy.svg", names: { en: "Happy face", fr: "Visage content", ar: "وجه مبتسم" }, aliases: { en: ["smiley", "smile", "good"], fr: ["sourire", "content", "heureux", "émoticône"], ar: ["مبتسم", "سعيد", "فرح", "ابتسامة"] } },
  { id: "symbols-neutral", category: "symbols", subcategory: "marks", file: "symbols/neutral.svg", names: { en: "Neutral face", fr: "Visage neutre", ar: "وجه محايد" }, aliases: { en: ["so-so", "okay", "average"], fr: ["moyen", "bof"], ar: ["عادي", "محايد", "متوسط"] } },
  { id: "symbols-sad", category: "symbols", subcategory: "marks", file: "symbols/sad.svg", names: { en: "Sad face", fr: "Visage triste", ar: "وجه حزين" }, aliases: { en: ["unhappy"], fr: ["triste", "pas content"], ar: ["حزين", "عابس"] } },
  { id: "symbols-question", category: "symbols", subcategory: "marks", file: "symbols/question.svg", names: { en: "Question mark", fr: "Point d'interrogation", ar: "علامة استفهام" }, aliases: { en: ["question", "?"], fr: ["question", "?"], ar: ["استفهام", "سؤال", "؟"] } },
  { id: "symbols-exclamation", category: "symbols", subcategory: "marks", file: "symbols/exclamation.svg", names: { en: "Exclamation mark", fr: "Point d'exclamation", ar: "علامة تعجب" }, aliases: { en: ["exclamation", "attention", "!"], fr: ["attention", "!"], ar: ["تعجب", "انتباه", "!"] } },
  { id: "symbols-reward", category: "symbols", subcategory: "marks", file: "symbols/reward.svg", names: { en: "Reward star", fr: "Étoile de récompense", ar: "نجمة تشجيع" }, aliases: { en: ["gold star", "well done", "good job", "reward"], fr: ["bravo", "récompense", "étoile dorée"], ar: ["أحسنت", "مكافأة", "نجمة ذهبية", "برافو"] } },
  { id: "symbols-thumbs-up", category: "symbols", subcategory: "marks", file: "symbols/thumbs-up.svg", names: { en: "Thumbs up", fr: "Pouce levé", ar: "إبهام مرفوع" }, aliases: { en: ["like", "good", "ok"], fr: ["bravo", "j'aime", "super"], ar: ["أحسنت", "ممتاز", "جيد"] } },
  { id: "symbols-trophy", category: "symbols", subcategory: "marks", file: "symbols/trophy.svg", names: { en: "Trophy", fr: "Trophée", ar: "كأس" }, aliases: { en: ["cup", "winner", "prize"], fr: ["coupe", "gagnant"], ar: ["كأس الفوز", "جائزة"] } },
  { id: "symbols-medal", category: "symbols", subcategory: "marks", file: "symbols/medal.svg", names: { en: "Medal", fr: "Médaille", ar: "ميدالية" }, aliases: { en: ["first", "winner"], fr: ["premier", "gagnant"], ar: ["وسام", "الأول"] } },
  { id: "symbols-lightbulb", category: "symbols", subcategory: "marks", file: "symbols/lightbulb.svg", names: { en: "Light bulb", fr: "Ampoule", ar: "مصباح" }, aliases: { en: ["idea", "think"], fr: ["idée", "réfléchir"], ar: ["فكرة", "لمبة"] } },
  { id: "symbols-arrow-right", category: "symbols", subcategory: "arrows", file: "symbols/arrow-right.svg", names: { en: "Right arrow", fr: "Flèche droite", ar: "سهم نحو اليمين" }, aliases: { en: ["arrow", "next"], fr: ["flèche", "vers la droite", "suivant"], ar: ["سهم", "يمين"] } },
  { id: "symbols-arrow-left", category: "symbols", subcategory: "arrows", file: "symbols/arrow-left.svg", names: { en: "Left arrow", fr: "Flèche gauche", ar: "سهم نحو اليسار" }, aliases: { en: ["arrow", "back"], fr: ["flèche", "vers la gauche"], ar: ["سهم", "يسار"] } },
  { id: "symbols-arrow-up", category: "symbols", subcategory: "arrows", file: "symbols/arrow-up.svg", names: { en: "Up arrow", fr: "Flèche haut", ar: "سهم نحو الأعلى" }, aliases: { en: ["arrow"], fr: ["flèche", "vers le haut"], ar: ["سهم", "فوق"] } },
  { id: "symbols-arrow-down", category: "symbols", subcategory: "arrows", file: "symbols/arrow-down.svg", names: { en: "Down arrow", fr: "Flèche bas", ar: "سهم نحو الأسفل" }, aliases: { en: ["arrow"], fr: ["flèche", "vers le bas"], ar: ["سهم", "تحت"] } },
  { id: "symbols-arrow-both", category: "symbols", subcategory: "arrows", file: "symbols/arrow-both.svg", names: { en: "Double arrow", fr: "Double flèche", ar: "سهم مزدوج" }, aliases: { en: ["arrow", "left right arrow", "two-way"], fr: ["flèche", "flèche double"], ar: ["سهم", "سهم باتجاهين"] } },
  { id: "symbols-arrow-curved", category: "symbols", subcategory: "arrows", file: "symbols/arrow-curved.svg", names: { en: "Curved arrow", fr: "Flèche courbe", ar: "سهم منحني" }, aliases: { en: ["arrow", "turn"], fr: ["flèche", "tourner"], ar: ["سهم", "منعطف"] } },
  { id: "symbols-arrow-cycle", category: "symbols", subcategory: "arrows", file: "symbols/arrow-cycle.svg", names: { en: "Cycle arrows", fr: "Flèches de cycle", ar: "سهم دائري" }, aliases: { en: ["arrow", "repeat", "cycle", "loop"], fr: ["flèche", "cycle", "recommencer"], ar: ["سهم", "دورة", "تكرار"] } },
  { id: "symbols-plus", category: "symbols", subcategory: "math", file: "symbols/plus.svg", names: { en: "Plus", fr: "Plus", ar: "زائد" }, aliases: { en: ["+", "add", "addition", "sum"], fr: ["+", "addition", "somme"], ar: ["+", "جمع"] } },
  { id: "symbols-minus", category: "symbols", subcategory: "math", file: "symbols/minus.svg", names: { en: "Minus", fr: "Moins", ar: "ناقص" }, aliases: { en: ["−", "subtract", "subtraction"], fr: ["−", "soustraction"], ar: ["−", "طرح"] } },
  { id: "symbols-times", category: "symbols", subcategory: "math", file: "symbols/times.svg", names: { en: "Times", fr: "Fois", ar: "ضرب" }, aliases: { en: ["×", "multiply", "multiplication"], fr: ["×", "multiplication"], ar: ["×", "مضروب"] } },
  { id: "symbols-divide", category: "symbols", subcategory: "math", file: "symbols/divide.svg", names: { en: "Divided by", fr: "Divisé par", ar: "قسمة" }, aliases: { en: ["÷", "divide", "division"], fr: ["÷", "division"], ar: ["÷", "مقسوم"] } },
  { id: "symbols-equals", category: "symbols", subcategory: "math", file: "symbols/equals.svg", names: { en: "Equals", fr: "Égal", ar: "يساوي" }, aliases: { en: ["=", "equal", "equal sign"], fr: ["=", "égalité", "signe égal"], ar: ["=", "مساواة"] } },
  { id: "symbols-less", category: "symbols", subcategory: "math", file: "symbols/less.svg", names: { en: "Less than", fr: "Plus petit que", ar: "أصغر من" }, aliases: { en: ["<", "smaller", "compare"], fr: ["<", "inférieur", "comparer"], ar: ["<", "أقل من", "مقارنة"] } },
  { id: "symbols-greater", category: "symbols", subcategory: "math", file: "symbols/greater.svg", names: { en: "Greater than", fr: "Plus grand que", ar: "أكبر من" }, aliases: { en: [">", "bigger", "compare"], fr: [">", "supérieur", "comparer"], ar: [">", "أكثر من", "مقارنة"] } },
  { id: "symbols-percent", category: "symbols", subcategory: "math", file: "symbols/percent.svg", names: { en: "Percent", fr: "Pourcentage", ar: "النسبة المئوية" }, aliases: { en: ["%", "percentage"], fr: ["%", "pour cent"], ar: ["%", "بالمئة"] } },
  { id: "symbols-not-equal", category: "symbols", subcategory: "math", file: "symbols/not-equal.svg", names: { en: "Not equal", fr: "Différent de", ar: "لا يساوي" }, aliases: { en: ["≠", "different"], fr: ["≠", "différent"], ar: ["≠", "مختلف"] } },
  { id: "symbols-less-equal", category: "symbols", subcategory: "math", file: "symbols/less-equal.svg", names: { en: "Less than or equal", fr: "Inférieur ou égal", ar: "أصغر من أو يساوي" }, aliases: { en: ["≤", "compare"], fr: ["≤", "comparer"], ar: ["≤", "مقارنة"] } },
  { id: "symbols-greater-equal", category: "symbols", subcategory: "math", file: "symbols/greater-equal.svg", names: { en: "Greater than or equal", fr: "Supérieur ou égal", ar: "أكبر من أو يساوي" }, aliases: { en: ["≥", "compare"], fr: ["≥", "comparer"], ar: ["≥", "مقارنة"] } },

  // ---- Instructions (the pictograms of a worksheet's instructions) ----
  { id: "instr-write", category: "instructions", file: "instructions/write.svg", names: { en: "Write", fr: "Écris", ar: "اكتب" }, aliases: { en: ["writing"], fr: ["écrire", "écriture"], ar: ["كتابة"] } },
  { id: "instr-read", category: "instructions", file: "instructions/read.svg", names: { en: "Read", fr: "Lis", ar: "اقرأ" }, aliases: { en: ["reading"], fr: ["lire", "lecture"], ar: ["قراءة"] } },
  { id: "instr-color", category: "instructions", file: "instructions/color.svg", names: { en: "Color", fr: "Colorie", ar: "لوّن" }, aliases: { en: ["colour", "coloring", "colouring"], fr: ["colorier", "coloriage"], ar: ["تلوين"] } },
  { id: "instr-cut", category: "instructions", file: "instructions/cut.svg", names: { en: "Cut", fr: "Découpe", ar: "قصّ" }, aliases: { en: ["cutting"], fr: ["découper", "ciseaux"], ar: ["اقطع", "مقص"] } },
  { id: "instr-glue", category: "instructions", file: "instructions/glue.svg", names: { en: "Glue", fr: "Colle", ar: "ألصق" }, aliases: { en: ["stick", "paste"], fr: ["coller"], ar: ["لصق"] } },
  { id: "instr-draw", category: "instructions", file: "instructions/draw.svg", names: { en: "Draw", fr: "Dessine", ar: "ارسم" }, aliases: { en: ["drawing", "paint"], fr: ["dessiner", "dessin", "peins"], ar: ["رسم"] } },
  { id: "instr-circle", category: "instructions", file: "instructions/circle.svg", names: { en: "Circle", fr: "Entoure", ar: "ضع دائرة" }, aliases: { en: ["circle the answer", "ring"], fr: ["entourer"], ar: ["أحط بدائرة", "دائرة"] } },
  { id: "instr-underline", category: "instructions", file: "instructions/underline.svg", names: { en: "Underline", fr: "Souligne", ar: "ضع خطا تحت" }, aliases: { en: ["underlining"], fr: ["souligner"], ar: ["سطر", "خط تحت"] } },
  { id: "instr-match", category: "instructions", file: "instructions/match.svg", names: { en: "Match", fr: "Relie", ar: "صل" }, aliases: { en: ["link", "join", "connect"], fr: ["relier"], ar: ["اربط", "صل بخط", "ربط"] } },
  { id: "instr-tick", category: "instructions", file: "instructions/tick.svg", names: { en: "Tick", fr: "Coche", ar: "ضع علامة" }, aliases: { en: ["check", "mark", "tick the box"], fr: ["cocher", "case"], ar: ["ضع علامة صح", "أشر"] } },
  { id: "instr-listen", category: "instructions", file: "instructions/listen.svg", names: { en: "Listen", fr: "Écoute", ar: "استمع" }, aliases: { en: ["listening", "hear"], fr: ["écouter"], ar: ["اسمع", "استماع"] } },
  { id: "instr-look", category: "instructions", file: "instructions/look.svg", names: { en: "Look", fr: "Observe", ar: "لاحظ" }, aliases: { en: ["observe", "watch", "see"], fr: ["observer", "regarde", "regarder"], ar: ["انظر", "شاهد", "تأمل"] } },
  { id: "instr-say", category: "instructions", file: "instructions/say.svg", names: { en: "Say", fr: "Dis", ar: "قل" }, aliases: { en: ["speak", "talk", "say aloud"], fr: ["dire", "parle", "parler"], ar: ["تكلم", "انطق", "تحدث"] } },
  { id: "instr-count", category: "instructions", file: "instructions/count.svg", names: { en: "Count", fr: "Compte", ar: "عدّ" }, aliases: { en: ["counting", "tally"], fr: ["compter", "dénombre"], ar: ["احسب", "أعد"] } },
  { id: "instr-trace", category: "instructions", file: "instructions/trace.svg", names: { en: "Trace", fr: "Repasse", ar: "مرر على الخط" }, aliases: { en: ["trace over", "dotted"], fr: ["repasser", "pointillés"], ar: ["تتبع", "ارسم فوق النقط"] } },
  { id: "instr-fold", category: "instructions", file: "instructions/fold.svg", names: { en: "Fold", fr: "Plie", ar: "اطو" }, aliases: { en: ["folding"], fr: ["plier"], ar: ["طي", "إطو"] } },
  { id: "instr-order", category: "instructions", file: "instructions/order.svg", names: { en: "Put in order", fr: "Range dans l'ordre", ar: "رتب" }, aliases: { en: ["sequence", "number"], fr: ["ordonne", "numérote", "ranger"], ar: ["ترتيب", "رقم"] } },
  { id: "instr-discuss", category: "instructions", file: "instructions/discuss.svg", names: { en: "Discuss", fr: "Discute", ar: "ناقش" }, aliases: { en: ["pair work", "talk with a friend"], fr: ["en binôme", "échange"], ar: ["تحاور", "حوار", "عمل ثنائي"] } },

  // ---- Templates ----
  { id: "tpl-lines", category: "templates", subcategory: "writing", file: "templates/handwriting-lines.svg", names: { en: "Handwriting lines", fr: "Lignes d'écriture", ar: "سطور الكتابة" }, aliases: { en: ["writing lines", "handwriting", "ruled"], fr: ["lignes", "écriture", "interligne"], ar: ["سطور", "خط", "كتابة"] } },
  { id: "tpl-seyes", category: "templates", subcategory: "writing", file: "templates/seyes.svg", names: { en: "Seyès ruling", fr: "Réglure Seyès", ar: "تسطير سييس" }, aliases: { en: ["french ruled", "large squares"], fr: ["grands carreaux", "cahier"], ar: ["كراسة", "تسطير", "مربعات كبيرة"] } },
  { id: "tpl-tracing", category: "templates", subcategory: "writing", file: "templates/tracing.svg", names: { en: "Tracing patterns", fr: "Graphisme à repasser", ar: "خطوط للتتبع" }, aliases: { en: ["trace", "dotted", "pre-writing"], fr: ["pointillés", "repasse", "graphisme"], ar: ["تتبع", "منقط", "تخطيط"] } },
  { id: "tpl-answer-lines", category: "templates", subcategory: "writing", file: "templates/answer-lines.svg", names: { en: "Answer lines", fr: "Lignes de réponse", ar: "سطور الإجابة" }, aliases: { en: ["lines", "answer"], fr: ["réponse", "lignes"], ar: ["جواب", "إجابة", "سطور"] } },
  { id: "tpl-squared", category: "templates", subcategory: "writing", file: "templates/squared-paper.svg", names: { en: "Squared paper", fr: "Petits carreaux", ar: "ورق مربعات صغيرة" }, aliases: { en: ["graph paper", "grid", "squares"], fr: ["quadrillage", "carreaux"], ar: ["مربعات", "شبكة"] } },
  { id: "tpl-ten-frame", category: "templates", subcategory: "math", file: "templates/ten-frame.svg", names: { en: "Ten frame", fr: "Boîte de dix", ar: "إطار العشرة" }, aliases: { en: ["tens frame", "counting"], fr: ["cadre à dix", "dizaine"], ar: ["عشرة", "عد"] } },
  { id: "tpl-hundred-chart", category: "templates", subcategory: "math", file: "templates/hundred-chart.svg", names: { en: "Hundred chart", fr: "Tableau des nombres de 1 à 100", ar: "جدول الأعداد من 1 إلى 100" }, aliases: { en: ["100 chart", "number grid"], fr: ["grille 100", "tableau de 100"], ar: ["جدول المئة", "100"] } },
  { id: "tpl-clock", category: "templates", subcategory: "math", file: "templates/clock.svg", names: { en: "Clock face", fr: "Horloge", ar: "ساعة" }, aliases: { en: ["clock", "time", "telling time"], fr: ["heure", "pendule", "cadran"], ar: ["الوقت", "ساعة حائطية", "قراءة الساعة"] } },
  { id: "tpl-number-line", category: "templates", subcategory: "math", file: "templates/number-line.svg", names: { en: "Number line 0–10", fr: "Droite numérique 0–10", ar: "مستقيم الأعداد 0–10" }, aliases: { en: ["number line"], fr: ["droite graduée", "ligne des nombres"], ar: ["مستقيم مدرج", "خط الأعداد"] } },
  { id: "tpl-number-bond", category: "templates", subcategory: "math", file: "templates/number-bond.svg", names: { en: "Number bond", fr: "Décomposition", ar: "تفكيك العدد" }, aliases: { en: ["part part whole", "number bonds"], fr: ["maison des nombres", "parties"], ar: ["أجزاء العدد", "تجزئة"] } },
  { id: "tpl-five-frame", category: "templates", subcategory: "math", file: "templates/five-frame.svg", names: { en: "Five frame", fr: "Boîte de cinq", ar: "إطار الخمسة" }, aliases: { en: ["5 frame", "counting"], fr: ["cadre à cinq"], ar: ["خمسة", "عد"] } },
  { id: "tpl-twenty-frame", category: "templates", subcategory: "math", file: "templates/twenty-frame.svg", names: { en: "Twenty frame", fr: "Boîte de vingt", ar: "إطار العشرين" }, aliases: { en: ["20 frame", "counting"], fr: ["cadre à vingt"], ar: ["عشرون", "عد"] } },
  { id: "tpl-venn", category: "templates", subcategory: "organizers", file: "templates/venn.svg", names: { en: "Venn diagram", fr: "Diagramme de Venn", ar: "مخطط فن" }, aliases: { en: ["compare", "two circles"], fr: ["comparer", "deux cercles"], ar: ["مخطط فين", "مقارنة"] } },
  { id: "tpl-sequence", category: "templates", subcategory: "organizers", file: "templates/sequence.svg", names: { en: "Story sequence", fr: "Séquence en 4 images", ar: "تسلسل الأحداث" }, aliases: { en: ["four boxes", "comic", "order"], fr: ["remettre dans l'ordre", "bande dessinée", "4 cases"], ar: ["ترتيب", "قصة مصورة", "أربع خانات"] } },
  { id: "tpl-draw-box", category: "templates", subcategory: "organizers", file: "templates/draw-box.svg", names: { en: "Drawing box", fr: "Cadre de dessin", ar: "إطار الرسم" }, aliases: { en: ["draw here", "frame", "picture box"], fr: ["dessine ici", "cadre"], ar: ["ارسم هنا", "إطار"] } },
  { id: "tpl-name-date", category: "templates", subcategory: "organizers", file: "templates/name-date.svg", names: { en: "Name & date", fr: "Nom et date", ar: "الاسم والتاريخ" }, aliases: { en: ["header", "student name"], fr: ["prénom", "en-tête"], ar: ["اسم التلميذ", "التاريخ"] } },
  { id: "tpl-matching", category: "templates", subcategory: "organizers", file: "templates/matching.svg", names: { en: "Matching columns", fr: "Colonnes à relier", ar: "أعمدة للربط" }, aliases: { en: ["match", "connect dots"], fr: ["relier", "relie"], ar: ["ربط", "صل"] } },
  { id: "tpl-calendar", category: "templates", subcategory: "organizers", file: "templates/calendar.svg", names: { en: "Calendar", fr: "Calendrier", ar: "رزنامة" }, aliases: { en: ["month", "days", "week"], fr: ["mois", "jours", "semaine"], ar: ["التقويم", "شهر", "أيام"] } },

  // ---- Food & drinks ----
  { id: "food-bread", category: "food", file: "food/bread.svg", names: { en: "Bread", fr: "Pain", ar: "خبز" }, aliases: { en: ["loaf"], fr: ["baguette"], ar: ["خبزة", "كسرة"] } },
  { id: "food-milk", category: "food", file: "food/milk.svg", names: { en: "Milk", fr: "Lait", ar: "حليب" }, aliases: { en: ["bottle of milk"], fr: ["bouteille de lait"], ar: ["الحليب", "لبن"] } },
  { id: "food-egg", category: "food", file: "food/egg.svg", names: { en: "Egg", fr: "Œuf", ar: "بيضة" }, aliases: { en: ["eggs"], fr: ["œufs"], ar: ["بيض"] } },
  { id: "food-cheese", category: "food", file: "food/cheese.svg", names: { en: "Cheese", fr: "Fromage", ar: "جبن" }, aliases: { ar: ["جبنة", "فرماج"] } },
  { id: "food-cake", category: "food", file: "food/cake.svg", names: { en: "Cake", fr: "Gâteau", ar: "كعكة" }, aliases: { en: ["birthday cake", "birthday"], fr: ["anniversaire"], ar: ["حلوى", "كيك", "عيد ميلاد"] } },
  { id: "food-water", category: "food", file: "food/water.svg", names: { en: "Water", fr: "Eau", ar: "ماء" }, aliases: { en: ["water bottle", "bottle"], fr: ["bouteille d'eau"], ar: ["الماء", "قنينة ماء"] } },
  { id: "food-juice", category: "food", file: "food/juice.svg", names: { en: "Juice", fr: "Jus", ar: "عصير" }, aliases: { en: ["orange juice", "glass"], fr: ["jus d'orange", "verre"], ar: ["كأس عصير"] } },
  { id: "food-tea", category: "food", file: "food/tea.svg", names: { en: "Teapot", fr: "Théière", ar: "براد" }, aliases: { en: ["tea", "mint tea"], fr: ["thé", "thé à la menthe"], ar: ["شاي", "أتاي", "براد الشاي"] } },
  { id: "food-honey", category: "food", file: "food/honey.svg", names: { en: "Honey", fr: "Miel", ar: "عسل" }, aliases: { en: ["honey jar"], fr: ["pot de miel"], ar: ["العسل"] } },
  { id: "food-icecream", category: "food", file: "food/icecream.svg", names: { en: "Ice cream", fr: "Glace", ar: "مثلجات" }, aliases: { en: ["ice-cream"], fr: ["crème glacée"], ar: ["آيس كريم", "كلاص"] } },
  { id: "food-candy", category: "food", file: "food/candy.svg", names: { en: "Lollipop", fr: "Sucette", ar: "مصاصة" }, aliases: { en: ["candy", "sweet"], fr: ["bonbon"], ar: ["حلوى", "حلويات"] } },
  { id: "food-couscous", category: "food", file: "food/couscous.svg", names: { en: "Couscous", fr: "Couscous", ar: "كسكس" }, aliases: { en: ["couscous dish", "lunch"], fr: ["plat", "déjeuner"], ar: ["كسكسو", "غداء"] } },

  // ---- Home & objects ----
  { id: "home-house", category: "home", file: "home/house.svg", names: { en: "House", fr: "Maison", ar: "منزل" }, aliases: { en: ["home"], ar: ["دار", "بيت"] } },
  { id: "home-bed", category: "home", file: "home/bed.svg", names: { en: "Bed", fr: "Lit", ar: "سرير" }, aliases: { en: ["bedroom", "sleep"], fr: ["chambre", "dormir"], ar: ["نوم", "غرفة النوم"] } },
  { id: "home-chair", category: "home", file: "home/chair.svg", names: { en: "Chair", fr: "Chaise", ar: "كرسي" }, aliases: { en: ["seat"], fr: ["siège"], ar: ["مقعد"] } },
  { id: "home-table", category: "home", file: "home/table.svg", names: { en: "Table", fr: "Table", ar: "طاولة" }, aliases: { en: ["desk"], fr: ["bureau"], ar: ["مائدة", "طبلة"] } },
  { id: "home-lamp", category: "home", file: "home/lamp.svg", names: { en: "Lamp", fr: "Lampe", ar: "مصباح" }, aliases: { en: ["light"], fr: ["lumière"], ar: ["لامبة", "ضوء"] } },
  { id: "home-tv", category: "home", file: "home/tv.svg", names: { en: "Television", fr: "Télévision", ar: "تلفاز" }, aliases: { en: ["tv"], fr: ["télé"], ar: ["تلفزة", "تلفزيون"] } },
  { id: "home-phone", category: "home", file: "home/phone.svg", names: { en: "Phone", fr: "Téléphone", ar: "هاتف" }, aliases: { en: ["mobile", "smartphone"], fr: ["portable"], ar: ["تيليفون", "بورطابل"] } },
  { id: "home-key", category: "home", file: "home/key.svg", names: { en: "Key", fr: "Clé", ar: "مفتاح" }, aliases: { en: ["keys"], fr: ["clef"], ar: ["ساروت"] } },
  { id: "home-alarm-clock", category: "home", file: "home/alarm-clock.svg", names: { en: "Alarm clock", fr: "Réveil", ar: "منبه" }, aliases: { en: ["clock", "wake up"], fr: ["horloge", "se réveiller"], ar: ["ساعة", "استيقاظ"] } },
  { id: "home-cup", category: "home", file: "home/cup.svg", names: { en: "Mug", fr: "Tasse", ar: "فنجان" }, aliases: { en: ["cup"], fr: ["bol"], ar: ["كأس", "كوب", "طاسة"] } },
  { id: "home-cutlery", category: "home", file: "home/cutlery.svg", names: { en: "Spoon and fork", fr: "Cuillère et fourchette", ar: "ملعقة وشوكة" }, aliases: { en: ["cutlery", "spoon", "fork"], fr: ["couverts", "cuillère", "fourchette"], ar: ["ملعقة", "شوكة", "معلقة"] } },
  { id: "home-broom", category: "home", file: "home/broom.svg", names: { en: "Broom", fr: "Balai", ar: "مكنسة" }, aliases: { en: ["sweep", "clean"], fr: ["balayer", "ménage"], ar: ["شطابة", "تنظيف"] } },

  // ---- Places ----
  { id: "places-school", category: "places", file: "places/school.svg", names: { en: "School", fr: "École", ar: "مدرسة" }, aliases: { en: ["classroom"], fr: ["classe"], ar: ["المدرسة", "القسم"] } },
  { id: "places-mosque", category: "places", file: "places/mosque.svg", names: { en: "Mosque", fr: "Mosquée", ar: "مسجد" }, aliases: { en: ["minaret"], fr: ["minaret"], ar: ["جامع", "صومعة"] } },
  { id: "places-hospital", category: "places", file: "places/hospital.svg", names: { en: "Hospital", fr: "Hôpital", ar: "مستشفى" }, aliases: { en: ["doctor"], fr: ["médecin"], ar: ["سبيطار", "مصحة", "طبيب"] } },
  { id: "places-shop", category: "places", file: "places/shop.svg", names: { en: "Shop", fr: "Magasin", ar: "دكان" }, aliases: { en: ["store", "grocery"], fr: ["boutique", "épicerie"], ar: ["حانوت", "متجر", "محل"] } },
  { id: "places-barn", category: "places", file: "places/barn.svg", names: { en: "Farm", fr: "Ferme", ar: "ضيعة" }, aliases: { en: ["barn"], fr: ["grange"], ar: ["مزرعة", "إسطبل"] } },
  { id: "places-tent", category: "places", file: "places/tent.svg", names: { en: "Tent", fr: "Tente", ar: "خيمة" }, aliases: { en: ["camping"], fr: ["camping"], ar: ["تخييم"] } },
  { id: "places-building", category: "places", file: "places/building.svg", names: { en: "Apartment building", fr: "Immeuble", ar: "عمارة" }, aliases: { en: ["flats", "apartments"], fr: ["appartements"], ar: ["شقق", "بناية"] } },

  // ---- Toys & games ----
  { id: "toys-ball", category: "toys", file: "toys/ball.svg", names: { en: "Ball", fr: "Ballon", ar: "كرة" }, aliases: { en: ["beach ball"], fr: ["balle"], ar: ["كورة"] } },
  { id: "toys-teddy", category: "toys", file: "toys/teddy.svg", names: { en: "Teddy bear", fr: "Ours en peluche", ar: "دبدوب" }, aliases: { en: ["toy bear", "doll"], fr: ["nounours", "peluche"], ar: ["دمية", "دمية دب"] } },
  { id: "toys-kite", category: "toys", file: "toys/kite.svg", names: { en: "Kite", fr: "Cerf-volant", ar: "طائرة ورقية" }, aliases: { ar: ["طيارة ورقية"] } },
  { id: "toys-balloons", category: "toys", file: "toys/balloons.svg", names: { en: "Balloons", fr: "Ballons de baudruche", ar: "بالونات" }, aliases: { en: ["party", "birthday"], fr: ["fête", "anniversaire"], ar: ["نفاخات", "عيد ميلاد"] } },
  { id: "toys-blocks", category: "toys", file: "toys/blocks.svg", names: { en: "Building blocks", fr: "Cubes", ar: "مكعبات" }, aliases: { en: ["blocks", "cubes"], fr: ["cubes de construction"], ar: ["مكعبات البناء"] } },
  { id: "toys-drum", category: "toys", file: "toys/drum.svg", names: { en: "Drum", fr: "Tambour", ar: "طبل" }, aliases: { en: ["music"], fr: ["musique"], ar: ["طبلة", "موسيقى"] } },
  { id: "toys-puzzle", category: "toys", file: "toys/puzzle.svg", names: { en: "Puzzle", fr: "Puzzle", ar: "بازل" }, aliases: { en: ["jigsaw"], fr: ["casse-tête"], ar: ["أحجية", "تركيب"] } },
  { id: "toys-dice", category: "toys", file: "toys/dice.svg", names: { en: "Dice", fr: "Dé", ar: "نرد" }, aliases: { en: ["die", "game"], fr: ["dés", "jeu"], ar: ["زهر"] } },
  { id: "toys-top", category: "toys", file: "toys/top.svg", names: { en: "Spinning top", fr: "Toupie", ar: "خذروف" }, aliases: { en: ["top"], ar: ["بلبل", "طرومبية"] } },
  { id: "toys-robot", category: "toys", file: "toys/robot.svg", names: { en: "Robot", fr: "Robot", ar: "روبوت" }, aliases: { en: ["toy robot"], ar: ["إنسان آلي"] } },

  // ---- Feelings ----
  { id: "feelings-happy", category: "feelings", file: "feelings/happy.svg", names: { en: "Happy", fr: "Content", ar: "سعيد" }, aliases: { en: ["glad", "smile"], fr: ["joyeux", "heureux"], ar: ["فرحان", "مسرور"] } },
  { id: "feelings-laughing", category: "feelings", file: "feelings/laughing.svg", names: { en: "Laughing", fr: "Rire", ar: "يضحك" }, aliases: { en: ["laugh", "funny"], fr: ["rigole", "drôle"], ar: ["ضاحك", "ضحك"] } },
  { id: "feelings-sad", category: "feelings", file: "feelings/sad.svg", names: { en: "Sad", fr: "Triste", ar: "حزين" }, aliases: { en: ["unhappy"], fr: ["malheureux"], ar: ["حزن"] } },
  { id: "feelings-crying", category: "feelings", file: "feelings/crying.svg", names: { en: "Crying", fr: "Pleurer", ar: "يبكي" }, aliases: { en: ["cry", "tears"], fr: ["pleure", "larmes"], ar: ["بكاء", "دموع"] } },
  { id: "feelings-angry", category: "feelings", file: "feelings/angry.svg", names: { en: "Angry", fr: "En colère", ar: "غاضب" }, aliases: { en: ["mad", "cross"], fr: ["fâché", "colère"], ar: ["غضبان", "غضب"] } },
  { id: "feelings-surprised", category: "feelings", file: "feelings/surprised.svg", names: { en: "Surprised", fr: "Surpris", ar: "متفاجئ" }, aliases: { en: ["surprise", "wow"], fr: ["étonné", "surprise"], ar: ["مندهش", "دهشة"] } },
  { id: "feelings-scared", category: "feelings", file: "feelings/scared.svg", names: { en: "Scared", fr: "Peur", ar: "خائف" }, aliases: { en: ["afraid", "fear"], fr: ["effrayé", "a peur"], ar: ["خوف", "مرعوب"] } },
  { id: "feelings-sleepy", category: "feelings", file: "feelings/sleepy.svg", names: { en: "Sleepy", fr: "Fatigué", ar: "نعسان" }, aliases: { en: ["tired", "sleep"], fr: ["sommeil", "endormi"], ar: ["متعب", "نوم"] } },
  { id: "feelings-sick", category: "feelings", file: "feelings/sick.svg", names: { en: "Sick", fr: "Malade", ar: "مريض" }, aliases: { en: ["ill", "fever"], fr: ["fièvre"], ar: ["مرض", "حمى"] } },
  { id: "feelings-love", category: "feelings", file: "feelings/love.svg", names: { en: "In love", fr: "Amoureux", ar: "محب" }, aliases: { en: ["love", "heart eyes"], fr: ["j'adore", "cœur"], ar: ["حب", "يحب"] } },

];

// ---- Numbers and letters: whole sets, one entry per line of a table ----

// [en, fr, ar, its other Arabic forms]
const NUMBER_WORDS: [string, string, string, string[]][] = [
  ["Zero", "Zéro", "صفر", []],
  ["One", "Un", "واحد", ["واحدة"]],
  ["Two", "Deux", "اثنان", ["اثنين", "اثنتان", "زوج"]],
  ["Three", "Trois", "ثلاثة", ["ثلاث"]],
  ["Four", "Quatre", "أربعة", ["أربع"]],
  ["Five", "Cinq", "خمسة", ["خمس"]],
  ["Six", "Six", "ستة", ["ست"]],
  ["Seven", "Sept", "سبعة", ["سبع"]],
  ["Eight", "Huit", "ثمانية", ["ثمان", "ثماني"]],
  ["Nine", "Neuf", "تسعة", ["تسع"]],
  ["Ten", "Dix", "عشرة", ["عشر"]],
  ["Eleven", "Onze", "أحد عشر", ["إحدى عشرة"]],
  ["Twelve", "Douze", "اثنا عشر", ["اثنتا عشرة", "اثني عشر"]],
  ["Thirteen", "Treize", "ثلاثة عشر", ["ثلاث عشرة"]],
  ["Fourteen", "Quatorze", "أربعة عشر", ["أربع عشرة"]],
  ["Fifteen", "Quinze", "خمسة عشر", ["خمس عشرة"]],
  ["Sixteen", "Seize", "ستة عشر", ["ست عشرة"]],
  ["Seventeen", "Dix-sept", "سبعة عشر", ["سبع عشرة"]],
  ["Eighteen", "Dix-huit", "ثمانية عشر", ["ثماني عشرة"]],
  ["Nineteen", "Dix-neuf", "تسعة عشر", ["تسع عشرة"]],
  ["Twenty", "Vingt", "عشرون", ["عشرين"]],
];
const EASTERN = (n: number) => String(n).replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));

const NUMBERS: PackItem[] = [
  ...NUMBER_WORDS.map(([en, fr, ar, arA], n): PackItem => ({
    id: `numbers-${n}`,
    category: "numbers",
    subcategory: "digits",
    file: `numbers/${n}.svg`,
    names: { en: `${n} — ${en}`, fr: `${n} — ${fr}`, ar: `${n} — ${ar}` },
    aliases: { en: [en], fr: [fr, ...(n === 1 ? ["une"] : [])], ar: [ar, ...arA, EASTERN(n)] },
  })),
  ...NUMBER_WORDS.map(([en, fr, ar, arA], n): PackItem => ({
    id: `numbers-eastern-${n}`,
    category: "numbers",
    subcategory: "eastern",
    file: `numbers/eastern-${n}.svg`,
    names: { en: `${EASTERN(n)} — ${en}`, fr: `${EASTERN(n)} — ${fr}`, ar: `${EASTERN(n)} — ${ar}` },
    aliases: { en: [en, String(n)], fr: [fr, String(n)], ar: [ar, ...arA, String(n)] },
  })),
  ...NUMBER_WORDS.slice(1, 11).map(([en, fr, ar, arA], i): PackItem => {
    const n = i + 1;
    return {
      id: `numbers-dots-${n}`,
      category: "numbers",
      subcategory: "counting",
      file: `numbers/dots-${n}.svg`,
      names: { en: `${en} dot${n > 1 ? "s" : ""}`, fr: `${fr} point${n > 1 ? "s" : ""}`, ar: `${n} — ${ar}` },
      aliases: { en: [String(n)], fr: [String(n)], ar: [String(n), ...arA, EASTERN(n)] },
    };
  }),
];

// ---- Time: a clock face for every hour, and for half past ----

// The hours in Arabic ("الساعة الثالثة")
const HOURS_AR = ["الواحدة", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة", "الحادية عشرة", "الثانية عشرة"];
const TIME: PackItem[] = [0, 30].flatMap((m) =>
  HOURS_AR.map((hourAr, i): PackItem => {
    const h = i + 1;
    const digital = `${h}:${m ? "30" : "00"}`;
    return m
      ? {
          id: `time-${h}-30`,
          category: "time",
          subcategory: "half",
          file: `time/${h}-30.svg`,
          names: { en: `Half past ${h}`, fr: `${h} h et demie`, ar: `${hourAr} والنصف` },
          aliases: { en: [digital, `${h} thirty`], fr: [digital, `${h}h30`], ar: [digital, `الساعة ${hourAr} والنصف`] },
        }
      : {
          id: `time-${h}-00`,
          category: "time",
          subcategory: "oclock",
          file: `time/${h}-00.svg`,
          names: { en: `${h} o'clock`, fr: `${h} heure${h > 1 ? "s" : ""}`, ar: `الساعة ${hourAr}` },
          aliases: { en: [digital], fr: [digital, `${h}h`, `${h}h00`], ar: [digital, hourAr] },
        };
  }),
);

// ---- Fractions: as a circle and as a bar ----

// [numerator, denominator, en, fr, ar]
const FRACTION_WORDS: [number, number, string, string, string][] = [
  [1, 2, "one half", "un demi", "نصف"],
  [1, 3, "one third", "un tiers", "ثلث"],
  [2, 3, "two thirds", "deux tiers", "ثلثان"],
  [1, 4, "one quarter", "un quart", "ربع"],
  [3, 4, "three quarters", "trois quarts", "ثلاثة أرباع"],
  [1, 5, "one fifth", "un cinquième", "خمس"],
  [2, 5, "two fifths", "deux cinquièmes", "خمسان"],
  [1, 6, "one sixth", "un sixième", "سدس"],
  [5, 6, "five sixths", "cinq sixièmes", "خمسة أسداس"],
  [1, 8, "one eighth", "un huitième", "ثمن"],
  [3, 8, "three eighths", "trois huitièmes", "ثلاثة أثمان"],
];
const FRACTIONS: PackItem[] = (["circles", "bars"] as const).flatMap((sub) =>
  FRACTION_WORDS.map(([k, n, en, fr, ar]): PackItem => ({
    id: `fractions-${sub}-${k}-${n}`,
    category: "fractions",
    subcategory: sub,
    file: `fractions/${sub === "circles" ? "circle" : "bar"}-${k}-${n}.svg`,
    names: { en: `${k}/${n} — ${en}`, fr: `${k}/${n} — ${fr}`, ar: `${k}/${n} — ${ar}` },
  })),
);

const LATIN: PackItem[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((L) => ({
  id: `letters-latin-${L.toLowerCase()}`,
  category: "letters",
  subcategory: "latin",
  file: `letters/latin-${L.toLowerCase()}.svg`,
  names: { en: `Letter ${L}`, fr: `Lettre ${L}`, ar: `حرف ${L}` },
}));

// [letter, its name in English and French (transliterated), its name in Arabic]
const ARABIC_LETTERS: [string, string, string, string][] = [
  ["ا", "Alif", "Alif", "ألف"],
  ["ب", "Ba", "Ba", "باء"],
  ["ت", "Ta", "Ta", "تاء"],
  ["ث", "Tha", "Tha", "ثاء"],
  ["ج", "Jim", "Jim", "جيم"],
  ["ح", "Ḥa", "Ḥa", "حاء"],
  ["خ", "Kha", "Kha", "خاء"],
  ["د", "Dal", "Dal", "دال"],
  ["ذ", "Dhal", "Dhal", "ذال"],
  ["ر", "Ra", "Ra", "راء"],
  ["ز", "Zay", "Zay", "زاي"],
  ["س", "Sin", "Sin", "سين"],
  ["ش", "Shin", "Chin", "شين"],
  ["ص", "Ṣad", "Ṣad", "صاد"],
  ["ض", "Ḍad", "Ḍad", "ضاد"],
  ["ط", "Ṭa", "Ṭa", "طاء"],
  ["ظ", "Ẓa", "Ẓa", "ظاء"],
  ["ع", "Ayn", "Ayn", "عين"],
  ["غ", "Ghayn", "Ghayn", "غين"],
  ["ف", "Fa", "Fa", "فاء"],
  ["ق", "Qaf", "Qaf", "قاف"],
  ["ك", "Kaf", "Kaf", "كاف"],
  ["ل", "Lam", "Lam", "لام"],
  ["م", "Mim", "Mim", "ميم"],
  ["ن", "Nun", "Noun", "نون"],
  ["ه", "Ha", "Ha", "هاء"],
  ["و", "Waw", "Waw", "واو"],
  ["ي", "Ya", "Ya", "ياء"],
];

const ARABIC: PackItem[] = ARABIC_LETTERS.map(([letter, en, fr, ar], i) => ({
  id: `letters-arabic-${i + 1}`,
  category: "letters",
  subcategory: "arabic",
  file: `letters/arabic-${i + 1}.svg`,
  names: { en: `${en} (${letter})`, fr: `${fr} (${letter})`, ar: `${letter} — ${ar}` },
  aliases: { en: [letter], fr: [letter], ar: [letter, `حرف ال${ar}`] },
}));

export const PACK_ITEMS: PackItem[] = [...DRAWN, ...NUMBERS, ...FRACTIONS, ...TIME, ...LATIN, ...ARABIC].sort(
  (a, b) => PACK_CATEGORIES.findIndex((c) => c.id === a.category) - PACK_CATEGORIES.findIndex((c) => c.id === b.category),
);

export const packCategory = (id: string) => PACK_CATEGORIES.find((c) => c.id === id);
