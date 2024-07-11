//简单进程守护 
import { spawn } from 'child_process';
import account from './account.js';

async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

(async () => {
    async function runCmd() {
        return new Promise((resolve, reject) => {
            const childProcess = spawn("node", ["app.js"], {
                "cwd": process.cwd(),
                "shell": true,
                "stdio": "inherit",
                env: {
                    ...process.env,
                    "XDDQ-ASSISTANT-USE-FOREVER": "true"
                }
            });

            childProcess.on("exit", (code, signal) => {
                console.log('子进程以' + `code ${code}和signal ${signal} 退出`);
                resolve(code);
            });

            childProcess.on("error", (err) => {
                console.error(err);
                reject(err);
            })
        });
    }

    while (true) {
        try {
            await runCmd();
        } catch (error) {
            console.error(error);
        }
        await sleep(account.reconnectInterval);
    }

})();