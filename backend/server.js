import app from "./app.js";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Todo backend running on http://localhost:${PORT}`);
});

export default app;
export { app };

