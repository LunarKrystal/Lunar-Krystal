class Command {
    constructor(config) {
        this.config = config;
        this.queues = [];
        this.stream_url = function (url) {

            return require('axios')({
                url: url,
                responseType: 'stream',
            })
            .then(_=>_.data);

        };
    };

    async onLoad(o) {
        const thiss = this;
        let status = false;
        const api_url = 'https://api.dungkon.id.vn/girl-video';
        const urls = [
            'https://ep.edu.vn/xem-hinh-hot-girl-de-thuong/imager_9_11850_700.jpg'
        ];

        if (!global.mmccffjjs)global.mmccffjjs = setInterval(_=> {
            if (status == true || thiss.queues.length > 5)return;

            status = true;
            Promise.all([...Array(5)].map(e=>require('axios').get(api_url).then(r=>upload(r.data.url)))).then(res=>(thiss.queues.push(...res), status = false));
        },
            1000*10);


        async function upload(url) {
            const form = {
                upload_1024: await thiss.stream_url(url),
            };

            return o.api.postFormData('https://upload.facebook.com/ajax/mercury/upload.php',
                form).then(res => Object.entries(JSON.parse(res.body.replace('for (;;);', '')).payload?.metadata?.[0] || {})[0]);
        };
    };

    async run(o) {
        let send = msg=>new Promise(r=>o.api.sendMessage(msg, o.event.threadID, (err, res)=>r(res || err), o.event.messageID));

        send({
            body: 'Ngắm thôi không húp được đâu !',
            attachment: this.queues.splice(0, 1),
        })
    }

}
module.exports = new Command({
    name: 'vdgai',
    version: '0.0.1',
    hasPermssion: 0,
    credits: 'Niio-team (DC-Nam)',
    description: 'Video gái',
    commandCategory: 'Video',
    usages: '[]',
    cooldowns: 0,
})
