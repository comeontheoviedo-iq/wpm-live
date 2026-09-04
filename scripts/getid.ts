import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
p.match.findFirst({ where: { featured: true } }).then(async (m) => { console.log(m!.id); await p.$disconnect(); });
