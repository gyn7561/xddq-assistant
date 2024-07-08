import { login } from "./modules/servers.js";
import logger from "./utils/logger.js";
import WebSocketManager from "./modules/websocket.js";
import account from "./account.js";

const main = async () => {
    try {
        const serverId = account.serverId;
        const username = account.username;
        const password = account.password;
        logger.info(`正在连接服务器...`);
        const loginResponse = await login(username, password, serverId);
        logger.info(`登录成功, ${JSON.stringify(loginResponse, null, "\t")}`);

        // Initialize WebSocket
        const uri = loginResponse.wsAddress;
        global.token = loginResponse.token;
        global.playerId = loginResponse.playerId;

        await WebSocketManager.instance.initialize(uri);
    } catch (error) {
        logger.error(error.message || error);
    }
};

main();
