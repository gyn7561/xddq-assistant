import { spawn } from "child_process";
import account from "./account.js";
import logger from "#utils/logger.js";

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
    let childProcess;
    const reconnectInterval = account.reconnectInterval || 60 * 1000 * 5;

    async function runCmd() {
        childProcess = spawn("node", ["./src/index.js"], {
            cwd: process.cwd(),
            shell: true,
            stdio: "inherit",
            env: {
                ...process.env,
            },
        });

        childProcess.on("exit", async () => {
            logger.warn(`[守护] 子进程退出，${reconnectInterval / 1000} 秒后重启`);
            restartProcess();
        });

        childProcess.on("error", (err) => {
            logger.error("[守护] 子进程出错", err);
        });
    }

    async function restartProcess() {
        if (childProcess) {
            childProcess.kill(); // 杀死当前子进程
            await new Promise((resolve) => {
                childProcess.on("exit", resolve); // 确保子进程完全退出
            });
        }
        await sleep(reconnectInterval); // 确保子进程重启前有足够的时间间隔
        await runCmd();
    }

    // 开始运行子进程
    await runCmd();
})();