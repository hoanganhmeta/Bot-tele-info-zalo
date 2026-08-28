const fetch = require('node-fetch');

async function setWebhook() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!token) {
        console.error('❌ TELEGRAM_BOT_TOKEN is not set!');
        console.log('Please set TELEGRAM_BOT_TOKEN in environment variables');
        return;
    }

    // THAY ĐỔI URL NÀY THÀNH URL CỦA BẠN
    const webhookUrl = 'https://your-app.netlify.app/.netlify/functions/telegram-bot';
    
    console.log('🔄 Setting webhook...');
    console.log(`📡 Webhook URL: ${webhookUrl}`);

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: webhookUrl,
                allowed_updates: ['message']
            })
        });

        const result = await response.json();
        console.log('✅ Webhook setup result:', result);

        if (result.ok) {
            const infoResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
            const info = await infoResponse.json();
            console.log('📊 Current webhook info:', info);
            
            console.log('\n✅ Setup completed successfully!');
            console.log('📱 Bot is ready to use on Telegram');
        }

    } catch (error) {
        console.error('❌ Error setting webhook:', error);
    }
}

// Chạy script
if (require.main === module) {
    setWebhook();
}

module.exports = { setWebhook };
