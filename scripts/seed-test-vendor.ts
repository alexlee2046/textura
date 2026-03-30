import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"]! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Upsert organization
  const org = await prisma.organization.upsert({
    where: { slug: "elastron" },
    update: {},
    create: {
      name: "Elastron",
      slug: "elastron",
      description: "Premium fabric solutions for modern furniture.",
    },
  });

  console.log("Organization:", org.id, org.name);

  // Seed materials
  const materials = [
    {
      name: "Savanna 501",
      category: "fabric",
      color: "米白",
      colorCode: "#F5F0E8",
      seriesCode: "SAV",
      promptModifier: "soft woven linen texture in warm cream",
    },
    {
      name: "Savanna 502",
      category: "fabric",
      color: "灰蓝",
      colorCode: "#8B9DAF",
      seriesCode: "SAV",
      promptModifier: "soft woven linen texture in muted blue-grey",
    },
    {
      name: "Montana Leather",
      category: "leather",
      color: "深棕",
      colorCode: "#5C3A21",
      seriesCode: "MTN",
      promptModifier: "rich full-grain leather in deep brown",
    },
    {
      name: "Velvet Cloud",
      category: "fabric",
      color: "墨绿",
      colorCode: "#2D5F4E",
      seriesCode: "VLC",
      promptModifier: "plush velvet fabric in forest green",
    },
  ];

  for (const mat of materials) {
    const existing = await prisma.material.findFirst({
      where: {
        organizationId: org.id,
        name: mat.name,
        deletedAt: null,
      },
    });

    if (existing) {
      console.log("  Skip (exists):", mat.name);
      continue;
    }

    await prisma.material.create({
      data: {
        organizationId: org.id,
        ...mat,
        sortOrder: materials.indexOf(mat),
      },
    });
    console.log("  Created:", mat.name);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
