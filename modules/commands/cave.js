const fs = require("fs");
const request = require("request");
const cooldownTime = 86400; // Thời gian làm tiếp là 86400 giây (24 giờ)

module.exports.config = {
    name: "cave",
    version: "1.0.1",
    hasPermssion: 0,
    credits: "",
    description: "Làm cave kiếm tiền",
    commandCategory: "Kiếm Tiền",
    cooldowns: 5,
    envConfig: {
        cooldownTime: cooldownTime // Đặt cooldownTime trong envConfig
    },
    dependencies: {
        "fs": "",
        "request": ""
    }
};

module.exports.onLoad = () => {
    const fs = require("fs-extra");
    const dirMaterial = __dirname + `/cache/`;
    if (!fs.existsSync(dirMaterial + "cache")) fs.mkdirSync(dirMaterial, { recursive: true });
};

module.exports.handleReply = async ({ event: e, api, handleReply, Currencies }) => {
    const { threadID, messageID, senderID } = e;
    let data = (await Currencies.getData(senderID)).data || {};
    if (handleReply.author != e.senderID) 
        return api.sendMessage("Nó làm cave có phải mày đâu mà rep", e.threadID, e.messageID);
    var randomAmount = Math.random();
    var a;
    switch (e.body) {
        case "1":
            if (randomAmount < 0.4) {
                a = Math.floor(Math.random() * (400000 - 200000 + 1)) + 200000;
                var msg = `🇻🇳 Bạn vừa làm gái ngành ở Việt Nam và được ${a} VND`;
            } else if (randomAmount < 0.7) {
                a = Math.floor(Math.random() * (600000 - 400000 + 1)) + 400000;
                var msg = `🇻🇳 Bạn vừa làm phò ở Việt Nam và được ${a} VND`;
            } else if (randomAmount < 0.9) {
                a = Math.floor(Math.random() * (800000 - 600000 + 1)) + 600000;
                var msg = `🇻🇳 Bạn vừa làm gái bán hoa ở Việt Nam và được ${a} VND`;
            } else {
                a = Math.floor(Math.random() * (1000000 - 800000 + 1)) + 800000;
                var msg = `🇻🇳 Bạn vừa làm gái đứng đường ở Việt Nam và được ${a} VND`;
            }
            break;
        case "2":
            if (randomAmount < 0.4) {
                a = Math.floor(Math.random() * (400000 - 200000 + 1)) + 200000;
                var msg = `🇨🇳 Bạn vừa làm gái ngành ở Trung Quốc và được ${a} VND`;
            } else if (randomAmount < 0.7) {
                a = Math.floor(Math.random() * (600000 - 400000 + 1)) + 400000;
                var msg = `🇨🇳 Bạn vừa làm phò ở Trung Quốc và được ${a} VND`;
            } else if (randomAmount < 0.9) {
                a = Math.floor(Math.random() * (800000 - 600000 + 1)) + 600000;
                var msg = `🇨🇳 Bạn vừa làm gái bán hoa ở Trung Quốc và được ${a} VND`;
            } else {
                a = Math.floor(Math.random() * (1000000 - 800000 + 1)) + 800000;
                var msg = `🇨🇳 Bạn vừa làm gái đứng đường ở Trung Quốc và được ${a} VND`;
            }
            break;
        case "3":
            if (randomAmount < 0.4) {
                a = Math.floor(Math.random() * (400000 - 200000 + 1)) + 200000;
                var msg = `🇯🇵 Bạn vừa làm gái ngành ở Nhật Bản và được ${a} VND`;
            } else if (randomAmount < 0.7) {
                a = Math.floor(Math.random() * (600000 - 400000 + 1)) + 400000;
                var msg = `🇯🇵 Bạn vừa làm phò ở Nhật Bản và được ${a} VND`;
            } else if (randomAmount < 0.9) {
                a = Math.floor(Math.random() * (800000 - 600000 + 1)) + 600000;
                var msg = `🇯🇵 Bạn vừa làm gái bán hoa ở Nhật Bản và được ${a} VND`;
            } else {
                a = Math.floor(Math.random() * (1000000 - 800000 + 1)) + 800000;
                var msg = `🇯🇵 Bạn vừa làm gái đứng đường ở Nhật Bản và được ${a} VND`;
            }
            break;
        case "4":
            if (randomAmount < 0.4) {
                a = Math.floor(Math.random() * (400000 - 200000 + 1)) + 200000;
                var msg = `🇹🇭 Bạn vừa làm gái ngành ở Thái Lan và được ${a} VND`;
            } else if (randomAmount < 0.7) {
                a = Math.floor(Math.random() * (600000 - 400000 + 1)) + 400000;
                var msg = `🇹🇭 Bạn vừa làm phò ở Thái Lan và được ${a} VND`;
            } else if (randomAmount < 0.9) {
                a = Math.floor(Math.random() * (800000 - 600000 + 1)) + 600000;
                var msg = `🇹🇭 Bạn vừa làm gái bán hoa ở Thái Lan và được ${a} VND`;
            } else {
                a = Math.floor(Math.random() * (1000000 - 800000 + 1)) + 800000;
                var msg = `🇹🇭 Bạn vừa làm gái đứng đường ở Thái Lan và được ${a} VND`;
            }
            break;
        case "5":
            if (randomAmount < 0.4) {
                a = Math.floor(Math.random() * (400000 - 200000 + 1)) + 200000;
                var msg = `🇺🇸 Bạn vừa làm gái ngành ở Mỹ và được ${a} VND`;
            } else if (randomAmount < 0.7) {
                a = Math.floor(Math.random() * (600000 - 400000 + 1)) + 400000;
                var msg = `🇺🇸 Bạn vừa làm phò ở Mỹ và được ${a} VND`;
            } else if (randomAmount < 0.9) {
                a = Math.floor(Math.random() * (800000 - 600000 + 1)) + 600000;
                var msg = `🇺🇸 Bạn vừa làm gái bán hoa ở Mỹ và được ${a} VND`;
            } else {
                a = Math.floor(Math.random() * (1000000 - 800000 + 1)) + 800000;
                var msg = `🇺🇸 Bạn vừa làm gái đứng đường ở Mỹ và được ${a} VND`;
            }
            break;
        case "6":
            if (randomAmount < 0.4) {
                a = Math.floor(Math.random() * (400000 - 200000 + 1)) + 200000;
                var msg = `🇰🇭 Bạn vừa làm gái ngành ở Campuchia và được ${a} VND`;
            } else if (randomAmount < 0.7) {
                a = Math.floor(Math.random() * (600000 - 400000 + 1)) + 400000;
                var msg = `🇰🇭 Bạn vừa làm phò ở Campuchia và được ${a} VND`;
            } else if (randomAmount < 0.9) {
                a = Math.floor(Math.random() * (800000 - 600000 + 1)) + 600000;
                var msg = `🇰🇭 Bạn vừa làm gái bán hoa ở Campuchia và được ${a} VND`;
            } else {
                a = Math.floor(Math.random() * (1000000 - 800000 + 1)) + 800000;
                var msg = `🇰🇭 Bạn vừa làm gái đứng đường ở Campuchia và được ${a} VND`;
            }
            break;
        default:
            return api.sendMessage("Reply từ 1 -> 6 để chọn Quốc Gia", e.threadID, e.messageID);
    }
    await Currencies.increaseMoney(e.senderID, parseInt(a));

    api.unsendMessage(handleReply.messageID);
    return api.sendMessage(`${msg}`, threadID, async () => {
        data.work2Time = Date.now();
        await Currencies.setData(senderID, { data });
    });
};
module.exports.run = async ({ event: e, api, handleReply, Currencies }) => {
    const { threadID, messageID, senderID } = e;
    let data = (await Currencies.getData(senderID)).data || {};

    if (typeof data !== "undefined" && cooldownTime - ((Date.now() - data.work2Time) / 1000) > 0) {
        var time = cooldownTime - ((Date.now() - data.work2Time) / 1000),
            seconds = Math.floor((time % 60)),
            minutes = Math.floor((time / 60) % 60),
            hours = Math.floor((time / (60 * 60)) % 24);
        return api.sendMessage(`💫 Lồn thì thâm như cái dái chó rồi còn địt nhiều vậy, chờ ${hours} giờ ${minutes} phút ${seconds} giây nữa để làm tiếp nhé. Còn không muốn chờ thì liên hệ Admin để làm trực tiếp nhé :)) FB: https://www.facebook.com/SpeedTunnel/`, e.threadID, e.messageID);
    } else {
        var msg = {
            body: "====== CAVE ======" + `\n` +
                "\n1. Việt Nam 🇻🇳" +
                "\n2. Trung Quốc 🇨🇳" +
                "\n3. Nhật Bản 🇯🇵" +
                "\n4. Thái Lan 🇹🇭" +
                "\n5. Mỹ 🇺🇸" +
                "\n6. Campuchia 🇰🇭" +
                `\n\n💬 Rep tin nhắn này để chọn địa điểm làm cave`
        };
        return api.sendMessage(msg, e.threadID, (error, info) => {
            data.work2Time = Date.now();
            global.client.handleReply.push({
                type: "choosee",
                name: this.config.name,
                author: e.senderID,
                messageID: info.messageID
            });
        });
    }
};
