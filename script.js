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
    if (!text || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
    const synth = window.speechSynthesis;
    if (cancel) synth.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = language;
    utterance.rate = 0.9;
    utterance.volume = 1;
    try { synth.resume(); } catch (_) {}
    synth.speak(utterance);
    return true;
}

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

function startGame(mode) {
    selectedMode = mode; score = 0; currentQuestion = 0; answerLocked = false;
    questions = shuffle(mode === "ukeord" ? getUkeordList() : getGloserList());
    document.getElementById("score").textContent = score;
    setCustomWordsHidden(true);
    document.getElementById("game").classList.remove("hidden");
    showQuestion();
}
function showQuestion() {
    const input = document.getElementById("answer");
    const feedback = document.getElementById("feedback");
    const question = document.getElementById("question");
    const replay = document.getElementById("replayAudioBtn");
    const readEnglishBtn = document.getElementById("readEnglishBtn");
    if (!input || !feedback || !question || !replay || !questions[currentQuestion]) return;

    answerLocked = false;
    input.disabled = false;
    input.value = "";
    input.focus();
    feedback.textContent = "";
    readEnglishBtn?.classList.toggle("hidden", selectedMode !== "gloser");
    document.getElementById("progress").textContent = `${currentQuestion + 1} / ${questions.length}`;
    replay.classList.toggle("hidden", selectedMode !== "ukeord");

    if (selectedMode === "ukeord") {
        question.textContent = "🎧 Hør ordet og skriv det du hørte";
        setTimeout(() => { if (!answerLocked && questions[currentQuestion]) speakText(questions[currentQuestion]); }, 500);
    } else {
        question.innerHTML = `Hva er engelsk for:<br><br><b>${questions[currentQuestion].no}</b>`;
        if (readEnglishBtn) readEnglishBtn.title = `Les engelsk ord: ${questions[currentQuestion].en}`;
    }
}
function checkAnswer() {
    if (answerLocked) return;
    const input = document.getElementById("answer");
    const feedback = document.getElementById("feedback");
    const entry = questions[currentQuestion];
    if (!entry) return;

    const correctAnswer = selectedMode === "ukeord" ? entry : entry.en;
    const correct = input.value.trim().toLocaleLowerCase() === correctAnswer.toLocaleLowerCase();
    answerLocked = true;

    if (correct) {
        score++;
        document.getElementById("score").textContent = score;
        feedback.className = "correct";
        feedback.textContent = "Riktig!";

        // Keep a copy before advancing, otherwise the next question can be spoken.
        // This is called directly from the button/Enter action for mobile browsers.
        speakText(correctAnswer, selectedMode === "ukeord" ? "nb-NO" : "en-US");

        currentQuestion++;
        // Give the correct answer time to finish before the next question is read.
        setTimeout(() => currentQuestion < questions.length ? showQuestion() : showResult(), 1800);
    } else {
        feedback.className = "wrong";
        feedback.textContent = `Prøv igjen! Det riktige svaret er ${entry.en || entry}.`;
        input.select();
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
    document.getElementById("toggleWordsBtn").addEventListener("click", () => setCustomWordsHidden(!document.getElementById("customWords").classList.contains("words-hidden")));
    document.getElementById("replayAudioBtn")?.addEventListener("click", () => {
        if (selectedMode === "ukeord" && questions[currentQuestion]) speakText(questions[currentQuestion]);
    });
    document.getElementById("readEnglishBtn")?.addEventListener("click", () => {
        const item = questions[currentQuestion];
        if (selectedMode === "gloser" && item?.en) speakText(item.en, "en-US");
    });
    loadCustomLists();
}
document.addEventListener("DOMContentLoaded", initApp);
