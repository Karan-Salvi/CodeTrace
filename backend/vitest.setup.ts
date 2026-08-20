import { config } from "dotenv";

// Loads .env first (existing behavior), then .env.test on top with
// override:true — currently just DATABASE_URL, pointed at a separate
// database so test cleanup (deleteMany() in beforeEach/afterAll across
// the suite) can never touch real dev data again.
config();
config({ path: ".env.test", override: true });
