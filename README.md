# The Cabinet

The Cabinet is a personal AI-powered kitchen assistant that helps you decide what to cook based on the food you have available.

## Features

* AI kitchen assistant powered by a local LLM
* Simple food inventory
* Natural-language bulk inventory import
* AI meal suggestions
* AI-generated recipes
* Saved recipes
* Supabase database

## Tech Stack

* Next.js
* TypeScript
* Tailwind CSS
* Supabase
* llama.cpp
* Qwen

## Getting Started

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

### Database

The Cabinet uses Supabase for storing inventory and saved recipes.

## Inventory

Inventory is intentionally simple. Items consist of a name and an optional note.

The app does not currently track quantities, units, storage locations, categories, or expiration dates.

## Project Status

The Cabinet is an ongoing personal project focused on combining a simple kitchen inventory with an AI chef.
