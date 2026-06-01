#!/usr/bin/env node
/**
 * Playwright script: Set up Google Cloud OAuth credentials for Chrome Web Store API
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function run() {
  console.log('Launching browser...');
  const userDataDir = path.join(__dirname, '.playwright-profile');

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
    viewport: { width: 1280, height: 900 },
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    // Step 1: Login
    console.log('\n=== Step 1: Login to Google Cloud Console ===');
    console.log('Please log in with your Google account.\n');
    await page.goto('https://console.cloud.google.com/apis/credentials', { waitUntil: 'networkidle', timeout: 60000 });
    console.log('Waiting for login (up to 5 min)...');
    try {
      await page.waitForURL('https://console.cloud.google.com/**', { timeout: 300000 });
      console.log('Logged in!\n');
    } catch {
      console.log('Timeout - press Enter after logging in...');
      await ask('');
    }

    // Step 2: Enable API
    console.log('=== Step 2: Enable Chrome Web Store API ===');
    await page.goto('https://console.cloud.google.com/apis/library/chromewebstore.googleapis.com', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const enableBtn = page.locator('button, span').filter({ hasText: /ENABLE|DISABLE/i }).first();
    if (await enableBtn.count() > 0) {
      const text = await enableBtn.textContent();
      if (text.includes('DISABLE')) {
        console.log('API already enabled.\n');
      } else {
        console.log('Enabling API...');
        await enableBtn.click();
        await page.waitForTimeout(3000);
        console.log('Enabled!\n');
      }
    }

    // Step 3: Create OAuth Client
    console.log('=== Step 3: Create OAuth Client ID ===');
    await page.goto('https://console.cloud.google.com/apis/credentials', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const createBtn = page.locator('*').filter({ hasText: /CREATE CREDENTIALS/i }).first();
    if (await createBtn.count() > 0) {
      await createBtn.click();
      await page.waitForTimeout(1000);
      const oauthItem = page.locator('*').filter({ hasText: /OAuth client ID/i }).first();
      if (await oauthItem.count() > 0) {
        await oauthItem.click();
        await page.waitForTimeout(2000);
        console.log('Form opened. Filling details...\n');
      }
    }

    console.log('--- COMPLETE THE OAUTH FORM ---');
    console.log('1. Application type: Web application');
    console.log('2. Name: SealX Extension Publisher');
    console.log('3. Authorized redirect URIs -> ADD URI -> https://developers.google.com/oauthplayground');
    console.log('4. Click CREATE');
    console.log('5. Copy Client ID and Client Secret\n');

    const clientId = await ask('Client ID: ');
    const clientSecret = await ask('Client Secret: ');

    if (!clientId || !clientSecret) {
      console.log('Credentials required!');
      await context.close();
      process.exit(1);
    }

    // Step 4: Refresh Token
    console.log('\n=== Step 4: Get Refresh Token ===');
    await page.goto('https://developers.google.com/oauthplayground', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    console.log('--- OAUTH PLAYGROUND SETUP ---');
    console.log('1. Gear icon (top right) -> Check "Use your own OAuth credentials"');
    console.log(`2. Client ID: ${clientId}`);
    console.log(`3. Client Secret: ${clientSecret}`);
    console.log('4. Left panel: "Chrome Web Store API v1.1" -> expand');
    console.log('5. Check: https://www.googleapis.com/auth/chromewebstore');
    console.log('6. Click "Authorize APIs" -> login');
    console.log('7. Click "Exchange authorization code for tokens"');
    console.log('8. Copy the "Refresh token"\n');

    const refreshToken = await ask('Refresh Token: ');
    if (!refreshToken) { await context.close(); process.exit(1); }

    // Save
    const extensionId = 'hmbomiamklobhahajggcniphlaipnnib';
    const envContent = [
      '# CWS credentials',
      `CHROME_EXTENSION_ID=${extensionId}`,
      `CHROME_CLIENT_ID=${clientId}`,
      `CHROME_CLIENT_SECRET=${clientSecret}`,
      `CHROME_REFRESH_TOKEN=${refreshToken}`,
    ].join('\n');
    const outPath = path.join(__dirname, '.cws-credentials.env');
    fs.writeFileSync(outPath, envContent);

    console.log(`\nCredentials saved to ${outPath}`);
    console.log(`Client ID:     ${clientId}`);
    console.log(`Client Secret: ${clientSecret}`);
    console.log(`Refresh Token: ${refreshToken}`);
    console.log('\nNow set GitHub Secrets:');
    console.log(`  gh secret set CHROME_CLIENT_ID --body "${clientId}"`);
    console.log(`  gh secret set CHROME_CLIENT_SECRET --body "${clientSecret}"`);
    console.log(`  gh secret set CHROME_REFRESH_TOKEN --body "${refreshToken}"`);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await context.close();
  }
}

run();
