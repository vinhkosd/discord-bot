const i18n = require("../util/i18n");
const { play } = require("../include/play");
const ytdl = require("ytdl-core");
const YouTubeAPI = require("simple-youtube-api");
const scdl = require("soundcloud-downloader").default;
const https = require("https");
const { YOUTUBE_API_KEY, SOUNDCLOUD_CLIENT_ID, DEFAULT_VOLUME } = require("../util/Util");
const youtube = new YouTubeAPI(YOUTUBE_API_KEY);
const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "play",
  cooldown: 3,
  aliases: ["p"],
  description: i18n.__("play.description"),
  async execute(message, args) {
    const { channel } = message.member.voice;

    const serverQueue = message.client.queue.get(message.guild.id);

    if (!channel) return message.reply(i18n.__("play.errorNotChannel")).catch(console.error);

    if (serverQueue && channel !== message.guild.me.voice.channel)
      return message
        .reply(i18n.__mf("play.errorNotInSameChannel", { user: message.client.user }))
        .catch(console.error);

    if (!args.length)
      return message
        .reply(i18n.__mf("play.usageReply", { prefix: message.client.prefix }))
        .catch(console.error);

    const permissions = channel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT")) return message.reply(i18n.__("play.missingPermissionConnect"));
    if (!permissions.has("SPEAK")) return message.reply(i18n.__("play.missingPermissionSpeak"));

    const search = args.join(" ");
    const videoPattern = /^(https?:\/\/)?(www\.)?(m\.|music\.)?(youtube\.com|youtu\.?be)\/.+$/gi;
    const playlistPattern = /^.*(list=)([^#\&\?]*).*/gi;
    const scRegex = /^https?:\/\/(soundcloud\.com)\/(.*)$/;
    const mobileScRegex = /^https?:\/\/(soundcloud\.app\.goo\.gl)\/(.*)$/;
    const url = args[0];
    const urlValid = videoPattern.test(args[0]);

    // Start the playlist if playlist url was provided
    if (!videoPattern.test(args[0]) && playlistPattern.test(args[0])) {
      return message.client.commands.get("playlist").execute(message, args);
    } else if (scdl.isValidUrl(url) && url.includes("/sets/")) {
      return message.client.commands.get("playlist").execute(message, args);
    }

    if (mobileScRegex.test(url)) {
      try {
        https.get(url, function (res) {
          if (res.statusCode == "302") {
            return message.client.commands.get("play").execute(message, [res.headers.location]);
          } else {
            return message.reply(i18n.__("play.songNotFound")).catch(console.error);
          }
        });
      } catch (error) {
        console.error(error);
        return message.reply(error.message).catch(console.error);
      }
      return message.reply("Following url redirection...").catch(console.error);
    }

    const queueConstruct = {
      textChannel: message.channel,
      channel,
      connection: null,
      songs: [],
      loop: false,
      volume: DEFAULT_VOLUME,
      muted: false,
      playing: true
    };

    let songInfo = null;
    let song = null;

    if (urlValid) {
      try {
        songInfo = await ytdl.getInfo(url);
        song = {
          title: songInfo.videoDetails.title,
          url: songInfo.videoDetails.video_url,
          duration: songInfo.videoDetails.lengthSeconds
        };
      } catch (error) {
        console.error(error);
        return message.reply(error.message).catch(console.error);
      }
    } else if (scRegex.test(url)) {
      try {
        const trackInfo = await scdl.getInfo(url, SOUNDCLOUD_CLIENT_ID);
        song = {
          title: trackInfo.title,
          url: trackInfo.permalink_url,
          duration: Math.ceil(trackInfo.duration / 1000)
        };
      } catch (error) {
        console.error(error);
        return message.reply(error.message).catch(console.error);
      }
    } else {
      try {
        // const results = await youtube.searchVideos(search, 1, { part: "id" });

        // if (!results.length) {
        //   message.reply(i18n.__("play.songNotFound")).catch(console.error);
        //   return;
        // }

        // songInfo = await ytdl.getInfo(results[0].url);
        // song = {
        //   title: songInfo.videoDetails.title,
        //   url: songInfo.videoDetails.video_url,
        //   duration: songInfo.videoDetails.lengthSeconds
        // };
        if (!args.length)
          return message
            .reply(i18n.__mf("search.usageReply", { prefix: message.client.prefix, name: module.exports.name }))
            .catch(console.error);
        if (message.channel.activeCollector) return message.reply(i18n.__("search.errorAlreadyCollector"));
        if (!message.member.voice.channel)
          return message.reply(i18n.__("search.errorNotChannel")).catch(console.error);

        const search = args.join(" ");

        let resultsEmbed = new MessageEmbed()
          .setTitle(i18n.__("search.resultEmbedTitle"))
          .setDescription(i18n.__mf("search.resultEmbedDesc", { search: search }))
          .setColor("#F8AA2A");

        try {
          const results = await youtube.searchVideos(search, 10);
          results.map((video, index) => resultsEmbed.addField(video.shortURL, `${index + 1}. ${video.title}`));

          let resultsMessage = await message.channel.send(resultsEmbed);

          function filter(msg) {
            var contentMsg = msg.content.toString().replace(message.client.prefix, '');
            const pattern = /^[1-9][0]?(\s*,\s*[1-9][0]?)*$/;
            return pattern.test(contentMsg);
          }

          message.channel.activeCollector = true;
          const response = await message.channel.awaitMessages(filter, { max: 1, time: 30000, errors: ["time"] });

          const reply = response.first().content.replace(message.client.prefix, '');
          
          if (reply.includes(",")) {
            let songs = reply.split(",").map((str) => str.trim());

            for (let song of songs) {
              await message.client.commands
                .get("play")
                .execute(message, [resultsEmbed.fields[parseInt(song) - 1].name]);
            }
          } else {
            const choice = resultsEmbed.fields[parseInt(response.first().toString().replace(/\D/g, '')) - 1].name;
            message.client.commands.get("play").execute(message, [choice]);
          }

          message.channel.activeCollector = false;
          resultsMessage.delete().catch(console.error);
          response.first().delete().catch(console.error);
        } catch (error) {
          console.error(error);
          message.channel.activeCollector = false;
          message.reply(error.message).catch(console.error);
        }
        return;
      } catch (error) {
        console.error(error);
        
        if (error.message.includes("410")) {
          return message.reply(i18n.__("play.songAccessErr")).catch(console.error);
        } else {
          return message.reply(error.message).catch(console.error);
        }
      }
    }

    if (serverQueue) {
      serverQueue.songs.push(song);
      return serverQueue.textChannel
        .send(i18n.__mf("play.queueAdded", { title: song.title, author: message.author }))
        .catch(console.error);
    }

    queueConstruct.songs.push(song);
    message.client.queue.set(message.guild.id, queueConstruct);

    try {
      queueConstruct.connection = await channel.join();
      await queueConstruct.connection.voice.setSelfDeaf(true);
      play(queueConstruct.songs[0], message);
    } catch (error) {
      console.error(error);
      message.client.queue.delete(message.guild.id);
      await channel.leave();
      return message.channel.send(i18n.__mf("play.cantJoinChannel", { error: error })).catch(console.error);
    }
  }
};
