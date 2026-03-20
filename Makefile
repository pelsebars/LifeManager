.PHONY: dev reset logs stop

## Start the full stack (builds if needed, runs migrations automatically)
dev:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo ""; \
		echo "  ⚠  Created .env from .env.example"; \
		echo "     Add your ANTHROPIC_API_KEY to .env, then run 'make dev' again."; \
		echo ""; \
		exit 1; \
	fi
	docker compose up --build

## Wipe the database and start fresh (useful for testing seed data)
reset:
	docker compose down -v
	docker compose up --build

## Tail logs from all services
logs:
	docker compose logs -f

## Stop all services
stop:
	docker compose down
