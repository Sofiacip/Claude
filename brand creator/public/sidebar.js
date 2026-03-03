(function() {
  // Don't inject twice
  if (document.getElementById('fios-sidebar')) return;

  // Don't inject on login page
  if (window.location.pathname === '/login') return;

  const BASE = 'https://app.scaleforimpact.co';
  const modules = [
    { id: 'dashboard', title: 'Dashboard', icon: 'grid', href: BASE + '/' },
    { id: 'brand-creator', title: 'Brand Creator', icon: 'palette', href: BASE + '/brand-creator/' },
    { id: 'market-researcher', title: 'Market Researcher', icon: 'search', href: BASE + '/market-researcher/' },
    { id: 'doc-factory', title: 'Doc Factory', icon: 'file-text', href: BASE + '/doc-factory/' },
    { id: 'copywriter', title: 'Copywriter', icon: 'pen-tool', href: BASE + '/copywriter/' },
    { id: 'web-designer', title: 'Web Designer', icon: 'monitor', href: BASE + '/web-designer/' },
    { id: 'funnel-designer', title: 'Funnel Designer', icon: 'git-branch', href: BASE + '/funnel-designer/' },
  ];

  // Detect which module is active based on pathname or port (port for direct access)
  const path = window.location.pathname;
  const port = window.location.port;
  const pathMap = { '/brand-creator': 'brand-creator', '/copywriter': 'copywriter', '/web-designer': 'web-designer', '/funnel-designer': 'funnel-designer', '/market-researcher': 'market-researcher', '/doc-factory': 'doc-factory' };
  const portMap = { '3001': 'brand-creator', '3002': 'copywriter', '3003': 'web-designer', '3004': 'funnel-designer', '3005': 'market-researcher', '3006': 'doc-factory' };
  const activeId = pathMap[Object.keys(pathMap).find(p => path.startsWith(p))] || portMap[port] || 'dashboard';

  // SVG icons (simple, inline)
  const icons = {
    'grid': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    'palette': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.7-.1 2.5-.3.4-.1.7-.5.7-.9v-.7c0-.5-.3-.9-.7-1.1-.9-.5-.7-1.9.4-2 3.2-.3 5.7-2.9 6.1-6.1C21.4 6.5 17.2 2 12 2z"/></svg>',
    'pen-tool': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
    'monitor': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    'git-branch': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
    'search': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    'file-text': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    'collapse': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  };

  // Inject CSS
  const style = document.createElement('style');
  style.textContent = `
    #fios-sidebar {
      position: fixed; top: 0; left: 0; bottom: 0; width: 220px;
      background: #0A0A0A; border-right: 1px solid #1a1a1a;
      z-index: 9999; display: flex; flex-direction: column;
      font-family: 'Open Sans', sans-serif;
      transition: width 0.2s ease, transform 0.2s ease;
      overflow: hidden;
    }
    #fios-sidebar.collapsed { width: 56px; }
    #fios-sidebar .sidebar-logo {
      padding: 16px 14px; display: flex; align-items: center; gap: 10px;
      border-bottom: 1px solid #1a1a1a; min-height: 56px; cursor: pointer;
    }
    #fios-sidebar .sidebar-logo img { width: 28px; height: 28px; flex-shrink: 0; }
    #fios-sidebar .sidebar-logo span {
      font-family: 'Kanit', sans-serif; font-weight: 700; font-size: 14px;
      color: #FFDB2A; white-space: nowrap; overflow: hidden;
    }
    #fios-sidebar.collapsed .sidebar-logo span { display: none; }
    #fios-sidebar .sidebar-nav { flex: 1; padding: 8px 0; overflow-y: auto; }
    #fios-sidebar .sidebar-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; margin: 2px 8px; border-radius: 6px;
      color: #71717a; text-decoration: none; font-size: 13px; font-weight: 500;
      transition: background 0.15s, color 0.15s; white-space: nowrap; overflow: hidden;
    }
    #fios-sidebar .sidebar-item:hover { background: #111; color: #e4e4e7; }
    #fios-sidebar .sidebar-item.active { background: rgba(255, 219, 42, 0.08); color: #FFDB2A; }
    #fios-sidebar .sidebar-item.disabled { opacity: 0.35; pointer-events: none; }
    #fios-sidebar .sidebar-item .item-icon { flex-shrink: 0; display: flex; }
    #fios-sidebar .sidebar-item .item-label { overflow: hidden; text-overflow: ellipsis; }
    #fios-sidebar.collapsed .sidebar-item .item-label { display: none; }
    #fios-sidebar.collapsed .sidebar-item { padding: 10px 0; justify-content: center; margin: 2px 6px; }
    #fios-sidebar .sidebar-toggle {
      padding: 12px 16px; border-top: 1px solid #1a1a1a;
      cursor: pointer; color: #52525b; display: flex; align-items: center; gap: 10px;
      font-size: 12px; transition: color 0.15s;
    }
    #fios-sidebar .sidebar-toggle:hover { color: #a1a1aa; }
    #fios-sidebar.collapsed .sidebar-toggle { justify-content: center; }
    #fios-sidebar.collapsed .sidebar-toggle span { display: none; }

    /* Push page content right */
    body { margin-left: 220px !important; transition: margin-left 0.2s ease; }
    body.fios-collapsed { margin-left: 56px !important; }

    /* Coming soon badge */
    .sidebar-badge {
      font-size: 9px; background: #2A2A2A; color: #71717a; padding: 1px 5px;
      border-radius: 3px; margin-left: auto; white-space: nowrap;
    }
    #fios-sidebar.collapsed .sidebar-badge { display: none; }
  `;
  document.head.appendChild(style);

  // Build sidebar HTML
  const sidebar = document.createElement('div');
  sidebar.id = 'fios-sidebar';

  // Check saved state
  const isCollapsed = localStorage.getItem('fios-sidebar-collapsed') === 'true';
  if (isCollapsed) { sidebar.classList.add('collapsed'); document.body.classList.add('fios-collapsed'); }

  let navItems = modules.map(m => {
    const isActive = m.id === activeId;
    const isDisabled = !m.href;
    const cls = 'sidebar-item' + (isActive ? ' active' : '') + (isDisabled ? ' disabled' : '');
    const badge = isDisabled ? '<span class="sidebar-badge">Soon</span>' : '';
    const tag = isDisabled ? 'div' : 'a';
    const hrefAttr = isDisabled ? '' : ` href="${m.href}"`;
    return `<${tag} class="${cls}"${hrefAttr}><span class="item-icon">${icons[m.icon]}</span><span class="item-label">${m.title}</span>${badge}</${tag}>`;
  }).join('');

  sidebar.innerHTML = `
    <div class="sidebar-logo" onclick="window.location.href='${BASE}/'">
      <div style="width:28px;height:28px;background:#FFDB2A;border-radius:6px;display:flex;align-items:center;justify-content:center;">
        <span style="font-family:Kanit,sans-serif;font-weight:800;font-size:16px;color:#0A0A0A;">F</span>
      </div>
      <span>For Impact OS</span>
    </div>
    <nav class="sidebar-nav">${navItems}</nav>
    <div class="sidebar-toggle" id="fios-sidebar-toggle">
      ${icons.collapse}
      <span>Collapse</span>
    </div>
  `;

  document.body.prepend(sidebar);

  // Toggle
  document.getElementById('fios-sidebar-toggle').addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    document.body.classList.toggle('fios-collapsed');
    localStorage.setItem('fios-sidebar-collapsed', sidebar.classList.contains('collapsed'));
  });
})();
