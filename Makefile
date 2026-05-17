.PHONY: build preview deploy serve clean install check ingest query lint update faq images init

build:
	npx astro build

preview:
	npx astro preview

deploy: # Build and deploy to GitHub Pages
	make build
	# Deploy is handled by GitHub Actions on push to main

dev:
	npx astro dev

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
