// Значки приложения из одного рисунка: design/icon-mark.svg → app/icons/*.png
// Запуск: npm run icons (Chromium от Playwright: npx playwright install chromium)
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const mark = fs.readFileSync(path.join(__dirname, "icon-mark.svg"), "utf8").replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, "");
const font = fs.readFileSync(path.join(root, "app", "fonts", "onest-latin.woff2")).toString("base64");
const BG = "#E4E8EC";   // фон приложения — как background_color в manifest
const rounded = `<rect width="512" height="512" rx="112" fill="${BG}"/>`;
const square = `<rect width="512" height="512" fill="${BG}"/>`;

const variants = [
  // Android, компьютер, вкладка браузера: скруглённая плитка, углы прозрачные
  { file: "icon-192.png", size: 192, tile: rounded, scale: 1 },
  { file: "icon-512.png", size: 512, tile: rounded, scale: 1 },
  // Android сам вырезает форму (круг, «капля»): квадрат во всю ширину, рисунок внутри безопасного круга (80%)
  { file: "maskable-512.png", size: 512, tile: square, scale: 0.84 },
  // iPhone сам скругляет углы, а прозрачные закрашивает чёрным: квадрат во всю ширину
  { file: "apple-touch-icon.png", size: 180, tile: square, scale: 1 },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const v of variants) {
    const g = v.scale === 1 ? mark : `<g transform="translate(256 256) scale(${v.scale}) translate(-256 -256)">${mark}</g>`;
    await page.setViewportSize({ width: v.size, height: v.size });
    await page.setContent(`<style>@font-face{font-family:Onest;font-weight:400 700;src:url(data:font/woff2;base64,${font}) format("woff2")}
      html,body{margin:0;background:transparent}svg{display:block}</style>
      <svg xmlns="http://www.w3.org/2000/svg" width="${v.size}" height="${v.size}" viewBox="0 0 512 512">${v.tile}${g}</svg>`);
    await page.evaluate(async () => { await document.fonts.load("700 120px Onest"); await document.fonts.ready; });
    await page.screenshot({ path: path.join(root, "app", "icons", v.file), omitBackground: true });
    console.log("готово:", v.file);
  }
  await browser.close();
})();
