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
    if (!status) return;

    status.textContent = message;
    status.style.color = isError ? "#b42318" : "#006b3c";
}

function loadCustomLists() {
    const customUkeordInput = document.getElementById("customUkeordInput");
    const customGloserInput = document.getElementById("customGloserInput");

    if (!customUkeordInput || !customGloserInput) {
        return;
    }

    const customUkeord = getStoredList(customStorageKeys.ukeord, defaultUkeord);
    const customGloser = getStoredList(customStorageKeys.gloser, defaultGloser);

    customUkeordInput.value = customUkeord.join("\n");
    customGloserInput.value = customGloser
        .map((entry) => `${entry.no} - ${entry.en}`)
        .join("\n");
}

function saveCustomLists() {
    const customUkeordInput = document.getElementById("customUkeordInput");
    const customGloserInput = document.getElementById("customGloserInput");

    if (!customUkeordInput || !customGloserInput) {
        return;
    }

    const customUkeord = parseUkeordInput(customUkeordInput.value);
    const customGloser = parseGloserInput(customGloserInput.value);

    if (customUkeord.length > 0) {
        localStorage.setItem(customStorageKeys.ukeord, JSON.stringify(customUkeord));
    } else {
        localStorage.removeItem(customStorageKeys.ukeord);
    }

    if (customGloser.length > 0) {
        localStorage.setItem(customStorageKeys.gloser, JSON.stringify(customGloser));
    } else {
        localStorage.removeItem(customStorageKeys.gloser);
    }

    setCustomStatus("Dine egne ord er lagret.");
}

function resetCustomLists() {
    const customUkeordInput = document.getElementById("customUkeordInput");
    const customGloserInput = document.getElementById("customGloserInput");

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

    if (mode === "ukeord") {
        questions = shuffle([...getUkeordList()]);
    } else {
        questions = shuffle([...getGloserList()]);
    }

    if (questions.length === 0) {
        questions = mode === "ukeord" ? [...defaultUkeord] : [...defaultGloser];
    }

    document.getElementById("score").innerText = score;
    document.getElementById("game").classList.remove("hidden");

    showQuestion();
}

function showQuestion() {
    document.getElementById("answer").value = "";
    document.getElementById("feedback").innerHTML = "";

    document.getElementById("progress").innerText =
        `${currentQuestion + 1} / ${questions.length}`;

    if (selectedMode === "ukeord") {
        document.getElementById("question").innerHTML =
            `Skriv ordet:<br><br><b>${questions[currentQuestion]}</b>`;
    } else {
        document.getElementById("question").innerHTML =
            `Hva er engelsk for:<br><br><b>${questions[currentQuestion].no}</b>`;
    }
}

function checkAnswer() {
    let answer =
        document.getElementById("answer")
            .value
            .trim()
            .toLowerCase();

    let correctAnswer;

    if (selectedMode === "ukeord") {
        correctAnswer = questions[currentQuestion].toLowerCase();
    } else {
        correctAnswer = questions[currentQuestion].en.toLowerCase();
    }

    const feedback = document.getElementById("feedback");

    if (answer === correctAnswer) {
        score++;
        document.getElementById("score").innerText = score;

        feedback.className = "correct";
        feedback.innerHTML = "✅ Riktig!";
    } else {
        feedback.className = "wrong";
        feedback.innerHTML = `❌ Feil<br>Riktig svar: ${correctAnswer}`;
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
    let max = questions.length;

    document.getElementById("question").innerHTML = "🏆 Ferdig!";

    document.getElementById("feedback").innerHTML =
        `Du fikk ${score} av ${max} poeng!`;

    document.getElementById("progress").innerHTML = "Fullført";

    if (score === max) {
        document.getElementById("feedback").innerHTML +=
            "<br><br>🎉 Fantastisk! 🎉";
    }
}

document.getElementById("checkBtn").addEventListener("click", checkAnswer);

document.getElementById("answer").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        checkAnswer();
    }
});

document.getElementById("saveCustomBtn").addEventListener("click", saveCustomLists);
document.getElementById("resetCustomBtn").addEventListener("click", resetCustomLists);

loadCustomLists();
