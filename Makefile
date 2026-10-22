.PHONY: build preview deploy deploy-website deploy-trigger deploy-bot serve clean install check ingest query lint update faq images init

build:
	npx astro build

preview:
	npx astro preview

# === Deployment ===
# Pushes/commits are done manually by the user — Makefile commands run from the
# current state only.
# Website: local build via deploy-website; GitHub Actions (deploy.yml) publishes on push to main.
# Bot: Bunny edge script locally (BUNNY_API_KEY in .env, BUNNY_EDGE_SCRIPT_ID = gh variable list);
#      webhook container built by Actions (webhook-container.yml → GHCR → Bunny Magic Containers)
#      on push to main / workflow_dispatch.
# Trigger.dev task: published locally from includes/consult.

BUNNY_EDGE_SCRIPT_ID ?= 92871

deploy: deploy-website deploy-trigger deploy-bot # Deploy everything: website, Trigger.dev task, bot

deploy-website: # Website → GitHub Pages: local build; after YOU push to main, Actions (deploy.yml) publishes
	npx astro check
	npx astro build
	@echo "✅ Build ok — push main to deploy (Actions deploys on push to main)"

deploy-trigger: # Trigger.dev: publish the consultation task (local)
	cd includes/consult && npm ci && npm run build:wiki-pack && npm run deploy

deploy-bot: # Bot: Bunny edge script (local); webhook container builds via Actions on push to main
	cd includes/edge && deno task check && deno task test && deno task build
	cd includes/edge && BUNNYNET_API_KEY="$${BUNNYNET_API_KEY:-$$(sed -n 's/^BUNNY_API_KEY=//p' $(CURDIR)/.env)}" \
		npx @bunny.net/cli scripts deploy dist/index.js "$(BUNNY_EDGE_SCRIPT_ID)"

dev:
	npx astro dev

dev-stop:
	npx astro dev stop

clean:
	rm -rf dist
	rm -rf .astro

install:
	npm install

check:
	npx astro check

# Wiki Operations (using .agents/skills)
# Эти команды вызывают скиллы через OpenClaw /sessions_send или напрямую

ingest: # Ingest source into wiki (USAGE: make ingest URL="https://..." SOURCE="raw/2026/0517/file.md")
	@echo "Wiki Ingest: Adding source to knowledge base"
	@echo "Usage: make ingest URL=\"https://example.com\" TARGET=\"category/page.md\""
	@echo "или: make ingest SOURCE=\"raw/2026/0517/file.md\" TARGET=\"category/page.md\""

query: # Query the wiki for answers (USAGE: make query QUESTION="your question")
	@echo "Wiki Query: Search knowledge base"
	@echo "Usage: make query QUESTION=\"What is NVC?\""

lint: # Lint wiki for issues (broken links, orphans, contradictions)
	@echo "Wiki Lint: Checking for issues..."
	@echo "Scanning src/content/docs/..."
	@find src/content/docs -name "*.md" -type f | wc -l | xargs echo "Found pages:"

update: # Update existing wiki pages (USAGE: make update PAGE="category/page.md")
	@echo "Wiki Update: Revising pages"
	@echo "Usage: make update PAGE=\"nvc/index.md\""

faq: # Create FAQ page (USAGE: make faq QUESTION="..." ANSWER="...")
	@echo "Wiki FAQ: Creating FAQ page"
	@echo "Usage: make faq QUESTION=\"What is NVC?\" ANSWER=\"...\""

images: # Download images from URL to wiki (USAGE: make images URL="..." TARGET="category/page.md")
	@echo "Wiki Images: Downloading images"
	@echo "Usage: make images URL=\"https://example.com\" TARGET=\"category/page.md\""

init: # Initialize/repair wiki structure
	@echo "Wiki Init: Bootstrapping structure"
	@mkdir -p raw/$$(date +%Y)/$$(date +%m%d)
	@mkdir -p src/content/docs/nvc
	@mkdir -p src/content/docs/jung
	@mkdir -p src/content/docs/psychology
	@mkdir -p src/content/docs/techniques
	@mkdir -p src/content/docs/faq
	@mkdir -p src/content/docs/queries
	@echo "Wiki structure initialized"

# Helper commands
today:
	@date +%Y/%m%d

# === Bot: webhook container + consultation task (see docs/rfc/261022-pifai-magic-container-langgraph.md) ===

webhook-test: # Local tests of the webhook container (includes/webhook)
	cd includes/webhook && npm ci && npm run check && npm test

webhook-image: # Build the container image (no secrets are baked in)
	cd includes/webhook && docker build --platform linux/amd64 -t pifai-webhook:local .

consult-test: # Local tests of the consultation task (includes/consult)
	cd includes/consult && npm ci && npm run check && npm test

consult-eval: # Recall@3 evaluation of the wiki navigation on the fixed question set
	cd includes/consult && npm ci && npm run eval

bot-test: webhook-test consult-test # All bot-related local tests

status:
	@echo "Wiki Status:"
	@echo "============"
	@echo "Raw sources:"
	@find raw -name "*.md" -type f 2>/dev/null | wc -l | xargs echo "  Files:"
	@echo "Wiki pages:"
	@find src/content/docs -name "*.md" -type f 2>/dev/null | wc -l | xargs echo "  Files:"

log:
	@echo "=== Recent Operations ==="
	@tail -20 src/content/docs/log.md
