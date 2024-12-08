const config = {

    // No Longer Required
    // licenseKey: "",

    // Logging Webhook
    loggingWebhook: "https://discord.com/api/webhooks/",

    // Teamspeak Query Connection Information
    host: "",
    protocol: "raw",
    queryport: "10011",
    serverport: "9987",
    username: "serveradmin",
    password: "",
    nickname: "",

    // Quick AFK Channel Mapping.
    quickAfkChannels: new Set([ "8" ]), // Your Quick AFK Channel(s)
    quickAfkMap: {
        "8": "283",
    },

    // See Admin To == (ex Admin Room)
    roleToChannelMap: { // Follow format "roleID": "channelID"
        "182": "30",
    },
    WhitelistedAdminMove: [ "29", "27" ], // you may add multiple of these, recommened for see dept staff, see staff etc.

    // Offices & Waiting Rooms (For Poking when joining a channel.)
    officeToWaitingRoomMap: { // Follow format "officeID": "waitingRoomID"
        "128": "129",
        "130": "131",
    },

    // Development
    logging: {
        level: "debug",
    },
};

module.exports = config;
