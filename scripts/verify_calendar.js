const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 8099;
const URL = `http://localhost:${PORT}/`;
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TEMP_USER_DATA = path.join(process.env.TEMP || 'C:\\Temp', 'edge_test_profile_' + Date.now());

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('1. Starting test Edge process on remote debugging port 9222...');
  const edgeProc = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${TEMP_USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: 'ignore' });

  // Wait for Edge CDP to be up
  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch {
      await sleep(300);
    }
  }

  if (!versionData) {
    edgeProc.kill();
    throw new Error('Failed to connect to Edge remote debugging port 9222');
  }
  console.log('Connected to Edge:', versionData.Browser);

  // Open a new tab navigating to the app
  const newTabRes = await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(URL)}`, { method: 'PUT' });
  const tab = await newTabRes.json();
  const wsUrl = tab.webSocketDebuggerUrl;
  console.log('Opened tab:', tab.url);

  const ws = new WebSocket(wsUrl);

  const errors = [];
  const logs = [];
  let msgId = 1;
  const pendingRequests = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pendingRequests.has(data.id)) {
      const { resolve } = pendingRequests.get(data.id);
      pendingRequests.delete(data.id);
      resolve(data.result);
      return;
    }

    if (data.method === 'Runtime.exceptionThrown') {
      const desc = data.params?.exceptionDetails?.exception?.description || data.params?.exceptionDetails?.text;
      console.error('EXCEPTION:', desc);
      errors.push(desc);
    } else if (data.method === 'Log.entryAdded' && data.params?.entry?.level === 'error') {
      console.log('LOG ENTRY:', data.params.entry.text, data.params.entry.url || '');
    } else if (data.method === 'Console.messageAdded' && data.params?.message?.level === 'error') {
      console.log('CONSOLE MSG:', data.params.message.text);
      if (!data.params.message.text.includes('Failed to load resource')) {
        errors.push(data.params.message.text);
      }
    } else if (data.method === 'Network.responseReceived') {
      if (data.params?.response?.status >= 400) {
        console.log(`404/HTTP ${data.params.response.status}:`, data.params.response.url);
      }
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Console.enable');
  await send('Network.enable');
  await send('Console.enable');

  console.log('2. Waiting for initial page load and React render...');
  await sleep(3500);

  // Check initial page state
  const evalInitial = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        title: document.title,
        hasRoot: Boolean(document.getElementById('root')),
        sideNavButtons: Array.from(document.querySelectorAll('.side-nav-btn')).map(b => b.getAttribute('title') || b.textContent.trim()),
      };
    })()`,
    returnByValue: true,
  });

  console.log('Initial DOM evaluation:', evalInitial?.result?.value);

  // Click on Calendar button in SideNav
  console.log('3. Navigating to Calendar view...');
  const evalClickCalendar = await send('Runtime.evaluate', {
    expression: `(() => {
      const calBtn = Array.from(document.querySelectorAll('.side-nav-btn')).find(b =>
        (b.getAttribute('title') || '').toLowerCase().includes('calendar') ||
        b.innerHTML.includes('fa-calendar')
      );
      if (!calBtn) return { success: false, error: 'Calendar button not found in side nav' };
      calBtn.click();
      return { success: true };
    })()`,
    returnByValue: true,
  });

  console.log('Click calendar result:', evalClickCalendar?.result?.value);

  // Wait for CalendarView to mount and render
  await sleep(2500);

  // Check if calendar view rendered without errors
  const evalCalendar = await send('Runtime.evaluate', {
    expression: `(() => {
      const monthTitle = document.querySelector('.calendar-month-title, h2, h3')?.textContent || '';
      const dayCells = document.querySelectorAll('.calendar-day-cell');
      const viewButtons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => ['Month', 'Week', 'Google Embed', 'Settings'].includes(t));
      const textContent = document.body.innerText;
      const hasErrorText = textContent.includes('dayNum is not defined') || textContent.includes('Something went wrong') || textContent.includes('ReferenceError');
      return {
        monthTitle,
        cellCount: dayCells.length,
        viewButtons,
        hasErrorText,
      };
    })()`,
    returnByValue: true,
  });

  console.log('Calendar view DOM evaluation:', evalCalendar?.result?.value);

  // Click Google Embed tab if present
  console.log('4. Testing Calendar view sub-tabs...');
  const evalClickEmbed = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const embedBtn = btns.find(b => b.textContent.includes('Google Embed') || b.textContent.includes('Embed'));
      if (embedBtn) {
        embedBtn.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()`,
    returnByValue: true,
  });
  console.log('Click Embed result:', evalClickEmbed?.result?.value);
  await sleep(1000);

  // Click Month tab back
  const evalClickMonth = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const monthBtn = btns.find(b => b.textContent.includes('Month'));
      if (monthBtn) {
        monthBtn.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()`,
    returnByValue: true,
  });
  console.log('Click Month result:', evalClickMonth?.result?.value);
  await sleep(1000);

  // Check Settings tab
  console.log('5. Navigating to Settings view & checking Calendar settings...');
  const evalClickSettings = await send('Runtime.evaluate', {
    expression: `(() => {
      const settingsBtn = Array.from(document.querySelectorAll('.side-nav-btn')).find(b =>
        (b.getAttribute('title') || '').toLowerCase().includes('setting') ||
        b.innerHTML.includes('fa-cog') || b.innerHTML.includes('fa-gear')
      );
      if (!settingsBtn) return { success: false, error: 'Settings button not found' };
      settingsBtn.click();
      return { success: true };
    })()`,
    returnByValue: true,
  });
  console.log('Click Settings result:', evalClickSettings?.result?.value);
  await sleep(1500);

  // Click Calendar settings tab
  const evalClickCalSettingsTab = await send('Runtime.evaluate', {
    expression: `(() => {
      const calTab = Array.from(document.querySelectorAll('button, .tab-btn')).find(b =>
        b.textContent.includes('Calendar')
      );
      if (!calTab) return { success: false, error: 'Calendar settings tab not found' };
      calTab.click();
      return { success: true };
    })()`,
    returnByValue: true,
  });
  console.log('Click Calendar Settings Tab:', evalClickCalSettingsTab?.result?.value);
  await sleep(1500);

  // Inspect settings inputs
  const evalSettingsFields = await send('Runtime.evaluate', {
    expression: `(() => {
      const inputs = Array.from(document.querySelectorAll('input, textarea, select')).map(i => ({
        type: i.type,
        placeholder: i.placeholder,
        value: i.value,
        name: i.name,
      }));
      const text = document.body.innerText;
      const mentionsServiceAccount = text.includes('Service Account') || text.includes('service_account') || text.includes('Client Email');
      const mentionsApiKey = text.includes('API Key') || text.includes('Google API Key');
      const mentionsIcal = text.includes('iCal') || text.includes('.ics');
      return {
        inputsCount: inputs.length,
        mentionsServiceAccount,
        mentionsApiKey,
        mentionsIcal,
      };
    })()`,
    returnByValue: true,
  });
  console.log('Settings Calendar Fields Inspection:', evalSettingsFields?.result?.value);

  // Capture screenshot
  const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
  if (screenshotRes?.data) {
    fs.writeFileSync(path.join(__dirname, 'verify_screenshot.png'), Buffer.from(screenshotRes.data, 'base64'));
    console.log('Saved verification screenshot to scripts/verify_screenshot.png');
  }

  // Cleanup
  ws.close();
  edgeProc.kill();
  try {
    fs.rmSync(TEMP_USER_DATA, { recursive: true, force: true });
  } catch {}

  console.log('\n--- VERIFICATION SUMMARY ---');
  console.log('Total runtime errors caught:', errors.length);
  if (errors.length > 0) {
    console.error('Errors:', errors);
    process.exit(1);
  }

  const calData = evalCalendar?.result?.value;
  if (!calData || calData.hasErrorText) {
    console.error('Calendar error text detected on page!');
    process.exit(1);
  }

  const settingsData = evalSettingsFields?.result?.value;
  if (settingsData && (settingsData.mentionsServiceAccount || settingsData.mentionsApiKey)) {
    console.error('Legacy service account or API key config detected in settings!');
    process.exit(1);
  }

  console.log('All verification checks passed successfully with 0 errors!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
