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

const OWNER_ID = 'YOUR_DISCORD_USER_ID';

// In-memory storage
const userStatus = new Map();
const userPoints = new Map();
const activeGames = new Map();
const pollEmojis = ['🇦','🇧','🇨','🇩','🇪','🇫','🇬','🇭','🇮','🇯'];
const triggerWords = { hello: '👋', gg: '🏆', wow: '😮', lol: '😂' };

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
    if (message.author.bot) return;
    const content = message.content.trim();

    // =====================================
    // 🐞 Bug Report via DM
    // =====================================
    if (message.channel.type === 1) {
        try {
            const owner = await client.users.fetch(1418613878052360345);
            const reportEmbed = new EmbedBuilder()
                .setTitle('🐞 Bug / Glitch Report Received')
                .setColor(0xff0000)
                .setDescription(`**From:** ${message.author.tag} (${message.author.id})\n**Message:** ${content}`)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setTimestamp();
            await owner.send({ embeds: [reportEmbed] });
            await message.reply('✅ Your report has been sent to the bot owner. Thank you!');
        } catch (err) {
            console.error(err);
            await message.reply('⚠️ Error sending your report.');
        }
        return;
    }

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
            { name: '💤 !afk [msg]', value: 'Set AFK message.' },
            { name: '⛔ !dnd [msg]', value: 'Set Do Not Disturb mode.' },
            { name: '🖼️ !avatar [@user]', value: 'Show user avatar.' },
            { name: '📜 !userinfo [@user]', value: 'Show user info.' },
            { name: '📊 !poll "Question" Option1 Option2...', value: 'Create a poll with up to 10 options.' },
            { name: '🎮 !tictactoe @user', value: 'Play Tic-Tac-Toe with points!' },
            { name: '⚙️ !warn / !timeout / !ban', value: 'Moderation commands for staff.' },
            { name: '🐞 DM me', value: 'Report bugs directly to the owner.' }
        )
        .addFields({ name: '👑 Bot Creator', value: 'Created by **Anurag** 💻' }) // <-- added creator name
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
});

client.login(process.env.DISCORD_TOKEN)
    .catch(err => console.error('❌ Login failed:', err.message));
