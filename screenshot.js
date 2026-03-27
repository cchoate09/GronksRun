const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));

  try {
    await page.goto('http://127.0.0.1:8080/index.html', { waitUntil: 'load', timeout: 5000 });
    
    // Wait a bit for game loop to start
    await new Promise(r => setTimeout(r, 1000));
    
    await page.screenshot({ path: 'local_screenshot.png' });
    
    const gameState = await page.evaluate(() => {
      return {
        W: window.W,
        H: window.H,
        UNIT: window.UNIT,
        phase: window.G ? window.G.phase : 'G undefined',
        canvasWidth: document.getElementById('c') ? document.getElementById('c').width : -1
      };
    });
    console.log("GAME STATE:", JSON.stringify(gameState));
  } catch (e) {
    console.error("Script failed:", e);
  } finally {
    await browser.close();
  }
})();
