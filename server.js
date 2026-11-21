// server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Cloud Run asigna dinámicamente el puerto a través de process.env.PORT
const PORT = process.env.PORT || 3000;

// Servir la carpeta images estáticamente
app.use('/images', express.static(path.join(__dirname, 'images')));

const BIBLE_URL = "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/es_rvr1960.json";

let bibleData = null;
let flatVerses = [];

async function loadBible() {
  if (bibleData) return;
  
  console.log("Cargando la Biblia es_rvr1960 en memoria...");
  const res = await fetch(BIBLE_URL);
  if (!res.ok) throw new Error("No se pudo cargar el archivo JSON de la Biblia.");
  bibleData = await res.json();

  flatVerses = [];
  bibleData.forEach((book, bookIdx) => {
    book.chapters.forEach((chapter, chapterIdx) => {
      chapter.forEach((verseText, verseIdx) => {
        flatVerses.push({
          bookIndex: bookIdx,
          chapterIndex: chapterIdx,
          verseIndex: verseIdx,
          bookName: book.name,
          chapterNum: chapterIdx + 1,
          verseNum: verseIdx + 1,
          text: verseText
        });
      });
    });
  });
  console.log(`Biblia cargada correctamente. Total versículos: ${flatVerses.length}`);
}

async function getRandomIndex(max) {
  try {
    const randomUrl = `https://www.random.org/integers/?num=1&min=1&max=${max}&col=1&base=10&format=plain&rnd=new`;
    const res = await fetch(randomUrl);
    if (!res.ok) throw new Error("Error consultando random.org");
    const text = await res.text();
    const num = parseInt(text.trim(), 10);
    if (isNaN(num)) throw new Error("Respuesta inválida de random.org");
    return num - 1;
  } catch (err) {
    console.warn("Falló random.org, usando Math.random() como respaldo:", err.message);
    return Math.floor(Math.random() * max);
  }
}

// =====================================================================
// Búsqueda: por cita en español (ej. "Sal 110:6") y por palabras.
// (Código adicional: no modifica la lógica del versículo aleatorio.)
// =====================================================================

// Mapa de nombres y abreviaturas (en español) hacia el índice del libro.
const BOOK_ALIASES = {
  // Antiguo Testamento
  genesis: 0, gen: 0, gn: 0,
  exodo: 1, exo: 1, ex: 1,
  levitico: 2, lev: 2, lv: 2,
  numeros: 3, num: 3, nm: 3,
  deuteronomio: 4, deut: 4, dt: 4,
  josue: 5, jos: 5,
  jueces: 6, jue: 6, jc: 6, jz: 6,
  rut: 7, rt: 7,
  "1samuel": 8, "1sam": 8, "1s": 8, "1sm": 8,
  "2samuel": 9, "2sam": 9, "2s": 9, "2sm": 9,
  "1reyes": 10, "1rey": 10, "1r": 10, "1re": 10, "1rs": 10,
  "2reyes": 11, "2rey": 11, "2r": 11, "2re": 11, "2rs": 11,
  "1cronicas": 12, "1cron": 12, "1cr": 12, "1cro": 12,
  "2cronicas": 13, "2cron": 13, "2cr": 13, "2cro": 13,
  esdras: 14, esd: 14,
  nehemias: 15, neh: 15, ne: 15,
  ester: 16, est: 16,
  job: 17,
  salmos: 18, salmo: 18, sal: 18, sl: 18, ps: 18,
  proverbios: 19, prov: 19, pro: 19, pr: 19, pv: 19,
  eclesiastes: 20, ecl: 20, ec: 20,
  cantares: 21, cantar: 21, cant: 21, cnt: 21, ct: 21,
  isaias: 22, isa: 22, is: 22,
  jeremias: 23, jer: 23, jr: 23,
  lamentaciones: 24, lam: 24, lm: 24,
  ezequiel: 25, eze: 25, ez: 25,
  daniel: 26, dan: 26, dn: 26,
  oseas: 27, ose: 27, os: 27,
  joel: 28, jl: 28,
  amos: 29, am: 29,
  abdias: 30, abd: 30, ob: 30,
  jonas: 31, jon: 31,
  miqueas: 32, miq: 32, mi: 32, mq: 32,
  nahum: 33, nah: 33, na: 33,
  habacuc: 34, hab: 34, hc: 34,
  sofonias: 35, sof: 35, sf: 35,
  hageo: 36, hag: 36, ag: 36,
  zacarias: 37, zac: 37, zc: 37,
  malaquias: 38, mala: 38, mal: 38, ml: 38
};

// Nuevo Testamento (se añaden al mismo mapa).
Object.assign(BOOK_ALIASES, {
  mateo: 39, mat: 39, mt: 39, sanmateo: 39,
  marcos: 40, marc: 40, mc: 40, sanmarcos: 40,
  lucas: 41, luc: 41, lc: 41, sanlucas: 41,
  juan: 42, jn: 42, jo: 42, sanjuan: 42,
  hechos: 43, hech: 43, hch: 43, atos: 43,
  romanos: 44, rom: 44, ro: 44, rm: 44,
  "1corintios": 45, "1cor": 45, "1co": 45,
  "2corintios": 46, "2cor": 46, "2co": 46,
  galatas: 47, gal: 47, ga: 47, gl: 47,
  efesios: 48, efe: 48, ef: 48,
  filipenses: 49, fil: 49, flp: 49, fp: 49,
  colosenses: 50, col: 50, cl: 50,
  "1tesalonicenses": 51, "1tes": 51, "1ts": 51,
  "2tesalonicenses": 52, "2tes": 52, "2ts": 52,
  "1timoteo": 53, "1tim": 53, "1ti": 53, "1tm": 53,
  "2timoteo": 54, "2tim": 54, "2ti": 54, "2tm": 54,
  tito: 55, tit: 55, tt: 55,
  filemon: 56, filem: 56, flm: 56, fm: 56,
  hebreos: 57, heb: 57, he: 57, hb: 57,
  santiago: 58, sant: 58, stg: 58, tg: 58,
  "1pedro": 59, "1ped": 59, "1p": 59, "1pe": 59,
  "2pedro": 60, "2ped": 60, "2p": 60, "2pe": 60,
  "1juan": 61, "1jn": 61, "1jo": 61,
  "2juan": 62, "2jn": 62, "2jo": 62,
  "3juan": 63, "3jn": 63, "3jo": 63,
  judas: 64, jud: 64, sanjudas: 64, jd: 64,
  apocalipsis: 65, apoc: 65, ap: 65, elapocalipsis: 65
});

function stripAccents(str) {
  return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeText(str) {
  return stripAccents(str).toLowerCase();
}

// Interpreta entradas como "Sal 110:6", "Salmos 110,6", "1 Juan 3:16" o "Sal 110".
function parseReference(raw) {
  if (!raw) return null;
  let s = normalizeText(raw);
  s = s.replace(/([a-z])\./g, "$1");   // punto de abreviatura: "sal." -> "sal"
  s = s.replace(/\.(?=\d)/g, ":");     // separador numérico: "110.6" -> "110:6"
  s = s.replace(/[,;]/g, ":");         // comas y punto y coma como separador
  s = s.replace(/\s+/g, " ").trim();

  const m = s.match(/^(.*?)\s+(\d+)(?:\s*:?\s*(\d+))?$/);
  if (!m) return null;

  const bookKey = m[1].replace(/[^a-z0-9]/g, "");
  if (!(bookKey in BOOK_ALIASES)) return null;

  return {
    bookIdx: BOOK_ALIASES[bookKey],
    chapter: parseInt(m[2], 10),
    verse: m[3] ? parseInt(m[3], 10) : null
  };
}

// Búsqueda por palabras: devuelve los versículos que contienen TODAS las palabras.
function searchVerses(query, limit = 100) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const results = [];
  for (const v of flatVerses) {
    const text = normalizeText(v.text);
    if (words.every((w) => text.includes(w))) {
      results.push(v);
      if (results.length >= limit) break;
    }
  }
  return results;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Expresión regular insensible a mayúsculas y tildes para resaltar coincidencias.
function buildHighlightRegex(words) {
  const accentClass = {
    a: "aáàäâ", e: "eéèëê", i: "iíìïî", o: "oóòöô",
    u: "uúùüû", n: "nñ", c: "cç", y: "yýÿ"
  };
  const patterns = words.map((word) =>
    word.split("").map((ch) => {
      const group = accentClass[ch];
      if (group) return `[${group}]`;
      return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("")
  );
  return new RegExp(`(${patterns.join("|")})`, "gi");
}

function highlightText(text, words) {
  if (!words || words.length === 0) return escapeHtml(text);
  const re = buildHighlightRegex(words);
  return String(text)
    .split(re)
    .map((part, idx) => (idx % 2 === 1 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
    .join("");
}

function searchBoxHtml(q = "", autofocus = false) {
  return `
    <form action="/buscar" method="get" role="search" class="mb-4">
      <div class="input-group">
        <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
        <input type="search" name="q" value="${escapeHtml(q)}" class="form-control" placeholder="Buscar cita (Sal 110:6) o palabras..." aria-label="Buscar cita o palabras" ${autofocus ? "autofocus" : ""}>
        <button class="btn btn-primary" type="submit">Buscar</button>
      </div>
    </form>`;
}

function renderSearchShell(title, contentHtml, q = "") {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)} - RVR1960</title>
      <link rel="icon" type="image/png" href="/images/logo.png">
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
      <style>
        body { background-color: #f4f6f9; color: #2c3e50; margin: 0; padding: 30px 15px; }
        .search-wrap { max-width: 800px; margin: 0 auto; }
        .search-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .search-logo { max-height: 48px; object-fit: contain; }
        .search-card { background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        .result-item { padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
        .result-item:last-child { border-bottom: none; }
        .result-ref { font-weight: 700; color: #1b4965; text-decoration: none; }
        .result-ref:hover { text-decoration: underline; }
        .result-text { margin: 4px 0 0; line-height: 1.6; }
        mark { background-color: #a7f3d0; color: #064e3b; padding: 0 2px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <div class="search-wrap">
        <div class="search-header">
          <a href="/" title="Inicio"><img src="/images/logo.png" alt="Logo" class="search-logo"></a>
          <a href="/" class="btn btn-outline-secondary btn-sm"><i class="bi bi-house"></i> Inicio</a>
        </div>
        <div class="search-card">
          ${searchBoxHtml(q, true)}
          ${contentHtml}
        </div>
      </div>
    </body>
    </html>`;
}

function renderSearchPage(q, results, limit, limitHit) {
  const words = normalizeText(q).split(/\s+/).filter(Boolean);
  let body;
  if (results.length === 0) {
    body = `<p class="text-muted mb-0">No se encontraron versículos que contengan <strong>"${escapeHtml(q)}"</strong>.</p>`;
  } else {
    body = `
      <p class="text-muted">${results.length}${limitHit ? "+" : ""} resultado(s) para <strong>"${escapeHtml(q)}"</strong>${limitHit ? ` (mostrando los primeros ${limit})` : ""}.</p>
      <div>
        ${results.map((v) => `
          <div class="result-item">
            <a class="result-ref" href="/?book=${v.bookIndex}&chapter=${v.chapterIndex}&verse=${v.verseNum}">
              ${escapeHtml(v.bookName)} ${v.chapterNum}:${v.verseNum}
            </a>
            <p class="result-text">${highlightText(v.text, words)}</p>
          </div>`).join("")}
      </div>`;
  }
  return renderSearchShell(`Resultados: ${q}`, body, q);
}

function renderMessagePage(q, message) {
  const body = `<div class="alert alert-warning mb-0" role="alert">${escapeHtml(message)}</div>`;
  return renderSearchShell("Búsqueda", body, q);
}

app.get('/', async (req, res) => {
  try {
    await loadBible();

    let bookIdx = parseInt(req.query.book, 10);
    let chapterIdx = parseInt(req.query.chapter, 10);
    let highlightVerse = parseInt(req.query.verse, 10);
    let verseGlobalIndex = null;

    if (isNaN(bookIdx) || isNaN(chapterIdx)) {
      const totalVerses = flatVerses.length;
      verseGlobalIndex = await getRandomIndex(totalVerses);
      const selected = flatVerses[verseGlobalIndex];
      bookIdx = selected.bookIndex;
      chapterIdx = selected.chapterIndex;
      highlightVerse = selected.verseNum;
    }

    if (bookIdx < 0) bookIdx = 0;
    if (bookIdx >= bibleData.length) bookIdx = bibleData.length - 1;

    const currentBook = bibleData[bookIdx];
    if (chapterIdx < 0) chapterIdx = 0;
    if (chapterIdx >= currentBook.chapters.length) chapterIdx = currentBook.chapters.length - 1;

    const fullChapter = currentBook.chapters[chapterIdx];

    let prevLink = null;
    if (chapterIdx > 0) {
      prevLink = `/?book=${bookIdx}&chapter=${chapterIdx - 1}`;
    } else if (bookIdx > 0) {
      const prevBookIndex = bookIdx - 1;
      const lastChapterOfPrevBook = bibleData[prevBookIndex].chapters.length - 1;
      prevLink = `/?book=${prevBookIndex}&chapter=${lastChapterOfPrevBook}`;
    }

    let nextLink = null;
    if (chapterIdx < currentBook.chapters.length - 1) {
      nextLink = `/?book=${bookIdx}&chapter=${chapterIdx + 1}`;
    } else if (bookIdx < bibleData.length - 1) {
      nextLink = `/?book=${bookIdx + 1}&chapter=0`;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${currentBook.name} ${chapterIdx + 1} - RVR1960</title>
        <!-- Favicon con tu logo -->
        <link rel="icon" type="image/png" href="/images/logo.png">
        <!-- Bootstrap 5 CSS -->
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <!-- Bootstrap Icons -->
        <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
        <style>
          body {
            background-color: #f4f6f9;
            color: #2c3e50;
            height: 100vh;
            margin: 0;
            overflow: hidden;
            display: flex;
          }

          /* Sidebar Retraíble */
          .sidebar {
            width: 320px;
            background: #ffffff;
            border-right: 1px solid #e2e8f0;
            display: flex;
            flex-direction: column;
            height: 100%;
            transition: transform 0.3s ease, width 0.3s ease;
            position: relative;
            z-index: 10;
          }
          .sidebar.collapsed {
            transform: translateX(-100%);
            width: 0;
            overflow: hidden;
            border: none;
          }

          .sidebar-header {
            padding: 12px 20px;
            background: #ffffff;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .sidebar-logo {
            max-height: 48px;
            object-fit: contain;
            margin: 0 auto;
          }

          /* Botón flotante para expandir sidebar cuando está retraído */
          .toggle-sidebar-btn {
            position: absolute;
            top: 20px;
            left: 20px;
            z-index: 100;
            background: #ffffff;
            color: #1b4965;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 8px 12px;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          }
          .toggle-sidebar-btn:hover {
            background: #f1f5f9;
          }

          .book-list {
            overflow-y: auto;
            flex: 1;
            padding: 10px;
          }

          /* Main Content */
          .main-content {
            flex: 1;
            overflow-y: auto;
            padding: 30px;
            display: flex;
            justify-content: center;
            align-items: flex-start;
          }
          .bible-container {
            max-width: 800px;
            width: 100%;
            background: #ffffff;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
          }
          .verse-num {
            font-size: 0.75rem;
            font-weight: bold;
            color: #64748b;
            vertical-align: super;
          }
          .highlight {
            background-color: #a7f3d0;
            color: #064e3b;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>

        <!-- Botón para alternar sidebar (visible siempre) -->
        <button class="toggle-sidebar-btn" onclick="toggleSidebar()" title="Mostrar/Ocultar Menú">
          <i class="bi bi-list fs-5"></i>
        </button>

        <!-- Sidebar de Navegación -->
        <div class="sidebar" id="sidebar">
          <div class="sidebar-header">
            <button class="btn btn-sm btn-light border" onclick="toggleSidebar()" title="Ocultar Menú">
              <i class="bi bi-list"></i>
            </button>
            <img src="/images/logo.png" alt="Logo" class="sidebar-logo">
            <div style="width: 32px;"></div>
          </div>
          <div class="book-list accordion accordion-flush" id="accordionBooks">
            ${bibleData.map((b, bIdx) => `
              <div class="accordion-item border mb-1 rounded">
                <h2 class="accordion-header" id="heading${bIdx}">
                  <button class="accordion-button ${bIdx === bookIdx ? '' : 'collapsed'} py-2 px-3 fw-semibold bg-light" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${bIdx}" aria-expanded="${bIdx === bookIdx}" aria-controls="collapse${bIdx}">
                    ${b.name}
                  </button>
                </h2>
                <div id="collapse${bIdx}" class="accordion-collapse collapse ${bIdx === bookIdx ? 'show' : ''}" aria-labelledby="heading${bIdx}" data-bs-parent="#accordionBooks">
                  <div class="accordion-body p-2">
                    <div class="d-flex flex-wrap gap-1">
                      ${b.chapters.map((_, cIdx) => `
                        <a href="/?book=${bIdx}&chapter=${cIdx}" 
                           class="btn btn-sm ${bIdx === bookIdx && cIdx === chapterIdx ? 'btn-primary' : 'btn-outline-secondary'}" style="width: 40px;">
                           ${cIdx + 1}
                        </a>
                      `).join('')}
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Contenido Principal -->
        <div class="main-content">
          <div class="bible-container">
            <form action="/buscar" method="get" role="search" class="mb-4">
              <div class="input-group">
                <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
                <input type="search" name="q" class="form-control" placeholder="Buscar cita (Sal 110:6) o palabras..." aria-label="Buscar cita o palabras">
                <button class="btn btn-primary" type="submit">Buscar</button>
              </div>
            </form>
            ${verseGlobalIndex !== null ? `<span class="badge bg-info text-dark mb-3">Versículo #${verseGlobalIndex + 1} de ${flatVerses.length}</span>` : ''}
            
            <div class="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
              <a href="${prevLink || '#'}" class="btn btn-outline-secondary ${!prevLink ? 'disabled' : ''}">
                <i class="bi bi-arrow-left"></i> Anterior
              </a>
              <h1 class="h3 text-dark m-0 fw-bold">${currentBook.name} ${chapterIdx + 1}</h1>
              <a href="${nextLink || '#'}" class="btn btn-outline-secondary ${!nextLink ? 'disabled' : ''}">
                Siguiente <i class="bi bi-arrow-right"></i>
              </a>
            </div>

            <div class="fs-5 lh-lg text-justify">
              ${fullChapter.map((verseText, idx) => {
                const verseNumber = idx + 1;
                const isSelected = verseNumber === highlightVerse;
                return `
                  <span class="me-1 ${isSelected ? 'highlight' : ''}">
                    <sup class="verse-num">${verseNumber}</sup>${verseText}
                  </span>
                `;
              }).join(' ')}
            </div>

            <div class="text-center mt-4 pt-3 border-top">
              <a href="/" class="btn btn-warning px-4 py-2 shadow-sm">
                <i class="bi bi-dice-5-fill"></i> Versículo Aleatorio (random.org)
              </a>
            </div>
          </div>
        </div>

        <!-- Bootstrap JS Bundle -->
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
        <script>
          function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('collapsed');
          }
        </script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error procesando la solicitud: " + error.message);
  }
});

// Búsqueda: por cita en español (redirige al capítulo/versículo) o por palabras.
app.get('/buscar', async (req, res) => {
  try {
    await loadBible();

    const q = (req.query.q || '').toString().trim();
    if (!q) return res.redirect('/');

    // 1) ¿Es una cita tipo "Sal 110:6"?
    const ref = parseReference(q);
    if (ref) {
      const book = bibleData[ref.bookIdx];
      const chapterIdx = ref.chapter - 1;
      if (chapterIdx >= 0 && chapterIdx < book.chapters.length) {
        const chapter = book.chapters[chapterIdx];
        const wantsVerse = ref.verse !== null;
        const verseOk = wantsVerse && ref.verse >= 1 && ref.verse <= chapter.length;

        if (wantsVerse && !verseOk) {
          return res.status(404).send(
            renderMessagePage(q, `El versículo ${ref.verse} no existe en ${book.name} ${ref.chapter}.`)
          );
        }

        let url = `/?book=${ref.bookIdx}&chapter=${chapterIdx}`;
        if (verseOk) url += `&verse=${ref.verse}`;
        return res.redirect(url);
      }
      return res.status(404).send(
        renderMessagePage(q, `El capítulo ${ref.chapter} no existe en ${book.name}.`)
      );
    }

    // 2) Búsqueda por palabras
    const limit = 100;
    const results = searchVerses(q, limit + 1);
    const limitHit = results.length > limit;
    const shown = limitHit ? results.slice(0, limit) : results;

    res.send(renderSearchPage(q, shown, limit, limitHit));
  } catch (error) {
    console.error(error);
    res.status(500).send("Error procesando la búsqueda: " + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});