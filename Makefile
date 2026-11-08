.PHONY: up down seed test build
up:
	docker compose up -d --build
down:
	docker compose down
seed:
	pnpm seed
build:
	pnpm -r build
test:
	pnpm -r --if-present test
