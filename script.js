const defaultUkeord = [
    "sjokolade",
    "kjøkken",
    "familie",
    "sykkel",
    "håndkle",
    "vennskap"
];

const defaultGloser = [
    { no: "hund", en: "dog" },
    { no: "katt", en: "cat" },
    { no: "hus", en: "house" },
    { no: "bil", en: "car" },
    { no: "bok", en: "book" },
    { no: "skole", en: "school" }
];

const customStorageKeys = {
    ukeord: "ukeordCustom",
    gloser: "gloserCustom"
};

let selectedMode = "";
let questions = [];
let currentQuestion = 0;
let score = 0;
let answerLocked = false;

function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

function parseUkeordInput(rawInput) {
    return rawInput
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^[-*•]\s*/, ""))
        .filter(Boolean);
}

function parseGloserInput(rawInput) {
    return rawInput
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^[-*•]\s*/, ""))
        .filter(Boolean)
        .map((line) => {
            const match = line.match(/^(.+?)\s*(?:-|:|,)\s*(.+)$/);

            if (!match) {
                return null;
            }

            const no = match[1].trim();
            const en = match[2].trim();

            if (!no || !en) {
                return null;
            }

            return { no, en };
        })
        .filter(Boolean);
}

function getStoredList(key, fallback) {
    try {
        const stored = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(stored) ? stored : fallback;
    } catch (error) {
        return fallback;
    }
}

function getUkeordList() {
    const custom = getStoredList(customStorageKeys.ukeord, []);
    return custom.length > 0 ? custom : defaultUkeord;
}

function getGloserList() {
    const custom = getStoredList(customStorageKeys.gloser, []);
    return custom.length > 0 ? custom : defaultGloser;
}

function setCustomStatus(message, isError = false) {
    const status = document.getElementById("customStatus");

    if (!status) {
        return;
    }

    status.textContent = message;
    status.style.color = isError ? "#b42318" : "#006b3c";
}

function setCustomWordsHidden(hidden) {
    const customWords = document.getElementById("customWords");
    const toggleWordsBtn = document.getElementById("toggleWordsBtn");

    if (!customWords || !toggleWordsBtn) {
        return;
    }

    customWords.classList.toggle("words-hidden", hidden);

    toggleWordsBtn.textContent = hidden
        ? "Vis egne ord"
        : "Skjul egne ord";

    toggleWordsBtn.setAttribute("aria-pressed", String(hidden));
    toggleWordsBtn.setAttribute(
        "aria-label",
        hidden ? "Vis egne ord" : "Skjul egne ord"
    );
}

function loadCustomLists() {
    const customUkeordInput =
        document.getElementById("customUkeordInput");

    const customGloserInput =
        document.getElementById("customGloserInput");

    if (!customUkeordInput || !customGloserInput) {
        return;
    }

    const customUkeord = getStoredList(
        customStorageKeys.ukeord,
        defaultUkeord
    );

    const customGloser = getStoredList(
        customStorageKeys.gloser,
        defaultGloser
    );

    customUkeordInput.value = customUkeord.join("\n");

    customGloserInput.value = customGloser
        .map((entry) => `${entry.no} - ${entry.en}`)
        .join("\n");
}

function saveCustomLists() {
    const customUkeordInput =
        document.getElementById("customUkeordInput");

    const customGloserInput =
        document.getElementById("customGloserInput");

    if (!customUkeordInput || !customGloserInput) {
        return;
    }

    const customUkeord = parseUkeordInput(
        customUkeordInput.value
    );

    const customGloser = parseGloserInput(
        customGloserInput.value
    );

    if (customUkeord.length > 0) {
        localStorage.setItem(
            customStorageKeys.ukeord,
            JSON.stringify(customUkeord)
        );
    } else {
        localStorage.removeItem(customStorageKeys.ukeord);
    }

    if (customGloser.length > 0) {
        localStorage.setItem(
            customStorageKeys.gloser,
            JSON.stringify(customGloser)
        );
    } else {
        localStorage.removeItem(customStorageKeys.gloser);
    }

    setCustomStatus("Dine egne ord er lagret.");
}

function resetCustomLists() {
    const customUkeordInput =
        document.getElementById("customUkeordInput");

    const customGloserInput =
        document.getElementById("customGloserInput");

    if (!customUkeordInput || !customGloserInput) {
        return;
    }

    localStorage.removeItem(customStorageKeys.ukeord);
    localStorage.removeItem(customStorageKeys.gloser);

    customUkeordInput.value = defaultUkeord.join("\n");

    customGloserInput.value = defaultGloser
        .map((entry) => `${entry.no} - ${entry.en}`)
        .join("\n");

    setCustomStatus("Standardordene er tilbake.");
}

function startGame(mode) {
    selectedMode = mode;
    score = 0;
    currentQuestion = 0;
    answerLocked = false;

    const gameBox = document.getElementById("game");

    if (!gameBox) {
        return;
    }

    if (mode === "ukeord") {
        questions = shuffle([...getUkeordList()]);
    } else {
        questions = shuffle([...getGloserList()]);
    }

    if (questions.length === 0) {
        questions = mode === "ukeord"
            ? [...defaultUkeord]
            : [...defaultGloser];
    }

    const scoreLabel = document.getElementById("score");

    if (scoreLabel) {
        scoreLabel.innerText = score;
    }

    // Skjul ordene når øvingen starter.
    setCustomWordsHidden(true);

    gameBox.classList.remove("hidden");

    showQuestion();
}

function showQuestion() {
    const answerInput = document.getElementById("answer");
    const feedback = document.getElementById("feedback");
    const progress = document.getElementById("progress");
    const question = document.getElementById("question");
    const checkBtn = document.getElementById("checkBtn");

    if (!answerInput || !feedback || !progress || !question) {
        return;
    }

    answerLocked = false;

    if (checkBtn) {
        checkBtn.disabled = false;
    }

    answerInput.value = "";
    answerInput.focus();

    feedback.innerHTML = "";
    feedback.className = "";

    progress.innerText =
        `${currentQuestion + 1} / ${questions.length}`;

    if (selectedMode === "ukeord") {
        question.innerHTML =
            `Skriv ordet:<br><br><b>${questions[currentQuestion]}</b>`;
    } else {
        question.innerHTML =
            `Hva er engelsk for:<br><br>` +
            `<b>${questions[currentQuestion].no}</b>`;
    }
}

function checkAnswer() {
    if (answerLocked) {
        return;
    }

    const answerInput = document.getElementById("answer");
    const feedback = document.getElementById("feedback");
    const scoreLabel = document.getElementById("score");
    const checkBtn = document.getElementById("checkBtn");

    if (
        !answerInput ||
        !feedback ||
        !scoreLabel ||
        questions.length === 0
    ) {
        return;
    }

    answerLocked = true;

    if (checkBtn) {
        checkBtn.disabled = true;
    }

    const answer = answerInput.value.trim().toLowerCase();
    let correctAnswer;

    if (selectedMode === "ukeord") {
        correctAnswer =
            questions[currentQuestion].toLowerCase();
    } else {
        correctAnswer =
            questions[currentQuestion].en.toLowerCase();
    }

    if (answer === correctAnswer) {
        score++;
        scoreLabel.innerText = score;

        feedback.className = "correct";
        feedback.innerHTML = "✅ Riktig!";
    } else {
        feedback.className = "wrong";
        feedback.innerHTML =
            `❌ Feil<br>Riktig svar: ${correctAnswer}`;
    }

    currentQuestion++;

    if (currentQuestion < questions.length) {
        setTimeout(() => {
            showQuestion();
        }, 1500);
    } else {
        setTimeout(() => {
            showResult();
        }, 1500);
    }
}

function showResult() {
    const question = document.getElementById("question");
    const feedback = document.getElementById("feedback");
    const progress = document.getElementById("progress");
    const answerInput = document.getElementById("answer");
    const checkBtn = document.getElementById("checkBtn");

    if (!question || !feedback || !progress) {
        return;
    }

    const max = questions.length;

    question.innerHTML = "🏆 Ferdig!";
    feedback.className = "correct";
    feedback.innerHTML =
        `Du fikk ${score} av ${max} poeng!`;

    progress.innerHTML = "Fullført";

    if (score === max) {
        feedback.innerHTML += "<br><br>🎉 Fantastisk! 🎉";
    }

    if (answerInput) {
        answerInput.value = "";
        answerInput.disabled = true;
    }

    if (checkBtn) {
        checkBtn.disabled = true;
    }
}

function initApp() {
    const checkBtn = document.getElementById("checkBtn");
    const answerInput = document.getElementById("answer");
    const saveCustomBtn =
        document.getElementById("saveCustomBtn");
    const resetCustomBtn =
        document.getElementById("resetCustomBtn");
    const toggleWordsBtn =
        document.getElementById("toggleWordsBtn");

    if (checkBtn) {
        checkBtn.addEventListener("click", checkAnswer);
    }

    if (answerInput) {
        answerInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                checkAnswer();
            }
        });
    }

    if (saveCustomBtn) {
        saveCustomBtn.addEventListener("click", saveCustomLists);
    }

    if (resetCustomBtn) {
        resetCustomBtn.addEventListener("click", resetCustomLists);
    }

    if (toggleWordsBtn) {
        toggleWordsBtn.addEventListener("click", () => {
            const customWords =
                document.getElementById("customWords");

            const isHidden =
                customWords &&
                customWords.classList.contains("words-hidden");

            setCustomWordsHidden(!isHidden);
        });
    }

    loadCustomLists();
}

document.addEventListener("DOMContentLoaded", initApp);
