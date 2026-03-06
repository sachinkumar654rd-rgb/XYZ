const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDocs, collection, query } = require('firebase/firestore');

// --- अपनी डिटेल्स ---
const BOT_TOKEN = '8603590032:AAHn_ekd98bHCFU4dGLP7rJpJRuItkbZg_M'; 
const CHANNEL_ID = '-1003741235401'; 
const API_URL = "https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json";

const firebaseConfig = {
  apiKey: "AIzaSyA4QXhRkP1QESIMNBIKDmbs9sNxgzDTa7o",
  authDomain: "ai-prediction-bot-10e43.firebaseapp.com",
  projectId: "ai-prediction-bot-10e43",
  storageBucket: "ai-prediction-bot-10e43.firebasestorage.app",
  messagingSenderId: "361461213037",
  appId: "1:361461213037:web:61d8350f4ec029f97e5c64",
  measurementId: "G-WJX15QYL8F"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const bot = new Telegraf(BOT_TOKEN);
const appId = "ai-bot-v169";

// डेटाबेस से पूरी हिस्ट्री फेच करना
async function getAllHistory() {
    try {
        const historyRef = collection(db, 'artifacts', appId, 'public', 'data', 'game_history');
        const snapshot = await getDocs(query(historyRef));
        let allRecords = [];
        snapshot.forEach(doc => allRecords.push(doc.data()));
        // लेटेस्ट से पुराने के क्रम में सॉर्ट
        allRecords.sort((a, b) => b.issueNumber - a.issueNumber);
        return allRecords;
    } catch (e) {
        return [];
    }
}

// /prediction कमांड हैंडलर
bot.command('prediction', async (ctx) => {
    try {
        const response = await axios.get(`${API_URL}?pageSize=10&r=${Math.random()}`);
        const apiList = response.data.data.list;
        const latest = apiList[0];
        const nextIssue = (BigInt(latest.issueNumber) + 1n).toString();

        const allRecords = await getAllHistory();
        const currentSeq = apiList.map(h => parseInt(h.number));
        
        let prediction = "SKIP";
        let level = "No Match";

        if (allRecords.length >= 5) {
            const historyNums = allRecords.map(h => parseInt(h.number));
            for (let L = 10; L >= 3; L--) {
                const pattern = currentSeq.slice(0, L);
                for (let i = 1; i < historyNums.length - L; i++) {
                    let match = true;
                    for (let j = 0; j < L; j++) {
                        if (historyNums[i + j] !== pattern[j]) { match = false; break; }
                    }
                    if (match) {
                        const predictedNum = historyNums[i - 1];
                        prediction = predictedNum >= 5 ? "BIG" : "SMALL";
                        level = `L${L} DB Match`;
                        break;
                    }
                }
                if (prediction !== "SKIP") break;
            }
        }

        let msg = `🎯 *MANUAL PREDICTION*\n━━━━━━━━━━━━━━\n🆔 Next Period: \`#${nextIssue.slice(-4)}\`\n🎲 Prediction: *${prediction}*\n📊 Accuracy: \`${level}\`\n━━━━━━━━━━━━━━`;
        ctx.replyWithMarkdown(msg);
    } catch (e) {
        ctx.reply("⚠️ Error fetching prediction!");
    }
});

// /history कमांड हैंडलर
bot.command('history', async (ctx) => {
    try {
        const allRecords = await getAllHistory();
        if (allRecords.length === 0) {
            return ctx.reply("❌ No history found in Database!");
        }

        // पिछले 30 रिकॉर्ड दिखाना (ताकि मैसेज बहुत लंबा न हो)
        let historyMsg = `📊 *LAST ${Math.min(30, allRecords.length)} ROUNDS*\n━━━━━━━━━━━━━━\n`;
        allRecords.slice(0, 30).forEach(rec => {
            const size = parseInt(rec.number) >= 5 ? "BIG" : "SMALL";
            historyMsg += `\`#${rec.issueNumber.slice(-4)}\`:  ${rec.number} (${size})\n`;
        });
        historyMsg += `━━━━━━━━━━━━━━\nTotal Saved: \`${allRecords.length}\``;
        
        ctx.replyWithMarkdown(historyMsg);
    } catch (e) {
        ctx.reply("⚠️ Error fetching history!");
    }
});

// बैकग्राउंड में डेटा सेव करना (चुपचाप)
async function silentSync() {
    try {
        const response = await axios.get(`${API_URL}?pageSize=5&r=${Math.random()}`);
        const apiList = response.data.data.list;
        for (let item of apiList) {
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'game_history', item.issueNumber);
            await setDoc(docRef, {
                issueNumber: item.issueNumber,
                number: item.number,
                timestamp: Date.now()
            }, { merge: true });
        }
    } catch (e) {}
}

const app = express();
app.get('/', (req, res) => res.send('Command Bot Running...'));
app.listen(process.env.PORT || 3000);

// हर 1 मिनट में डेटा सिंक करें
setInterval(silentSync, 60000);

bot.launch();
console.log("Command Bot Started!");
