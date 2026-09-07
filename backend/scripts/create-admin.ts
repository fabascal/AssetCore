/**
 * Create initial admin user for production.
 * Usage:
 *   ADMIN_EMAIL=admin@company.com ADMIN_PASSWORD='...' ADMIN_FULL_NAME='Admin' npx tsx scripts/create-admin.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const email = process.env.ADMIN_EMAIL?.trim();
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_FULL_NAME?.trim() || "Administrador";

if (!email || !password) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.");
  process.exit(1);
}

if (password.length < 8) {
  console.error("ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

(async () => {
  const adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
  if (!adminRole) {
    console.error("Admin role not found. Run database migrations first.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User already exists: ${email}`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
    },
  });

  console.log(`Admin user created: ${user.email} (id=${user.id})`);
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
