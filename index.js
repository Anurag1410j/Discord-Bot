// ===============================
//        Discord Bot (FIXED)
// ===============================
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  Partials,
  ChannelType
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
const userStatus = new Map();
const userPoints = new Map();
const activeGames = new Map();
const pollEmojis = ['🇦','🇧','🇨','🇩','🇪','🇫','🇬','🇭','🇮','🇯'];
const triggerWords = { hello: '😘', wow: '😮', lol: '😂' };
const processedMessages = new Set();

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
const cooldowns = new Map();
const tttStats = {};

// =====================================
// ❗ Cooldown Check Function
// =====================================
function isOnCooldown(cmd, userId) {
  if (!cooldowns.has(cmd))
    cooldowns.set(cmd, new Map());

  const userCooldowns = cooldowns.get(cmd);
  const now = Date.now();

  if (!userCooldowns.has(userId) || now > userCooldowns.get(userId)) {
    userCooldowns.set(userId, now + commandCooldowns[cmd] * 1000);
    return 0;
  }

  return Math.ceil((userCooldowns.get(userId) - now) / 1000);
}

// =====================================
// 📩 Message Event
// =====================================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content) return;

  // Prevent double handling
  if (processedMessages.has(message.id)) return;
  processedMessages.add(message.id);
  setTimeout(() => processedMessages.delete(message.id), 300000);

  const raw = message.content;
  const content = raw.trim();
  const lc = content.toLowerCase();

  // =====================================
  // 📨 Bug Report (DM Only)
  // =====================================
  if (message.channel.type === ChannelType.DM) {
    try {
      const owner = await client.users.fetch(OWNER_ID);

      const embed = new EmbedBuilder()
        .setTitle('🐞 Bug Report Received')
        .setDescription(`From: **${message.author.tag}**\n\nMessage:\n${content}`)
        .setColor(0xff0000)
        .setTimestamp();

      await owner.send({ embeds: [embed] });
      return message.reply('✅ Report sent to the owner!');
    } catch {
      return message.reply('⚠️ Failed to send report.');
    }
  }

  // =====================================
  // 🔤 Auto-Reactions
  // =====================================
  for (const word in triggerWords) {
    if (lc.includes(word)) {
      try { await message.react(triggerWords[word]); } catch {}
    }
  }

  // =====================================
  // 📚 HELP COMMAND
  // =====================================
  if (lc === '+help') {
    const cd = isOnCooldown('+help', message.author.id);
    if (cd) return message.reply(`⏳ Wait ${cd}s.`);

    const embed = new EmbedBuilder()
      .setTitle('😉 Rizz Help Menu')
      .setColor(0x00aaff)
      .addFields(
        { name: '💤 AFK', value: '+afk [msg]' },
        { name: '⛔ DND', value: '+dnd [msg]' },
        { name: '🖼️ Avatar', value: '+av [user]' },
        { name: '📜 User Info', value: '+user [user]' },
        { name: '📊 Polls', value: '+poll "Question" option1 option2...' },
        { name: '🎮 TicTacToe', value: '+tictactoe @user' },
        { name: '🛡️ Moderator Commands', value: '+warn / +timeout / +ban' },
        { name: '🐞 Bug Report', value: 'DM the bot' }
      )
      .setFooter({ text: 'Created by BLYTZ' });

    return message.reply({ embeds: [embed] });
  }

  // =====================================
  // ⚠️ WARN
  // =====================================
  if (lc.startsWith('+warn')) {
    const cd = isOnCooldown('+warn', message.author.id);
    if (cd) return message.reply(`⏳ Wait ${cd}s.`);

    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return message.reply('❌ You need **Manage Messages** permission.');

    const target = message.mentions.members.first();
    const reason = content.split(' ').slice(2).join(' ') || 'No reason specified';

    if (!target) return message.reply('⚠️ Mention someone to warn.');

    const embed = new EmbedBuilder()
      .setTitle('⚠️ User Warned')
      .setDescription(`User: **${target.user.tag}**\nBy: **${message.author.tag}**\nReason: ${reason}`)
      .setColor(0xffa500);

    try { await target.send(`⚠️ Warned in ${message.guild.name}: ${reason}`); } catch {}
    return message.channel.send({ embeds: [embed] });
  }

  // =====================================
  // ⏳ TIMEOUT
  // =====================================
  if (lc.startsWith('+timeout')) {
    const cd = isOnCooldown('+timeout', message.author.id);
    if (cd) return message.reply(`⏳ Wait ${cd}s.`);

    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return message.reply('❌ Missing `Moderate Members` permission.');

    const args = content.split(/\s+/);
    const target = message.mentions.members.first();
    const duration = parseInt(args[2]);
    const reason = args.slice(3).join(' ') || 'No reason provided';

    if (!target) return message.reply('⚠️ Mention someone to timeout.');

    if (isNaN(duration)) return message.reply('⏳ Enter timeout duration in minutes.');

    try {
      await target.timeout(duration * 60000, reason);
      return message.reply(`⏳ ${target.user.tag} timed out for **${duration}m**.`);
    } catch {
      return message.reply('⚠️ Unable to timeout user.');
    }
  }

  // =====================================
  // 🔨 BAN
  // =====================================
  if (lc.startsWith('+ban')) {
    const cd = isOnCooldown('+ban', message.author.id);
    if (cd) return message.reply(`⏳ Wait ${cd}s.`);

    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return message.reply('❌ Missing `Ban Members` permission.');

    const target = message.mentions.members.first();
    if (!target) return message.reply('⚠️ Mention someone to ban.');

    const reason = content.split(' ').slice(2).join(' ') || 'No reason provided';

    try { await target.send(`🔨 You were banned: ${reason}`); } catch {}
    try {
      await target.ban({ reason });
      return message.reply(`🔨 **${target.user.tag}** banned.`);
    } catch {
      return message.reply('⚠️ Ban failed.');
    }
  }

  // =====================================
  // 🎮 TicTacToe (Your full TTT code remains unchanged)
  // =====================================

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

    // create canonical game id where order doesn't matter
    const ids = [message.author.id, opponent.id].sort();
    const gameId = `${ids[0]}-${ids[1]}`;

    if (activeGames.has(gameId)) return message.reply('⚠️ There is already an ongoing game between you two.');

    // initialize stats for players if missing
    if (!tttStats[message.author.id]) tttStats[message.author.id] = { wins:0, losses:0, draws:0, games:0, points:0 };
    if (!tttStats[opponent.id]) tttStats[opponent.id] = { wins:0, losses:0, draws:0, games:0, points:0 };

    const board = Array(9).fill(null);
    const player1 = message.author;
    const player2 = opponent;
    const currentPlayer = player1; // X starts

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
    // store message reference
    const gameData = activeGames.get(gameId);
    gameData.gameMsg = gameMsg;

    const emojiNums = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
    for (const e of emojiNums) {
      try { await gameMsg.react(e); } catch (err) {}
    }

    const filter = (reaction, user) =>
      emojiNums.includes(reaction.emoji.name) && !user.bot;

    const collector = gameMsg.createReactionCollector({ filter, time: 120000 });
    gameData.collector = collector;

    collector.on('collect', async (reaction, user) => {
      // remove extra reactions from same user (to keep UI tidy)
      try { await reaction.users.remove(user.id); } catch {}

      const game = activeGames.get(gameId);
      if (!game) return;

      if (user.id !== game.currentPlayer.id) {
        return; // ignore reaction from not-current player
      }

      const index = emojiNums.indexOf(reaction.emoji.name);
      if (index === -1) return;
      if (game.board[index]) return; // already taken

      const mark = user.id === game.player1.id ? '❌' : '⭕';
      game.board[index] = mark;

      const winnerFound = checkWinner(game.board);

      // WINNER SECTION
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
          .setImage('https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXd3YWkwamxicnk4eDl6MGVzbGw2OWEzdW9nOGFwcnJsNHVtczVqZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/chW2JzLfbUI8yWSa9j/giphy.gif')
          .setFooter({ text: 'Tic-Tac-Toe Champion!' })
          .setTimestamp();

        activeGames.delete(gameId);
        return gameMsg.edit({ embeds: [winEmbed] });
      }

      // DRAW SECTION
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

      // NEXT TURN
      game.currentPlayer = (game.currentPlayer.id === game.player1.id) ? game.player2 : game.player1;

      const newEmbed = new EmbedBuilder()
        .setTitle('🎮 Tic-Tac-Toe')
        .setDescription(renderBoard(game.board))
        .setColor(0x00ff99)
        .setFooter({ text: `Turn: ${game.currentPlayer.username}` });

      await gameMsg.edit({ embeds: [newEmbed] });
    });

    collector.on('end', (_, reason) => {
      // cleanup
      if (activeGames.has(gameId)) activeGames.delete(gameId);
      if (reason === 'time') {
        message.channel.send('⌛ Game ended due to inactivity.');
      }
    });

    return;
  }

  // =====================================
  // 👤 USER COMMAND
  // =====================================
  if (lc.startsWith('+user')) {
    const cd = isOnCooldown('+user', message.author.id);
    if (cd) return message.reply(`⏳ Wait ${cd}s.`);

    const member = message.mentions.members.first() || message.member;
    const user = member.user;

    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Info`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Username', value: user.tag },
        { name: 'ID', value: user.id }
      )
      .setColor(0x2b2d31);

    return message.reply({ embeds: [embed] });
  }

  // =====================================
  // 💤 AFK
  // =====================================
  if (lc.startsWith('+afk')) {
    const msg = content.slice(4).trim() || 'AFK.';
    userStatus.set(message.author.id, { type: 'afk', message: msg, time: Date.now() });
    return message.reply(`💤 AFK set: "${msg}"`);
  }

  // =====================================
  // ⛔ DND
  // =====================================
  if (lc.startsWith('+dnd')) {
    const msg = content.slice(4).trim() || 'Do not disturb.';
    userStatus.set(message.author.id, { type: 'dnd', message: msg, time: Date.now() });
    return message.reply(`⛔ DND set: "${msg}"`);
  }

  // =====================================
  // 🖼️ AVATAR
  // =====================================
  if (lc.startsWith('+av')) {
    const user = message.mentions.users.first() || message.author;

    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Avatar`)
      .setImage(user.displayAvatarURL({ size: 1024, dynamic: true }))
      .setColor(0x5865f2);

    return message.reply({ embeds: [embed] });
  }

  // =====================================
  // 📊 POLL COMMAND
  // =====================================
  if (content.startsWith('+poll')) {
    const cd = isOnCooldown('+poll', message.author.id);
    if (cd) return message.reply(`⏳ Wait ${cd}s.`);

    const args = content.match(/"([^"]+)"|[^\s]+/g);
    if (!args || args.length < 3)
      return message.reply('❌ Use: +poll "Question" option1 option2');

    const question = args[0].replace(/"/g, '');
    const options = args.slice(1);

    const desc = options.map((opt, i) => `${pollEmojis[i]} — ${opt}`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('📊 Poll Started!')
      .setDescription(`**${question}**\n\n${desc}`)
      .setColor(0xffd700);

    const pollMsg = await message.channel.send({ embeds: [embed] });

    for (let i = 0; i < options.length; i++)
      try { await pollMsg.react(pollEmojis[i]); } catch {}
  }

});

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

// =====================================
// 🚀 Start the Bot
// =====================================
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
