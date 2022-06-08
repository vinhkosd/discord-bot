const i18n = require("../util/i18n");
const { MessageEmbed } = require("discord.js");
const axios = require('axios').default;

module.exports = {
    name: "event",
    description: `Nhận code sự kiện`,
    async execute(message) {
        if(message.guild.id != 937637786054459403) return message.reply(
            `Server này không được phép gọi lệnh này`
        );
        const responseActives = await axios.get('http://trieuvy.online/list_code.php');
        
        try {
            const actives = responseActives.data;
            
            // const queue = message.client.queue.get(message.guild.id);
            var countEvent = actives.length > 10 ? 10 : actives.length;
            var listReacts = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
            let resultsEmbed = new MessageEmbed()
            .setTitle(`Chọn sự kiện muốn nhận code`)
            .setDescription(`Bạn cần react 1 trong các số dưới đây để nhận code`)
            .setColor("#F8AA2A");

            try {
                for(var i = 1; i<= countEvent; i++) {
                    resultsEmbed.addField(listReacts[i-1], `${i}. ${actives[i-1].Title}`)
                }
            }catch (error) {
                console.log(error)
            }
            var playingMessage = await message.channel.send(resultsEmbed);
            //1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟
            
            for(var i = 1; i<= countEvent; i++) {
                await playingMessage.react(listReacts[i-1]);
            }

            const filter = (reaction, user) => user.id !== message.client.user.id;
            var collector = playingMessage.createReactionCollector(filter, {
                time: 600000
            });
            
            collector.on("collect", async (reaction, user) => {
                const member = message.guild.member(user);
                console.log(member)
                var stopped = false;
                for(var i = 1; i<= countEvent; i++) {
                    if(listReacts[i-1] == reaction.emoji.name){
                        const code = await axios.get('http://trieuvy.online/create_code.php?ActiveID=' + actives[i-1].ActiveID);
                        member
                        .send(
                            `Code sự kiện ${actives[i-1].Title} của bạn là : ${code.data}`
                        )
                        collector.stop();
                        stopped = true;
                        break;
                    }
                }
                
                if(!stopped) {
                    member.send(`Event này không khả dụng, vui lòng liên hệ admin`).catch(console.error);
                    collector.stop();
                }
            });

            collector.on("end", () => {
                playingMessage.reactions.removeAll().catch(console.error);
                if (playingMessage && !playingMessage.deleted) {
                    playingMessage.delete({ timeout: 1000 }).catch(console.error);
                }
            });
        } catch (error) {
            console.error(error);
        }
    }
};
