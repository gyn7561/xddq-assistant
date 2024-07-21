import logger from "#utils/logger.js";
import { ProtobufMgr } from "#game/net/ProtobufMgr.js";
import { DBMgr } from "#game/common/DBMgr.js";

export default async () => {
    try {
        const protobufMgr = ProtobufMgr.inst;
        await protobufMgr.initialize();

        const dbMgr = DBMgr.inst;
        await dbMgr.initialize();

        logger.debug("👍 Dependency injector loaded!");
    } catch (e) {
        logger.error("🔥 Error on dependency injector loader: %o", e);
        throw e;
    }
};
