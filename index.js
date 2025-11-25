// index.js
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  Partials,
  ChannelType,
  SlashCommandBuilder,
  REST,
  Routes
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
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

const OWNER_ID = '1418613878052360345';

// In-memory storage
const userStatus = new Map(); // AFK/DND
const userPoints = new Map(); // generic points if needed
const activeGames = new Map(); // tic-tac-toe active games
const pollEmojis = ['🇦','🇧','🇨','🇩','🇪','🇫','🇬','🇭','🇮','🇯'];
const triggerWords = { hello: '😘', wow: '😮', lol: '😂' };
const processedMessages = new Set();

// Cooldowns
const commandCooldowns = {
  '+poll': 10,
  '+tictactoe': 5,
  '+warn': 3,
  '+timeout': 3,
  '+ban': 3,
  '+afk': 2,
  '+dnd': 2,
  '+av': 2,
  '+user': 2,
  '+help': 2
};
const cooldowns = new Map(); // Map<command, Map<userId, expireTimestamp>>

// TicTacToe stats
const tttStats = {}; // userId -> { wins, losses, draws, games, points }

// =======================
// ✅ Cooldown Helpers
// =======================
function isOnCooldown(command, userId) {
  const now = Date.now();
  if (!commandCooldowns[command]) return 0;

  if (!cooldowns.has(command)) cooldowns.set(command, new Map());
  const userMap = cooldowns.get(command);

  const expiresAt = userMap.get(userId) || 0;
  if (now < expiresAt) {
    const diff = Math.ceil((expiresAt - now) / 1000);
    return diff;
  }

  userMap.set(userId, now + commandCooldowns[command] * 1000);
  return 0;
}

// =====================================
// 🧩 Helper Functions
// =====================================
function renderBoard(board) {
  return `
${board[0] || '⬜'}${board[1] || '⬜'}${board[2] || '⬜'}
${board[3] || '⬜'}${board[4] || '⬜'}${board[5] || '⬜'}
${board[6] || '⬜'}${board[7] || '⬜'}${board[8] || '⬜'}
  `;
}

function checkWinner(board) {
  const wins = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of wins)
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return board[a];
  return null;
}

function updatePoints(userId, points) {
  const prev = userPoints.get(userId) || 0;
  userPoints.set(userId, prev + points);
}

function updateHistory(winnerId, loserId, isDraw = false) {
  if (isDraw) {
    if (!tttStats[winnerId]) tttStats[winnerId] = { wins:0, losses:0, draws:0, games:0, points:0 };
    if (!tttStats[loserId]) tttStats[loserId] = { wins:0, losses:0, draws:0, games:0, points:0 };
    tttStats[winnerId].draws++;
    tttStats[loserId].draws++;
    tttStats[winnerId].games++;
    tttStats[loserId].games++;
    tttStats[winnerId].points++;
    tttStats[loserId].points++;
    return;
  }

  if (!tttStats[winnerId]) tttStats[winnerId] = { wins:0, losses:0, draws:0, games:0, points:0 };
  if (!tttStats[loserId]) tttStats[loserId] = { wins:0, losses:0, draws:0, games:0, points:0 };

  tttStats[winnerId].wins++;
  tttStats[winnerId].games++;
  tttStats[winnerId].points += 3;

  tttStats[loserId].losses++;
  tttStats[loserId].games++;
}

// =====================================
// 📩 Message Event (prefix commands)
// =====================================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content) return;

  if (processedMessages.has(message.id)) return;
  processedMessages.add(message.id);
  setTimeout(() => processedMessages.delete(message.id), 5 * 60 * 1000);

  const raw = message.content;
  const content = raw.trim();
  const lc = content.toLowerCase();

  // ==========================
  // 🐞 DM Bug Report
  // ==========================
  if (message.channel.type === ChannelType.DM) {
    try {
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
    return;
  }

  // ==========================
  // 🔤 Trigger Word Reactions
  // ==========================
  for (const word in triggerWords) {
    if (lc.includes(word)) {
      try { await message.react(triggerWords[word]); } catch {}
    }
  }

  // ========== +help ==========
  if (lc === '+help') {
    const cooldownLeft = isOnCooldown('+help', message.author.id);
    if (cooldownLeft) return message.reply(`⏳ Please wait ${cooldownLeft}s before using +help again.`);

    const helpEmbed = new EmbedBuilder()
      .setTitle('😉Rizz Help Menu')
      .setColor(0x00aaff)
      .setDescription('Here’s what I can do!')
      .addFields(
        { name: '*Set AFK message*', value: '💤 +afk [msg]' },
        { name: '*Set Do Not Disturb mode*', value:'⛔ +dnd [msg]'  },
        { name: '*Show user avatar*', value: '🖼️ +av [@user or id]' },
        { name: '*Show user info*', value: '📜 +user [@user]' },
        { name: '*Create a poll*', value: '📊 +poll "Question" Option1 Option2...' },
        { name: '*Play Tic-Tac-Toe*', value: '🎮 +tictactoe @user' },
        { name: '*Moderation*', value: '⚒ +warn / +timeout / +ban' },
        { name: '*Bug Report*', value: '🐞 DM me any issue.' }
      )
      .addFields({ name: 'Created by **BLYTZ**', value: 'Creator and Manager' })
      .setFooter({ text: 'More features coming soon!' })
      .setTimestamp();

    return message.reply({ embeds: [helpEmbed] });
  }

  // ========== +warn ==========
  if (lc.startsWith('+warn')) {
    const cooldownLeft = isOnCooldown('+warn', message.author.id);
    if (cooldownLeft) return message.reply(`⏳ Wait ${cooldownLeft}s to use +warn again.`);

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

  // ========== +timeout ==========
  if (lc.startsWith('+timeout')) {
    const cooldownLeft = isOnCooldown('+timeout', message.author.id);
    if (cooldownLeft) return message.reply(`⏳ Wait ${cooldownLeft}s to use +timeout again.`);

    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return message.reply('❌ You need `Moderate Members` permission.`');

    const args = content.split(/\s+/);
    const target = message.mentions.members.first();
    const duration = parseInt(args[2], 10);
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
      message.reply('⚠️ Unable to timeout user. Make sure I have the correct permissions and role hierarchy.');
    }
    return;
  }

  // ========== +ban ==========
  if (lc.startsWith('+ban')) {
    const cooldownLeft = isOnCooldown('+ban', message.author.id);
    if (cooldownLeft) return message.reply(`⏳ Wait ${cooldownLeft}s to use +ban again.`);

    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return message.reply('❌ You need `Ban Members` permission.');

    const target = message.mentions.members.first();
    const reason = content.split(' ').slice(2).join(' ') || 'No reason provided';
    if (!target) return message.reply('⚠️ Please mention a member to ban.');

    try {
      await target.send(`🔨 You have been **banned** from **${message.guild.name}**.\nReason: ${reason}`);
    } catch {}
    try {
      await target.ban({ reason });
      const embed = new EmbedBuilder()
        .setTitle('🔨 User Banned')
        .setColor(0xff0000)
        .setDescription(`**User:** ${target.user.tag}\n**By:** ${message.author.tag}\n**Reason:** ${reason}`)
        .setTimestamp();
      await message.channel.send({ embeds: [embed] });
    } catch (err) {
      return message.reply('⚠️ Unable to ban user. Check my permissions and role position.');
    }
    return;
  }

  // =====================================
  // 🎮 Tic-Tac-Toe Command
  // =====================================
  if (lc.startsWith('+tictactoe')) {
    const cooldownLeft = isOnCooldown('+tictactoe', message.author.id);
    if (cooldownLeft) return message.reply(`⏳ Wait ${cooldownLeft}s to start another game.`);

    const opponent = message.mentions.users.first();
    if (!opponent) return message.reply('❌ Please mention a user to play with!');
    if (opponent.bot) return message.reply('🤖 You can’t play with bots!');
    if (opponent.id === message.author.id) return message.reply('😅 You can’t play against yourself!');

    const ids = [message.author.id, opponent.id].sort();
    const gameId = `${ids[0]}-${ids[1]}`;

    if (activeGames.has(gameId)) return message.reply('⚠️ There is already an ongoing game between you two.');

    if (!tttStats[message.author.id]) tttStats[message.author.id] = { wins:0, losses:0, draws:0, games:0, points:0 };
    if (!tttStats[opponent.id]) tttStats[opponent.id] = { wins:0, losses:0, draws:0, games:0, points:0 };

    const board = Array(9).fill(null);
    const player1 = message.author;
    const player2 = opponent;
    const currentPlayer = player1;

    activeGames.set(gameId, {
      board,
      currentPlayer,
      player1,
      player2,
      gameMsg: null,
      collector: null
    });

    const embed = new EmbedBuilder()
      .setTitle('🎮 Tic-Tac-Toe')
      .setDescription(renderBoard(board))
      .setColor(0x00ff99)
      .setFooter({ text: `Turn: ${currentPlayer.username}` });

    const gameMsg = await message.channel.send({ embeds: [embed] });
    const gameData = activeGames.get(gameId);
    gameData.gameMsg = gameMsg;

    const emojiNums = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
    for (const e of emojiNums) {
      try { await gameMsg.react(e); } catch {}
    }

    const filter = (reaction, user) =>
      emojiNums.includes(reaction.emoji.name) && !user.bot;

    const collector = gameMsg.createReactionCollector({ filter, time: 120000 });
    gameData.collector = collector;

    collector.on('collect', async (reaction, user) => {
      try { await reaction.users.remove(user.id); } catch {}

      const game = activeGames.get(gameId);
      if (!game) return;

      if (user.id !== game.currentPlayer.id) return;

      const index = emojiNums.indexOf(reaction.emoji.name);
      if (index === -1) return;
      if (game.board[index]) return;

      const mark = user.id === game.player1.id ? '❌' : '⭕';
      game.board[index] = mark;

      const winnerFound = checkWinner(game.board);

      if (winnerFound) {
        collector.stop('win');

        const winnerUser = user;
        const loserUser = (game.player1.id === user.id) ? game.player2 : game.player1;

        updateHistory(winnerUser.id, loserUser.id, false);

        const winData = tttStats[winnerUser.id];
        const loseData = tttStats[loserUser.id];

        const winRate = winData.games ? ((winData.wins / winData.games) * 100).toFixed(2) : '0.00';

        const winEmbed = new EmbedBuilder()
          .setTitle(`🏆 ${winnerUser.username} Wins!`)
          .setDescription(
            `${renderBoard(game.board)}\n\n` +
            `🎉 **Match History Updated!**\n\n` +
            `**${winnerUser.username}**\n` +
            `> Wins: ${winData.wins}\n` +
            `> Losses: ${winData.losses}\n` +
            `> Draws: ${winData.draws}\n` +
            `> Games Played: ${winData.games}\n` +
            `> Win Rate: ${winRate}%\n` +
            `> Points: ${winData.points}\n\n` +
            `**${loserUser.username}**\n` +
            `> Wins: ${loseData.wins}\n` +
            `> Losses: ${loseData.losses}\n` +
            `> Draws: ${loseData.draws}\n` +
            `> Games Played: ${loseData.games}\n` +
            `> Points: ${loseData.points}`
          )
          .setColor(0xFFD700)
          .setFooter({ text: 'Tic-Tac-Toe Champion!' })
          .setTimestamp();

        activeGames.delete(gameId);
        return gameMsg.edit({ embeds: [winEmbed] });
      }

      if (game.board.every(cell => cell)) {
        collector.stop('draw');

        updateHistory(game.player1.id, game.player2.id, true);

        const p1 = tttStats[game.player1.id];
        const p2 = tttStats[game.player2.id];

        const p1WR = p1.games ? ((p1.wins / p1.games) * 100).toFixed(2) : '0.00';
        const p2WR = p2.games ? ((p2.wins / p2.games) * 100).toFixed(2) : '0.00';

        const drawEmbed = new EmbedBuilder()
          .setTitle('🤝 Draw!')
          .setDescription(
            `${renderBoard(game.board)}\n\n` +
            `📊 **Match History Updated!**\n\n` +
            `**${game.player1.username}**\n` +
            `> Wins: ${p1.wins}\n` +
            `> Losses: ${p1.losses}\n` +
            `> Draws: ${p1.draws}\n` +
            `> Games Played: ${p1.games}\n` +
            `> Win Rate: ${p1WR}%\n` +
            `> Points: ${p1.points}\n\n` +
            `**${game.player2.username}**\n` +
            `> Wins: ${p2.wins}\n` +
            `> Losses: ${p2.losses}\n` +
            `> Draws: ${p2.draws}\n` +
            `> Games Played: ${p2.games}\n` +
            `> Win Rate: ${p2WR}%\n` +
            `> Points: ${p2.points}`
          )
          .setColor(0x7289da)
          .setTimestamp();

        activeGames.delete(gameId);
        return gameMsg.edit({ embeds: [drawEmbed] });
      }

      game.currentPlayer = (game.currentPlayer.id === game.player1.id) ? game.player2 : game.player1;

      const newEmbed = new EmbedBuilder()
        .setTitle('🎮 Tic-Tac-Toe')
        .setDescription(renderBoard(game.board))
        .setColor(0x00ff99)
        .setFooter({ text: `Turn: ${game.currentPlayer.username}` });

      await gameMsg.edit({ embeds: [newEmbed] });
    });

    collector.on('end', (_, reason) => {
      if (activeGames.has(gameId)) activeGames.delete(gameId);
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
    const cooldownLeft = isOnCooldown('+user', message.author.id);
    if (cooldownLeft) return message.reply(`⏳ Wait ${cooldownLeft}s to use +user again.`);

    const member = message.mentions.members.first() || message.member;
    const user = member.user;
    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Info`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Display Name', value: `${member.displayName}`, inline: true },
        { name: 'Username', value: user.tag, inline: true },
        { name: 'User ID', value: user.id, inline: true },
        { name: 'Roles', value: `${Math.max(0, member.roles.cache.size - 1)}`, inline: true },
        { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: true },
      )
      .setColor(0x2b2d31);
    return message.reply({ embeds: [embed] });
  }

  // ==========================
  // AFK / DND COMMANDS
  // ==========================
  if (content.startsWith('+afk')) {
    const cooldownLeft = isOnCooldown('+afk', message.author.id);
    if (cooldownLeft) return message.reply(`⏳ Wait ${cooldownLeft}s to set AFK again.`);

    const msg = content.slice(4).trim() || 'I am currently AFK.';
    userStatus.set(message.author.id, { type: 'afk', message: msg, time: Date.now() });
    return message.reply(`💤 You are now AFK: "${msg}"`);
  }

  if (content.startsWith('+dnd')) {
    const cooldownLeft = isOnCooldown('+dnd', message.author.id);
    if (cooldownLeft) return message.reply(`⏳ Wait ${cooldownLeft}s to set DND again.`);

    const msg = content.slice(4).trim() || 'Do not disturb.';
    userStatus.set(message.author.id, { type: 'dnd', message: msg, time: Date.now() });
    return message.reply(`⛔ You are now in DND mode: "${msg}"`);
  }

  // ==========================
  // POLL COMMAND (UPDATED)
  // ==========================
  if (content.startsWith('+poll')) {
    const cooldownLeft = isOnCooldown('+poll', message.author.id);
    if (cooldownLeft)
      return message.reply(`⏳ Wait ${cooldownLeft}s to create a poll again.`);

    const args = content.match(/"([^"]+)"|[^\s]+/g);
    if (!args || args.length < 3)
      return message.reply('❌ Usage: `+poll "Question" Option1 Option2 ...`');

    const question = args[0].replace(/"/g, '');
    const options = args.slice(1);

    if (options.length > pollEmojis.length)
      return message.reply(`⚠️ Max ${pollEmojis.length} options allowed.`);

    const desc = options
      .map((opt, i) => `${pollEmojis[i]} — ${opt}`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('📊 Poll Started!')
      .setDescription(`**${question}**\n\n${desc}`)
      .setImage('https://i.kym-cdn.com/photos/images/newsfeed/001/708/012/0ac.gif')
      .setColor(0xFFD700)
      .setFooter({ text: `Poll created by ${message.author.username}` })
      .setTimestamp();

    const pollMsg = await message.channel.send({ embeds: [embed] });

    for (let i = 0; i < options.length; i++) {
      try { await pollMsg.react(pollEmojis[i]); } catch (err) {
        console.log('Reaction Error:', err);
      }
    }

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
  // NOTIFY WHEN TAGGING AFK/DND USERS
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
    const cooldownLeft = isOnCooldown('+av', message.author.id);
    if (cooldownLeft) return message.reply(`⏳ Wait ${cooldownLeft}s to use +av again.`);

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
});

// =====================================
// 🔹 Slash Commands (/ping)
// =====================================
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    return interaction.reply({ content: '🏓 Pong! I am alive!', ephemeral: true });
  }
});

// =====================================
// 🚀 Register Slash Commands
// =====================================
async function registerSlashCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!token || !clientId) {
    console.warn('⚠️ Missing DISCORD_TOKEN or CLIENT_ID env vars. Slash commands not registered.');
    return;
  }

  const commands = [
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('Replies with Pong! 🏓')
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('🔁 Refreshing application (/) commands...');
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    console.log('✅ Successfully registered application (/) commands.');
  } catch (error) {
    console.error('❌ Error registering slash commands:', error);
  }
}

// =====================================
// ✅ Ready + Login
// =====================================
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerSlashCommands();
});

client.login(process.env.DISCORD_TOKEN)
  .catch(err => console.error('❌ Login failed:', err.message));
