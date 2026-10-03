(() => {
  "use strict";

  const ROOT_CLASS = "bve-font-enabled";
  const FONT_STACK = '"B Vazir", "B Vazir Everywhere", Vazir, sans-serif';
  const hostname = location.hostname;
  const overriddenElements = new Map();
  const pendingElements = new Set();
  const pendingTextWalkers = [];
  const iconClassPattern =
    /(?:^|[-_\s])(icon|glyph|symbol|lucide|material-icons|material-symbols|google-symbols|glyphicon|fa[brsld]?|bi)(?:$|[-_\s])/i;
  const iconFontPattern =
    /(?:icon|glyph|symbol|awesome|material|lucide|bootstrap-icons|phosphor)/i;
  let isEnabled = false;
  let isObserving = false;
  let flushScheduled = false;

  function hasOurFont(element) {
    const family = getComputedStyle(element).fontFamily.toLowerCase();
    return family.includes("b vazir") || family.includes("vazir");
  }

  function isProtectedElement(element) {
    if (!(element instanceof HTMLElement)) return true;

    for (let current = element; current && current !== document.body; current = current.parentElement) {
      const tag = current.tagName;
      if (
        tag === "CODE" ||
        tag === "PRE" ||
        tag === "KBD" ||
        tag === "SAMP" ||
        tag === "SVG" ||
        tag === "MATH" ||
        current.dataset.icon !== undefined ||
        current.dataset.iconName !== undefined ||
        current.getAttribute("role") === "img" ||
        iconClassPattern.test(current.className)
      ) {
        return true;
      }
    }

    return iconFontPattern.test(getComputedStyle(element).fontFamily);
  }

  function applyInlineFallback(element) {
    if (!isEnabled || !element.isConnected || isProtectedElement(element) || hasOurFont(element)) {
      return;
    }

    if (!overriddenElements.has(element)) {
      overriddenElements.set(element, {
        value: element.style.getPropertyValue("font-family"),
        priority: element.style.getPropertyPriority("font-family")
      });
    }

    element.style.setProperty("font-family", FONT_STACK, "important");
  }

  function flushPending() {
    flushScheduled = false;
    if (!isEnabled) {
      pendingElements.clear();
      pendingTextWalkers.length = 0;
      return;
    }

    const startedAt = performance.now();
    while (pendingTextWalkers.length) {
      const walker = pendingTextWalkers[0];
      const textNode = walker.nextNode();
      if (!textNode) {
        pendingTextWalkers.shift();
      } else if (textNode.nodeValue?.trim()) {
        pendingElements.add(textNode.parentElement);
      }

      if (performance.now() - startedAt > 8) {
        scheduleFlush();
        return;
      }
    }

    for (const element of pendingElements) {
      pendingElements.delete(element);
      applyInlineFallback(element);

      // Keep fallback work below one animation frame even on pages that add a
      // large amount of content at once.
      if (performance.now() - startedAt > 8) {
        scheduleFlush();
        break;
      }
    }
  }

  function scheduleFlush() {
    if (!isEnabled || flushScheduled) return;
    flushScheduled = true;

    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(flushPending, { timeout: 120 });
    } else {
      requestAnimationFrame(flushPending);
    }
  }

  function queueElement(element) {
    if (!isEnabled || !(element instanceof HTMLElement)) return;
    pendingElements.add(element);
    scheduleFlush();
  }

  function queueTextParents(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.nodeValue?.trim()) queueElement(node.parentElement);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    pendingTextWalkers.push(document.createTreeWalker(node, NodeFilter.SHOW_TEXT));
    scheduleFlush();
  }

  function restoreInlineFallbacks() {
    for (const [element, original] of overriddenElements) {
      if (
        element.isConnected &&
        element.style.getPropertyValue("font-family") === FONT_STACK &&
        element.style.getPropertyPriority("font-family") === "important"
      ) {
        if (original.value) {
          element.style.setProperty("font-family", original.value, original.priority);
        } else {
          element.style.removeProperty("font-family");
        }
      }
    }
    overriddenElements.clear();
  }

  const observer = new MutationObserver((records) => {
    if (!isEnabled) return;

    for (const record of records) {
      if (record.type === "characterData") {
        queueTextParents(record.target);
      } else {
        for (const node of record.addedNodes) queueTextParents(node);
      }
    }
  });

  function startFallback() {
    if (!isObserving) {
      observer.observe(document, { childList: true, subtree: true, characterData: true });
      isObserving = true;
    }

    if (document.body) queueTextParents(document.body);
    else document.addEventListener("DOMContentLoaded", () => queueTextParents(document.body), { once: true });
  }

  function stopFallback() {
    pendingElements.clear();
    pendingTextWalkers.length = 0;
    if (isObserving) {
      observer.disconnect();
      isObserving = false;
    }
    restoreInlineFallbacks();
  }

  function setState(enabled) {
    const nextState = Boolean(enabled);
    document.documentElement?.classList.toggle(ROOT_CLASS, nextState);

    if (isEnabled === nextState) return;
    isEnabled = nextState;
    if (isEnabled) startFallback();
    else stopFallback();
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
      return Promise.resolve({ enabled: Boolean(message.enabled) });
    }
    if (message?.type === "bve-refresh") return refresh();
  });

  refresh();
})();
