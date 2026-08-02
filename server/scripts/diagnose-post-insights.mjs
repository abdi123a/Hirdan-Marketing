/**
 * Why is a post showing zero metrics?
 *
 * Prints the RAW Graph API response (or error) for every endpoint the insight
 * sync uses, per destination. The sync swallows these errors by design, which
 * makes a permission gap look identical to a post that genuinely got no
 * engagement — this script is how you tell them apart.
 *
 * Run on the server, where the real tokens and DATABASE_URL live:
 *
 *   cd /home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com
 *   node scripts/diagnose-post-insights.mjs            # 5 most recent published posts
 *   node scripts/diagnose-post-insights.mjs <postId>   # one specific post
 */
import '../dist/config/env.js';
import { prisma } from '../dist/lib/prisma.js';
import { decryptToken } from '../dist/lib/social/token-crypto.service.js';

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v20.0'}`;
const postIdArg = process.argv[2];

async function graph(path, params) {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url);
    const body = await res.json();
    if (!res.ok || body.error) {
      const e = body.error || {};
      return { ok: false, detail: `HTTP ${res.status} — ${e.message || JSON.stringify(body)}${e.code != null ? ` (code=${e.code}${e.error_subcode != null ? `, subcode=${e.error_subcode}` : ''})` : ''}` };
    }
    return { ok: true, body };
  } catch (err) {
    return { ok: false, detail: `network: ${err.message}` };
  }
}

const show = (label, r) =>
  console.log(`   ${r.ok ? '✅' : '❌'} ${label}\n      ${r.ok ? JSON.stringify(r.body) : r.detail}`);

const posts = await prisma.socialPost.findMany({
  where: postIdArg ? { id: postIdArg } : { status: 'PUBLISHED' },
  orderBy: { publishedAt: 'desc' },
  take: postIdArg ? 1 : 5,
  include: {
    insights: true,
    destinations: { include: { socialAccount: true } },
  },
});

if (!posts.length) {
  console.log(postIdArg ? `No post with id ${postIdArg}` : 'No published posts found.');
  await prisma.$disconnect();
  process.exit(0);
}

for (const post of posts) {
  console.log('\n' + '='.repeat(78));
  console.log(`POST ${post.id}`);
  console.log(`  caption : ${(post.caption || '(none)').slice(0, 70)}`);
  console.log(`  media   : ${post.mediaType || 'n/a'}   published: ${post.publishedAt}`);
  console.log(`  stored insight rows: ${post.insights.length ? post.insights.map((i) => `${i.platform}(v=${i.views},l=${i.likes},r=${i.reach},i=${i.impressions})`).join(', ') : 'NONE'}`);

  if (!post.destinations.length) {
    console.log('  ⚠️  NO DESTINATIONS — nothing can ever be fetched for this post.');
    continue;
  }

  for (const d of post.destinations) {
    const platform = d.platform.toLowerCase();
    console.log(`\n  → ${d.platform}  @${d.socialAccount?.platformUsername}  status=${d.status}`);
    console.log(`     platformPostId: ${d.platformPostId || '(null — never captured at publish time)'}`);
    console.log(`     accountHealth : ${d.socialAccount?.healthStatus}  ${d.socialAccount?.healthMessage || ''}`);
    if (d.lastError) console.log(`     lastError     : ${d.lastError}`);
    if (!d.platformPostId || !d.socialAccount?.accessTokenEnc) continue;

    let token;
    try {
      token = decryptToken(d.socialAccount.accessTokenEnc);
    } catch (err) {
      console.log(`     ❌ token decrypt failed: ${err.message}`);
      continue;
    }
    if (token.startsWith('mock_')) {
      console.log('     (mock token — skipping live calls)');
      continue;
    }

    const id = d.platformPostId;
    if (platform === 'facebook') {
      const fields = await graph(id, {
        fields: 'reactions.summary(true),comments.summary(true),shares,page_story_id',
        access_token: token,
      });
      show('fields (reactions/comments/shares/page_story_id)', fields);

      const insightsId = fields.ok && fields.body.page_story_id ? fields.body.page_story_id : id;
      if (insightsId !== id) console.log(`      ↳ page_story_id maps this to Page post ${insightsId}`);

      show('/insights', await graph(`${insightsId}/insights`, {
        metric: 'post_impressions,post_impressions_unique,post_video_views,post_reactions_by_type_total',
        access_token: token,
      }));
      for (const batch of [
        'total_video_views,total_video_views_unique,total_video_impressions',
        'blue_reels_play_count',
        'post_video_likes_by_reaction_type',
      ]) {
        show(`/video_insights [${batch}]`, await graph(`${id}/video_insights`, { metric: batch, access_token: token }));
      }
    } else if (platform === 'instagram') {
      show('fields (like_count/comments_count/media_product_type)', await graph(id, {
        fields: 'like_count,comments_count,media_type,media_product_type,permalink',
        access_token: token,
      }));
      show('/insights [reach,saved,shares,views]', await graph(`${id}/insights`, {
        metric: 'reach,saved,shares,views',
        access_token: token,
      }));
      show('/insights [reach,saved,shares]', await graph(`${id}/insights`, {
        metric: 'reach,saved,shares',
        access_token: token,
      }));
    } else {
      console.log('     (no live post-insight path implemented for this platform)');
    }
  }
}

console.log('\n' + '='.repeat(78));
console.log('Read the ❌ lines: they are the reason the tiles show 0.');
await prisma.$disconnect();
