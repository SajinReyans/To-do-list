import app from "./app.js";

const PORT = parseInt(process.env.PORT, 10) || 4000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Todo backend running on http://${HOST}:${PORT}`);
});

export default app;
export { app };

