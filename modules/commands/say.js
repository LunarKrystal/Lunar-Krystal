module.exports.config = {
  name: "say",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Mirai Team - Mod by ChatGPT",
  description: "Chuyển văn bản thành giọng nói (banmai - FPT.AI)",
  commandCategory: "Tiện ích",
  usages: "[văn bản]",
  cooldowns: 5,
  dependencies: {
    "axios": "",
    "fs-extra": "",
    "path": ""
  }
};

module.exports.run = async function ({ api, event, args }) {
  const fs = require("fs-extra");
  const axios = require("axios");
  const path = require("path");

  const API_KEY = "jhXzT4c0NSm4VrD3wYLL7FbcXqGpJcb1";
  const voice = "banmai"; // Giọng mặc định

  const text = args.join(" ");
  if (!text) return api.sendMessage("Bạn chưa nhập nội dung để nói.", event.threadID, event.messageID);

  const fileName = `${event.threadID}_${event.senderID}.mp3`;
  const filePath = path.resolve(__dirname, "cache", fileName);

  try {
    const response = await axios({
      method: "post",
      url: "https://api.fpt.ai/hmi/tts/v5",
      headers: {
        "api-key": API_KEY,
        "voice": voice
      },
      data: text,
      responseType: "stream"
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    writer.on("finish", () => {
      api.sendMessage({ attachment: fs.createReadStream(filePath) }, event.threadID, () => fs.unlinkSync(filePath));
    });

    writer.on("error", err => {
      console.error("Lỗi khi ghi file:", err);
      api.sendMessage("Không thể tạo file âm thanh.", event.threadID);
    });

  } catch (error) {
    console.error("Lỗi API:", error);
    api.sendMessage("Không thể kết nối tới FPT.AI. Vui lòng kiểm tra lại key hoặc thử sau.", event.threadID);
  }
};
