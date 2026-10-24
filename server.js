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

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});