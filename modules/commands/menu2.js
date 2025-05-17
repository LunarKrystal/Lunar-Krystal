module.exports.config = {

  name: 'menu',

  version: '2.2.0',

  hasPermssion: 0,

  credits: 'DC-Nam mod by Gojo Satoru',

  description: 'Hiển thị menu lệnh tùy chỉnh theo quyền hạn người dùng',

  commandCategory: 'Tiện ích',

  usages: '[tên lệnh | all]',

  cooldowns: 5,

  envConfig: {

    autoUnsend: {

      status: true,

      timeOut: 90,

      usePrefix: false

    }

  }

};

const { autoUnsend = module.exports.config.envConfig.autoUnsend } = global.config?.menu || {};

const { findBestMatch } = require('string-similarity');

async function getThreadAdminIDs(api, threadID) {

  try {

    const threadInfo = await api.getThreadInfo(threadID);

    return threadInfo.adminIDs.map(admin => admin.id);

  } catch (error) {

    console.error("Lỗi khi lấy danh sách admin:", error);

    return [];

  }

}

function canAccessCommand(cmdPermssion, userPermssion, isGroupAdmin) {

  if (userPermssion === 3) return true; // ADMINBOT có thể truy cập mọi lệnh

  if (userPermssion === 2) return cmdPermssion <= 2; // Người điều hành bot có thể truy cập lệnh có permssion <= 2

  if (isGroupAdmin) return cmdPermssion <= 1; // Admin nhóm có thể truy cập lệnh có permssion <= 1

  return cmdPermssion === 0; // Thành viên thường chỉ có thể truy cập lệnh có permssion = 0

}

function permissionTxt(permission) {

  return permission === 0 ? '👥 Thành Viên' :

         permission === 1 ? '👑 Quản Trị Viên Nhóm' :

         permission === 2 ? '🛠️ Người Điều Hành Bot' : '🌟 ADMINBOT';

}

function infoCmds(config) {

  return `╭━━━『 ℹ️ ${config.name} ℹ️ 』━━━╮\n` +

         `┃ 🔢 Phiên bản: ${config.version}\n` +

         `┃ 🔐 Quyền hạn: ${permissionTxt(config.hasPermssion)}\n` +

         `┃ 👤 Tác giả  : ${config.credits}\n` +

         `┃ 📝 Mô tả    : ${config.description}\n` +

         `┃ 📁 Nhóm lệnh: ${config.commandCategory}\n` +

         `┃ 🔧 Cách dùng: ${config.usages}\n` +

         `┃ ⏱️ Thời gian chờ: ${config.cooldowns} giây\n` +

         `╰━━━━━━━━━━━━━━━━━━━━╯`;

}

function getRandomIcons(count) {

  const allIcons = ['🌟', '🚀', '💡', '🔥', '🎈', '🎉', '🎊', '🏆', '🏅', '🥇', '🥈', '🥉', '🎖️', '🏵️', '🎗️', '🎯', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '🎮', '🕹️', '🎰', '🎳', '🏏', '🏑', '🏒', '🏓', '🏸', '🥊', '🥋', '🥅', '⛳', '⛸️', '🎣', '🤿', '🎽', '🎿', '🛷', '🥌', '🎱', '🪀', '🏹', '🎢', '🎡', '🎠'];

  return [...allIcons].sort(() => 0.5 - Math.random()).slice(0, count);

}

function commandsGroup(permssion, isGroupAdmin) {

  const groups = [];

  for (const [name, cmd] of global.client.commands) {

    if (canAccessCommand(cmd.config.hasPermssion, permssion, isGroupAdmin)) {

      const { commandCategory } = cmd.config;

      const group = groups.find(g => g.commandCategory === commandCategory);

      if (group) {

        group.commandsName.push(name);

      } else {

        groups.push({ commandCategory, commandsName: [name] });

      }

    }

  }

  return groups.sort((a, b) => b.commandsName.length - a.commandsName.length);

}

function findSimilarCommands(input, commands, limit = 3) {

  const matches = findBestMatch(input, commands);

  return matches.ratings

    .filter(match => match.rating > 0.3)

    .sort((a, b) => b.rating - a.rating)

    .slice(0, limit)

    .map(match => match.target);

}

async function sendFullCommandList(api, send, tid, mid, isAdmin, isGroupAdmin, permssion) {

  const cmds = Array.from(global.client.commands.values()).filter(cmd => 

    canAccessCommand(cmd.config.hasPermssion, permssion, isGroupAdmin)

  );

  let txt = '╭───『 All Commands 』───╮\n';

  cmds.forEach((cmd, index) => {

    txt += `┃ ${index + 1}. ${cmd.config.name}\n`;

  });

  txt += `╰─────────────────────╯\n🔸 Dùng "menu + tên lệnh" để xem chi tiết\n🔸 Gỡ tự động sau: ${autoUnsend.timeOut}s`;

  send(txt, tid, (error, info) => {

    if (autoUnsend.status) setTimeout(() => api.unsendMessage(info.messageID), autoUnsend.timeOut * 1000);

  });

}

module.exports.run = async function({ api, event, args, permssion }) {

  const { sendMessage: send, unsendMessage: un } = api;

  const { threadID: tid, messageID: mid, senderID: sid } = event;

  const cmds = global.client.commands;

  const isAdmin = permssion === 2 || permssion === 3;

  const adminIDs = await getThreadAdminIDs(api, tid);

  const isGroupAdmin = adminIDs.includes(sid);

  if (args.length >= 1) {

    if (args[0].toLowerCase() === 'all') {

      return await sendFullCommandList(api, send, tid, mid, isAdmin, isGroupAdmin, permssion);

    }

    const cmdName = args.join(' ').toLowerCase();

    const cmd = cmds.get(cmdName) || cmds.find(c => c.config.name.toLowerCase() === cmdName);

    if (cmd && canAccessCommand(cmd.config.hasPermssion, permssion, isGroupAdmin)) {

      return send(infoCmds(cmd.config), tid, mid);

    } else {

      const accessibleCommands = Array.from(cmds.keys()).filter(name => {

        const cmd = cmds.get(name);

        return canAccessCommand(cmd.config.hasPermssion, permssion, isGroupAdmin);

      });

      const similarCommands = findSimilarCommands(cmdName, accessibleCommands);

      if (similarCommands.length > 0) {

        return send(`❓ Không tìm thấy lệnh "${cmdName}". Có phải bạn muốn tìm:\n${similarCommands.join('\n')}`, tid, mid);

      } else {

        return send(`❌ Không tìm thấy lệnh "${cmdName}" hoặc bạn không có quyền truy cập.`, tid, mid);

      }

    }

  } else {

    const data = commandsGroup(permssion, isGroupAdmin);

    const icons = getRandomIcons(data.length);

    let txt = '╭━━━『 🌟 Menu Yuz 🌟 』━━╮\n';

    for (let i = 0; i < data.length; i++) {

      const { commandCategory, commandsName } = data[i];

      txt += `┃ ${i + 1}. ${icons[i]} ${commandCategory}: ${commandsName.length} lệnh\n`;

    }

    txt += `╰━━━━━━━━━━━━━╯\n` +

           `╭━━━━━━━╮\n` + 

           `┃  ${data.reduce((sum, group) => sum + group.commandsName.length, 0)} lệnh.\n` +

           `╰━━━━━━━╯\n` +

           `📝 Reply số từ 1 đến ${data.length} để xem chi tiết\n` +

           `💡 Gõ "menu all" để xem tất cả lệnh có thể truy cập\n` +

           `⏱️ Tự động gỡ sau: ${autoUnsend.timeOut}s\n` +

           `📱 Facebook Admin: ${global.config.FACEBOOK_ADMIN || "https://www.facebook.com/profile.php?id=61550528673840"}`;

    

    send(txt, tid, (error, info) => {

      global.client.handleReply.push({

        name: this.config.name,

        messageID: info.messageID,

        author: sid,

        'case': 'infoGr',

        data,

        permssion,

        isGroupAdmin

      });

      if (autoUnsend.status) setTimeout(() => un(info.messageID), autoUnsend.timeOut * 1000);

    });

  }

};

module.exports.handleReply = async function({ handleReply: $, api, event }) {

  const { sendMessage: send, unsendMessage: un } = api;

  const { threadID: tid, messageID: mid, senderID: sid, body } = event;

  const args = body.split(' ');

  

  if (sid != $.author) {

    return send(`🚫 Bạn không có quyền sử dụng lệnh này`, tid, mid);

  }

  

  switch ($.case) {

    case 'infoGr': {

      const data = $.data[parseInt(args[0]) - 1];

      if (!data) {

        return send(`❌ "${args[0]}" không nằm trong số thứ tự menu`, tid, mid);

      }

      un($.messageID);

      const icons = getRandomIcons(data.commandsName.length);

      let txt = `╭━━━『 📁 ${data.commandCategory} 📁 』━━━╮\n`;

      for (let i = 0; i < data.commandsName.length; i++) {

        txt += `┃ ${i + 1}. ${icons[i]} ${data.commandsName[i]}\n`;

      }

      txt += `╰━━━━━━━━━━━━━━━━━━━━━╯\n` +

             `📝 Reply từ 1 đến ${data.commandsName.length} để xem chi tiết lệnh\n` +

             `⏱️ Tự động gỡ sau: ${autoUnsend.timeOut}s`;

      send(txt, tid, (error, info) => {

        global.client.handleReply.push({

          name: this.config.name,

          messageID: info.messageID,

          author: sid,

          'case': 'infoCmds',

          data: data.commandsName,

          permssion: $.permssion,

          isGroupAdmin: $.isGroupAdmin

        });

        if (autoUnsend.status) setTimeout(() => un(info.messageID), autoUnsend.timeOut * 1000);

      });

      break;

    }

    case 'infoCmds': {

      const cmdName = $.data[parseInt(args[0]) - 1];

      const cmd = global.client.commands.get(cmdName);

      if (!cmd || !canAccessCommand(cmd.config.hasPermssion, $.permssion, $.isGroupAdmin)) {

        return send(`❌ "${args[0]}" không nằm trong số thứ tự menu hoặc bạn không có quyền truy cập`, tid, mid);

      }

      un($.messageID);

      send(infoCmds(cmd.config), tid, mid);

      break;

    }

  }

};
