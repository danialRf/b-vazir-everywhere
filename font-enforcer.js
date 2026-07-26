(() => {
  "use strict";

  const APPLIED_CLASS = "bve-font-applied";
  const SHADOW_STYLE_ID = "bve-shadow-style";
  const FONT = '"B Vazir", "B Vazir Everywhere", Vazir, sans-serif';
  const hostname = location.hostname;
  const observedRoots = new Set();

  const excludedTags = new Set([
    "CODE", "PRE", "KBD", "SAMP", "SVG", "PATH", "USE", "MATH",
    "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"
  ]);

  const iconClassPattern =
    /(?:^|[\s_-])(?:material-icons?|material-symbols?|fa[brsld]?|font-awesome|glyphicon|icomoon|iconfont|bi|ri|mdi)(?:$|[\s_-])/i;
  const iconFontPattern =
    /material icons|material symbols|font\s*awesome|glyphicons|icomoon|iconfont|bootstrap icons|remixicon|weathericons|simple-line-icons/i;
  const mathPattern =
    /(?:^|[\s_-])(?:katex|mathjax|mathquill|mjx|tex2jax)(?:$|[\s_-])/i;

  let enabled = true;

  function isExcluded(element) {
    if (!element || excludedTags.has(element.tagName)) return true;
    if (element.closest?.("code, pre, kbd, samp, svg, math, [data-icon], [role='img']")) return true;

    const classes = typeof element.className === "string" ? element.className : "";
    if (iconClassPattern.test(classes) || mathPattern.test(classes)) return true;
    if (element.getAttribute("aria-hidden") === "true" && classes) return true;

    try {
      return iconFontPattern.test(getComputedStyle(element).fontFamily);
    } catch {
      return false;
    }
  }

  function hasVisibleOwnText(element) {
    if (/^(INPUT|TEXTAREA|SELECT|BUTTON|OPTION)$/.test(element.tagName)) return true;
    return Array.from(element.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
    );
  }

  function applyToElement(element) {
    if (!enabled || isExcluded(element)) {
      element?.classList?.remove(APPLIED_CLASS);
      return;
    }
    if (hasVisibleOwnText(element)) element.classList.add(APPLIED_CLASS);
  }

  function installShadowStyle(root) {
    if (!root.getElementById(SHADOW_STYLE_ID)) {
      const style = document.createElement("style");
      style.id = SHADOW_STYLE_ID;
      style.textContent = `.${APPLIED_CLASS} { font-family: ${FONT} !important; }`;
      root.append(style);
    }
    observeRoot(root);
  }

  function scan(root) {
    if (root.nodeType === Node.ELEMENT_NODE) applyToElement(root);
    root.querySelectorAll?.("*").forEach((element) => {
      applyToElement(element);
      if (element.shadowRoot?.mode === "open") installShadowStyle(element.shadowRoot);
    });
  }

  function clear(root) {
    root.querySelectorAll?.(`.${APPLIED_CLASS}`).forEach((element) => {
      element.classList.remove(APPLIED_CLASS);
    });
    root.querySelectorAll?.("*").forEach((element) => {
      if (element.shadowRoot?.mode === "open") clear(element.shadowRoot);
    });
  }

  const observer = new MutationObserver((records) => {
    if (!enabled) return;
    for (const record of records) {
      if (record.type === "characterData") {
        applyToElement(record.target.parentElement);
        continue;
      }
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
        else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
          applyToElement(node.parentElement);
        }
      }
    }
  });

  function observeRoot(root) {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    scan(root);
  }

  function setState(nextEnabled) {
    enabled = Boolean(nextEnabled);
    if (enabled) {
      observeRoot(document.documentElement);
      scan(document.documentElement);
    } else {
      clear(document);
    }
  }

  async function refresh() {
    const settings = await browser.storage.local.get({
      enabled: true,
      disabledSites: {}
    });
    setState(settings.enabled && !settings.disabledSites[hostname]);
  }

  browser.storage.onChanged.addListener(refresh);
  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === "bve-set-enabled") {
      setState(message.enabled);
      return Promise.resolve({ enabled });
    }
    if (message?.type === "bve-refresh") return refresh();
  });

  const start = () => refresh();
  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
