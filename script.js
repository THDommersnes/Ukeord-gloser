const defaultUkeord = ["sjokolade", "kjøkken", "familie", "sykkel", "håndkle", "vennskap"];
const defaultGloser = [{ no: "hund", en: "dog" }, { no: "katt", en: "cat" }, { no: "hus", en: "house" }, { no: "bil", en: "car" }, { no: "bok", en: "book" }, { no: "skole", en: "school" }];
const customStorageKeys = { ukeord: "ukeordCustom", gloser: "gloserCustom", combined: "combinedCustom" };
let selectedMode = "", questions = [], currentQuestion = 0, score = 0, answerLocked = false;

function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function normalizeText(value) {
    return String(value ?? "").trim();
}

function normalizeAnswer(value) {
    return normalizeText(value)
        .toLocaleLowerCase("nb-NO")
        .replace(/\s+/g, " ");
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

function parseUkeordInput(value) {
    return normalizeText(value)
        .split(/\n+/)
        .map(line => line.trim().replace(/^[-*•]\s*/, ""))
        .filter(Boolean);
}

function parseGloserInput(value) {
    return normalizeText(value)
        .split(/\n+/)
        .map(line => line.trim().replace(/^[-*•]\s*/, ""))
        .map(line => {
            const match = line.match(/^(.+?)\s*(?:-|:|,)\s*(.+)$/);
            return match ? { no: match[1].trim(), en: match[2].trim() } : null;
        })
        .filter(item => item && item.no && item.en);
}

function parseCombinedInput(value) {
    const ukeord = [];
    const gloser = [];
    const invalid = [];

    normalizeText(value)
        .split(/\n+/)
        .map(line => line.trim().replace(/^[-*•]\s*/, ""))
        .filter(Boolean)
        .forEach(line => {
            const match = line.match(/^(.+?)\s*(?:-|:|,)\s*(.+)$/);
            if (match) {
                gloser.push({ no: match[1].trim(), en: match[2].trim() });
                return;
            }

            const isLikelyGlossary = /\b(?:to|for|med|og)\b/i.test(line) || /\s+-\s+/.test(line);
            if (isLikelyGlossary) {
                invalid.push(line);
                return;
            }

            ukeord.push(line);
        });

    return { ukeord: dedupeStrings(ukeord), gloser: dedupeGlossary(gloser), invalid };
}

function dedupeStrings(values) {
    return [...new Set(values.map(value => normalizeText(value)).filter(Boolean))];
}

function dedupeGlossary(items) {
    const seen = new Set();
    const result = [];

    items.forEach(item => {
        if (!item || !item.no || !item.en) return;
        const key = `${normalizeText(item.no).toLocaleLowerCase("nb-NO")}::${normalizeText(item.en).toLocaleLowerCase("en-US")}`;
        if (seen.has(key)) return;
        seen.add(key);
        result.push({ no: normalizeText(item.no), en: normalizeText(item.en) });
    });

    return result;
}

function getStoredList(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : fallback;
    } catch (_) { return fallback; }
}

function setStoredValue(key, value) {
    try {
        if (value && value.length) {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        }
        localStorage.removeItem(key);
        return true;
    } catch (_) {
        return false;
    }
}

function getUkeordList() {
    const stored = getStoredList(customStorageKeys.ukeord, []);
    return stored.length ? stored : defaultUkeord;
}

function getGloserList() {
    const stored = getStoredList(customStorageKeys.gloser, []);
    return stored.length ? stored : defaultGloser;
}

function setCustomStatus(message, error = false) {
    const el = document.getElementById("customStatus");
    if (el) {
        el.textContent = message;
        el.classList.toggle("status-error", error);
    }
}

function setCustomWordsHidden(hidden) {
    const section = document.getElementById("customWords");
    const button = document.getElementById("toggleWordsBtn");
    if (!section || !button) return;
    section.classList.toggle("words-hidden", hidden);
    button.textContent = hidden ? "🙉 Vis egne ord" : "🙈 Skjul egne ord";
    button.setAttribute("aria-pressed", String(hidden));
    button.setAttribute("aria-label", hidden ? "Vis egne ord" : "Skjul egne ord");
}

function loadCustomLists() {
    const u = document.getElementById("customUkeordInput");
    const g = document.getElementById("customGloserInput");
    const c = document.getElementById("customCombinedInput");
    if (!u || !g || !c) return;

    const storedUkeord = getStoredList(customStorageKeys.ukeord, defaultUkeord);
    const storedGloser = getStoredList(customStorageKeys.gloser, defaultGloser);

    u.value = storedUkeord.join("\n");
    g.value = storedGloser.map(item => `${item.no} - ${item.en}`).join("\n");

    const combined = [
        ...storedUkeord,
        ...storedGloser.map(item => `${item.no} - ${item.en}`)
    ];
    c.value = combined.join("\n");
}

function saveCustomLists() {
    const combinedInput = document.getElementById("customCombinedInput");
    const ukeordInput = document.getElementById("customUkeordInput");
    const gloserInput = document.getElementById("customGloserInput");

    if (!combinedInput || !ukeordInput || !gloserInput) return;

    const combined = parseCombinedInput(combinedInput.value);
    const ukeord = dedupeStrings(parseUkeordInput(ukeordInput.value));
    const gloser = dedupeGlossary(parseGloserInput(gloserInput.value));

    const mergedUkeord = dedupeStrings([...combined.ukeord, ...ukeord]);
    const mergedGloser = dedupeGlossary([...combined.gloser, ...gloser]);

    const savedUkeord = setStoredValue(customStorageKeys.ukeord, mergedUkeord) ? mergedUkeord : [];
    const savedGloser = setStoredValue(customStorageKeys.gloser, mergedGloser) ? mergedGloser : [];

    const mergedCombined = [
        ...savedUkeord,
        ...savedGloser.map(item => `${item.no} - ${item.en}`)
    ].join("\n");

    combinedInput.value = mergedCombined;

    if (!savedUkeord.length && !savedGloser.length) {
        setCustomStatus("Ingen ord ble lagret. Skriv inn minst ett ord eller en gloseliste.", true);
        return;
    }

    if (combined.invalid.length) {
        setCustomStatus(`Dine egne ord er lagret. ${combined.invalid.length} linje(r) ble ignorert fordi de ikke hadde et gyldig format.`, false);
    } else {
        setCustomStatus("Dine egne ord er lagret.");
    }
}

function startGame(mode) {
    if (!mode) return;

    const list = mode === "ukeord" ? getUkeordList() : getGloserList();
    if (!list.length) {
        setCustomStatus("Det finnes ingen ord i denne listen ennå. Legg inn egne ord først.", true);
        return;
    }

    selectedMode = mode;
    score = 0;
    currentQuestion = 0;
    answerLocked = false;
    questions = shuffle(list);
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
    const restartBtn = document.getElementById("restartBtn");

    if (!input || !feedback || !question || !replay || !questions[currentQuestion]) return;

    answerLocked = false;
    input.disabled = false;
    input.value = "";
    input.focus();
    feedback.textContent = "";
    feedback.className = "";
    readEnglishBtn?.classList.toggle("hidden", selectedMode !== "gloser");
    restartBtn?.classList.add("hidden");
    document.getElementById("progress").textContent = `${currentQuestion + 1} / ${questions.length}`;
    replay.classList.toggle("hidden", selectedMode !== "ukeord");

    question.textContent = "";

    if (selectedMode === "ukeord") {
        question.textContent = "🎧 Hør ordet og skriv det du hørte";
        setTimeout(() => {
            if (!answerLocked && questions[currentQuestion]) {
                speakText(questions[currentQuestion]);
            }
        }, 500);
    } else {
        const prompt = document.createElement("div");
        prompt.textContent = "Hva er engelsk for:";
        const strong = document.createElement("strong");
        strong.textContent = questions[currentQuestion].no;
        question.appendChild(prompt);
        question.appendChild(document.createElement("br"));
        question.appendChild(document.createElement("br"));
        question.appendChild(strong);
        if (readEnglishBtn) readEnglishBtn.title = `Les engelsk ord: ${questions[currentQuestion].en}`;
    }
}

function checkAnswer() {
    if (answerLocked) return;

    const input = document.getElementById("answer");
    const feedback = document.getElementById("feedback");
    const entry = questions[currentQuestion];

    if (!input || !feedback || !entry) return;

    const correctAnswer = selectedMode === "ukeord" ? entry : entry.en;
    const correct = normalizeAnswer(input.value) === normalizeAnswer(correctAnswer);
    answerLocked = true;

    if (correct) {
        score++;
        document.getElementById("score").textContent = score;
        feedback.className = "correct";
        feedback.textContent = "Riktig!";
        speakText(correctAnswer, selectedMode === "ukeord" ? "nb-NO" : "en-US");

        currentQuestion++;
        setTimeout(() => {
            currentQuestion < questions.length ? showQuestion() : showResult();
        }, 1800);
        return;
    }

    const correctText = entry.en || entry;
    feedback.className = "wrong";
    feedback.textContent = `Prøv igjen! Det riktige svaret er ${correctText}.`;
    input.select();
    document.getElementById("readEnglishBtn")?.classList.toggle("hidden", selectedMode !== "gloser");
    speakText(correctText, selectedMode === "ukeord" ? "nb-NO" : "en-US");
    answerLocked = false;
}

function showResult() {
    const restartBtn = document.getElementById("restartBtn");
    const answer = document.getElementById("answer");
    const feedback = document.getElementById("feedback");
    const question = document.getElementById("question");
    const progress = document.getElementById("progress");
    const readEnglishBtn = document.getElementById("readEnglishBtn");

    if (question) question.textContent = "🏆 Ferdig!";
    if (feedback) feedback.textContent = `Du fikk ${score} av ${questions.length} poeng!`;
    if (progress) progress.textContent = "Ferdig";
    if (answer) answer.disabled = true;
    if (readEnglishBtn) readEnglishBtn.classList.add("hidden");
    if (restartBtn) restartBtn.classList.remove("hidden");
}

function initApp() {
    const answerForm = document.getElementById("answerForm");
    const checkBtn = document.getElementById("checkBtn");
    const saveCustomBtn = document.getElementById("saveCustomBtn");
    const toggleWordsBtn = document.getElementById("toggleWordsBtn");
    const replayAudioBtn = document.getElementById("replayAudioBtn");
    const readEnglishBtn = document.getElementById("readEnglishBtn");
    const restartBtn = document.getElementById("restartBtn");
    const answerInput = document.getElementById("answer");

    document.querySelectorAll(".game-mode").forEach(button => {
        button.addEventListener("click", () => startGame(button.dataset.mode));
    });

    if (checkBtn && answerForm) {
        answerForm.addEventListener("submit", event => {
            event.preventDefault();
            checkAnswer();
        });
    }

    if (answerInput) {
        answerInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                checkAnswer();
            }
        });
    }

    if (saveCustomBtn) saveCustomBtn.addEventListener("click", saveCustomLists);

    if (toggleWordsBtn) {
        toggleWordsBtn.addEventListener("click", () => {
            setCustomWordsHidden(!document.getElementById("customWords").classList.contains("words-hidden"));
        });
    }

    if (replayAudioBtn) {
        replayAudioBtn.addEventListener("click", () => {
            if (selectedMode === "ukeord" && questions[currentQuestion]) speakText(questions[currentQuestion]);
        });
    }

    if (readEnglishBtn) {
        readEnglishBtn.addEventListener("click", () => {
            const item = questions[currentQuestion];
            if (selectedMode === "gloser" && item?.en) speakText(item.en, "en-US");
        });
    }

    if (restartBtn) {
        restartBtn.addEventListener("click", () => {
            if (selectedMode) startGame(selectedMode);
        });
    }

    loadCustomLists();
}

document.addEventListener("DOMContentLoaded", initApp);
