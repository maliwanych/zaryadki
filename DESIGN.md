---
name: Зарядки
description: Учёт зарядок электромобиля — спокойная приборная панель для телефона
colors:
  instrument-plate: "#E4E8EC"
  panel-grey: "#F4F6F8"
  graphite-ink: "#18202B"
  slate-muted: "#5B6673"
  hairline: "#CBD2D9"
  field-white: "#FFFFFF"
  drum-black: "#161A20"
  drum-numeral: "#F2F4F6"
  signal-red: "#C21F2B"
  ac-blue: "#3A68A0"
  fuel-amber: "#D9822B"
  fuel-button: "#AD5F1A"
  free-green: "#3E9B6A"
  night-plate: "#12161B"
  night-panel: "#1B2027"
  night-ink: "#E7EBEF"
  night-muted: "#8D98A5"
  night-hairline: "#2C343E"
  night-field: "#232932"
  night-drum: "#050608"
  night-signal-red: "#E3505A"
  night-red-text: "#F07178"
  night-ac-blue: "#78A2D8"
  night-dc-grey: "#C9D1DA"
  night-fuel: "#E8A04F"
  scrim: "rgba(0,0,0,.45)"
typography:
  display:
    fontFamily: "Onest, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "38px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  headline:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
    fontFeature: "tnum"
  title:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.45
  body:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  label:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  display-small:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  display-separator:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1
  figure-large:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: "tnum"
  headline-small:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
    fontFeature: "tnum"
  figure:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.25
    fontFeature: "tnum"
  title-small:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.45
  body-small:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
  micro:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  tick: "3px"
  drum: "4px"
  bar: "5px"
  chart-bar: "6px"
  inset: "8px"
  control: "10px"
  row: "12px"
  card: "14px"
  sheet: "18px"
  pill: "999px"
spacing:
  hairline-gap: "1px"
  tight: "6px"
  sm: "10px"
  md: "12px"
  card: "14px"
  gutter: "16px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.graphite-ink}"
    textColor: "{colors.instrument-plate}"
    rounded: "{rounded.control}"
    padding: "13px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.field-white}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.control}"
    padding: "13px"
    height: "44px"
  button-add:
    backgroundColor: "{colors.graphite-ink}"
    textColor: "{colors.instrument-plate}"
    rounded: "{rounded.row}"
    padding: "15px"
  button-add-fuel:
    backgroundColor: "{colors.fuel-button}"
    textColor: "{colors.field-white}"
    rounded: "{rounded.row}"
    padding: "15px"
  link-button:
    textColor: "{colors.ac-blue}"
    height: "44px"
  card:
    backgroundColor: "{colors.panel-grey}"
    rounded: "{rounded.card}"
    padding: "14px"
  input:
    backgroundColor: "{colors.field-white}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  pill:
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
    height: "44px"
  pill-selected:
    backgroundColor: "{colors.graphite-ink}"
    textColor: "{colors.instrument-plate}"
    rounded: "{rounded.pill}"
  segment-selected:
    backgroundColor: "{colors.graphite-ink}"
    textColor: "{colors.instrument-plate}"
    rounded: "{rounded.control}"
    height: "44px"
  drum:
    backgroundColor: "{colors.drum-black}"
    textColor: "{colors.drum-numeral}"
    typography: "{typography.display}"
    rounded: "{rounded.drum}"
    height: "52px"
  drum-decimal:
    backgroundColor: "{colors.signal-red}"
    textColor: "{colors.field-white}"
    typography: "{typography.display}"
    rounded: "{rounded.drum}"
    height: "52px"
---

# Design System: Зарядки

## Overview

**Creative North Star: "Приборная панель"**

Интерфейс читается, как панель машины: спокойный светло-серый «щиток» (тёмный графит ночью), крупные цифры и единственный сигнальный красный. Человек открывает приложение у зарядной станции, одной рукой, и за секунду видит главное: сколько потрачено и сколько стоит километр. Всё остальное — тихие карточки и подписи, которые не спорят с цифрами.

Плотность средняя: один столбец до 560 px, крупная главная кнопка внизу, карточки с тонкой рамкой без теней. Характер компонентов — «спокойно и точно»: ничего не кричит, одна тёмная главная кнопка, остальные действия — контур или синий текст. Узнаваемая деталь — механический счётчик с барабанами на «Обзоре», тот же мотив, что в значке приложения.

Подтверждённые запреты: никаких градиентов и неонового свечения «под электричество» и никакого игрового стиля (маскоты, эмодзи, конфетти).

**Key Characteristics:**
- Цифры — главный герой: моноширинные цифры (`tnum`) везде, барабаны — только у счётчика потраченного.
- Один сигнальный красный: копейки на барабанах, «Трасса», предупреждения и удаление.
- Плоские слои тона вместо теней: щиток → карточка → поле.
- Сквозной цветовой код зарядок: AC — синий, DC — графит, трасса — красный, бесплатно — зелёный, бензин — янтарный.
- Две полноценные темы: светлая и тёмная, плюс «как в телефоне».

## Colors

Холодная серая гамма приборной панели с одним сигнальным красным и функциональными цветами типов зарядки.

### Primary
- **Graphite Ink** (graphite-ink): основной текст и заливка главной кнопки, выбранные таблетки и сегменты; в цветовом коде — DC-зарядки. Ночью — **Night Ink** (night-ink) для текста и светлая главная кнопка.
- **Signal Red** (signal-red): копейки на барабанах, «Трасса» в графиках и полосках, рамка предупреждающей плашки; заливка кнопки «Удалить всё» — в обеих темах (белый на нём 5,6 : 1). Ночью копейки и «Трасса» — **Night Signal Red** (night-signal-red).

### Secondary
- **AC Blue** (ac-blue): AC-зарядки в графиках и полосках, ссылки-кнопки («Настройки», «Обновить», «Как это считается»), рамка фокуса, «стало лучше» в сравнении месяцев. Ночью — **Night AC Blue** (night-ac-blue).
- **Fuel Amber** (fuel-amber): всё про бензин в режиме гибрида; кнопка «+ Заправка» — более тёмный **Fuel Button** (fuel-button), чтобы белый текст держал контраст.
- **Free Green** (free-green): бесплатные зарядки — полоска в списке, доля типов, легенды.

### Neutral
- **Instrument Plate** (instrument-plate): фон страницы — «щиток»; он же фон экрана запуска и значка.
- **Panel Grey** (panel-grey): карточки, листы снизу.
- **Field White** (field-white): поля ввода и вторичные кнопки.
- **Hairline** (hairline): рамки карточек, разделители, щели между цифрами сетки.
- **Slate Muted** (slate-muted): подписи, пояснения, неактивные вкладки.
- **Drum Black** (drum-black) и **Drum Numeral** (drum-numeral): барабаны счётчика.
- Ночные пары: Night Plate, Night Panel, Night Field, Night Hairline, Night Muted, Night Drum, Night DC Grey (DC в тёмной теме), Night Fuel.

### Named Rules
**The Signal Red Rule.** Красный — только сигнал: копейки на барабанах, «Трасса», предупреждения и удаление. Не для украшения и не для акцента «просто так». Красный текст в тёмной теме — Night Red Text (night-red-text), заливки — Night Signal Red.

**The Charge Colour Code Rule.** AC — синий, DC — графит (ночью — светло-серый), трасса — красный, бесплатно — зелёный, бензин — янтарный. Один и тот же код в графике, полосках списка, долях и легендах; новый экран не вводит своих цветов для типов.

## Typography

**Display Font:** Onest (с system-ui, -apple-system, Segoe UI, Roboto)
**Body Font:** Onest
**Label/Mono Font:** Onest с моноширинными цифрами (`font-variant-numeric: tabular-nums` на всём `body`)

**Character:** один современный гротеск с кириллицей, свой файл в app/fonts (без обращений к чужим сайтам). Иерархию держат размер и вес цифр, а не смена гарнитур.

### Hierarchy
- **Display** (600, 38px, 1): цифры на барабанах счётчика; малый счётчик — 23px.
- **Headline** (600, 22px, 1.2): значения в сетке цифр «Обзора»; крупный реальный запас хода — 700, 30px.
- **Title** (600, 17px): заголовки разделов и месяцев, заголовки листов, главная кнопка (17px).
- **Body** (400, 16px, 1.45): основной текст, названия станций, поля ввода (17px — чтобы телефон не увеличивал страницу при вводе).
- **Label** (400, 13px): подписи под цифрами, подписи полей, мета-строки зарядок.
- **Малые шаги:** Title Small (600, 15px) — строка шапки, сегменты; Body Small (14px) — вкладки, плашки, сообщения; Caption (12px) — подсказки, легенды, подписи графика; Micro (11px) — только подпись линии «всего» на графике.
- **Цифровые шаги:** Display Small (600, 23px) — малый счётчик; Display Separator (28px) — запятая счётчика; Figure Large (700, 30px) — реальный запас хода; Headline Small (600, 20px) — пробег, итоги месяца в счётчике; Figure (600, 19px) — числа карточек месяцев и сумма расходов.

### Named Rules
**The Instrument Numerals Rule.** Все числа — моноширинными цифрами, чтобы суммы и километры стояли ровно, как на приборе. Барабаны — только у счётчика потраченного; остальные цифры — обычный текст крупным весом.

## Layout

Один столбец шириной до 560 px по центру, поля 16 px по бокам, отступ снизу 120 px под закреплённую главную кнопку. Сверху — строка шапки (название машины, начало учёта, «Настройки») и липкие вкладки на всю ширину (сетка из четырёх). Разделы идут с шагом 28 px; внутри карточек — 14 px, сетки цифр и полей — две колонки с промежутком 12 px. Главное действие («Добавить зарядку», у гибрида — две кнопки) закреплено внизу экрана, под ним плавно растворяется фон, чтобы список не обрывался резко. Листы (`dialog`) выезжают снизу на всю ширину, не выше 92 % экрана, с отступом под «чёлку» и полосу жестов (`env(safe-area-inset-*)`). Проверочная ширина — 400 px.

## Elevation & Depth

Система плоская: глубину дают слои тона (щиток → карточка → поле) и тонкие рамки Hairline, а не тени. Тени есть только там, где у них физический смысл: внутренняя тень барабанов (цилиндр), тень выпадающего списка станций (он висит над формой) и затемнение за листом снизу.

### Shadow Vocabulary
- **Drum Cylinder** (`box-shadow: inset 0 6px 8px -6px rgba(0,0,0,.8), inset 0 -6px 8px -6px rgba(0,0,0,.8)`): только барабаны счётчика.
- **Floating List** (`box-shadow: 0 10px 28px rgba(0,0,0,.28)`): выпадающие подсказки станций и АЗС.
- **Sheet Scrim** (`background: rgba(0,0,0,.45)` у `dialog::backdrop`): затемнение страницы под листом.

### Named Rules
**The Flat Plate Rule.** Карточки, кнопки и поля не отбрасывают теней. Если что-то нужно выделить — тоном и рамкой, а не тенью.

## Shapes

Мелкие детали — почти прямые: метки и полоски-индикаторы 3 px, полоса долей 5 px, верх столбиков графика 6 px, строки предпросмотра импорта 8 px. Мягкие, но собранные углы: поля, кнопки и сегменты — 10 px, строки зарядок и главная кнопка — 12 px, карточки — 14 px, листы — 18 px сверху, таблетки — полностью круглые. Барабаны — почти прямые (4 px), как настоящие ролики счётчика. Рамки — 1 px Hairline; у строк зарядок слева цветная полоска 4 px по коду типа. Сетка цифр «Обзора» собрана из ячеек с щелью в 1 px — как панель приборов.

## Components

### Buttons
- **Shape:** скругление 10 px (control), высота не меньше 44 px.
- **Primary:** заливка Graphite Ink, текст цвета щитка, 600; одна на лист («Сохранить», «Настроить машину»).
- **Добавить зарядку:** главная кнопка внизу экрана — во всю ширину (до 528 px), 12 px, 15 px внутри, 17px/600. У гибрида рядом «+ Заправка» цвета Fuel Button.
- **Secondary:** контур Hairline на Field White («Отмена», «Загрузить копию», кнопки блока «Данные»).
- **Link button:** синий текст AC Blue без фона, 500, зона нажатия 44×44 px («Настройки», «Обновить», «Как это считается»).
- **Danger:** текст Signal Red (ночью Night Red Text) — «Удалить»; подтверждение вторым нажатием. «Удалить всё» — заливка Signal Red в обеих темах.
- **Focus:** рамка 2 px AC Blue с отступом 2 px (`:focus-visible`).

### Chips
- **Style:** таблетки выбора метрики графика и фильтра списка — контур Hairline, 13px, высота 44 px.
- **State:** выбранная — заливка Graphite Ink, текст цвета щитка, 600.

### Cards / Containers
- **Corner Style:** 14 px (card).
- **Background:** Panel Grey (ночью Night Panel).
- **Shadow Strategy:** без теней (The Flat Plate Rule).
- **Border:** 1 px Hairline.
- **Internal Padding:** 14 px; плашки (обновление, пример, резервная копия) — 12×14 px, предупреждающая — с красной рамкой.

### Inputs / Fields
- **Style:** Field White, рамка Hairline, скругление 10 px, 10×12 px внутри, 17px. Подпись над полем всегда видна (13px, приглушённая), в поле — пример.
- **Focus:** общая рамка фокуса AC Blue.
- **Segmented control:** сетка кнопок в общей рамке 10 px; выбранная — Graphite Ink («AC / DC город / Трасса», тип машины, тема).
- **Error:** короткое сообщение внизу экрана и переход в нужное поле.

### Navigation
- **Tabs:** четыре вкладки во всю ширину, липкие под шапкой: 14px Slate Muted; выбранная — Graphite Ink, 600, подчёркивание 2 px.
- **Settings:** ссылка-кнопка «Настройки» справа в шапке, на любой вкладке.

### Барабанный счётчик (signature)
Счётчик «Потрачено» на «Обзоре»: пять барабанов целых и два красных барабана копеек, высота 52 px, цифры 38px/600, внутренняя тень цилиндра. При изменении суммы ролики докручиваются (`transform` 1,1 с, `cubic-bezier(.2,.8,.2,1)`); при «уменьшить движение» — без анимации. Тот же мотив — в значке приложения (design/icon-mark.svg).

## Do's and Don'ts

### Do:
- **Do** держать одну тёмную главную кнопку на экране или листе; остальное — контур или синий текст.
- **Do** делать кнопки не меньше 44 px и держать контраст текста не ниже 4,5 : 1 (крупного — 3 : 1) в обеих темах — это проверяет автотест.
- **Do** брать цвета типов зарядки только из сквозного кода (The Charge Colour Code Rule).
- **Do** задавать `color-scheme` вместе с темой, чтобы поля даты и списки рисовались в ней же.
- **Do** проверять каждый экран на ширине 400 px в светлой и тёмной теме.

### Don't:
- **Don't** использовать градиенты и неоновое свечение «под электричество» (решение владельца); единственное исключение — функциональное растворение фона под главной кнопкой.
- **Don't** вводить игровой стиль: маскоты, эмодзи вместо значков, конфетти (решение владельца).
- **Don't** ставить тени карточкам и кнопкам (The Flat Plate Rule).
- **Don't** использовать красный как украшение или для красного текста в тёмной теме — для текста есть Night Red Text (The Signal Red Rule).
- **Don't** подключать шрифты, значки или библиотеки с чужих сайтов: всё лежит в app/.
