(() => {
  "use strict";

  const masterToggle = document.getElementById("masterToggle");
  const siteToggle = document.getElementById("siteToggle");
  const siteName = document.getElementById("siteName");
  const masterStatus = document.getElementById("masterStatus");
  let hostname = "";

  async function activeTab() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function render() {
    const tab = await activeTab();
    try {
      hostname = new URL(tab.url).hostname;
    } catch {
      hostname = "";
    }

    const settings = await browser.storage.local.get({
      enabled: true,
      disabledSites: {}
    });

    masterToggle.checked = settings.enabled;
    siteToggle.checked = Boolean(hostname) && !settings.disabledSites[hostname];
    siteToggle.disabled = !settings.enabled || !hostname;
    siteName.textContent = hostname || "صفحهٔ محافظت‌شده";
    masterStatus.textContent = settings.enabled
      ? "روی همهٔ سایت‌های مجاز فعال است"
      : "افزونه فعلاً خاموش است";
  }

  async function notifyTabs() {
    const settings = await browser.storage.local.get({
      enabled: true,
      disabledSites: {}
    });
    const tabs = await browser.tabs.query({});
    await Promise.allSettled(
      tabs.map((tab) => {
        let tabHostname = "";
        try {
          tabHostname = new URL(tab.url).hostname;
        } catch {
          return Promise.resolve();
        }
        const tabEnabled =
          settings.enabled && !settings.disabledSites[tabHostname];
        return browser.tabs.sendMessage(tab.id, {
          type: "bve-set-enabled",
          enabled: tabEnabled
        });
      })
    );
  }

  masterToggle.addEventListener("change", async () => {
    await browser.storage.local.set({ enabled: masterToggle.checked });
    await notifyTabs();
    await render();
  });

  siteToggle.addEventListener("change", async () => {
    const { disabledSites } = await browser.storage.local.get({ disabledSites: {} });
    if (siteToggle.checked) delete disabledSites[hostname];
    else disabledSites[hostname] = true;
    await browser.storage.local.set({ disabledSites });
    await notifyTabs();
    await render();
  });

  render();
})();
