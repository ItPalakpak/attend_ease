import { initDbConnection, getDbConnection } from './src/main/db/connection.js';
import { getSettings } from './src/main/db/settings.js';

async function test() {
  try {
    console.log('Connecting to database...');
    await initDbConnection();
    console.log('Connected. Fetching settings...');
    const settings = await getSettings();
    console.log('Settings fetched:', settings);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

test();
