# FabricSelector Data Source Refactor — Design Spec

## Goal

Replace hardcoded fabric data with multi-tenant Material table queries. FabricSelector should fetch materials by organization, not from a static dataset.

## Architecture

The `/my` layout provides org context via React Context. FabricSelector receives `orgSlug` as a prop and fetches from `/api/my/materials/*` endpoints (authenticated, org-scoped). The `Fabric` type is replaced by a unified `Material` type.

## 1. Org Context Provider

**New files:**
- `src/contexts/OrgContext.tsx` — React context + `useOrg()` hook
- Modify: `src/app/(app)/my/layout.tsx` — server component wraps children with `<OrgProvider>`

**Flow:**
```
/my/layout.tsx (server)
  → getOrgContext()          // from dal.ts, returns { orgSlug, orgId, ... }
  → <OrgProvider orgSlug={ctx.orgSlug} orgId={ctx.orgId}>
      {children}
    </OrgProvider>
```

**OrgContext shape:**
```ts
type OrgContextValue = {
  orgSlug: string;
  orgId: string;
};
```

`useOrg()` throws if called outside provider (catches bugs early).

## 2. API Routes

Routes under `/api/my/materials/*` require authentication and validate that the requesting user belongs to the org identified by their session (via `getOrgContext()` or `apiGuard()`). This prevents cross-org material enumeration.

### 2a. `GET /api/my/materials/series`

Returns materials grouped by series for FabricSelector's series view.

**Auth:** User must be an active member of the org (enforced via session).

**Query params:**
- `category` (optional) — filter by category
- `limit` (optional, default 100) — max series returned

**Response:**
```json
{
  "series": [
    {
      "name": "CHLOE",
      "seriesCode": "0937",
      "category": "Fabric",
      "colorCount": 12,
      "representativeImage": "https://..."
    }
  ]
}
```

**Implementation:** Query Material table grouped by `(name, seriesCode)`, count colors. Join `MaterialImage` (where `isPrimary=true`) to get representative image URL. Filter by `status=active`, `deletedAt=null`. The `org_slug` comes from session, not query params.

### 2b. `GET /api/my/materials/search`

Handles three use cases: text search, ID-based batch lookup, and series color listing.

**Auth:** Same as 2a.

**Query params:**
- `q` (optional) — search term, matches against name, color, colorCode, seriesCode
- `ids` (optional) — comma-separated material IDs for favorites lookup (always filtered by user's org to prevent cross-org leakage)
- `series` (optional) — filter by series name (for "colors within series" view)
- `limit` (optional, default 50) — max results returned

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "CHLOE",
    "seriesCode": "0937",
    "category": "Fabric",
    "color": "OLDROSE",
    "colorCode": "0937.0998",
    "imageUrl": "https://..."
  }
]
```

**`imageUrl` resolution:** Material has no `imageUrl` column. Each route must join `MaterialImage` (where `isPrimary=true`, take 1) and map `images[0]?.url ?? null` to produce `imageUrl`. This matches the pattern in the existing `/api/materials` route (line 40-58).

**`promptModifier`:** Not returned to client. Generate routes look up `promptModifier` server-side by `materialId`.

### 2c. `GET /api/materials` (unchanged)

Stays as-is for vendor public page (`MaterialGrid`). This is a public, unauthenticated route scoped by `org_slug` query param.

## 3. Type System

### Delete: `src/data/fabrics.ts`

Remove entirely. Current contents:
- `Fabric` interface → replaced by `Material`
- `thumbUrl()` / `microUrl()` → not needed (remote URLs, use `next/image` sizing)
- `apiFabricToFabric()` → not needed (API returns Material directly)

### New: `src/types/material.ts`

```ts
export type Material = {
  id: string;
  name: string;           // Series name, e.g. "CHLOE"
  seriesCode: string | null;
  category: string;       // "Fabric" | "Natural Fabric" | "Advanced" | "Leather"
  color: string | null;   // Color name
  colorCode: string | null;
  imageUrl: string | null; // Full URL to material image
};

export type SeriesEntry = {
  name: string;
  seriesCode: string | null;
  category: string;
  colorCount: number;
  representativeImage: string | null;
};
```

## 4. FabricSelector Refactor

**Props change:**
```ts
interface FabricSelectorProps {
  orgSlug: string;                    // NEW — required
  selectedMaterial: Material | null;  // renamed from selectedFabric
  onSelect: (material: Material) => void;
  compareMode?: boolean;
  compareSelection?: Set<string>;
  onCompareToggle?: (material: Material) => void;
  maxCompare?: number;
}
```

**API call changes:**
- `/api/fabrics/series?category=X` → `/api/my/materials/series?category=Y`
- `/api/fabrics?seriesName=X` → `/api/my/materials/search?series=Y`
- `/api/fabrics?q=X` → `/api/my/materials/search?q=Y`
- `/api/fabrics?ids=X` → `/api/my/materials/search?ids=Y`

(No `org_slug` in query params — org is derived from session.)

**Image handling:**
- Remove `thumbUrl()` / `microUrl()` calls
- Use `imageUrl` directly (or via `next/image` with width/height for sizing)

## 5. Page Updates

### `src/app/(app)/my/retexture/page.tsx`
- Import `Material` instead of `Fabric`
- Replace all `Fabric` type references with `Material`
- Replace `selectedFabric` state with `selectedMaterial`
- Pass `orgSlug` from `useOrg()` to `FabricSelector`
- Update `microUrl()` calls to use `imageUrl` directly
- Update generate API call: send `materialId` instead of fabric snapshot

### `src/app/(app)/my/multi-fabric/page.tsx`
- Same changes as retexture page
- `assignments` record type changes from `Fabric` to `Material`

### `src/components/ShareModal.tsx`
- Uses `Fabric` type from `@/data/fabrics` — update to `Material`

### `src/components/FabricPopover.tsx`
- Check if it references `Fabric` type — update accordingly

## 6. Generate API Routes

Currently, retexture/multi-fabric generate routes receive fabric data (including `promptModifier`) from the client. In multi-tenant mode:

- Client sends `materialId` (not full material data)
- Server looks up `promptModifier` from Material table by ID
- This prevents client from tampering with prompt data

**Affected routes:**
- `POST /api/generate` — add materialId param, look up promptModifier server-side
- `POST /api/multi-fabric/generate` — same pattern

**Note:** This is a security improvement but may require changes to the generate routes. The current refactor should at minimum pass `materialId` alongside the material data, with full server-side lookup as a follow-up if needed.

## 7. Brand Handling

The old `Fabric` type had a `brand` field (`"Elastron" | "Magenta"`). In multi-tenant mode, brand = organization. The `Material` type has no `brand` field. Category filter chips in FabricSelector that referenced brand-specific logic should use `category` only. Organization name is available from `OrgContext` if needed for display.

## 8. Favorites Cross-Org Safety

Favorites are stored in localStorage by material ID. If a user belongs to multiple organizations, their favorites may contain IDs from a different org. The `/api/my/materials/search?ids=...` endpoint always filters by the user's current org, so cross-org IDs simply return no results (safe, not leaked).

## Out of Scope

- Dashboard material management (already works via `/api/dashboard/materials`)
- Vendor public page (`/v/[slug]`) — already uses `MaterialGrid` with `/api/materials`
- Image upload/storage for materials (handled by dashboard)
