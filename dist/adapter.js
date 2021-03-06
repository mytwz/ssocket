"use strict";
/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description:
 * @LastEditTime: 2021-04-26 16:48:39 +0800
 * @FilePath: /ssocket/src/adapter.ts
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Adapter = void 0;
const code_1 = __importDefault(require("./code"));
const ioredis_1 = __importDefault(require("ioredis"));
const events_1 = require("events");
const logger_1 = __importDefault(require("./logger"));
const os_1 = __importDefault(require("os"));
const HOST_NAME = os_1.default.hostname();
const logger = logger_1.default("adapter");
/**系统事件 */
const SYNC_EVENTS = [
    "emit_socket_message",
];
ioredis_1.default.prototype.keys = function (pattern) {
    return __awaiter(this, void 0, void 0, function* () {
        let cursor = 0;
        let list = [];
        do {
            let res = yield this.scan(cursor, "match", pattern, "count", 2000);
            cursor = +res[0];
            list = list.concat(res[1]);
        } while (cursor != 0);
        return list;
    });
};
/**Redis Key */
const REDIS_SOCKET_SERVICE_KEY = "ssocket_service";
/**获取主机名的正则 */
const HOSTNAME_REGEXP = /(?<=:H)[^:]+/g;
/**获取进程号的正则 */
const PROCESS_REGEXP = /(?<=:P)[^:]+/g;
/**获取渠道号的正则 */
const CHANNEL_REGEXP = /(?<=:C)[^:]+/g;
/**获取设备号的正则 */
const EQUIPMENT_REGEXP = /(?<=:D)[^:]+/g;
/**获取房间号的正则 */
const ROOM_ID_REGEXP = /(?<=:R)[^:]+/g;
/**获取用户 ID 的正则 */
const UID_REGEXP = /(?<=:U)[^:]+/g;
/**获取 Socket 连接 ID 的正则 */
const SID_REGEXP = /(?<=:S)[^:]+/g;
const X = "XXX";
const U = /(?<=U)\*/;
const R = /(?<=R)\*/;
const D = /(?<=D)\*/;
const C = /(?<=C)\*/;
const S = /(?<=S)\*/;
const P = /(?<=P)\*/;
const H = /(?<=H)\*/;
const HOST_PROCESS = `H${HOST_NAME}:P${process.pid}`;
const ALL_KEY = `${REDIS_SOCKET_SERVICE_KEY}:H*:P*:C*:O*:D*:B*:R*:S*`;
const HOST_KEY = `${REDIS_SOCKET_SERVICE_KEY}:H${X}:P*:C*:O*:D*:B*:R*:S*`;
const PROCESS_KEY = `${REDIS_SOCKET_SERVICE_KEY}:H*:P${X}:C*:O*:D*:B*:R*:S*`;
const SID_KEY = `${REDIS_SOCKET_SERVICE_KEY}:H*:P*:C*:O*:D*:B*:R*:S${X}`;
const ROOM_ID_KEY = `${REDIS_SOCKET_SERVICE_KEY}:H*:P*:C*:O*:D*:B*:R${X}:S*`;
const EQUIPMENT_KEY = `${REDIS_SOCKET_SERVICE_KEY}:H*:P*:C*:O*:D${X}:B*:R*:S*`;
const CHANNEL_KEY = `${REDIS_SOCKET_SERVICE_KEY}:H*:P*:C${X}:O*:D*:B*:R*:S*`;
const SYSTEM_ROOMID = "unknown";
const SYSTEM_USERID = "unknown";
class Adapter {
    constructor(opts) {
        this.opts = opts;
        /**客户端集合 */
        this.clients = new Map();
        /**Redis 订阅对象 */
        this.sub_redis = undefined;
        /**Redis  */
        this.pub_redis = undefined;
        /**事件触发器 */
        this.emitter = new events_1.EventEmitter();
        this.clientkeys = {};
        this.tmpclientkeys = {};
        this.data_redis = undefined;
        if (this.opts) {
            this.sub_redis = new ioredis_1.default(this.opts);
            ;
            this.pub_redis = new ioredis_1.default(this.opts);
            ;
            this.data_redis = new ioredis_1.default(this.opts);
            ;
            if (this.opts.password) {
                try {
                    this.sub_redis.auth(this.opts.password);
                    this.pub_redis.auth(this.opts.password);
                    this.data_redis.auth(this.opts.password);
                }
                catch (error) {
                    logger("constructor", error);
                }
            }
            this.sub_redis.subscribe(SYNC_EVENTS);
            this.sub_redis.on("message", (event, message) => {
                logger("redis-event", message);
                this.emitter.emit(event, JSON.parse(message));
            });
            this.emitter.on("emit_socket_message", this.emit_socket_message.bind(this));
        }
        logger("constructor", { opts: this.opts });
    }
    /**
     * @param channel
     * @param os
     * @param device
     * @param browser
     * @param roomid
     * @param uid
     * @param sid
     */
    addUserRelation(channel, os, device, browser, roomid, sid) {
        return __awaiter(this, void 0, void 0, function* () {
            let key = `${REDIS_SOCKET_SERVICE_KEY}:${HOST_PROCESS}:C${channel}:O${os}:D${device}:B${browser}:R${roomid}:S${sid}`;
            if (this.data_redis) {
                yield this.data_redis.set(key, sid, "px", 1000 * 60 * 60 * 24);
            }
            else
                this.tmpclientkeys[this.clientkeys[key] = sid] = key;
        });
    }
    /**
     * 移除客户端关系
     * @param {*} sid
     */
    removeUserRelation(sid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.data_redis) {
                let keys = yield this.data_redis.keys(SID_KEY.replace(X, sid));
                for (let key of keys) {
                    yield this.data_redis.del(key);
                }
            }
            else {
                delete this.clientkeys[this.tmpclientkeys[sid]];
                delete this.tmpclientkeys[sid];
            }
        });
    }
    /**
     * 获取 ID
     * @param {*} keyPattern Redis Key
     * @param {*} regExp 对应资源的正则
     */
    findIds(keyPattern, regExp) {
        return __awaiter(this, void 0, void 0, function* () {
            const keys = this.data_redis ? yield this.data_redis.keys(keyPattern) : Object.keys(this.clientkeys).filter(key => new RegExp(keyPattern.replace(/\*/g, ".*")).test(key));
            return this.matchIds(keys, regExp);
        });
    }
    /**
     * 在 Keys 中获取 ID列表
     * @param {*} keys
     * @param {*} keyPattern
     * @param {*} regExp
     */
    findIdsByKeys(keys, keyPattern, id, regExp) {
        const keyList = keys.filter(key => new RegExp(keyPattern.replace(X, id).replace(/\*/g, ".*")).test(key));
        return this.matchIds(keyList, regExp);
    }
    /**
     * 从 Key 中获取指定的 ID
     * @param {*} key
     * @param {*} regExp
     */
    matchId(key, regExp) {
        var _a;
        return ((_a = String(key).match(regExp)) === null || _a === void 0 ? void 0 : _a.pop()) + "";
    }
    /**
     * 从 Key 中获取指定的 ID
     * @param {*} keys
     * @param {*} regExp
     */
    matchIds(keys, regExp) {
        return [...new Set(keys.map(key => this.matchId(key, regExp)))];
    }
    /**
     * 根据房间ID获取所有的 Sid
     * @param {*} roomid
     */
    findSidsByRoomid(roomid) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield this.findIds(ROOM_ID_KEY.replace(X, roomid), SID_REGEXP);
            return results || [];
        });
    }
    /**
     * 根据房间ID获取所有的 Uid
     * @param {*} roomid
     */
    findUidsByRoomid(roomid) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield this.findIds(ROOM_ID_KEY.replace(X, roomid), UID_REGEXP);
            return results || [];
        });
    }
    /**
     * 根据 SID 获取房间ID
     * @param {*} uid
     */
    findRoomidsBySid(sid) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield this.findIds(SID_KEY.replace(X, sid), ROOM_ID_REGEXP);
            return (results || []).filter(id => id != SYSTEM_ROOMID);
        });
    }
    /**
     * 根据 UID 获取 SID
     * @param {*} uid
     */
    findSidsByRoomidAndUid(roomid, uid) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield this.findIds(ALL_KEY.replace(/R\*/, roomid).replace(/U\*/, uid), SID_REGEXP);
            return results || [];
        });
    }
    /**
     * 获取所有的 ROOMID
     */
    findAllRoomid() {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield this.findIds(ALL_KEY, ROOM_ID_REGEXP);
            return (results || []).filter(id => id != SYSTEM_ROOMID);
        });
    }
    /**
     * 获取所有的 channel
     */
    findAllEquipment() {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield this.findIds(ALL_KEY, EQUIPMENT_REGEXP);
            return results || [];
        });
    }
    /**获取所有的Sid */
    findAllSids() {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield this.findIds(ALL_KEY, SID_REGEXP);
            return results || [];
        });
    }
    /**
     * 根据 channel 获取 ROOMID
     * @param {*} channel
     */
    findRoomidsByEquipment(equipment) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield this.findIds(EQUIPMENT_KEY.replace(X, equipment), ROOM_ID_REGEXP);
            return results || [];
        });
    }
    /**
     * 获取所有的 Keys
     */
    findAllKeys() {
        return __awaiter(this, void 0, void 0, function* () {
            const results = this.data_redis ? yield this.data_redis.keys(ALL_KEY) : Object.keys(this.clientkeys);
            return results || [];
        });
    }
    /**
     * 通过 Redis 进行多服务器消息同步
     * @param message
     */
    emit_socket_message(message) {
        let client = this.clients.get(message.id);
        if (client) {
            logger("emit_socket_message", message);
            client.response(message.data.path, message.data.status, message.data.msg, 0, message.data.data);
        }
        else {
            this.delete(message.id);
        }
    }
    /**
     * 获取一个 Socket 客户端对象
     * @param id
     */
    get(id) {
        return this.clients.get(id);
    }
    /**
     * 增加一个 Socket 连接
     * @param {*} id
     * @param {*} socket
     */
    set(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            logger("set", socket.getid());
            this.clients.set(socket.getid(), socket);
            this.addUserRelation("summer01", socket.os, socket.device, socket.browser, SYSTEM_ROOMID, socket.getid());
            return socket;
        });
    }
    /**
     * 删除一个 Socket 连接
     * @param {*} id
     */
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            logger("delete", id);
            this.clients.delete(id);
            this.removeUserRelation(id);
        });
    }
    /**
     * 加入房间
     * @param id
     * @param room
     */
    join(id, room) {
        return __awaiter(this, void 0, void 0, function* () {
            logger("join", id, room);
            let socket = this.get(id);
            this.addUserRelation("summer01", socket.os, socket.device, socket.browser, room, socket.getid());
        });
    }
    /**
     * 离开房间
     * @param id
     * @param room
     */
    leave(id, room) {
        return __awaiter(this, void 0, void 0, function* () {
            logger("leave", id, room);
            if (this.data_redis) {
                let keys = yield this.data_redis.keys(ALL_KEY.replace(/R\*/, room).replace(/S\*/, id));
                for (let key of keys) {
                    yield this.data_redis.del(key);
                }
            }
            else {
                delete this.clientkeys[this.tmpclientkeys[id]];
                delete this.tmpclientkeys[id];
            }
        });
    }
    /**
     * 获取所有的房间号
     */
    getRoomall() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.findAllRoomid();
        });
    }
    /**
     * 根据房间号获取所有的客户端ID
     * @param room
     */
    getClientidByroom(room) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.findSidsByRoomid(room);
        });
    }
    /**
     * 根据 客户端ID 获取所在的所有房间ID
     * @param id
     */
    getRoomidByid(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.findRoomidsBySid(id);
        });
    }
    /**
     * 判断客户端是否存在啊某个房间
     * @param id
     * @param room
     */
    hasRoom(id, room) {
        return __awaiter(this, void 0, void 0, function* () {
            let sids = yield this.findSidsByRoomid(room);
            return sids.includes(id);
        });
    }
    /**
     * 获取所有的房间总数
     */
    getAllRoomcount() {
        return __awaiter(this, void 0, void 0, function* () {
            let rooms = yield this.findAllRoomid();
            return rooms.length - 1;
        });
    }
    /**
     * 获取房间内人员数量
     * @param room
     */
    getRoomsize(room) {
        return __awaiter(this, void 0, void 0, function* () {
            let sids = yield this.findSidsByRoomid(room);
            return sids.length;
        });
    }
    /**
     * 发送房间消息
     * @param room
     * @param event
     * @param data
     * @param status
     * @param msg
     */
    sendRoomMessage(room, event, data, status = code_1.default[200][0], msg = code_1.default[200][1]) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let id of yield this.getClientidByroom(room)) {
                this.sendSocketMessage(id, event, data, status, msg);
            }
        });
    }
    /**
     * 发送广播消息
     * @param event
     * @param data
     * @param status
     * @param msg
     */
    sendBroadcast(event, data, status = code_1.default[200][0], msg = code_1.default[200][1]) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let sid of yield this.getClientidByroom(SYSTEM_ROOMID)) {
                this.sendSocketMessage(sid, event, data, status, msg);
            }
        });
    }
    /**
     * 发送终端消息
     * @param {*} id Socket sid
     * @param {*} type 消息类型
     * @param {*} data
     */
    sendSocketMessage(id, event, data, status = code_1.default[200][0], msg = code_1.default[200][1]) {
        return __awaiter(this, void 0, void 0, function* () {
            logger("sendSocketMessage", { id, data });
            if (this.pub_redis) {
                this.pub_redis.publish("emit_socket_message", JSON.stringify({ id, data: { path: event, status, msg, data } }));
            }
            else {
                this.emit_socket_message({ id, data: { path: event, data, status, msg, request_id: 0 } });
            }
        });
    }
}
exports.Adapter = Adapter;
