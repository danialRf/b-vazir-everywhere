(() => {
  "use strict";

  const FONT = '"B Vazir", Vazir, sans-serif';
  const STYLE_ID = "b-vazir-everywhere-style";

  function enforceInOpenShadowRoots(root) {
    root.querySelectorAll?.("*").forEach((element) => {
      if (element.shadowRoot && element.shadowRoot.mode === "open") {
        installStyle(element.shadowRoot);
      }
    });
  }

  function installStyle(root) {
    if (root.getElementById?.(STYLE_ID) || root.querySelector?.(`#${STYLE_ID}`)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `:host, :host * { font-family: ${FONT} !important; }`;
    root.append(style);
    enforceInOpenShadowRoots(root);
  }

  // Stylesheets automatically apply to future light-DOM content. This observer
  // only handles web components that use open shadow roots.
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.shadowRoot?.mode === "open") installStyle(node.shadowRoot);
        enforceInOpenShadowRoots(node);
      }
    }
  });

  const start = () => {
    enforceInOpenShadowRoots(document);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();
