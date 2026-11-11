import { stopDevelopment } from "./dev-processes.mjs";

try {
  await stopDevelopment();
} catch (error) {
  console.error(`Development cleanup failed: ${error.message}`);
  process.exitCode = 1;
}
