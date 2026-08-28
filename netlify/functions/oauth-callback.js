const fetch = require('node-fetch');

// ============ CẤU HÌNH ============
const CONFIG = {
    ZALO_APP_ID: process.env.ZALO_APP_ID || '1752876402407902351',
    ZALO_SECRET_KEY: process.env.ZALO_SECRET_KEY || '83DLdwH62YIT4YrJSSSO',
};

// ============ GỬI TIN NHẮN TELEGRAM ============
async function sendTelegramMessage(chatId, text) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            })
        });
    } catch (error) {
        console.error('Telegram send error:', error);
    }
}

// ============ ĐỔI CODE LẤY TOKEN ============
async function exchangeCodeForToken(code, verifier) {
    try {
        const response = await fetch('https://oauth.zaloapp.com/v4/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'secret_key': CONFIG.ZALO_SECRET_KEY
            },
            body: new URLSearchParams({
                code: code,
                app_id: CONFIG.ZALO_APP_ID,
                grant_type: 'authorization_code',
                code_verifier: verifier
            })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Exchange token error:', error);
        return { error: error.message };
    }
}

// ============ LẤY THÔNG TIN USER ZALO ============
async function getZaloUserInfo(accessToken) {
    try {
        const response = await fetch('https://graph.zalo.me/v2.0/me', {
            method: 'GET',
            headers: {
                'access_token': accessToken,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Get user info error:', error);
        return { error: error.message };
    }
}

// ============ FORMAT THÔNG TIN USER ============
function formatUserInfo(data) {
    let msg = '👤 *Thông tin Zalo User*\n';
    msg += ' ├─\n';
    msg += ` ├ ID: ${data.id || 'N/A'}\n`;
    msg += ` ├ Name: ${data.name || 'N/A'}\n`;
    msg += ` ├ Email: ${data.email || 'N/A'}\n`;
    msg += ` ├ Gender: ${data.gender === 'male' ? 'Nam' : data.gender === 'female' ? 'Nữ' : 'N/A'}\n`;
    msg += ` ├ Birthday: ${data.birthday || 'N/A'}\n`;
    
    if (data.picture) {
        msg += `\n ├─ Avatar: ${data.picture.data && data.picture.data.url ? data.picture.data.url : 'N/A'}\n`;
    }
    
    if (data.phone) {
        msg += ` ├─ Phone: ${data.phone || 'N/A'}\n`;
    }
    
    msg += `\n └─ *Đã lấy thông tin thành công!*`;
    return msg;
}

// ============ HANDLER CHÍNH ============
exports.handler = async (event) => {
    try {
        const params = new URLSearchParams(event.queryStringParameters || {});
        const code = params.get('code');
        const state = params.get('state');
        const error = params.get('error');
        const errorCode = params.get('error_code');

        if (error) {
            console.error('OAuth Error:', { error, errorCode });
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: `
                    <html>
                        <body style="font-family: Arial; text-align: center; padding: 50px;">
                            <h2>❌ Lỗi xác thực</h2>
                            <p>Mã lỗi: ${errorCode}</p>
                            <p>Vui lòng thử lại lệnh /start trong bot Telegram</p>
                        </body>
                    </html>
                `
            };
        }

        if (!code) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: `
                    <html>
                        <body style="font-family: Arial; text-align: center; padding: 50px;">
                            <h2>❌ Không tìm thấy mã xác thực</h2>
                            <p>Vui lòng thử lại lệnh /start trong bot Telegram</p>
                        </body>
                    </html>
                `
            };
        }

        let stateData = {};
        try {
            if (state) {
                const decoded = Buffer.from(state, 'base64').toString('utf-8');
                stateData = JSON.parse(decoded);
            }
        } catch (e) {
            console.error('Decode state error:', e);
        }

        const chatId = stateData.chatId;
        const verifier = stateData.verifier;

        if (!chatId || !verifier) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: `
                    <html>
                        <body style="font-family: Arial; text-align: center; padding: 50px;">
                            <h2>⚠️ Thông tin không hợp lệ</h2>
                            <p>Vui lòng thử lại lệnh /start trong bot Telegram</p>
                        </body>
                    </html>
                `
            };
        }

        const tokenResult = await exchangeCodeForToken(code, verifier);

        if (tokenResult.error) {
            await sendTelegramMessage(chatId,
                `❌ *Lỗi lấy token:*\n${tokenResult.error}`
            );
            
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: `
                    <html>
                        <body style="font-family: Arial; text-align: center; padding: 50px;">
                            <h2>❌ Lỗi lấy token</h2>
                            <p>Vui lòng thử lại lệnh /start trong bot Telegram</p>
                        </body>
                    </html>
                `
            };
        }

        const userInfo = await getZaloUserInfo(tokenResult.access_token);

        if (userInfo.error) {
            await sendTelegramMessage(chatId,
                `❌ *Lỗi lấy thông tin user:*\n${userInfo.error}`
            );
        } else {
            const msg = formatUserInfo(userInfo);
            await sendTelegramMessage(chatId, msg);
            
            await sendTelegramMessage(chatId,
                `🔑 *Access Token:*\n\`${tokenResult.access_token}\`\n\n` +
                `⏰ *Expires in:* ${tokenResult.expires_in || 3600} giây\n\n` +
                `💡 *Lưu ý:* Token sẽ hết hạn, hãy dùng /info để lấy lại.`
            );
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: `
                <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f2f5; }
                            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                            .success { color: #28a745; font-size: 48px; }
                            h2 { color: #333; }
                            p { color: #666; margin: 20px 0; }
                            .btn { display: inline-block; background: #1a73e8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; }
                            .btn:hover { background: #0d47a1; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="success">✅</div>
                            <h2>Đăng nhập thành công!</h2>
                            <p>Thông tin của bạn đã được gửi đến bot Telegram.</p>
                            <p>Hãy quay lại ứng dụng để sử dụng.</p>
                            <p style="font-size: 12px; color: #999;">Chat ID: ${chatId}</p>
                        </div>
                    </body>
                </html>
            `
        };

    } catch (error) {
        console.error('OAuth callback error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'text/html' },
            body: `
                <html>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h2>❌ Lỗi hệ thống</h2>
                        <p>${error.message}</p>
                        <p>Vui lòng thử lại sau</p>
                    </body>
                </html>
            `
        };
    }
};
