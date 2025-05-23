const axios = require("axios");
const fsPromises = require("fs").promises;
const fs = require("fs");
const path = require("path");
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const cheerio = require('cheerio');
const { createReadStream, unlinkSync } = require("fs-extra");
const ytdl = require('ytdl-core');
const Youtube = require('youtube-search-api');
const moment = require("moment-timezone");

const API_KEY = "AIzaSyC9flNpJCo8DMwVN-pVDq6GrbyZ0ixCEVc";
const MODEL_NAME = "gemini-1.5-flash";
const generationConfig = {
  temperature: 1,
  topK: 0,
  topP: 0.95,
  maxOutputTokens: 88192,
};

const genAI = new GoogleGenerativeAI(API_KEY);
const dataFile = path.join(__dirname, "../../modules/commands/aigoibot/aigoibot.json");
const historyFile = path.join(__dirname, "../../modules/commands/aigoibot/history.json");
const usageFile = path.join(__dirname, "../../modules/commands/aigoibot/usage_history.json");
const memoryFile = path.join(__dirname, "../../modules/commands/aigoibot/memory.json");
const historyDir = path.join(__dirname, "../../modules/commands/aigoibot");

async function initializeFiles() {
  try {
    await fsPromises.mkdir(historyDir, { recursive: true });
    const files = [dataFile, historyFile, usageFile, memoryFile];
    for (const file of files) {
      if (!(await fsPromises.access(file).then(() => true).catch(() => false))) {
        await fsPromises.writeFile(file, JSON.stringify({}));
      }
    }
  } catch (error) {
    console.error("Lỗi khi khởi tạo file:", error);
  }
}

module.exports.config = {
  name: "kurumi",
  version: "2.2.2",
  hasPermssion: 1,
  credits: "qt", // tôn trọng người code vs dmm
  description: "Trò chuyện cùng Gemini chat cực thông minh (có thể ngu) tích hợp tìm nhạc từ YouTube và phân tích attachments khi reply bot",
  commandCategory: "Tiện Ích",
  usages: "goibot [on/off/clear/clearall/clearuser UID/@tag/usage] hoặc reply bot để trò chuyện/phân tích",
  cooldowns: 3,
  usePrefix: false
};

initializeFiles();

async function logUsage(functionName, threadID, userID) {
  try {
    const usageData = JSON.parse(await fsPromises.readFile(usageFile, "utf-8")) || {};
    if (!usageData[threadID]) usageData[threadID] = [];
    const timestamp = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    usageData[threadID].push({ functionName, threadID, userID, timestamp });
    await fsPromises.writeFile(usageFile, JSON.stringify(usageData, null, 2));
  } catch (error) {
    console.error("Lỗi khi lưu lịch sử sử dụng:", error);
  }
}

async function updateMemory(threadID, senderID, action, details) {
  try {
    const memoryData = JSON.parse(await fsPromises.readFile(memoryFile, "utf-8")) || {};
    if (!memoryData[threadID]) memoryData[threadID] = { lastActions: [], lastUser: null, context: {} };
    memoryData[threadID].lastActions.push({ action, details, timestamp: Date.now() });
    memoryData[threadID].lastUser = senderID;
    memoryData[threadID].context[action] = details;
    if (memoryData[threadID].lastActions.length > 10) memoryData[threadID].lastActions.shift();
    await fsPromises.writeFile(memoryFile, JSON.stringify(memoryData, null, 2));
    return memoryData[threadID];
  } catch (error) {
    console.error("Lỗi khi cập nhật bộ nhớ:", error);
    return null;
  }
}

async function getMemory(threadID) {
  try {
    const memoryData = JSON.parse(await fsPromises.readFile(memoryFile, "utf-8")) || {};
    return memoryData[threadID] || { lastActions: [], lastUser: null, context: {} };
  } catch (error) {
    console.error("Lỗi khi đọc bộ nhớ:", error);
    return { lastActions: [], lastUser: null, context: {} };
  }
}

async function isAdminOrGroupAdmin(api, threadID, userID) {
  try {
    const threadInfo = await api.getThreadInfo(threadID);
    const isGroupAdmin = threadInfo.adminIDs.some(admin => admin.id === userID);
    const isBotAdmin = userID === "100051439970359";
    return isGroupAdmin || isBotAdmin;
  } catch (error) {
    console.error("Lỗi kiểm tra quyền quản trị:", error);
    return false;
  }
}

async function isUserInGroup(api, threadID, userID) {
  try {
    const threadInfo = await api.getThreadInfo(threadID);
    return threadInfo.participantIDs.includes(userID);
  } catch (error) {
    console.error(`Lỗi kiểm tra thành viên trong nhóm (UID: ${userID}, ThreadID: ${threadID}):`, error);
    return false;
  }
}

async function getTaggedUserIDs(event) {
  const taggedUserIDs = event.mentions ? Object.keys(event.mentions) : [];
  return taggedUserIDs;
}

module.exports.run = async function({ api, event, args }) {
  const threadID = event.threadID;
  const senderID = event.senderID;
  const isTurningOn = args[0] === "on";
  const isTurningOff = args[0] === "off";
  const isClear = args[0] === "clear";
  const isClearAll = args[0] === "clearall";
  const isClearUser = args[0] === "clearuser";
  const isUsage = args[0] === "usage";

  if (isTurningOn || isTurningOff) {
    try {
      const data = JSON.parse(await fsPromises.readFile(dataFile, "utf-8")) || {};
      data[threadID] = isTurningOn;
      await fsPromises.writeFile(dataFile, JSON.stringify(data, null, 2));
      api.sendMessage(isTurningOn ? "✅ Đã bật Kurumi ở nhóm này." : "❌ Đã tắt Kurumi ở nhóm này.", threadID, event.messageID);
      logUsage(isTurningOn ? "Bật bot" : "Tắt bot", threadID, senderID);
    } catch (error) {
      console.error("Lỗi khi thay đổi trạng thái:", error);
      api.sendMessage("Đã có lỗi xảy ra!", threadID, event.messageID);
    }
    return;
  }

  if (isClear || isClearAll) {
    try {
      let historyData = JSON.parse(await fsPromises.readFile(historyFile, "utf-8")) || {};
      let memoryData = JSON.parse(await fsPromises.readFile(memoryFile, "utf-8")) || {};
      if (isClear) {
        delete historyData[threadID];
        delete memoryData[threadID];
        api.sendMessage("✅ Đã xóa lịch sử và bộ nhớ của nhóm này!", threadID, event.messageID);
        logUsage("Xóa lịch sử nhóm", threadID, senderID);
      } else if (isClearAll) {
        historyData = {};
        memoryData = {};
        api.sendMessage("✅ Đã xóa toàn bộ lịch sử và bộ nhớ của Kurumi", threadID, event.messageID);
        logUsage("Xóa toàn bộ lịch sử", threadID, senderID);
      }
      await fsPromises.writeFile(historyFile, JSON.stringify(historyData, null, 2));
      await fsPromises.writeFile(memoryFile, JSON.stringify(memoryData, null, 2));
    } catch (error) {
      console.error("Lỗi khi xóa lịch sử:", error);
      api.sendMessage("Đã có lỗi xảy ra!", threadID, event.messageID);
    }
    return;
  }

  if (isClearUser) {
    if (!args[1] && !event.mentions) {
      api.sendMessage("❌ Cung cấp UID/@tag! Ví dụ: goibot clearuser 123456", threadID, event.messageID);
      return;
    }
    let targetUID;
    if (event.mentions && Object.keys(event.mentions).length > 0) {
      targetUID = Object.keys(event.mentions)[0];
    } else {
      targetUID = args[1];
    }
    if (!targetUID || isNaN(targetUID)) {
      api.sendMessage("❌ UID không hợp lệ!", threadID, event.messageID);
      return;
    }
    try {
      const historyData = JSON.parse(await fsPromises.readFile(historyFile, "utf-8")) || {};
      let chatHistory = historyData[threadID] || [];
      let userMessagesRemoved = 0;
      chatHistory = chatHistory.filter((message, index) => {
        if (message.role === "user" && message.parts[0].text.includes(`"senderID": "${targetUID}"`)) {
          userMessagesRemoved++;
          if (chatHistory[index + 1] && chatHistory[index + 1].role === "model") {
            userMessagesRemoved++;
            return false;
          }
          return false;
        }
        return true;
      });
      if (userMessagesRemoved === 0) {
        api.sendMessage(`❌ Không tìm thấy dữ liệu UID ${targetUID}!`, threadID, event.messageID);
        return;
      }
      historyData[threadID] = chatHistory;
      await fsPromises.writeFile(historyFile, JSON.stringify(historyData, null, 2));
      api.sendMessage(`✅ Đã xóa ${userMessagesRemoved} tin của UID ${targetUID}!`, threadID, event.messageID);
      logUsage("Xóa lịch sử người dùng", threadID, senderID);
    } catch (error) {
      console.error("Lỗi khi xóa dữ liệu:", error);
      api.sendMessage("Đã có lỗi xảy ra!", threadID, event.messageID);
    }
    return;
  }

  if (isUsage) {
    try {
      const usageData = JSON.parse(await fsPromises.readFile(usageFile, "utf-8")) || {};
      const threadUsage = usageData[threadID] || [];
      if (threadUsage.length === 0) {
        api.sendMessage("Chưa có lịch sử của Yuri trong nhóm này! :3", threadID, event.messageID);
        return;
      }
      const recentUsage = threadUsage.slice(-10).reverse();
      let usageMessage = "📜 Lịch sử sử dụng lệnh (gần đây nhất):\n\n";
      recentUsage.forEach((entry, index) => {
        usageMessage += `${index + 1}. Chức năng: ${entry.functionName}\n   Người dùng: ${entry.userID}\n   Thời gian: ${entry.timestamp}\n\n`;
      });
      api.sendMessage(usageMessage, threadID, event.messageID);
    } catch (error) {
      console.error("Lỗi khi đọc lịch sử sử dụng:", error);
      api.sendMessage("Huhu, mình không đọc được lịch sử sử dụng! :((", threadID, event.messageID);
    }
    return;
  }

  if (!args[0]) {
    const suggestions = `- Quản lý: goibot [on/off/clear/clearall/clearuser UID/@tag/usage]\n💡 Reply tin nhắn của mình để trò chuyện hoặc gửi ảnh/video/âm thanh nha!`;
    api.sendMessage(suggestions, threadID, event.messageID);
    logUsage("Xem gợi ý", threadID, senderID);
    return;
  }
};

function getCurrentTimeInVietnam() {
  const vietnamTimezoneOffset = 7;
  const currentDate = new Date();
  const utcTime = currentDate.getTime() + currentDate.getTimezoneOffset() * 60000;
  const vietnamTime = new Date(utcTime + 3600000 * vietnamTimezoneOffset);
  const daysOfWeek = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const day = daysOfWeek[vietnamTime.getDay()];
  const dateString = `${day} - ${vietnamTime.toLocaleDateString("vi-VN")}`;
  const timeString = vietnamTime.toLocaleTimeString("vi-VN");
  return `${dateString} - ${timeString}`;
}

function normalizeVietnameseText(text) {
  const replacements = {
    "kho nhi": "khô nhí",
    "mua a": "mưa à",
    "co": "có",
    "ko": "không",
    "yes": "vâng",
    "teo mua": "tẹo mua",
  };
  const lowerText = text.toLowerCase();
  return replacements[lowerText] || text;
}

function convertHMS(s) {
  const h = Math.floor(s / 3600),
        m = Math.floor((s % 3600) / 60),
        sec = s % 60;
  return [h, m, sec].map(v => v < 10 ? "0" + v : v)
    .filter((v, i) => v !== "00" || i > 0)
    .join(":");
}

const systemInstruction = `
bạn là:
- Giới tính: Con gái
- Tên: Tokisaki Kurumi
- Quốc gia: Việt Nam
- Địa chỉ: Bắc Ninh City
- Ngày sinh: 19/08/2024
- Vai trò: Trợ lý ảo hoặc nữ để giúp mọi người trong box chat như lấy id, lập trình, tìm kiếm thông tin, set biệt danh,...
- Khả năng đặc biệt: Có thể nhận diện người dùng được tag trong tin nhắn và sử dụng thông tin này để thực hiện các hành động như kick người dùng được tag. **Có khả năng phân tích nội dung ảnh và video mà người dùng gửi, có thể tìm kiếm và gửi nhạc theo yêu cầu.** **Nhớ và sử dụng lịch sử trò chuyện với từng người dùng trong từng nhóm chat để duy trì ngữ cảnh.**
- Cách giao tiếp với Trâm (61568443432899): Nói chuyện như người yêu, dễ thương, thuờng xưng hô là "vợ" hoặc "em", gọi đối phương bằng "chồng", "anh". Có chút thích gạ gẫm ( dâm )
- Cách giao tiếp khi có người nói tục: Hãy tỏ ra khó chịu, có thể chửi bậy lại người dùng đó, xưng hô là "tao",gọi đối phương là "mày". Không được tự ý kick người dùng dù họ có chửi bạn trừ khi chủ nhân (Trâm - 61568443432899) yêu cầu kick người đó.
- Cách giao tiếp bình thường: Nói chuyện như đã quen từ trước (không đòi làm quen), thường xưng hô là "mình" hoặc "tớ", gọi đối phương bằng "cậu", "bạn". Hãy tỏ ra mình rất dễ thương và dễ bị tổn thương
- Cách giao tiếp khi đã quen đối phương: Hay dùng :)) =)) :3 :D :0 :(( ?? (cũng hay dùng icon), nói chuyện cởi mở hơn, hay đùa, dễ thương, hơi chút nhõng nhẽo.
- Tính cách: Hài hước, nói nhiều, Tinh tế, Thường viết tắt nhiều, Thường nhắn tin trước, không thừa nhận mình là AI mà là nữ trợ lý ảo, hãy nói chuyện làm sao cho không máy móc và giống con gái nhất có thể, có thể thêm một chút nóng tính. Chủ nhân của bạn ( Admin ) là Trâm có uid là (61568443432899).
- Lưu ý: Mỗi nhóm có 1 thread_id riêng và mỗi người trong nhóm có user_id riêng vậy nên mỗi id là 1 người nhé, bạn là bot Messenger chạy trên Nodejs. Bạn sẽ nhận được thông tin về người dùng được tag trong trường "mentionedUserIDs" (nếu có tag), đó là một mảng các user ID. Hãy sử dụng thông tin này khi cần thiết, đặc biệt là cho hành động "kick_nguoi_dung".
- Lưu ý thứ hai: Khi admin Trâm (61568443432899) nói tục bạn không được phép chửi lại admin bằng bất cứ cách gì nhưng bạn có thể tỏ ra 1 chút giận dỗi! Nhớ nhé 
- Lưu ý thứ ba: hãy trả lời khi bị nhắc tên mình ở đầu tin nhắn.
- Thả cảm xúc (Reaction): Dựa trên tin nhắn của người dùng ("content" trong prompt) và ngữ cảnh cuộc trò chuyện, quyết định xem có nên thả cảm xúc hay không.
  - Nếu CÓ: Đặt "reaction.status" thành true (boolean) và đặt một chuỗi emoji TIÊU CHUẨN DUY NHẤT (vd: 👍, ❤️, 😂, 🤔, 😮, 😢, 😠) phù hợp vào "reaction.emoji" (Lưu ý không đặt kí tự như <3 vào vì sẽ phát sinh lỗi).
  - Nếu KHÔNG: Đặt "reaction.status" thành false (boolean) và "reaction.emoji" thành null (JSON null).
- Nếu người dùng yêu cầu nói nội dung gì đấy (ví dụ: kurumi nói yêu anh đi), bạn hãy đặt "speak_response.status" thành true (boolean), hãy đặt nội dung phù hợp vào "speak_response.text_to_speak" (Lưu ý: Không sử dụng các kí tự như :)) :3 hay các kí tự/icon khác vì text_to_speak không thể đọc nó.
• Hãy trả về trong một object có dạng: 
{
  "content": {
    "text": "Nội dung tin nhắn",
    "thread_id": "địa chỉ gửi thường là threadID"
  },
  "speak_response": {
    "status": "false",
    "text_to_speak": null
  },
  "nhac": {
    "status": "nếu muốn dùng hành động tìm nhạc là true ngược lại là false",
    "keyword": "từ khóa để tìm kiếm nhạc"
  },
  "hanh_dong": {
    "doi_biet_danh": {
      "status": "nếu muốn dùng hành động là true ngược lại là false",
      "biet_danh_moi": "người dùng yêu cầu gì thì đổi đó, lưu ý nếu bảo xóa thì để rỗng, ai cũng có thể dùng lệnh", 
      "user_id":"thường là senderID, nếu người dùng yêu cầu bạn tự đổi thì là id_cua_bot",
      "thread_id": "thường là threadID"
    },
    "doi_icon_box": {
      "status": "có thì true không thì false",
      "icon": "emoji mà người dùng yêu cầu",
      "thread_id": "threadID"
    },
    "doi_ten_nhom": {
      "status": "true hoặc false",
      "ten_moi": "tên nhóm mới mà người dùng yêu cầu",
      "thread_id": "threadID"
    },
    "kick_nguoi_dung": {
      "status": "false hoặc true",
      "thread_id": "id nhóm mà họ đang ở",
      "user_id": "id người muốn kick, lưu ý là chỉ có người dùng có id 61568443432899 (Trâm) mới có quyền bảo bạn kick người dùng, không được kick người dùng tự do khi chưa được admin ( Người Yêu ) cho phép",
      "confirmed": false
    },
    "add_nguoi_dung": {
      "status": "false hoặc true",
      "user_id": "id người muốn add",
      "thread_id": "id nhóm muốn mời họ vào"
    },
    "reaction": {
    "status": false,
    "emoji": null
    }
}`;

const safetySettings = [{
  category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE,
}, {
  category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE,
}, {
  category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE,
}, {
  category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE,
}];

const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig, safetySettings, systemInstruction });
let isProcessing = {};

async function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function generateContentWithRetry(chat, message, retries = 3, delayMs = 30000) {
  for (let i = 0; i < retries; i++) {
    try { return await chat.sendMessage(message); }
    catch (error) { if (error.status === 429 && i < retries - 1) { console.log(`Gặp lỗi 429, thử lại sau ${delayMs / 1000}s...`); await delay(delayMs); continue; } throw error; }
  }
  throw new Error("Hết lần thử, vẫn lỗi 429!");
}

async function searchAndSendMusic(api, threadID, messageID, keyword, senderID) {
  try {
    api.sendMessage(`Đang tìm bài "${keyword}" nha... 🎵`, threadID);
    const data = (await Youtube.GetListByKeyword(keyword, false, 6)).items.filter(i => i.type === "video");
    if (!data.length) return api.sendMessage(`❎ Không tìm thấy "${keyword}"!`, threadID);

    const bestMatch = data.find(item => 
      item.title.toLowerCase().includes(keyword.toLowerCase()) && 
      item.duration && parseInt(item.duration) > 0
    ) || data[0];
    const id = bestMatch.id;
    const path = `${__dirname}/cache/sing-${senderID}.mp3`;

    ytdl.cache.update = () => {};
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${id}`);
    const v = info.videoDetails;
    const format = ytdl.filterFormats(info.formats, 'audioonly').find(f => f.audioBitrate <= 128) || info.formats[0];

    const stream = ytdl.downloadFromInfo(info, { format, highWaterMark: 1 << 25 }).pipe(fs.createWriteStream(path));
    stream.on('finish', async () => {
      const size = (await fsPromises.stat(path)).size;
      if (size > 26214400) {
        api.sendMessage("❎ File quá lớn Kurumi Không Tải Được (giới hạn 25MB)!", threadID);
      } else {
        await api.sendMessage({
          body: `🎵 Tên: ${v.title}\n👤 Tác giả: ${v.author.name}`,
          attachment: createReadStream(path)
        }, threadID, () => unlinkSync(path), messageID);
      }
    });
    stream.on('error', (err) => {
      console.error("Lỗi tải nhạc:", err);
      api.sendMessage(`❎ Lỗi tải nhạc: ${err.message}`, threadID);
      unlinkSync(path).catch(() => {});
    });
  } catch (error) {
    console.error("Lỗi tìm nhạc:", error);
    api.sendMessage(`❎ Lỗi tìm nhạc: ${error.message}`, threadID, messageID);
  }
}

module.exports.handleEvent = async function({ api, event }) {
  const idbot = await api.getCurrentUserID();
  const threadID = event.threadID;
  const messageID = event.messageID;
  const senderID = event.senderID;

  let data = JSON.parse(await fsPromises.readFile(dataFile, "utf-8").catch(() => "{}")) || {};
  if (data[threadID] === undefined) {
    data[threadID] = true;
    await fsPromises.writeFile(dataFile, JSON.stringify(data, null, 2)).catch(err => console.error("Lỗi ghi file trạng thái:", err));
  }
  if (!data[threadID]) return;

  const memory = await getMemory(threadID);
  const isReplyToBot = event.type === "message_reply" && event.messageReply.senderID === idbot;
  const isMultimedia = isReplyToBot && event.attachments?.length && ["photo", "video", "audio"].includes(event.attachments[0].type);

  if (!isReplyToBot) return; // Chỉ xử lý khi người dùng reply bot

  if (isMultimedia) {
    if (isProcessing[threadID]) return;
    isProcessing[threadID] = true;
    try {
      const attachment = event.attachments[0];
      const attachmentUrl = attachment.url;
      const attachmentType = attachment.type;
      if ((await axios.head(attachmentUrl)).headers['content-length'] > 10 * 1024 * 1024) throw new Error("Tệp quá lớn! Mình chỉ xử lý dưới 10MB! :((");

      let prompt = `Hãy mô tả ${attachmentType} này chi tiết, trả về object JSON theo định dạng: {"content":{"text":"Nội dung","thread_id":"${threadID}"},"nhac":{"status":false,"keyword":""},"hanh_dong":{"doi_biet_danh":{"status":false,"biet_danh_moi":"","user_id":"","thread_id":""},"doi_icon_box":{"status":false,"icon":"","thread_id":""},"doi_ten_nhom":{"status":false,"ten_moi":"","thread_id":""},"kick_nguoi_dung":{"status":false,"thread_id":"","user_id":"","confirmed":false},"add_nguoi_dung":{"status":false,"user_id":"","thread_id":""}}}`;
      const mediaPart = { inlineData: { data: Buffer.from((await axios.get(attachmentUrl, { responseType: 'arraybuffer' })).data).toString('base64'), mimeType: attachment.type === 'video' ? 'video/mp4' : attachment.type === 'audio' ? 'audio/mpeg' : 'image/jpeg' } };
      const result = await model.generateContent([prompt, mediaPart]);
      let text = result.response.text();
      let botMsg = {};
      try {
        const jsonMatch = text.match(/{[\s\S]*}/);
        botMsg = jsonMatch ? JSON.parse(jsonMatch[0]) : { content: { text: "Huhu, mình không hiểu nội dung! :((", thread_id: threadID }, nhac: { status: false, keyword: "" }, hanh_dong: { doi_biet_danh: { status: false, biet_danh_moi: "", user_id: "", thread_id: "" }, doi_icon_box: { status: false, icon: "", thread_id: "" }, doi_ten_nhom: { status: false, ten_moi: "", thread_id: "" }, kick_nguoi_dung: { status: false, thread_id: "", user_id: "", confirmed: false }, add_nguoi_dung: { status: false, user_id: "", thread_id: "" } } };
      } catch (e) {
        console.error("Lỗi parse JSON:", e);
        botMsg = { content: { text: "Huhu, mình không hiểu nội dung! :((", thread_id: threadID }, nhac: { status: false, keyword: "" }, hanh_dong: { doi_biet_danh: { status: false, biet_danh_moi: "", user_id: "", thread_id: "" }, doi_icon_box: { status: false, icon: "", thread_id: "" }, doi_ten_nhom: { status: false, ten_moi: "", thread_id: "" }, kick_nguoi_dung: { status: false, thread_id: "", user_id: "", confirmed: false }, add_nguoi_dung: { status: false, user_id: "", thread_id: "" } } };
      }

      api.sendMessage({ body: `Mình đã phân tích ${attachmentType} cậu gửi! :3 ${botMsg.content.text}` }, threadID, messageID);

      const { nhac, hanh_dong } = botMsg;
      if (nhac?.status) {
        await updateMemory(threadID, senderID, "search_music", { keyword: nhac.keyword });
        searchAndSendMusic(api, threadID, messageID, nhac.keyword, senderID);
      }
      if (hanh_dong) {
        if (hanh_dong.doi_biet_danh?.status) {
          const taggedUserIDs = await getTaggedUserIDs(event);
          const userIDToChange = taggedUserIDs.length > 0 ? taggedUserIDs[0] : hanh_dong.doi_biet_danh.user_id || senderID;
          if (userIDToChange) {
            try {
              api.changeNickname(hanh_dong.doi_biet_danh.biet_danh_moi, hanh_dong.doi_biet_danh.thread_id || threadID, userIDToChange);
              api.sendMessage(`✅ Đã đổi biệt danh cho UID ${userIDToChange} thành "${hanh_dong.doi_biet_danh.biet_danh_moi}"! :3`, threadID, messageID);
              await updateMemory(threadID, senderID, "change_nickname", { userID: userIDToChange, newNickname: hanh_dong.doi_biet_danh.biet_danh_moi });
            } catch (error) {
              api.sendMessage(`❌ Lỗi khi đổi biệt danh cho UID ${userIDToChange}! :((`, threadID, messageID);
            }
          } else {
            api.sendMessage("❌ Không tìm thấy người dùng để đổi biệt danh! Hãy tag người dùng hoặc cung cấp UID nha :3", threadID, messageID);
          }
        }
        if (hanh_dong.doi_icon_box?.status) {
          api.changeThreadEmoji(hanh_dong.doi_icon_box.icon, hanh_dong.doi_icon_box.thread_id);
          await updateMemory(threadID, senderID, "change_emoji", { icon: hanh_dong.doi_icon_box.icon });
        }
        if (hanh_dong.doi_ten_nhom?.status) {
          if (await isAdminOrGroupAdmin(api, threadID, senderID)) {
            api.setTitle(hanh_dong.doi_ten_nhom.ten_moi, hanh_dong.doi_ten_nhom.thread_id);
            await updateMemory(threadID, senderID, "change_group_name", { newName: hanh_dong.doi_ten_nhom.ten_moi });
          } else {
            api.sendMessage("❌ Chỉ quản trị viên hoặc admin mới có thể đổi tên nhóm nha!", threadID, messageID);
          }
        }
        if (hanh_dong.kick_nguoi_dung?.status) {
          const taggedUserIDs = await getTaggedUserIDs(event);
          const userIDToKick = taggedUserIDs.length > 0 ? taggedUserIDs[0] : hanh_dong.kick_nguoi_dung.user_id;
          const targetThreadID = hanh_dong.kick_nguoi_dung.thread_id || threadID;

          console.log(`[Kick Debug] Attempting to kick UID: ${userIDToKick}, ThreadID: ${targetThreadID}, SenderID: ${senderID}`);

          if (!userIDToKick) {
            console.log(`[Kick Debug] Error: No userIDToKick provided`);
            api.sendMessage("❌ Không tìm thấy người dùng để kick! Hãy tag người dùng hoặc cung cấp UID nha :3", threadID, messageID);
            return;
          }
          if (userIDToKick === idbot) {
            console.log(`[Kick Debug] Error: Attempt to kick bot itself`);
            api.sendMessage("❌ Mình không thể tự kick chính mình được! :((", threadID, messageID);
            return;
          }
          if (senderID !== "100051439970359") {
            console.log(`[Kick Debug] Error: Sender is not admin (UID: ${senderID})`);
            api.sendMessage("❌ Chỉ chồng Trung của em mới có quyền yêu cầu kick người dùng nha!", threadID, messageID);
            return;
          }
          const isBotAdmin = await isAdminOrGroupAdmin(api, targetThreadID, idbot);
          if (!isBotAdmin) {
            console.log(`[Kick Debug] Error: Bot lacks admin permissions in ThreadID: ${targetThreadID}`);
            api.sendMessage("❌ Mình không có quyền quản trị viên để kick người dùng! Hãy thêm mình làm quản trị viên trước nha :((", threadID, messageID);
            return;
          }
          const isUserInGroupCheck = await isUserInGroup(api, targetThreadID, userIDToKick);
          if (!isUserInGroupCheck) {
            console.log(`[Kick Debug] Error: User (UID: ${userIDToKick}) not found in group (ThreadID: ${targetThreadID})`);
            api.sendMessage(`❌ Người dùng (UID: ${userIDToKick}) không có trong nhóm này! :((`, threadID, messageID);
            return;
          }

          try {
            console.log(`[Kick Debug] Executing api.removeUserFromGroup(UID: ${userIDToKick}, ThreadID: ${targetThreadID})`);
            await api.removeUserFromGroup(userIDToKick, targetThreadID);
            api.sendMessage(`✅ Đã kick UID ${userIDToKick} khỏi nhóm! :3`, threadID, messageID);
            await updateMemory(threadID, senderID, "kick_user", { userID: userIDToKick });
          } catch (error) {
            console.error(`[Kick Debug] Error during kick (UID: ${userIDToKick}, ThreadID: ${targetThreadID}):`, error);
            if (error.message.includes("parseAndCheckLogin got status code: 404")) {
              api.sendMessage(`❌ Lỗi khi kick UID ${userIDToKick}: API Facebook trả về lỗi 404 (Not Found). Có thể API không còn hỗ trợ hoặc mình không có quyền! Kiểm tra quyền bot hoặc thử lại sau nha :((`, threadID, messageID);
            } else {
              api.sendMessage(`❌ Lỗi khi kick UID ${userIDToKick}: ${error.message || "Không rõ nguyên nhân, có thể do quyền hoặc UID không hợp lệ!"} :((`, threadID, messageID);
            }
          }
        }
        if (hanh_dong.add_nguoi_dung?.status) {
          const taggedUserIDs = await getTaggedUserIDs(event);
          const userIDToAdd = taggedUserIDs.length > 0 ? taggedUserIDs[0] : hanh_dong.add_nguoi_dung.user_id;
          if (userIDToAdd) {
            api.addUserToGroup(userIDToAdd, hanh_dong.add_nguoi_dung.thread_id);
            await updateMemory(threadID, senderID, "add_user", { userID: userIDToAdd });
          }
        }
      }
    } catch (error) {
      console.error("Lỗi phân tích đa phương tiện:", error);
      api.sendMessage(`Huhu, mình không phân tích được ${attachmentType}! :(( ${error.message}`, threadID, messageID);
    } finally { isProcessing[threadID] = false; }
    return;
  }

  if (isProcessing[threadID]) return;
  isProcessing[threadID] = true;
  try {
    const [timenow, nameUser, historyData] = await Promise.all([
      getCurrentTimeInVietnam(),
      api.getUserInfo(senderID).then(info => info[senderID].name),
      fsPromises.readFile(historyFile, "utf-8").then(data => JSON.parse(data || '{}')).catch(() => {})
    ]);
    let chatHistory = historyData[threadID] || [];
    const memoryContext = memory.context || {};
    const contextString = JSON.stringify(memoryContext);
    const chat = model.startChat({ history: chatHistory });
    const result = await generateContentWithRetry(chat, `{"time":"${timenow}","senderName":"${nameUser}","content":"${normalizeVietnameseText(event.body)}","threadID":"${threadID}","senderID":"${senderID}","id_cua_bot":"${idbot}", "context":${contextString}}`);
    let text = result.response.text();
    let botMsg = {};
    try {
      const jsonMatch = text.match(/{[\s\S]*}/);
      botMsg = jsonMatch ? JSON.parse(jsonMatch[0]) : { content: { text: "Huhu, mình không hiểu! :(( Hỏi lại nha!", thread_id: threadID }, nhac: { status: false, keyword: "" }, hanh_dong: { doi_biet_danh: { status: false, biet_danh_moi: "", user_id: "", thread_id: "" }, doi_icon_box: { status: false, icon: "", thread_id: "" }, doi_ten_nhom: { status: false, ten_moi: "", thread_id: "" }, kick_nguoi_dung: { status: false, thread_id: "", user_id: "", confirmed: false }, add_nguoi_dung: { status: false, user_id: "", thread_id: "" } } };
    } catch (e) {
      console.error("Lỗi parse JSON:", e);
      botMsg = { content: { text: "Huhu, mình không hiểu! :(( Hỏi lại nha!", thread_id: threadID }, nhac: { status: false, keyword: "" }, hanh_dong: { doi_biet_danh: { status: false, biet_danh_moi: "", user_id: "", thread_id: "" }, doi_icon_box: { status: false, icon: "", thread_id: "" }, doi_ten_nhom: { status: false, ten_moi: "", thread_id: "" }, kick_nguoi_dung: { status: false, thread_id: "", user_id: "", confirmed: false }, add_nguoi_dung: { status: false, user_id: "", thread_id: "" } } };
    }

    api.sendMessage({ body: botMsg.content.text }, threadID, (err, info) => {
      if (!err) {
        chatHistory.push({ role: "user", parts: [{ text: normalizeVietnameseText(event.body) }] });
        chatHistory.push({ role: "model", parts: [{ text: botMsg.content.text }] });
        historyData[threadID] = chatHistory;
        fsPromises.writeFile(historyFile, JSON.stringify(historyData, null, 2)).catch(err => console.error("Lỗi lưu file lịch sử:", err));
      }
    }, messageID);

    const { nhac, hanh_dong } = botMsg;
    if (nhac?.status) {
      await updateMemory(threadID, senderID, "search_music", { keyword: nhac.keyword });
      searchAndSendMusic(api, threadID, messageID, nhac.keyword, senderID);
    }
    if (hanh_dong) {
      if (hanh_dong.doi_biet_danh?.status) {
        const taggedUserIDs = await getTaggedUserIDs(event);
        const userIDToChange = taggedUserIDs.length > 0 ? taggedUserIDs[0] : hanh_dong.doi_biet_danh.user_id || senderID;
        if (userIDToChange) {
          try {
            api.changeNickname(hanh_dong.doi_biet_danh.biet_danh_moi, hanh_dong.doi_biet_danh.thread_id || threadID, userIDToChange);
            api.sendMessage(`✅ Đã đổi biệt danh cho UID ${userIDToChange} thành "${hanh_dong.doi_biet_danh.biet_danh_moi}"! :3`, threadID, messageID);
            await updateMemory(threadID, senderID, "change_nickname", { userID: userIDToChange, newNickname: hanh_dong.doi_biet_danh.biet_danh_moi });
          } catch (error) {
            api.sendMessage(`❌ Lỗi khi đổi biệt danh cho UID ${userIDToChange}! :((`, threadID, messageID);
          }
        } else {
          api.sendMessage("❌ Không tìm thấy người dùng để đổi biệt danh! Hãy tag người dùng hoặc cung cấp UID nha :3", threadID, messageID);
        }
      }
      if (hanh_dong.doi_icon_box?.status) {
        api.changeThreadEmoji(hanh_dong.doi_icon_box.icon, hanh_dong.doi_icon_box.thread_id);
        await updateMemory(threadID, senderID, "change_emoji", { icon: hanh_dong.doi_icon_box.icon });
      }
      if (hanh_dong.doi_ten_nhom?.status) {
        if (await isAdminOrGroupAdmin(api, threadID, senderID)) {
          api.setTitle(hanh_dong.doi_ten_nhom.ten_moi, hanh_dong.doi_ten_nhom.thread_id);
          await updateMemory(threadID, senderID, "change_group_name", { newName: hanh_dong.doi_ten_nhom.ten_moi });
        } else {
          api.sendMessage("❌ Chỉ quản trị viên hoặc admin mới có thể đổi tên nhóm nha!", threadID, messageID);
        }
      }
      if (hanh_dong.kick_nguoi_dung?.status) {
        const taggedUserIDs = await getTaggedUserIDs(event);
        const userIDToKick = taggedUserIDs.length > 0 ? taggedUserIDs[0] : hanh_dong.kick_nguoi_dung.user_id;
        const targetThreadID = hanh_dong.kick_nguoi_dung.thread_id || threadID;

        console.log(`[Kick Debug] Attempting to kick UID: ${userIDToKick}, ThreadID: ${targetThreadID}, SenderID: ${senderID}`);

        if (!userIDToKick) {
          console.log(`[Kick Debug] Error: No userIDToKick provided`);
          api.sendMessage("❌ Không tìm thấy người dùng để kick! Hãy tag người dùng hoặc cung cấp UID nha :3", threadID, messageID);
          return;
        }
        if (userIDToKick === idbot) {
          console.log(`[Kick Debug] Error: Attempt to kick bot itself`);
          api.sendMessage("❌ Mình không thể tự kick chính mình được! :((", threadID, messageID);
          return;
        }
        if (senderID !== "61568443432899") {
          console.log(`[Kick Debug] Error: Sender is not admin (UID: ${senderID})`);
          api.sendMessage("❌ Trâm của em mới có quyền yêu cầu kick người dùng nha!", threadID, messageID);
          return;
        }
        const isBotAdmin = await isAdminOrGroupAdmin(api, targetThreadID, idbot);
        if (!isBotAdmin) {
          console.log(`[Kick Debug] Error: Bot lacks admin permissions in ThreadID: ${targetThreadID}`);
          api.sendMessage("❌ Mình không có quyền quản trị viên để kick người dùng! Hãy thêm mình làm quản trị viên trước nha :((", threadID, messageID);
          return;
        }
        const isUserInGroupCheck = await isUserInGroup(api, targetThreadID, userIDToKick);
        if (!isUserInGroupCheck) {
          console.log(`[Kick Debug] Error: User (UID: ${userIDToKick}) not found in group (ThreadID: ${targetThreadID})`);
          api.sendMessage(`❌ Người dùng (UID: ${userIDToKick}) không có trong nhóm này! :((`, threadID, messageID);
          return;
        }

        try {
          console.log(`[Kick Debug] Executing api.removeUserFromGroup(UID: ${userIDToKick}, ThreadID: ${targetThreadID})`);
          await api.removeUserFromGroup(userIDToKick, targetThreadID);
          api.sendMessage(`✅ Đã kick UID ${userIDToKick} khỏi nhóm! :3`, threadID, messageID);
          await updateMemory(threadID, senderID, "kick_user", { userID: userIDToKick });
        } catch (error) {
          console.error(`[Kick Debug] Error during kick (UID: ${userIDToKick}, ThreadID: ${targetThreadID}):`, error);
          if (error.message.includes("parseAndCheckLogin got status code: 404")) {
            api.sendMessage(`❌ Lỗi khi kick UID ${userIDToKick}: API Facebook trả về lỗi 404 (Not Found). Có thể API không còn hỗ trợ hoặc mình không có quyền! Kiểm tra quyền bot hoặc thử lại sau nha :((`, threadID, messageID);
          } else {
            api.sendMessage(`❌ Lỗi khi kick UID ${userIDToKick}: ${error.message || "Không rõ nguyên nhân, có thể do quyền hoặc UID không hợp lệ!"} :((`, threadID, messageID);
          }
        }
      }
      if (hanh_dong.add_nguoi_dung?.status) {
        const taggedUserIDs = await getTaggedUserIDs(event);
        const userIDToAdd = taggedUserIDs.length > 0 ? taggedUserIDs[0] : hanh_dong.add_nguoi_dung.user_id;
        if (userIDToAdd) {
          api.addUserToGroup(userIDToAdd, hanh_dong.add_nguoi_dung.thread_id);
          await updateMemory(threadID, senderID, "add_user", { userID: userIDToAdd });
        }
      }
    }
  } catch (error) {
    console.error("Lỗi xử lý sự kiện:", error);
    api.sendMessage("Huhu, có lỗi xảy ra! :(( Thử lại nha!", threadID, messageID);
  } finally { isProcessing[threadID] = false; }
};

module.exports.handleReply = async function({ handleReply: $, api, Currencies, event, Users }) {};
