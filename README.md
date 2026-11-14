# Афиша культуры Башкортостана

Единый сервис культурных мероприятий республики: Telegram-бот, веб-сайт, REST API и ИИ-агент.

**Уровень решения:** 3 («Агент») с заделом на уровень 4
**Модель:** YandexGPT Lite
**Стоимость диалога:** ~0.15 ₽ (расчёт в [docs/cost.md](docs/cost.md))

## Быстрый старт

```bash
git clone <repo-url>
cd afisha-bashkortostan
cp .env.example .env
# Заполните TELEGRAM_BOT_TOKEN и LLM_API_KEY в .env
docker compose up -d
docker compose exec api python -m data.seed.seed