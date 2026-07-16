// supporter-tracker.html を埋め込みモードでヘッドレスChromeにレンダリングし、
// supporter-tracker.png として書き出す。
// 使い方: node scripts/render_png.js
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const root = path.resolve(__dirname, "..");
  const htmlPath = path.join(root, "supporter-tracker.html");
  const outPath = path.join(root, "supporter-tracker.png");

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 780, height: 1000 },
    deviceScaleFactor: 2,
  });

  await page.goto("file://" + htmlPath + "?embed=1", { waitUntil: "networkidle" });
  await page.evaluate(() => document.body.classList.add("embed"));
  await page.waitForTimeout(400);

  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
  console.log("wrote " + outPath);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
