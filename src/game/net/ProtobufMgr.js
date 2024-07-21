import fs from 'fs/promises';
import protobuf from 'protobufjs';
import path from 'path';
import createPath from '#utils/path.js';

const resolvePath = createPath(import.meta.url);

class ProtobufMgr {
    constructor() {
        this.cmdList = [];
        this.resvCmdList = [];
        this.messages = {};
        this.msgInfoDict = {};
        this.initialized = false;
        this.basePath = resolvePath('../config/grpc/json');
        this.protoPath = resolvePath('../config/grpc/protobuf');
    }

    static get inst() {
        if (!this._instance) {
            this._instance = new ProtobufMgr();
        }
        return this._instance;
    }

    async initialize() {
        if (this.initialized) {
            return; // Exit if already initialized
        }
        this.initialized = true; // Set the flag to true

        // 读取Json文件
        const [cityMsgInfoRes, cmdListRes, resvCmdListRes] = await Promise.all([
            fs.readFile(path.join(this.basePath, 'CityMsgInfo'), 'utf-8'),
            fs.readFile(path.join(this.basePath, 'cmdList.json'), 'utf-8'),
            fs.readFile(path.join(this.basePath, 'resvCmdList.json'), 'utf-8'),
        ]);
        const msgInfo = JSON.parse(cityMsgInfoRes);
        this.msgInfoDict = msgInfo;
        this.cmdList = JSON.parse(cmdListRes);
        this.resvCmdList = JSON.parse(resvCmdListRes);

        // 初始化 msgInfoDict
        for (const key in msgInfo) {
            const cmds = msgInfo[key];
            cmds.forEach(cmd => {
                const protocolKey = cmd.key;
                this.msgInfoDict[key][protocolKey] = this.cmdList[protocolKey];
            });
        }

        // 依次读取多个 proto 文件并加载到 messages 中
        const protoFiles = await fs.readdir(this.protoPath);

        await Promise.all(protoFiles.map(protoName => this.loadParseAllCmdMsg(protoName)));
    }

    async loadParseAllCmdMsg(protoName) {
        const root = await protobuf.load(path.join(this.protoPath, protoName));
        const msgInfo = this.msgInfoDict[protoName];

        for (const key in msgInfo) {
            if (msgInfo.hasOwnProperty(key)) {
                const msg = msgInfo[key];
                if (!msg) {
                    continue;
                }

                const cmMethod = msg.cmMethod ? `com.yq.msg.CityMsg.${msg.cmMethod}` : undefined;
                const smMethod = msg.smMethod ? `com.yq.msg.CityMsg.${msg.smMethod}` : undefined;
                if (cmMethod) {
                    this.messages[cmMethod] = root.lookupType(cmMethod);
                }
                if (smMethod) {
                    this.messages[smMethod] = root.lookupType(smMethod);
                    this.resvCmdList[msg.smMsgId] = {
                        smMethod: msg.smMethod,
                        fSmMethod: msg.fSmMethod
                    };
                }
                if (msg.byteDecode) {
                    const byteDecode = `com.yq.msg.${msg.byteDecode}`;
                    this.messages[byteDecode] = root.lookupType(byteDecode);
                }
            }
        }
    }

    getMsg(t, e) {
        const n = e ? this.cmdList[t] : this.resvCmdList[t];
        if (n) {
            const method = e ? n.cmMethod : n.smMethod;
            const msgClass = this.messages[`com.yq.msg.${method}`];
            return msgClass;
        }
        return null;
    }
}

export { ProtobufMgr };
