import { PrismaClient, UserRole, ClientStatus, ProjectStatus, Priority, MemberStatus, InvoiceStatus, DiscountType, ProformaStatus, BillingCycle, SubscriptionStatus, PackageType, ServiceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper to get random item from array
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Helper to get random number in range
const randomRange = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper to get random date in last 90 days
const randomDateInLast90Days = () => {
  const now = new Date();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(now.getDate() - 90);
  return new Date(ninetyDaysAgo.getTime() + Math.random() * (now.getTime() - ninetyDaysAgo.getTime()));
};

// Helper for dates relative to a start date
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

async function main() {
  console.log('🌱 Clearing existing data...');
  
  // Delete in order to satisfy foreign key constraints
  await prisma.verificationToken.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.proformaItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.proforma.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.projectTeamMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.packageService.deleteMany();
  await prisma.package.deleteMany();
  await prisma.service.deleteMany();
  
  console.log('🌱 Seeding database with 4,000,000 DJF over 3 months...\n');

  // ─── Create Admin User ──────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@hirdan.com' },
    update: {},
    create: {
      email: 'admin@hirdan.com',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      name: 'Admin',
    },
  });
  console.log(`✅ Admin user created: ${admin.email}`);

  // ─── Create Agency Settings ─────────────────────────────────────
  const existingSettings = await prisma.agencySettings.findFirst();
  if (!existingSettings) {
    await prisma.agencySettings.create({
      data: {
        agencyName: 'Hirdan Marketing',
        adminEmail: 'hirdan@agencyflow.com',
        phone: '+1 555-0101',
        website: 'https://hirdanmarketing.com',
        address: '123 Tech Ave, San Francisco, CA 94105',
        currency: 'DJF',
        timezone: 'Africa/Djibouti',
        primaryColor: '#504188',
        taxRate: 15,
        defaultInvoiceNotes: 'Thank you for your business! Please make payment within 14 days.',
        paymentMethods: JSON.stringify(['Bank Transfer', 'Credit Card', 'PayPal', 'Cash']),
        socialLinks: JSON.stringify({
          linkedin: 'https://linkedin.com/company/hirdan',
          twitter: 'https://twitter.com/hirdan',
        }),
        notifications: JSON.stringify({
          emailAlerts: true,
          projectUpdates: true,
          billingAlerts: true,
        }),
      },
    });
    console.log('✅ Agency settings created');
  }

  // ─── Services ───────────────────────────────────────────────────
  const services = [
    { name: 'Full SEO Audit', category: 'SEO', basePrice: 150000 },
    { name: 'Web Development', category: 'Tech', basePrice: 450000 },
    { name: 'Branding Pack', category: 'Design', basePrice: 200000 },
    { name: 'Ads Management', category: 'Marketing', basePrice: 120000 },
  ];
  for (const s of services) {
    await prisma.service.create({ data: { ...s, description: `High quality ${s.name} service.`, status: ServiceStatus.AVAILABLE } });
  }

  // ─── Team Members ───────────────────────────────────────────────
  const teams = [
    { name: 'Omar Farah', email: 'omar@hirdan.com', role: 'Lead Developer', department: 'Engineering' },
    { name: 'Layla Ahmed', email: 'layla@hirdan.com', role: 'Art Director', department: 'Design' },
    { name: 'Hassan Idris', email: 'hassan@hirdan.com', role: 'Strategy Head', department: 'Marketing' },
  ];
  const seededTeam = [];
  for (const t of teams) {
    seededTeam.push(await prisma.teamMember.create({ data: { ...t, status: MemberStatus.ACTIVE, hourlyRate: 15000 } }));
  }

  // ─── Precise Revenue Distribution Setup ─────────────────────────
  // Target: 4,000,000 DJF Total Paid
  // Jan: 1,000,000
  // Feb: 1,200,000
  // Mar: 1,800,000 (Current Month)

  const roadmap = [
    { month: 'January', year: 2026, target: 100000000, clients: [
      { company: 'Port de Djibouti', industry: 'Logistics', email: 'billing@dpworld.dj', revenue: 60000000 },
      { company: 'BCEAO', industry: 'Finance', email: 'finance@bceao.int', revenue: 40000000 },
    ]},
    { month: 'February', year: 2026, target: 120000000, clients: [
      { company: 'Sheraton Hotel', industry: 'Hospitality', email: 'accounts@sheraton.dj', revenue: 70000000 },
      { company: 'Salaam Bank', industry: 'Finance', email: 'it@salaambank.dj', revenue: 50000000 },
    ]},
    { month: 'March', year: 2026, target: 180000000, clients: [
      { company: 'Evatis', industry: 'Telecom', email: 'support@evatis.dj', revenue: 100000000 },
      { company: 'Hali Group', industry: 'Retail', email: 'ceo@haligroup.com', revenue: 80000000 },
    ]}
  ];

  for (const period of roadmap) {
    const monthMap: Record<string, number> = { 'January': 0, 'February': 1, 'March': 2 };
    const monthIdx = monthMap[period.month];
    
    for (const cData of period.clients) {
      const client = await prisma.client.create({
        data: {
          name: cData.company.split(' ')[0],
          company: cData.company,
          email: cData.email,
          status: ClientStatus.ACTIVE,
          industry: cData.industry,
          phone: `+253 21-${randomRange(35, 45)}-${randomRange(10, 99)}`,
          city: 'Djibouti City',
          country: 'Djibouti'
        }
      });

      // Project for each client
      const projDate = new Date(2026, monthIdx, randomRange(1, 5));
      const project = await prisma.project.create({
        data: {
          clientId: client.id,
          name: `${cData.company} Digital Ecosystem`,
          status: monthIdx < 2 ? ProjectStatus.COMPLETED : ProjectStatus.IN_PROGRESS,
          priority: Priority.HIGH,
          progress: monthIdx < 2 ? 100 : 45,
          budget: cData.revenue + 100000, // Budget slightly higher than this invoice
          startDate: projDate,
          dueDate: addDays(projDate, 45),
          description: `Comprehensive transformation for ${cData.company}.`
        }
      });

      // Assign one team member
      await prisma.projectTeamMember.create({
        data: { projectId: project.id, memberId: seededTeam[randomRange(0, 2)].id }
      });

      // Invoice for the target revenue
      const invoiceDate = new Date(2026, monthIdx, randomRange(15, 25));
      const invoice = await prisma.invoice.create({
        data: {
          clientId: client.id,
          invoiceNumber: `INV-${monthIdx + 1}${randomRange(100, 999)}`,
          amount: cData.revenue,
          status: InvoiceStatus.PAID,
          date: invoiceDate,
          dueDate: addDays(invoiceDate, 14),
          taxRate: 15,
          paymentMethod: 'Bank Transfer'
        }
      });

      await prisma.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          description: `Contract Milestone: ${project.name}`,
          quantity: 1,
          unitPrice: cData.revenue
        }
      });

      // Proforma for extra variety
      if (monthIdx === 2) {
        await prisma.proforma.create({
          data: {
            clientId: client.id,
            proformaNumber: `PRO-26${randomRange(1000, 9999)}`,
            amount: 25000000,
            status: ProformaStatus.SENT,
            date: new Date(),
            dueDate: addDays(new Date(), 30)
          }
        });
      }
    }
  }

  // Add 2 overdue invoices to March for realism
  const overdueClient = await prisma.client.findFirst({ where: { company: 'Evatis' }});
  if (overdueClient) {
    await prisma.invoice.create({
      data: {
        clientId: overdueClient.id,
        invoiceNumber: `INV-OVER-01`,
        amount: 35000000,
        status: InvoiceStatus.OVERDUE,
        date: new Date(2026, 1, 1),
        dueDate: new Date(2026, 1, 15),
      }
    });
  }

  console.log('✅ Seeding distribution complete.');
  console.log('📊 Actual Seeded Revenue: 4,000,000 DJF Paid');
  console.log('📈 Distribution: Jan(1M), Feb(1.2M), Mar(1.8M)');

  console.log('\n📋 Admin credentials:');
  console.log('   Email:    admin@hirdan.com');
  console.log('   Password: admin123');
  console.log('\n⚠️  Ensure you use the provided currency and timezone in Agency Settings.\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

