// Small local SVG icons: stable rendering without emoji or external icon fonts.
const paths = {
  '↗': 'M4 20 20 4M5 4h15v15', '↻': 'M20 10a8 8 0 1 0-1 8M20 4v6h-6',
  '↓': 'M12 3v18M5 14l7 7 7-7', '↑': 'M12 21V3M5 10l7-7 7 7',
  '▶': 'M8 5l11 7-11 7z', 'Ⅱ': 'M8 5v14M16 5v14',
  '▦': 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  '◖': 'M4 14v-3a8 8 0 0 1 16 0v3M4 12h3v8H4zM17 12h3v8h-3z',
  '✧': 'M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10z',
  '▱': 'M6 3h12v19l-6-4-6 4z', '▣': 'M6 3h12v19l-6-4-6 4zM9 8h6',
  '◎': 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18z',
  '⌘': 'M8 8h8v8H8zM8 8V5a3 3 0 1 0-3 3h3M16 8V5a3 3 0 1 1 3 3h-3M16 16v3a3 3 0 1 0 3-3h-3M8 16v3a3 3 0 1 1-3-3h3',
  '⚙': 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1zM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  '◈': 'M12 2l10 10-10 10L2 12zM12 8l4 4-4 4-4-4z',
  '⚑': 'M5 22V3h14l-3 5 3 5H5',
  '◉': 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM15 8l-6-1-3 5 4 6 6-1 2-6z',
  '✚': 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  '▤': 'M4 3h16v18H4zM8 8h8M8 12h8M8 16h5',
  '❋': 'M12 22V10M12 17C4 17 2 9 4 4c5 0 9 4 8 10M12 14c0-7 3-10 9-11 1 6-2 12-9 13',
  '◌': 'M9 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM1 21v-4a5 5 0 0 1 10 0v4M13 21v-4a5 5 0 0 1 10 0v4',
  '↶': 'M5 4v6h6M5 10a8 8 0 1 1 0 7', '↷': 'M19 4v6h-6M19 10a8 8 0 1 0 0 7',
  '⏭': 'M6 5l10 7-10 7zM19 5v14', '⏮': 'M18 5L8 12l10 7zM5 5v14', '⌄': 'M6 9l6 6 6-6', '⌕': 'M21 21l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
};
const compass = Array.from({ length: 8 }, (_, n) => `<path d="M12 2v6" transform="rotate(${n * 45} 12 12)"/>`).join('') + '<circle cx="12" cy="12" r="1.5"/>';
function glyph(char) {
  const span = document.createElement('span');
  span.className = 'svg-icon-wrap'; span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg class="ui-icon" viewBox="0 0 24 24">${char === '✳' ? compass : '<path d="' + paths[char] + '"/>'}</svg>`;
  return span;
}
const chars = /[↗↻↓↑▶Ⅱ▦◖✧▱▣◎⌘⚙◈⚑◉✚▤❋◌↶↷✳⏭⏮⌄⌕]/g;
function replaceIcons() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest('script,style,svg,h1,h3,p,time,input,option,.chat-message')) continue;
    if (node.textContent.match(chars)) nodes.push(node);
  }
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    let start = 0;
    for (const match of node.textContent.matchAll(chars)) {
      fragment.append(node.textContent.slice(start, match.index), glyph(match[0]));
      start = match.index + match[0].length;
    }
    fragment.append(node.textContent.slice(start));
    node.replaceWith(fragment);
  }
}
replaceIcons();
new MutationObserver(replaceIcons).observe(document.body, { childList: true, subtree: true, characterData: true });
