(() => {
  "use strict";

  const masterToggle = document.getElementById("masterToggle");
  const siteToggle = document.getElementById("siteToggle");
  const siteName = document.getElementById("siteName");
  const masterStatus = document.getElementById("masterStatus");
  const fontPreview = document.querySelector(".font-preview");
  const fontState = document.getElementById("fontState");
  const fontDetails = document.getElementById("fontDetails");
  const versionLabel = document.getElementById("versionLabel");
  let hostname = "";

  async function activeTab() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function render() {
    const tab = await activeTab();
    versionLabel.textContent = `v${browser.runtime.getManifest().version}`;
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

    if (!settings.enabled || settings.disabledSites[hostname]) {
      fontPreview.dataset.state = "off";
      fontState.textContent = "خاموش در این صفحه";
      fontDetails.textContent = "با کلیدهای بالا دوباره فعالش کنید";
      return;
    }

    try {
      const status = await browser.tabs.sendMessage(tab.id, { type: "bve-get-status" });
      if (!status?.enabled) throw new Error("inactive-content-script");

      const applied = status.checkedTextElements - status.mismatchedTextElements;
      if (status.fontLoaded && status.mismatchedTextElements === 0) {
        fontPreview.dataset.state = "ok";
        fontState.textContent = "Vazir اعمال شده";
        fontDetails.textContent = `${applied} بخش متنی بررسی شد`;
      } else {
        fontPreview.dataset.state = "error";
        fontState.textContent = "اعمال ناقص فونت";
        fontDetails.textContent = `${status.mismatchedTextElements} بخش از ${status.checkedTextElements} بخش هنوز Vazir نیست`;
      }
    } catch {
      const hasAccess = await browser.permissions
        .contains({ origins: ["<all_urls>"] })
        .catch(() => false);
      fontPreview.dataset.state = "error";
      fontState.textContent = hasAccess ? "صفحه را Reload کنید" : "دسترسی سایت خاموش است";
      fontDetails.textContent = hasAccess
        ? "این نسخه هنوز داخل تب فعلی لود نشده"
        : "در تنظیمات Firefox، دسترسی همهٔ سایت‌ها را فعال کنید";
    }
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
