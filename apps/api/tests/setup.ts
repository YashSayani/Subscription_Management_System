import { config } from 'dotenv';
import path from 'path';

// Load .env from root or apps/api
config({ path: path.resolve(__dirname, '../.env') });
config({ path: path.resolve(__dirname, '../../../.env') });
