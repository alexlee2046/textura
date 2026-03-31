/**
 * Admin CLI for Textura platform operations.
 *
 * Usage:
 *   npx tsx scripts/import-materials.ts <command> [options]
 *
 * Commands:
 *   create-org   --name "Org Name" --slug org-slug
 *   add-member   --org <slug> --email <email> --role <owner|admin|member>
 *   import       --org <slug> --csv <path> [--images <dir>]
 *   set-admin    --email <email>
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Prisma & Supabase init
// ---------------------------------------------------------------------------

function createPrisma() {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    console.error("ERROR: DATABASE_URL is not set. Check .env.local");
    process.exit(1);
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function createSupabaseAdmin() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    console.error(
      "ERROR: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.",
    );
    process.exit(1);
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Arg parsing helpers
// ---------------------------------------------------------------------------

function getArg(args: string[], name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function requireArg(args: string[], name: string): string {
  const value = getArg(args, name);
  if (!value) {
    console.error(`ERROR: --${name} is required`);
    process.exit(1);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdCreateOrg(args: string[]) {
  const name = requireArg(args, "name");
  const slug = requireArg(args, "slug");

  const prisma = createPrisma();
  try {
    const org = await prisma.organization.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
    console.log(`Organization created/updated:`);
    console.log(`  id:   ${org.id}`);
    console.log(`  name: ${org.name}`);
    console.log(`  slug: ${org.slug}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function cmdAddMember(args: string[]) {
  const orgSlug = requireArg(args, "org");
  const email = requireArg(args, "email");
  const role = getArg(args, "role") ?? "member";

  if (!["owner", "admin", "member"].includes(role)) {
    console.error(`ERROR: Invalid role "${role}". Must be owner, admin, or member.`);
    process.exit(1);
  }

  const prisma = createPrisma();
  const supabase = createSupabaseAdmin();
  try {
    // Find org
    const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) {
      console.error(`ERROR: Organization "${orgSlug}" not found.`);
      process.exit(1);
    }

    // Find user in Supabase Auth by email
    const { data: userList, error: listErr } =
      await supabase.auth.admin.listUsers();
    if (listErr) {
      console.error("ERROR listing users:", listErr.message);
      process.exit(1);
    }
    const user = userList.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (!user) {
      console.error(
        `ERROR: No Supabase Auth user found with email "${email}". User must register first.`,
      );
      process.exit(1);
    }

    // Upsert organization member
    const member = await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: user.id,
        },
      },
      update: { role, status: "active" },
      create: {
        organizationId: org.id,
        userId: user.id,
        role,
      },
    });
    console.log(`Member added/updated:`);
    console.log(`  org:    ${org.slug}`);
    console.log(`  user:   ${email} (${user.id})`);
    console.log(`  role:   ${role}`);
    console.log(`  id:     ${member.id}`);

    // Sync JWT claims via app_metadata
    const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: {
        organization_id: org.id,
        organization_slug: org.slug,
        role,
      },
    });
    if (updateErr) {
      console.error("WARNING: Failed to sync JWT claims:", updateErr.message);
    } else {
      console.log(`  JWT claims synced (app_metadata updated).`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function cmdImport(args: string[]) {
  const orgSlug = requireArg(args, "org");
  const csvPath = requireArg(args, "csv");
  const imagesDir = getArg(args, "images");

  if (!fs.existsSync(csvPath)) {
    console.error(`ERROR: CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const prisma = createPrisma();
  const supabase = createSupabaseAdmin();
  try {
    // Find org
    const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) {
      console.error(`ERROR: Organization "${orgSlug}" not found.`);
      process.exit(1);
    }

    // Parse CSV
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const records: Array<{
      name: string;
      series_code?: string;
      color?: string;
      color_code?: string;
      category: string;
      description?: string;
      image_filename?: string;
    }> = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log(`Importing ${records.length} materials into "${orgSlug}"...`);
    let created = 0;
    let skipped = 0;

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      if (!row.name || !row.category) {
        console.warn(`  Row ${i + 1}: skipped (missing name or category)`);
        skipped++;
        continue;
      }

      // Check for duplicates
      const existing = await prisma.material.findFirst({
        where: {
          organizationId: org.id,
          name: row.name,
          deletedAt: null,
        },
      });
      if (existing) {
        console.log(`  Skip (exists): ${row.name}`);
        skipped++;
        continue;
      }

      // Create material
      const material = await prisma.material.create({
        data: {
          organizationId: org.id,
          name: row.name,
          category: row.category,
          seriesCode: row.series_code || null,
          color: row.color || null,
          colorCode: row.color_code || null,
          promptModifier: row.description || "",
          sortOrder: i,
        },
      });

      // Handle image upload if image_filename and images dir are provided
      if (row.image_filename && imagesDir) {
        const imagePath = path.join(imagesDir, row.image_filename);
        if (fs.existsSync(imagePath)) {
          const ext = path.extname(row.image_filename).toLowerCase();
          const mimeMap: Record<string, string> = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
          };
          const contentType = mimeMap[ext] || "image/jpeg";
          const storageKey = `${org.slug}/${material.id}/${row.image_filename}`;

          const fileBuffer = fs.readFileSync(imagePath);
          const { error: uploadErr } = await supabase.storage
            .from("materials")
            .upload(storageKey, fileBuffer, { contentType, upsert: true });

          if (uploadErr) {
            console.warn(
              `  WARNING: Failed to upload image for "${row.name}": ${uploadErr.message}`,
            );
          } else {
            const {
              data: { publicUrl },
            } = supabase.storage.from("materials").getPublicUrl(storageKey);

            await prisma.materialImage.create({
              data: {
                materialId: material.id,
                organizationId: org.id,
                url: publicUrl,
                storageKey,
                isPrimary: true,
                sortOrder: 0,
              },
            });
            console.log(`  Created: ${row.name} (with image)`);
            created++;
            continue;
          }
        } else {
          console.warn(
            `  WARNING: Image not found: ${imagePath}`,
          );
        }
      }

      console.log(`  Created: ${row.name}`);
      created++;
    }

    console.log(`\nImport complete: ${created} created, ${skipped} skipped.`);
  } finally {
    await prisma.$disconnect();
  }
}

async function cmdSetAdmin(args: string[]) {
  const email = requireArg(args, "email");

  const prisma = createPrisma();
  const supabase = createSupabaseAdmin();
  try {
    // Find user in Supabase Auth
    const { data: userList, error: listErr } =
      await supabase.auth.admin.listUsers();
    if (listErr) {
      console.error("ERROR listing users:", listErr.message);
      process.exit(1);
    }
    const user = userList.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (!user) {
      console.error(
        `ERROR: No Supabase Auth user found with email "${email}".`,
      );
      process.exit(1);
    }

    // Upsert admin record
    const admin = await prisma.adminUser.upsert({
      where: { userId: user.id },
      update: { isActive: true },
      create: { userId: user.id },
    });
    console.log(`Platform admin set:`);
    console.log(`  email:  ${email}`);
    console.log(`  userId: ${user.id}`);
    console.log(`  id:     ${admin.id}`);

    // Sync JWT claims
    const existingMeta = user.app_metadata || {};
    const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: { ...existingMeta, is_platform_admin: true },
    });
    if (updateErr) {
      console.error("WARNING: Failed to sync JWT claims:", updateErr.message);
    } else {
      console.log(`  JWT claims synced (is_platform_admin: true).`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

function printUsage() {
  console.log(`
Textura Admin CLI

Usage:
  npx tsx scripts/import-materials.ts <command> [options]

Commands:
  create-org   Create or update an organization
               --name <name>   Organization display name
               --slug <slug>   URL-safe identifier (unique)

  add-member   Add a user to an organization
               --org <slug>    Organization slug
               --email <email> User's email (must exist in Supabase Auth)
               --role <role>   owner | admin | member (default: member)

  import       Bulk import materials from CSV
               --org <slug>    Organization slug
               --csv <path>    Path to CSV file
               --images <dir>  (optional) Directory containing image files

  set-admin    Set a user as platform admin
               --email <email> User's email (must exist in Supabase Auth)

CSV format:
  name,series_code,color,color_code,category,description,image_filename

Examples:
  npx tsx scripts/import-materials.ts create-org --name "Elastron" --slug elastron
  npx tsx scripts/import-materials.ts add-member --org elastron --email user@example.com --role owner
  npx tsx scripts/import-materials.ts import --org elastron --csv materials.csv --images ./images/
  npx tsx scripts/import-materials.ts set-admin --email admin@example.com
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "create-org":
      await cmdCreateOrg(args);
      break;
    case "add-member":
      await cmdAddMember(args);
      break;
    case "import":
      await cmdImport(args);
      break;
    case "set-admin":
      await cmdSetAdmin(args);
      break;
    default:
      printUsage();
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
