const fetch = require('node-fetch');

exports.handler = async (event) => {
    try {
        const params = new URLSearchParams(event.queryStringParameters || {});
        const code = params.get('code');
        const state = params.get('state');

        if (!code) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: '<h1>Không tìm thấy mã xác thực</h1>'
            };
        }

        // Decode state
        let stateData = {};
        try {
            const decoded = Buffer.from(state, 'base64').toString('utf-8');
            stateData = JSON.parse(decoded);
        } catch (e) {
            console.error('Decode state error:', e);
        }

        const chatId = stateData.chatId;
        const verifier = stateData.verifier;

        // Gửi thông báo về Telegram (tùy chọn)
        // ...

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: '<h1>✅ Đăng nhập thành công! Vui lòng quay lại Telegram</h1>'
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: 'Internal Server Error'
        };
    }
};
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
        msg += `\n ├─ Avatar: ${data.picture.data?.url || 'N/A'}\n`;
    }
    
    if (data.phone) {
        msg += ` ├─ Phone: ${data.phone || 'N/A'}\n`;
    }
    
    msg += `\n └─ *Đã lấy thông tin thành công!*`;
    return msg;
}

// ============ HANDLER ============
exports.handler = async (event, context) => {
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
                `⏰ *Expires in:* ${tokenResult.expires_in} giây\n\n` +
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
                        <p>Vui lòng thử lại sau</p>
                    </body>
                </html>
            `
        };
    }
};
