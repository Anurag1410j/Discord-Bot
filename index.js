// index.js
require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    PermissionsBitField,
    Partials
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

const OWNER_ID = '1418613878052360345';

// In-memory storage
const userStatus = new Map();
const userPoints = new Map();
const activeGames = new Map();
const pollEmojis = ['🇦','🇧','🇨','🇩','🇪','🇫','🇬','🇭','🇮','🇯'];
const triggerWords = { hello: '😘', wow: '😮', lol: '😂' };

// =====================================
// ✅ Bot Ready
// =====================================
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// =====================================
// 📩 Message Event
// =====================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return; // Ignore bot messages

    const content = message.content.trim();

    // =====================================
    // 🐞 Bug Report via DM
    // =====================================
    if (message.channel.type === 1) { // Check if it's a DM
        try {
            const OWNER_ID = '1418613878052360345'; // Replace with your owner's actual ID
            const owner = await client.users.fetch(OWNER_ID);
            
            const reportEmbed = new EmbedBuilder()
                .setTitle('🐞 Bug / Glitch Report Received')
                .setColor(0xff0000)
                .setDescription(`**From:** ${message.author.tag} (${message.author.id})\n**Message:** ${content}`)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            await owner.send({ embeds: [reportEmbed] });
            await message.reply('✅ Your report has been sent to the bot owner. Thank you!');
        } catch (err) {
            console.error('Error sending report:', err);
            await message.reply('⚠️ Error sending your report.');
        }
        return; // End here for DMs 
    }

    // Additional commands handling, e.g., tictactoe check:
    if (content === '!tictactoe') {
        // Place your tic tac toe command implementation here
        await message.reply('TicTacToe command recognized!');
    }
});


    // =====================================
    // 🔤 React on Specific Words
    // =====================================
    for (const word in triggerWords) {
        if (content.toLowerCase().includes(word)) {
            try { await message.react(triggerWords[word]); } catch (e) {}
        }
    }

    // =====================================
    // 🆘 Help Command
    // =====================================
    if (content.toLowerCase() === '+help') {
         const helpEmbed = new EmbedBuilder()
        .setTitle('🤖 Bot Command Menu')
        .setColor(0x00aaff)
        .setDescription('Here’s what I can do!')
        .addFields(
            //{ name: '🏓 !ping', value: 'Check bot response speed.' },
            { name: '💤 +afk [msg]', value: 'Set AFK message.' },
            { name: '⛔ +dnd [msg]', value: 'Set Do Not Disturb mode.' },
            { name: '🖼️ +av [@user]', value: 'Show user avatar.' },
            { name: '📜 +user [@user]', value: 'Show user info.' },
            { name: '📊 +poll "Question" Option1 Option2...', value: 'Create a poll with up to 10 options.' },
            { name: '🎮 +tictactoe @user', value: 'Play Tic-Tac-Toe with points!' },
            { name: '⚙️ +warn / !timeout / !ban', value: 'Moderation commands for staff.' },
            { name: '🐞 DM me', value: 'Report bugs directly to the owner.' }
        )
        .addFields({ name: 'Created and Managed', value: 'Created by **BLYTZ** 💻' }) // <-- added creator name
        .setFooter({ text: 'More features coming soon!' })
        .setTimestamp();

    return message.reply({ embeds: [helpEmbed] });
    }

    // =====================================
    // ⚠️ WARN Command
    // =====================================
    if (content.toLowerCase().startsWith('+warn')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
            return message.reply('❌ You need `Manage Messages` permission to use this.');

        const target = message.mentions.members.first();
        const reason = content.split(' ').slice(2).join(' ') || 'No reason provided';
        if (!target) return message.reply('⚠️ Please mention a member to warn.');

        const embed = new EmbedBuilder()
            .setTitle('⚠️ User Warned')
            .setColor(0xffa500)
            .setDescription(`**User:** ${target.user.tag}\n**By:** ${message.author.tag}\n**Reason:** ${reason}`)
            .setTimestamp();

        try {
            await target.send(`⚠️ You were warned in **${message.guild.name}** for: ${reason}`);
        } catch {}
        await message.channel.send({ embeds: [embed] });
        return;
    }

    // =====================================
    // ⏳ TIMEOUT Command
    // =====================================
    if (content.toLowerCase().startsWith('+timeout')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
            return message.reply('❌ You need `Moderate Members` permission.');

        const args = content.split(' ');
        const target = message.mentions.members.first();
        const duration = parseInt(args[2]);
        const reason = args.slice(3).join(' ') || 'No reason provided';

        if (!target) return message.reply('⚠️ Please mention a member to timeout.');
        if (isNaN(duration) || duration <= 0) return message.reply('🕒 Enter a valid timeout duration (minutes).');

        try {
            await target.timeout(duration * 60 * 1000, reason);
            const embed = new EmbedBuilder()
                .setTitle('⏳ User Timed Out')
                .setColor(0xff5555)
                .setDescription(`**User:** ${target.user.tag}\n**By:** ${message.author.tag}\n**Duration:** ${duration} min\n**Reason:** ${reason}`)
                .setTimestamp();
            try {
                await target.send(`⏳ You were timed out for ${duration} minute(s) in **${message.guild.name}**.\nReason: ${reason}`);
            } catch {}
            await message.channel.send({ embeds: [embed] });
        } catch (err) {
            message.reply('⚠️ Unable to timeout user. Make sure I have the correct permissions.');
        }
        return;
    }

    // =====================================
    // 🔨 BAN Command
    // =====================================
    if (content.toLowerCase().startsWith('+ban')) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
            return message.reply('❌ You need `Ban Members` permission.');

        const target = message.mentions.members.first();
        const reason = content.split(' ').slice(2).join(' ') || 'No reason provided';
        if (!target) return message.reply('⚠️ Please mention a member to ban.');

        try {
            await target.send(`🔨 You have been **banned** from **${message.guild.name}**.\nReason: ${reason}`);
        } catch {}
        await target.ban({ reason });

        const embed = new EmbedBuilder()
            .setTitle('🔨 User Banned')
            .setColor(0xff0000)
            .setDescription(`**User:** ${target.user.tag}\n**By:** ${message.author.tag}\n**Reason:** ${reason}`)
            .setTimestamp();
        await message.channel.send({ embeds: [embed] });
        return;
    }
    // =====================================
    // 🎮 Tic-Tac-Toe Game
    // =====================================
    if (content.toLowerCase().startsWith('+tictactoe')) {
        const opponent = message.mentions.users.first();
        if (!opponent) return message.reply('❌ Please mention a user to play with!');
        if (opponent.bot) return message.reply('🤖 You can’t play with bots!');
        if (opponent.id === message.author.id) return message.reply('😅 You can’t play against yourself!');

        const gameId = `${message.author.id}-${opponent.id}`;
        if (activeGames.has(gameId)) return message.reply('⚠️ You already have an ongoing game with this user.');

        // Game setup
        const board = Array(9).fill(null);
        const currentPlayer = message.author;
        activeGames.set(gameId, { board, currentPlayer, player1: message.author, player2: opponent });

        const embed = new EmbedBuilder()
            .setTitle('🎮 Tic-Tac-Toe')
            .setDescription(renderBoard(board))
            .setColor(0x00ff99)
            .setFooter({ text: `Turn: ${currentPlayer.username}` });

        const gameMsg = await message.channel.send({ embeds: [embed] });
        const emojiNums = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
        for (const e of emojiNums) await gameMsg.react(e);

        const filter = (reaction, user) => emojiNums.includes(reaction.emoji.name) && !user.bot;
        const collector = gameMsg.createReactionCollector({ filter, time: 120000 });

        collector.on('collect', async (reaction, user) => {
            const game = activeGames.get(gameId);
            if (!game || user.id !== game.currentPlayer.id) return reaction.users.remove(user);

            const index = emojiNums.indexOf(reaction.emoji.name);
            if (game.board[index]) return reaction.users.remove(user);

            const mark = user.id === game.player1.id ? '❌' : '⭕';
            game.board[index] = mark;

            // Check result
            const winner = checkWinner(game.board);
            if (winner) {
                collector.stop('win');
                updatePoints(user.id, 3);
                updatePoints(game.player1.id === user.id ? game.player2.id : game.player1.id, 0);

                const winEmbed = new EmbedBuilder()
                    .setTitle(`🏆 ${user.username} Wins!`)
                    .setDescription(`${renderBoard(game.board)}\n\n+3 points awarded!`)
                    .setColor(0xFFD700)
                    .setImage('https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXd3YWkwamxicnk4eDl6MGVzbGw2OWEzdW9nOGFwcnJsNHVtczVqZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/chW2JzLfbUI8yWSa9j/giphy.gif') // 🎉 Custom winner GIF
                    .setFooter({ text: 'Tic-Tac-Toe Champion!' })
                    .setTimestamp();

                return gameMsg.edit({ embeds: [winEmbed] });
            }

            if (game.board.every(cell => cell)) {
                collector.stop('draw');
                updatePoints(game.player1.id, 1);
                updatePoints(game.player2.id, 1);

                const drawEmbed = new EmbedBuilder()
                    .setTitle('🤝 Draw!')
                    .setDescription(`${renderBoard(game.board)}\n\nBoth players get +1 point.`)
                    .setColor(0x7289da)
                    .setTimestamp();

                return gameMsg.edit({ embeds: [drawEmbed] });
            }

            game.currentPlayer = game.currentPlayer.id === game.player1.id ? game.player2 : game.player1;
            const newEmbed = new EmbedBuilder()
                .setTitle('🎮 Tic-Tac-Toe')
                .setDescription(renderBoard(game.board))
                .setColor(0x00ff99)
                .setFooter({ text: `Turn: ${game.currentPlayer.username}` });
            gameMsg.edit({ embeds: [newEmbed] });
        });

        collector.on('end', (_, reason) => {
            activeGames.delete(gameId);
            if (reason === 'time') {
                message.channel.send('⌛ Game ended due to inactivity.');
            }
        });
        return;
    }
    // ==========================
    // USER INFO COMMAND
    // ==========================
    if (content.startsWith('+user')) {
        const member = message.mentions.members.first() || message.member;
        const user = member.user;
        const embed = new EmbedBuilder()
            .setTitle(`${user.username}'s Info`)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: 'Display Name', value: member.displayName, inline: true },
                { name: 'Username', value: user.tag, inline: true },
                { name: 'User ID', value: user.id, inline: true },
                { name: 'Roles', value: `${member.roles.cache.size - 1}`, inline: true },
                { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true },
                { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: true },
            )
            .setColor(0x2b2d31);
        return message.reply({ embeds: [embed] });
    }
    // ==========================
    // AFK COMMAND
    // ==========================
    if (content.startsWith('+afk')) {
        const msg = content.slice(4).trim() || 'I am currently AFK.';
        userStatus.set(message.author.id, { type: 'afk', message: msg, time: Date.now() });
        return message.reply(`💤 You are now AFK: "${msg}"`);
    }

    // ==========================
    // DND COMMAND
    // ==========================
    if (content.startsWith('+dnd')) {
        const msg = content.slice(4).trim() || 'Do not disturb.';
        userStatus.set(message.author.id, { type: 'dnd', message: msg, time: Date.now() });
        return message.reply(`⛔ You are now in DND mode: "${msg}"`);
    }

    // ==========================
    // POLL COMMAND
    // ==========================
    if (content.startsWith('+poll')) {
        const args = content.match(/"([^"]+)"|[^\s]+/g);
        if (!args || args.length < 3)
            return message.reply('❌ Usage: `+poll "Question" Option1 Option2 ...`');
        const question = args[0].replace(/"/g, '');
        const options = args.slice(1);
        const desc = options.map((opt, i) => `${pollEmojis[i]} — ${opt}`).join('\n');
        const embed = new EmbedBuilder()
            .setTitle(`📊 ${question}`)
            .setDescription(desc)
            .setColor(0x3498db);
        const pollMsg = await message.channel.send({ embeds: [embed] });
        for (let i = 0; i < options.length; i++) await pollMsg.react(pollEmojis[i]);
        return;
    }

    // ==========================
    // REMOVE AFK/DND ON MESSAGE
    // ==========================
    if (userStatus.has(message.author.id)) {
        const prev = userStatus.get(message.author.id);
        userStatus.delete(message.author.id);
        return message.reply(`👋 Welcome back! You are no longer ${prev.type.toUpperCase()}.`);
    }

    // ==========================
    // NOTIFY WHEN TAGGING AFK/DND
    // ==========================
    if (message.mentions.users.size > 0) {
        for (const user of message.mentions.users.values()) {
            if (userStatus.has(user.id)) {
                const s = userStatus.get(user.id);
                const mins = Math.floor((Date.now() - s.time) / 60000);
                await message.reply(
                    `${s.type === 'afk' ? '💤' : '⛔'} ${user.username} is ${s.type.toUpperCase()}: "${s.message}" (${mins}m)`
                );
            }
        }
    }
// ==========================
    // AVATAR COMMAND
    // ==========================
    if (content.startsWith('+av')) {
        const args = content.split(' ').slice(1);
        let user = message.mentions.users.first();
        if (!user && args[0]) {
            try {
                user = await client.users.fetch(args[0]);
            } catch {
                user = message.author;
            }
        } else if (!user) user = message.author;

        const embed = new EmbedBuilder()
            .setTitle(`${user.username}'s Avatar`)
            .setImage(user.displayAvatarURL({ size: 1024, dynamic: true }))
            .setColor(0x5865f2);
        return message.reply({ embeds: [embed] });
    }


    // =====================================
    // ⚙️ Other commands (AFK, DND, Avatar, Tic-Tac-Toe, etc.)
    // =====================================
    // All previous features remain unchanged below.
});

// =====================================
// 🏓 Ping
// =====================================
//client.on('messageCreate', async message => {
//    if (message.content.toLowerCase() === '!ping' && !message.author.bot)
       // message.reply('🏓 Pong!');
//});

client.login(process.env.DISCORD_TOKEN)
    .catch(err => console.error('❌ Login failed:', err.message));
