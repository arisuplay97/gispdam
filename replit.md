# Smart Water System - SCADA + WebGIS

## Overview

Smart Water System is a SCADA-based water distribution monitoring and management platform for PDAM (Indonesian water utility). It combines real-time monitoring, interactive WebGIS mapping, and GIS data import/export capabilities.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Leaflet.js + Recharts
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Features

- **Interactive Map**: Leaflet-based map with valve markers (color-coded by pressure), pipe polylines, and water source markers
- **View/Edit Mode**: Toggle between viewing and editing network topology
- **Leaflet Draw**: Add valves (points) and pipes (polylines) directly on the map
- **GIS Import**: Upload GeoJSON files from QGIS - Points become valves, LineStrings become pipes
- **GIS Export**: Export all data as GeoJSON or valve data as CSV (compatible with QGIS/ArcGIS)
- **Dashboard**: Real-time statistics - total valves, pipes, sources, average pressure, health status counts
- **Telemetry**: Simulate pressure readings via the telemetry panel
- **Pressure History**: Chart showing pressure trends over time
- **Dark Theme**: SCADA-style dark interface with glowing indicators

## Database Tables

- `valves` - valve_id, name, lat, lng, pressure, status
- `pipes` - name, diameter, material, from_node, to_node, coordinates (JSONB)
- `sources` - name, lat, lng
- `pressure_history` - valve_id, name, pressure, timestamp

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## API Endpoints

- `GET/POST /api/valves` - List/Create valves
- `GET/PUT/DELETE /api/valves/:id` - CRUD single valve
- `GET/POST /api/pipes` - List/Create pipes
- `GET/PUT/DELETE /api/pipes/:id` - CRUD single pipe
- `GET/POST /api/sources` - List/Create water sources
- `DELETE /api/sources/:id` - Delete water source
- `POST /api/import-geojson` - Import GeoJSON data
- `GET /api/export/geojson` - Export all data as GeoJSON
- `GET /api/export/csv` - Export valve data as CSV
- `POST /api/telemetry` - Post telemetry data
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/pressure-history` - Pressure history

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
