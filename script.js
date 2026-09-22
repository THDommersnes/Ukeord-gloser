const defaultUkeord = ["sjokolade", "kjøkken", "familie", "sykkel", "håndkle", "vennskap"];
const defaultGloser = [{ no: "hund", en: "dog" }, { no: "katt", en: "cat" }, { no: "hus", en: "house" }, { no: "bil", en: "car" }, { no: "bok", en: "book" }, { no: "skole", en: "school" }];
const customStorageKeys = { ukeord: "ukeordCustom", gloser: "gloserCustom" };
let selectedMode = "", questions = [], currentQuestion = 0, score = 0, answerLocked = false;

function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function speakText(text, language = "nb-NO", cancel = true) {
    if (!text || !("speechSynthesis" in window)) return;
    if (cancel) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = language;
    u.rate = 0.9;
    speechSynthesis.speak(u);
}

function speakFeedback(correct) { speakText(correct ? "Riktig!" : "Prøv igjen!", "nb-NO"); }
function parseUkeordInput(value) { return value.split(/\n+/).map(x => x.trim().replace(/^[-*•]\s*/, "")).filter(Boolean); }
function parseGloserInput(value) {
    return value.split(/\n+/).map(x => x.trim().replace(/^[-*•]\s*/, "")).map(x => {
        const m = x.match(/^(.+?)\s*(?:-|:|,)\s*(.+)$/);
        return m ? { no: m[1].trim(), en: m[2].trim() } : null;
    }).filter(Boolean);
}
function getStoredList(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : fallback;
    } catch (_) { return fallback; }
}
function getUkeordList() { const x = getStoredList(customStorageKeys.ukeord, []); return x.length ? x : defaultUkeord; }
function getGloserList() { const x = getStoredList(customStorageKeys.gloser, []); return x.length ? x : defaultGloser; }
function setCustomStatus(message, error = false) {
    const el = document.getElementById("customStatus");
    if (el) { el.textContent = message; el.classList.toggle("status-error", error); }
}
function setCustomWordsHidden(hidden) {
    const section = document.getElementById("customWords"), button = document.getElementById("toggleWordsBtn");
    if (!section || !button) return;
    section.classList.toggle("words-hidden", hidden);
    button.textContent = hidden ? "🙉 Vis egne ord" : "🙈 Skjul egne ord";
    button.setAttribute("aria-pressed", String(hidden));
    button.setAttribute("aria-label", hidden ? "Vis egne ord" : "Skjul egne ord");
}
function loadCustomLists() {
    const u = document.getElementById("customUkeordInput"), g = document.getElementById("customGloserInput");
    if (!u || !g) return;
    u.value = getStoredList(customStorageKeys.ukeord, defaultUkeord).join("\n");
    g.value = getStoredList(customStorageKeys.gloser, defaultGloser).map(x => `${x.no} - ${x.en}`).join("\n");
}
function saveCustomLists() {
    const u = parseUkeordInput(document.getElementById("customUkeordInput").value);
    const g = parseGloserInput(document.getElementById("customGloserInput").value);
    if (u.length) localStorage.setItem(customStorageKeys.ukeord, JSON.stringify(u)); else localStorage.removeItem(customStorageKeys.ukeord);
    if (g.length) localStorage.setItem(customStorageKeys.gloser, JSON.stringify(g)); else localStorage.removeItem(customStorageKeys.gloser);
    setCustomStatus("Dine egne ord er lagret.");
}

function cleanOCRWord(value) { return String(value || "").replace(/[^\p{L}\s'-]/gu, "").replace(/\s+/g, " ").trim(); }
function ignoredOCRWord(value) {
    return /^(norsk|english|norwegian|ukeord|gloser|weekly|words|timeplan|lekse|step|read|pupil|usually|mate|chat|because|elev|vanligvis|kompis|prate|fordi)$/i.test(value);
}
function unique(values) { return [...new Map(values.map(x => [x.toLowerCase(), x])).values()]; }

// Reads both the old three-column layout and a two-column "Weekly words" layout.
// The previous version required words on exactly the same OCR baseline. That is
// fragile for screenshots, where words in one table row often have different y values.
function parseOCRTable(data) {
    const words = (data && data.words ? data.words : []).map(word => {
        const box = word.bbox || {};
        const height = Math.max(1, (box.bottom || 0) - (box.top || 0));
        return {
            text: cleanOCRWord(word.text),
            left: box.left || 0,
            right: box.right || box.left || 0,
            top: box.top || 0,
            bottom: box.bottom || (box.top || 0) + height,
            center: ((box.left || 0) + (box.right || box.left || 0)) / 2,
            height
        };
    }).filter(word => word.text && !ignoredOCRWord(word.text));

    if (!words.length) return { ukeord: [], gloser: [] };

    // Use a scale-aware tolerance. A fixed 22px tolerance fails on phone screenshots.
    const typicalHeight = words.slice().sort((a, b) => a.height - b.height)[Math.floor(words.length / 2)]?.height || 20;
    const rowTolerance = Math.max(22, typicalHeight * 0.75);
    const rows = [];
    words.sort((a, b) => a.top - b.top || a.left - b.left).forEach(word => {
        let row = rows.find(item => Math.abs(item.centerTop - word.top) <= rowTolerance);
        if (!row) {
            row = { centerTop: word.top, words: [] };
            rows.push(row);
        }
        row.words.push(word);
        row.centerTop = row.words.reduce((sum, item) => sum + item.top, 0) / row.words.length;
    });

    const ukeord = [], gloser = [];
    rows.sort((a, b) => a.centerTop - b.centerTop).forEach(row => {
        const sorted = row.words.sort((a, b) => a.left - b.left);
        if (sorted.length < 2) return;

        // A three-column weekly table: first column is ukeord, second English,
        // third Norwegian. Keep compatibility with that format.
        if (sorted.length >= 3) {
            const [first, second, third] = sorted;
            if (first.text.length >= 2 && second.text.length >= 2 && third.text.length >= 2) {
                ukeord.push(first.text);
                gloser.push({ no: third.text, en: second.text });
                return;
            }
        }

        // Two-column table: split at the largest horizontal gap. This also keeps
        // phrases such as "Lunch break" together in the left cell.
        let split = 1;
        let largestGap = -1;
        for (let i = 1; i < sorted.length; i++) {
            const gap = sorted[i].left - sorted[i - 1].right;
            if (gap > largestGap) { largestGap = gap; split = i; }
        }
        const left = sorted.slice(0, split).map(x => x.text).join(" ").trim();
        const right = sorted.slice(split).map(x => x.text).join(" ").trim();
        if (left.length < 2 || right.length < 2) return;
        if (/^(weekly words|english norwegian|teased erta|words)$/i.test(`${left} ${right}`)) return;

        // Weekly words are English on the left and Norwegian on the right.
        gloser.push({ no: right, en: left });
    });

    return {
        ukeord: unique(ukeord),
        gloser: gloser.filter((entry, i, list) => list.findIndex(x => x.no.toLowerCase() === entry.no.toLowerCase() && x.en.toLowerCase() === entry.en.toLowerCase()) === i)
    };
}

function mergeImported(imported) {
    const u = document.getElementById("customUkeordInput"), g = document.getElementById("customGloserInput");
    const ukeord = unique([...parseUkeordInput(u.value), ...(imported?.ukeord || [])]);
    const gloser = [...parseGloserInput(g.value), ...(imported?.gloser || [])].filter((entry, i, list) => list.findIndex(x => x.no.toLowerCase() === entry.no.toLowerCase() && x.en.toLowerCase() === entry.en.toLowerCase()) === i);
    u.value = ukeord.join("\n");
    g.value = gloser.map(x => `${x.no} - ${x.en}`).join("\n");
}

async function handleImageUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!window.Tesseract) { setCustomStatus("OCR-biblioteket ble ikke lastet. Last siden på nytt.", true); return; }
    setCustomStatus("Leser ordlisten i bildet...");
    try {
        const result = await Tesseract.recognize(file, "nor+eng", {
            logger: m => { if (m.status === "recognizing text") setCustomStatus(`Leser ordlisten i bildet... ${Math.round((m.progress || 0) * 100)}%`); }
        });
        const imported = parseOCRTable(result.data);
        if (!imported.ukeord.length && !imported.gloser.length) throw new Error("Ingen ord funnet i bildet");
        mergeImported(imported);
        setCustomStatus(`Importert ${imported.ukeord.length} ukeord og ${imported.gloser.length} gloser.`);
    } catch (error) {
        console.error(error);
        setCustomStatus("Fant ikke ordlisten. Prøv et skarpere bilde med hele tabellen synlig.", true);
    } finally { event.target.value = ""; }
}

function startGame(mode) {
    selectedMode = mode; score = 0; currentQuestion = 0; answerLocked = false;
    questions = shuffle(mode === "ukeord" ? getUkeordList() : getGloserList());
    document.getElementById("score").textContent = score;
    setCustomWordsHidden(true);
    document.getElementById("game").classList.remove("hidden");
    showQuestion();
}
function showQuestion() {
    const input = document.getElementById("answer"), feedback = document.getElementById("feedback"), question = document.getElementById("question"), replay = document.getElementById("replayAudioBtn");
    answerLocked = false; input.disabled = false; input.value = ""; input.focus(); feedback.textContent = "";
    document.getElementById("readEnglishBtn")?.classList.add("hidden");
    document.getElementById("progress").textContent = `${currentQuestion + 1} / ${questions.length}`;
    replay.classList.toggle("hidden", selectedMode !== "ukeord");
    if (selectedMode === "ukeord") {
        question.textContent = "🎧 Hør ordet og skriv det du hørte";
        setTimeout(() => { if (!answerLocked) speakText(questions[currentQuestion]); }, 500);
    } else question.innerHTML = `Hva er engelsk for:<br><br><b>${questions[currentQuestion].no}</b>`;
}
function checkAnswer() {
    if (answerLocked) return;
    const input = document.getElementById("answer"), feedback = document.getElementById("feedback"), entry = questions[currentQuestion];
    answerLocked = true;
    const correct = input.value.trim().toLowerCase() === (selectedMode === "ukeord" ? entry.toLowerCase() : entry.en.toLowerCase());
    speakFeedback(correct);
    if (correct) {
        score++; document.getElementById("score").textContent = score; feedback.className = "correct"; feedback.textContent = "Riktig!"; currentQuestion++;
        setTimeout(() => currentQuestion < questions.length ? showQuestion() : showResult(), 1200);
    } else {
        feedback.className = "wrong"; feedback.textContent = `Prøv igjen! Det riktige svaret er ${entry.en}.`; input.select();
        document.getElementById("readEnglishBtn")?.classList.toggle("hidden", selectedMode !== "gloser");
        answerLocked = false;
    }
}
function showResult() {
    document.getElementById("question").textContent = "🏆 Ferdig!";
    document.getElementById("feedback").innerHTML = `Du fikk ${score} av ${questions.length} poeng!`;
    document.getElementById("progress").textContent = "Ferdig";
    document.getElementById("answer").disabled = true;
    document.getElementById("readEnglishBtn")?.classList.add("hidden");
}
function initApp() {
    document.getElementById("checkBtn").addEventListener("click", checkAnswer);
    document.getElementById("answer").addEventListener("keydown", e => { if (e.key === "Enter") checkAnswer(); });
    document.getElementById("saveCustomBtn").addEventListener("click", saveCustomLists);
    document.getElementById("importImageBtn").addEventListener("click", () => document.getElementById("imageUploadInput").click());
    document.getElementById("imageUploadInput").addEventListener("change", handleImageUpload);
    document.getElementById("replayAudioBtn").addEventListener("click", () => { if (selectedMode === "ukeord") speakText(questions[currentQuestion]); });
    document.getElementById("toggleWordsBtn").addEventListener("click", () => setCustomWordsHidden(!document.getElementById("customWords").classList.contains("words-hidden")));
    document.getElementById("readEnglishBtn")?.addEventListener("click", () => { const item = questions[currentQuestion]; if (item?.en) speakText(item.en, "en-US"); });
    loadCustomLists();
}
document.addEventListener("DOMContentLoaded", initApp);
