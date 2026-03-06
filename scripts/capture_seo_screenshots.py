"""
SEO Visual Analysis — Screenshot Capture Script
Captures desktop and mobile screenshots for generalmarket.io pages.
"""

from playwright.sync_api import sync_playwright
import json
import os

SCREENSHOTS_DIR = "/Users/maxguillabert/Downloads/index/screenshots"
BASE_URL = "https://www.generalmarket.io"

PAGES = [
    {"path": "/", "name": "homepage"},
    {"path": "/index", "name": "marketplace"},
    {"path": "/about", "name": "about"},
    {"path": "/learn/what-are-itps", "name": "learn-what-are-itps"},
]

VIEWPORTS = [
    {"name": "desktop", "width": 1920, "height": 1080},
    {"name": "mobile-iphone14", "width": 390, "height": 844},
]


def capture_and_analyze(url, output_name, viewport_width, viewport_height, is_mobile=False):
    """Capture screenshot and extract SEO-relevant DOM info."""
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context_opts = {
            "viewport": {"width": viewport_width, "height": viewport_height},
        }
        if is_mobile:
            context_opts["device_scale_factor"] = 3
            context_opts["user_agent"] = (
                "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
            )
            context_opts["is_mobile"] = True
            context_opts["has_touch"] = True

        context = browser.new_context(**context_opts)
        page = context.new_page()

        try:
            response = page.goto(url, wait_until="networkidle", timeout=30000)
            status = response.status if response else "no response"
            print(f"  HTTP status: {status}")
        except Exception as e:
            print(f"  Navigation error: {e}")
            context.close()
            browser.close()
            return {"error": str(e), "url": url}

        # Wait for JS rendering / animations
        page.wait_for_timeout(3000)

        # Above-the-fold screenshot
        atf_path = os.path.join(SCREENSHOTS_DIR, f"{output_name}_atf.png")
        page.screenshot(path=atf_path, full_page=False)

        # Full page screenshot
        full_path = os.path.join(SCREENSHOTS_DIR, f"{output_name}_full.png")
        page.screenshot(path=full_path, full_page=True)

        # Extract SEO data from DOM
        seo_data = page.evaluate("""() => {
            const data = {};

            // Title
            data.title = document.title;

            // Meta description
            const metaDesc = document.querySelector('meta[name="description"]');
            data.metaDescription = metaDesc ? metaDesc.getAttribute('content') : null;

            // Meta keywords
            const metaKeywords = document.querySelector('meta[name="keywords"]');
            data.metaKeywords = metaKeywords ? metaKeywords.getAttribute('content') : null;

            // OG tags
            data.ogTags = {};
            document.querySelectorAll('meta[property^="og:"]').forEach(el => {
                data.ogTags[el.getAttribute('property')] = el.getAttribute('content');
            });

            // Twitter cards
            data.twitterTags = {};
            document.querySelectorAll('meta[name^="twitter:"]').forEach(el => {
                data.twitterTags[el.getAttribute('name')] = el.getAttribute('content');
            });

            // Canonical URL
            const canonical = document.querySelector('link[rel="canonical"]');
            data.canonical = canonical ? canonical.getAttribute('href') : null;

            // H1 tags
            data.h1Tags = Array.from(document.querySelectorAll('h1')).map(el => ({
                text: el.textContent.trim(),
                visible: el.offsetParent !== null,
                rect: el.getBoundingClientRect(),
                fontSize: window.getComputedStyle(el).fontSize,
                color: window.getComputedStyle(el).color,
            }));

            // H2 tags
            data.h2Tags = Array.from(document.querySelectorAll('h2')).map(el => ({
                text: el.textContent.trim(),
                visible: el.offsetParent !== null,
            }));

            // H3 tags
            data.h3Tags = Array.from(document.querySelectorAll('h3')).map(el => ({
                text: el.textContent.trim().substring(0, 100),
            }));

            // CTA buttons (links and buttons above the fold)
            data.ctaElements = Array.from(document.querySelectorAll('a, button')).slice(0, 40).map(el => {
                const rect = el.getBoundingClientRect();
                return {
                    tag: el.tagName,
                    text: el.textContent.trim().substring(0, 80),
                    href: el.getAttribute('href'),
                    rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
                    aboveTheFold: rect.top < window.innerHeight,
                    fontSize: window.getComputedStyle(el).fontSize,
                    bgColor: window.getComputedStyle(el).backgroundColor,
                    color: window.getComputedStyle(el).color,
                };
            });

            // Images without alt text
            data.images = Array.from(document.querySelectorAll('img')).map(el => ({
                src: el.getAttribute('src')?.substring(0, 100),
                alt: el.getAttribute('alt'),
                hasAlt: el.hasAttribute('alt') && el.getAttribute('alt').length > 0,
                width: el.naturalWidth,
                height: el.naturalHeight,
            }));

            // Nav structure
            const nav = document.querySelector('nav');
            data.navLinks = nav ? Array.from(nav.querySelectorAll('a')).map(a => ({
                text: a.textContent.trim(),
                href: a.getAttribute('href'),
            })) : [];

            // Viewport meta
            const viewportMeta = document.querySelector('meta[name="viewport"]');
            data.viewport = viewportMeta ? viewportMeta.getAttribute('content') : null;

            // Structured data (JSON-LD)
            data.jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(el => {
                try { return JSON.parse(el.textContent); } catch(e) { return null; }
            }).filter(Boolean);

            // Font sizes of body text
            const bodyText = document.querySelector('body');
            data.bodyFontSize = bodyText ? window.getComputedStyle(bodyText).fontSize : null;

            // Check for horizontal overflow
            data.hasHorizontalOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;

            // Page dimensions
            data.pageWidth = document.documentElement.scrollWidth;
            data.pageHeight = document.documentElement.scrollHeight;
            data.viewportWidth = window.innerWidth;
            data.viewportHeight = window.innerHeight;

            // Robots meta
            const robotsMeta = document.querySelector('meta[name="robots"]');
            data.robots = robotsMeta ? robotsMeta.getAttribute('content') : null;

            // Language
            data.lang = document.documentElement.getAttribute('lang');

            // Body text content (first 800 chars for content analysis)
            data.bodyTextPreview = document.body?.innerText?.substring(0, 800) || "";

            // Preconnect / dns-prefetch hints
            data.preconnectLinks = Array.from(document.querySelectorAll('link[rel="preconnect"], link[rel="dns-prefetch"]')).map(el => ({
                rel: el.getAttribute('rel'),
                href: el.getAttribute('href'),
            }));

            return data;
        }""")

        seo_data["httpStatus"] = status
        seo_data["url"] = url

        # Save SEO data
        seo_path = os.path.join(SCREENSHOTS_DIR, f"{output_name}_seo.json")
        with open(seo_path, 'w') as f:
            json.dump(seo_data, f, indent=2, default=str)

        context.close()
        browser.close()
        print(f"  ATF screenshot: {atf_path}")
        print(f"  Full screenshot: {full_path}")
        print(f"  SEO data: {seo_path}")
        return seo_data


if __name__ == "__main__":
    import sys

    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
    target = sys.argv[1] if len(sys.argv) > 1 else "all"

    all_results = {}

    for page_info in PAGES:
        for vp in VIEWPORTS:
            key = f"{vp['name']}_{page_info['name']}"

            if target != "all" and target != key:
                continue

            url = f"{BASE_URL}{page_info['path']}"
            is_mobile = "mobile" in vp["name"]
            print(f"\n=== {key}: {url} @ {vp['width']}x{vp['height']} ===")

            data = capture_and_analyze(
                url, key, vp["width"], vp["height"], is_mobile=is_mobile
            )
            all_results[key] = data

    # Save combined results
    combined_path = os.path.join(SCREENSHOTS_DIR, "seo_analysis_combined.json")
    with open(combined_path, 'w') as f:
        json.dump(all_results, f, indent=2, default=str)
    print(f"\nCombined analysis saved to: {combined_path}")
