import { prisma } from '../lib/prisma.js';
import { encryptToken } from '../lib/social/token-crypto.service.js';

async function seed() {
  console.log('🌱 Starting Social Media Mock Seeding...');

  // 1. Find or create a client
  let client = await prisma.client.findFirst();
  if (!client) {
    client = await prisma.client.create({
      data: {
        name: 'Hirdan Marketing Demo Client',
        company: 'Acme Corporation',
        email: 'acme@hirdanmarketing.com',
        phone: '123-456-7890',
      },
    });
    console.log(`✅ Created Demo Client: ${client.company}`);
  } else {
    console.log(`✅ Using Existing Client: ${client.company}`);
  }

  // Find existing mock accounts to delete their dependent relations
  const existingAccounts = await prisma.socialAccount.findMany({
    where: { clientId: client.id },
  });
  const accountIds = existingAccounts.map(a => a.id);

  // Find posts to delete their insights
  const existingPosts = await prisma.socialPost.findMany({
    where: { clientId: client.id },
  });
  const postIds = existingPosts.map(p => p.id);

  // Clear existing mock social data for this client flatly so we can re-seed cleanly
  await prisma.accountInsightDaily.deleteMany({
    where: { socialAccountId: { in: accountIds } },
  });
  await prisma.postInsight.deleteMany({
    where: { postId: { in: postIds } },
  });
  await prisma.socialPostDestination.deleteMany({
    where: { postId: { in: postIds } },
  });
  await prisma.socialAccount.deleteMany({
    where: { id: { in: accountIds } },
  });
  await prisma.socialPost.deleteMany({
    where: { id: { in: postIds } },
  });
  await prisma.socialCampaign.deleteMany({
    where: { clientId: client.id },
  });

  // 2. Create mock connected accounts
  const platforms = [
    { name: 'Facebook Page', platform: 'facebook', group: 'Acme Corporate', color: 'blue', username: 'acme.co' },
    { name: 'Instagram Business', platform: 'instagram', group: 'Acme Corporate', color: 'purple', username: 'acme_corporate' },
    { name: 'LinkedIn Company', platform: 'linkedin', group: 'Acme Corporate', color: 'blue', username: 'acme-technologies' },
    { name: 'YouTube Channel', platform: 'youtube', group: 'Acme Media', color: 'red', username: 'AcmeTechTV' },
  ];

  const accounts = [];
  for (const p of platforms) {
    const acc = await prisma.socialAccount.create({
      data: {
        clientId: client.id,
        platform: p.platform,
        platformUserId: `mock_user_${p.platform}_${Math.floor(Math.random() * 100000)}`,
        platformUsername: p.username,
        displayName: p.name,
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${p.username}`,
        accessTokenEnc: encryptToken('mock_access_token_data'),
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        groupName: p.group,
        groupColor: p.color,
        healthStatus: 'healthy',
        isActive: true,
      },
    });
    accounts.push(acc);
    console.log(`✅ Created Mock Account: ${acc.displayName} (${acc.platform})`);
  }

  // 3. Populate 30 days of daily metrics (growth curve)
  const baseFollowers: Record<string, number> = {
    facebook: 12500,
    instagram: 24300,
    linkedin: 8400,
    youtube: 42000,
  };

  const dailyGrowth: Record<string, number> = {
    facebook: 15,
    instagram: 45,
    linkedin: 20,
    youtube: 110,
  };

  console.log('📈 Seeding 30 days of metric history...');
  for (let i = 30; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

    for (const acc of accounts) {
      const base = baseFollowers[acc.platform] || 5000;
      const growth = dailyGrowth[acc.platform] || 10;
      
      const dailyFollowers = base + (30 - i) * growth + Math.floor(Math.random() * 20 - 10);
      const reach = growth * 100 + Math.floor(Math.random() * 1500);
      const impressions = reach * 1.5 + Math.floor(Math.random() * 2000);
      const profileVisits = Math.floor(reach * 0.05) + Math.floor(Math.random() * 50);

      await prisma.accountInsightDaily.create({
        data: {
          socialAccountId: acc.id,
          date,
          followers: dailyFollowers,
          reach,
          impressions,
          profileVisits,
          engagementRate: 2.5 + Math.random() * 3,
        },
      });
    }
  }

  // 4. Create mock published posts with insights
  const campaign = await prisma.socialCampaign.create({
    data: {
      clientId: client.id,
      name: 'Product Launch Q3',
      status: 'ACTIVE',
    },
  });

  const posts = [
    {
      caption: '🚀 We are thrilled to announce the official release of our brand new enterprise platform! Designed to bring speed and ease of use to your workflows. Check it out today!',
      mediaUrls: ['https://images.unsplash.com/photo-1551434678-e076c223a692?w=800'],
      likes: 450, comments: 42, shares: 18, saved: 10,
    },
    {
      caption: 'Meet the team behind our latest software suite. Innovation starts with passion and dedication. We appreciate all the hard work that made this possible! ❤️',
      mediaUrls: ['https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800'],
      likes: 890, comments: 120, shares: 35, saved: 45,
    },
    {
      caption: 'Quick tips: How to automate 80% of your weekly social content planning without sacrificing quality or brand voice. Read our blog post link in bio!',
      mediaUrls: ['https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800'],
      likes: 310, comments: 28, shares: 64, saved: 82,
    },
  ];

  console.log('📝 Seeding published posts and platform insights...');
  for (let idx = 0; idx < posts.length; idx++) {
    const p = posts[idx];
    const postDate = new Date();
    postDate.setDate(postDate.getDate() - (idx * 4 + 2));

    const post = await prisma.socialPost.create({
      data: {
        clientId: client.id,
        campaignId: campaign.id,
        caption: p.caption,
        mediaUrls: p.mediaUrls,
        mediaType: 'image',
        status: 'PUBLISHED',
        publishedAt: postDate,
        destinations: {
          create: accounts.map(acc => ({
            socialAccountId: acc.id,
            platform: acc.platform,
            status: 'PUBLISHED',
            platformPostId: `mock_post_${acc.platform}_${Math.floor(Math.random() * 100000)}`,
            publishedAt: postDate,
          })),
        },
      },
      include: {
        destinations: true,
      },
    });

    // Create post-level insights for each destination
    for (const dest of post.destinations) {
      await prisma.postInsight.create({
        data: {
          postId: post.id,
          platform: dest.platform,
          likes: p.likes + Math.floor(Math.random() * 50 - 25),
          comments: p.comments + Math.floor(Math.random() * 10 - 5),
          shares: p.shares + Math.floor(Math.random() * 8 - 4),
          saved: p.saved + Math.floor(Math.random() * 6 - 3),
        },
      });
    }
  }

  console.log('🎉 Social Media Mock Seeding Completed Successfully!');
}

seed()
  .catch((err) => {
    console.error('❌ Seeding Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
