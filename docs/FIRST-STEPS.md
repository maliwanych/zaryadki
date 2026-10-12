# Первые шаги: Claude Code + Git + GitHub Pages

Шаги для владельца проекта, один раз.

## 1. Открыть проект в Claude Code

Откройте папку `Projects\zaryadki` в Claude Code (вкладка Code в приложении Claude или `claude` в терминале в этой папке). Первое сообщение можно такое:

> Прочитай CLAUDE.md и docs/FIRST-STEPS.md. Помоги выполнить шаги 2–4: перенести ci/deploy.yml в .github/workflows, создать git-репозиторий, сделать первый коммит и выложить на GitHub. Объясняй каждую команду.

## 2. Git-репозиторий и первый коммит

Сначала одно действие с файлом: настройка автопубликации лежит в `ci/deploy.yml`, а GitHub ищет её в `.github/workflows/`. Её туда не удалось положить снаружи — эту папку защищают от записи со стороны. Попросите Claude Code перенести:

```
mkdir -p .github/workflows
git mv ci/deploy.yml .github/workflows/deploy.yml   # или просто перенести файл, если git ещё не инициализирован
```

Затем Claude Code выполнит (и объяснит):

```
git init -b main
git add .
git commit -m "Первая версия приложения 1.0.0"
```

Перед коммитом проверьте `git status`: в списке не должно быть файлов `*backup*.json` — это ваши личные данные.

## 3. Репозиторий на GitHub

1. github.com → «+» → New repository → имя **zaryadki**, **Public**, без галочек → Create.
2. Связать и отправить:
   ```
   git remote add origin https://github.com/maliwanych/zaryadki.git
   git push -u origin main
   ```

## 4. Включить публикацию

1. В репозитории: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Вкладка **Actions**: после push запустится «Тесты и публикация». Зелёная галочка — всё прошло. Если первый запуск был до включения Pages и упал на публикации — нажмите «Re-run all jobs».
3. Адрес приложения: `https://maliwanych.github.io/zaryadki/`.

## 5. Телефон и перенос данных

1. Откройте адрес в Chrome на телефоне → ⋮ → «Установить приложение».
2. Перешлите на телефон файл резервной копии (лежит в `Projects\zaryadki-data`, не в репозитории) — например, себе в Telegram.
3. В приложении: «Загрузить копию» → выберите файл.

## Дальше — обычный цикл работы

1. Попросите Claude Code изменение.
2. `npm test` — автотесты.
3. Поднять версию (см. CLAUDE.md → «Выпуск новой версии»), коммит, `git push`.
4. Через пару минут на телефоне появится «Доступна новая версия».
