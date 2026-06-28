/* =======================================================================
   NOVA — SVG icon library. All UI glyphs as crisp inline SVG (no emoji).
   Usage:  ICON.get('spade')  -> svg string
           ICON.hydrate(root) -> fills every [data-icon] element
   Single-color icons inherit currentColor. Emotes are full-color.
   ======================================================================= */
(function (global) {
  'use strict';

  // ---- single-color (stroke/fill use currentColor) ----
  const S = (inner, vb = '0 0 24 24', extra = '') =>
    `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${inner}</svg>`;
  const F = (inner, vb = '0 0 24 24') =>
    `<svg viewBox="${vb}" fill="currentColor">${inner}</svg>`;

  const ICONS = {
    /* ---- card suits ---- */
    spade: F('<path d="M12 2C9.5 6 4 8.5 4 13.2 4 15.9 6 18 8.6 18c1 0 1.9-.3 2.6-.9-.2 1.7-1 3-2.6 4.1v.8h6.8v-.8c-1.6-1.1-2.4-2.4-2.6-4.1.7.6 1.6.9 2.6.9C18 18 20 15.9 20 13.2 20 8.5 14.5 6 12 2z"/>'),
    heart: F('<path d="M12 21.3l-1.5-1.35C5.4 15.36 2 12.3 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.8-3.4 6.86-8.55 11.54L12 21.3z"/>'),
    diamond: F('<path d="M12 2.5l8 9.5-8 9.5-8-9.5z"/>'),
    club: F('<path d="M12 2a3.4 3.4 0 00-2.85 5.24A3.4 3.4 0 105.8 13c1.04 0 1.98-.47 2.6-1.2-.16 1.8-.96 3.2-2.6 4.4v.8h12.4v-.8c-1.64-1.2-2.44-2.6-2.6-4.4.62.73 1.56 1.2 2.6 1.2a3.4 3.4 0 10-3.35-5.76A3.4 3.4 0 0012 2z"/>'),

    /* ---- UI ---- */
    close: S('<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>'),
    back: S('<polyline points="15 5 8 12 15 19"/>'),
    settings: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>'),
    trophy: S('<path d="M6 4h12v3a6 6 0 01-12 0z"/><path d="M6 5H4a2 2 0 002 2.5M18 5h2a2 2 0 01-2 2.5"/><line x1="12" y1="13" x2="12" y2="17"/><path d="M9 21h6M9 21a3 3 0 013-3 3 3 0 013 3"/>'),
    chat: S('<path d="M21 11.5a8.38 8.38 0 01-9 8.37 8.4 8.4 0 01-3.8-.9L3 20l1.03-5.2A8.4 8.4 0 0121 11.5z"/>'),
    copy: S('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h8"/>'),
    user: S('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>'),
    logout: S('<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'),
    home: S('<path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10"/>'),
    plus: S('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    check: S('<polyline points="4 12 10 18 20 6"/>'),
    crown: F('<path d="M3 7l4 4 5-6 5 6 4-4-1.5 12h-15z"/><rect x="4" y="19" width="16" height="2.5" rx="1"/>'),
    shield: S('<path d="M12 3l8 3v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z"/>'),
    clock: S('<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>'),
    cards: S('<rect x="3" y="6" width="11" height="14" rx="2" transform="rotate(-8 8.5 13)"/><rect x="10" y="5" width="11" height="14" rx="2" transform="rotate(8 15.5 12)"/>'),
    flame: S('<path d="M12 3c1 3 4 4.5 4 8a4 4 0 01-8 0c0-1.2.4-2 1-2.7C8.5 9 8 11 8 13a4 4 0 008 0"/>'),
    coins: F('<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.66 2.69 3 6 3s6-1.34 6-3V7"/><ellipse cx="15" cy="14" rx="6" ry="3"/><path d="M9 14v3c0 1.66 2.69 3 6 3s6-1.34 6-3v-3" fill="none" stroke="currentColor" stroke-width="2"/>', '0 0 24 24'),
    star: F('<path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z"/>'),
    info: S('<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="0.6" fill="currentColor"/>'),
    eye: S('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'),
    refresh: S('<polyline points="21 4 21 10 15 10"/><path d="M20 14a8 8 0 11-2-8.5L21 8"/>'),
    medal: S('<circle cx="12" cy="15" r="6"/><path d="M9 9L6 3M15 9l3-6M9 3h6"/>'),
    bolt: F('<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>'),
    gift: S('<rect x="3" y="9" width="18" height="12" rx="2"/><line x1="12" y1="9" x2="12" y2="21"/><path d="M3 13h18M12 9C12 6 10 4 8 5s-1 4 4 4c2 0 4-2 3-4s-3 0-3 4"/>'),
    chip: F('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6" fill="#0a1f1a"/><g fill="#0a1f1a"><rect x="11" y="0.5" width="2" height="4"/><rect x="11" y="19.5" width="2" height="4"/><rect x="0.5" y="11" width="4" height="2"/><rect x="19.5" y="11" width="4" height="2"/></g>'),
    edit: S('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/>'),
    key: S('<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3m-3 0l3 3m-6 0l2 2"/>'),
    trash: S('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>'),
    admin: S('<path d="M12 3l8 3v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z"/><polyline points="9 12 11 14 15 10"/>'),
    save: S('<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'),
  };

  /* ---- full-color emotes (48x48) ---- */
  const EMOTES = {
    cool: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#FFC83D"/><path d="M8 20h13a3 3 0 013 3 3 3 0 013-3h13v3a8 8 0 01-8 8 8 8 0 01-7.5-5.2A8 8 0 0124 28a8 8 0 01-2 1.8A8 8 0 0116 31a8 8 0 01-8-8z" fill="#1c1c2e"/><path d="M17 37a9 9 0 0014 0" stroke="#7a4a00" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
    fire: `<svg viewBox="0 0 48 48"><path d="M24 3c4 8 13 11 13 22a13 13 0 01-26 0c0-4 1.3-6.5 3.2-8.6C13.5 22 12 26 12 30a12 12 0 0024 0c0-7-6-9-6-15z" fill="#FF6A00"/><path d="M24 18c2 4 6 5 6 11a6 6 0 01-12 0c0-2 .6-3.4 1.5-4.5C18.7 26 18 28 18 30a6 6 0 0012 0c0-3.5-3-4.5-3-7.5z" fill="#FFD21E"/></svg>`,
    shock: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#FFC83D"/><ellipse cx="16" cy="19" rx="3.2" ry="4.5" fill="#1c1c2e"/><ellipse cx="32" cy="19" rx="3.2" ry="4.5" fill="#1c1c2e"/><ellipse cx="24" cy="34" rx="6" ry="8" fill="#5b2b2b"/></svg>`,
    skull: `<svg viewBox="0 0 48 48"><path d="M24 4C13 4 6 11 6 22c0 6 3 10 6 12v6a4 4 0 004 4h16a4 4 0 004-4v-6c3-2 6-6 6-12C42 11 35 4 24 4z" fill="#F1F2F6"/><circle cx="16" cy="22" r="5" fill="#1c1c2e"/><circle cx="32" cy="22" r="5" fill="#1c1c2e"/><path d="M24 28l-2.5 5h5z" fill="#1c1c2e"/><g stroke="#1c1c2e" stroke-width="2"><line x1="20" y1="40" x2="20" y2="44"/><line x1="24" y1="40" x2="24" y2="44"/><line x1="28" y1="40" x2="28" y2="44"/></g></svg>`,
    money: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#3CB371"/><circle cx="24" cy="24" r="22" fill="#FFC83D" opacity=".15"/><path d="M16 36a9 9 0 0016 0z" fill="#7a4a00"/><text x="14.5" y="24" font-size="11" font-weight="900" fill="#1b7a4a" font-family="Arial">$</text><text x="27" y="24" font-size="11" font-weight="900" fill="#1b7a4a" font-family="Arial">$</text><path d="M22 33h4v2c0 .8 1 1.4 2 1.4v1.6c-1 0-2 .3-2 1.1h-4c0-.8-1-1.1-2-1.1v-1.6c1 0 2-.6 2-1.4z" fill="#1b7a4a"/></svg>`,
    clap: `<svg viewBox="0 0 48 48"><g stroke="#FFB02E" stroke-width="2.5" stroke-linecap="round"><line x1="24" y1="6" x2="24" y2="11"/><line x1="14" y1="9" x2="16" y2="13"/><line x1="34" y1="9" x2="32" y2="13"/></g><path d="M14 18c-3 1-5 4-4 7l3 9c1 3 4 5 7 4l6-2-8-19z" fill="#FFC83D"/><path d="M34 18c3 1 5 4 4 7l-3 9c-1 3-4 5-7 4l-6-2 8-19z" fill="#FFD79A"/></svg>`,
    clover: `<svg viewBox="0 0 48 48"><g fill="#2FBF4F"><path d="M24 24c-4-4-4-10 0-13s10 1 8 7c5-2 9 3 6 8s-10 2-14-2z"/><path d="M24 24c4-4 10-4 13 0s-1 10-7 8c2 5-3 9-8 6s-2-10 2-14z"/><path d="M24 24c4 4 4 10 0 13s-10-1-8-7c-5 2-9-3-6-8s10-2 14 2z"/><path d="M24 24c-4 4-10 4-13 0s1-10 7-8c-2-5 3-9 8-6s2 10-2 14z"/></g><path d="M24 24c2 6 2 12 0 18" stroke="#1b7a3a" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`,
    cry: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#FFC83D"/><path d="M12 18c2-2 6-2 8 0M28 18c2-2 6-2 8 0" stroke="#1c1c2e" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M14 23c0 6-3 9-3 13a3 3 0 006 0c0-4-3-7-3-13z" fill="#54C5F8"/><path d="M34 23c0 6 3 9 3 13a3 3 0 01-6 0c0-4 3-7 3-13z" fill="#54C5F8"/><ellipse cx="24" cy="36" rx="6" ry="5" fill="#5b2b2b"/></svg>`,
    gg: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#FFC83D"/><path d="M14 19l4 3-4 3M34 19l-4 3 4 3" stroke="#1c1c2e" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 33a10 10 0 0016 0" stroke="#7a4a00" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  };

  function get(name) { return ICONS[name] || ''; }
  function emote(name) { return EMOTES[name] || ''; }

  function hydrate(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(el => {
      if (el._iconDone === el.dataset.icon) return;
      const n = el.dataset.icon;
      el.innerHTML = ICONS[n] || EMOTES[n] || '';
      el._iconDone = n;
    });
  }

  global.ICON = { get, emote, hydrate, ICONS, EMOTES, EMOTE_LIST: Object.keys(EMOTES) };
})(window);
