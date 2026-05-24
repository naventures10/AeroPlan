import { execSync } from 'child_process';

function globalTeardown() {
  console.log('Global Teardown: Cleaning up E2E test users from database...');
  try {
    // Run SQL command to delete test users
    execSync(
      `docker exec eaip-postgres psql -U postgres -d aeronautical_information_system -c "DELETE FROM users WHERE email LIKE 'testuser_%@example.com' OR email = 'e2e_global_user@example.com';"`,
    );
    console.log('Global Teardown: Test users deleted successfully.');
  } catch (error) {
    console.error('Global Teardown Error: Failed to clean up database:', error);
  }
}

export default globalTeardown;
