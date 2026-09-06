import app from "./app.js";
import { startReminderScheduler } from "./services/reminderScheduler.js";

const PORT = parseInt(process.env.PORT, 10) || 4000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Todo backend running on http://${HOST}:${PORT}`);
  // Start the background habit reminder worker
  startReminderScheduler();
});

export default app;
export { app };


