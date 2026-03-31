#!/usr/bin/env node
/**
 * Import Elastron fabrics from fabric-switcher into Textura
 * Usage: node scripts/import-from-switcher.mjs
 */
import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import pg from 'pg';

// ── Config ────────────────────────────────
const TEXTURA_DB = 'postgresql://supabase_admin:9B35Z1bGsOyoqftfiamx77REwpvvOSf2@100.66.51.75:54329/postgres';
const ORG_SLUG = 'elastron';
const FABRICS_JSON = '/tmp/elastron-fabrics.json';
const FABRIC_IMAGES_DIR = resolve('../fabric-switcher/public/fabrics');

// Map fabric-switcher categories to Textura categories
const CATEGORY_MAP = {
  'Fabric': 'fabric',
  'Natural Fabric': 'fabric',
  'Advanced': 'fabric',
  'Leather': 'leather',
};

async function main() {
  const client = new pg.Client({ connectionString: TEXTURA_DB });
  await client.connect();

  // Get org ID
  const orgRes = await client.query('SELECT id FROM "Organization" WHERE slug = $1', [ORG_SLUG]);
  if (orgRes.rows.length === 0) throw new Error(`Org "${ORG_SLUG}" not found`);
  const orgId = orgRes.rows[0].id;
  console.log(`Organization: ${ORG_SLUG} (${orgId})`);

  // Load fabric data
  const fabrics = JSON.parse(readFileSync(FABRICS_JSON, 'utf-8'));
  console.log(`Fabrics to import: ${fabrics.length}`);

  let created = 0, skipped = 0, errors = 0;

  for (const fab of fabrics) {
    const category = CATEGORY_MAP[fab.category] || 'fabric';
    const name = `${fab.name} ${fab.color}`;
    const imageFilename = fab.imagePath.replace('/fabrics/', '');
    const imageLocalPath = join(FABRIC_IMAGES_DIR, imageFilename);

    // Use the fabric-switcher public URL for images (they're served by xinvise.com)
    // For now, store as local path — we'll upload to COS later
    const imageUrl = `/generated/${imageFilename}`;

    try {
      // Check if already exists
      const existing = await client.query(
        'SELECT id FROM "Material" WHERE "organizationId" = $1 AND "seriesCode" = $2 AND "colorCode" = $3 AND "deletedAt" IS NULL',
        [orgId, fab.seriesCode, fab.colorCode]
      );

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      // Insert material
      const matRes = await client.query(
        `INSERT INTO "Material" (id, "organizationId", category, name, "seriesCode", color, "colorCode", "promptModifier", status, "sortOrder", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'active', $8, now(), now())
         RETURNING id`,
        [orgId, category, name, fab.seriesCode, fab.color, fab.colorCode, fab.promptModifier, fab.sortOrder]
      );
      const materialId = matRes.rows[0].id;

      // Insert primary image reference
      // Use the xinvise.com hosted image URL
      const hostedImageUrl = `https://www.xinvise.com/fabrics/${imageFilename}`;
      await client.query(
        `INSERT INTO "MaterialImage" (id, "materialId", "organizationId", url, "storageKey", "isPrimary", "sortOrder", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, 0, now(), now())`,
        [materialId, orgId, hostedImageUrl, hostedImageUrl]
      );

      created++;
      if (created % 20 === 0) console.log(`  ...${created} created`);
    } catch (e) {
      console.error(`  Error importing ${name}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped, ${errors} errors`);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
