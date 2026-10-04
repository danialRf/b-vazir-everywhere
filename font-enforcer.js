(() => {
  "use strict";

  const ROOT_CLASS = "bve-font-enabled";
  const FONT_NAME = "B Vazir Everywhere";
  const SHADOW_EVENT = "bve-shadow-root-attached";
  const SHADOW_STYLE_ID = "bve-shadow-font-style";
  const hostname = location.hostname;
  const shadowStyles = new Map();
  let enabled = false;
  const protectedSelector = [
    "svg",
    "math",
    "[data-icon]",
    "[data-icon-name]",
    '[role="img"]',
    '[class*="icon"]',
    '[class*="glyph"]',
    '[class*="symbol"]',
    '[class*="lucide"]',
    '[class*="material-icons"]',
    '[class*="material-symbols"]',
    '[class*="google-symbols"]',
    '[class~="glyphicon"]',
    '[class*="glyphicon-"]',
    '[class~="fa"]',
    '[class~="fas"]',
    '[class~="far"]',
    '[class~="fab"]',
    '[class~="fal"]',
    '[class~="fad"]',
    '[class*="fa-"]',
    '[class~="bi"]',
    '[class*="bi-"]',
    '[class*="katex"]',
    '[class*="MathJax"]',
    '[class*="mathjax"]',
    '[class*="mjx"]'
  ].join(",");

  const shadowFontCss = `
    @font-face {
      font-family: "${FONT_NAME}";
      src: url("${browser.runtime.getURL("fonts/Vazir-Regular.woff2")}") format("woff2");
      font-style: normal;
      font-weight: 100 600;
      font-display: swap;
    }
    @font-face {
      font-family: "${FONT_NAME}";
      src: url("${browser.runtime.getURL("fonts/Vazir-Bold.woff2")}") format("woff2");
      font-style: normal;
      font-weight: 601 900;
      font-display: swap;
    }
    :host,
    :host :where(*):not(
      svg, svg *, math, math *,
      [data-icon], [data-icon] *, [data-icon-name], [data-icon-name] *,
      [role="img"], [role="img"] *, [class*="icon"], [class*="glyph"],
      [class*="symbol"], [class*="lucide"], [class*="material-icons"],
      [class*="material-symbols"], [class*="google-symbols"],
      [class~="glyphicon"], [class*="glyphicon-"], [class~="fa"],
      [class~="fas"], [class~="far"], [class~="fab"], [class~="fal"],
      [class~="fad"], [class*="fa-"], [class~="bi"], [class*="bi-"],
      [class*="katex"], [class*="MathJax"], [class*="mathjax"], [class*="mjx"]
    ) {
      font-family: "${FONT_NAME}", sans-serif !important;
    }
  `;

  function getShadowRoot(element) {
    try {
      return element.openOrClosedShadowRoot || element.shadowRoot || null;
    } catch {
      return null;
    }
  }

  function installShadowStyle(element) {
    if (!enabled || !(element instanceof HTMLElement)) return;
    const root = getShadowRoot(element);
    if (!root || shadowStyles.has(root)) return;

    const style = document.createElement("style");
    style.id = SHADOW_STYLE_ID;
    style.textContent = shadowFontCss;
    root.append(style);
    shadowStyles.set(root, style);
    shadowObserver.observe(root, { childList: true, subtree: true });
    discoverShadowRoots(root);
  }

  function discoverShadowRoots(node) {
    if (!enabled) return;
    if (node.nodeType === Node.ELEMENT_NODE) installShadowStyle(node);
    if (![Node.ELEMENT_NODE, Node.DOCUMENT_NODE, Node.DOCUMENT_FRAGMENT_NODE].includes(node.nodeType)) {
      return;
    }

    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
    let element;
    while ((element = walker.nextNode())) installShadowStyle(element);
  }

  const shadowObserver = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) discoverShadowRoots(node);
    }
  });

  function startShadowSupport() {
    shadowObserver.observe(document, { childList: true, subtree: true });
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => discoverShadowRoots(document), { once: true });
    } else {
      discoverShadowRoots(document);
    }
  }

  function stopShadowSupport() {
    shadowObserver.disconnect();
    for (const style of shadowStyles.values()) style.remove();
    shadowStyles.clear();
  }

  function setState(nextState) {
    const shouldEnable = Boolean(nextState);
    document.documentElement.classList.toggle(ROOT_CLASS, shouldEnable);
    if (enabled === shouldEnable) return;

    enabled = shouldEnable;
    if (enabled) startShadowSupport();
    else stopShadowSupport();
  }

  async function refresh() {
    const settings = await browser.storage.local.get({
      enabled: true,
      disabledSites: {}
    });
    setState(settings.enabled && !settings.disabledSites[hostname]);
  }

  function isProtected(element) {
    return Boolean(element.closest(protectedSelector));
  }

  function hasVazir(element) {
    return getComputedStyle(element).fontFamily.toLowerCase().includes(FONT_NAME.toLowerCase());
  }

  async function getStatus() {
    await document.fonts.load(`16px "${FONT_NAME}"`);

    let checkedTextElements = 0;
    let mismatchedTextElements = 0;
    if (document.body) {
      const seen = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let textNode;
      while ((textNode = walker.nextNode()) && checkedTextElements < 500) {
        const element = textNode.parentElement;
        if (
          !element ||
          !textNode.nodeValue?.trim() ||
          seen.has(element) ||
          isProtected(element) ||
          ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(element.tagName)
        ) {
          continue;
        }

        seen.add(element);
        checkedTextElements += 1;
        if (!hasVazir(element)) mismatchedTextElements += 1;
      }
    }

    return {
      enabled: document.documentElement.classList.contains(ROOT_CLASS),
      fontLoaded: document.fonts.check(`16px "${FONT_NAME}"`),
      bodyFont: document.body ? getComputedStyle(document.body).fontFamily : "",
      checkedTextElements,
      mismatchedTextElements
    };
  }

  browser.storage.onChanged.addListener(refresh);
  document.addEventListener(SHADOW_EVENT, (event) => installShadowStyle(event.target));
  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === "bve-set-enabled") {
      setState(message.enabled);
      return getStatus();
    }
    if (message?.type === "bve-refresh") return refresh();
    if (message?.type === "bve-get-status") return getStatus();
    return undefined;
  });

  refresh();
})();
