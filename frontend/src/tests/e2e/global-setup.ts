import { request } from '@playwright/test';
import type { FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects?.[0]?.use?.baseURL || 'http://localhost:5173';
  const requestContext = await request.newContext({ baseURL });

  const email = 'e2e_global_user@example.com';
  const password = 'securepassword123';

  console.log('Global Setup: Setting up authenticated session...');

  // 1. Try to register
  await requestContext.post('/api/v1/auth/register', {
    data: { email, password },
  });

  // 2. Login to get the authentication cookie
  const loginResponse = await requestContext.post('/api/v1/auth/login', {
    data: { email, password },
  });

  if (!loginResponse.ok()) {
    throw new Error(`Failed to log in during global setup: ${loginResponse.statusText()}`);
  }

  // 3. Ensure artifacts directory exists
  const storageStatePath = 'src/tests/e2e/artifacts/storageState.json';
  const dir = path.dirname(storageStatePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 4. Save the storage state (which includes the auth cookie)
  await requestContext.storageState({ path: storageStatePath });
  await requestContext.dispose();

  console.log('Global Setup: Authenticated session saved successfully.');
}

export default globalSetup;
