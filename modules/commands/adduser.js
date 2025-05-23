module.exports.config = {
    name: "add",
    version: "1.0.0",
    hasPermssion: 1,
    credits: "D-Jukie",
    description: "Thêm người dùng vào nhóm bằng link hoặc uid",
    commandCategory: "Quản Trị Viên",
    usages: "[args]",
    cooldowns: 5
};
module.exports.run = async function ({ api, event, args, Threads, Users }) {
const { threadID, messageID } = event;
const axios = require('axios')
const link = args.join(" ")
if(!args[0]) return api.sendMessage({body:`Cách xử dụng:\n+adduser <link facebook>\n+adduser <uid>`
},event.threadID, event.messageID)
var { participantIDs, approvalMode, adminIDs } = await api.getThreadInfo(threadID);
if(link.indexOf(".com/")!==-1) {
    const res = await api.getUID(args[0] || event.messageReply.body);
    var uidUser = res
    api.addUserToGroup(uidUser, threadID, (err) => {
    if (participantIDs.includes(uidUser)) return api.sendMessage('Trong nhóm đã có thành viên này rồi', threadID, messageID);
    if (err) return api.sendMessage(`Không thể thêm vào nhóm`, threadID, messageID);
    else if (approvalMode && !adminIDs.some(item => item.id == api.getCurrentUserID())) return api.sendMessage(`Thành viên đã được thêm vào danh sách phê duyệt`, threadID, messageID);
    else return api.sendMessage(`Thêm thành viên vào nhóm thành công`, threadID, messageID);
    });
    }
  else { 
    var uidUser = args[0] 
    api.addUserToGroup(uidUser, threadID, (err) => {
    if (participantIDs.includes(uidUser)) return api.sendMessage(`Trong nhóm đã có thành viên này rồi`, threadID, messageID);
    if (err) return api.sendMessage(`Không thể thêm vào nhóm`, threadID, messageID);
    else if (approvalMode && !adminIDs.some(item => item.id == api.getCurrentUserID())) return api.sendMessage(`Thành viên đã được thêm vào danh sách phê duyệt`, threadID, messageID);
    else return api.sendMessage(`Thêm thành viên vào nhóm thành công`, threadID, messageID);
    });
  }
}
