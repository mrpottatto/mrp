const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

// Токен бота (получите у @BotFather)
const BOT_TOKEN = '8326632164:AAF09hmeUOFHuAFxeUPOlCk0MEpfBs5sCVk';

const bot = new Telegraf(BOT_TOKEN);
const games = new Map();

// Проблемные буквы, на которые нельзя начинать слова
const PROBLEM_LETTERS = ['ь', 'ъ', 'ы', 'й'];

// Функция для получения последней подходящей буквы
function getLastValidLetter(word) {
    if (!word || word.length === 0) return '';
    
    // Берем последнюю букву
    let lastLetter = word.slice(-1).toLowerCase();
    
    // Если последняя буква проблемная, берем предпоследнюю
    if (PROBLEM_LETTERS.includes(lastLetter)) {
        // Проверяем, что слово не состоит из одной буквы
        if (word.length > 1) {
            const prevLetter = word.slice(-2, -1).toLowerCase();
            console.log(`Последняя буква "${lastLetter}" проблемная, используем предпоследнюю "${prevLetter}"`);
            return prevLetter;
        }
    }
    
    return lastLetter;
}

// Загружаем слова из файла
function loadWords() {
    try {
        const wordsPath = path.join(__dirname, 'words.txt');
        const content = fs.readFileSync(wordsPath, 'utf8');
        return content.split('\n')
            .map(word => word.trim().toLowerCase())
            .filter(word => {
                // Фильтруем слова, исключая те, что начинаются с проблемных букв
                if (word.length === 0) return false;
                const firstLetter = word[0];
                return !PROBLEM_LETTERS.includes(firstLetter);
            });
    } catch (error) {
        console.error('Ошибка загрузки слов:', error);
        return ['яблоко', 'арбуз', 'зонт', 'трамвай']; // Слова по умолчанию
    }
}

const words = loadWords();

// Команда /start
bot.start((ctx) => {
    ctx.reply(
        '🎮 Привет! Я бот для игры в слова.\n\n' +
        'Правила: называйте слово на последнюю букву предыдущего слова.\n' +
        '*Подсказка:* Если слово заканчивается на "ь", "ъ", "ы" или "й", ' +
        'используется предпоследняя буква.\n\n' +
        'Команды:\n' +
        '/start - показать это сообщение\n' +
        '/game - начать новую игру\n' +
        '/stop - закончить игру'\n +
        'чтобы ходы зачитывались отвечай на мои сообщения!',
        { parse_mode: 'Markdown' }
    );
});

// Команда /game - начало новой игры
bot.command('game', (ctx) => {
    const chatId = ctx.chat.id;
    
    // Выбираем случайное слово
    const firstWord = words[Math.floor(Math.random() * words.length)];
    
    // Получаем последнюю букву для следующего хода
    const nextLetter = getLastValidLetter(firstWord);
    
    // Сохраняем состояние игры
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

// Команда /stop - завершение игры
bot.command('stop', (ctx) => {
    const chatId = ctx.chat.id;
    
    if (games.has(chatId)) {
        games.delete(chatId);
        ctx.reply('🛑 Игра завершена. Чтобы начать новую, введите /game');
    } else {
        ctx.reply('У вас нет активной игры. Начните с /game');
    }
});

// Функция для нормализации букв (ё -> е)
function normalizeLetter(letter) {
    if (letter === 'ё') return 'е';
    return letter;
}

// Обработка текстовых сообщений
bot.on('text', (ctx) => {
    const chatId = ctx.chat.id;
    const game = games.get(chatId);
    
    if (!game) return; // Игнорируем, если нет игры
    if (ctx.message.text.startsWith('/')) return;
    
    const userWord = ctx.message.text.toLowerCase().trim();
    const lastLetter = game.lastLetter;
    
    // Проверка длины слова
    if (userWord.length < 2) {
        ctx.reply('❌ Слово должно быть длиннее одной буквы');
        return;
    }
    
    // Проверка первой буквы
    let firstLetter = userWord[0];
    if (firstLetter === 'ё') firstLetter = 'е';
    
    if (firstLetter !== normalizeLetter(lastLetter)) {
        ctx.reply(
            `❌ Слово должно начинаться на букву *${lastLetter.toUpperCase()}*\n` +
            `(предыдущее слово "${game.lastWord.toUpperCase()}" ` +
            `заканчивается на "${game.lastWord.slice(-1)}")`,
            { parse_mode: 'Markdown' }
        );
        return;
    }
    
    // Проверка, что слово есть в словаре
    if (!words.includes(userWord)) {
        ctx.reply('❌ Это слово не найдено в словаре. Попробуйте другое.');
        return;
    }
    
    // Проверка, что слово не использовалось
    if (game.usedWords.includes(userWord)) {
        ctx.reply('❌ Это слово уже использовалось в игре. Придумайте другое.');
        return;
    }
    
    // Все проверки пройдены
    game.usedWords.push(userWord);
    game.lastWord = userWord;
    
    // Определяем следующую букву
    const nextLetter = getLastValidLetter(userWord);
    game.lastLetter = nextLetter;
    
    // Формируем сообщение
    let response = `✅ Принято! *${userWord.toUpperCase()}*\n\n`;
    
    if (PROBLEM_LETTERS.includes(userWord.slice(-1))) {
        response += `Слово заканчивается на "${userWord.slice(-1)}", ` +
                   `поэтому следующая буква: *${nextLetter.toUpperCase()}*\n` +
                   `_(используем предпоследнюю букву)_`;
    } else {
        response += `Следующая буква: *${nextLetter.toUpperCase()}*`;
    }
    
    ctx.reply(response, { parse_mode: 'Markdown' });
});

// Обработка ошибок
bot.catch((err, ctx) => {
    console.error('Ошибка:', err);
    ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.');
});

// Запуск бота
bot.launch()
    .then(() => {
        console.log('✅ Бот запущен и готов к работе!');
        console.log('📚 Загружено слов:', words.length);
    })
    .catch((err) => {
        console.error('❌ Ошибка запуска:', err);
    });

process.once('SIGINT', () => bot.stop('SIGINT'));

process.once('SIGTERM', () => bot.stop('SIGTERM'));
