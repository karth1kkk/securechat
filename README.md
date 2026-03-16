## SecureChat Mobile Backend

SecureChat Mobile is a cybersecurity-focused messaging backend built with:

- ASP.NET Core 8 (minimal hosting model)
- GraphQL (HotChocolate)
- Entity Framework Core
- PostgreSQL
- JWT authentication
- SignalR for real-time messaging

### Solution layout

- `SecureChat.Domain` – core entities and enums
- `SecureChat.Application` – GraphQL types, DTOs, and service interfaces
- `SecureChat.Infrastructure` – EF Core DbContext, configurations, and persistence
- `SecureChat.Api` – ASP.NET Core host, GraphQL endpoint, SignalR hub, authentication

### Getting started

1. Install the .NET 8 SDK and PostgreSQL.
2. Create a PostgreSQL database, e.g. `securechat_db`.
3. Update the connection string in `SecureChat.Api/appsettings.Development.json`.
4. From the solution root, run EF Core migrations:

   ```bash
   dotnet ef migrations add InitialCreate -p SecureChat.Infrastructure -s SecureChat.Api
   dotnet ef database update -p SecureChat.Infrastructure -s SecureChat.Api
   ```

5. Run the API:

   ```bash
   dotnet run --project SecureChat.Api
   ```

6. Open the GraphQL IDE at `/graphql` to explore queries and mutations.

# Cloud-Based Smart Production & Inventory Monitoring System

University cloud computing project – backend for a **manufacturing production, materials, machines, and warehouse inventory** system.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | ASP.NET Core 8 Web API |
| API Style | REST + **GraphQL** (HotChocolate) |
| Frontend | **Vue 3**, Vite, Vue Router, Pinia, Apollo GraphQL Client, TailwindCSS |
| ORM | Entity Framework Core 8 |
| Database | **PostgreSQL** |
| Cloud | AWS (EC2, RDS, S3, CloudWatch) |

## Architecture (Clean Architecture)

```
src/SmartProductionInventory.Api/
├── Controllers/       # REST API endpoints
├── GraphQL/           # HotChocolate types & root Query
├── Models/            # Domain entities
├── DTOs/              # Request/response DTOs
├── Services/          # Business logic
├── Repositories/      # Data access (repository pattern)
├── Data/              # DbContext & EF configuration
├── Utilities/         # Cross-cutting (e.g. Audit)
├── Program.cs
└── appsettings.json
```

## Entity Model Summary

| Entity | Purpose |
|--------|---------|
| **User** | Authentication; links to Role |
| **Role** | Admin, Production Manager, Warehouse Staff |
| **Supplier** | Raw material suppliers |
| **RawMaterial** | Materials with quantity, reorder level, supplier |
| **ProductionBatch** | Batch number, machine, start/end time, output quantity |
| **BatchMaterial** | Assigned raw materials per batch |
| **Machine** | Production equipment |
| **MachineLog** | Machine ID, downtime reason, duration, production output |
| **InventoryItem** | Finished goods, quantity, warehouse location |
| **StockMovement** | In/Out/Transfer/Adjustment with reference |
| **Report** | Metadata + S3 bucket/key for report files |
| **AuditLog** | Material updates, batch creation, stock adjustments |

## Running Locally

### Prerequisites

- .NET 8 SDK
- PostgreSQL (local or Docker)
- Node.js 18+ (for frontend)

### Database

1. Create database:
   ```bash
   createdb SmartProductionInventory
   ```
2. From project folder:
   ```bash
   cd src/SmartProductionInventory.Api
   dotnet ef migrations add InitialCreate
   dotnet ef database update
   ```
   (Requires: `dotnet tool install --global dotnet-ef`)

### Run API

```bash
cd src/SmartProductionInventory.Api
dotnet run
```

- **REST API**: http://localhost:5000  
- **Swagger**: http://localhost:5000/swagger  
- **GraphQL**: http://localhost:5000/graphql  

### Run frontend (Vue 3)

```bash
cd frontend
npm install
npm run dev
```

- **App**: http://localhost:5173  
- Proxy: `/graphql` → backend at port 5000  

See `frontend/README.md` for structure, pages, and GraphQL usage.

## AWS Deployment (Outline)

- **Backend**: Deploy to **AWS EC2** (Linux) – e.g. run as systemd service or in Docker.
- **Database**: Use **AWS RDS** PostgreSQL; set `ConnectionStrings:DefaultConnection` to RDS endpoint.
- **Reports**: Upload report files to **AWS S3**; store metadata (bucket + key) in `Reports` table.
- **Monitoring**: Use **AWS CloudWatch** for logs and metrics (e.g. via Serilog sink or AWS SDK).

## Example REST Endpoints

- `GET /api/ProductionBatches/{id}` – get batch by ID  
- `GET /api/ProductionBatches/by-number/{batchNumber}`  
- `GET /api/ProductionBatches/by-status/{status}`  
- `GET /api/ProductionBatches/by-date-range?from=...&to=...`  
- `POST /api/ProductionBatches` – create batch (body: `CreateProductionBatchRequest`)  
- `PUT /api/ProductionBatches/{id}` – update batch  
- `DELETE /api/ProductionBatches/{id}`  
- `GET /api/Health` – health check  

## GraphQL API (HotChocolate)

**Endpoint**: `POST /graphql` — use the Banana Cake Pop IDE at http://localhost:5000/graphql to explore the schema and run operations.

### Queries

| Query | Description |
|-------|-------------|
| `getRawMaterials(activeOnly)` | Raw materials; each includes **isLowStock** when quantity &lt; reorder level |
| `getSuppliers(activeOnly)` | Suppliers |
| `getProductionBatches(limit)` | Production batches |
| `getMachines(activeOnly)` | Machines |
| `getMachineLogs(machineId, limit)` | Machine logs (downtime, output) |
| `getInventoryItems(activeOnly)` | Inventory items; each includes **isLowStock** |
| `getProductionAnalytics(from, to)` | **Production efficiency**: total batches completed, average output, machine downtime % |

### Mutations (all create AuditLog: action, user, timestamp, affected record ID)

| Mutation | Description |
|----------|-------------|
| `createRawMaterial(input, userId)` | Create raw material |
| `updateMaterialStock(input, userId)` | Update raw material stock → creates **StockMovement** |
| `createProductionBatch(input, userId)` | Create production batch |
| `startProductionBatch(batchId, userId)` | Set batch status to InProgress, set start time |
| `completeProductionBatch(input, userId)` | Set completion time, output quantity, status Completed |
| `logMachineDowntime(input, userId)` | Log machine downtime (duration in minutes) |
| `addInventoryStock(input, userId)` | Add stock → creates **StockMovement** |
| `adjustInventoryStock(input, userId)` | Set inventory quantity → creates **StockMovement** |
| `generateProductionReport(input)` | Create report metadata with S3 key |

### Features

- **Low stock alerts**: `RawMaterialType` and `InventoryItemType` expose `isLowStock` (true when quantity &lt; reorder level).
- **Production analytics**: `getProductionAnalytics` returns total batches completed, average production output, and machine downtime percentage for a date range.
- **Inventory movement tracking**: Every stock update (raw material or inventory) creates a `StockMovement` record.
- **Audit logging**: Every mutation writes to `AuditLogs` with action, entity type, entity ID, optional user, and timestamp.

Example schema and types: see `src/SmartProductionInventory.Api/GraphQL/schema.example.graphql`.

## License

For university project use.
