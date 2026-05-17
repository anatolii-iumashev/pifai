---
name: summarize
description: Use when you need to extract web page content with the `summarize` CLI. Covers installation, usage, and troubleshooting of the summarize tool for fetching URL content as Markdown.
---

# Summarize CLI

Инструмент `summarize` для извлечения веб-контента в Markdown. Используется как **основной** инструмент для получения контента с URL в workflow этой базы знаний.

## ⚠️ Fetch Rule (общая для всех wiki-* skills)

- **Всегда:** `summarize "URL" --extract --format md`
- **Никогда не используй** `web_fetch`, `browser` или другие инструменты для первичного извлечения контента
- **Fallback:** `web_fetch` допустим только если `summarize` упал с ошибкой; как последнее средство — `skills/jina-ai/extract.mjs`

## Установка

### macOS

```bash
brew install summarize
```

### Универсально (macOS / Windows / Linux)

Через npm:

```bash
npm install -g @steipete/summarize
```

### Дополнительные зависимости (рекомендуется)

```bash
# macOS
brew install ffmpeg yt-dlp tesseract

# Windows (через Scoop)
scoop install ffmpeg yt-dlp
```

### Настройка расширения браузера

1. Установи расширение **Summarize** из [Chrome Web Store](https://chromewebstore.google.com/detail/summarize/) или Firefox Add-ons
2. Открой Side Panel (Chrome) или Sidebar (Firefox)
3. Скопируй токен
4. Подключи:

```bash
summarize daemon install --token ВАШ_ТОКЕН
```

> **Windows:** запускай PowerShell / Командную строку от имени администратора.

### Проверка

```bash
summarize --version
```

## Использование

### Основной паттерн (используется во всех wiki-* skills)

```bash
summarize "URL" --extract --format md
```

Флаги:
- `--extract` — извлечь основной контент страницы (без навигации, футеров и т.д.)
- `--format md` — вывод в Markdown

### Пример

```bash
summarize "https://wordpress.org/support/article/using-themes/" --extract --format md
```

### Одноразовый запуск без установки

```bash
npx -y @steipete/summarize "https://example.com"
```

## Полезные ссылки

- **GitHub**: [github.com/steipete/summarize](https://github.com/steipete/summarize)
- **Сайт**: [summarize.sh](https://summarize.sh)
