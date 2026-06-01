/**
 * Shared utility functions
 */

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return 'GHS ' + num.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getCurrentMonthLabel() {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const now = new Date();
  return months[now.getMonth()] + ' ' + now.getFullYear();
}

function getMonthOptions(count) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const options = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(months[d.getMonth()] + ' ' + d.getFullYear());
  }
  return options;
}

function getYearOptions(count) {
  const years = [];
  const current = new Date().getFullYear();
  for (let i = 0; i < count; i++) {
    years.push(current - i);
  }
  return years;
}

function showToast(message, type) {
  type = type || 'success';
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(function () {
    toast.remove();
  }, 4000);
}

function showLoading(show) {
  let overlay = document.querySelector('.loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(overlay);
  }
  overlay.classList.toggle('visible', show);
}

function confirmAction(message) {
  return window.confirm(message);
}

function validateRequired(fields) {
  let valid = true;
  fields.forEach(function (field) {
    const el = document.getElementById(field.id);
    const errorEl = document.getElementById(field.id + 'Error');
    if (!el) return;

    const value = el.value.trim();
    if (!value) {
      el.classList.add('error');
      if (errorEl) {
        errorEl.textContent = field.message || 'This field is required';
        errorEl.classList.add('visible');
      }
      valid = false;
    } else {
      el.classList.remove('error');
      if (errorEl) errorEl.classList.remove('visible');
    }
  });
  return valid;
}

function clearFormErrors(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.querySelectorAll('.form-control.error').forEach(function (el) {
    el.classList.remove('error');
  });
  form.querySelectorAll('.form-error.visible').forEach(function (el) {
    el.classList.remove('visible');
  });
}

function statusBadge(status) {
  const map = {
    Active: 'badge-active',
    Inactive: 'badge-inactive',
    Exempt: 'badge-exempt',
    PAID: 'badge-paid',
    UNPAID: 'badge-unpaid',
    EXEMPT: 'badge-exempt'
  };
  const cls = map[status] || 'badge-exempt';
  return `<span class="badge ${cls}">${status}</span>`;
}

function complianceClass(pct) {
  if (pct >= 80) return 'compliance-high';
  if (pct >= 50) return 'compliance-medium';
  return 'compliance-low';
}

function compliancePrintClass(pct) {
  if (pct >= 80) return 'success';
  if (pct >= 50) return 'warning';
  return 'danger';
}

function exportToCSV(rows, filename) {
  if (!rows || rows.length === 0) {
    showToast('No data to export', 'error');
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(function (row) {
      return headers.map(function (h) {
        const val = row[h] != null ? String(row[h]) : '';
        return '"' + val.replace(/"/g, '""') + '"';
      }).join(',');
    })
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function openModal(id) {
  document.getElementById(id).classList.add('visible');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('visible');
}

function setupModalClose(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;
  overlay.querySelector('.modal-close').addEventListener('click', function () {
    closeModal(modalId);
  });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal(modalId);
  });
}

function sortTableData(data, key, direction) {
  return data.slice().sort(function (a, b) {
    let valA = a[key];
    let valB = b[key];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

function populateSelect(selectEl, options, valueKey, labelKey, placeholder) {
  selectEl.innerHTML = '';
  if (placeholder) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    selectEl.appendChild(opt);
  }
  options.forEach(function (item) {
    const opt = document.createElement('option');
    opt.value = typeof item === 'string' ? item : item[valueKey];
    opt.textContent = typeof item === 'string' ? item : item[labelKey];
    selectEl.appendChild(opt);
  });
}

function printSection(elementId) {
  printReport({
    title: 'Report',
    bodyHtml: document.getElementById(elementId) ? document.getElementById(elementId).innerHTML : ''
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let _printConfig = null;

async function loadPrintConfig() {
  if (_printConfig) return _printConfig;
  const session = typeof getSession === 'function' ? getSession() : null;
  let familyName = (session && session.familyName) ||
    (typeof BRAND !== 'undefined' ? BRAND.familyName : 'Asempa Royal Family');
  let systemEmail = '';
  let logoUrl = typeof getBrandLogoUrl === 'function'
    ? getBrandLogoUrl()
    : new URL('assets/images/asempa-royal-family-logo.jpeg', window.location.href).href;

  if (typeof API !== 'undefined') {
    const result = await API.getConfig();
    if (result.success && result.data) {
      if (result.data.FamilyName) familyName = result.data.FamilyName;
      if (result.data.SystemEmail) systemEmail = result.data.SystemEmail;
    }
  }

  _printConfig = { familyName: familyName, systemEmail: systemEmail, logoUrl: logoUrl };
  return _printConfig;
}

function buildLetterheadHtml(config, reportTitle, reportSubtitle) {
  const generated = formatDate(new Date());
  const logoSrc = config.logoUrl || 'assets/images/asempa-royal-family-logo.jpeg';
  return (
    '<header class="print-letterhead">' +
      '<div class="print-letterhead-top">' +
        '<img class="print-logo" src="' + escapeHtml(logoSrc) + '" alt="' + escapeHtml(config.familyName) + ' logo">' +
        '<div class="print-brand">' +
          '<h1>' + escapeHtml(config.familyName) + '</h1>' +
          '<p class="print-tagline">Family Dues Management</p>' +
        '</div>' +
      '</div>' +
      '<div class="print-gold-rule"></div>' +
      '<div class="print-report-meta">' +
        '<h2>' + escapeHtml(reportTitle) + '</h2>' +
        (reportSubtitle ? '<p class="print-subtitle">' + escapeHtml(reportSubtitle) + '</p>' : '') +
        '<p class="print-date">Generated ' + generated + '</p>' +
      '</div>' +
    '</header>'
  );
}

function buildPrintStats(stats) {
  if (!stats || !stats.length) return '';
  return (
    '<div class="print-stats">' +
    stats.map(function (s) {
      return (
        '<div class="print-stat">' +
          '<div class="print-stat-label">' + escapeHtml(s.label) + '</div>' +
          '<div class="print-stat-value' + (s.className ? ' ' + s.className : '') + '">' + escapeHtml(s.value) + '</div>' +
        '</div>'
      );
    }).join('') +
    '</div>'
  );
}

function buildPrintTable(headers, rows, options) {
  options = options || {};
  const theadClass = options.headClass ? ' class="' + options.headClass + '"' : '';
  const colClasses = options.colClasses || [];

  if (!rows || rows.length === 0) {
    return '<p class="print-empty">No records found</p>';
  }

  let html = '<table class="print-table"><thead' + theadClass + '><tr>';
  headers.forEach(function (h, i) {
    const cls = colClasses[i] === 'num' ? ' class="num"' : '';
    html += '<th' + cls + '>' + escapeHtml(h) + '</th>';
  });
  html += '</tr></thead><tbody>';

  rows.forEach(function (row) {
    html += '<tr>';
    row.forEach(function (cell, i) {
      const cls = colClasses[i] === 'num' ? ' class="num"' : (cell.className ? ' class="' + cell.className + '"' : '');
      const val = typeof cell === 'object' && cell !== null && cell.text !== undefined ? cell.text : cell;
      html += '<td' + cls + '>' + (typeof val === 'string' && val.indexOf('<') !== -1 ? val : escapeHtml(val)) + '</td>';
    });
    html += '</tr>';
  });

  html += '</tbody>';
  if (options.footer) {
    html += '<tfoot><tr>';
    options.footer.forEach(function (cell, i) {
      var classes = [];
      if (colClasses[i] === 'num') classes.push('num');
      if (typeof cell === 'object' && cell !== null && cell.className) classes.push(cell.className);
      var val = typeof cell === 'object' && cell !== null && cell.text !== undefined ? cell.text : cell;
      html += '<td' + (classes.length ? ' class="' + classes.join(' ') + '"' : '') + '>' + escapeHtml(String(val)) + '</td>';
    });
    html += '</tr></tfoot>';
  }
  html += '</table>';
  return html;
}

async function printReport(options) {
  const config = await loadPrintConfig();
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('Please allow pop-ups to print reports', 'error');
    return;
  }

  const pageTitle = escapeHtml(options.title) + ' — ' + escapeHtml(config.familyName);
  const cssPath = new URL('css/print.css', window.location.href).href;

  printWindow.document.open();
  printWindow.document.write('<!DOCTYPE html><html lang="en"><head>');
  printWindow.document.write('<meta charset="UTF-8">');
  printWindow.document.write('<title>' + pageTitle + '</title>');
  printWindow.document.write('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">');
  printWindow.document.write('<link rel="stylesheet" href="' + cssPath + '">');
  printWindow.document.write('</head><body>');
  printWindow.document.write('<div class="print-document">');
  printWindow.document.write(buildLetterheadHtml(config, options.title, options.subtitle));
  printWindow.document.write('<main class="print-body">' + options.bodyHtml + '</main>');
  printWindow.document.write(
    '<footer class="print-footer">' +
      '<p>' + escapeHtml(config.familyName) + ' · Family Dues Management System</p>' +
      '<p>Printed ' + formatDate(new Date()) +
      (config.systemEmail ? ' · ' + escapeHtml(config.systemEmail) : '') +
      '</p>' +
    '</footer>'
  );
  printWindow.document.write('</div></body></html>');
  printWindow.document.close();

  printWindow.onload = function () {
    printWindow.focus();
    printWindow.print();
  };
  setTimeout(function () {
    if (!printWindow.closed) printWindow.print();
  }, 600);
}

function debounce(fn, delay) {
  let timer;
  return function () {
    const args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(null, args);
    }, delay);
  };
}

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(function (part) {
    return part.charAt(0);
  }).slice(0, 2).join('').toUpperCase();
}

function refreshResponsiveTables() {
  document.querySelectorAll('.table-wrapper').forEach(function (wrapper) {
    wrapper.classList.add('responsive-table');
  });

  document.querySelectorAll('.responsive-table table').forEach(function (table) {
    var headers = Array.from(table.querySelectorAll('thead th')).map(function (th) {
      return th.textContent.trim();
    });

    table.querySelectorAll('tbody tr').forEach(function (row) {
      if (row.querySelector('.empty-state')) {
        row.classList.add('empty-row');
        return;
      }
      row.classList.remove('empty-row');
      Array.from(row.querySelectorAll('td')).forEach(function (td, i) {
        if (headers[i]) td.setAttribute('data-label', headers[i]);
        if (i === row.cells.length - 1 && td.querySelector('.btn')) {
          td.classList.add('action-cell');
        }
      });
    });
  });

  checkTableScrollHints();
}

function checkTableScrollHints() {
  if (window.innerWidth > 768) return;
  document.querySelectorAll('.table-wrapper').forEach(function (wrapper) {
    var table = wrapper.querySelector('table');
    if (!table) return;
    var canScroll = table.scrollWidth > wrapper.clientWidth + 4;
    wrapper.classList.toggle('table-scroll-hint', false);
    wrapper.classList.toggle('can-scroll', canScroll && !wrapper.classList.contains('responsive-table'));
  });
}

function setupModalDragHandles() {
  document.querySelectorAll('.modal').forEach(function (modal) {
    if (modal.querySelector('.modal-drag-handle')) return;
    var handle = document.createElement('div');
    handle.className = 'modal-drag-handle';
    handle.setAttribute('aria-hidden', 'true');
    modal.insertBefore(handle, modal.firstChild);
  });
}

window.addEventListener('resize', debounce(function () {
  refreshResponsiveTables();
  checkTableScrollHints();
}, 200));
