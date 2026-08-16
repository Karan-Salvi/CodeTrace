import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { createWebSocketGateway } from "./websocket/gateway.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`CodeTrace backend listening on port ${env.PORT}`);
});

createWebSocketGateway(server);
