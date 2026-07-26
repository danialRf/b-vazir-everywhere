(() => {
  "use strict";

  const ROOT_CLASS = "bve-font-enabled";
  const hostname = location.hostname;

  function setState(enabled) {
    document.documentElement?.classList.toggle(ROOT_CLASS, Boolean(enabled));
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

  if (document.documentElement) refresh();
  else document.addEventListener("DOMContentLoaded", refresh, { once: true });
})();
