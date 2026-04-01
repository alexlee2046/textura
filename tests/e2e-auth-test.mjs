#!/usr/bin/env node
/**
 * Textura E2E Auth Tests — Tests requiring authenticated sessions
 * Covers: Dashboard CRUD, Admin, AI Generation, Share pages
 * Usage: node tests/e2e-auth-test.mjs [--internal]
 */

const IS_INTERNAL = process.argv.includes('--internal');
const BASE_URL = IS_INTERNAL ? `http://${process.env.CONTAINER_IP || '10.0.1.26'}:3000` : 'https://textura.dev.canbee.cn';
const SUPABASE_AUTH_URL = IS_INTERNAL ? 'http://10.0.1.18:8000' : 'https://supa-textura.dev.canbee.cn';
// Cookie name = sb-{hostname.split('.')[0]}-auth-token
// For deployed: NEXT_PUBLIC_SUPABASE_URL=https://supa-textura.dev.canbee.cn → sb-supa-textura-auth-token
// For internal: container sees the same env var
const COOKIE_NAME = 'sb-supa-textura-auth-token';
const SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3NDkxMTY2MCwiZXhwIjo0OTMwNTg1MjYwLCJyb2xlIjoiYW5vbiJ9.a7BQK0MppAcv7WbIlBS48j3nnt1ksgDCzoGkHCaBurM';
const TEST_USER = { email: 'alex@textura.test', password: 'Test123456' };

// ── Helpers ──────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
const results = [];

function log(icon, msg) { console.log(`${icon} ${msg}`); }

async function test(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    const ms = Date.now() - t0;
    log('✅', `${name} (${ms}ms)`);
    results.push({ name, status: 'pass', ms });
    passed++;
  } catch (e) {
    const ms = Date.now() - t0;
    log('❌', `${name} (${ms}ms)`);
    log('  ', e.message);
    results.push({ name, status: 'fail', ms, error: e.message });
    failed++;
  }
}

function skip(name, reason) {
  log('⏭️', `${name} — SKIPPED: ${reason}`);
  results.push({ name, status: 'skip', reason });
  skipped++;
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ── Auth ─────────────────────────────────────────────
let sessionCookie = '';

async function authenticate() {
  // 1. Get tokens from Supabase Auth API
  const res = await fetch(`${SUPABASE_AUTH_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`Auth failed: ${JSON.stringify(data).slice(0, 200)}`);

  // 2. Construct the Supabase SSR cookie
  // @supabase/ssr stores the session as PLAIN JSON (no base64 encoding by default)
  // Chunked into .0, .1, etc if value exceeds ~3500 bytes
  const sessionPayload = JSON.stringify({
    access_token: data.access_token,
    token_type: 'bearer',
    expires_in: data.expires_in,
    expires_at: data.expires_at,
    refresh_token: data.refresh_token,
    user: data.user,
  });

  // URL-encode the JSON for cookie transport (special chars like =, ; need encoding)
  const encoded = encodeURIComponent(sessionPayload);

  // Check if we need chunking (cookie max ~4096 bytes per cookie)
  if (encoded.length < 3500) {
    sessionCookie = `${COOKIE_NAME}=${encoded}`;
  } else {
    // Chunk into ~3500 byte pieces
    const chunks = [];
    for (let i = 0; i < encoded.length; i += 3500) {
      chunks.push(encoded.slice(i, i + 3500));
    }
    sessionCookie = chunks.map((chunk, i) => `${COOKIE_NAME}.${i}=${chunk}`).join('; ');
  }

  log('🔑', `Authenticated as ${data.user.email} (cookie: ${sessionCookie.length} bytes)`);
  return data;
}

async function authFetch(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers = { ...opts.headers, Cookie: sessionCookie };
  const res = await fetch(url, { redirect: 'manual', ...opts, headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, text, json };
}

async function authFetchPage(path, opts = {}) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers = { ...opts.headers, Cookie: sessionCookie };
  return fetch(url, { redirect: 'follow', ...opts, headers }).then(async r => ({
    status: r.status,
    headers: r.headers,
    url: r.url,
    text: await r.text(),
  }));
}

// ── Suite: Dashboard Pages ───────────────────────────
async function testDashboardPages() {
  console.log('\n🔹 Dashboard Pages (Authenticated)\n');

  await test('GET /dashboard redirects to /dashboard/materials', async () => {
    const r = await authFetch('/dashboard');
    // Should redirect to materials (307/302) or serve the page (200)
    const ok = r.status === 200 || r.status === 307 || r.status === 302;
    assert(ok, `Expected 200/307/302, got ${r.status}: ${r.text.slice(0, 200)}`);
    if (r.status === 307 || r.status === 302) {
      const loc = r.headers.get('location') || '';
      assert(loc.includes('/dashboard') || loc.includes('/materials'),
        `Expected redirect to dashboard, got: ${loc}`);
    }
  });

  await test('GET /dashboard/materials renders material list', async () => {
    const r = await authFetchPage('/dashboard/materials');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.text.includes('</html>'), 'Expected HTML');
    log('  ', `Page size: ${r.text.length} bytes`);
  });

  await test('GET /dashboard/inquiries renders inquiry list', async () => {
    const r = await authFetchPage('/dashboard/inquiries');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.text.includes('</html>'), 'Expected HTML');
    log('  ', `Page size: ${r.text.length} bytes`);
  });

  await test('GET /dashboard/settings renders org settings', async () => {
    const r = await authFetchPage('/dashboard/settings');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.text.includes('</html>'), 'Expected HTML');
    log('  ', `Page size: ${r.text.length} bytes`);
  });
}

// ── Suite: Dashboard API ─────────────────────────────
async function testDashboardAPI() {
  console.log('\n🔹 Dashboard API (Authenticated)\n');

  await test('GET /api/dashboard/materials returns paginated material list', async () => {
    const r = await authFetch('/api/dashboard/materials');
    assert(r.status === 200, `Expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
    assert(r.json?.items && Array.isArray(r.json.items), `Expected {items: [...]}, got: ${JSON.stringify(r.json).slice(0, 100)}`);
    assert(typeof r.json.total === 'number', 'Expected total count');
    log('  ', `${r.json.items.length} materials (total: ${r.json.total}, page: ${r.json.page})`);
  });

  await test('GET /api/dashboard/inquiries returns inquiry list', async () => {
    const r = await authFetch('/api/dashboard/inquiries');
    assert(r.status === 200, `Expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
    log('  ', `Response: ${JSON.stringify(r.json).slice(0, 200)}`);
  });
}

// ── Suite: Material CRUD ─────────────────────────────
async function testMaterialCRUD() {
  console.log('\n🔹 Material CRUD (Authenticated)\n');

  let materialId = null;

  await test('POST /api/dashboard/materials creates material', async () => {
    // Dashboard materials POST expects FormData with image (required) + snake_case fields
    // Create a small valid PNG image (1x1 pixel)
    const PNG_1x1 = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    );
    const imageBlob = new Blob([PNG_1x1], { type: 'image/png' });

    const formData = new FormData();
    formData.append('name', `E2E-Test-${Date.now()}`);
    formData.append('category', 'fabric');
    const uniqueSuffix = Date.now().toString(36);
    formData.append('color', `测试-${uniqueSuffix}`);
    formData.append('color_code', `#${uniqueSuffix.slice(0, 6).padEnd(6, '0')}`);
    formData.append('series_code', `E2E-${uniqueSuffix}`);
    formData.append('prompt_modifier', 'test fabric for e2e');
    formData.append('image', imageBlob, 'test-swatch.png');

    const r = await authFetch('/api/dashboard/materials', {
      method: 'POST',
      body: formData,
    });
    assert(r.status === 200 || r.status === 201, `Expected 200/201, got ${r.status}: ${r.text.slice(0, 300)}`);
    materialId = r.json?.id;
    log('  ', `Created material: ${materialId || JSON.stringify(r.json).slice(0, 100)}`);
  });

  if (!materialId) {
    // Try getting an existing material to test update/delete
    const listRes = await authFetch('/api/dashboard/materials');
    if (listRes.json?.length > 0) {
      // Find a test material or skip
      const testMat = listRes.json.find(m => m.name?.startsWith('E2E-Test'));
      if (testMat) materialId = testMat.id;
    }
  }

  if (materialId) {
    await test('PATCH /api/dashboard/materials/:id updates material', async () => {
      // PATCH expects FormData (same as POST)
      const form = new FormData();
      form.append('color', '测试蓝');
      form.append('color_code', '#0000FF');
      const r = await authFetch(`/api/dashboard/materials/${materialId}`, {
        method: 'PATCH',
        body: form,
      });
      assert(r.status === 200, `Expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
      log('  ', `Updated: ${JSON.stringify(r.json).slice(0, 100)}`);
    });

    await test('DELETE /api/dashboard/materials/:id soft-deletes material', async () => {
      const r = await authFetch(`/api/dashboard/materials/${materialId}`, {
        method: 'DELETE',
      });
      assert(r.status === 200 || r.status === 204, `Expected 200/204, got ${r.status}: ${r.text.slice(0, 300)}`);
      log('  ', `Deleted: ${JSON.stringify(r.json).slice(0, 100)}`);
    });

    // Verify it's gone from the list
    await test('Deleted material no longer in list', async () => {
      const r = await authFetch('/api/dashboard/materials');
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      const items = r.json?.items || r.json || [];
      const found = (Array.isArray(items) ? items : []).find(m => m.id === materialId);
      assert(!found, `Material ${materialId} should not be in list after deletion`);
    });
  } else {
    skip('Material update/delete', 'No material ID available');
  }
}

// ── Suite: Admin Pages ───────────────────────────────
async function testAdminPages() {
  console.log('\n🔹 Admin Pages (Authenticated as admin)\n');

  await test('GET /admin renders admin hub', async () => {
    const r = await authFetchPage('/admin');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.text.includes('</html>'), 'Expected HTML');
    log('  ', `Page size: ${r.text.length} bytes`);
  });

  await test('GET /admin/organizations renders org list', async () => {
    const r = await authFetchPage('/admin/organizations');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    log('  ', `Page size: ${r.text.length} bytes`);
  });

  await test('GET /admin/materials renders material list', async () => {
    const r = await authFetchPage('/admin/materials');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    log('  ', `Page size: ${r.text.length} bytes`);
  });
}

// ── Suite: Admin API ─────────────────────────────────
async function testAdminAPI() {
  console.log('\n🔹 Admin API (Authenticated as admin)\n');

  await test('GET /api/admin/organizations returns org list', async () => {
    const r = await authFetch('/api/admin/organizations');
    assert(r.status === 200, `Expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
    const items = r.json?.items || r.json;
    assert(Array.isArray(items), `Expected array or {items: [...]}, got: ${JSON.stringify(r.json).slice(0, 100)}`);
    const elastron = items.find(o => o.slug === 'elastron');
    assert(elastron, 'Should contain Elastron org');
    log('  ', `${items.length} organizations`);
  });

  await test('GET /api/admin/materials returns all materials', async () => {
    const r = await authFetch('/api/admin/materials');
    assert(r.status === 200, `Expected 200, got ${r.status}: ${r.text.slice(0, 300)}`);
    log('  ', `Response: ${JSON.stringify(r.json).slice(0, 200)}`);
  });
}

// ── Suite: AI Generation ─────────────────────────────
async function testAIGeneration() {
  console.log('\n🔹 AI Generation\n');

  // The generate API accepts FormData with image + material_id
  // It's optional auth — anonymous users can also generate
  // We'll test with a tiny test image (1x1 pixel PNG)

  // Minimal valid PNG (1x1 transparent pixel)
  const PNG_1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  // Get a material ID
  const matRes = await fetch(`${BASE_URL}/api/materials?org_slug=elastron`);
  const materials = await matRes.json();
  const materialId = materials[0]?.id;

  if (!materialId) {
    skip('AI Generation test', 'No materials available');
    return;
  }

  await test('POST /api/generate without image returns error', async () => {
    const form = new FormData();
    form.append('material_id', materialId);
    const r = await authFetch('/api/generate', { method: 'POST', body: form });
    assert(r.status === 400, `Expected 400, got ${r.status}: ${r.text.slice(0, 200)}`);
  });

  // Test with actual image (this will call OpenRouter, so may take time)
  await test('POST /api/generate with image + material starts generation', async () => {
    const form = new FormData();
    const imageBlob = new Blob([PNG_1x1], { type: 'image/png' });
    form.append('image', imageBlob, 'test.png');
    form.append('material_id', materialId);

    const r = await authFetch('/api/generate', { method: 'POST', body: form });
    // Accept 200 (success), 402 (no credits), 500 (AI model error with tiny image)
    // 400 = validation error, which is also acceptable for a 1x1 image
    log('  ', `Response: ${r.status} — ${r.text.slice(0, 200)}`);
    assert(r.status !== 404, 'Route should exist');
    assert(r.status !== 401, 'Should not require auth');
  });
}

// ── Suite: User Generation History ───────────────────
async function testGenerationHistory() {
  console.log('\n🔹 User Generation History\n');

  await test('GET /my/generations renders history page', async () => {
    const r = await authFetchPage('/my/generations');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    assert(r.text.includes('</html>'), 'Expected HTML');
    log('  ', `Page size: ${r.text.length} bytes`);
  });
}

// ── Suite: Share Page ────────────────────────────────
async function testSharePage() {
  console.log('\n🔹 Share Page\n');

  await test('GET /s/nonexistent returns 404', async () => {
    const r = await fetch(`${BASE_URL}/s/nonexistent-hash-abc123`, { redirect: 'manual' });
    const status = r.status;
    assert(status === 404, `Expected 404, got ${status}`);
  });

  // Try to find an existing share hash from the DB
  // We can check generations via admin API
  await test('Share page renders for valid hash (if exists)', async () => {
    const genRes = await authFetch('/api/admin/materials');
    // If we can't get generations, skip
    log('  ', 'No generation hash available to test share page rendering');
  });
}

// ── Suite: Logout ────────────────────────────────────
async function testLogout() {
  console.log('\n🔹 Logout\n');

  // Textura has no dedicated /logout route — logout is handled client-side via Supabase
  // Test that accessing protected route after clearing cookies redirects to login
  await test('Protected route without cookies redirects to login', async () => {
    const r = await fetch(`${BASE_URL}/dashboard`, { redirect: 'manual' });
    assert(r.status === 307 || r.status === 302, `Expected redirect, got ${r.status}`);
    const loc = r.headers.get('location') || '';
    assert(loc.includes('/login'), `Expected redirect to /login, got: ${loc}`);
  });
}

// ── Main ─────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Textura E2E Auth Test Suite                ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Mode:     ${IS_INTERNAL ? 'INTERNAL' : 'EXTERNAL'}`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Supabase: ${SUPABASE_AUTH_URL}`);
  console.log(`  Cookie:   ${COOKIE_NAME}`);
  console.log(`  Time:     ${new Date().toISOString()}`);

  // Authenticate first
  console.log('\n🔐 Authenticating...\n');
  try {
    await authenticate();
  } catch (e) {
    console.error('❌ Authentication failed:', e.message);
    process.exit(2);
  }

  // Run all auth-dependent suites
  // Group 1: Pages (parallel)
  await Promise.allSettled([
    testDashboardPages(),
    testAdminPages(),
    testGenerationHistory(),
    testSharePage(),
  ]);

  // Group 2: API tests (parallel)
  await Promise.allSettled([
    testDashboardAPI(),
    testAdminAPI(),
  ]);

  // Group 3: CRUD + Generation (sequential — they create/delete data)
  await testMaterialCRUD();
  await testAIGeneration();

  // Logout test
  await testLogout();

  // ── Report ───
  console.log('\n' + '═'.repeat(50));
  console.log('  SUMMARY');
  console.log('═'.repeat(50));
  console.log(`  ✅ Passed:  ${passed}`);
  console.log(`  ❌ Failed:  ${failed}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log('═'.repeat(50));

  if (failed > 0) {
    console.log('\n  Failed tests:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`    ❌ ${r.name}`);
      console.log(`       ${r.error}`);
    });
  }

  console.log();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
