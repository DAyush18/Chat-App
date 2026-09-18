"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
const SEED_PASSWORD = process.env.SEED_PASSWORD || "Password123!";
async function upsertUser(name, email, role, hashedPassword) {
    return prisma.user.upsert({
        where: { email },
        update: { role },
        create: { name, email, password: hashedPassword, role },
    });
}
async function main() {
    const hashedPassword = await bcryptjs_1.default.hash(SEED_PASSWORD, 12);
    const admin = await upsertUser("Admin User", "admin@test.com", client_1.Role.ADMIN, hashedPassword);
    const moderator = await upsertUser("Moderator User", "moderator@test.com", client_1.Role.MODERATOR, hashedPassword);
    const member = await upsertUser("Member User", "member@test.com", client_1.Role.MEMBER, hashedPassword);
    // A couple of extra members to demonstrate "multiple users joining the same channel".
    const ayush = await upsertUser("Ayush", "ayush@test.com", client_1.Role.MEMBER, hashedPassword);
    const rahul = await upsertUser("Rahul", "rahul@test.com", client_1.Role.MEMBER, hashedPassword);
    const general = await prisma.channel.upsert({
        where: { name: "general" },
        update: {},
        create: {
            name: "general",
            description: "Public channel for everyone to chat in",
            isPrivate: false,
            creatorId: admin.id,
        },
    });
    const announcements = await prisma.channel.upsert({
        where: { name: "announcements" },
        update: {},
        create: {
            name: "announcements",
            description: "Admin/moderator announcements (still open to join)",
            isPrivate: false,
            creatorId: admin.id,
        },
    });
    const privateOps = await prisma.channel.upsert({
        where: { name: "private-ops" },
        update: {},
        create: {
            name: "private-ops",
            description: "Restricted channel for staff",
            isPrivate: true,
            creatorId: admin.id,
        },
    });
    // Memberships: admin, moderator and member (+ demo users) join "general" together.
    const memberships = [
        [admin.id, general.id],
        [admin.id, announcements.id],
        [admin.id, privateOps.id],
        [moderator.id, general.id],
        [moderator.id, announcements.id],
        [moderator.id, privateOps.id],
        [member.id, general.id],
        [ayush.id, general.id],
        [rahul.id, general.id],
    ];
    for (const [userId, channelId] of memberships) {
        await prisma.channelMember.upsert({
            where: { userId_channelId: { userId, channelId } },
            update: { isActive: true },
            create: { userId, channelId },
        });
    }
    // A few sample messages in "general" so the chat isn't empty on first load.
    const existingMessages = await prisma.message.count({ where: { channelId: general.id } });
    if (existingMessages === 0) {
        await prisma.message.createMany({
            data: [
                { content: "Welcome to the general channel!", userId: admin.id, channelId: general.id },
                { content: "Hey everyone 👋", userId: member.id, channelId: general.id },
                { content: "Glad to be here.", userId: ayush.id, channelId: general.id },
            ],
        });
    }
    console.log("Seed complete.");
    console.log("-----------------------------------------");
    console.log("Test credentials (all use the same password):");
    console.log(`  Password: ${SEED_PASSWORD}`);
    console.log("  admin@test.com       (ADMIN)");
    console.log("  moderator@test.com   (MODERATOR)");
    console.log("  member@test.com      (MEMBER)");
    console.log("  ayush@test.com       (MEMBER)");
    console.log("  rahul@test.com       (MEMBER)");
    console.log("-----------------------------------------");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
