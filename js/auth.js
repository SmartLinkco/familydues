/**
 * Session management via localStorage
 */

const SESSION_KEY = 'familyDuesSession';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

const NAV_ICONS = {
  dashboard: '▣',
  members: '◎',
  payments: '◈',
  disbursements: '◧',
  reports: '▤',
  users: '◉',
  logout: '⎋',
  more: '☰'
};

const BOTTOM_NAV_ITEMS = [
  { page: 'dashboard', href: 'dashboard.html', label: 'Home', icon: '▣', roles: ['Admin', 'Treasurer', 'Secretary', 'Member'] },
  { page: 'members', href: 'members.html', label: 'Members', icon: '◎', roles: ['Admin', 'Secretary'] },
  { page: 'payments', href: 'payments.html', label: 'Pay', icon: '◈', roles: ['Admin', 'Treasurer'] },
  { page: 'reports', href: 'reports.html', label: 'Reports', icon: '▤', roles: ['Admin', 'Treasurer'] },
  { page: 'more', href: '#', label: 'Menu', icon: '☰', roles: ['Admin', 'Treasurer', 'Secretary', 'Member'], action: 'openSidebar' }
];

function saveSession(data) {
  const session = {
    token: data.token,
    userId: data.userId,
    username: data.username,
    role: data.role,
    memberId: data.memberId || '',
    memberName: data.memberName || data.username,
    familyName: data.familyName || 'Family Dues',
    loginTime: Date.now(),
    lastActivity: Date.now()
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw);
    const elapsed = Date.now() - (session.lastActivity || session.loginTime);
    if (elapsed > SESSION_DURATION_MS) {
      clearSession();
      return null;
    }
    session.lastActivity = Date.now();
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  } catch {
    clearSession();
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function requireAuth(allowedRoles) {
  const session = getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    window.location.href = 'dashboard.html';
    return null;
  }
  return session;
}

function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.add('open');
  if (backdrop) backdrop.classList.add('visible');
  document.body.classList.add('nav-open');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('visible');
  document.body.classList.remove('nav-open');
}

function setupMobileUX(session, activePage) {
  document.body.classList.add('has-bottom-nav');

  if (!document.getElementById('sidebarBackdrop')) {
    const backdrop = document.createElement('div');
    backdrop.id = 'sidebarBackdrop';
    backdrop.className = 'sidebar-backdrop';
    backdrop.addEventListener('click', closeSidebar);
    document.body.appendChild(backdrop);
  }

  upgradeHeader(session);
  addSidebarIcons();
  setupBottomNav(session, activePage);
  setupModalDragHandles();
  refreshResponsiveTables();

  document.querySelectorAll('.sidebar-nav .nav-item[data-page]').forEach(function (item) {
    item.addEventListener('click', function () {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSidebar();
  });
}

function upgradeHeader(session) {
  const topHeader = document.querySelector('.top-header');
  if (!topHeader) return;

  const menuToggle = document.getElementById('menuToggle');
  let pageTitle = topHeader.querySelector('.header-page-title') ||
    topHeader.querySelector('.page-title') ||
    topHeader.querySelector('h1');

  if (menuToggle && pageTitle && !topHeader.querySelector('.header-leading')) {
    pageTitle.classList.add('header-page-title');
    const leading = document.createElement('div');
    leading.className = 'header-leading';
    leading.appendChild(menuToggle);
    leading.appendChild(pageTitle);
    topHeader.insertBefore(leading, topHeader.firstChild);
  }

  const headerUser = topHeader.querySelector('.header-user');
  if (headerUser && !headerUser.querySelector('.user-avatar')) {
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.textContent = getInitials(session.memberName || session.username);
    avatar.setAttribute('title', session.memberName || session.username);
    avatar.setAttribute('aria-label', session.memberName || session.username);
    headerUser.insertBefore(avatar, headerUser.firstChild);
  }
}

function addSidebarIcons() {
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (item) {
    if (item.querySelector('.nav-icon')) return;
    const page = item.dataset.page;
    const key = page || (item.id === 'logoutBtn' ? 'logout' : null);
    if (!key || !NAV_ICONS[key]) return;
    const icon = document.createElement('span');
    icon.className = 'nav-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = NAV_ICONS[key];
    item.insertBefore(icon, item.firstChild);
  });
}

function setupBottomNav(session, activePage) {
  if (document.getElementById('bottomNav')) return;

  const nav = document.createElement('nav');
  nav.id = 'bottomNav';
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Main navigation');

  const inner = document.createElement('div');
  inner.className = 'bottom-nav-inner';

  BOTTOM_NAV_ITEMS.forEach(function (item) {
    if (!item.roles.includes(session.role)) return;

    const el = document.createElement(item.action ? 'button' : 'a');
    el.className = 'bottom-nav-item' + (item.page === activePage ? ' active' : '');
    if (item.href && !item.action) {
      el.href = item.href;
    } else {
      el.type = 'button';
    }

    el.innerHTML = '<span class="nav-icon" aria-hidden="true">' + item.icon + '</span><span>' + item.label + '</span>';

    if (item.action === 'openSidebar') {
      el.addEventListener('click', openSidebar);
    }

    inner.appendChild(el);
  });

  nav.appendChild(inner);
  document.body.appendChild(nav);
}

function initPageLayout(activePage, allowedRoles) {
  const session = requireAuth(allowedRoles);
  if (!session) return null;

  document.getElementById('userName').textContent = session.memberName || session.username;
  document.getElementById('userRole').textContent = session.role;
  const displayName = session.familyName || (typeof BRAND !== 'undefined' ? BRAND.familyName : 'Family Dues');
  document.getElementById('familyName').textContent = displayName;
  if (typeof initBrandDisplay === 'function') initBrandDisplay(displayName);

  document.querySelectorAll('.nav-item').forEach(function (item) {
    if (item.dataset.page === activePage) item.classList.add('active');
  });

  applyRoleNav(session.role);
  setupMobileUX(session, activePage);

  const menuToggle = document.getElementById('menuToggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', function () {
      const sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      clearSession();
      window.location.href = 'index.html';
    });
  }

  return session;
}

function applyRoleNav(role) {
  const roleAccess = {
    dashboard: ['Admin', 'Treasurer', 'Secretary', 'Member'],
    members: ['Admin', 'Secretary'],
    payments: ['Admin', 'Treasurer'],
    reports: ['Admin', 'Treasurer'],
    users: ['Admin']
  };

  document.querySelectorAll('.nav-item[data-page]').forEach(function (item) {
    const page = item.dataset.page;
    const allowed = roleAccess[page];
    if (allowed && !allowed.includes(role)) {
      item.style.display = 'none';
    }
  });
}

function handleLoginForm() {
  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorEl.classList.remove('visible');

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      errorEl.textContent = 'Please enter username and password.';
      errorEl.classList.add('visible');
      return;
    }

    const result = await API.login(username, password);
    if (result.success) {
      saveSession(result.data);
      window.location.href = 'dashboard.html';
    } else {
      errorEl.textContent = result.error || 'Login failed. Please try again.';
      errorEl.classList.add('visible');
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('loginForm')) {
    const session = getSession();
    if (session) {
      window.location.href = 'dashboard.html';
      return;
    }
    handleLoginForm();
    loadFamilyName();
  }
});

async function loadFamilyName() {
  const result = await API.getConfig();
  const name = (result.success && result.data.FamilyName)
    ? result.data.FamilyName
    : (typeof BRAND !== 'undefined' ? BRAND.familyName : 'Family Dues');
  const el = document.getElementById('familyNameDisplay');
  if (el) el.textContent = name;
  if (typeof initBrandDisplay === 'function') initBrandDisplay(name);
}
