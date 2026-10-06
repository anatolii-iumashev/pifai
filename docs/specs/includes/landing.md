# Landing: отдельная посадочная страница

`includes/landing` содержит один статический файл [index.html](../../../includes/landing/index.html) с посадочной страницей ПиФ. Здесь нет `package.json`, сборки и серверного кода. Страница не входит в сборку основного Astro/Starlight сайта на GitHub Pages.

## Команды

Из корня репозитория можно открыть страницу через локальный HTTP-сервер:

```sh
python3 -m http.server 8000 --directory includes/landing
```

После запуска страница доступна по `http://localhost:8000/`. Остановить сервер — `Ctrl+C`.
