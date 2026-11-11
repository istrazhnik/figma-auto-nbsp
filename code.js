'use strict';

// Auto-nbsp — плагин для Figma (русский текст, арабские цифры)

const NBSP = '\u00A0';
const DATA_KEY = 'nbspAnnotationLabel'; // последний текст аннотации, созданной плагином
const CATEGORY_LABEL = 'Текст'; // флаг (категория) аннотации
const MAX_DUPS_SHOWN = 200;

figma.skipInvisibleInstanceChildren = true; // быстрее обход и поиск текстовых слоёв

// ------------------------------ Словари ------------------------------------

const CYR = 'А-Яа-яЁё';
const norm1 = (w) => w.toLowerCase().replace(/ё/g, 'е');
const wordSet = (s) => new Set(s.split(' ').map(norm1));
const cap = (w) => '[' + w[0].toUpperCase() + w[0] + ']' + w.slice(1);
const W = '(^|[^' + CYR + 'A-Za-z0-9-])'; // граница слева: не буква, не цифра, не дефис

// Предлоги, союзы и частицы «не», «ни», «вот», «вон», «ну», «уж», «то»: пробел ПОСЛЕ них.
// «бы», «ли», «же» сюда не входят — они прижимаются к предыдущему слову.
const FUNCTION_WORDS = wordSet(
  'в во к ко с со у о об обо от ото до по на за из изо из-за из-под над под подо при про для без безо ' +
    'ради через сквозь между меж перед передо пред около возле вокруг после кроме среди против вместо ' +
    'внутри вне ввиду благодаря согласно вследствие навстречу вдоль поперек спустя мимо близ напротив ' +
    'посредством относительно касательно сверх помимо наперекор вроде ' +
    'и а но да или либо ни что чтобы чтоб как если когда пока хотя хоть будто словно едва ибо зато ' +
    'однако также притом причём поскольку ежели коли дабы нежели чем ' +
    'не ни вот вон ну уж то'
);
const BEFORE_PARTICLES = wordSet('бы б ли ль же ж');

// Составные союзы: пробелы внутри (и после запятой) тоже неразрывные.
const COMPOUND_RE = new RegExp(
  W +
    '(' +
    [
      'потому что', 'оттого что', 'так как', 'так что', 'как будто', 'как только', 'а также',
      'для того чтобы', 'с тем чтобы', 'вместо того чтобы', 'после того как', 'перед тем как',
      'по мере того как', 'ввиду того что', 'тем более что', 'с тех пор как', 'до тех пор пока',
      'в то время как', 'в связи с тем что', 'несмотря на то что'
    ]
      .map((phrase) => {
        const w = phrase.split(' ');
        // запятая допускается только перед последним словом: «потому, что»
        return w.map((x, i) => (i === w.length - 1 ? x : x + (i === w.length - 2 ? ',?' : '') + '[ \\u00A0]')).join('');
      })
      .join('|') +
    ')(?![' + CYR + '-])',
  'gi'
);

// Единицы, которые «прижимаются» к числу: «5 лет», «2024 г.», «100 000 ₽», «20 кг».
const UNIT_WORDS = wordSet(
  'г год года году годом годе годы годов годам годами годах лет век века ' +
    'мес месяц месяца месяцу месяцем месяце месяцы месяцев месяцам месяцами месяцах ' +
    'нед неделя недели неделю неделей неделе недель неделям неделями неделях ' +
    'дн день дня дню днем дне дни дней дням днями днях сутки суток ' +
    'ч час часа часу часом часе часы часов часам часами часах ' +
    'мин минута минуты минуту минутой минуте минут минутам минутами минутах ' +
    'с сек секунда секунды секунду секундой секунде секунд секундам секундами секундах мс мкс ' +
    'руб рубль рубля рублю рублем рубле рубли рублей коп копейка копейки копеек ' +
    'тыс млн млрд трлн шт экз чел ' +
    'мг кг т л мл дл м см мм км дм га м² см² мм² км² м³ см³ км³ ' +
    'вт квт мвт гц кгц мгц ггц бит байт кб мб гб тб ' +
    'px pt em rem kg mg km cm mm ml gb mb kb tb hz khz mhz ghz kw ms min sec usd eur rub ' +
    '₽ $ € £ ¥ ° °c °f'
);
const DOT_UNITS = wordSet('гг р'); // единицы только с точкой: «2024 гг.», «5 р.»
const MULTIPLIERS = wordSet('тыс млн млрд трлн'); // «5 тыс. руб.»: связываем и со следующей единицей

// Сокращённое слово + число: «ст. 12», «рис. 2», «д. 5», «кв. 12»
const ADDRESS_ABBR = wordSet('д кв оф пом корп эт под ауд комн стр'); // после запятой тоже: «ул. Ленина,_д._5»
const ABBR_BEFORE_NUMBER = (
  'д кв оф пом корп эт под ауд комн стр ст рис табл гл п пп ч прил разд подп абз с т тт вып кн ил ср см'
).split(' ');
// Сокращённое слово + название: «г. Москва», «ул. Ленина»
const ABBR_BEFORE_NAME = 'г ул пр-т просп пер пл наб ш бул пос обл мкр р-н д'.split(' ');

const MONTHS_GEN = 'января февраля марта апреля мая июня июля августа сентября октября ноября декабря'.split(' ');
const MONTHS_ALL = MONTHS_GEN.concat(
  ('январь январе февраль феврале март марте апрель апреле май мае июнь июне июль июле ' +
    'август августе сентябрь сентябре октябрь октябре ноябрь ноябре декабрь декабре').split(' ')
);

// ------------------------- Регулярные выражения (один раз) -----------------

const INITIALS = '(?:[А-ЯЁ]\\.(?:[ \\u00A0](?=[А-ЯЁ]\\.))?){1,3}';
const SURNAME = '[А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?';

const PHONE_RE = /(^|[^\d])((?:\+7|8)[ \u00A0]?\(?\d{3}\)?[ \u00A0]?\d{3}[- \u00A0]?\d{2}[- \u00A0]?\d{2})(?!\d)/g;
const NUM_RE = /\d{1,3}(?:[ \u00A0\u202F]\d{3}(?!\d))+|\d+/g;
const YEAR_AFTER_RE = /^[ \u00A0\u202F]*(?:гг?\.|год[а-яё]*)/i;
const MONTH_BEFORE_RE = new RegExp('(?:' + MONTHS_ALL.join('|') + ')[ \\u00A0]$', 'i');
const WORD_RE = /[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*/g;
const UNIT_RE = /(\d) ([A-Za-zА-Яа-яЁё°²³₽$€£¥]+)(\.?)/g;
const NEXT_UNIT_RE = /^ ([A-Za-zА-Яа-яЁё₽$€£¥]+)/;
const PERCENT_RE = /(\d) (?=[%‰])/g;
const DAY_MONTH_RE = new RegExp('(^|[^0-9])(\\d{1,2})( )(' + MONTHS_GEN.join('|') + ')(?![' + CYR + '])', 'gi');
const MONTH_YEAR_RE = new RegExp(W + '(' + MONTHS_ALL.join('|') + ')( )(\\d{4})(?!\\d)', 'gi');
const DASH_RE = /\S ([—–])(?= )/g;
const INITIALS_FIRST_RE = new RegExp(W + '(' + INITIALS + ')( ?)(' + SURNAME + ')', 'g');
const SURNAME_FIRST_RE = new RegExp(W + '(' + SURNAME + ')( )(' + INITIALS + ')', 'g');
const TE_RE = new RegExp(W + '(т\\.)( )([едпкнчосж]\\.)', 'gi'); // «т. е.», «т. д.», «т. п.»
const SIGN_RE = /(^|[^0-9])([№§]+)( )(?=\d)/g;
const NUM_ABBR_RE = new RegExp(W + '(' + ABBR_BEFORE_NUMBER.map(cap).join('|') + ')\\.( )(?=\\d)', 'g');
const NAME_ABBR_RE = new RegExp(W + '(' + ABBR_BEFORE_NAME.map(cap).join('|') + ')\\.( )(?=[А-ЯЁ])', 'g');
const ROMAN_RE = new RegExp(W + '([IVXLCDM\\u0425]+)( )(вв?\\.|век[а-яё]*)', 'g');
const DUP_RE = /[ \u00A0\u202F]{2,}/g;

function each(re, text, fn) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text)) !== null) fn(m);
}

// ---------------------------- Разбор текста --------------------------------

/**
 * Возвращает позиции:
 *  replace — обычный пробел, который нужно заменить на неразрывный;
 *  insert  — позиция, перед которой нужно вставить неразрывный пробел (внутри числа).
 */
function computeOps(text) {
  const replace = new Set();
  const insert = new Set();
  const space = (i) => {
    if (text[i] === ' ') replace.add(i); // заменяем только обычный пробел
  };

  // 0. Телефоны: пробелы внутри неразрывные, цифры внутри на группы не разбиваем
  const phones = [];
  each(PHONE_RE, text, (m) => {
    const s = m.index + m[1].length;
    phones.push([s, s + m[2].length]);
    for (let i = s; i < s + m[2].length; i++) space(i);
  });
  const inPhone = (i) => phones.some((r) => i >= r[0] && i < r[1]);

  // 1. Числа от четырёх цифр: 1000 → 1 000; «1 000» с обычным пробелом → с неразрывным
  each(NUM_RE, text, (m) => {
    const s = m.index;
    const str = m[0];
    const e = s + str.length;
    if (inPhone(s)) return;
    const prev = text[s - 1] || '';
    if (/[A-Za-zА-Яа-яЁё_#]/.test(prev)) return; // часть идентификатора: ID12345, v2024
    if ((prev === ',' || prev === '.') && /\d/.test(text[s - 2] || '')) return; // дробная часть, даты 10.11.2024
    if (str[0] === '0') return; // коды, номера с ведущим нулём
    if (/^\d{4}-\d{2}-\d{2}/.test(text.slice(s, s + 10))) return; // дата 2024-11-10
    if (/[ \u00A0\u202F]/.test(str)) {
      for (let i = 0; i < str.length; i++) space(s + i); // число уже разбито на группы
      return;
    }
    if (str.length < 4) return;
    // Годы не разбиваем: «в 2024 г.», «2024 году», «в ноябре 2026»
    if (str.length === 4 && (YEAR_AFTER_RE.test(text.slice(e, e + 12)) || MONTH_BEFORE_RE.test(text.slice(Math.max(0, s - 12), s)))) return;
    for (let k = str.length - 3; k > 0; k -= 3) insert.add(s + k);
  });

  // 2. Составные союзы: «потому что», «потому, что», «для того чтобы» …
  each(COMPOUND_RE, text, (m) => {
    const base = m.index + m[1].length;
    for (let i = 0; i < m[2].length; i++) space(base + i);
  });

  // 3. Предлоги, союзы, «не/ни…» и слова из 1–2 букв: пробел после слова.
  //    «бы», «ли», «же» прижимаются к предыдущему слову: «я_бы», «знаешь_ли».
  each(WORD_RE, text, (m) => {
    const s = m.index;
    const e = s + m[0].length;
    if (/[0-9A-Za-z]/.test(text[s - 1] || '')) return; // «5в », «ABCи »
    const key = norm1(m[0]);
    const isParticle = BEFORE_PARTICLES.has(key);
    if (isParticle && /[A-Za-zА-Яа-яЁё0-9»”)\]"']/.test(text[s - 2] || '')) space(s - 1);
    if (text[e] !== ' ') return;
    if (!FUNCTION_WORDS.has(key) && (m[0].length > 2 || isParticle)) return;
    const next = text[e + 1];
    if (next && !/[\s—–-]/.test(next)) replace.add(e);
  });

  // 4. Число + единица: «5 лет», «2024 г.», «100 000 ₽», «20 °C», «5 тыс. руб.»
  each(UNIT_RE, text, (m) => {
    const key = norm1(m[2]);
    if (!UNIT_WORDS.has(key) && !(m[3] === '.' && DOT_UNITS.has(key))) return;
    replace.add(m.index + 1);
    if (MULTIPLIERS.has(key)) {
      const after = UNIT_RE.lastIndex;
      const nxt = NEXT_UNIT_RE.exec(text.slice(after, after + 12));
      if (nxt && UNIT_WORDS.has(norm1(nxt[1]))) replace.add(after);
    }
  });

  // 5. Процент: только если пробел уже был — «20 %» → «20_%», а «20%» не трогаем
  each(PERCENT_RE, text, (m) => replace.add(m.index + 1));

  // 6. Даты: «10 ноября 2026», «в ноябре 2026»
  each(DAY_MONTH_RE, text, (m) => replace.add(m.index + m[1].length + m[2].length));
  each(MONTH_YEAR_RE, text, (m) => replace.add(m.index + m[1].length + m[2].length));

  // 7. Тире: пробел перед «—» / «–» неразрывный (чтобы тире не оказывалось в начале строки)
  each(DASH_RE, text, (m) => replace.add(m.index + 1));

  // 8. Инициалы: «А._С._Пушкин», «Пушкин_А._С.»
  each(INITIALS_FIRST_RE, text, (m) => {
    const base = m.index + m[1].length;
    for (let i = 0; i <= m[2].length; i++) space(base + i); // пробелы между инициалами и перед фамилией
  });
  each(SURNAME_FIRST_RE, text, (m) => {
    const sp = m.index + m[1].length + m[2].length;
    for (let i = 0; i <= m[4].length; i++) space(sp + i); // перед инициалами и между ними
  });

  // 9. «т. е.», «т. д.», «т. п.», «т. к.»; «№ 5», «§ 3»
  each(TE_RE, text, (m) => replace.add(m.index + m[1].length + m[2].length));
  each(SIGN_RE, text, (m) => replace.add(m.index + m[1].length + m[2].length));

  // 10. Сокращение + число / название: «ст._12», «рис._2», «д._5», «г._Москва», «ул._Ленина»
  //     Не трогаем «2024 г. Москва» и «т. д. Далее»
  const skipAbbr = (a) => /\d[ \u00A0]$|т\.[ \u00A0]$/i.test(text.slice(Math.max(0, a - 4), a));
  each(NUM_ABBR_RE, text, (m) => {
    const a = m.index + m[1].length;
    if (skipAbbr(a)) return;
    replace.add(a + m[2].length + 1);
    // «ул. Ленина,_д._5»: после запятой перед адресным сокращением тоже неразрывный пробел
    if (m[1] === ' ' && text[m.index - 1] === ',' && ADDRESS_ABBR.has(norm1(m[2]))) replace.add(m.index);
  });
  each(NAME_ABBR_RE, text, (m) => {
    const a = m.index + m[1].length;
    if (!skipAbbr(a)) replace.add(a + m[2].length + 1);
  });

  // 11. Римские цифры + век: «XXI_век», «XX_в.»
  each(ROMAN_RE, text, (m) => replace.add(m.index + m[1].length + m[2].length));

  return { replace, insert };
}

// ------------------------ Правка текста с сохранением стилей ----------------

const loadedFonts = new Set();
// Если все эти свойства одинаковы по всему слою, текст можно заменить одной операцией
const UNIFORM_FIELDS = [
  'fontName', 'fontSize', 'fontWeight', 'textDecoration', 'textCase', 'lineHeight', 'letterSpacing',
  'fills', 'textStyleId', 'fillStyleId', 'hyperlink', 'listOptions', 'indentation'
];

async function applyOps(node, ops) {
  const list = [];
  ops.replace.forEach((i) => list.push([i, 0]));
  ops.insert.forEach((i) => list.push([i, 1]));
  if (!list.length) return 0;
  list.sort((a, b) => b[0] - a[0]); // с конца, чтобы индексы не сдвигались

  let segs;
  let full = true;
  try {
    segs = node.getStyledTextSegments(UNIFORM_FIELDS);
  } catch (e) {
    full = false;
    segs = node.getStyledTextSegments(['fontName']);
  }
  for (const sg of segs) {
    const key = sg.fontName.family + '|' + sg.fontName.style;
    if (loadedFonts.has(key)) continue;
    await figma.loadFontAsync(sg.fontName);
    loadedFonts.add(key);
  }

  if (full && segs.length === 1 && list.length > 2) {
    // Быстрый путь: стиль един по всему слою — одна запись вместо десятков вставок и удалений
    let t = node.characters;
    for (const [i, kind] of list) t = t.slice(0, i) + NBSP + t.slice(i + (kind ? 0 : 1));
    node.characters = t;
    return list.length;
  }

  // Общий путь: правим по символу, сохраняя стили фрагментов
  for (const [i, kind] of list) {
    if (kind === 0) {
      node.insertCharacters(i, NBSP, 'AFTER'); // со стилем исходного пробела
      node.deleteCharacters(i + 1, i + 2);
    } else {
      node.insertCharacters(i, NBSP, 'BEFORE');
    }
  }
  return list.length;
}

// ------------------------------- Аннотации ---------------------------------

let categoryCache = null;

async function getTextCategory() {
  if (categoryCache) return categoryCache;
  const categories = await figma.annotations.getAnnotationCategoriesAsync();
  categoryCache =
    categories.find((c) => c.label.trim().toLowerCase() === CATEGORY_LABEL.toLowerCase()) ||
    (await figma.annotations.addAnnotationCategoryAsync({ label: CATEGORY_LABEL, color: 'blue' }));
  return categoryCache;
}

const annText = (a) => (typeof a.labelMarkdown === 'string' && a.labelMarkdown ? a.labelMarkdown : a.label || '');

// Сравнение «по смыслу»: &nbsp; и обычные/неразрывные пробелы считаются одинаковыми
const normText = (s) =>
  String(s)
    .replace(/&amp;nbsp;|&nbsp;/g, ' ')
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Добавляет или обновляет аннотацию с текстом слоя.
 * Возвращает 'added' | 'updated' | 'same'.
 * Чужие аннотации и аннотации «Текст» с другим содержимым не меняются.
 */
async function syncAnnotation(node, finalText) {
  const cat = await getTextCategory();
  const label = finalText.replace(/\u00A0/g, '&nbsp;');
  const current = Array.from(node.annotations || []);

  let stored = '';
  try {
    stored = node.getPluginData(DATA_KEY) || '';
  } catch (e) {
    /* нет доступа к pluginData — ищем по тексту */
  }
  const storedNorm = stored ? normText(stored) : null;
  const textNorm = normText(finalText);
  const own = current.filter((a) => a.categoryId === cat.id);

  // Ищем «свою» аннотацию: 1) точно как записали раньше; 2) тот же смысл, что записали раньше;
  // 3) текст аннотации совпадает с текущим текстом слоя.
  const found =
    (stored && own.find((a) => annText(a) === stored)) ||
    (storedNorm && own.find((a) => normText(annText(a)) === storedNorm)) ||
    own.find((a) => normText(annText(a)) === textNorm);

  const remember = () => {
    try {
      node.setPluginData(DATA_KEY, label);
    } catch (e) {
      /* не критично */
    }
  };

  if (found) {
    if (annText(found) === label) {
      remember();
      return 'same';
    }
    const upd = { label, categoryId: cat.id };
    if (found.properties && found.properties.length) upd.properties = found.properties;
    node.annotations = current.map((a) => (a === found ? upd : a));
    remember();
    return 'updated';
  }

  node.annotations = current.concat([{ label, categoryId: cat.id }]);
  remember();
  return 'added';
}

// ------------------------------- Основной цикл -----------------------------

function collectTextNodes() {
  const out = new Map();
  for (const n of figma.currentPage.selection) {
    if (n.type === 'TEXT') out.set(n.id, n);
    else if ('findAllWithCriteria' in n) n.findAllWithCriteria({ types: ['TEXT'] }).forEach((t) => out.set(t.id, t));
  }
  return Array.from(out.values());
}

let busy = false;

async function run(annotate) {
  if (busy) return;
  busy = true;
  categoryCache = null;

  const report = {
    type: 'report',
    annotate: !!annotate,
    total: 0,
    changedNodes: 0,
    nbspPlaced: 0,
    annotations: { added: 0, updated: 0, same: 0, failed: 0 },
    dupTotal: 0,
    dups: [],
    skipped: []
  };

  try {
    const nodes = collectTextNodes();
    report.total = nodes.length;

    for (const node of nodes) {
      try {
        if (node.hasMissingFont) {
          report.skipped.push({ name: node.name, reason: 'в слое есть недоступные шрифты' });
          continue;
        }

        // 1. Неразрывные пробелы
        const count = await applyOps(node, computeOps(node.characters));
        if (count > 0) {
          report.changedNodes++;
          report.nbspPlaced += count;
        }
        const text = node.characters;

        // 2. Повторяющиеся пробелы
        each(DUP_RE, text, (m) => {
          report.dupTotal++;
          if (report.dups.length >= MAX_DUPS_SHOWN) return;
          const start = m.index;
          const end = start + m[0].length;
          const from = Math.max(0, start - 14);
          const to = Math.min(text.length, end + 14);
          report.dups.push({
            nodeId: node.id,
            nodeName: node.name,
            start,
            end,
            before: (from > 0 ? '…' : '') + text.slice(from, start),
            dup: m[0],
            after: text.slice(end, to) + (to < text.length ? '…' : '')
          });
        });

        // 3. Аннотация
        if (annotate && text.trim()) {
          try {
            report.annotations[await syncAnnotation(node, text)]++;
          } catch (e) {
            report.annotations.failed++;
            report.skipped.push({ name: node.name, reason: 'аннотация не создана: ' + String((e && e.message) || e) });
          }
        }
      } catch (e) {
        report.skipped.push({ name: node.name, reason: String((e && e.message) || e) });
      }
    }
  } finally {
    busy = false;
  }

  figma.ui.postMessage(report);

  if (report.total === 0) {
    figma.notify('Выделите хотя бы один текстовый слой');
  } else {
    let msg = 'Обработано слоёв: ' + report.total + '. Неразрывных пробелов: ' + report.nbspPlaced;
    if (report.dupTotal) msg += '. Повторы пробелов: ' + report.dupTotal;
    figma.notify(msg);
  }
}

// ----------------------------------- UI ------------------------------------

figma.showUI(__html__, { width: 340, height: 520, themeColors: true, title: 'Auto-nbsp' });

const sendSelection = () => figma.ui.postMessage({ type: 'selection', count: collectTextNodes().length });
figma.on('selectionchange', sendSelection);

figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'ready': {
      const annotate = (await figma.clientStorage.getAsync('annotate')) === true;
      figma.ui.postMessage({ type: 'init', annotate });
      sendSelection();
      if (collectTextNodes().length) await run(annotate);
      break;
    }
    case 'set-annotate':
      await figma.clientStorage.setAsync('annotate', !!msg.value);
      break;
    case 'run':
      await run(!!msg.annotate);
      break;
    case 'focus': {
      const node = await figma.getNodeByIdAsync(msg.nodeId);
      if (!node || node.type !== 'TEXT') {
        figma.notify('Слой не найден — возможно, он был удалён');
        break;
      }
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
      try {
        figma.currentPage.selectedTextRange = { node: node, start: msg.start, end: msg.end };
      } catch (e) {
        figma.notify('Слой выделен, но подсветить фрагмент не удалось');
      }
      break;
    }
  }
};
