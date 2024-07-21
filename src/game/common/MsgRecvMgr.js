import logger from "#utils/logger.js";
import Protocol from "#game/net/Protocol.js";
import GameNetMgr from "#game/net/GameNetMgr.js";
import CustomMgr from "#game/mgr/CustomMgr.js";
import BagMgr from "#game/mgr/BagMgr.js";
import FrogMgr from "#game/mgr/FrogMgr.js";
import DestinyMgr from "#game/mgr/DestinyMgr.js";
import UserMgr from "#game/mgr/UserMgr.js";
import SpiritMgr from "#game/mgr/SpiritMgr.js";
import PlayerAttributeMgr from "#game/mgr/PlayerAttributeMgr.js";
import PalaceMgr from "#game/mgr/PalaceMgr.js";
import MagicMgr from "#game/mgr/MagicMgr.js";
import MagicTreasureMgr from "#game/mgr/MagicTreasureMgr.js";
import PupilMgr from '#game/mgr/PupilMgr.js';
import GatherEnergyMgr from "#game/mgr/GatherEnergyMgr.js";
import WildBossMgr from "#game/mgr/WildBossMgr.js";
import TowerMgr from "#game/mgr/TowerMgr.js";
import ChapterMgr from "#game/mgr/ChapterMgr.js";
import SecretTowerMgr from "#game/mgr/SecretTowerMgr.js";
import HeroRankMgr from "#game/mgr/HeroRankMgr.js";
import ActivityMgr from "#game/mgr/ActivityMgr.js";
import UnionMgr from "#game/mgr/UnionMgr.js";
import HomelandMgr from "#game/mgr/HomelandMgr.js";

class MsgRecvMgr {
    constructor() {
        this.loginMsgIdList = [
            Protocol.S_PLAYER_DATA_SYNC_MSG,     // 101 用户信息同步
            Protocol.S_SYSTEM_UNLOCK_SYNC_MSG,   // 102 系统解锁同步 TODO
            Protocol.S_ATTRIBUTE_DATA_SYNC_MSG,  // 201 玩家属性信息同步
            Protocol.S_DREAM_DATA_SYNC,          // 207 做梦数据同步(树状态及未处理装备) Done
            Protocol.S_TASK_DATA_SEND,           // 501 玩家登录任务数据下发 TODO
        ];
    }

    // 101 用户信息同步
    static PlayerDataMsg(t) {
        UserMgr.nickName = t.nickName;
        UserMgr.playerId = t.playerId;
        UserMgr.roleId = t.roleId;
        UserMgr.serverId = Number(t.serverId);
    }

    // 104 同步特权卡数据
    static PrivilegeCardDataMsg(t) {
        logger.debug("[MsgRecvMgr] 同步特权卡数据");
        PlayerAttributeMgr.inst.SyncVip(t);
    }

    // 201 玩家属性信息同步
    static PlayerAttributeDataMsg(t) {
        logger.debug("[MsgRecvMgr] 玩家属性信息同步");
        PlayerAttributeMgr.inst.SyncAttribute(t);
    }

    // 207 树状态
    static DreamDataMsg(t) {
        logger.debug("[MsgRecvMgr] 树状态同步");
        PlayerAttributeMgr.inst.SyncTree(t);
        // 初始化完成后 自定义管理器初始化
        CustomMgr.inst.init();
    }

    // 209 获取未处理装备数据
    static GetUnDealEquipmentMsgResp(t) {
        logger.debug("[MsgRecvMgr] 获取未处理装备数据");
        PlayerAttributeMgr.inst.handlerEquipment(t);
    }

    // 210 青蛙
    static PlayerAdRewardDataMsg(t) {
        logger.debug("[MsgRecvMgr] 青蛙数据同步");
        FrogMgr.inst.checkReward(t);
    }

    // 215 同步分身数据
    static GetSeparationDataMsgListResp(t) {
        logger.debug("[MsgRecvMgr] 同步分身数据");
        PlayerAttributeMgr.inst.checkSeparation(t);
    }

    // 301 同步背包数据
    static SyncBagMsg(t) {
        logger.debug("[MsgRecvMgr] 背包数据同步");
        BagMgr.inst.SyncBagMsg(t);
    }

    // 651 游历数据同步
    static DestinyData(t) {
        logger.debug("[MsgRecvMgr] 游历数据同步");
        DestinyMgr.inst.SyncData(t);
    }

    // 821 同步玩家精怪数据
    static SpiritPlayerDataMsg(t) {
        logger.debug("[MsgRecvMgr] 精怪数据同步");
        // TODO: SpiritMgr.inst.syncSpiritPlayerDataMsg(t);
        SpiritMgr.inst.checkReward(t);
    }

    // 2124 妖盟数据 推送我的妖盟数据更新
    static MyUnionData(t) {
        logger.debug("[MsgRecvMgr] 妖盟数据同步");
        UnionMgr.pushMyUnionDataBroadcast(t);
    }

    // 2165 妖盟砍价数据同步
    static CutPriceDataMsg(t) {
        logger.debug("[MsgRecvMgr] 妖盟砍价数据同步");
        UnionMgr.inst.cutPriceSyncData(t);
    }

    // // 5807 妖盟 妖邪讨伐同步boss信息
    // static UnionBossMsg(t) {
    //     logger.info("妖邪讨伐boss信息同步");
    //     UnionMgr.inst.SyncUnionBossMsg(t);
    // }

    // // 5808  妖盟 妖邪讨伐布阵信息同步 满20层开打
    // static UnionBossBuff(t) {
    //     UnionMgr.inst.SyncUnionBossBuffMsg(t);
    // }

    // 4802 仙宫点赞同步
    static PalaceWorshipRsp(t) {
        logger.debug("[MsgRecvMgr] 仙宫点赞同步");
        PalaceMgr.inst.PalaceWorshipRsp(t);
    }

    // 4803 仙宫外部数据请求
    static EnterPalaceRsp(t) {
        logger.debug("[MsgRecvMgr] 仙宫外部数据请求");
        PalaceMgr.inst.checkWorship(t);
    }

    // 4808 仙宫送福数据同步
    static SendGiftSyncMsg(t) {
        logger.debug("[MsgRecvMgr] 仙宫送福数据同步");
        PalaceMgr.inst.checkReward(t);
    }

    // 4809 仙宫神迹同步
    static PalaceMiracleDataMsg(t) {
        logger.debug("[MsgRecvMgr] 仙宫神迹同步");
        PalaceMgr.inst.checkMiracle(t);
    }

    // 11801 进入宗门系统
    static EnterPupilSystemResp(t) {
        logger.debug("[MsgRecvMgr] 进入宗门系统");
        PupilMgr.inst.checkReward(t);
        PupilMgr.inst.checkGraduatation(t);
    }

    // 4400 神通数据同步
    static PlayerMagicDataMsg(t) {
        logger.debug("[MsgRecvMgr] 神通数据同步");
        // TODO: MagicMgr.inst.syncMagicDataMsg(t);
        MagicMgr.inst.checkReward(t);
    }

    // 6301 玩家法宝数据同步
    static MagicTreasurePlayerDataMsg(t) {
        logger.debug("[MsgRecvMgr] 法宝数据同步");
        // TODO: MagicTreasureMgr.inst.syncMagicTreasureDataMsg(t);
        MagicTreasureMgr.inst.checkReward(t);
    }

    // 7001 聚灵阵状态
    static GatherEnergyEnterNewResp(t) {
        logger.debug("[MsgRecvMgr] 聚灵阵状态同步");
        GatherEnergyMgr.inst.SyncGatherEnergyMsgState(t);
    }

    // 402 关卡挑战
    static ChallengeRspMsg(t) {
        logger.debug("[MsgRecvMgr] 关卡挑战");
        ChapterMgr.inst.challengeResult(t);
    }

    // 403 同步冒险关卡数据
    static PlayerStageData(t) {
        logger.debug("[MsgRecvMgr] 冒险关卡数据同步");
        ChapterMgr.inst.SyncData(t);
    }

    // 551 邮件列表数据同步
    static MailListMsg(t) {
        logger.debug("[MsgRecvMgr] 一键领取邮件奖励");
        GameNetMgr.inst.sendPbMsg(Protocol.S_MAIL_GET_ALL_REWARD, {}, null);
    }

    // 731 妖王数据同步
    static WildBossDataSync(t) {
        logger.debug("[MsgRecvMgr] 妖王数据同步");
        WildBossMgr.inst.checkReward(t);
    }

    // 761 镇妖塔数据同步
    static TowerDataMsg(t) {
        logger.debug("[MsgRecvMgr] 同步镇妖塔数据");
        TowerMgr.inst.SyncData(t);
    }

    // 762 镇妖塔挑战结果
    static TowerChallengeResp(t) {
        logger.debug("[MsgRecvMgr] 镇妖塔挑战结果");
        TowerMgr.inst.challengeResult(t);
    }

    // 5602 真火秘境战斗结果
    static SecretTowerFightResp(t) {
        logger.debug("[MsgRecvMgr] 真火秘境战斗结果");
        SecretTowerMgr.inst.challengeResult(t);
    }
    
    // 5605 真火秘境 秘境数据同步
    static SynSecretTowerInfo(t) {
        logger.debug("[MsgRecvMgr] 真火秘境数据同步");
        SecretTowerMgr.inst.SyncData(t);
    }

    // 3701 群英榜 同步玩家信息
    static SynHeroRankPlayerInfo(t) {
        logger.debug("[MsgRecvMgr] 群英榜 同步玩家信息");
        HeroRankMgr.inst.SyncData(t.playerInfo);
    }

    // 3702 群英榜 同步玩家排行榜
    static RspHeroRankFightPlayerList(t) {
        logger.debug("[MsgRecvMgr] 群英榜 同步玩家排行榜");
        HeroRankMgr.inst.getFightList(t);
    }

    // 3703 群英榜 请求挑战玩家
    static RspHeroRankFight(t) {
        logger.debug("[MsgRecvMgr] 群英榜 请求挑战玩家");
        HeroRankMgr.inst.doFight(t);
    }

    // 1002 活动 同步详细配置
    static ActivityCommonDataListSync(t) {
        logger.debug("[MsgRecvMgr] 同步活动详细");
        // ActivityMgr.inst.getReward(t); // 有问题
        // ActivityMgr.inst.buyFree(t);   // 有问题
    }

    // 1007 活动 增量同步活动数据 
    static ActivityConditionDataListSync(t) {
        logger.debug("[MsgRecvMgr] 增量同步数据");
        // ActivityMgr.inst.getReward(t); // 有问题
    }

    // 1051 同步福地鼠宝数据
    static SyncHomelandMsg(t) {
        logger.debug("[MsgRecvMgr] 同步福地鼠宝数据");
        HomelandMgr.inst.doInit(t);
    }

    // 1052 进入福地
    static HomelandEnterResp(t) {
        logger.debug("[MsgRecvMgr] 进入福地");
        HomelandMgr.inst.doEnter(t);
    }

    // 1053 福地管理界面
    static HomelandManageResp(t) {
        logger.debug("[MsgRecvMgr] 同步福地鼠宝数据");
        HomelandMgr.inst.doManage(t);
    }

    // 1058 福地探寻
    static HomelandExploreResp(t) {
        logger.debug("[MsgRecvMgr] 福地探寻");
        HomelandMgr.inst.doExplore(t);
    }

// TODO: 以下代码未完成
// import SystemUnlockMgr from "#game/mgr/SystemUnlockMgr.js";
//     // 102 系统解锁同步
//     static SystemUnlockSync(t) {
//         logger.debug("[MsgRecvMgr] 系统解锁同步");
//         SystemUnlockMgr.inst.SystemUnlockSync(t);
//     }

// import TalentMgr from "#game/mgr/TalentMgr.js";
//     // 621 同步灵脉数据
//     static TalentPlayerDataMsg(t) {
//         logger.debug("[MsgRecvMgr] 灵脉数据同步");
//         TalentMgr.inst.syncTalentPlayerDataMsg(t);
//     }

// TODO 以下暂时不想写
// import InvadeMgr from "#game/mgr/InvadeMgr.js";
//     // 1402 异兽入侵数据同步
//     static InvadeDataMsg(t) {
//         logger.debug("[MsgRecvMgr] 异兽入侵用户数据同步");
//         InvadeMgr.inst.InvadeDataMsg(t);
//         // 5次
//     }


// import CommonRedPacketMgr from "#game/mgr/CommonRedPacketMgr.js";
//     // 140 红包状态同步 TODO 自动领取
//     static RedPacketStateMsgSync(t) {
//         logger.debug("[MsgRecvMgr] 红包状态同步");
//         CommonRedPacketMgr.inst.syncRedPacketState(t);
//     }

// import EquipmentAdvanceMgr from "#game/mgr/EquipmentAdvanceMgr.js";
//     // 5504 装备精炼数据同步
//     static EquipmentAdvanceDataMsg(t) {
//         logger.debug("[MsgRecvMgr] 装备精炼数据同步");
//         EquipmentAdvanceMgr.inst.syncEquipmentData(t);
//     }

// import PetsMgr from "#game/mgr/PetsMgr.js";
//     // 740 同步玩家灵兽数据
//     static PlayerPetDataSync(t) {
//     //     logger.debug("[MsgRecvMgr] 同步玩家灵兽数据");
//         PetsMgr.inst.SyncPlayerPetDataMsg(t.playerPetData);
//     }

//     // static PetKernelPlayerDataMsg(t) {
//     //     logger.debug("[MsgRecvMgr] 内丹数据同步");
//     //     PetsMgr.inst.pieceShopOpen = t.pieceShopOpen;
//     // }

// import TaskMgr from "#game/mgr/TaskMgr.js";
//     // 501 玩家登录任务数据下发
//     static TaskDataListMsg(t, e) {
//         if (e == Protocol.getProtocalIdRemainder(Protocol.S_TASK_DATA_SEND)) {
//             logger.debug("[MsgRecvMgr] 任务全量同步");
//             TaskMgr.inst.initTaskList(t);
//         } else {
//             logger.debug("[MsgRecvMgr] 任务增量同步");
//             TaskMgr.inst.syncTaskList(t);
//         }
//     }

// import RemoteStarTrialMgr from "#game/mgr/RemoteStarTrialMgr.js";
//     // 6901 星宿试炼数据同步
//     static StarTrialDataMsg(t) {
//         logger.debug("[MsgRecvMgr] 星宿试炼数据同步");
//         RemoteStarTrialMgr.SyncData(t);
//     }

// import UniverseMgr from "#game/mgr/UniverseMgr.js";
//     // static UniverseDataMsgSync(t) {
//     //     logger.debug("[MsgRecvMgr] 小世界信息同步");
//     //     UniverseMgr.inst.UniverseDataMsgSync(t);
//     // }

// import WorldRuleMgr from "#game/mgr/WorldRuleMgr.js";
//     // 9005 天地法则玩家数据同步
//     static WorldRulePlayerDataMsg(t) {
//         logger.debug("[MsgRecvMgr] 天地法则数据同步");
//         WorldRuleMgr.inst.syncWorldRulePlayerDataMsg(t);
//     }



}

export default MsgRecvMgr;
