const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/root/.openclaw/workspace/harbin-uam/shot.png', fullPage: true });
  await browser.close();
  console.log('Screenshot saved!');
})();