const config = require('./config');
const { TeamSpeak, QueryProtocol } = require("ts3-nodejs-library");
const axios = require('axios');
const { EmbedBuilder, WebhookClient } = require('discord.js');

let ts3;

const webhookClient = new WebhookClient({ url: config.loggingWebhook });

let movedClients = new Map();

let reconnectionAttempts = 0;
const MAX_RECONNECTION_ATTEMPTS = 5;

// API Post Request - No Longer Required
// async function checkLicenseKeyInAPI(key) {
//     try {
//         const response = await axios.post('https://api.ecrpc.online/validate', {
//             license_key: key
//         });

//         return response.status === 200 && response.data.valid;
//     } catch (error) {
//         if (error.response) {
//             console.error('Error validating license key:', error.message);
//         } else if (error.request) {
//             console.error('The API may be down or undergoing maintenance. Please contact the Vox Development Administration for more info.');
//             process.exit(1);
//         } else {
//             console.error('Error:', error.message);
//             process.exit(1);
//         }
//         return false;
//     }
// }

// (async () => {
//     const isValidLicense = await checkLicenseKeyInAPI(config.licenseKey);

//     if (isValidLicense) {
//         console.log('License key successfully validated. Enjoy your product.');
//     } else {
//         console.log('Exiting startup due to invalid license key.');
//         process.exit(1);
//     }
// })();

async function updateOfficeChannelClients() {
    try {
        const allClients = await ts3.clientList();
        officeChannelClients = allClients.filter(client => client.cid === config.officeChannelId);
    } catch (err) {
        console.error("Failed to update office channel clients:", err);
    }
}
async function initializeConnection() {
    ts3 = await TeamSpeak.connect(config);
    await ts3.registerEvent("server");
    console.log("Bot has connected");

    await updateOfficeChannelClients();

    ts3.on("clientconnect", (ev) => {
        const clientId = ev.client.clid;
        const clientInfo = ev.client.propcache;
        const serverGroups = clientInfo.clientServergroups.join(", ");
        const message = `Client connected: ${clientInfo.clientNickname} (Client Id: ${clientId} Unique Id: ${clientInfo.clientUniqueIdentifier} Server Groups: ${serverGroups}, Platform: ${clientInfo.clientPlatform} Version: ${clientInfo.clientVersion})`;
        
        console.log(message);

        const clientconnect = new EmbedBuilder()
            .setTitle('Client Connected')
            .addFields(
                { name: 'Nickname', value: clientInfo.clientNickname },
                { name: 'UID', value: clientInfo.clientUniqueIdentifier },
                { name: 'Server Groups', value: serverGroups },
                { name: 'Platform', value: clientInfo.clientPlatform },
                { name: 'Version', value: clientInfo.clientVersion },
            );
        webhookClient.send({ embeds: [clientconnect] });
    });

    ts3.on("clientdisconnect", (ev) => {
        const clientInfo = ev.client.propcache;
        const message = `Client disconnected: (Nickname: ${clientInfo.clientNickname} UID: ${clientInfo.clientUniqueIdentifier} Server Groups: ${clientInfo.clientServergroups.join(", ")}, Country: ${clientInfo.clientCountry})`;
    
        console.log(message);

        const clientdisconnect = new EmbedBuilder()
            .setTitle('Client Disconnected')
            .addFields(
                { name: 'Nickname', value: clientInfo.clientNickname },
                { name: 'UID', value: clientInfo.clientUniqueIdentifier },
                { name: 'Server Groups', value: clientInfo.clientServergroups.join(", ") },
                { name: 'Country', value: clientInfo.clientCountry },
            );
        webhookClient.send({ embeds: [clientdisconnect] });
    });

    ts3.on("channelcreate", (ev) => {
        const message = `Channel created: ${ev.channel.name}`;
        console.log(message);

        const channelcreate = new EmbedBuilder()
            .setTitle('Channel Created')
            .addFields(
                { name: 'Created Channel ID', value: ev.channel.cid.toString() },
                { name: 'Created Channel Name', value: ev.channel.name },
            );
        webhookClient.send({ embeds: [channelcreate] });
    });

    ts3.on("clientmoved", async (evt) => {
        await updateOfficeChannelClients();

        const clientId = evt.client.clid;
        const movedToChannelId = evt.channel.cid.toString();

        const clientNickname = evt.client.nickname;
        const clientUniqueId = evt.client.uniqueIdentifier;

        const officeChannelId = Object.keys(config.officeToWaitingRoomMap).find(key => config.officeToWaitingRoomMap[key] === movedToChannelId);

        if (officeChannelId) {
            try {
                const officeClients = await ts3.clientList({ cid: officeChannelId });
        
                for (const officeClient of officeClients) {
                    try {
                        await ts3.clientPoke(officeClient.clid, "Someone has joined the waiting room!");
                        console.log(`Poked client ${officeClient.nickname} (ID: ${officeClient.clid}, Unique ID: ${officeClient.uniqueIdentifier})`);
                    } catch (err) {
                        console.error(`Failed to poke client ${officeClient.nickname} (ID: ${officeClient.clid}, Unique ID: ${officeClient.uniqueIdentifier}):`, err);
                    }
                }
        
                try {
                    await ts3.sendTextMessage(clientId, 1, `${clientNickname}, you have joined the waiting room. A staff member has been notified and will be with you shortly.`);
                    console.log(`Message sent to client who joined the waiting room: ${clientNickname} (ID: ${clientId}, Unique ID: ${clientUniqueId})`);
                } catch (err) {
                    console.error(`Failed to send message to client who joined the waiting room ${clientNickname} (ID: ${clientId}, Unique ID: ${clientUniqueId}):`, err);
                }
        
            } catch (err) {
                console.error(`Failed to poke clients in office channel ${officeChannelId}:`, err);
            }
        }

    if (config.quickAfkChannels.has(movedToChannelId)) {
        const destinationChannelId = config.quickAfkMap[movedToChannelId];
        
        if (destinationChannelId) {
            try {
                await ts3.clientMove(clientId, destinationChannelId);
                await ts3.sendTextMessage(clientId, 1, `You have been moved to the AFK Channel.`);
                console.log(`Moved client ${clientNickname} (ID: ${clientId}, Unique ID: ${clientUniqueId}) from quick AFK channel ${movedToChannelId} to ${destinationChannelId}.`);
            } catch (err) {
                console.error(`Failed to move client ${clientNickname} (ID: ${clientId}, Unique ID: ${clientUniqueId}) to channel ${destinationChannelId}:`, err);
            }
        } else {
            console.warn(`No destination channel mapping found for movedToChannelId: ${movedToChannelId}`);
        }
    }
    });

    setInterval(async () => {
        try {
            if (!ts3) return;

            const clients = await ts3.clientList();
            for (let client of clients) {
                const groups = await ts3.serverGroupsByClientId(client.databaseId);

                const isWhitelisted = config.WhitelistedAdminMove.includes(client.cid.toString());

                for (const [role, channel] of Object.entries(config.roleToChannelMap)) {
                    if (!isWhitelisted && groups.some(g => g.sgid === role) && client.cid !== channel && !movedClients.has(client.clid)) {
                        await client.move(channel);
                        movedClients.set(client.clid, Date.now());

                        console.log(`Moved client ${client.nickname} (Role: ${role}) to channel ${channel}.`);

                        setTimeout(() => movedClients.delete(client.clid), 10 * 1000);
                        break;
                    }
                }
            }
        } catch (error) {
            console.error("Error in the 10-second interval callback:", error);
        }
    }, 10 * 1000);
}

initializeConnection().catch(error => {
    console.error("Error during initialization:", error);
    if (reconnectionAttempts < MAX_RECONNECTION_ATTEMPTS) {
        reconnectionAttempts++;
        setTimeout(initializeConnection, 5000 * reconnectionAttempts);
    } else {
        console.error("Max reconnection attempts reached. Exiting.");
        process.exit(1);
    }
});
