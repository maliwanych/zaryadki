// Сквозные проверки приложения в браузере с экраном телефона.
// Запуск: npm test
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const FIXTURE = path.join(__dirname, "fixtures", "sample-backup.json");
const backup = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
const num = s => parseFloat(String(s).replace(/[^\d,.-]/g, "").replace(",", "."));

async function importBackup(page) {
  await page.setInputFiles("#fileImport", FIXTURE);
  await expect(page.locator("#fKwh")).not.toHaveText("0,0");
}

test("первый запуск: приветствие и настройка машины", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#welcome")).toBeVisible();
  await page.click("#btnStart");
  await page.fill("#formSet [name=carName]", "Моя машина");
  await page.fill("#formSet [name=startOdo]", "0");
  await page.click("#formSet button[type=submit]");
  await expect(page.locator("#welcome")).toBeHidden();
  await expect(page.locator("#carName")).toHaveText("Моя машина");
});

test("зарядка сохраняется после перезапуска", async ({ page }) => {
  await page.goto("./");
  await page.click("#btnAdd");
  await page.fill("#formSess [name=station]", "Тест");
  await page.fill("#formSess [name=kwh]", "20");
  await page.fill("#formSess [name=byn]", "13");
  await page.click("#btnSaveSess");
  await page.reload();
  await expect(page.locator("#fKwh")).toHaveText("20,0");
});

test("загрузка резервной копии и расчёты", async ({ page }) => {
  await page.goto("./");
  await importBackup(page);
  const kwh = backup.sessions.reduce((a, s) => a + s.kwh, 0);
  const byn = backup.sessions.reduce((a, s) => a + s.byn, 0);
  await expect(page.locator("#fKwh")).toHaveText(kwh.toFixed(1).replace(".", ","));
  expect(num(await page.locator("#regByn").getAttribute("aria-label"))).toBeCloseTo(byn, 2);
  // стоимость и расход на 100 км посчитаны
  expect(num(await page.locator("#fPer100").textContent())).toBeGreaterThan(0);
  expect(num(await page.locator("#fCons").textContent())).toBeGreaterThan(0);
  // бесплатные зарядки дают экономию
  await expect(page.locator("#fSaved")).toContainText("BYN");
  // реальный запас на полном заряде: 60 кВт·ч × 350 км / (18,8 + 37,6) кВт·ч ≈ 372 км
  await expect(page.locator("#f2f")).toContainText("372");
});

test("сумма подставляется по цене станции, бесплатная станция — ноль", async ({ page }) => {
  await page.goto("./");
  await importBackup(page);
  await page.click("#btnAdd");
  await page.fill("#formSess [name=station]", "Работа");
  await page.fill("#formSess [name=kwh]", "30");
  await expect(page.locator("#formSess [name=byn]")).toHaveValue("0,00");
  await page.fill("#formSess [name=station]", "Станция В");
  await page.fill("#formSess [name=kwh]", "10");
  await expect(page.locator("#formSess [name=byn]")).toHaveValue("5,40");
});

test("резервная копия сохраняется и содержит все данные", async ({ page }) => {
  await page.goto("./");
  await importBackup(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#btnJson")]);
  const saved = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  expect(saved.sessions).toHaveLength(backup.sessions.length);
  expect(saved.costs).toHaveLength(backup.costs.length);
  expect(saved.reminders).toHaveLength(backup.reminders.length);
});

test("работает без интернета", async ({ page, context }) => {
  await page.goto("./");
  await importBackup(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // теперь страницей управляет service worker
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#carName")).toHaveText(backup.settings.carName);
  await context.setOffline(false);
});

test("новая версия: плашка и обновление без потери данных", async ({ page }) => {
  // Имитируем выход обновления: временно меняем версию в sw.js на «сервере».
  // Браузер не пропускает загрузку service worker через подмену запросов, поэтому правим сам файл
  // (тесты идут по одному — см. workers: 1 в playwright.config.js).
  const swPath = path.join(__dirname, "..", "app", "sw.js");
  const original = fs.readFileSync(swPath, "utf8");
  try {
    await page.goto("./");
    await importBackup(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    fs.writeFileSync(swPath, original.replace(/const VERSION = "[^"]*"/, 'const VERSION = "test-update"'));
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await expect(page.locator("#updBanner")).toBeVisible();
    await Promise.all([page.waitForEvent("load"), page.click("#btnUpdate")]);
    await expect(page.locator("#updBanner")).toBeHidden();
    await expect(page.locator("#carName")).toHaveText(backup.settings.carName);
  } finally {
    fs.writeFileSync(swPath, original);
  }
});

test("версия совпадает в index.html, sw.js и package.json", () => {
  const app = path.join(__dirname, "..", "app");
  const a = fs.readFileSync(path.join(app, "index.html"), "utf8").match(/APP_VERSION = "([^"]+)"/)[1];
  const b = fs.readFileSync(path.join(app, "sw.js"), "utf8").match(/const VERSION = "([^"]+)"/)[1];
  const c = require("../package.json").version;
  expect(b).toBe(a);
  expect(c).toBe(a);
});

test("в приложении нет чужих настроек по умолчанию", () => {
  // Приложение публичное: никаких вшитых дат покупки, пробегов и т.п. от исходной версии
  const html = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
  for (const s of ['purchaseDate:"20', "startOdo:1", "capKwh || 6"]) expect(html).not.toContain(s);
});
