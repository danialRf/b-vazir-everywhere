import json
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TESTS = Path(__file__).resolve().parent
sys.path.insert(0, str(TESTS / ".deps"))

from marionette_driver.addons import Addons
from marionette_driver.marionette import Marionette
from mozprofile import FirefoxProfile
from mozrunner import FirefoxRunner


class FixtureHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(TESTS), **kwargs)

    def log_message(self, *_args):
        pass


def wait_for_marionette(port, timeout=20):
    deadline = time.monotonic() + timeout
    last_error = None
    while time.monotonic() < deadline:
        try:
            client = Marionette(host="127.0.0.1", port=port, socket_timeout=10)
            client.start_session()
            return client
        except Exception as error:
            last_error = error
            time.sleep(0.25)
    raise RuntimeError(f"Marionette did not start: {last_error}")


def main():
    package = ROOT / "web-ext-artifacts" / "b_vazir_everywhere-2.0.0.zip"
    if not package.exists():
        raise FileNotFoundError(f"Build the extension first: {package}")

    server = ThreadingHTTPServer(("127.0.0.1", 0), FixtureHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = 2829
    profile = FirefoxProfile(
        profile=str(TESTS / "profile"),
        preferences={"marionette.port": port, "marionette.enabled": True},
    )
    runner = FirefoxRunner(
        binary=r"C:\Program Files\Mozilla Firefox\firefox.exe",
        profile=profile,
        cmdargs=["-headless", "-marionette", "-no-remote"],
    )
    client = None

    try:
        runner.start()
        client = wait_for_marionette(port)
        Addons(client).install(str(package), temp=True)
        client.navigate(f"http://127.0.0.1:{server.server_port}/fixture.html")

        deadline = time.monotonic() + 12
        report = None
        while time.monotonic() < deadline:
            title = client.title
            if title.startswith("{"):
                report = json.loads(title)
                break
            time.sleep(0.2)
        if report is None:
            raise AssertionError("The fixture did not produce a report")

        expected_vazir = ["normal", "important", "dynamic", "openShadow", "closedShadow"]
        failures = [name for name in expected_vazir if "B Vazir Everywhere" not in report[name]]
        if not report["rootEnabled"]:
            failures.append("rootEnabled")
        if not report["fontLoaded"]:
            failures.append("bundled font load")
        if "Material Icons" not in report["icon"]:
            failures.append("icon protection")
        if not report["openShadowStyle"] or not report["closedShadowStyle"]:
            failures.append("shadow stylesheet injection")

        print(json.dumps(report, ensure_ascii=False, indent=2))
        if failures:
            raise AssertionError(f"Failed checks: {', '.join(failures)}")
        print("BVE_INTEGRATION_OK")
    finally:
        if client:
            try:
                client.delete_session()
            except Exception:
                pass
        runner.stop()
        server.shutdown()


if __name__ == "__main__":
    main()
