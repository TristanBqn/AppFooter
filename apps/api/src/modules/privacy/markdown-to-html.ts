// Conversion markdown → HTML minimaliste, dédiée à `docs/legal/privacy.md` (titres, paragraphes,
// listes à puces, gras, citation, tableau à deux colonnes). Fonction pure, pas de dépendance.
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInline(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function parseTableRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function renderPrivacyHtml(markdown: string): string {
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let tableRows: string[][] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push(`<ul>${list.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      list = [];
    }
  };
  const flushTable = () => {
    if (tableRows.length > 0) {
      const [header, ...body] = tableRows;
      const thead = `<thead><tr>${header!.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${body
        .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`)
        .join("")}</tbody>`;
      blocks.push(`<table>${thead}${tbody}</table>`);
      tableRows = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushTable();
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line === "") {
      flushAll();
      continue;
    }
    if (line.startsWith("# ")) {
      flushAll();
      blocks.push(`<h1>${renderInline(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("## ")) {
      flushAll();
      blocks.push(`<h2>${renderInline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("> ")) {
      flushAll();
      blocks.push(`<blockquote>${renderInline(line.slice(2))}</blockquote>`);
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      flushTable();
      list.push(line.slice(2));
      continue;
    }
    if (line.startsWith("|")) {
      flushParagraph();
      flushList();
      const cells = parseTableRow(line);
      if (cells.every((cell) => /^-+$/.test(cell))) continue; // ligne séparatrice d'en-tête
      tableRows.push(cells);
      continue;
    }

    flushList();
    flushTable();
    paragraph.push(line);
  }
  flushAll();

  return blocks.join("\n");
}
