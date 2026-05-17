---
title: "Лог операций"
description: "Хронологический журнал операций по обновлению базы знаний."
---

# Operations Log

Chronological log of all wiki operations.

## [2026-05-17] init | Initial wiki structure

- Created: AGENTS.md
- Created: src/content/docs/index.md
- Created: src/content/docs/log.md
- Created: .agents/skills/* (copy from wp-knowledge)
- Categories: nvc/, jung/, psychology/, techniques/, faq/, queries/

## [2026-05-17] structure | Расширение разделов базы знаний

- Добавлены разделы: mbti/, frankl/, wilber/, mindell/, adizes/, litvak/, integral/, techniques/
- Созданы index.md для каждого нового раздела
- Обновлены: index.md, README.md, AGENTS.md
- Удалена категория psychology/ (заменена на специализированные разделы)

## [2026-05-17] ingest | Материалы по ННО и Юнгу

- Saved to raw/2026/0517/:
  - nvc-basics-rozenberg.md (24 KB) — Ненасильственное общение, 4 компонента
  - jung-analytical-psychology.md (21 KB) — Архетипы, коллективное бессознательное
- Sources: zamesin.ru, psychologistworld.com

## [2026-05-17] ingest | Массовый ingest raw/2025/0101/ (10 источников)

- Созданы страницы:
  - basics/what-is-psyche.md — психика, сознание, бессознательное, модель Фрейда
  - basics/emotions-and-needs.md — эмоции, потребности, эмоциональная грамотность
  - use-cases/anxiety-fears.md — тревога, страх, фобии, КПТ, экспозиция
  - use-cases/depression-burnout.md — депрессия, апатия, выгорание, стадии Маслач
  - practices/emotional-diary.md — дневник эмоций и потребностей
  - practices/grounding-5-4-3-2-1.md — техника заземления
  - quotes/tolstoy.md — цитаты из «Круга Чтения» и «Пути Жизни»
  - quotes/frankl.md — цитаты Виктора Франкла
  - quotes/jung.md — цитаты Карла Юнга
  - quotes/rosenberg.md — цитаты Маршалла Розенберга
  - quotes/others.md — Фрейд, Эпиктет, Марк Аврелий, Будда, Лао-цзы и др.
- Обновлены:
  - typology/mbti/index.md — 4 дихотомии, 8 функций, стек, 16 типов
  - authors/jung/archetypes.md — формирование Тени, проявления, шаги для начинающих
  - authors/jung/shadow.md — дополнены источники
  - authors/frankl/index.md — три опоры, сравнение с психоанализом, роль терапевта
  - authors/rosenberg/index.md — формула ННО, две стороны, ключевые принципы
  - basics/index.md, use-cases/index.md, quotes/index.md, practices/index.md — обновлены списки
  - index.md — добавлены все новые страницы в каталог
- Sources: akademik.expert, medalvian.ru, smclinic.ru, bemeta.co, talentsy.ru, 16personalities.com, baynvc.org, viktorfranklamerica.com, tolstoy.ru

## [2026-05-17] ingest | Полный ingest 7 источников из raw/2026/0516

- Источники:
  - nvc-4-components-halvacard.md — 4 компонента ННО (halvacard.ru)
  - jung-archetypes-shadow-basics.md — Архетипы, Тень, коллективное бессознательное (psychologistworld.com, academyofideas.com)
  - frankl-logotherapy-meaning-paradox.md — Логотерапия и парадоксальная интенция (4brain.ru, viktorfranklamerica.com)
  - wilber-integral-aqal-quadrants.md — AQAL, 4 квадранта, Spiral Dynamics (deep-psychology.com, integrallife.com)
  - mindell-dreambody-processwork.md — Dreambody, процессуальная психология (processmind.ru, apopp.ru)
  - adizes-paei-code-leadership.md — PAEI-роли, миф об идеальном руководителе (skillbox.ru, adizes.ru)
  - litvak-psychological-aikido-amortization.md — Метод амортизации, психологическое айкидо (goodo.pro, litvak.me)
- Создано страниц: 13
  - authors/rosenberg/4-components.md
  - authors/jung/archetypes.md, authors/jung/shadow.md
  - authors/frankl/three-sources-of-meaning.md, authors/frankl/paradoxical-intention.md
  - authors/wilber/aqal-four-quadrants.md
  - authors/mindell/dreambody.md
  - authors/adizes/paei-roles.md
  - authors/litvak/amortization.md
  - practices/nvc-4-steps.md, practices/shadow-work.md, practices/paradoxical-intention-exercise.md, practices/amortization-exercise.md
- Обновлено: все category index pages, index.md, integral/index.md, techniques/index.md

## [2026-05-17] restructure | Переход на RFC user-centric структуру

- Новая структура согласно RFC-001:
  - 1. basics/ — База и вводные
  - 2. problems/ — Проблематика и Use cases
  - 3. practices/ — Практики и техники (бывшие techniques/)
  - 4. quotes/ — Цитаты великих людей
  - 5. authors/ — Авторы и школы (бывшие nvc/, jung/, frankl/, wilber/, mindell/, adizes/, litvak/)
  - 6. typology/ — Классификация и типология (бывший mbti/)
  - 7. misc/ — Дополнения (integral/, faq/, queries/)
- Перемещены все файлы, обновлены перекрёстные ссылки
- Созданы index.md для всех новых разделов
- Обновлены: index.md, log.md, README.md, AGENTS.md
