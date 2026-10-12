// Сквозные проверки приложения в браузере с экраном телефона.
// Запуск: npm test
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const http = require("http");
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

test("обновление не застревает на старой странице из кэша браузера", async ({ page }) => {
  // GitHub Pages разрешает браузеру 10 минут хранить файлы у себя (max-age=600). Если новый service worker
  // возьмёт index.html оттуда, после «Обновить» откроется старая страница. Поднимаем свой сервер с такими же
  // заголовками и «выпускаем» новую версию прямо в памяти — файлы на диске не трогаем.
  const app = path.join(__dirname, "..", "app");
  const types = { ".html": "text/html", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png" };
  let release = 1;
  const server = http.createServer((req, res) => {
    let file = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\//, "") || "index.html";
    const full = path.join(app, file);
    if (!full.startsWith(app) || !fs.existsSync(full)) { res.writeHead(404); return res.end(); }
    let body = fs.readFileSync(full);
    if (release === 2 && file === "index.html") body = Buffer.from(body.toString().replace("<head>", '<head><meta name="release" content="2">'));
    if (release === 2 && file === "sw.js") body = Buffer.from(body.toString().replace(/const VERSION = "[^"]*"/, 'const VERSION = "test-release-2"'));
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "max-age=600" });
    res.end(body);
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    release = 2;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await expect(page.locator("#updBanner")).toBeVisible();
    await Promise.all([page.waitForEvent("load"), page.click("#btnUpdate")]);
    await expect(page.locator('meta[name="release"]')).toHaveAttribute("content", "2");
  } finally {
    await new Promise(r => server.close(r));
  }
});

test("испорченная копия не ломает приложение", async ({ page }) => {
  const bad = {
    exportedAt: "2026-08-25T10:00:00.000Z",
    settings: { carName: "Проверка", purchaseDate: "2026-08-01", startOdo: 0 },
    sessions: [
      { id: "ok1", ts: "2026-08-03T18:40", station: "Станция А", kwh: 30, byn: 19.5, type: "dc" },
      { id: "str", ts: "2026-08-04T10:00", station: "Станция А", kwh: "20,5", byn: "13", type: "dc" },
      { id: "nots", station: "Без даты", kwh: 10, byn: 5 },
      null,
      "мусор",
    ],
    odo: { не: "массив" },
    costs: [null, { id: "c1", byn: 50, date: "2026-08-10", note: "Мойка", kind: "run" }],
    reminders: [{ id: "a/b", title: "Шины", everyKm: 10000, lastOdo: 0 }],
  };
  const file = { name: "zaryadki-backup-bad.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bad)) };
  await page.goto("./");
  await page.setInputFiles("#fileImport", file);
  await expect(page.locator("#toast")).toContainText("Загружено: 2 зарядки");
  await expect(page.locator("#toast")).toContainText("Пропущено записей с ошибками: 4");
  await expect(page.locator("#fKwh")).toHaveText("50,5");
  // после перезапуска тоже открывается
  await page.reload();
  await expect(page.locator("#carName")).toHaveText("Проверка");
  await expect(page.locator("#fKwh")).toHaveText("50,5");
  await page.click("[data-tab=rem]");
  await expect(page.locator("#remList")).toContainText("Шины");
});

test("правка записи не стирает поля, которых нет в форме", async ({ page }) => {
  const old = {
    settings: { carName: "Проверка", purchaseDate: "2026-08-01", startOdo: 0, legacy: "x" },
    sessions: [{ id: "s1", ts: "2026-08-03T18:40", station: "Старое", kwh: 30, byn: 19.5, type: "dc", socFrom: 20, socTo: 80 }],
    reminders: [{ id: "r1", title: "Шины", everyKm: 10000, lastOdo: 0, lastDate: "2026-08-02" }],
    costs: [{ id: "c1", byn: 50, date: "2026-08-10", note: "Мойка", kind: "run", extra: 1 }],
  };
  const file = { name: "old.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(old)) };
  await page.goto("./");
  await page.setInputFiles("#fileImport", file);
  await expect(page.locator("#fKwh")).toHaveText("30,0");
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("ev-tracker")).docs);

  await page.click("[data-tab=sessions]");
  await page.click("#list .sess");
  await page.fill("#formSess [name=station]", "Новое");
  await page.click("#btnSaveSess");
  await expect(page.locator("#list .sess .st")).toHaveText("Новое");
  await expect(page.locator("#list .sess .meta").first()).toContainText("20→80%");

  await page.click("[data-tab=rem]");
  await page.click("#remList .rowline");
  await page.fill("#formRem [name=title]", "Перестановка шин");
  await page.click("#formRem button[type=submit]");
  await expect(page.locator("#remList")).toContainText("Перестановка шин");

  await page.click("[data-tab=costs]");
  await page.click("#costList .rowline");
  await page.fill("#formCost [name=note]", "Мойка кузова");
  await page.click("#formCost button[type=submit]");
  await expect(page.locator("#costList")).toContainText("Мойка кузова");

  await page.click("[data-tab=overview]");
  await page.click("#btnSettings");
  await page.fill("#formSet [name=carName]", "Другая");
  await page.click("#formSet button[type=submit]");
  await expect(page.locator("#carName")).toHaveText("Другая");

  const d = await stored();
  expect(d["sessions/s1"]).toMatchObject({ station: "Новое", socFrom: 20, socTo: 80 });
  expect(d["reminders/r1"]).toMatchObject({ title: "Перестановка шин", lastDate: "2026-08-02" });
  expect(d["costs/c1"]).toMatchObject({ note: "Мойка кузова", extra: 1 });
  expect(d["meta/settings"]).toMatchObject({ carName: "Другая", legacy: "x" });
});

test("версия совпадает в index.html, sw.js и package.json", () => {
  const app = path.join(__dirname, "..", "app");
  const a = fs.readFileSync(path.join(app, "index.html"), "utf8").match(/APP_VERSION = "([^"]+)"/)[1];
  const b = fs.readFileSync(path.join(app, "sw.js"), "utf8").match(/const VERSION = "([^"]+)"/)[1];
  const c = require("../package.json").version;
  expect(b).toBe(a);
  expect(c).toBe(a);
});

test("версия Playwright в package.json совпадает с контейнером в GitHub Actions", () => {
  // Иначе на GitHub тесты запустятся с браузером другой версии и упадут
  const yml = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "deploy.yml"), "utf8");
  const image = yml.match(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/)[1];
  expect(image).toBe(require("../package.json").devDependencies["@playwright/test"]);
});

test("в приложении нет чужих настроек по умолчанию", () => {
  // Приложение публичное: никаких вшитых дат покупки, пробегов и т.п. от исходной версии
  const html = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
  for (const s of ['purchaseDate:"20', "startOdo:1", "capKwh || 6"]) expect(html).not.toContain(s);
});
