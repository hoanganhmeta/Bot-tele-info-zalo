const fetch = require('node-fetch');
const crypto = require('crypto');

// ============ CẤU HÌNH ============
const CONFIG = {
    ZALO_APP_ID: process.env.ZALO_APP_ID || '1752876402407902351',
    ZALO_SECRET_KEY: process.env.ZALO_SECRET_KEY || '83DLdwH62YIT4YrJSSSO',
    REDIRECT_URI: process.env.REDIRECT_URI || 'https://your-app.netlify.app/.netlify/functions/oauth-callback'
};

// ============ TẠO LINK ĐĂNG NHẬP ZALO ============
function generateZaloAuthLink(chatId) {
    const verifier = crypto.randomBytes(32).toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 128);
    
    const challenge = crypto.createHash('sha256')
        .update(verifier)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    
    const state = Buffer.from(JSON.stringify({
        chatId: chatId,
        verifier: verifier
    })).toString('base64');
    
    const authUrl = new URL('https://oauth.zaloapp.com/v4/authorization');
    authUrl.searchParams.append('app_id', CONFIG.ZALO_APP_ID);
    authUrl.searchParams.append('redirect_uri', CONFIG.REDIRECT_URI);
    authUrl.searchParams.append('code_challenge', challenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('state', state);
    
    return authUrl.toString();
}

// ============ GỬI TIN NHẮN TELEGRAM ============
async function sendTelegramMessage(chatId, text, parseMode = 'Markdown') {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.error('❌ TELEGRAM_BOT_TOKEN not set');
        return;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: parseMode,
                disable_web_page_preview: true
            })
        });
    } catch (error) {
        console.error('Telegram send error:', error);
    }
}

// ============ XỬ LÝ COMMAND ============
async function handleStart(chatId) {
    const authLink = generateZaloAuthLink(chatId);
    
    await sendTelegramMessage(chatId,
        `🤖 *Bot Lấy Thông Tin Zalo*\n\n` +
        `🔐 *Đăng nhập Zalo để bắt đầu:*\n\n` +
        `[Click vào đây để đăng nhập](${authLink})\n\n` +
        `📌 *Hướng dẫn:*\n` +
        `1️⃣ Click link đăng nhập\n` +
        `2️⃣ Cho phép ứng dụng\n` +
        `3️⃣ Quay lại để nhận thông tin\n\n` +
        `⚙️ *Lệnh:* /info - Lấy thông tin user`
    );
}

async function handleInfo(chatId) {
    const authLink = generateZaloAuthLink(chatId);
    
    await sendTelegramMessage(chatId,
        `🔐 *Vui lòng đăng nhập Zalo trước:*\n\n` +
        `[Click để đăng nhập](${authLink})`
    );
}

// ============ HANDLER CHÍNH ============
exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body);
        const message = body.message;
        
        if (!message) {
            return { statusCode: 200, body: 'OK' };
        }

        const chatId = message.chat.id;
        const text = message.text || '';

        // Command /start
        if (text === '/start') {
            await handleStart(chatId);
            return { statusCode: 200, body: 'OK' };
        }

        // Command /info
        if (text === '/info') {
            await handleInfo(chatId);
            return { statusCode: 200, body: 'OK' };
        }

        // Unknown command
        await sendTelegramMessage(chatId,
            '❓ *Không hiểu lệnh!*\n\n' +
            '📌 *Các lệnh hỗ trợ:*\n' +
            '/start - Bắt đầu và đăng nhập Zalo\n' +
            '/info - Lấy thông tin user Zalo'
        );
        
        return { statusCode: 200, body: 'OK' };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error' })
        };
    }
};
