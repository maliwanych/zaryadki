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

const importJson = (page, data) =>
  page.setInputFiles("#fileImport", { name: "copy.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)) });

test("цена км не уходит в минус сразу после покупки", async ({ page }) => {
  // Отдали с запасом 300 км, проехали 10, запас 250: «оплачено» 10 + 250 − 300 = −40 км
  await page.goto("./");
  await importJson(page, {
    settings: { carName: "Проверка", purchaseDate: "2026-08-01", startOdo: 0, startRange: 300 },
    odo: [{ id: "o1", date: "2026-08-02T12:00:00.000Z", odo: 10, range: 250 }],
    sessions: [{ id: "s1", ts: "2026-08-01T18:00", station: "А", kwh: 5, byn: 3, type: "dc" }],
  });
  await expect(page.locator("#fKwh")).toHaveText("5,0");
  await expect(page.locator("#fPer100")).toHaveText("—");
  await expect(page.locator("#fCons")).toHaveText("—");
  await expect(page.locator("#perNote")).toContainText("Пока мало данных");
});

test("загрузка копии поверх данных: окно с цифрами, отмена и «Вернуть как было»", async ({ page }) => {
  await page.goto("./");
  await importBackup(page); // на пустом телефоне — без вопросов
  await expect(page.locator("#dlgImport")).toBeHidden();
  // запись, которой нет в копии
  await page.click("#btnAdd");
  await page.fill("#formSess [name=station]", "Новая станция");
  await page.fill("#formSess [name=kwh]", "10");
  await page.fill("#formSess [name=byn]", "6");
  await page.click("#btnSaveSess");
  await page.click("[data-tab=sessions]");
  await expect(page.locator("#list")).toContainText("Новая станция");

  const dlg = page.locator("#dlgImport");
  await page.setInputFiles("#fileImport", FIXTURE);
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText("В копии от 25 августа 2026");
  await expect(dlg).toContainText("7 зарядок, 4 расхода, 2 напоминания");
  await expect(dlg).toContainText("Сейчас на телефоне: 8 зарядок");
  await expect(dlg).toContainText("пропадут: 1 зарядка");
  await page.click("#dlgImport [data-close]");
  await expect(dlg).toBeHidden();
  await expect(page.locator("#list")).toContainText("Новая станция");

  await page.setInputFiles("#fileImport", FIXTURE);
  await page.click("#btnImportOk");
  await expect(page.locator("#list")).not.toContainText("Новая станция");
  await expect(page.locator("#undoBanner")).toBeVisible();
  await page.click("#btnUndo");
  await expect(page.locator("#list")).toContainText("Новая станция");
  await expect(page.locator("#undoBanner")).toBeHidden();

  // без расхождений предупреждения о потерях нет
  await page.setInputFiles("#fileImport", FIXTURE);
  await page.click("#btnImportOk");
  await page.setInputFiles("#fileImport", FIXTURE);
  await expect(dlg).toBeVisible();
  await expect(page.locator("#impLost")).toBeHidden();
  await page.click("#dlgImport [data-close]");
});

test("вернуть данные до загрузки копии можно из настроек", async ({ page }) => {
  await page.goto("./");
  await importJson(page, { settings: { carName: "Было", purchaseDate: "2026-08-01", startOdo: 0 }, sessions: [], reminders: [{ id: "my1", title: "Шины", everyKm: 10000, lastOdo: 0 }] });
  await expect(page.locator("#carName")).toHaveText("Было");
  // только настройки и напоминание — это тоже данные, без вопроса не заменяем
  await page.setInputFiles("#fileImport", FIXTURE);
  await expect(page.locator("#dlgImport")).toContainText("пропадут: 1 напоминание");
  await page.click("#btnImportOk");
  await expect(page.locator("#carName")).toHaveText(backup.settings.carName);

  await page.reload(); // плашка уже ушла, а вернуть всё ещё можно
  await page.click("#btnSettings");
  const undo = page.locator("#btnUndoImport");
  await expect(undo).toBeVisible();
  await undo.click();
  await expect(undo).toContainText("Точно вернуть?");
  await undo.click();
  await expect(page.locator("#carName")).toHaveText("Было");
  await page.click("#btnSettings");
  await expect(undo).toBeHidden();
});

test("напоминания: «сегодня», конец месяца и местное время", async ({ page }) => {
  // 00:30 по Минску — в UTC ещё 30 января
  await page.clock.setFixedTime(new Date("2027-01-31T00:30:00+03:00"));
  await page.goto("./");
  await page.click("#btnStart");
  await expect(page.locator("#formSet [name=purchaseDate]")).toHaveValue("2027-01-31");
  await page.click("#formSet [data-close]");

  await importJson(page, {
    settings: { carName: "Проверка", purchaseDate: "2026-08-01", startOdo: 0 },
    sessions: [],
    reminders: [{ id: "r1", title: "Страховка", dueDate: "2027-01-31", everyMonths: 1 }],
  });
  await page.click("[data-tab=rem]");
  await expect(page.locator("#remList .rowline")).toContainText("сегодня");
  await expect(page.locator("#remList .rowline")).toHaveClass(/warn/);
  await page.click("#remList .rowline");
  await page.click("#btnRemDone");
  await expect(page.locator("#remList .rowline")).not.toContainText("сегодня");
  const r = await page.evaluate(() => JSON.parse(localStorage.getItem("ev-tracker")).docs["reminders/r1"]);
  expect(r).toMatchObject({ lastDate: "2027-01-31", dueDate: "2027-02-28" });
});

test("страница конфиденциальности: ссылка с главного экрана, возврат и работа без интернета", async ({ page, context }) => {
  await page.goto("./");
  await expect(page.locator("#welcome a[href='privacy.html']")).toBeVisible();
  await page.click("footer a[href='privacy.html'], .ver a[href='privacy.html']");
  await expect(page).toHaveURL(/privacy\.html$/);
  await expect(page.locator("h1")).toHaveText("Конфиденциальность");
  await expect(page.locator("body")).toContainText("хранятся только на вашем устройстве");
  await page.click("a.back");
  await expect(page.locator("#carName")).toBeVisible();

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // страницей управляет service worker
  await context.setOffline(true);
  await page.goto("./privacy.html");
  await expect(page.locator("h1")).toHaveText("Конфиденциальность");
  await context.setOffline(false);
});

test("страницы приложения ничего не загружают с чужих сайтов", () => {
  // ссылки для чтения (<a href>) можно, а вот скрипты, стили, шрифты и картинки — только свои
  for (const page of ["index.html", "privacy.html"]) {
    const html = fs.readFileSync(path.join(__dirname, "..", "app", page), "utf8");
    const external = [...html.matchAll(/<(script|link|img|iframe|style)[^>]*>/g)].map(m => m[0]).filter(t => /https?:|\/\//.test(t));
    expect(external, page).toEqual([]);
    expect(html, page).not.toMatch(/@import|url\(\s*["']?(https?:)?\/\//);
  }
});

test("шрифт свой: обращений к чужим сайтам нет, и без интернета он тоже есть", async ({ page, context }) => {
  const requests = [];
  page.on("request", r => requests.push(r.url()));
  await page.goto("./");
  await page.evaluate(() => navigator.serviceWorker.ready);
  expect(requests.filter(u => !/^http:\/\/localhost:8765\//.test(u))).toEqual([]);
  expect(requests.some(u => u.endsWith("/fonts/onest-cyrillic.woff2"))).toBe(true);
  // первый запуск закончился — без интернета шрифт берётся из кэша service worker
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  expect(await page.evaluate(async () => (await document.fonts.load("600 16px Onest", "Ж")).length)).toBeGreaterThan(0);
  await context.setOffline(false);
});

test("настройка «Начало учёта»: км и цена считаются с начала учёта", async ({ page }) => {
  // машине может быть год, но записи ведутся с сегодняшнего дня
  await page.goto("./");
  await page.click("#btnStart");
  await expect(page.locator("#dlgSet")).toContainText("Начало учёта");
  for (const label of await page.locator("#formSet label").allTextContents()) expect(label).not.toContain("покупк");
  await page.fill("#formSet [name=startOdo]", "20000");
  await page.fill("#formSet [name=startRange]", "300");
  await page.click("#formSet button[type=submit]");
  await page.click("#btnAdd");
  await page.fill("#formSess [name=kwh]", "30");
  await page.fill("#formSess [name=byn]", "15");
  await page.click("#btnSaveSess");
  await page.click("#btnOdo");
  await page.fill("#formOdo [name=odo]", "20200");
  await page.fill("#formOdo [name=range]", "350");
  await page.click("#formOdo button[type=submit]");
  // оплачено: 200 км пройдено + 350 запаса − 300 запаса в начале учёта = 250 км
  await expect(page.locator("#fPer100")).toHaveText("6,0");
  await expect(page.locator("#fCons")).toHaveText("12,0");
  await expect(page.locator("#perNote")).toContainText("в начале учёта");
});

test("месяц: без «доли дешёвых» и «Ночью», полоска типов зарядок на месте", async ({ page }) => {
  // что дёшево — каждый решает сам; типы зарядок — факты
  await page.goto("./");
  await importBackup(page);
  await page.click("#btnAllMonths");
  const aug = page.locator(".month", { hasText: "Август 2026" });
  await expect(aug.locator(".mixbar")).toBeVisible();
  await expect(aug).toContainText("Бесплатно");
  await expect(aug).not.toContainText("Дешевле");
  await expect(aug).not.toContainText("Ночью");
});

test.describe("подсказка для iPhone", () => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  test.use({ userAgent: IPHONE });

  test("в Safari: как установить, «Понятно» запоминается", async ({ page }) => {
    await page.goto("./");
    const hint = page.locator("#iosHint");
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("На экран «Домой»");
    await expect(hint).toContainText("разные хранилища");
    await page.click("#btnIosHint");
    await expect(hint).toBeHidden();
    await page.reload();
    await expect(page.locator("#carName")).toBeVisible();
    await expect(hint).toBeHidden();
  });

  test("в Safari с данными: советует перенести их копией", async ({ page }) => {
    await page.goto("./");
    await importBackup(page);
    await expect(page.locator("#iosHint")).toContainText("сохраните резервную копию");
  });

  test("в приложении с иконки подсказки нет", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
    await page.goto("./");
    await expect(page.locator("#carName")).toBeVisible();
    await expect(page.locator("#iosHint")).toBeHidden();
  });
});

test("на Android подсказки для iPhone нет", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#carName")).toBeVisible();
  await expect(page.locator("#iosHint")).toBeHidden();
});

test("валюта ₽: все подписи меняются, суммы те же, выбор сохраняется в копии", async ({ page }) => {
  await page.goto("./");
  await importBackup(page);
  const total = await page.locator("#regByn").getAttribute("aria-label");
  await page.click("#btnSettings");
  await expect(page.locator("#formSet [name=currency]")).toHaveValue("BYN"); // старая копия без валюты — BYN
  await page.selectOption("#formSet [name=currency]", "RUB");
  await page.click("#formSet button[type=submit]");
  await expect(page.locator(".reg-unit")).toHaveText("₽");
  await expect(page.locator("#regByn")).toHaveAttribute("aria-label", total); // меняется только подпись
  // нигде на экранах не осталось BYN
  for (const tab of ["overview", "sessions", "costs", "rem"]) {
    await page.click(`[data-tab=${tab}]`);
    expect(await page.locator("main").innerText(), tab).not.toContain("BYN");
  }
  await page.click("[data-tab=overview]");
  await expect(page.locator(".month").first()).toContainText("₽ на 100 км");
  await page.click("#btnAdd");
  await expect(page.locator("#dlgSess")).toContainText("Сумма, ₽");
  await page.click("#dlgSess [data-close]");
  await page.reload();
  await expect(page.locator(".reg-unit")).toHaveText("₽");
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#btnJson")]);
  expect(JSON.parse(fs.readFileSync(await download.path(), "utf8")).settings.currency).toBe("RUB");
});

for (const bad of ["USD", "constructor"]) test(`валюта: непонятное значение в копии (${bad}) — BYN`, async ({ page }) => {
  await page.goto("./");
  await importJson(page, { settings: { carName: "Проверка", purchaseDate: "2026-08-01", startOdo: 0, currency: bad }, sessions: [{ id: "s1", ts: "2026-08-03T18:40", kwh: 30, byn: 19.5, type: "dc" }] });
  await expect(page.locator("#fKwh")).toHaveText("30,0");
  await expect(page.locator(".reg-unit")).toHaveText("BYN");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("ev-tracker")).docs["meta/settings"]);
  expect(stored.currency).toBeUndefined();
});

test("счётчик добавляет разряд после 99 999,99", async ({ page }) => {
  await page.goto("./");
  await importJson(page, { settings: { carName: "Проверка", purchaseDate: "2026-01-01", startOdo: 0, currency: "RUB" },
    sessions: [{ id: "s1", ts: "2026-02-01T10:00", kwh: 5000, byn: 123456.78, type: "dc" }] });
  await expect(page.locator("#fKwh")).toHaveText("5 000,0");
  await expect(page.locator("#regByn .drum")).toHaveCount(8); // 6 целых + 2 копейки
  await expect(page.locator("#regByn")).toHaveAttribute("aria-label", /^123\s456,78$/); // тысячи разделяет неразрывный пробел
});

test.describe("пример с данными", () => {
  const stored = (page, key) => page.evaluate(k => localStorage.getItem(k), key);

  test("открывается из приветствия, всё посчитано, переживает перезагрузку, «Выйти» стирает", async ({ page }) => {
    await page.goto("./");
    await page.click("#btnDemo");
    await expect(page.locator("#demoBanner")).toBeVisible();
    await expect(page.locator("#welcome")).toBeHidden();
    await expect(page.locator("#carName")).toHaveText("Электромобиль (пример)"); // без марки: ёмкость в примере условная
    expect(num(await page.locator("#fPer100").textContent())).toBeGreaterThan(0);
    expect(num(await page.locator("#fCons").textContent())).toBeGreaterThan(5);
    await expect(page.locator("#f2fSec")).toBeVisible();          // точный расход и реальный запас
    await expect(page.locator("#f2f")).toContainText("реальный запас");
    await expect(page.locator("#fSaved")).toContainText("BYN");    // бесплатные зарядки на работе
    await page.click("[data-tab=sessions]");
    expect(await page.locator("#list .sess").count()).toBeGreaterThan(10);
    await expect(page.locator("#stationStats")).toContainText("Трасса М1");
    await page.click("[data-tab=costs]");
    await expect(page.locator("#costList")).toContainText("Страховка");
    await page.click("[data-tab=rem]");
    await expect(page.locator("#remList .rowline")).toHaveCount(2);
    expect(await stored(page, "ev-tracker")).toBeNull();           // настоящие данные не тронуты

    await page.reload();
    await expect(page.locator("#demoBanner")).toBeVisible();
    await expect(page.locator("#carName")).toContainText("пример");

    // в примере можно пробовать, но при выходе всё стирается
    await page.click("#btnAdd");
    await page.fill("#formSess [name=station]", "Проба");
    await page.fill("#formSess [name=kwh]", "10");
    await page.fill("#formSess [name=byn]", "5");
    await page.click("#btnSaveSess");
    await page.click("#btnDemoExit");
    await expect(page.locator("#welcome")).toBeVisible();
    await expect(page.locator("#demoBanner")).toBeHidden();
    await expect(page.locator("#fKwh")).toHaveText("0,0");
    expect(await stored(page, "ev-tracker-demo")).toBeNull();
    expect(await stored(page, "ev-tracker")).toBeNull();
  });

  test("свои записи остаются на месте, а копии в примере недоступны", async ({ page }) => {
    await page.goto("./");
    await page.click("#btnAdd"); // зарядка без настройки машины — приветствие ещё показывается
    await page.fill("#formSess [name=station]", "Своя станция");
    await page.fill("#formSess [name=kwh]", "20");
    await page.fill("#formSess [name=byn]", "13");
    await page.click("#btnSaveSess");
    const mine = await stored(page, "ev-tracker");
    await page.click("#btnDemo");
    await expect(page.locator("#demoBanner")).toBeVisible();
    await page.click("#btnJson");
    await expect(page.locator("#toast")).toContainText("выйдите из примера");
    await page.click("#btnImport");
    await expect(page.locator("#toast")).toContainText("выйдите из примера");
    await expect(page.locator("#bakBanner")).toBeHidden();
    await page.click("#btnDemoExit");
    await expect(page.locator("#fKwh")).toHaveText("20,0");
    expect(await stored(page, "ev-tracker")).toBe(mine);
  });
});

test("зарядки раньше начала учёта не входят в цену и расход на 100 км", async ({ page }) => {
  // попробовал приложение неделю назад, а начало учёта поставил на сегодня
  await page.goto("./");
  await page.click("#btnAdd");
  await page.fill("#formSess [name=ts]", "2026-01-05T12:00");
  await page.fill("#formSess [name=kwh]", "40");
  await page.fill("#formSess [name=byn]", "30");
  await page.click("#btnSaveSess");
  await page.click("#btnStart");
  await page.fill("#formSet [name=startOdo]", "20000");
  await page.fill("#formSet [name=startRange]", "300");
  await page.click("#formSet button[type=submit]");
  await page.click("#btnAdd");
  await page.fill("#formSess [name=kwh]", "30");
  await page.fill("#formSess [name=byn]", "15");
  await page.click("#btnSaveSess");
  await page.click("#btnOdo");
  await page.fill("#formOdo [name=odo]", "20200");
  await page.fill("#formOdo [name=range]", "350");
  await page.click("#formOdo button[type=submit]");
  await expect(page.locator("#fPer100")).toHaveText("6,0");                 // только сегодняшняя: 15 BYN на 250 км
  await expect(page.locator("#fCons")).toHaveText("12,0");
  await expect(page.locator("#perNote")).toContainText("1 зарядка раньше начала учёта");
  expect(num(await page.locator("#regByn").getAttribute("aria-label"))).toBeCloseTo(45, 2); // а в «Потрачено» — обе
});

test("прошлый месяц не меняется от новых зарядок (экономия — по цене на конец месяца)", async ({ page }) => {
  await page.goto("./");
  await importBackup(page);
  await page.click("#btnAllMonths");
  const aug = page.locator(".month", { hasText: "Август 2026" });
  // 90 кВт·ч бесплатно × 0,61 (средняя цена платных на конец августа) ≈ 55
  await expect(aug).toContainText("≈55 BYN");
  const savedBefore = await aug.innerText();
  await page.click("#btnAdd"); // дорогая зарядка сейчас поднимает среднюю цену
  await page.fill("#formSess [name=station]", "Дорогая");
  await page.fill("#formSess [name=kwh]", "50");
  await page.fill("#formSess [name=byn]", "60");
  await page.click("#btnSaveSess");
  await expect(page.locator("#fKwh")).toHaveText("265,3");
  expect(await aug.innerText()).toBe(savedBefore);
});

test("правка «% после» убирает устаревший «% до» из старого трекера", async ({ page }) => {
  await page.goto("./");
  await importJson(page, { settings: { carName: "Проверка", purchaseDate: "2026-08-01", startOdo: 0 },
    sessions: [{ id: "s1", ts: "2026-08-03T18:40", station: "Старое", kwh: 30, byn: 19.5, type: "dc", socFrom: 20, socTo: 80 }] });
  await page.click("[data-tab=sessions]");
  await page.click("#list .sess");
  await page.fill("#formSess [name=socTo]", "100");
  await page.click("#btnSaveSess");
  await expect(page.locator("#list .sess .meta").first()).toContainText("до 100%");
  await expect(page.locator("#list .sess .meta").first()).not.toContainText("20→");
});

test("пример: подсказка для iPhone не советует сохранять копию", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", viewport: { width: 400, height: 860 } });
  const page = await context.newPage();
  await page.goto("./");
  await page.click("#btnDemo");
  await expect(page.locator("#demoBanner")).toBeVisible();
  await expect(page.locator("#iosHint")).toBeVisible();
  await expect(page.locator("#iosHint")).not.toContainText("копию");
  await context.close();
});

test("пример не пропадает, если открыть приложение во второй вкладке; давние остатки убираются", async ({ page, context }) => {
  await page.goto("./");
  await page.click("#btnDemo");
  await expect(page.locator("#demoBanner")).toBeVisible();
  const second = await context.newPage();
  await second.goto("./");
  await expect(second.locator("#welcome")).toBeVisible();     // во второй вкладке — свои данные
  await page.reload();
  await expect(page.locator("#demoBanner")).toBeVisible();     // а пример в первой на месте
  await second.close();
  // остатки примера старше суток (приложение закрыли внутри примера) убираются при запуске
  await page.evaluate(() => { sessionStorage.clear(); localStorage.setItem("ev-tracker-demo-at", String(Date.now() - 2 * 864e5)); });
  await page.reload();
  await expect(page.locator("#welcome")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("ev-tracker-demo"))).toBeNull();
});

test.describe("новый «Обзор»", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    await page.click("#btnDemo");
    await expect(page.locator("#demoBanner")).toBeVisible();
  });

  test("порядок блоков, а цена по типу зарядки — во вкладке «Зарядки»", async ({ page }) => {
    const order = await page.evaluate(() => [...document.querySelectorAll("main > section")].filter(s => !s.hidden).map(s => s.id));
    expect(order).toEqual(["odoSec", "f2fSec", "chartSec", "monthsSec"]);
    await expect(page.locator("#types")).toBeHidden();
    await page.click("[data-tab=sessions]");
    await expect(page.locator("#types")).toBeVisible();
  });

  test("под цифрами одна строка, подробности — по кнопке «Как это считается»", async ({ page }) => {
    await expect(page.locator("#perNote")).toContainText("Цифры на");
    await expect(page.locator("#howNotes")).toBeHidden();
    await page.click("#btnHow");
    await expect(page.locator("#howNotes")).toBeVisible();
    await expect(page.locator("#howNotes")).toContainText("Расход по счётчикам станций");
  });

  test("график по месяцам: метрика, выбор месяца, линия «всего»", async ({ page }) => {
    const bars = page.locator("#chartArea .chart-bars button");
    expect(await bars.count()).toBeGreaterThanOrEqual(4);
    await expect(page.locator("#chartPills button[aria-pressed=true]")).toHaveText("BYN/100 км");
    await expect(page.locator("#chartSel")).toContainText("идёт");            // по умолчанию — текущий месяц
    await expect(page.locator("#chartArea .chart-ref")).toContainText("всего");
    const first = (await bars.first().getAttribute("aria-label")).split(":")[0];
    await bars.first().click();
    await expect(page.locator("#chartSel")).toContainText(first);
    await expect(page.locator("#chartSel")).toContainText("BYN на 100 км");
    await page.click("#chartPills button:has-text('Потрачено')");
    await expect(page.locator("#chartSel")).toContainText(first);             // выбранный месяц остаётся
    await expect(page.locator("#chartSel")).toContainText("BYN на зарядки");
    await expect(page.locator("#chartArea .chart-ref")).toContainText("в среднем");
  });

  test("показаны два последних месяца, остальные — по кнопке", async ({ page }) => {
    await expect(page.locator(".month")).toHaveCount(2);
    const all = page.locator("#btnAllMonths");
    const n = Number((await all.textContent()).match(/\d+/)[0]);
    expect(n).toBeGreaterThanOrEqual(4);
    await all.click();
    await expect(page.locator(".month")).toHaveCount(n);
    await expect(all).toHaveText("Свернуть");
  });
});

test("свой список станций: появляется у поля, фильтруется, подставляет станцию и сумму", async ({ page }) => {
  // встроенный в браузер список (datalist) в Edge на Android не открывается, а над клавиатурой рисует пустые кружки
  await page.goto("./");
  await importBackup(page);
  await page.click("#btnAdd");
  const input = page.locator("#formSess [name=station]");
  expect(await input.getAttribute("list")).toBeNull();
  await expect(page.locator("#stationSug")).toBeHidden();
  await input.focus();
  const items = page.locator("#stationSug button");
  await expect(items.first()).toContainText("Работа");               // последняя по времени — наверху
  expect(await items.count()).toBe(4);                                 // все станции, кроме сбойной
  await expect(page.locator("#stationSug")).toContainText("бесплатно");
  await input.fill("в");                                               // без учёта регистра
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Станция В");
  await items.first().click();
  await expect(input).toHaveValue("Станция В");
  await expect(page.locator("#stationSug")).toBeHidden();
  await page.fill("#formSess [name=kwh]", "10");
  await expect(page.locator("#formSess [name=byn]")).toHaveValue("5,40");
});

test("список станций выпадает поверх формы: поля под ним не сдвигаются, прокрутка своя", async ({ page }) => {
  await page.goto("./");
  await importBackup(page);
  await page.click("#btnAdd");
  const kwh = page.locator("#formSess [name=kwh]");
  const before = (await kwh.boundingBox()).y;
  await page.locator("#formSess [name=station]").focus();
  await expect(page.locator("#stationSug")).toBeVisible();
  expect((await kwh.boundingBox()).y).toBe(before);                 // открыли — поля на месте
  await page.locator("#formSess [name=station]").fill("ст");
  expect((await kwh.boundingBox()).y).toBe(before);                 // отфильтровали — тоже
  const css = await page.locator("#stationSug").evaluate(e => { const c = getComputedStyle(e); return { pos: c.position, overflow: c.overflowY, max: c.maxHeight }; });
  expect(css.pos).toBe("absolute");
  expect(css.overflow).toBe("auto");
  expect(css.max).not.toBe("none");
});

test("при запуске ничего не мелькает: ни приветствие, ни нули вместо цифр", async ({ page }) => {
  // настроенная машина и одна зарядка уже лежат в памяти телефона
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("ev-tracker", JSON.stringify({ schema: 1, docs: {
      "meta/settings": { carName: "Моя", purchaseDate: "2026-08-01", startOdo: 0 },
      "sessions/s1": { ts: "2026-08-03T18:40", station: "А", kwh: 30, byn: 19.5, type: "dc" } } }));
  });
  // следим за экраном с самого начала разбора страницы
  await page.addInitScript(() => {
    window.__flash = [];
    new MutationObserver(() => {
      const w = document.getElementById("welcome"), k = document.getElementById("fKwh");
      if (w && !w.hidden) window.__flash.push("приветствие");
      if (k && k.textContent === "0,0") window.__flash.push("нули");
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  await page.goto("./");
  await expect(page.locator("#fKwh")).toHaveText("30,0");
  expect([...new Set(await page.evaluate(() => window.__flash))]).toEqual([]);
});

test("открытое окно блокирует страницу за ним: она не прокручивается", async ({ page }) => {
  await page.goto("./");
  await page.click("#btnDemo");                       // длинная страница с данными примера
  await expect(page.locator("#demoBanner")).toBeVisible();
  await page.click("#btnAdd");
  await expect(page.locator("#dlgSess")).toBeVisible();
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(200, 30);                     // над затемнением, выше окна
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  const css = await page.evaluate(() => [getComputedStyle(document.documentElement).overflow, getComputedStyle(document.querySelector("#dlgSess .sheet")).overscrollBehaviorY]);
  expect(css).toEqual(["hidden", "contain"]);         // и прокрутка внутри окна не уходит странице
  await page.click("#dlgSess [data-close]");
  await page.mouse.wheel(0, 800);                     // окно закрыто — страница снова прокручивается
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
});

// Минимальное чтение .xlsx в тестах: приложение пишет архив без сжатия, файлы идут подряд
function readStoredZip(buf) {
  const zlib = require("zlib");
  const files = {};
  let p = 0;
  while (buf.readUInt32LE(p) === 0x04034b50) {
    const method = buf.readUInt16LE(p + 8), crc = buf.readUInt32LE(p + 14), size = buf.readUInt32LE(p + 18);
    const nameLen = buf.readUInt16LE(p + 26), extraLen = buf.readUInt16LE(p + 28);
    const name = buf.slice(p + 30, p + 30 + nameLen).toString("utf8");
    const data = buf.slice(p + 30 + nameLen + extraLen, p + 30 + nameLen + extraLen + size);
    expect(method, name).toBe(0);
    if (zlib.crc32) expect(zlib.crc32(data) >>> 0, `CRC ${name}`).toBe(crc);
    files[name] = data.toString("utf8");
    p += 30 + nameLen + extraLen + size;
  }
  expect(buf.readUInt32LE(buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])))).toBe(0x06054b50);
  return files;
}

test("выгрузка в Excel: настоящий .xlsx, листы, числа — числами", async ({ page }) => {
  await page.goto("./");
  await importBackup(page);
  await expect(page.locator("#btnXlsx")).toHaveText("Выгрузить в Excel");
  await expect(page.locator("#btnCsv")).toHaveCount(0);
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#btnXlsx")]);
  expect(download.suggestedFilename()).toMatch(/^zaryadki-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const files = readStoredZip(fs.readFileSync(await download.path()));
  for (const name of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"])
    expect(Object.keys(files)).toContain(name);
  // каждый XML разбирается без ошибок
  const broken = await page.evaluate(xmls => xmls.filter(x => new DOMParser().parseFromString(x, "application/xml").querySelector("parsererror")).length, Object.values(files));
  expect(broken).toBe(0);
  const sheets = [...files["xl/workbook.xml"].matchAll(/<sheet name="([^"]+)"/g)].map(m => m[1]);
  expect(sheets).toEqual(["Зарядки", "Расходы", "Пробег"]);
  const charges = files["xl/worksheets/sheet1.xml"];
  expect((charges.match(/<row /g) || []).length).toBe(backup.sessions.length + 1);   // заголовок + зарядки
  expect(charges).toContain("Дата и время");
  expect(charges).toContain("Станция А");
  // первая зарядка: 3 августа 2026 18:40 → дата Excel 46237,78; 30 кВт·ч и 19,5 BYN — числами, а не текстом
  const row2 = charges.match(/<row r="2">(.*?)<\/row>/)[1];
  expect(row2).toMatch(/<c r="A2" s="2"><v>46237\.77777/);
  expect(row2).toContain('<c r="D2"><v>30</v></c>');
  expect(row2).toContain('<c r="E2"><v>19.5</v></c>');
  const costs = files["xl/worksheets/sheet2.xml"];
  expect((costs.match(/<row /g) || []).length).toBe(backup.costs.length + 1);
  const odo = files["xl/worksheets/sheet3.xml"];
  expect((odo.match(/<row /g) || []).length).toBe(backup.odo.length + 1);
});

test.describe("импорт из Excel и CSV", () => {
  const MM = path.join(__dirname, "fixtures", "moya-mashina-sample.xlsx");   // вымышленный файл в формате «Моей машины»
  const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const sessions = page => page.evaluate(() => Object.entries(JSON.parse(localStorage.getItem("ev-tracker") || '{"docs":{}}').docs)
    .filter(([k]) => k.startsWith("sessions/")).map(([, v]) => v).sort((a, b) => (a.ts < b.ts ? -1 : 1)));
  // кириллица в Windows-1251, как в CSV из старых программ
  const cp1251 = str => Buffer.from([...str].map(ch => { const c = ch.charCodeAt(0);
    if (c < 128) return c; if (c >= 0x410 && c <= 0x44f) return c - 0x350; if (c === 0x401) return 0xa8; if (c === 0x451) return 0xb8;
    throw new Error("нет в cp1251: " + ch); }));

  test("«Моя машина»: распознаётся сама, итог и бензин пропущены, повторно — без дублей", async ({ page }) => {
    await page.goto("./");
    await page.setInputFiles("#fileImport", MM);
    const dlg = page.locator("#dlgXImport");
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText("«Моя машина»");
    await expect(page.locator("#xmap-ts")).toHaveValue("0");          // колонки сопоставлены сами
    await expect(page.locator("#xmap-kwh")).toHaveValue("3");
    await expect(page.locator("#xmap-byn")).toHaveValue("5");
    await expect(dlg).toContainText("Будет добавлено: 5 зарядок");
    await expect(dlg).toContainText("1 строка с топливом пропущена");
    await page.click("#btnXImportOk");
    await expect(page.locator("#fKwh")).toHaveText("188,0");             // 41,5 + 30,2 + 44 + 47,3 + 25
    const s = await sessions(page);
    expect(s).toHaveLength(5);
    expect(s[0]).toMatchObject({ ts: "2026-09-20T09:05", kwh: 25, byn: 17.25, type: "dc", odo: 3640 });
    expect(s[1]).toMatchObject({ ts: "2026-09-25T19:20", kwh: 47.3, type: "ac", socTo: 100 });
    // машина ещё не настроена — предлагаем начало учёта с первой зарядки
    await expect(page.locator("#dlgSet")).toBeVisible();
    await expect(page.locator("#formSet [name=purchaseDate]")).toHaveValue("2026-09-20");
    await expect(page.locator("#formSet [name=startOdo]")).toHaveValue("3640");
    await page.click("#formSet button[type=submit]");
    // тот же файл ещё раз — всё уже есть
    await page.setInputFiles("#fileImport", MM);
    await expect(dlg).toContainText("Будет добавлено: 0");
    await expect(dlg).toContainText("уже есть: 5");
    await expect(page.locator("#btnXImportOk")).toBeDisabled();
  });

  test("CSV из другого приложения: свои колонки, запятые в числах, Windows-1251", async ({ page }) => {
    const csv = "Когда;Где;Энергия;Деньги;Км\r\n05.10.2026 10:00;Офис;12,5;0;5000\r\n06.10.2026 20:30;Дом;30;7,5;5100\r\n";
    await page.goto("./");
    await page.setInputFiles("#fileImport", { name: "other.csv", mimeType: "text/csv", buffer: cp1251(csv) });
    const dlg = page.locator("#dlgXImport");
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText("проверьте колонки");
    await expect(page.locator("#xmap-kwh option", { hasText: "Энергия" })).toHaveCount(1);   // заголовки прочитаны в верной кодировке
    await page.selectOption("#xmap-ts", { label: "Когда" });
    await page.selectOption("#xmap-kwh", { label: "Энергия" });
    await page.selectOption("#xmap-byn", { label: "Деньги" });
    await page.selectOption("#xmap-station", { label: "Где" });
    await page.selectOption("#xmap-odo", { label: "Км" });
    await expect(dlg).toContainText("Будет добавлено: 2 зарядки");
    await expect(page.locator("#xiPreview")).toContainText("Офис");
    await page.click("#btnXImportOk");
    await expect(page.locator("#fKwh")).toHaveText("42,5");
    const s = await sessions(page);
    expect(s[0]).toMatchObject({ ts: "2026-10-05T10:00", station: "Офис", kwh: 12.5, byn: 0, odo: 5000 });
    expect(s[1]).toMatchObject({ ts: "2026-10-06T20:30", station: "Дом", kwh: 30, byn: 7.5 });
  });

  test("свой файл Excel загружается обратно сам, один в один", async ({ page }) => {
    await page.goto("./");
    await importBackup(page);
    const [d] = await Promise.all([page.waitForEvent("download"), page.click("#btnXlsx")]);
    const buffer = fs.readFileSync(await d.path());
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.setInputFiles("#fileImport", { name: "zaryadki.xlsx", mimeType: XLSX, buffer });
    const dlg = page.locator("#dlgXImport");
    await expect(dlg).toContainText("этого приложения");
    await expect(dlg).toContainText(`Будет добавлено: ${backup.sessions.length} зарядок`);
    await page.click("#btnXImportOk");
    const s = await sessions(page);
    const pick = x => ({ ts: x.ts, station: x.station || "", kwh: x.kwh, byn: x.byn, type: x.type, odo: x.odo ?? null, socTo: x.socTo ?? null, kwhBat: x.kwhBat ?? null });
    expect(s.map(pick)).toEqual(backup.sessions.slice().sort((a, b) => (a.ts < b.ts ? -1 : 1)).map(pick));
  });

  test("файл из Excel или Google Таблиц: общие строки, цена перед кВт·ч, «Топливо» и дизель «ДТ»", async ({ page }) => {
    // вымышленный файл: общие строки (заголовок «Пробег» из двух кусков форматирования), связи с префиксом ns1,
    // даты числами Excel со встроенным форматом, «Цена за кВт·ч» стоит раньше «кВт·ч», строка «ДТ»
    await page.goto("./");
    await page.setInputFiles("#fileImport", path.join(__dirname, "fixtures", "excel-shared-strings.xlsx"));
    const dlg = page.locator("#dlgXImport");
    await expect(dlg).toBeVisible();
    await expect(page.locator("#xmap-ts")).toHaveValue("0");
    await expect(page.locator("#xmap-kwh")).toHaveValue("2");          // не «Цена за кВт·ч»
    await expect(page.locator("#xmap-byn")).toHaveValue("3");
    await expect(page.locator("#xmap-type")).toHaveValue("4");         // «Топливо»
    await expect(page.locator("#xmap-odo")).toHaveValue("5");          // «Про» + «бег»
    await expect(dlg).toContainText("Будет добавлено: 3 зарядки");
    await expect(dlg).toContainText("1 строка с топливом пропущена");  // «ДТ»
    await page.click("#btnXImportOk");
    const s = await sessions(page);
    expect(s.map(x => [x.ts, x.kwh, x.byn, x.type, x.odo])).toEqual([
      ["2026-10-05T07:30", 40, 14.4, "ac", 12000],
      ["2026-10-06T19:30", 30, 20.7, "dc", 12210],
      ["2026-10-08T09:00", 25.5, 9.18, "ac", 12550],
    ]);
  });

  test("английский CSV: тысячи через запятую, время в UTC, американские даты — предупреждение", async ({ page }) => {
    const csv = 'Date,Station,kWh,Cost,Odometer\n' +
      '2026-10-05 10:00,Home,12.5,4.50,"12,345"\n' +
      '2026-10-06T17:30:00Z,Mall,30.25,"1,020.75","12,500"\n' +   // в Минске это 20:30
      '10/13/2026 07:00,Home,10,3.60,"12,610"\n';                 // месяц/день — пропускается с предупреждением
    await page.goto("./");
    await page.setInputFiles("#fileImport", { name: "en.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    const dlg = page.locator("#dlgXImport");
    await expect(dlg).toContainText("Будет добавлено: 2 зарядки");
    await expect(dlg).toContainText("американском формате");
    await page.click("#btnXImportOk");
    const s = await sessions(page);
    expect(s.map(x => [x.ts, x.kwh, x.byn, x.odo])).toEqual([
      ["2026-10-05T10:00", 12.5, 4.5, 12345],
      ["2026-10-06T20:30", 30.25, 1020.75, 12500],
    ]);
  });

  test("Excel виден в окне выбора файла, а в старом браузере — понятное сообщение", async ({ page }) => {
    await page.addInitScript(() => { delete window.DecompressionStream; });
    await page.goto("./");
    expect(await page.locator("#fileImport").getAttribute("accept")).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    await page.setInputFiles("#fileImport", MM);                        // внутри сжат — без DecompressionStream не открыть
    await expect(page.locator("#toast")).toContainText("CSV");
    await expect(page.locator("#dlgXImport")).toBeHidden();
  });

  test("повтором считается та же зарядка, внесённая вручную в другое время и с копейкой разницы", async ({ page }) => {
    // как на скриншоте владельца: «Дом» 10:33, 49,40 кВт·ч, 17,79 BYN, 9 577 км — и из «Моей машины» 07:37, 17,78 BYN
    await page.goto("./");
    await importJson(page, { settings: { carName: "Моя", purchaseDate: "2026-09-01", startOdo: 3000 }, sessions: [
      { id: "m1", ts: "2026-10-12T10:33", station: "Дом", kwh: 41.5, byn: 14.95, type: "ac", odo: 4630, socTo: 100 },   // тот же пробег
      { id: "m2", ts: "2026-10-07T20:00", station: "ТЦ", kwh: 30.2, byn: 20.85, type: "dc" },                         // та же дата, сумма ±0,01
    ] });
    await page.setInputFiles("#fileImport", MM);
    const dlg = page.locator("#dlgXImport");
    await expect(dlg).toContainText("Будет добавлено: 3 зарядки, уже есть: 2");
    await page.click("#btnXImportOk");
    const s = await sessions(page);
    expect(s).toHaveLength(5);
    expect(s.filter(x => x.station === "Дом")).toHaveLength(1);    // ручная запись осталась, дубля нет
  });

  test("выгрузка домашней зарядки без колонки типа: английские заголовки сами, тип AC/DC выбирается", async ({ page }) => {
    // вымышленный файл в формате приложения домашней зарядки (как прислали в чате)
    const csv = "Device Name,SN,Start Time,End Time,Duration,Electricity (kWh),Fee,Authorized\n" +
      "Wallbox,WB0001,2026-10-01 22:00:00,2026-10-02 05:00:00,07:00:00,30.5,9.15,Yes\n" +
      "Wallbox,WB0001,2026-10-04 23:10:00,2026-10-05 04:40:00,05:30:00,24.25,7.28,Yes\n";
    await page.goto("./");
    await page.setInputFiles("#fileImport", { name: "Charging Records.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    const dlg = page.locator("#dlgXImport");
    await expect(page.locator("#xmap-ts")).toHaveValue("2");         // Start Time, не End Time и не Duration
    await expect(page.locator("#xmap-kwh")).toHaveValue("5");
    await expect(page.locator("#xmap-byn")).toHaveValue("6");        // Fee
    await expect(page.locator("#xmap-station")).toHaveValue("0");    // Device Name
    await expect(page.locator("#xiTypeWrap")).toBeVisible();          // колонки с типом нет — выбор для всех строк
    await expect(page.locator("#xiTypeSeg [data-t=ac]")).toHaveAttribute("aria-pressed", "true");
    await page.click("#xiTypeSeg [data-t=dc]");
    await expect(dlg).toContainText("Будет добавлено: 2 зарядки");
    await page.click("#btnXImportOk");
    const s = await sessions(page);
    expect(s.map(x => [x.ts, x.station, x.kwh, x.byn, x.type])).toEqual([
      ["2026-10-01T22:00", "Wallbox", 30.5, 9.15, "dc"],
      ["2026-10-04T23:10", "Wallbox", 24.25, 7.28, "dc"],
    ]);
  });

  test("выбор типа не мешает, когда колонка типа есть и всё распознано", async ({ page }) => {
    await page.goto("./");
    await page.setInputFiles("#fileImport", MM);
    await expect(page.locator("#dlgXImport")).toBeVisible();
    await expect(page.locator("#xiTypeWrap")).toBeHidden();
  });

  test("импорт можно отменить", async ({ page }) => {
    await page.goto("./");
    await importBackup(page);
    await page.setInputFiles("#fileImport", MM);
    await page.click("#btnXImportOk");
    await expect(page.locator("#undoBanner")).toBeVisible();
    await expect(page.locator("#undoBanner")).toContainText("Зарядки добавлены");
    await page.click("#btnUndo");
    expect(await sessions(page)).toHaveLength(backup.sessions.length);
  });
});

test.describe("режим гибрида с розеткой", () => {
  // Вымышленный гибрид: 3 заправки (первая и последняя — «полный бак»), 2 зарядки между ними, 1 000 км от бака до бака
  const HYB = {
    exportedAt: "2026-08-06T10:00:00.000Z",
    settings: { carName: "Гибрид", purchaseDate: "2026-07-01", startOdo: 10000, powertrain: "phev" },
    sessions: [
      { id: "c1", ts: "2026-07-10T20:00", station: "Дом", kwh: 50, byn: 15, type: "ac" },
      { id: "c2", ts: "2026-07-25T21:00", station: "Дом", kwh: 40, byn: 12, type: "ac" },
    ],
    fuel: [
      { id: "f1", ts: "2026-07-01T09:00", station: "АЗС у дома", liters: 40, byn: 100, odo: 10000, full: true },
      { id: "f2", ts: "2026-07-20T10:00", station: "АЗС на трассе", liters: 20, byn: 52, odo: 10600, full: false },
      { id: "f3", ts: "2026-08-05T11:00", station: "АЗС у дома", liters: 30, byn: 78, odo: 11000, full: true },
    ],
  };
  const docs = page => page.evaluate(() => JSON.parse(localStorage.getItem("ev-tracker")).docs);

  test("настройка: «Гибрид с розеткой» прячет поля электромобиля и сохраняется", async ({ page }) => {
    await page.goto("./");
    await page.click("#btnStart");
    const set = page.locator("#dlgSet");
    await expect(set.locator("[name=capKwh]")).toBeVisible();
    await page.click("#ptSeg [data-p=phev]");
    for (const n of ["startRange", "carCons", "capKwh"]) await expect(set.locator(`[name=${n}]`)).toBeHidden();
    await expect(set).toContainText("зарядили и заправили");
    await page.fill("#formSet [name=startOdo]", "1000");
    await page.click("#formSet button[type=submit]");
    expect((await docs(page))["meta/settings"].powertrain).toBe("phev");
    await page.click("#btnSettings");
    await expect(page.locator("#ptSeg [data-p=phev]")).toHaveAttribute("aria-pressed", "true");
    await page.click("#ptSeg [data-p=ev]");
    await expect(set.locator("[name=capKwh]")).toBeVisible();
  });

  test("обзор: цена от полного бака до полного, литры и кВт·ч на 100 км пути, доля электричества", async ({ page }) => {
    await page.goto("./");
    await importJson(page, HYB);
    await expect(page.locator("#regLabel")).toHaveText("Потрачено на энергию");
    expect(num(await page.locator("#regByn").getAttribute("aria-label"))).toBeCloseTo(257, 2);   // 27 зарядки + 230 бензин
    await expect(page.locator("#eSplit")).toContainText("зарядки 27,00");
    await expect(page.locator("#eSplit")).toContainText("бензин 230,00");
    // окно f1 → f3: бензин 52 + 78, зарядки 15 + 12 = 157 BYN на 1 000 км
    await expect(page.locator("#fPer100")).toHaveText("15,7");
    await expect(page.locator("#fCons")).toHaveText("11%");          // 27 из 257 — электричество
    await expect(page.locator("#fPrice")).toHaveText("5,0 л");       // 50 л на 1 000 км
    await expect(page.locator("#fKm")).toHaveText("9,0 кВт·ч");      // 90 кВт·ч на 1 000 км
    await expect(page.locator("#fKwh")).toHaveText("1 000");         // км проехано
    await expect(page.locator(".figs")).toContainText("денег — на электричество");
    await expect(page.locator("#perNote")).toContainText("от полного бака до полного: 1 отрезок, 1 000 км");
    await expect(page.locator("#f2fSec")).toBeHidden();               // «реальный запас» гибриду не показываем
    await page.click("#btnOdo");
    await expect(page.locator("#formOdo [name=range]")).toBeHidden(); // запас хода гибриду не нужен
  });

  test("пока полных баков меньше двух — «≈ по всем записям»", async ({ page }) => {
    await page.goto("./");
    await importJson(page, { ...HYB, fuel: HYB.fuel.map(f => ({ ...f, full: f.id === "f1" })) });
    await expect(page.locator("#fPer100")).toHaveText("≈25,7");      // все деньги 257 на все 1 000 км
    await expect(page.locator("#perNote")).toContainText("две заправки «полный бак»");
  });

  test("кнопки «+ Зарядка» и «+ Заправка», сумма по цене литра, список «Зарядки и заправки» с фильтром", async ({ page }) => {
    await page.goto("./");
    await importJson(page, HYB);
    await expect(page.locator("#btnAdd")).toHaveText("+ Зарядка");
    await expect(page.locator("#btnAddFuel")).toBeVisible();
    await page.click("#btnAddFuel");
    const f = page.locator("#formFuel");
    await expect(f.locator("[name=full]")).toBeChecked();
    await f.locator("[name=station]").focus();
    await expect(page.locator("#fuelSug button").first()).toContainText("АЗС у дома");   // последняя АЗС — наверху
    await page.locator("#fuelSug button", { hasText: "АЗС у дома" }).click();
    await expect(page.locator("#fuelHint")).toContainText("2,60");                         // 78 BYN за 30 л
    await f.locator("[name=liters]").fill("10");
    await expect(f.locator("[name=byn]")).toHaveValue("26,00");
    await f.locator("[name=odo]").fill("11200");
    await page.click("#btnSaveFuel");
    const fuel = Object.entries(await docs(page)).filter(([k]) => k.startsWith("fuel/")).map(([, v]) => v);
    expect(fuel).toHaveLength(4);
    expect(fuel.find(x => x.odo === 11200)).toMatchObject({ station: "АЗС у дома", liters: 10, byn: 26, full: true });
    await page.click("[data-tab=sessions]");
    await expect(page.locator("#listTitle")).toHaveText("Зарядки и заправки");
    await expect(page.locator("#azsStats")).toContainText("АЗС на трассе");
    await expect(page.locator("#list .sess")).toHaveCount(6);
    await page.click("#listPills button:has-text('Заправки')");
    await expect(page.locator("#list .sess")).toHaveCount(4);
    await expect(page.locator("#list .sess").first()).toContainText("бензин");
    await page.locator("#list .sess").first().click();                                    // правка и удаление заправки
    await expect(page.locator("#fuelTitle")).toHaveText("Заправка");
    await page.click("#btnFuelDel"); await page.click("#btnFuelDel");
    await expect(page.locator("#list .sess")).toHaveCount(3);
  });

  test("график и месяц: «Потрачено» двумя цветами, литры на 100 км пути", async ({ page }) => {
    await page.goto("./");
    await importJson(page, HYB);
    await expect(page.locator("#chartPills button")).toHaveText(["BYN/100 км", "Потрачено", "л/100 км пути"]);
    await page.click("#chartPills button:has-text('Потрачено')");
    await expect(page.locator("#chartArea .stk i.fuel").first()).toBeAttached();
    await page.locator("#chartArea .chart-bars button").first().click();
    await expect(page.locator("#chartSel")).toContainText("бензин");
    await page.click("#btnAllMonths");
    const jul = page.locator(".month", { hasText: "Июль 2026" });
    await expect(jul).toContainText("денег — на электричество");
    await expect(jul).toContainText("бензина на 100 км пути");
  });

  test("копия и Excel: заправки и тип машины сохраняются", async ({ page }) => {
    await page.goto("./");
    await importJson(page, HYB);
    const [json] = await Promise.all([page.waitForEvent("download"), page.click("#btnJson")]);
    const saved = JSON.parse(fs.readFileSync(await json.path(), "utf8"));
    expect(saved.settings.powertrain).toBe("phev");
    expect(saved.fuel).toHaveLength(3);
    expect(saved.fuel.find(x => x.id === "f3")).toMatchObject({ liters: 30, byn: 78, odo: 11000, full: true });
    const [x] = await Promise.all([page.waitForEvent("download"), page.click("#btnXlsx")]);
    const files = readStoredZip(fs.readFileSync(await x.path()));
    expect([...files["xl/workbook.xml"].matchAll(/<sheet name="([^"]+)"/g)].map(m => m[1])).toEqual(["Зарядки", "Заправки", "Расходы", "Пробег"]);
    expect((files["xl/worksheets/sheet2.xml"].match(/<row /g) || []).length).toBe(4);
    // непонятный тип машины в копии — электромобиль
    await importJson(page, { ...HYB, settings: { ...HYB.settings, powertrain: "rocket" } });
    await page.click("#btnImportOk");
    expect((await docs(page))["meta/settings"].powertrain).toBeUndefined();
  });

  test("импорт «Моей машины» в режиме гибрида: строки с бензином становятся заправками", async ({ page }) => {
    await page.goto("./");
    await importJson(page, { settings: { carName: "Гибрид", purchaseDate: "2026-09-01", startOdo: 3500, powertrain: "phev" }, sessions: [] });
    await page.setInputFiles("#fileImport", path.join(__dirname, "fixtures", "moya-mashina-sample.xlsx"));
    await expect(page.locator("#dlgXImport")).toContainText("Будет добавлено: 5 зарядок и 1 заправка");
    await page.click("#btnXImportOk");
    const fuel = Object.entries(await docs(page)).filter(([k]) => k.startsWith("fuel/")).map(([, v]) => v);
    expect(fuel).toEqual([{ ts: "2026-09-28T12:10", station: "", liters: 20, byn: 52, odo: 3985, full: false }]);
  });
});

test.describe("удаление всех данных", () => {
  const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem("ev-tracker") || '{"docs":{}}').docs);

  test("в настройках: окно с цифрами, удаление двумя нажатиями, «Вернуть как было»", async ({ page }) => {
    await page.goto("./");
    await importBackup(page);
    await page.click("#btnSettings");
    await page.click("#btnWipe");
    const dlg = page.locator("#dlgWipe");
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText("7 зарядок");
    await expect(dlg).toContainText("настройки машины");
    await expect(page.locator("#btnWipeBackup")).toBeVisible();          // предлагаем сначала сохранить копию
    await page.click("#btnWipeOk");
    await expect(page.locator("#btnWipeOk")).toHaveText("Точно удалить всё?");
    expect(Object.keys(await stored(page)).length).toBeGreaterThan(0);   // одно нажатие ничего не удаляет
    await page.click("#btnWipeOk");
    await expect(dlg).toBeHidden();
    await expect(page.locator("#welcome")).toBeVisible();
    await expect(page.locator("#fKwh")).toHaveText("0,0");
    expect(await stored(page)).toEqual({});
    await expect(page.locator("#undoBanner")).toContainText("Данные удалены");
    await page.click("#btnUndo");
    await expect(page.locator("#carName")).toHaveText(backup.settings.carName);
    expect(Object.keys(await stored(page)).filter(k => k.startsWith("sessions/"))).toHaveLength(backup.sessions.length);
  });

  test("на пустом телефоне и в примере кнопки нет", async ({ page }) => {
    await page.goto("./");
    await page.click("#btnStart");
    await expect(page.locator("#btnWipe")).toBeHidden();
    await page.click("#dlgSet [data-close]");
    await page.click("#btnDemo");
    await expect(page.locator("#demoBanner")).toBeVisible();
    await page.click("#btnSettings");
    await expect(page.locator("#btnWipe")).toBeHidden();
  });
});

test("подписи: км — с начала учёта, электричество — заряжено", async ({ page }) => {
  // отзыв из чата: «км проехано» путали с пробегом машины, «кВт·ч залито» звучит как про бензин
  await page.goto("./");
  await importBackup(page);
  const labels = await page.locator(".figs .fig small").allTextContents();
  expect(labels).toContain("км пройдено");
  expect(labels).toContain("кВт·ч заряжено");
  expect(labels.join(" ")).not.toMatch(/проехано|залито/);
});

test.describe("тема в настройках", () => {
  const LIGHT = "rgb(228, 232, 236)", DARK = "rgb(18, 22, 27)";
  const bg = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const meta = page => page.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map(m => m.content));

  test("светлая при тёмном телефоне: видно сразу, «Отмена» возвращает, «Сохранить» запоминает", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("./");
    await importBackup(page);
    await expect.poll(() => bg(page)).toBe(DARK);
    await page.click("#btnSettings");
    await expect(page.locator('#themeSeg [data-th=""]')).toHaveAttribute("aria-pressed", "true");   // по умолчанию — как в телефоне
    await page.click("#themeSeg [data-th=light]");
    await expect.poll(() => bg(page)).toBe(LIGHT);
    await page.click("#dlgSet [data-close]");
    await expect.poll(() => bg(page)).toBe(DARK);
    await page.click("#btnSettings");
    await page.click("#themeSeg [data-th=light]");
    await page.click("#formSet button[type=submit]");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect.poll(() => bg(page)).toBe(LIGHT);
    expect(await meta(page)).toEqual(["#E4E8EC", "#E4E8EC"]);   // полоса браузера над страницей — тоже светлая
    await page.goto("./privacy.html");
    await expect.poll(() => bg(page)).toBe(LIGHT);
  });

  test("тёмная при светлом телефоне, и обратно «Как в телефоне»", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("./");
    await importBackup(page);
    await page.click("#btnSettings");
    await page.click("#themeSeg [data-th=dark]");
    await page.click("#formSet button[type=submit]");
    await page.reload();
    await expect.poll(() => bg(page)).toBe(DARK);
    expect(await meta(page)).toEqual(["#12161B", "#12161B"]);
    await page.click("#btnSettings");
    await expect(page.locator("#themeSeg [data-th=dark]")).toHaveAttribute("aria-pressed", "true");
    await page.click('#themeSeg [data-th=""]');
    await page.click("#formSet button[type=submit]");
    await page.reload();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /./);
    await expect.poll(() => bg(page)).toBe(LIGHT);
    expect(await meta(page)).toEqual(["#E4E8EC", "#12161B"]);
  });
});

test("одно изменение — одна перерисовка экрана", async ({ page }) => {
  // раньше каждая коллекция перерисовывала экран сама — 9 раз подряд на любое сохранение
  await page.addInitScript(() => {
    window.__renders = 0;   // «—» в #since — это сама страница, ещё без данных: не считается
    new MutationObserver(recs => { for (const r of recs) if (r.target.id === "since" && r.addedNodes[0]?.textContent !== "—") window.__renders++; })
      .observe(document, { subtree: true, childList: true });
  });
  await page.goto("./");
  await expect(page.locator("#since")).not.toHaveText("—");
  expect(await page.evaluate(() => window.__renders)).toBe(1);
  await page.click("#btnStart");
  await page.fill("#formSet [name=carName]", "Другая");
  await page.fill("#formSet [name=startOdo]", "0");
  await page.click("#formSet button[type=submit]");
  await expect(page.locator("#carName")).toHaveText("Другая");
  expect(await page.evaluate(() => window.__renders)).toBe(2);
});

test("окна «возвратов» больше нет, а старые возвраты из копии сохраняются", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#dlgRef")).toHaveCount(0);
  const withRefund = { ...backup, refunds: [{ id: "r1", byn: 10, date: "2026-08-05", note: "поездка" }] };
  await page.setInputFiles("#fileImport", { name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(withRefund)) });
  await expect(page.locator("#fKwh")).not.toHaveText("0,0");
  const docs = await page.evaluate(() => JSON.parse(localStorage.getItem("ev-tracker")).docs);
  expect(docs["refunds/r1"]).toMatchObject({ byn: 10, note: "поездка" });
});

test("значки: размеры как в manifest, у значков для iPhone и Android-маски нет прозрачных углов, все — в офлайн-кэше", async ({ page }) => {
  // iPhone закрашивает прозрачные углы чёрным, Android сам вырезает форму из маскируемого значка
  await page.goto("./");
  const icons = await page.evaluate(async () => {
    const m = await (await fetch("manifest.webmanifest")).json();
    const load = src => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error(src)); i.src = src; });
    const cornerAlpha = i => { const c = document.createElement("canvas"); c.width = i.naturalWidth; c.height = i.naturalHeight; const x = c.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, 1, 1).data[3]; };
    const list = [...m.icons.map(ic => ({ src: ic.src, sizes: ic.sizes, kind: ic.purpose || "any" })),
      { src: document.querySelector('link[rel="apple-touch-icon"]').getAttribute("href"), sizes: "180x180", kind: "apple" }];
    for (const ic of list) { const i = await load(ic.src); ic.real = `${i.naturalWidth}x${i.naturalHeight}`; ic.alpha = cornerAlpha(i); }
    return list;
  });
  for (const ic of icons) expect(ic.real, ic.src).toBe(ic.sizes);
  expect(icons.find(ic => ic.kind === "maskable").alpha).toBe(255);
  expect(icons.find(ic => ic.kind === "apple").alpha).toBe(255);
  const sw = fs.readFileSync(path.join(__dirname, "..", "app", "sw.js"), "utf8");
  for (const f of fs.readdirSync(path.join(__dirname, "..", "app", "icons"))) expect(sw, f).toContain(`"icons/${f}"`);
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
