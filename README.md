# Rally MCP Server

This is an MCP (Model Context Protocol) server that integrates with Rally to provide access to Rally data through standardized tools.

## Features

- Get Rally user story details
- Get defects linked to a Rally story
- Get tasks associated with a Rally story
- Get stories from a Rally iteration
- Health check endpoint
- Tool discovery endpoint

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```bash
RALLY_API_KEY=your_rally_api_key
RALLY_BASE_URL=https://rally1.rallydev.com/slm/webservice/v2.0
```

3. Start the server:
```bash
npm start
```

## Endpoints

### Health Check
- `GET /health` - Check if server is running

### Tool Discovery
- `GET /tools` - List available MCP tools

### MCP Tools (POST)
- `POST /rally/getUserStory` - Get user story details
- `POST /rally/getDefects` - Get defects for a story
- `POST /rally/getStoryTasks` - Get tasks for a story
- `POST /rally/getIterationStories` - Get stories from an iteration

## Usage with Vibes

This server is designed to work with the vibes assistant. The rules for interaction are defined in `.vibes/rules.md`.

## Available Tools

1. **getUserStory** - Get Rally user story details
   - Input: `{ "storyNumber": "US12345" }`

2. **getDefects** - Get defects linked to a Rally story
   - Input: `{ "storyNumber": "US12345" }`

3. **getStoryTasks** - Get tasks associated with a Rally story
   - Input: `{ "storyNumber": "US12345" }`

4. **getIterationStories** - Get stories from a Rally iteration
   - Input: `{ "iterationName": "Sprint 25" }`
