const { Influencer, User, SeoPage } = require('../models');
const { slugify } = require('../utils/slugify');

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
