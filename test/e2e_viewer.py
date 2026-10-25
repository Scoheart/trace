"""Optional manual E2E smoke test, requires pip install playwright and playwright install chromium.
Start the server separately after importing synthetic fixtures.
"""
from playwright.sync_api import sync_playwright

def test_viewer():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()
            page.goto("http://127.0.0.1:4317")
            page.get_by_text("Sessions", exact=True).wait_for()
            assert "AGENT TRACE" in page.locator("header").inner_text()
        finally:
            browser.close()

if __name__ == "__main__":
    test_viewer()
