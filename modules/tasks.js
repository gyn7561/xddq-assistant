import logger from "../utils/logger.js";
import { toBytes } from "../utils/convert.js";
import { create } from "./messages.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resolvePath = (...segments) => path.resolve(__dirname, ...segments);

class Task {
    constructor(name, protocol, body = {}, interval = 0) {
        this.name = name;
        this.protocol = protocol;
        this.body = body;
        this.interval = interval;
    }
}
class TaskManager {
    constructor() {
        this.isConnect = false;
        this.ws = null;
        this.tasks = [];
        this.taskIntervals = {}; // 将 taskIntervals 内置在 TaskManager 中
    }

    static get instance() {
        if (!this._instance) {
            this._instance = new TaskManager();
        }
        return this._instance;
    }

    async add(task) {
        const existingTask = this.tasks.find((t) => t.name === task.name);
        if (existingTask) {
            return;
        }

        this.tasks.push(task);

        // Execute the task immediately
        await this.executeTask(task);

        if (task.interval > 0) {
            this.taskIntervals[task.name] = setInterval(async () => {
                await this.executeTask(task);
            }, task.interval);
        }
    }

    async executeTask(task) {
        const hexString = await create(global.playerId, task.protocol, task.body);
        const messageBytes = toBytes(hexString);
        logger.debug(`[Client] ${task.name} ${task.protocol} ${JSON.stringify(task.body, null, 2)}`);
        this.ws.send(messageBytes);
        if (task.interval === 0) {
            this.remove(task.name);
        }
    }

    remove(taskName) {
        const index = this.tasks.findIndex((task) => task.name === taskName);
        if (index !== -1) {
            this.tasks.splice(index, 1);
            clearInterval(this.taskIntervals[taskName]);
            delete this.taskIntervals[taskName];
        }
    }

    generateTasks(name, id, params, count) {
        const tasks = [];
        for (let i = 0; i < count; i++) {
            tasks.push(new Task(`${name}${i + 1}`, id, params, 0));
        }
        return tasks;
    }

    async init(ws) {
        this.ws = ws;
        const initialTasks = [
            new Task("Login", 20001, { token: global.token, language: "zh_cn" }, 0), // 登陆
            new Task("Heartbeat", 20003, {}, 5000), // 每5秒发送一次心跳
            new Task("TrainPupil", 211802, { isOneKey: 1 }, 600000), // 宗门弟子自动训练
            new Task("Separation", 20215, {}, 0),   // 判断是否有分身
            new Task("CheckEmail", 20555, {}, 0),   // 一键领取邮件
        ];

        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
        const oneTimeFile = resolvePath(`../logs/${global.playerId}_${today}`);
        if (!fs.existsSync(oneTimeFile)) {
            fs.writeFileSync(oneTimeFile, 'pass');
            logger.info("添加额外的初始化任务!!!");
            const staticTasks = [
                new Task("仙宫朝拜1", 24802, {titleId: 0, isRandom: 1}, 0),
                new Task("仙宫朝拜2", 24803, {}, 0),
                new Task("升宝堂", 21005, { activityId: 9772959, mallId: 400000003, count: "1" }, 0),
                new Task("自选礼包", 21005, { activityId: 9712933, mallId: 400000003, count: "1" }, 0),
                new Task("超值礼包", 21005, { activityId: 9712935, mallId: 400000003, count: "1" }, 0),
                new Task("仙缘福泽签到", 210701, { activityId: 9712901, conditionId: 10006, type: 1 }, 0),
                new Task("仙缘免费礼包", 21005, { activityId: 9712913, mallId: 400000001, count: "1" }, 0),
                new Task("灵兽运势免费券", 21005, { activityId: 250008, mallId: 400000010, count: "1" }, 0),
                new Task("灵兽运势分享奖励", 21016, { activityId: 0, conditionId: 0 }, 0),
                new Task("灵兽运势游戏圈奖励", 21031, { activityId: 0, conditionId: 0 }, 0),
                new Task("镇妖塔选择偏好", 20767, {markPreference: [{priority: 1,skillType: 1017},{priority: 2,skillType: 1018},{priority: 3,skillType: 1023},{priority: 4,skillType: 1024},{priority: 5,skillType: 1022}]}, 0),
                new Task("镇妖塔快速挑战", 20763, {}, 0),
                new Task("广告妖盟", 20503, { taskId: [120006] }, 0),
            ]

            initialTasks.push(...staticTasks);

            initialTasks.push(...this.generateTasks("广告精怪", 20822, { drawTimes: 1, isAd: true, isUseADTime: false }, 2));
            initialTasks.push(...this.generateTasks("广告神通", 24408, { times: 1, isAd: true, isUseADTime: false }, 2));
            initialTasks.push(...this.generateTasks("广告法宝", 26302, { drawTimes: 1, isAd: true, poolId: 1, isUseADTime: false }, 2));
            initialTasks.push(...this.generateTasks("广告宗门", 211814, { isUseADTime: false }, 2));
            initialTasks.push(...this.generateTasks("挑战妖王", 20733, {}, 8));
            // initialTasks.push(...this.generateTasks("异兽入侵", 20215, {}, 5)); // 异兽入侵5次 - 需要切分身
        }

        for (const task of initialTasks) {
            try {
                await this.add(task);
            } catch (error) {
                logger.error(`Error adding task ${task.name}: ${error.message}`);
            }
        }

        this.isConnect = true;
    }
}

export { Task, TaskManager };
