/* =========================================================================
   Frontmatter + markdown rendering, shared by the static page generators.
   No dependencies — a deliberate subset, not a full markdown implementation.

   parseFrontmatter(src, file, fail)
     YAML subset: flat scalars + lists of flat objects, 2-space indent.
     Returns { data, body }. Calls fail(msg) — supplied by the caller so each
     generator prefixes its own name — on anything it can't parse.

   renderMd(md, site)
     Block level:  ## / ### headings, - lists, standalone ![alt](src) images,
                   > blockquotes, paragraphs.
     Inline:       **bold**, *italic*, [text](href), `code`.
     Links outside `site` get target="_blank" rel="noopener".
   ========================================================================= */

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------- frontmatter (YAML subset) ---------- */
function scalar(v) {
  if (/^".*"$/.test(v) || /^'.*'$/.test(v)) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

export function parseFrontmatter(src, file, fail) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) fail(file + ': missing frontmatter block (--- … ---)');
  const data = {};
  let listKey = null, listItem = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.match(/^ */)[0].length;
    const line = raw.trim();
    if (indent === 0) {
      listKey = null; listItem = null;
      const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (!kv) fail(file + ': bad frontmatter line: "' + line + '"');
      if (kv[2] === '') { data[kv[1]] = []; listKey = kv[1]; }
      else data[kv[1]] = scalar(kv[2]);
    } else if (line.startsWith('- ')) {
      if (!listKey) fail(file + ': list item outside a list: "' + line + '"');
      listItem = {};
      data[listKey].push(listItem);
      const kv = line.slice(2).match(/^([\w-]+):\s*(.*)$/);
      if (!kv) fail(file + ': bad list item line: "' + line + '"');
      listItem[kv[1]] = scalar(kv[2]);
    } else {
      if (!listItem) fail(file + ': indented line outside a list item: "' + line + '"');
      const kv = line.match(/^([\w-]+):\s*(.*)$/);
      if (!kv) fail(file + ': bad list item line: "' + line + '"');
      listItem[kv[1]] = scalar(kv[2]);
    }
  }
  return { data, body: m[2].trim() };
}

/* ---------- markdown subset ---------- */
export function inline(s, site) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, text, href) {
    const ext = /^https?:/.test(href) && href.indexOf(site) !== 0;
    return '<a href="' + href + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + text + '</a>';
  });
  return s;
}

export function renderMd(md, site) {
  return md.split(/\n{2,}/).map(function (b) {
    b = b.trim();
    if (!b) return '';
    if (b.startsWith('### ')) return '<h3>' + inline(b.slice(4), site) + '</h3>';
    if (b.startsWith('## ')) return '<h2>' + inline(b.slice(3), site) + '</h2>';
    const lines = b.split('\n');
    if (lines.every(function (l) { return l.trim().startsWith('- '); })) {
      return '<ul>' + lines.map(function (l) { return '<li>' + inline(l.trim().slice(2), site) + '</li>'; }).join('') + '</ul>';
    }
    if (lines.every(function (l) { return l.trim().startsWith('>'); })) {
      const text = lines.map(function (l) { return l.trim().replace(/^>\s?/, ''); }).join(' ');
      return '<blockquote><p>' + inline(text, site) + '</p></blockquote>';
    }
    const img = b.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (img) return '<figure class="prose-img"><img src="' + esc(img[2]) + '" alt="' + esc(img[1]) + '" loading="lazy" /></figure>';
    return '<p>' + inline(lines.join(' '), site) + '</p>';
  }).filter(Boolean).join('\n');
}
