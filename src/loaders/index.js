import AuthService from "#services/authService.js";
import dependencyInjectorLoader from "#loaders/dependencyInjector.js";
import GameNetMgr from "#game/net/GameNetMgr.js";
import logger from '#utils/logger.js';

export default async (username, password, serverId) => {
    await dependencyInjectorLoader();

    try {
        // Login first, and then fetch the wsAddress and token
        const authServiceInstance = new AuthService();
        const response = await authServiceInstance.Login(username, password, serverId);

        // Initialize WebSocket
        const { wsAddress, playerId, token } = response;
        GameNetMgr.inst.connectGameServer(wsAddress, playerId, token);
    } catch (error) {
        logger.error(error.message || error);
    }
};

