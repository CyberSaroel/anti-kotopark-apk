// 16 социотипов. Порядок ФИКСИРОВАН (индексы 0..15) и совпадает с таблицей TIM
// в relations.js и с data/catTypes.json.
export const TYPES = [
  "Дон Кихот",
  "Дюма",
  "Гюго",
  "Робеспьер",
  "Гамлет",
  "Максим",
  "Жуков",
  "Есенин",
  "Наполеон",
  "Бальзак",
  "Джек",
  "Драйзер",
  "Штирлиц",
  "Достоевский",
  "Гексли",
  "Габен"
];

// Полные имена для подсказок/экранов (зеркалит data/catTypes.json).
// Версия по умолчанию — терминология Аушры.
export const FULL_NAMES = {
  "Дон Кихот": "Дон Кихот (ИЛЭ)",
  "Дюма": "Дюма (СЭИ)",
  "Гюго": "Гюго (ЭСЭ)",
  "Робеспьер": "Робеспьер (ЛИИ)",
  "Гамлет": "Гамлет (ЭИЭ)",
  "Максим": "Максим Горький (ЛСИ)",
  "Жуков": "Жуков (СЛЭ)",
  "Есенин": "Есенин (ИЭИ)",
  "Наполеон": "Наполеон (СЭЭ)",
  "Бальзак": "Бальзак (ИЛИ)",
  "Джек": "Джек Лондон (ЛИЭ)",
  "Драйзер": "Драйзер (ЭСИ)",
  "Штирлиц": "Штирлиц (ЛСЭ)",
  "Достоевский": "Достоевский (ЭИИ)",
  "Гексли": "Гексли (ИЭЭ)",
  "Габен": "Габен (СЛИ)"
};

// Терминология Гуленко — соответствие между именами Аушры и Гуленко
const GULENKO_NAMES = {
  "Дон Кихот": "Искатель",
  "Дюма": "Посредник",
  "Гюго": "Энтузиаст",
  "Робеспьер": "Аналитик",
  "Гамлет": "Наставник",
  "Максим": "Инспектор",
  "Жуков": "Маршал",
  "Есенин": "Лирик",
  "Наполеон": "Политик",
  "Бальзак": "Критик",
  "Джек": "Предприниматель",
  "Драйзер": "Хранитель",
  "Штирлиц": "Администратор",
  "Достоевский": "Гуманист",
  "Гексли": "Советчик",
  "Габен": "Мастер"
};

// Ключ для localStorage
export const NAMING_KEY = "socio-cats:namingStyle";

/**
 * Получить текущий стиль наименований из localStorage.
 * @returns {"aushra"|"gulenko"}
 */
export function getNamingStyle() {
  try {
    const saved = localStorage.getItem(NAMING_KEY);
    if (saved === "gulenko") return "gulenko";
    return "aushra";
  } catch {
    return "aushra";
  }
}

/**
 * Установить стиль наименований.
 * @param {"aushra"|"gulenko"} style
 */
export function setNamingStyle(style) {
  localStorage.setItem(NAMING_KEY, style);
}

/**
 * Получить отображаемое имя типа согласно текущему стилю наименований.
 * @param {string} typeName — имя типа в терминологии Аушры (например "Дон Кихот")
 * @returns {string} — имя в соответствии с выбранной терминологией
 */
export function getTypeDisplayName(typeName) {
  const style = getNamingStyle();
  if (style === "gulenko" && GULENKO_NAMES[typeName]) {
    return GULENKO_NAMES[typeName];
  }
  return typeName;
}

/**
 * Получить полное отображаемое имя типа (с кодом) согласно текущему стилю.
 * @param {string} typeName — имя типа в терминологии Аушры
 * @returns {string} — полное имя с кодом
 */
export function getFullDisplayName(typeName) {
  const style = getNamingStyle();
  if (style === "gulenko" && GULENKO_NAMES[typeName]) {
    const code = FULL_NAMES[typeName] ? FULL_NAMES[typeName].match(/\(([^)]+)\)/)?.[1] || "" : "";
    return code ? `${GULENKO_NAMES[typeName]} (${code})` : GULENKO_NAMES[typeName];
  }
  return FULL_NAMES[typeName] || typeName;
}

export function isKnownType(t) { return TYPES.includes(t); }