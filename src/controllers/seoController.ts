const { Influencer, User, SeoPage, InfluencerAdMedia } = require('../models');
const { slugify } = require('../utils/slugify');
const { Op } = require('sequelize');

function envBaseUrl() {
  const base = (process.env.BASE_URL || '').trim();
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function envSiteName() {
  return (process.env.SITE_NAME || 'InfluKaburlu').trim() || 'InfluKaburlu';
}

function defaultMetaTitle() {
  return (process.env.DEFAULT_META_TITLE || '').trim() || 'Best Influencer Marketing Platform in India';
}

function defaultMetaDescription() {
  return (process.env.DEFAULT_META_DESCRIPTION || '').trim() || 'Find verified influencers for brand collaborations.';
}

function personSchema(influencer, userName) {
  const base = envBaseUrl();
  const slug = influencer.slug || null;
  const url = influencer.canonicalUrl || (base && slug ? `${base}/influencer/${slug}` : null);

  const sameAs = [];
  const links = influencer.socialLinks && typeof influencer.socialLinks === 'object' ? influencer.socialLinks : {};
  for (const k of Object.keys(links)) {
    const v = links[k];
    if (!v) continue;
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) sameAs.push(v);
  }

  const badge = Array.isArray(influencer.badges) && influencer.badges.length ? influencer.badges[0] : null;
  const title = badge ? `${badge} Influencer` : 'Influencer';

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: userName || influencer.handle || 'Influencer',
    image: influencer.profilePicUrl || undefined,
    jobTitle: title,
    url: url || undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  };
}

function buildRobotsDirectives(indexed: any) {
  if (indexed === true) {
    // Common modern directives for rich preview.
    return 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
  }
  return 'noindex,nofollow';
}

function safeString(v: any) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function normalizeSameAs(influencer: any) {
  const sameAs: string[] = [];
  const links = influencer.socialLinks && typeof influencer.socialLinks === 'object' ? influencer.socialLinks : {};
  for (const k of Object.keys(links)) {
    const v = links[k];
    if (!v) continue;
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) sameAs.push(v);
  }
  return sameAs;
}

function pickOgImage(influencer: any, videos: any[]) {
  if (influencer.profilePicUrl) return influencer.profilePicUrl;
  const v = Array.isArray(videos) ? videos.find(x => x.thumbnailUrl) : null;
  return v?.thumbnailUrl || null;
}

function videoObjects(baseUrl: string | null, canonical: string | null, videos: any[], personId: string | null) {
  if (!canonical || !Array.isArray(videos) || videos.length === 0) return [];
  const out: any[] = [];
  for (const v of videos) {
    const guid = safeString(v.guid);
    const embedUrl = safeString(v.playbackUrl);
    if (!guid || !embedUrl) continue;
    const uploadDate = v.createdAt ? new Date(v.createdAt).toISOString() : undefined;
    const duration = (typeof v.durationSec === 'number' && v.durationSec > 0) ? `PT${Math.round(v.durationSec)}S` : undefined;
    const title = safeString(v.meta?.title) || safeString(v.meta?.name) || 'Influencer video';
    const description = safeString(v.meta?.description);
    const thumb = safeString(v.thumbnailUrl) || safeString(v.meta?.thumbnailUrl);
    out.push({
      '@type': 'VideoObject',
      '@id': `${canonical}#video-${guid}`,
      name: title,
      description: description || undefined,
      thumbnailUrl: thumb ? [thumb] : undefined,
      uploadDate,
      duration,
      embedUrl,
      url: canonical,
      creator: personId ? { '@id': personId } : undefined
    });
  }
  return out;
}

function breadcrumbSchema(baseUrl: string | null, canonical: string | null, title: string) {
  if (!baseUrl || !canonical) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: baseUrl
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Influencers',
        item: `${baseUrl}/influencer`
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: title,
        item: canonical
      }
    ]
  };
}

// PUBLIC: Influencer SEO bundle for SSR pages (meta + JSON-LD + media)
// This is designed for Next.js/SSR so Google can crawl an HTML page that embeds the returned meta + JSON-LD.
exports.getInfluencerSeoBundle = async (req, res) => {
  try {
    const slug = slugify(req.params.slug || '');
    if (!slug) return res.status(400).json({ error: 'invalid_slug' });

    const infl = await Influencer.findOne({ where: { slug }, include: [{ model: User, attributes: ['name'] }] });
    if (!infl) return res.status(404).json({ error: 'not_found' });

    const site = envSiteName();
    const base = envBaseUrl();

    const userName = infl.User?.name || null;
    const displayName = userName || infl.handle || 'Influencer';

    const title = infl.seoTitle || `${displayName} | ${site}`;
    const description = infl.seoDescription || safeString(infl.bio) || defaultMetaDescription();
    const keywords = safeString(infl.seoKeywords) || safeString(process.env.DEFAULT_META_KEYWORDS) || '';

    const canonical = infl.canonicalUrl || (base ? `${base}/influencer/${slug}` : null);

    // Pull recent public-facing videos (canonical media records)
    const videoRows = await InfluencerAdMedia.findAll({
      where: {
        influencerId: infl.id,
        playbackUrl: { [Op.ne]: null },
      },
      order: [['createdAt', 'DESC']],
      limit: 12,
    });

    const videos = (videoRows || [])
      .map(r => r.toJSON())
      .filter(v => !!v.playbackUrl)
      // Prefer ready videos for SEO snippets
      .sort((a, b) => {
        const as = a.status === 'ready' ? 0 : 1;
        const bs = b.status === 'ready' ? 0 : 1;
        return as - bs;
      })
      .slice(0, 8);

    const ogImage = pickOgImage(infl, videos);
    const robots = buildRobotsDirectives(infl.indexed);

    const sameAs = normalizeSameAs(infl);
    const badge = Array.isArray(infl.badges) && infl.badges.length ? infl.badges[0] : null;
    const jobTitle = badge ? `${badge} Influencer` : 'Influencer';

    const personId = canonical ? `${canonical}#person` : null;

    // Start with a Person schema (from DB overrides if present)
    const schemaFromDb = infl.schemaJson && typeof infl.schemaJson === 'object' ? infl.schemaJson : null;
    const basePerson = schemaFromDb && Object.keys(schemaFromDb).length
      ? schemaFromDb
      : {
          '@context': 'https://schema.org',
          '@type': 'Person',
          '@id': personId || undefined,
          name: displayName,
          alternateName: infl.handle ? `@${String(infl.handle).replace(/^@/, '')}` : undefined,
          description,
          image: infl.profilePicUrl || undefined,
          jobTitle,
          url: canonical || undefined,
          sameAs: sameAs.length ? sameAs : undefined,
        };

    // Add a ProfilePage that points to the Person
    const pageSchema = canonical
      ? {
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          '@id': canonical,
          url: canonical,
          name: title,
          description,
          isPartOf: base ? { '@type': 'WebSite', '@id': `${base}#website`, url: base, name: site } : undefined,
          primaryImageOfPage: ogImage ? { '@type': 'ImageObject', url: ogImage } : undefined,
          mainEntity: personId ? { '@id': personId } : undefined,
        }
      : null;

    // Video objects + an ItemList wrapper (helps Google understand a gallery)
    const videoObjs = videoObjects(base, canonical, videos, personId);
    const videoListSchema = (canonical && videoObjs.length)
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          '@id': `${canonical}#videos`,
          name: `${displayName} videos`,
          itemListElement: videoObjs.map((vo, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            item: vo
          }))
        }
      : null;

    const breadcrumb = breadcrumbSchema(base, canonical, displayName);

    const schema: any[] = [];
    if (pageSchema) schema.push(pageSchema);
    if (breadcrumb) schema.push(breadcrumb);
    schema.push(basePerson);
    if (videoListSchema) schema.push(videoListSchema);

    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.json({
      meta: {
        title,
        description,
        keywords,
        canonical,
        robots,
        og: {
          title,
          description,
          url: canonical,
          type: 'profile',
          image: ogImage
        },
        twitter: {
          card: ogImage ? 'summary_large_image' : 'summary',
          title,
          description,
          image: ogImage
        }
      },
      profile: {
        slug,
        name: displayName,
        handle: infl.handle || null,
        bio: safeString(infl.bio),
        profilePicUrl: infl.profilePicUrl || null,
        verificationStatus: infl.verificationStatus || 'none',
        badges: Array.isArray(infl.badges) ? infl.badges : [],
        socialLinks: infl.socialLinks && typeof infl.socialLinks === 'object' ? infl.socialLinks : {},
      },
      media: {
        videos: videos.map(v => ({
          guid: v.guid,
          playbackUrl: v.playbackUrl,
          thumbnailUrl: v.thumbnailUrl || v.meta?.thumbnailUrl || null,
          status: v.status || null,
          createdAt: v.createdAt || null,
          durationSec: (typeof v.durationSec === 'number') ? v.durationSec : null,
          title: v.meta?.title || null,
          description: v.meta?.description || null,
        })),
        images: [ogImage].filter(Boolean)
      },
      schema
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

// PUBLIC: Get Influencer SEO by slug
exports.getInfluencerSeo = async (req, res) => {
  try {
    const slug = slugify(req.params.slug || '');
    if (!slug) return res.status(400).json({ error: 'invalid_slug' });

    const infl = await Influencer.findOne({ where: { slug }, include: [{ model: User, attributes: ['name'] }] });
    if (!infl) return res.status(404).json({ error: 'not_found' });

    const site = envSiteName();
    const base = envBaseUrl();

    const userName = infl.User?.name || null;
    const title = infl.seoTitle || (userName ? `${userName} | ${site}` : defaultMetaTitle());
    const description = infl.seoDescription || defaultMetaDescription();

    const canonical = infl.canonicalUrl || (base ? `${base}/influencer/${slug}` : null);

    const schemaFromDb = infl.schemaJson && typeof infl.schemaJson === 'object' ? infl.schemaJson : null;
    const schema = schemaFromDb && Object.keys(schemaFromDb).length ? schemaFromDb : personSchema(infl, userName);

    return res.json({
      title,
      description,
      canonical,
      schema,
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

// PUBLIC: Get Page/Blog SEO by slug
exports.getPageSeo = async (req, res) => {
  try {
    const slug = slugify(req.params.slug || '');
    if (!slug) return res.status(400).json({ error: 'invalid_slug' });

    const row = await SeoPage.findOne({ where: { slug } });
    if (!row) return res.status(404).json({ error: 'not_found' });

    return res.json({
      metaTitle: row.metaTitle || defaultMetaTitle(),
      metaDescription: row.metaDescription || defaultMetaDescription(),
      metaKeywords: row.metaKeywords || '',
      ogImage: row.ogImage || null,
      slug: row.slug,
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

// ADMIN: Upsert influencer SEO (by ULID or numeric id)
exports.adminUpsertInfluencerSeo = async (req, res) => {
  try {
    const { id } = req.params;
    const infl = /^\d+$/.test(String(id))
      ? await Influencer.findByPk(id)
      : await Influencer.findOne({ where: { ulid: String(id) } });

    if (!infl) return res.status(404).json({ error: 'not_found' });

    const body = req.body || {};

    if (body.slug != null) {
      const s = slugify(body.slug);
      if (!s) return res.status(400).json({ error: 'invalid_slug' });
      infl.slug = s;
    }

    if (body.seo_title != null || body.seoTitle != null) infl.seoTitle = String(body.seo_title ?? body.seoTitle);
    if (body.seo_description != null || body.seoDescription != null) infl.seoDescription = String(body.seo_description ?? body.seoDescription);
    if (body.seo_keywords != null || body.seoKeywords != null) infl.seoKeywords = String(body.seo_keywords ?? body.seoKeywords);
    if (body.canonical_url != null || body.canonicalUrl != null) infl.canonicalUrl = String(body.canonical_url ?? body.canonicalUrl);
    if (body.schema_json != null || body.schemaJson != null) infl.schemaJson = body.schema_json ?? body.schemaJson;
    if (body.indexed != null) infl.indexed = !!body.indexed;

    // Auto-generate slug if missing and handle exists
    if (!infl.slug && infl.handle) {
      infl.slug = slugify(String(infl.handle).replace(/^@/, ''));
    }

    await infl.save();
    return res.json({ ok: true, influencer: { ulid: infl.ulid, slug: infl.slug, indexed: infl.indexed } });
  } catch (err) {
    // Unique slug conflict
    if (String(err?.name) === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'slug_taken' });
    }
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

// ADMIN: Upsert page SEO by slug
exports.adminUpsertPageSeo = async (req, res) => {
  try {
    const slug = slugify(req.params.slug || '');
    if (!slug) return res.status(400).json({ error: 'invalid_slug' });

    const body = req.body || {};

    const payload = {
      slug,
      metaTitle: body.meta_title ?? body.metaTitle ?? null,
      metaDescription: body.meta_description ?? body.metaDescription ?? null,
      metaKeywords: body.meta_keywords ?? body.metaKeywords ?? null,
      ogImage: body.og_image ?? body.ogImage ?? null,
    };

    const [row] = await SeoPage.findOrCreate({ where: { slug }, defaults: payload });
    await row.update(payload);

    return res.json({ ok: true, page: { slug: row.slug } });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};
