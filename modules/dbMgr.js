import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resolvePath = (...segments) => path.resolve(__dirname, ...segments);

class DBMgr {
    constructor() {
        this.AttributeDB = {}; // 属性
        this.EquipmentDB = {}; // 翻译equipmentId
        this.EquipmentQualityDB = {}; // 装备品质
        this.LanguageWordDB = {}; // i18n
        this.SpiritsDB = {}; // 精怪
        this.GameSkillDB = {}; // 神通
        this.basePath = resolvePath('../db');
        this.initialized = false;
    }

    static get instance() {
        if (!this._instance) {
            this._instance = new DBMgr();
        }
        return this._instance;
    }

    async initialize() {
        if (this.initialized) {
            return; // Exit if already initialized
        }
        this.initialized = true; // Set the flag to true

        // 文件名到属性的映射
        const fileMappings = {
            'AttributeDB.json': 'AttributeDB',
            'EquipmentDB.json': 'EquipmentDB',
            'EquipmentQualityDB.json': 'EquipmentQualityDB',
            'LanguageWordDB.json': 'LanguageWordDB',
            'SpiritsDB.json': 'SpiritsDB',
            'GameSkillDB.json': 'GameSkillDB'
        };

        try {
            const readPromises = Object.keys(fileMappings).map(async (fileName) => {
                const filePath = path.join(this.basePath, fileName);
                const data = await fs.readFile(filePath, 'utf8');
                this[fileMappings[fileName]] = JSON.parse(data);
            });

            await Promise.all(readPromises);
            logger.info('All databases initialized successfully.');
        } catch (error) {
            logger.error('Error initializing databases:', error);
        }
    }

    getEquipment(id) {
        return this.EquipmentDB[id] || {};
    }

    getEquipmentQuality(id) {
        return this.EquipmentQualityDB[id] || null;
    }

    getEquipmentName(id) {
        const equipment = this.getEquipment(id).name || null;
        if (!equipment) {
            return '未知装备';
        }
        return this.LanguageWordDB[equipment].zh_cn;
    }

    getAttribute(id) {
        return this.AttributeDB[id] || null;
    }
}

export { DBMgr };