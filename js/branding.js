/**
 * Asempa Royal Family — shared branding, SEO, and icons
 */

const BRAND = {
  familyName: 'Asempa Royal Family',
  appName: 'Asempa Royal Family Dues',
  tagline: 'Family Dues Management',
  logoPath: 'assets/images/asempa-royal-family-logo.jpeg',
  themeColor: '#1B5E20',
  defaultDescription:
    'Official dues management portal for the Asempa Royal Family. Track monthly contributions, payments, reports, and member records securely online.'
};

function getBrandLogoUrl() {
  return new URL(BRAND.logoPath, window.location.href).href;
}

function applyBranding(options) {
  options = options || {};
  const title = options.title || BRAND.appName;
  const description = options.description || BRAND.defaultDescription;
  const logoUrl = getBrandLogoUrl();

  document.title = title;

  setMeta('name', 'description', description);
  setMeta('name', 'theme-color', BRAND.themeColor);
  setMeta('name', 'application-name', BRAND.appName);
  setMeta('name', 'apple-mobile-web-app-title', 'Asempa Dues');

  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:site_name', BRAND.familyName);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:image', logoUrl);
  setMeta('property', 'og:image:alt', BRAND.familyName + ' logo');

  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', logoUrl);

  document.querySelectorAll('.brand-logo-img').forEach(function (img) {
    img.src = BRAND.logoPath;
    img.alt = BRAND.familyName + ' logo';
  });

  document.querySelectorAll('[data-brand-name]').forEach(function (el) {
    if (!el.dataset.brandDynamic || el.dataset.brandDynamic === 'true') {
      el.textContent = options.familyName || BRAND.familyName;
    }
  });
}

function setMeta(attr, key, content) {
  let el = document.querySelector('meta[' + attr + '="' + key + '"]');
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function initBrandDisplay(familyNameFromConfig) {
  const name = familyNameFromConfig || BRAND.familyName;
  document.querySelectorAll('[data-brand-name="true"]').forEach(function (el) {
    el.textContent = name;
  });
}
