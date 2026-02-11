const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
async function handleMain(text) {
    try {
        const result = await model.generateContent(text);
        return result.response.text();
    } catch (e) { return 'AI sedang sibuk.'; }
}
module.exports = { handleMain };
