const fs = require('fs-extra');

const axios = require('axios');

const moment = require("moment-timezone");

this.config = {

    name: "ytb1",

    aliases: ["music"],

    version: "1.0.0",

    role: 0,

    credits: "Dong Dev, Mhung",

    description: "Phát nhạc thông qua từ khoá tìm kiếm trên YouTube",

    commandCategory: "Tiện ích",

    usages: "sing [từ khoá]",

    cd: 0,

    hasPrefix: true,

    images: [],

};

async function ytdlv2(url, type, quality) {

    const header = {

      "accept": "*/*",

      "accept-encoding": "gzip, deflate, br",

      "accept-language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",

      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",

      "cookie": "PHPSESSID=eoddj1bqqgahnhac79rd8kq8lr",

      "origin": "https://iloveyt.net",

      "referer": "https://iloveyt.net/vi2",

      "sec-ch-ua": "\"Not_A Brand\";v=\"99\", \"Google Chrome\";v=\"109\", \"Chromium\";v=\"109\"",

      "sec-ch-ua-mobile": "?0",

      "sec-ch-ua-platform": "\"Windows\"",

      "sec-fetch-dest": "empty",

      "sec-fetch-mode": "cors",

      "sec-fetch-site": "same-origin",

      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",

      "x-requested-with": "XMLHttpRequest"

    };

    const { data } = await axios.post("https://iloveyt.net/proxy.php", {

      url: url

    }, { headers: header });

    var mediaId = [];

    for (const i of data.api.mediaItems) {

      if (i.type !== type) continue;

      mediaId.push(i.mediaId);

    }

    const randomMediaId = mediaId[Math.floor(Math.random() * mediaId.length)]

    // const abc = await axios.post("https://iloveyt.net/proxy.php", { 

    //   url: `https://s6.ytcontent.net/v3/${type.toLowerCase()}Process/${data.api.id}/${randomMediaId}/128k` 

    // }, { headers: header})

    let s = 1, mediaProccess, i = 0;

    while (i++ < 10) {

      const base_url = "s" + s + ".ytcontent.net";

      mediaProccess = await axios.get(`https://${base_url}/v3/${type.toLowerCase()}Process/${data.api.id}/${randomMediaId}/${quality}`);

      if (!mediaProccess.data.error) break;

      s++;

    }

    return {

      fileUrl: mediaProccess.data.fileUrl,

      title: data.api.title,

      channel: data.api.userInfo,

      videoInfo: data.api.mediaStats

    }

  }

async function getdl(link, path) {

    var timestart = Date.now();

    const data = await ytdlv2(link, 'Audio', "128k");

    //console.log(data);

    if (!data) return null;

    const dllink = data.fileUrl;

    const response = await axios.get(dllink, { responseType: 'arraybuffer' });

    fs.writeFileSync(path, response.data);

    return {

        title: data.title,

        timestart: timestart

    };

}

this.handleReply = async function ({ api, event, handleReply }) {

    const id = handleReply.link[event.body - 1];

   try {

        var path = `${__dirname}/cache/sin-${event.senderID}.mp3`;

        var data = await getdl(`https://www.youtube.com/watch?v=${id}`, path);      

   if (fs.statSync(path).size > 26214400) {

            return api.sendMessage('❎ File quá lớn tao del tải được, vui lòng chọn bài khác!', event.threadID, () => fs.unlinkSync(path), event.messageID);

        }

    api.unsendMessage(handleReply.messageID, event.threadID);

        return api.sendMessage({

            body: `[ Âm Nhạc Từ YouTube ]\n──────────────────\n|› 🎬 Title: ${data.title}\n|› 📥 Link tải: https://www.youtubepp.com/watch?v=${id}\n|› ⏳ Thời gian xử lý: ${Math.floor((Date.now() - data.timestart) / 1000)} giây\n──────────────────\n|› ⏰ Time: ${moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss | DD/MM/YYYY")}`,

            attachment: fs.createReadStream(path)

        }, event.threadID, () => fs.unlinkSync(path), event.messageID);

    } catch (e) {

        console.log(e);

      }

};

this.run = async function ({ api, event, args }) {

    if (args.length == 0 || !args) return api.sendMessage('❎ Phần tìm kiếm không được để trống!', event.threadID, event.messageID);

    const keywordSearch = args.join(" ");

    const path = `${__dirname}/cache/sin-${event.senderID}.mp3`;

    if (fs.existsSync(path)) {

        fs.unlinkSync(path);

    }

    try {

        const link = [];

        const Youtube = require('youtube-search-api');

        const data = (await Youtube.GetListByKeyword(keywordSearch, false, 8)).items;

        const msg = data.map((value, index) => {

    link.push(value.id);

    const length = value.length && value.length.simpleText ? value.length.simpleText : "không có thông tin";

    return `|› ${index + 1}. ${value.title}\n|› 👤 Kênh: ${value.channelTitle || "Không có thông tin"}\n|› ⏱️ Thời lượng: ${length}\n──────────────────`;

}).join('\n');

        return api.sendMessage(`📝 Có ${link.length} kết quả trùng với từ khóa tìm kiếm của bạn:\n──────────────────\n${msg}\n\n📌 Reply (phản hồi) STT để tải nhạc`, event.threadID, (error, info) => global.client.handleReply.push({

            type: 'reply',

            name: this.config.name,

            messageID: info.messageID,

            author: event.senderID,

            link

        }), event.messageID);

    } catch (e) {

        return api.sendMessage('❎ Đã xảy ra lỗi, vui lòng thử lại sau!\n' + e, event.threadID, event.messageID);

    }

};
