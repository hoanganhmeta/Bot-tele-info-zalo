const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const webhookUrl = 'https://hoanganhbzl.netlify.app/.netlify/functions/telegram-bot';
        
        const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl })
        });
        
        const result = await response.json();
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Webhook set successfully', 
                result: result 
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
