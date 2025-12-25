// @ts-nocheck
const fs = require('fs');
const path = require('path');

const bearerAuth = [{ bearerAuth: [] }];

function jsonResponse(schemaRefOrSchema, example) {
  const schema =
    typeof schemaRefOrSchema === 'string'
      ? { $ref: schemaRefOrSchema }
      : schemaRefOrSchema;
  const content = { 'application/json': { schema } };
  if (example !== undefined) content['application/json'].example = example;
  return { description: 'OK', content };
}

const defaultOpenapi = {
  openapi: '3.0.3',
  info: {
    title: 'Kaburlu Backend API',
    version: '1.0.0',
  },
  servers: [
    { url: 'http://localhost:4000' },
    { url: 'https://influapi.kaburlumedia.com' },
  ],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Ads' },
    { name: 'Applications' },
    { name: 'Influencers' },
    { name: 'Photoshoots' },
    { name: 'Posts' },
    { name: 'Profile Builder' },
    { name: 'Locations' },
    { name: 'Media' },
    { name: 'Brands' },
    { name: 'PR' },
    { name: 'Uploads' },
    { name: 'Discovery' },
    { name: 'Categories' },
    { name: 'Bunny' },
    { name: 'Landing' },
    { name: 'Admin' },
    { name: 'Superadmin' },
    { name: 'DOP' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        security: [],
        responses: {
          200: jsonResponse(
            {
              type: 'object',
              properties: {
                ok: { type: 'boolean' },
                time: { type: 'string', format: 'date-time' },
              },
            },
            { ok: true, time: new Date().toISOString() }
          ),
        },
      },
    },
    '/api': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        security: [],
        responses: {
          200: jsonResponse(
            {
              type: 'object',
              properties: {
                ok: { type: 'boolean' },
                version: { type: 'string' },
              },
            },
            { ok: true, version: 'kaburlu-backend-v2' }
          ),
        },
      },
    },

    // Auth
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthRegisterRequest' },
            },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/AuthResponse'),
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login (password)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthLoginRequest' },
            },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/AuthResponse'),
        },
      },
    },
    '/api/auth/login-mobile': {
      post: {
        tags: ['Auth'],
        summary: 'Login (mobile / MPIN flow)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthMobileLoginRequest' },
            },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/AuthResponse'),
        },
      },
    },
    '/api/auth/request-mpin-reset': {
      post: {
        tags: ['Auth'],
        summary: 'Request MPIN reset',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MpinResetRequest' },
            },
          },
        },
        responses: {
          200: jsonResponse({ type: 'object', properties: { ok: { type: 'boolean' } } }, { ok: true }),
        },
      },
    },
    '/api/auth/verify-mpin-reset': {
      post: {
        tags: ['Auth'],
        summary: 'Verify MPIN reset',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MpinResetVerifyRequest' },
            },
          },
        },
        responses: {
          200: jsonResponse({ type: 'object', properties: { ok: { type: 'boolean' } } }, { ok: true }),
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthRefreshRequest' },
            },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/AuthResponse'),
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout (invalidate refresh token)',
        security: [],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { type: 'object' },
            },
          },
        },
        responses: {
          200: jsonResponse({ type: 'object', properties: { ok: { type: 'boolean' } } }, { ok: true }),
        },
      },
    },
    '/api/auth/logout-all': {
      post: {
        tags: ['Auth'],
        summary: 'Logout all sessions',
        security: bearerAuth,
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { type: 'object' },
            },
          },
        },
        responses: {
          200: jsonResponse({ type: 'object', properties: { ok: { type: 'boolean' } } }, { ok: true }),
        },
      },
    },

    // Ads
    '/api/ads': {
      get: {
        tags: ['Ads'],
        summary: 'List ads',
        security: [],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: jsonResponse({ type: 'array', items: { $ref: '#/components/schemas/Ad' } }),
        },
      },
      post: {
        tags: ['Ads'],
        summary: 'Create ad (brand)',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AdCreateRequest' } },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/Ad'),
        },
      },
    },
    '/api/ads/feed': {
      post: {
        tags: ['Ads'],
        summary: 'Ads feed (filters)',
        security: [],
        requestBody: {
          required: false,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AdsFeedRequest' } },
          },
        },
        responses: {
          200: jsonResponse({ type: 'array', items: { $ref: '#/components/schemas/Ad' } }),
        },
      },
    },
    '/api/ads/{id}': {
      put: {
        tags: ['Ads'],
        summary: 'Update ad (brand)',
        security: bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AdUpdateRequest' } },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/Ad'),
        },
      },
    },
    '/api/ads/{id}/payment/initiate': {
      post: {
        tags: ['Ads'],
        summary: 'Initiate payment (Razorpay)',
        security: bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PaymentInitiateRequest' } },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/PaymentInitiateResponse'),
        },
      },
    },
    '/api/ads/payment/confirm': {
      post: {
        tags: ['Ads'],
        summary: 'Confirm payment',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PaymentConfirmRequest' } },
          },
        },
        responses: {
          200: jsonResponse({ type: 'object', properties: { success: { type: 'boolean' } } }, { success: true }),
        },
      },
    },

    // Applications
    '/api/applications/{adId}/apply': {
      post: {
        tags: ['Applications'],
        summary: 'Apply to an ad (influencer)',
        security: bearerAuth,
        parameters: [{ name: 'adId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: false,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ApplicationApplyRequest' } },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/Application'),
        },
      },
    },
    '/api/applications/submit/{appId}': {
      post: {
        tags: ['Applications'],
        summary: 'Submit deliverable (influencer)',
        security: bearerAuth,
        parameters: [{ name: 'appId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/DeliverableSubmitRequest' } },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/Application'),
        },
      },
    },
    '/api/applications/approve/{appId}': {
      post: {
        tags: ['Applications'],
        summary: 'Approve and payout (brand/admin)',
        security: bearerAuth,
        parameters: [{ name: 'appId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: jsonResponse('#/components/schemas/ApproveAndPayoutResponse'),
        },
      },
    },

    // Influencers
    '/api/influencers/me': {
      get: {
        tags: ['Influencers'],
        summary: 'Get current user influencer profile',
        security: bearerAuth,
        responses: {
          200: jsonResponse('#/components/schemas/InfluencerMe'),
        },
      },
      put: {
        tags: ['Influencers'],
        summary: 'Update influencer profile',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/InfluencerUpdateRequest' } },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/InfluencerMe'),
        },
      },
    },
    '/api/influencers/dashboard': {
      get: {
        tags: ['Influencers'],
        summary: 'Influencer dashboard',
        security: bearerAuth,
        responses: {
          200: jsonResponse({ type: 'object' }),
        },
      },
    },
    '/api/influencers/me/profile-pic': {
      put: {
        tags: ['Influencers'],
        summary: 'Update profile picture',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { type: 'object', properties: { imageUrl: { type: 'string' } }, required: ['imageUrl'] } },
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { file: { type: 'string', format: 'binary' } },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/InfluencerMe'),
        },
      },
    },
    '/api/influencers/me/pricing': {
      get: {
        tags: ['Influencers'],
        summary: 'Get influencer pricing',
        security: bearerAuth,
        responses: {
          200: jsonResponse('#/components/schemas/InfluencerPricing'),
        },
      },
      put: {
        tags: ['Influencers'],
        summary: 'Update influencer pricing',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/InfluencerPricing' } },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/InfluencerPricing'),
        },
      },
      post: {
        tags: ['Influencers'],
        summary: 'Update influencer pricing (alias)',
        description: 'Alias of PUT /api/influencers/me/pricing for clients that use POST.',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/InfluencerPricing' } },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/InfluencerPricing'),
        },
      },
    },
    '/api/influencers/me/kyc': {
      get: {
        tags: ['Influencers'],
        summary: 'Get KYC',
        security: bearerAuth,
        responses: {
          200: jsonResponse('#/components/schemas/KycOutput'),
        },
      },
      put: {
        tags: ['Influencers'],
        summary: 'Update KYC',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/KycInput' } },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/KycOutput'),
        },
      },
    },
    '/api/influencers/me/payment-methods': {
      get: {
        tags: ['Influencers'],
        summary: 'List payment methods',
        security: bearerAuth,
        responses: {
          200: jsonResponse({ type: 'object', properties: { items: { type: 'array', items: { $ref: '#/components/schemas/PaymentMethod' } } } }),
        },
      },
      put: {
        tags: ['Influencers'],
        summary: 'Upsert payment method',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/PaymentMethodInput' } },
          },
        },
        responses: {
          200: jsonResponse({ type: 'object', properties: { method: { $ref: '#/components/schemas/PaymentMethod' } } }),
        },
      },
    },
    '/api/influencers/{id}/badges': {
      put: {
        tags: ['Influencers'],
        summary: 'Assign influencer badges (admin)',
        security: bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { type: 'object', properties: { badges: { type: 'array', items: { type: 'string' } } }, required: ['badges'] } },
          },
        },
        responses: {
          200: jsonResponse({ type: 'object' }),
        },
      },
    },
    '/api/influencers/{id}/ads': {
      post: {
        tags: ['Influencers'],
        summary: 'Create influencer ad post',
        security: bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreatePostRequest' } },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/Post'),
        },
      },
    },
    '/api/influencers/{id}/feed': {
      get: {
        tags: ['Influencers'],
        summary: 'Influencer feed',
        security: [],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: jsonResponse({ type: 'array', items: { $ref: '#/components/schemas/Post' } }),
        },
      },
    },
    '/api/influencers/ads': {
      get: {
        tags: ['Influencers'],
        summary: 'Public influencer ads',
        security: [],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: jsonResponse({ type: 'array', items: { $ref: '#/components/schemas/Post' } }),
        },
      },
    },
    '/api/influencers/ads/media': {
      get: {
        tags: ['Influencers'],
        summary: 'Public influencer ad media (canonical)',
        security: [],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'influencerUlid', in: 'query', schema: { type: 'string' } },
          { name: 'postUlid', in: 'query', schema: { type: 'string' } },
          { name: 'adUlid', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: jsonResponse({ type: 'array', items: { $ref: '#/components/schemas/InfluencerAdMediaItem' } }),
        },
      },
    },
    '/api/influencers/me/ads/video': {
      post: {
        tags: ['Influencers'],
        summary: 'Upload Bunny video for own ad post',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                  title: { type: 'string' },
                  caption: { type: 'string' },
                  thumbnailUrl: { type: 'string' },
                  postUlid: { type: 'string' },
                  category: { type: 'string' },
                  categoryCode: { type: 'string' },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          200: jsonResponse({ type: 'object' }),
        },
      },
    },

    // Posts
    '/api/posts': {
      post: {
        tags: ['Posts'],
        summary: 'Create post',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreatePostRequest' } },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/Post'),
        },
      },
    },
    '/api/posts/feed': {
      get: {
        tags: ['Posts'],
        summary: 'Posts feed',
        security: [],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'state', in: 'query', schema: { type: 'string' } },
          { name: 'language', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: jsonResponse({ type: 'object', properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Post' } }, nextCursor: { type: 'string' } } }),
        },
      },
    },
    '/api/posts/{idUlid}': {
      get: {
        tags: ['Posts'],
        summary: 'Get post by ULID',
        security: [],
        parameters: [{ name: 'idUlid', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: jsonResponse('#/components/schemas/Post'),
        },
      },
    },
    '/api/posts/{idUlid}/video': {
      post: {
        tags: ['Posts'],
        summary: 'Create Bunny video for post',
        security: bearerAuth,
        parameters: [{ name: 'idUlid', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: false,
          content: {
            'application/json': { schema: { type: 'object', properties: { title: { type: 'string' } } } },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/BunnyCreateResponse'),
        },
      },
    },

    // Profile builder
    '/api/profile-builder/generate': {
      post: {
        tags: ['Profile Builder'],
        summary: 'Generate profile pack',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { type: 'object' } },
          },
        },
        responses: {
          200: jsonResponse({ type: 'object' }),
        },
      },
    },
    '/api/profile-builder/pack/{id}': {
      get: {
        tags: ['Profile Builder'],
        summary: 'Get profile pack',
        security: [],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: jsonResponse({ type: 'object' }),
        },
      },
    },

    // Locations
    '/api/locations/countries': {
      get: {
        tags: ['Locations'],
        summary: 'List countries',
        security: [],
        responses: {
          200: jsonResponse({ type: 'array', items: { $ref: '#/components/schemas/Country' } }),
        },
      },
    },
    '/api/locations/states': {
      get: {
        tags: ['Locations'],
        summary: 'List states',
        security: [],
        parameters: [{ name: 'countryId', in: 'query', schema: { type: 'integer' } }],
        responses: {
          200: jsonResponse({ type: 'array', items: { $ref: '#/components/schemas/State' } }),
        },
      },
    },
    '/api/locations/districts': {
      get: {
        tags: ['Locations'],
        summary: 'List districts',
        security: [],
        parameters: [{ name: 'stateId', in: 'query', schema: { type: 'integer' } }],
        responses: {
          200: jsonResponse({ type: 'array', items: { $ref: '#/components/schemas/District' } }),
        },
      },
    },
    '/api/locations/languages': {
      get: {
        tags: ['Locations'],
        summary: 'List languages',
        security: [],
        responses: {
          200: jsonResponse({ type: 'array', items: { $ref: '#/components/schemas/Language' } }),
        },
      },
    },
    '/api/locations/bulk/states': {
      post: {
        tags: ['Locations'],
        summary: 'Bulk upload states CSV (admin)',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { file: { type: 'string', format: 'binary' } },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          200: jsonResponse({ type: 'object' }),
        },
      },
    },
    '/api/locations/bulk/districts': {
      post: {
        tags: ['Locations'],
        summary: 'Bulk upload districts CSV (admin)',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { file: { type: 'string', format: 'binary' } },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          200: jsonResponse({ type: 'object' }),
        },
      },
    },

    // Media
    '/api/media/upload': {
      post: {
        tags: ['Media'],
        summary: 'Upload media to R2',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { file: { type: 'string', format: 'binary' } },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/MediaUploadResponse'),
        },
      },
    },

    // Brands
    '/api/brands/dashboard': {
      get: {
        tags: ['Brands'],
        summary: 'Brand dashboard',
        security: bearerAuth,
        responses: {
          200: jsonResponse({ type: 'object' }),
        },
      },
    },

    // Uploads
    '/api/uploads/r2/sign': {
      post: {
        tags: ['Uploads'],
        summary: 'Sign R2 upload',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/R2SignRequest' } },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/R2SignResponse'),
        },
      },
    },
    '/api/uploads/bunny/video': {
      post: {
        tags: ['Uploads'],
        summary: 'Create Bunny Stream video entry',
        security: bearerAuth,
        requestBody: {
          required: false,
          content: {
            'application/json': { schema: { type: 'object', properties: { title: { type: 'string' } } } },
          },
        },
        responses: {
          200: jsonResponse('#/components/schemas/BunnyCreateResponse'),
        },
      },
    },

    // Discovery
    '/api/discovery/influencers': {
      get: {
        tags: ['Discovery'],
        summary: 'Search influencers',
        security: [],
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: jsonResponse({ type: 'array', items: { $ref: '#/components/schemas/DiscoveryInfluencer' } }),
        },
      },
    },

    // Categories
    '/api/categories': {
      get: {
        tags: ['Categories'],
        summary: 'List categories',
        security: [],
        responses: {
          200: jsonResponse({ type: 'array', items: { $ref: '#/components/schemas/Category' } }),
        },
      },
    },

    // Bunny endpoints
    '/api/admin/bunny/videos': {
      get: {
        tags: ['Bunny'],
        summary: 'Admin: list Bunny videos',
        security: bearerAuth,
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'perPage', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: jsonResponse({ type: 'object' }),
        },
      },
    },
    '/api/admin/bunny/media/status-counts': {
      get: {
        tags: ['Bunny'],
        summary: 'Admin: media status counts',
        security: bearerAuth,
        responses: {
          200: jsonResponse({ type: 'object', properties: { counts: { type: 'object', additionalProperties: { type: 'integer' } } } }),
        },
      },
    },
    '/api/posts/{idUlid}/playback': {
      get: {
        tags: ['Bunny'],
        summary: 'Public: post playback info',
        security: [],
        parameters: [{ name: 'idUlid', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: jsonResponse({ type: 'object' }),
        },
      },
    },
    '/api/bunny/videos/{guid}/status': {
      get: {
        tags: ['Bunny'],
        summary: 'Public: Bunny video status',
        security: [],
        parameters: [{ name: 'guid', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: jsonResponse({ type: 'object' }),
        },
      },
    },

    // DOP endpoints (Director of Photography)
    '/api/dop/me': {
      get: {
        tags: ['DOP'],
        summary: 'DOP: get my profile',
        security: bearerAuth,
        responses: {
          200: jsonResponse({
            type: 'object',
            properties: { ok: { type: 'boolean' }, user: { type: 'object' } },
            required: ['ok', 'user'],
          }),
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
        },
      },
      put: {
        tags: ['DOP'],
        summary: 'DOP: update my profile',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse({
            type: 'object',
            properties: { ok: { type: 'boolean' }, user: { type: 'object' } },
            required: ['ok', 'user'],
          }),
          400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          409: { description: 'Conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/dop/dashboard': {
      get: {
        tags: ['DOP'],
        summary: 'DOP: dashboard',
        security: bearerAuth,
        responses: {
          200: jsonResponse({
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              counts: { type: 'object' },
              upcoming: { type: 'array', items: { type: 'object' } },
              recent: { type: 'array', items: { type: 'object' } },
            },
            required: ['ok'],
          }),
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
        },
      },
    },
    '/api/dop/photoshoots/requests': {
      get: {
        tags: ['DOP', 'Photoshoots'],
        summary: 'DOP: list assigned photoshoot requests',
        security: bearerAuth,
        parameters: [
          { name: 'status', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 } },
          { name: 'offset', in: 'query', required: false, schema: { type: 'integer', default: 0, minimum: 0 } },
        ],
        responses: {
          200: jsonResponse({
            type: 'object',
            properties: {
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
              items: { type: 'array', items: { type: 'object' } },
            },
            required: ['total', 'limit', 'offset', 'items'],
          }),
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
        },
      },
    },
    '/api/dop/photoshoots/requests/{ulid}': {
      get: {
        tags: ['DOP', 'Photoshoots'],
        summary: 'DOP: get assigned photoshoot request',
        security: bearerAuth,
        parameters: [{ name: 'ulid', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: jsonResponse({
            type: 'object',
            properties: { ok: { type: 'boolean' }, request: { type: 'object' } },
            required: ['ok', 'request'],
          }),
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/dop/photoshoots/requests/{ulid}/schedule': {
      put: {
        tags: ['DOP', 'Photoshoots'],
        summary: 'DOP: schedule assigned photoshoot',
        security: bearerAuth,
        parameters: [{ name: 'ulid', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  scheduledTimezone: { type: 'string' },
                  scheduledStartAt: { type: 'string', format: 'date-time' },
                  scheduledEndAt: { type: 'string', format: 'date-time' },
                  location: { type: 'object' },
                },
                required: ['scheduledTimezone', 'scheduledStartAt', 'scheduledEndAt'],
              },
            },
          },
        },
        responses: {
          200: jsonResponse({
            type: 'object',
            properties: { ok: { type: 'boolean' }, request: { type: 'object' } },
            required: ['ok', 'request'],
          }),
          400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          409: { description: 'Conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/dop/photoshoots/requests/{ulid}/raw-media': {
      post: {
        tags: ['DOP', 'Photoshoots'],
        summary: 'DOP: add raw media references',
        security: bearerAuth,
        parameters: [{ name: 'ulid', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: { oneOf: [{ type: 'string' }, { type: 'object' }] },
                  },
                },
                required: ['items'],
              },
            },
          },
        },
        responses: {
          200: jsonResponse({
            type: 'object',
            properties: { ok: { type: 'boolean' }, request: { type: 'object' } },
            required: ['ok', 'request'],
          }),
          400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          409: { description: 'Conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/dop/photoshoots/requests/{ulid}/final-media': {
      post: {
        tags: ['DOP', 'Photoshoots'],
        summary: 'DOP: add final media references',
        security: bearerAuth,
        parameters: [{ name: 'ulid', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: { oneOf: [{ type: 'string' }, { type: 'object' }] },
                  },
                },
                required: ['items'],
              },
            },
          },
        },
        responses: {
          200: jsonResponse({
            type: 'object',
            properties: { ok: { type: 'boolean' }, request: { type: 'object' } },
            required: ['ok', 'request'],
          }),
          400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          409: { description: 'Conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/dop/photoshoots/requests/{ulid}/status': {
      put: {
        tags: ['DOP', 'Photoshoots'],
        summary: 'DOP: set photoshoot request status',
        security: bearerAuth,
        parameters: [{ name: 'ulid', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { status: { type: 'string' } },
                required: ['status'],
              },
            },
          },
        },
        responses: {
          200: jsonResponse({
            type: 'object',
            properties: { ok: { type: 'boolean' }, request: { type: 'object' } },
            required: ['ok', 'request'],
          }),
          400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          409: { description: 'Conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    // Superadmin DOP management
    '/api/superadmin/dops': {
      post: {
        tags: ['Superadmin', 'DOP'],
        summary: 'Superadmin: create DOP user',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  email: { type: ['string', 'null'] },
                  password: { type: 'string' },
                  force: { type: 'boolean', description: 'If true, may convert an existing user to role dop' },
                },
                required: ['name', 'phone'],
              },
            },
          },
        },
        responses: {
          200: jsonResponse({
            type: 'object',
            properties: { ok: { type: 'boolean' }, user: { type: 'object' } },
            required: ['ok', 'user'],
          }),
          400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          409: { description: 'Conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      get: {
        tags: ['Superadmin', 'DOP'],
        summary: 'Superadmin: list DOP users',
        security: bearerAuth,
        responses: {
          200: jsonResponse({
            type: 'object',
            properties: { ok: { type: 'boolean' }, items: { type: 'array', items: { type: 'object' } } },
            required: ['ok', 'items'],
          }),
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
        },
      },
    },
    '/api/superadmin/dops/{userId}/convert': {
      put: {
        tags: ['Superadmin', 'DOP'],
        summary: 'Superadmin: convert existing user to DOP',
        security: bearerAuth,
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { confirm: { type: 'boolean' } }, required: ['confirm'] },
            },
          },
        },
        responses: {
          200: jsonResponse({
            type: 'object',
            properties: { ok: { type: 'boolean' }, user: { type: 'object' } },
            required: ['ok', 'user'],
          }),
          400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          409: { description: 'Conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    // Superadmin photoshoots: assign/unassign DOP
    '/api/superadmin/photoshoots/requests/{ulid}/assign-dop': {
      put: {
        tags: ['Superadmin', 'Photoshoots'],
        summary: 'Superadmin: assign DOP to photoshoot request',
        security: bearerAuth,
        parameters: [{ name: 'ulid', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { dopUserId: { type: 'integer' } },
                required: ['dopUserId'],
              },
            },
          },
        },
        responses: {
          200: jsonResponse({ type: 'object', properties: { ok: { type: 'boolean' }, request: { type: 'object' } }, required: ['ok', 'request'] }),
          400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          409: { description: 'Conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/superadmin/photoshoots/requests/{ulid}/unassign-dop': {
      put: {
        tags: ['Superadmin', 'Photoshoots'],
        summary: 'Superadmin: unassign DOP from photoshoot request',
        security: bearerAuth,
        parameters: [{ name: 'ulid', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: jsonResponse({ type: 'object', properties: { ok: { type: 'boolean' }, request: { type: 'object' } }, required: ['ok', 'request'] }),
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
          404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          409: { description: 'Conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: { type: 'string' },
        },
      },
      AuthRegisterRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          password: { type: 'string' },
          role: { type: 'string', enum: ['influencer', 'brand'] },
        },
      },
      AuthLoginRequest: {
        type: 'object',
        required: ['phone', 'password'],
        properties: {
          phone: { type: 'string' },
          password: { type: 'string' },
        },
      },
      AuthMobileLoginRequest: {
        type: 'object',
        properties: {
          phone: { type: 'string' },
          mpin: { type: 'string' },
          otp: { type: 'string' },
        },
      },
      AuthRefreshRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
      MpinResetRequest: {
        type: 'object',
        required: ['phone'],
        properties: {
          phone: { type: 'string' },
        },
      },
      MpinResetVerifyRequest: {
        type: 'object',
        required: ['phone', 'code', 'newMpin'],
        properties: {
          phone: { type: 'string' },
          code: { type: 'string' },
          newMpin: { type: 'string' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          role: { type: 'string' },
        },
      },

      Ad: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string' },
          description: { type: 'string' },
          targetStates: { type: 'array', items: { type: 'string' } },
          language: { type: 'string' },
          payPerInfluencer: { type: 'number' },
          status: { type: 'string' },
        },
      },
      AdCreateRequest: {
        type: 'object',
        required: ['title', 'description'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          targetStates: { type: 'array', items: { type: 'string' } },
          language: { type: 'string' },
          payPerInfluencer: { type: 'number' },
        },
      },
      AdUpdateRequest: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          targetStates: { type: 'array', items: { type: 'string' } },
          language: { type: 'string' },
          payPerInfluencer: { type: 'number' },
          status: { type: 'string' },
        },
      },
      AdsFeedRequest: {
        type: 'object',
        properties: {
          language: { type: 'string' },
          states: { type: 'array', items: { type: 'string' } },
          categories: { type: 'array', items: { type: 'string' } },
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
        },
      },
      PaymentInitiateRequest: {
        type: 'object',
        required: ['amount', 'currency'],
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string', example: 'INR' },
        },
      },
      PaymentInitiateResponse: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string' },
          keyId: { type: 'string' },
        },
      },
      PaymentConfirmRequest: {
        type: 'object',
        required: ['orderId', 'paymentId', 'signature'],
        properties: {
          orderId: { type: 'string' },
          paymentId: { type: 'string' },
          signature: { type: 'string' },
        },
      },

      Application: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          adId: { type: 'integer' },
          influencerId: { type: 'integer' },
          status: { type: 'string' },
          submission: { type: 'object' },
        },
      },
      ApplicationApplyRequest: {
        type: 'object',
        properties: {
          state: { type: 'string' },
          message: { type: 'string' },
        },
      },
      DeliverableSubmitRequest: {
        type: 'object',
        required: ['creativeUrl'],
        properties: {
          creativeUrl: { type: 'string' },
        },
      },
      Payout: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          status: { type: 'string' },
          grossAmount: { type: 'number' },
          netAmount: { type: 'number' },
        },
      },
      ApproveAndPayoutResponse: {
        type: 'object',
        properties: {
          app: { $ref: '#/components/schemas/Application' },
          payout: { $ref: '#/components/schemas/Payout' },
        },
      },

      InfluencerMe: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          idUlid: { type: 'string' },
          handle: { type: 'string' },
          profilePicUrl: { type: 'string' },
          verificationStatus: { type: 'string' },
          badges: { type: 'array', items: { type: 'string' } },
        },
      },
      InfluencerUpdateRequest: {
        type: 'object',
        properties: {
          handle: { type: 'string' },
          bio: { type: 'string' },
          countryId: { type: 'integer' },
          stateId: { type: 'integer' },
          stateIds: { type: 'array', items: { type: 'integer' } },
          districtId: { type: 'integer' },
          addressLine1: { type: 'string' },
          addressLine2: { type: 'string' },
          postalCode: { type: 'string' },
        },
      },
      InfluencerPricing: {
        type: 'object',
        properties: {
          adPricing: { type: 'object', additionalProperties: { type: 'number' } },
          negotiable: { type: 'boolean' },
          currency: { type: 'string', example: 'INR' },
          notes: { type: 'string' },
        },
      },
      KycInput: {
        type: 'object',
        properties: {
          fullName: { type: 'string' },
          dob: { type: 'string' },
          pan: { type: 'string' },
          addressLine1: { type: 'string' },
          addressLine2: { type: 'string' },
          postalCode: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          country: { type: 'string' },
          documents: { type: 'object' },
          consent: { type: 'boolean' },
        },
      },
      KycOutput: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          kyc: { type: 'object' },
          meta: { type: 'object' },
        },
      },
      PaymentMethod: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          type: { type: 'string', enum: ['bank', 'upi'] },
          accountHolderName: { type: 'string' },
          bankName: { type: 'string' },
          bankIfsc: { type: 'string' },
          bankAccountNumberMasked: { type: 'string' },
          upiIdMasked: { type: 'string' },
          isPreferred: { type: 'boolean' },
          status: { type: 'string' },
        },
      },
      PaymentMethodInput: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['bank', 'upi'] },
          accountHolderName: { type: 'string' },
          bankName: { type: 'string' },
          bankIfsc: { type: 'string' },
          bankAccountNumber: { type: 'string' },
          upiId: { type: 'string' },
          isPreferred: { type: 'boolean' },
        },
      },

      Post: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          idUlid: { type: 'string' },
          type: { type: 'string' },
          caption: { type: 'string' },
          categories: { type: 'array', items: { type: 'string' } },
          language: { type: 'string' },
          states: { type: 'array', items: { type: 'string' } },
          media: { type: 'array', items: { $ref: '#/components/schemas/MediaEntry' } },
        },
      },
      CreatePostRequest: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['ad', 'external', 'portfolio'] },
          caption: { type: 'string' },
          categories: { type: 'array', items: { type: 'string' } },
          language: { type: 'string' },
          states: { type: 'array', items: { type: 'string' } },
          media: { type: 'array', items: { $ref: '#/components/schemas/MediaEntry' } },
          adId: { type: 'integer' },
        },
      },
      MediaEntry: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          url: { type: 'string' },
          thumbnailUrl: { type: 'string' },
          provider: { type: 'string' },
          guid: { type: 'string' },
          status: { type: 'string' },
        },
      },
      InfluencerAdMediaItem: {
        type: 'object',
        properties: {
          ulid: { type: 'string' },
          provider: { type: 'string' },
          guid: { type: 'string' },
          playbackUrl: { type: 'string' },
          thumbnailUrl: { type: 'string' },
          status: { type: 'string' },
          sizeBytes: { type: 'integer' },
          durationSec: { type: 'number' },
          post: { type: 'object' },
          influencer: { type: 'object' },
          ad: { type: 'object' },
        },
      },

      R2SignRequest: {
        type: 'object',
        required: ['filename', 'contentType'],
        properties: {
          filename: { type: 'string' },
          contentType: { type: 'string' },
          folder: { type: 'string' },
        },
      },
      R2SignResponse: {
        type: 'object',
        properties: {
          uploadUrl: { type: 'string' },
          publicUrl: { type: 'string' },
          key: { type: 'string' },
          headers: { type: 'object' },
        },
      },
      BunnyCreateResponse: {
        type: 'object',
        properties: {
          guid: { type: 'string' },
          uploadUrl: { type: 'string' },
          playbackUrl: { type: 'string' },
        },
      },
      MediaUploadResponse: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          key: { type: 'string' },
          type: { type: 'string' },
          sizeMB: { type: 'number' },
        },
      },

      Category: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          type: { type: 'string' },
          purpose: { type: 'string' },
          description: { type: 'string' },
        },
      },
      Country: {
        type: 'object',
        properties: { id: { type: 'integer' }, name: { type: 'string' }, iso2: { type: 'string' } },
      },
      State: {
        type: 'object',
        properties: { id: { type: 'integer' }, name: { type: 'string' }, countryId: { type: 'integer' } },
      },
      District: {
        type: 'object',
        properties: { id: { type: 'integer' }, name: { type: 'string' }, stateId: { type: 'integer' } },
      },
      Language: {
        type: 'object',
        properties: { code: { type: 'string' }, name: { type: 'string' } },
      },
      DiscoveryInfluencer: {
        type: 'object',
        properties: {
          idUlid: { type: 'string' },
          handle: { type: 'string' },
          profilePicUrl: { type: 'string' },
          score: { type: 'number' },
        },
      },
    },
  },
};

function ensureTag(doc, name) {
  if (!doc.tags) doc.tags = [];
  const has = doc.tags.some((t) => (typeof t === 'string' ? t === name : t && t.name === name));
  if (!has) doc.tags.push({ name });
}

function ensurePath(doc, pathKey, pathItem) {
  if (!doc.paths) doc.paths = {};
  if (!doc.paths[pathKey]) doc.paths[pathKey] = pathItem;
}

function ensureDopOpenApi(doc) {
  ensureTag(doc, 'DOP');
  ensureTag(doc, 'Superadmin');
  ensureTag(doc, 'Photoshoots');
  ensurePath(doc, '/api/dop/me', defaultOpenapi.paths['/api/dop/me']);
  ensurePath(doc, '/api/dop/dashboard', defaultOpenapi.paths['/api/dop/dashboard']);
  ensurePath(doc, '/api/dop/photoshoots/requests', defaultOpenapi.paths['/api/dop/photoshoots/requests']);
  ensurePath(doc, '/api/dop/photoshoots/requests/{ulid}', defaultOpenapi.paths['/api/dop/photoshoots/requests/{ulid}']);
  ensurePath(doc, '/api/dop/photoshoots/requests/{ulid}/schedule', defaultOpenapi.paths['/api/dop/photoshoots/requests/{ulid}/schedule']);
  ensurePath(doc, '/api/dop/photoshoots/requests/{ulid}/raw-media', defaultOpenapi.paths['/api/dop/photoshoots/requests/{ulid}/raw-media']);
  ensurePath(doc, '/api/dop/photoshoots/requests/{ulid}/final-media', defaultOpenapi.paths['/api/dop/photoshoots/requests/{ulid}/final-media']);
  ensurePath(doc, '/api/dop/photoshoots/requests/{ulid}/status', defaultOpenapi.paths['/api/dop/photoshoots/requests/{ulid}/status']);
  ensurePath(doc, '/api/superadmin/dops', defaultOpenapi.paths['/api/superadmin/dops']);
  ensurePath(doc, '/api/superadmin/dops/{userId}/convert', defaultOpenapi.paths['/api/superadmin/dops/{userId}/convert']);
  ensurePath(doc, '/api/superadmin/photoshoots/requests/{ulid}/assign-dop', defaultOpenapi.paths['/api/superadmin/photoshoots/requests/{ulid}/assign-dop']);
  ensurePath(doc, '/api/superadmin/photoshoots/requests/{ulid}/unassign-dop', defaultOpenapi.paths['/api/superadmin/photoshoots/requests/{ulid}/unassign-dop']);
}

const outPath = path.join(__dirname, '..', 'src', 'openapi.json');
let openapi = defaultOpenapi;
try {
  const existingRaw = fs.readFileSync(outPath, 'utf8');
  const existing = JSON.parse(existingRaw);
  if (existing && typeof existing === 'object' && existing.openapi && existing.paths) {
    openapi = existing;
  }
} catch (_) {
  // ignore
}

ensureDopOpenApi(openapi);
fs.writeFileSync(outPath, JSON.stringify(openapi, null, 2) + '\n', 'utf8');
console.log('Wrote', outPath);
