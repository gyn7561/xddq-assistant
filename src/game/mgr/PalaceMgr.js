import GameNetMgr from "#game/net/GameNetMgr.js";
import Protocol from "#game/net/Protocol.js";
import logger from "#utils/logger.js";

export default class PalaceMgr {
    constructor() {}

    static isMiracle = false;

    static get inst() {
        if (!this._instance) {
            this._instance = new PalaceMgr();
        }
        return this._instance;
    }

    clear() {}

    async checkReward(t) {
        for (let i = 0; i < t.data.length; i++) {
            const id = t.data[i].id;
            logger.info(`[仙宫管理] 收获礼物 ${id}`);
            GameNetMgr.inst.sendPbMsg(Protocol.S_PALACE_SEND_GIFT_GET_REWARD, {id: id, getReward: true, type: "SendGiftType_Palace"}, null);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    PalaceWorshipRsp(t) {
        if (t.titleId) {
            GameNetMgr.inst.sendPbMsg(Protocol.S_PALACE_WORSHIP, {titleId: t.titleId, isRandom: 0}, null);
        }
    }

    checkWorship(t) {
        logger.debug(`[仙宫管理] 检查崇拜`);
        if (t.worship && t.worshipRandom) {
            GameNetMgr.inst.sendPbMsg(Protocol.S_PALACE_SEND_GIFT_GET_REWARD, {titleId: 0, isRandom: 1}, null);
        }
    }

    checkMiracle(t) {
        if (t.miracleId !== 0) {
            logger.info(`[仙宫管理] 已膜拜成功`);
            PalaceMgr.isMiracle = true;
        } else {
            PalaceMgr.isMiracle = false;
            GameNetMgr.inst.sendPbMsg(Protocol.S_PALACE_SEND_GIFT_GET_REWARD, {titleId: 0, isRandom: 1}, null);
        }
    }
}
