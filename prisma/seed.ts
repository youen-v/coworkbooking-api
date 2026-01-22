import { PrismaClient, ReservationStatus, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

function makeDate(dateISO: string, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(dateISO);
  d.setHours(h, m, 0, 0);
  return d;
}

async function main() {
  console.log("🌱 Seeding demo data...");

  // ✅ 1) USERS DEMO (clerkUserId = fake)
  // Tu peux ensuite modifier role ADMIN via Prisma Studio si besoin.
  const admin = await prisma.user.upsert({
    where: { clerkUserId: "clerk_demo_admin" },
    update: {},
    create: {
      clerkUserId: "clerk_demo_admin",
      email: "admin@demo.com",
      fullName: "Admin Demo",
      role: UserRole.ADMIN,
    },
  });

  const user = await prisma.user.upsert({
    where: { clerkUserId: "clerk_demo_user" },
    update: {},
    create: {
      clerkUserId: "clerk_demo_user",
      email: "user@demo.com",
      fullName: "User Demo",
      role: UserRole.USER,
    },
  });

  // ✅ 2) RESOURCES (salles) + availability
  // disponibilité JSON : { mon: ["09:00-18:00"], tue: ... }
  const room1 = await prisma.resource.upsert({
    where: { id: "room-salle-omega" },
    update: {},
    create: {
      id: "room-salle-omega",
      name: "Salle Omega",
      description:
        "Salle cosy pour 1 à 4 personnes, idéale pour réunion ou focus.",
      enabled: true,
      capacity: 4,
      durationMin: 60,
      durationMax: 180,
      availability: {
        mon: ["09:00-18:00"],
        tue: ["09:00-18:00"],
        wed: ["09:00-18:00"],
        thu: ["09:00-18:00"],
        fri: ["09:00-18:00"],
        sat: ["10:00-16:00"],
        sun: [],
      },
    },
  });

  const room2 = await prisma.resource.upsert({
    where: { id: "room-salle-sigma" },
    update: {},
    create: {
      id: "room-salle-sigma",
      name: "Salle Sigma",
      description:
        "Salle large avec écran, parfaite pour présentation / workshop.",
      enabled: true,
      capacity: 12,
      durationMin: 60,
      durationMax: 240,
      availability: {
        mon: ["08:00-19:00"],
        tue: ["08:00-19:00"],
        wed: ["08:00-19:00"],
        thu: ["08:00-19:00"],
        fri: ["08:00-19:00"],
        sat: [],
        sun: [],
      },
    },
  });

  const room3 = await prisma.resource.upsert({
    where: { id: "desk-open-space" },
    update: {},
    create: {
      id: "desk-open-space",
      name: "Open Space (poste)",
      description: "Poste de travail en open space (réservation à l’heure).",
      enabled: true,
      capacity: 1,
      durationMin: 60,
      durationMax: 480,
      availability: {
        mon: ["09:00-18:00"],
        tue: ["09:00-18:00"],
        wed: ["09:00-18:00"],
        thu: ["09:00-18:00"],
        fri: ["09:00-18:00"],
        sat: ["10:00-16:00"],
        sun: [],
      },
    },
  });

  // ✅ 3) RESERVATIONS DEMO (quelques créneaux déjà pris)
  // Choisis une date "proche" pour tes tests
  const demoDate = new Date();
  demoDate.setDate(demoDate.getDate() + 1); // demain
  const isoDay = demoDate.toISOString().slice(0, 10); // YYYY-MM-DD

  // Nettoyage des anciennes réservations de démo (facultatif)
  // -> si tu veux tout repartir de zéro
  // await prisma.reservation.deleteMany({});

  // Réservation active
  await prisma.reservation.create({
    data: {
      userId: user.id,
      resourceId: room1.id,
      startAt: makeDate(isoDay, "10:00"),
      endAt: makeDate(isoDay, "11:00"),
      status: ReservationStatus.ACTIVE,
    },
  });

  // Réservation modifiée
  await prisma.reservation.create({
    data: {
      userId: user.id,
      resourceId: room2.id,
      startAt: makeDate(isoDay, "14:00"),
      endAt: makeDate(isoDay, "16:00"),
      status: ReservationStatus.MODIFIED,
    },
  });

  // Réservation annulée
  await prisma.reservation.create({
    data: {
      userId: user.id,
      resourceId: room3.id,
      startAt: makeDate(isoDay, "09:00"),
      endAt: makeDate(isoDay, "10:00"),
      status: ReservationStatus.CANCELLED,
    },
  });

  console.log("✅ Demo seed terminé !");
  console.log("👤 Admin:", admin.email);
  console.log("👤 User :", user.email);
  console.log("🏠 Rooms :", room1.name, ",", room2.name, ",", room3.name);
  console.log("📅 Demo date utilisée:", isoDay);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
